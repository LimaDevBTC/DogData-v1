-- Migration 023: Web Vitals agregadas no banco.
--
-- A logica e a mesma que estava em /api/analytics/report em TypeScript — p75,
-- nota estilo Lighthouse, corte por dia, por dispositivo e as paginas mais
-- lentas — so que sem trazer as 27 mil linhas de vital pra memoria do Node a
-- cada 60 segundos.
--
-- Os limites de bom/ruim sao os publicados pelo Chrome. CLS entra x1000 porque
-- e assim que o tracker grava (ver components/analytics-tracker.tsx): a metrica
-- e adimensional e mora entre 0 e ~1, e multiplicar mantem a coluna inteira
-- util pras cinco.
create or replace function public.analytics_vitals(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v_ini timestamptz := now() - make_interval(days => v_days);
  v_metricas jsonb; v_dia jsonb; v_disp jsonb; v_lentas jsonb; v_nota numeric;
begin
  with lim(nome, bom, ruim, peso) as (values
    ('LCP', 2500.0, 4000.0, 0.25), ('INP', 200.0, 500.0, 0.25),
    ('CLS', 100.0, 250.0, 0.25),  ('FCP', 1800.0, 3000.0, 0.15),
    ('TTFB', 800.0, 1800.0, 0.10)
  ),
  agg as (
    select v.vital_name nome,
      percentile_cont(0.75) within group (order by v.vital_value) p75,
      avg(v.vital_value) media, count(*) amostras,
      count(*) filter (where v.vital_rating = 'good') bons,
      count(*) filter (where v.vital_rating = 'needs-improvement') medios,
      count(*) filter (where v.vital_rating = 'poor') ruins
    from public.page_events v
    where v.created_at >= v_ini and v.event_type = 'vital'
      and v.vital_name is not null and v.vital_value is not null and v.is_bot = false
    group by 1
  ),
  notas as (
    select a.*, l.peso,
      -- Interpolacao linear entre o limite bom e o ruim, como o Lighthouse.
      greatest(0, least(100, round(
        case when a.p75 <= l.bom then 100
             when a.p75 >= l.ruim then 0
             else ((l.ruim - a.p75) / (l.ruim - l.bom)) * 100 end::numeric, 0))) nota
    from agg a join lim l on l.nome = a.nome
  )
  select
    coalesce(jsonb_object_agg(n.nome, jsonb_build_object(
      'p75', round(n.p75::numeric, 0), 'media', round(n.media::numeric, 0),
      'amostras', n.amostras, 'nota', n.nota,
      'pct_bom',   round(100.0 * n.bons   / nullif(n.amostras,0), 0),
      'pct_medio', round(100.0 * n.medios / nullif(n.amostras,0), 0),
      'pct_ruim',  round(100.0 * n.ruins  / nullif(n.amostras,0), 0),
      'estado', case when 100.0 * n.bons / nullif(n.amostras,0) >= 75 then 'bom'
                     when 100.0 * n.bons / nullif(n.amostras,0) >= 50 then 'medio'
                     else 'ruim' end
    )), '{}'::jsonb),
    round(sum(n.nota * n.peso) / nullif(sum(n.peso), 0), 0)
  into v_metricas, v_nota
  from notas n;

  select coalesce(jsonb_agg(x order by x.dia), '[]'::jsonb) into v_dia from (
    select created_at::date dia, vital_name nome,
           round(percentile_cont(0.75) within group (order by vital_value)::numeric, 0) p75
    from public.page_events
    where created_at >= v_ini and event_type = 'vital' and vital_name is not null
      and vital_value is not null and is_bot = false
    group by 1, 2) x;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_disp from (
    select coalesce(device_type,'desconhecido') dispositivo, vital_name nome,
           round(percentile_cont(0.75) within group (order by vital_value)::numeric, 0) p75,
           count(*) amostras
    from public.page_events
    where created_at >= v_ini and event_type = 'vital' and vital_name is not null
      and vital_value is not null and is_bot = false
    group by 1, 2) x;

  -- As paginas mais lentas por metrica: e o unico corte que aponta pra onde ir
  -- consertar. Piso de 5 amostras porque p75 de duas medicoes nao e percentil,
  -- e uma pagina com uma visita ruim lideraria a lista pra sempre.
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_lentas from (
    select nome, jsonb_agg(jsonb_build_object('pagina', pagina, 'p75', p75, 'amostras', amostras)
                           order by p75 desc) paginas
    from (
      select vital_name nome, page pagina,
             round(percentile_cont(0.75) within group (order by vital_value)::numeric, 0) p75,
             count(*) amostras,
             row_number() over (partition by vital_name
                                order by percentile_cont(0.75) within group (order by vital_value) desc) rn
      from public.page_events
      where created_at >= v_ini and event_type = 'vital' and vital_name is not null
        and vital_value is not null and is_bot = false
      group by 1, 2
      having count(*) >= 5
    ) t where rn <= 8
    group by nome) x;

  return jsonb_build_object(
    'periodo', jsonb_build_object('dias', v_days, 'de', v_ini, 'ate', now()),
    'metricas', v_metricas, 'nota_geral', v_nota,
    'por_dia', v_dia, 'por_dispositivo', v_disp, 'paginas_lentas', v_lentas);
end;
$fn$;

revoke all on function public.analytics_vitals(int) from public, anon, authenticated;

comment on function public.analytics_vitals is
  'Web Vitals: p75, nota ponderada estilo Lighthouse, serie por dia, corte por dispositivo e as paginas mais lentas por metrica (piso de 5 amostras).';
