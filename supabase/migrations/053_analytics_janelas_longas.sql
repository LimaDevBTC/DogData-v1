-- ═══════════════════════════════════════════════════════════════════════════
-- 053: o painel de analytics volta a abrir 60 e 90 dias (e 180 pela API).
--
-- O PROBLEMA (28/11/2026): page_events tem 1,3 milhão de linhas (1 GB) e o
-- disco do banco é lento para leitura aleatória. Em 90 e 180 dias as funções
-- do relatório passavam do statement_timeout de 8 s do authenticator, e o
-- painel mostrava "banco ocupado". A pior consulta (tempo por página em
-- analytics_behavior) lê 943 mil eventos 'engagement' e leva ~10 s mesmo com
-- índice; nenhum índice a traz para baixo de 8 s nesse disco.
--
-- A SOLUÇÃO, em duas partes:
--   1. Índice cobrindo as colunas que o relatório lê, para leitura só do
--      índice (a lista de páginas de 180 dias caiu de 11,8 s para 0,2 s).
--      Criado CONCURRENTLY à parte; aqui fica com IF NOT EXISTS.
--   2. Janelas de 60 dias ou mais vêm de um resultado guardado, recalculado a
--      cada 3 horas pelo pg_cron (que roda sem o limite de 8 s). As funções
--      públicas mantêm nome e assinatura: a rota /api/analytics/report não
--      muda. Abaixo de 60 dias, tudo segue ao vivo. O bloco "agora" (últimos
--      30 minutos) é sempre recalculado ao vivo, mesmo na janela guardada.
--      Cada resposta guardada leva 'calculado_em'.
-- ═══════════════════════════════════════════════════════════════════════════

create index if not exists idx_page_events_painel
  on public.page_events (event_type, created_at)
  include (page, session_id, visitor_id, event_name, duration_ms, scroll_pct,
           vital_name, vital_value, vital_rating, device_type, language, viewport_w)
  where is_bot = false;

create table if not exists public.analytics_report_cache (
  fn            text        not null,
  dias          int         not null,
  payload       jsonb       not null,
  calculado_em  timestamptz not null default now(),
  primary key (fn, dias)
);
alter table public.analytics_report_cache enable row level security;
revoke all on public.analytics_report_cache from anon, authenticated;

-- As funções de cálculo continuam as mesmas; só mudam de nome.
alter function public.analytics_traffic(integer)  rename to analytics_traffic_calc;
alter function public.analytics_behavior(integer) rename to analytics_behavior_calc;
alter function public.analytics_vitals(integer)   rename to analytics_vitals_calc;
alter function public.analytics_funnel(integer)   rename to analytics_funnel_calc;
alter function public.analytics_direto(integer)   rename to analytics_direto_calc;

-- Devolve o guardado se existir e tiver menos de 12 h; senão, null.
-- 12 h e não 3 h: se uma rodada do cron falhar, o painel mostra o dado da
-- rodada anterior em vez de cair no cálculo ao vivo que estoura.
create or replace function public.analytics_cache_get(p_fn text, p_dias int)
returns jsonb language sql stable security definer set search_path = public as $$
  select payload || jsonb_build_object('calculado_em', calculado_em)
  from public.analytics_report_cache
  where fn = p_fn and dias = p_dias and calculado_em > now() - interval '12 hours';
$$;

create or replace function public.analytics_traffic(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v jsonb;
  v_agora jsonb;
begin
  if v_days >= 60 then
    v := public.analytics_cache_get('analytics_traffic', v_days);
    if v is not null then
      -- "agora" é o tempo real: nunca sai do guardado.
      select coalesce(jsonb_agg(x order by x.minutos_atras desc), '[]'::jsonb) into v_agora from (
        select b * 5 as minutos_atras, count(pe.id) as views, count(distinct pe.session_id) as visitantes
        from generate_series(0, 5) b
        left join public.page_events pe on pe.event_type = 'pageview' and pe.is_bot = false
          and pe.created_at >= now() - make_interval(mins => (b + 1) * 5)
          and pe.created_at <  now() - make_interval(mins => b * 5)
        group by b) x;
      return jsonb_set(v, '{agora}', v_agora);
    end if;
  end if;
  return public.analytics_traffic_calc(v_days);
end $$;

create or replace function public.analytics_behavior(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_days int := greatest(1, least(coalesce(p_days, 30), 365)); v jsonb;
begin
  if v_days >= 60 then v := public.analytics_cache_get('analytics_behavior', v_days); end if;
  return coalesce(v, public.analytics_behavior_calc(v_days));
end $$;

create or replace function public.analytics_vitals(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_days int := greatest(1, least(coalesce(p_days, 30), 365)); v jsonb;
begin
  if v_days >= 60 then v := public.analytics_cache_get('analytics_vitals', v_days); end if;
  return coalesce(v, public.analytics_vitals_calc(v_days));
end $$;

create or replace function public.analytics_funnel(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_days int := greatest(1, least(coalesce(p_days, 30), 365)); v jsonb;
begin
  if v_days >= 60 then v := public.analytics_cache_get('analytics_funnel', v_days); end if;
  return coalesce(v, public.analytics_funnel_calc(v_days));
end $$;

create or replace function public.analytics_direto(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_days int := greatest(1, least(coalesce(p_days, 30), 365)); v jsonb;
begin
  if v_days >= 60 then v := public.analytics_cache_get('analytics_direto', v_days); end if;
  return coalesce(v, public.analytics_direto_calc(v_days));
end $$;

-- Recalcula as janelas guardadas. Uma função que falhe não derruba as outras.
create or replace function public.analytics_report_refresh()
returns void language plpgsql security definer set search_path = public as $$
declare f text; d int; v jsonb;
begin
  foreach d in array array[60, 90, 180] loop
    foreach f in array array['analytics_traffic','analytics_behavior','analytics_vitals',
                             'analytics_funnel','analytics_direto'] loop
      begin
        execute format('select public.%I(%s)', f || '_calc', d) into v;
        insert into public.analytics_report_cache (fn, dias, payload, calculado_em)
        values (f, d, v, now())
        on conflict (fn, dias) do update set payload = excluded.payload, calculado_em = excluded.calculado_em;
      exception when others then
        raise warning 'analytics_report_refresh %(%): %', f, d, sqlerrm;
      end;
    end loop;
  end loop;
end $$;

-- Permissões: as públicas como antes (só service_role); o resto, ninguém de fora.
revoke all on function public.analytics_traffic(integer), public.analytics_behavior(integer),
  public.analytics_vitals(integer), public.analytics_funnel(integer), public.analytics_direto(integer),
  public.analytics_traffic_calc(integer), public.analytics_behavior_calc(integer),
  public.analytics_vitals_calc(integer), public.analytics_funnel_calc(integer),
  public.analytics_direto_calc(integer), public.analytics_cache_get(text, int),
  public.analytics_report_refresh() from public, anon, authenticated;
grant execute on function public.analytics_traffic(integer), public.analytics_behavior(integer),
  public.analytics_vitals(integer), public.analytics_funnel(integer), public.analytics_direto(integer)
  to service_role;

-- Agenda: a cada 3 horas, aos 17 minutos. Sem limite de tempo dentro do job.
create extension if not exists pg_cron;
select cron.schedule('analytics_report_refresh', '17 */3 * * *',
  $cron$set statement_timeout = 0; select public.analytics_report_refresh();$cron$);
