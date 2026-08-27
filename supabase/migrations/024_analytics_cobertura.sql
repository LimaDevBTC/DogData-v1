-- Migration 024: identidade AUSENTE deixa de se passar por identidade ZERO.
--
-- Sintoma (fundador, 27/08): "parece que os dados foram todos excluidos, temos
-- 32 visitas so". Nada foi excluido — 43.297 eventos e 6.560 sessoes desde
-- 04/07 continuavam intactos. O que aconteceu e que o numero de destaque do
-- painel virou VISITANTES, e visitor_id so existe desde 27/08. Das 55 semanas
-- de historico, 54 respondiam 0, e 0 em cima de um grafico le como "ninguem
-- veio" — exatamente a mesma classe de erro que a media de 9.132s de duracao
-- que este trabalho comecou consertando.
--
-- A regra e a mesma que ja valia pra engaged_ms, agora estendida a identidade:
-- NAO MEDIDO DEVOLVE NULL, NUNCA 0. Vale por dia, por pais e por canal.
--
-- E o resumo passa a carregar `sessoes_identificadas`, pra interface poder
-- decidir sozinha se ja tem base pra liderar com visitante ou se ainda deve
-- liderar com sessao (contínua desde 04/07). Assim o painel se conserta sozinho
-- conforme a janela anda, sem ninguem tocar em codigo.
--
-- ⚠️ Este arquivo e a versao completa de analytics_traffic e SUBSTITUI a da
-- migracao 021. Rodar 021 depois desta desfaz a correcao.

create or replace function public.analytics_traffic(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_days    int := greatest(1, least(coalesce(p_days, 30), 365));
  v_ini     timestamptz := now() - make_interval(days => v_days);
  v_ini_ant timestamptz := now() - make_interval(days => v_days * 2);
  v_resumo  jsonb; v_anterior jsonb; v_dia jsonb; v_pais jsonb; v_cidade jsonb;
  v_canal   jsonb; v_ref jsonb; v_camp jsonb; v_pag jsonb; v_disp jsonb;
  v_nav     jsonb; v_so jsonb; v_idioma jsonb; v_tela jsonb; v_agora jsonb;
  v_robo    jsonb;
begin
  select jsonb_build_object(
    'visitantes', count(distinct s.visitor_id), 'sessoes', count(*),
    'pageviews', coalesce(sum(s.pageviews), 0),
    -- quantas sessoes da janela chegaram a ter identidade. E a base sobre a
    -- qual 'visitantes', 'novos' e 'recorrentes' foram calculados, e e o que
    -- deixa a interface decidir sozinha se ja pode liderar com visitante.
    'sessoes_identificadas', count(*) filter (where s.visitor_id is not null),
    'paginas_sessao', round((coalesce(sum(s.pageviews),0)::numeric / nullif(count(*),0)), 2),
    'sessoes_engajadas', count(*) filter (where s.pageviews >= 2 or coalesce(s.engaged_ms,0) >= 10000 or s.events >= 1),
    'taxa_rejeicao', round(100.0 * count(*) filter (where not (s.pageviews >= 2 or coalesce(s.engaged_ms,0) >= 10000 or s.events >= 1)) / nullif(count(*),0), 1),
    'sessoes_medidas', count(*) filter (where s.engaged_ms is not null),
    'duracao_media_s', round((avg(s.engaged_ms) filter (where s.engaged_ms is not null))::numeric / 1000.0, 1),
    'duracao_mediana_s', round((percentile_cont(0.5) within group (order by s.engaged_ms) filter (where s.engaged_ms is not null))::numeric / 1000.0, 1),
    'rolagem_media', round(avg(s.max_scroll_pct) filter (where s.max_scroll_pct is not null), 0),
    'novos', count(*) filter (where s.is_new_visitor),
    'recorrentes', count(*) filter (where s.is_new_visitor = false)
  ) into v_resumo from public.analytics_sessions s
  where s.started_at >= v_ini and s.is_bot = false;

  select jsonb_build_object(
    'visitantes', count(distinct s.visitor_id), 'sessoes', count(*),
    'pageviews', coalesce(sum(s.pageviews), 0),
    'sessoes_identificadas', count(*) filter (where s.visitor_id is not null),
    'taxa_rejeicao', round(100.0 * count(*) filter (where not (s.pageviews >= 2 or coalesce(s.engaged_ms,0) >= 10000 or s.events >= 1)) / nullif(count(*),0), 1),
    'duracao_media_s', round((avg(s.engaged_ms) filter (where s.engaged_ms is not null))::numeric / 1000.0, 1)
  ) into v_anterior from public.analytics_sessions s
  where s.started_at >= v_ini_ant and s.started_at < v_ini and s.is_bot = false;

  -- Dia sem NENHUMA sessao identificada devolve NULL em visitantes, nao 0. Com
  -- connectNulls={false} no grafico, a linha de visitantes simplesmente nao
  -- existe onde nao houve medicao, em vez de rastejar no eixo zero por baixo de
  -- uma curva de sessoes saudavel.
  select coalesce(jsonb_agg(x order by x.dia), '[]'::jsonb) into v_dia from (
    select d::date as dia, count(s.session_id) as sessoes,
      case when count(s.visitor_id) = 0 then null else count(distinct s.visitor_id) end as visitantes,
      coalesce(sum(s.pageviews), 0) as pageviews,
      round((avg(s.engaged_ms) filter (where s.engaged_ms is not null))::numeric / 1000.0, 1) as duracao_s,
      round(100.0 * count(*) filter (where s.session_id is not null and not (s.pageviews >= 2 or coalesce(s.engaged_ms,0) >= 10000 or s.events >= 1)) / nullif(count(s.session_id), 0), 1) as rejeicao
    from generate_series(v_ini::date, now()::date, '1 day') d
    left join public.analytics_sessions s
      on s.started_at >= d and s.started_at < d + interval '1 day' and s.is_bot = false
    group by d
  ) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_pais from (
    select coalesce(country,'??') as pais, count(*) as sessoes,
      case when count(visitor_id) = 0 then null else count(distinct visitor_id) end as visitantes,
      coalesce(sum(pageviews),0) as pageviews,
      round((avg(engaged_ms) filter (where engaged_ms is not null))::numeric/1000.0, 1) as duracao_s
    from public.analytics_sessions where started_at >= v_ini and is_bot = false
    group by 1 order by 2 desc limit 40) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_cidade from (
    select city as cidade, coalesce(country,'??') as pais, count(*) as sessoes
    from public.analytics_sessions where started_at >= v_ini and is_bot = false and city is not null
    group by 1,2 order by 3 desc limit 20) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_canal from (
    select coalesce(channel,'Direto') as canal, count(*) as sessoes,
      case when count(visitor_id) = 0 then null else count(distinct visitor_id) end as visitantes,
      round(100.0 * count(*) filter (where pageviews >= 2 or coalesce(engaged_ms,0) >= 10000 or events >= 1) / nullif(count(*),0), 1) as engajamento,
      round((avg(engaged_ms) filter (where engaged_ms is not null))::numeric/1000.0, 1) as duracao_s
    from public.analytics_sessions where started_at >= v_ini and is_bot = false
    group by 1 order by 2 desc) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_ref from (
    select coalesce(nullif(referrer,''),'(direto)') as origem, count(*) as sessoes,
      round(100.0 * count(*) filter (where pageviews >= 2 or coalesce(engaged_ms,0) >= 10000 or events >= 1) / nullif(count(*),0), 1) as engajamento
    from public.analytics_sessions where started_at >= v_ini and is_bot = false
    group by 1 order by 2 desc limit 15) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_camp from (
    select utm_campaign as campanha, utm_source as origem, utm_medium as meio,
      count(*) as sessoes, count(distinct visitor_id) as visitantes
    from public.analytics_sessions where started_at >= v_ini and is_bot = false and utm_campaign is not null
    group by 1,2,3 order by 4 desc limit 20) x;

  -- Paginas contam SESSOES distintas, nao visitantes: e a unidade que existe
  -- pro historico inteiro e a que responde "quanto essa pagina foi aberta".
  select coalesce(jsonb_agg(x order by x.views desc), '[]'::jsonb) into v_pag from (
    select page as pagina, count(*) as views, count(distinct session_id) as visitantes
    from public.page_events where created_at >= v_ini and event_type = 'pageview' and is_bot = false
    group by 1 order by 2 desc limit 20) x;

  select coalesce(jsonb_object_agg(coalesce(device_type,'desconhecido'), n), '{}'::jsonb) into v_disp
  from (select device_type, count(*) n from public.analytics_sessions
        where started_at >= v_ini and is_bot = false group by 1) t;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_nav from (
    select coalesce(browser,'desconhecido') as navegador, count(*) as sessoes
    from public.analytics_sessions where started_at >= v_ini and is_bot = false
    group by 1 order by 2 desc limit 10) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_so from (
    select coalesce(os,'desconhecido') as so, count(*) as sessoes
    from public.analytics_sessions where started_at >= v_ini and is_bot = false and os is not null
    group by 1 order by 2 desc limit 10) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_idioma from (
    select split_part(language, '-', 1) as idioma, count(distinct session_id) as sessoes
    from public.page_events where created_at >= v_ini and is_bot = false and language is not null
    group by 1 order by 2 desc limit 12) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_tela from (
    select case when viewport_w < 480 then '< 480' when viewport_w < 768 then '480-767'
                when viewport_w < 1024 then '768-1023' when viewport_w < 1440 then '1024-1439'
                when viewport_w < 1920 then '1440-1919' else '1920+' end as faixa,
      count(distinct session_id) as sessoes
    from public.page_events where created_at >= v_ini and is_bot = false and viewport_w is not null and viewport_w > 0
    group by 1 order by 2 desc) x;

  select coalesce(jsonb_agg(x order by x.minutos_atras desc), '[]'::jsonb) into v_agora from (
    select b * 5 as minutos_atras, count(pe.id) as views, count(distinct pe.session_id) as visitantes
    from generate_series(0, 5) b
    left join public.page_events pe on pe.event_type = 'pageview' and pe.is_bot = false
      and pe.created_at >= now() - make_interval(mins => (b + 1) * 5)
      and pe.created_at <  now() - make_interval(mins => b * 5)
    group by b) x;

  select jsonb_build_object('sessoes_robo', count(*),
    'por_motivo', coalesce((select jsonb_object_agg(bot_reason, n) from (
        select bot_reason, count(*) n from public.analytics_sessions
        where started_at >= v_ini and is_bot and bot_reason is not null group by 1) t), '{}'::jsonb)
  ) into v_robo from public.analytics_sessions where started_at >= v_ini and is_bot;

  return jsonb_build_object(
    'periodo', jsonb_build_object('dias', v_days, 'de', v_ini, 'ate', now()),
    'resumo', v_resumo, 'anterior', v_anterior, 'por_dia', v_dia,
    'paises', v_pais, 'cidades', v_cidade, 'canais', v_canal, 'origens', v_ref,
    'campanhas', v_camp, 'paginas', v_pag, 'dispositivos', v_disp,
    'navegadores', v_nav, 'sistemas', v_so, 'idiomas', v_idioma, 'telas', v_tela,
    'agora', v_agora, 'robos', v_robo);
end;
$fn$;

revoke all on function public.analytics_traffic(int) from public, anon, authenticated;

comment on function public.analytics_traffic is
  'Audiencia, aquisicao, geografia e tecnologia da janela, com a janela anterior de mesmo tamanho para comparacao. NAO MEDIDO DEVOLVE NULL, NUNCA 0: vale para duracao (engaged_ms) e para identidade (visitor_id), por dia, por pais e por canal. sessoes_identificadas e sessoes_medidas acompanham cada media para a interface saber sobre que base ela foi tirada.';
