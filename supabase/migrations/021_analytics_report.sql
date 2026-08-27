-- Migration 021: os relatorios, agregados no banco.
--
-- ⚠️ analytics_traffic FOI SUBSTITUIDA pela migracao 024 (cobertura de
-- identidade: dia sem visitor_id devolve NULL em vez de 0, e o resumo ganhou
-- sessoes_identificadas). Rodar esta 021 depois da 024 desfaz a correcao.
-- analytics_behavior aqui continua valendo.
--
-- A rota /api/analytics/report puxava TODAS as linhas da janela pra memoria do
-- Node, de mil em mil, e somava em JavaScript. Em 30 dias ja eram ~25 mil
-- linhas por request, o painel refazia isso a cada 60s, e o custo crescia
-- junto com o trafego — ou seja, exatamente quando o painel fica importante.
-- O incidente de IO de 26/08 mostrou o que esse banco faz quando alguem trata
-- leitura como gratis.
--
-- Aqui as somas acontecem onde os dados moram, e o Node recebe jsonb pronto.
--
-- ── uma definicao que vale pro arquivo inteiro ────────────────────────────
-- SESSAO ENGAJADA: >= 2 pageviews, OU >= 10s de atencao, OU pelo menos um
-- evento nomeado. E a definicao do GA4 e ela existe pra separar "abriu e
-- fechou" de "abriu, leu, saiu". Rejeicao (bounce) e o complemento.
--
-- Sessao reconstruida do historico tem engaged_ms NULL. Ela ainda decide
-- engajamento por contagem de paginas, mas NAO entra em nenhuma media de
-- duracao: toda media de permanencia filtra engaged_ms IS NOT NULL, e o painel
-- recebe `sessoes_medidas` junto pra poder dizer sobre quantas sessoes aquela
-- media foi tirada. Somar zero de quem nunca foi medido seria a mesma classe
-- de erro que a media de 9.132s que este trabalho veio consertar.

-- ═══════════════════════════════════════════════════════════════════════════
-- analytics_traffic — audiencia, aquisicao e o comparativo com o periodo antes
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.analytics_traffic(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_days    int := greatest(1, least(coalesce(p_days, 30), 365));
  v_ini     timestamptz := now() - make_interval(days => v_days);
  v_ini_ant timestamptz := now() - make_interval(days => v_days * 2);
  v_resumo  jsonb; v_anterior jsonb; v_dia jsonb; v_pais jsonb; v_cidade jsonb;
  v_canal   jsonb; v_ref jsonb; v_camp jsonb; v_pag jsonb; v_disp jsonb;
  v_nav     jsonb; v_so jsonb; v_idioma jsonb; v_tela jsonb; v_agora jsonb;
  v_robo    jsonb;
begin
  -- ── resumo do periodo ───────────────────────────────────────────────────
  select jsonb_build_object(
    'visitantes',      count(distinct s.visitor_id),
    'sessoes',         count(*),
    'pageviews',       coalesce(sum(s.pageviews), 0),
    'paginas_sessao',  round((coalesce(sum(s.pageviews),0)::numeric / nullif(count(*),0)), 2),
    'sessoes_engajadas', count(*) filter (where s.pageviews >= 2 or coalesce(s.engaged_ms,0) >= 10000 or s.events >= 1),
    'taxa_rejeicao',   round(100.0 * count(*) filter (where not (s.pageviews >= 2 or coalesce(s.engaged_ms,0) >= 10000 or s.events >= 1))
                             / nullif(count(*),0), 1),
    -- medias de duracao SO sobre o que foi de fato medido
    'sessoes_medidas', count(*) filter (where s.engaged_ms is not null),
    'duracao_media_s', round((avg(s.engaged_ms) filter (where s.engaged_ms is not null))::numeric / 1000.0, 1),
    'duracao_mediana_s', round((percentile_cont(0.5) within group (order by s.engaged_ms)
                                filter (where s.engaged_ms is not null))::numeric / 1000.0, 1),
    'rolagem_media',   round(avg(s.max_scroll_pct) filter (where s.max_scroll_pct is not null), 0),
    'novos',           count(*) filter (where s.is_new_visitor),
    'recorrentes',     count(*) filter (where s.is_new_visitor = false)
  ) into v_resumo
  from public.analytics_sessions s
  where s.started_at >= v_ini and s.is_bot = false;

  -- ── o mesmo, na janela imediatamente anterior ───────────────────────────
  -- Numero sem comparacao nao sustenta decisao: "1.200 sessoes" nao diz se o
  -- que foi feito no periodo funcionou. Aqui vai a janela anterior de MESMO
  -- tamanho, colada, pro painel poder mostrar a variacao.
  select jsonb_build_object(
    'visitantes', count(distinct s.visitor_id),
    'sessoes',    count(*),
    'pageviews',  coalesce(sum(s.pageviews), 0),
    'taxa_rejeicao', round(100.0 * count(*) filter (where not (s.pageviews >= 2 or coalesce(s.engaged_ms,0) >= 10000 or s.events >= 1))
                             / nullif(count(*),0), 1),
    'duracao_media_s', round((avg(s.engaged_ms) filter (where s.engaged_ms is not null))::numeric / 1000.0, 1)
  ) into v_anterior
  from public.analytics_sessions s
  where s.started_at >= v_ini_ant and s.started_at < v_ini and s.is_bot = false;

  -- ── serie diaria ────────────────────────────────────────────────────────
  -- generate_series a esquerda de proposito: dia sem visita precisa aparecer
  -- como zero e nao sumir. Serie que pula dia vazio desenha uma linha continua
  -- por cima de um buraco e mente sobre a forma da curva.
  select coalesce(jsonb_agg(x order by x.dia), '[]'::jsonb) into v_dia from (
    select
      d::date as dia,
      count(s.session_id)                    as sessoes,
      count(distinct s.visitor_id)           as visitantes,
      coalesce(sum(s.pageviews), 0)          as pageviews,
      round((avg(s.engaged_ms) filter (where s.engaged_ms is not null))::numeric / 1000.0, 1) as duracao_s,
      round(100.0 * count(*) filter (where s.session_id is not null and not (s.pageviews >= 2 or coalesce(s.engaged_ms,0) >= 10000 or s.events >= 1))
              / nullif(count(s.session_id), 0), 1) as rejeicao
    -- generate_series com passo de INTERVALO devolve timestamp, nao date, entao
    -- a borda do dia precisa ser `d + interval '1 day'`: `d + 1` nao tem operador.
    from generate_series(v_ini::date, now()::date, '1 day') d
    left join public.analytics_sessions s
      on s.started_at >= d and s.started_at < d + interval '1 day' and s.is_bot = false
    group by d
  ) x;

  -- ── geografia ───────────────────────────────────────────────────────────
  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_pais from (
    select coalesce(country,'??') as pais, count(*) as sessoes,
           count(distinct visitor_id) as visitantes,
           coalesce(sum(pageviews),0) as pageviews,
           round((avg(engaged_ms) filter (where engaged_ms is not null))::numeric/1000.0, 1) as duracao_s
    from public.analytics_sessions
    where started_at >= v_ini and is_bot = false
    group by 1 order by 2 desc limit 40
  ) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_cidade from (
    select city as cidade, coalesce(country,'??') as pais, count(*) as sessoes
    from public.analytics_sessions
    where started_at >= v_ini and is_bot = false and city is not null
    group by 1,2 order by 3 desc limit 20
  ) x;

  -- ── aquisicao ───────────────────────────────────────────────────────────
  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_canal from (
    select coalesce(channel,'Direto') as canal, count(*) as sessoes,
           count(distinct visitor_id) as visitantes,
           round(100.0 * count(*) filter (where pageviews >= 2 or coalesce(engaged_ms,0) >= 10000 or events >= 1)
                   / nullif(count(*),0), 1) as engajamento,
           round((avg(engaged_ms) filter (where engaged_ms is not null))::numeric/1000.0, 1) as duracao_s
    from public.analytics_sessions
    where started_at >= v_ini and is_bot = false
    group by 1 order by 2 desc
  ) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_ref from (
    select coalesce(nullif(referrer,''),'(direto)') as origem, count(*) as sessoes,
           round(100.0 * count(*) filter (where pageviews >= 2 or coalesce(engaged_ms,0) >= 10000 or events >= 1)
                   / nullif(count(*),0), 1) as engajamento
    from public.analytics_sessions
    where started_at >= v_ini and is_bot = false
    group by 1 order by 2 desc limit 15
  ) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_camp from (
    select utm_campaign as campanha, utm_source as origem, utm_medium as meio,
           count(*) as sessoes, count(distinct visitor_id) as visitantes
    from public.analytics_sessions
    where started_at >= v_ini and is_bot = false and utm_campaign is not null
    group by 1,2,3 order by 4 desc limit 20
  ) x;

  -- ── paginas ─────────────────────────────────────────────────────────────
  select coalesce(jsonb_agg(x order by x.views desc), '[]'::jsonb) into v_pag from (
    select page as pagina, count(*) as views, count(distinct visitor_id) as visitantes
    from public.page_events
    where created_at >= v_ini and event_type = 'pageview' and is_bot = false
    group by 1 order by 2 desc limit 20
  ) x;

  -- ── tecnologia ──────────────────────────────────────────────────────────
  select coalesce(jsonb_object_agg(coalesce(device_type,'desconhecido'), n), '{}'::jsonb) into v_disp
  from (select device_type, count(*) n from public.analytics_sessions
        where started_at >= v_ini and is_bot = false group by 1) t;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_nav from (
    select coalesce(browser,'desconhecido') as navegador, count(*) as sessoes
    from public.analytics_sessions where started_at >= v_ini and is_bot = false
    group by 1 order by 2 desc limit 10
  ) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_so from (
    select coalesce(os,'desconhecido') as so, count(*) as sessoes
    from public.analytics_sessions where started_at >= v_ini and is_bot = false and os is not null
    group by 1 order by 2 desc limit 10
  ) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_idioma from (
    -- Só o prefixo: pt-BR e pt-PT sao o mesmo publico pra decisao de idioma
    -- do site, e separa-los picota a contagem sem informar nada.
    select split_part(language, '-', 1) as idioma, count(distinct session_id) as sessoes
    from public.page_events
    where created_at >= v_ini and is_bot = false and language is not null
    group by 1 order by 2 desc limit 12
  ) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_tela from (
    select
      case
        when viewport_w < 480  then '< 480'
        when viewport_w < 768  then '480–767'
        when viewport_w < 1024 then '768–1023'
        when viewport_w < 1440 then '1024–1439'
        when viewport_w < 1920 then '1440–1919'
        else '1920+'
      end as faixa,
      count(distinct session_id) as sessoes
    from public.page_events
    where created_at >= v_ini and is_bot = false and viewport_w is not null and viewport_w > 0
    group by 1 order by 2 desc
  ) x;

  -- ── tempo real: 30 min em blocos de 5 ───────────────────────────────────
  select coalesce(jsonb_agg(x order by x.minutos_atras desc), '[]'::jsonb) into v_agora from (
    select b * 5 as minutos_atras,
           count(pe.id) as views,
           count(distinct pe.visitor_id) as visitantes
    from generate_series(0, 5) b
    left join public.page_events pe
      on pe.event_type = 'pageview' and pe.is_bot = false
     and pe.created_at >= now() - make_interval(mins => (b + 1) * 5)
     and pe.created_at <  now() - make_interval(mins => b * 5)
    group by b
  ) x;

  -- ── o que foi barrado ───────────────────────────────────────────────────
  -- Robo aparece no painel em vez de sumir dele. O numero que interessa nao e
  -- so o trafego limpo: e QUANTO foi descartado e por que — foi assim que a
  -- Austria com 813 sessoes de uma pagina virou visivel.
  select jsonb_build_object(
    'sessoes_robo', count(*),
    'por_motivo', coalesce((
      select jsonb_object_agg(bot_reason, n) from (
        select bot_reason, count(*) n from public.analytics_sessions
        where started_at >= v_ini and is_bot and bot_reason is not null
        group by 1) t), '{}'::jsonb)
  ) into v_robo
  from public.analytics_sessions where started_at >= v_ini and is_bot;

  return jsonb_build_object(
    'periodo', jsonb_build_object('dias', v_days, 'de', v_ini, 'ate', now()),
    'resumo', v_resumo,
    'anterior', v_anterior,
    'por_dia', v_dia,
    'paises', v_pais,
    'cidades', v_cidade,
    'canais', v_canal,
    'origens', v_ref,
    'campanhas', v_camp,
    'paginas', v_pag,
    'dispositivos', v_disp,
    'navegadores', v_nav,
    'sistemas', v_so,
    'idiomas', v_idioma,
    'telas', v_tela,
    'agora', v_agora,
    'robos', v_robo
  );
end;
$fn$;

-- ═══════════════════════════════════════════════════════════════════════════
-- analytics_behavior — o que cada pagina faz com quem chega nela
-- ═══════════════════════════════════════════════════════════════════════════
-- Este e o relatorio que nao existia de forma nenhuma antes: "top paginas por
-- views" diz o que foi aberto, nunca o que funcionou. Uma pagina com 4.000
-- views, 8 segundos de permanencia e 90% de saida e um problema, e no painel
-- antigo ela aparecia como sucesso, no topo da lista.

create or replace function public.analytics_behavior(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v_ini timestamptz := now() - make_interval(days => v_days);
  v_paginas jsonb; v_entrada jsonb; v_saida jsonb; v_eventos jsonb; v_caminho jsonb;
begin
  -- Por pagina: views, gente, permanencia MEDIANA, rolagem e saidas.
  -- Mediana e nao media de proposito: permanencia tem cauda longa (a aba
  -- esquecida aberta, a leitura de uma hora) e a media segue a cauda. A
  -- mediana responde "o que acontece com uma visita tipica".
  select coalesce(jsonb_agg(x order by x.views desc), '[]'::jsonb) into v_paginas from (
    with vistas as (
      select page, count(*) views, count(distinct visitor_id) visitantes,
             count(distinct session_id) sessoes
      from public.page_events
      where created_at >= v_ini and event_type = 'pageview' and is_bot = false
      group by 1
    ),
    tempo as (
      select page,
             percentile_cont(0.5) within group (order by duration_ms) mediana_ms,
             avg(duration_ms) media_ms,
             avg(scroll_pct) rolagem,
             count(*) amostras
      from public.page_events
      where created_at >= v_ini and event_type = 'engagement' and is_bot = false
        and duration_ms is not null
      group by 1
    ),
    saidas as (
      select exit_page page, count(*) n from public.analytics_sessions
      where started_at >= v_ini and is_bot = false and exit_page is not null
      group by 1
    )
    select v.page as pagina, v.views, v.visitantes, v.sessoes,
           round(coalesce(t.mediana_ms,0)::numeric / 1000.0, 1) as tempo_mediano_s,
           round(coalesce(t.media_ms,0)::numeric / 1000.0, 1)   as tempo_medio_s,
           round(coalesce(t.rolagem,0), 0)             as rolagem_media,
           coalesce(t.amostras, 0)                     as amostras_tempo,
           coalesce(sa.n, 0)                           as saidas,
           round(100.0 * coalesce(sa.n,0) / nullif(v.sessoes,0), 1) as taxa_saida
    from vistas v
    left join tempo t on t.page = v.page
    left join saidas sa on sa.page = v.page
    order by v.views desc limit 25
  ) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_entrada from (
    select entry_page as pagina, count(*) as sessoes,
           round(100.0 * count(*) filter (where not (pageviews >= 2 or coalesce(engaged_ms,0) >= 10000 or events >= 1))
                   / nullif(count(*),0), 1) as rejeicao
    from public.analytics_sessions
    where started_at >= v_ini and is_bot = false and entry_page is not null
    group by 1 order by 2 desc limit 15
  ) x;

  select coalesce(jsonb_agg(x order by x.sessoes desc), '[]'::jsonb) into v_saida from (
    select exit_page as pagina, count(*) as sessoes
    from public.analytics_sessions
    where started_at >= v_ini and is_bot = false and exit_page is not null
    group by 1 order by 2 desc limit 15
  ) x;

  select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) into v_eventos from (
    select event_name as evento, count(*) as total,
           count(distinct visitor_id) as visitantes,
           count(distinct session_id) as sessoes
    from public.page_events
    where created_at >= v_ini and event_type = 'event' and is_bot = false and event_name is not null
    group by 1 order by 2 desc limit 25
  ) x;

  -- Pares de navegacao: de qual pagina pra qual, dentro da mesma sessao.
  -- lag() sobre a sessao ordenada — e o esqueleto de um fluxo de usuario.
  select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) into v_caminho from (
    select de, para, count(*) n from (
      select session_id,
             lag(page) over (partition by session_id order by created_at) as de,
             page as para
      from public.page_events
      where created_at >= v_ini and event_type = 'pageview' and is_bot = false
        and session_id is not null
    ) t
    where de is not null and de <> para
    group by 1,2 order by 3 desc limit 30
  ) x;

  return jsonb_build_object(
    'periodo', jsonb_build_object('dias', v_days, 'de', v_ini, 'ate', now()),
    'paginas', v_paginas,
    'entradas', v_entrada,
    'saidas', v_saida,
    'eventos', v_eventos,
    'caminhos', v_caminho
  );
end;
$fn$;

revoke all on function public.analytics_traffic(int)  from public, anon, authenticated;
revoke all on function public.analytics_behavior(int) from public, anon, authenticated;

comment on function public.analytics_traffic is
  'Audiencia, aquisicao, geografia e tecnologia da janela, com a janela anterior de mesmo tamanho para comparacao. Toda media de duracao filtra engaged_ms IS NOT NULL e devolve sessoes_medidas junto.';
comment on function public.analytics_behavior is
  'Por pagina: permanencia mediana, rolagem, entradas, saidas e taxa de saida. Mais eventos nomeados e pares de navegacao.';
