-- Migration 020: ingestao de analytics em UMA chamada.
--
-- A rota /api/analytics/track roda em toda troca de rota de todo visitante. Se
-- ela fizer insert + select do visitante + upsert da sessao + upsert do
-- visitante, sao quatro idas ao banco por batida. Com o heartbeat de
-- engajamento batendo a cada 15s isso vira carga constante — e o incidente de
-- IO de 26/08 ja mostrou o que esse banco faz quando alguem o trata como
-- infinito.
--
-- Entao a rota manda um jsonb e o banco resolve tudo dentro de uma transacao:
-- classifica robo, classifica canal, grava o evento cru, e reconcilia sessao e
-- visitante. Uma ida. E a classificacao mora aqui, nao no TypeScript, porque
-- ela precisa valer igual pro job de reprocessamento historico.

-- ═══════════════════════════════════════════════════════════════════════════
-- analytics_bot_reason — devolve o motivo, ou NULL se parece gente
-- ═══════════════════════════════════════════════════════════════════════════
-- Devolve TEXTO e nao booleano de proposito: "is_bot = true" sem motivo e uma
-- decisao que ninguem consegue auditar seis semanas depois. Com o motivo
-- gravado da pra revisar a regra e reprocessar.
--
-- Robo NAO e apagado, e marcado. Toda leitura do painel filtra is_bot = false,
-- mas a linha continua no banco: no dia em que a regra estiver errada, o
-- conserto e um UPDATE, nao um backup perdido.

create or replace function public.analytics_bot_reason(ua text)
returns text
language sql
immutable
as $$
  select case
    when ua is null or ua = '' then 'ua-ausente'
    -- Agentes de IA vem PRIMEIRO: a clausula generica de 'bot' logo abaixo
    -- casaria com GPTBot e ClaudeBot e essa classe ficaria sempre vazia — que
    -- e justamente o numero que o /mcp existe pra mover. Nao sao fraude e o
    -- DogData quer ser lido por eles, mas nao sao audiencia humana.
    when ua ~* '(gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|google-extended|ccbot|bytespider|amazonbot|applebot-extended|cohere-ai|diffbot|imagesiftbot|meta-externalagent|youbot|duckassistbot|ai2bot|omgili|timpibot|webzio)' then 'agente-ia'
    -- automacao de navegador
    when ua ~* '(headless|phantomjs|puppeteer|playwright|selenium|webdriver|cypress)' then 'automacao'
    -- clientes de script
    when ua ~* '(python-requests|python-urllib|go-http-client|java/|okhttp|axios/|node-fetch|libwww|curl/|wget/|httpie|guzzle|scrapy)' then 'cliente-script'
    -- previewers de link: buscam a pagina pra montar o card, nunca sao visita
    when ua ~* '(facebookexternalhit|whatsapp|telegrambot|twitterbot|discordbot|slackbot|linkedinbot|redditbot|embedly|skypeuripreview|vkshare|pinterest|bitlybot|nuzzel|quora link preview)' then 'preview-de-link'
    -- ferramentas de medicao: sobem os numeros e sujam as Web Vitals
    when ua ~* '(lighthouse|gtmetrix|pingdom|pagespeed|uptimerobot|statuscake|datadog|newrelic|site24x7)' then 'monitoramento'
    -- SEO / raspagem comercial
    when ua ~* '(ahrefs|semrush|mj12|dotbot|petalbot|dataforseo|serpstat|screaming frog|sitebulb|blexbot|seokicks)' then 'seo-scraper'
    -- rede de seguranca: qualquer coisa que ainda se anuncie
    when ua ~* '(bot|crawler|spider|crawling|slurp|mediapartners)' then 'ua-declarado'
    else null
  end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- analytics_channel — de onde veio, em uma palavra
-- ═══════════════════════════════════════════════════════════════════════════
-- A ordem das clausulas E a regra: UTM ganha de referrer sempre, porque quando
-- os dois existem o UTM e a intencao declarada de quem montou o link e o
-- referrer e so por onde passou.
--
-- 'IA' e uma classe propria e nao um Referral qualquer. Pro DogData essa e uma
-- das perguntas do negocio — o site se vende como fonte pra agente de IA, e
-- juntar chat.openai.com com um blog aleatorio esconde exatamente o numero que
-- diria se essa aposta esta funcionando.

create or replace function public.analytics_channel(
  referrer text, utm_source text, utm_medium text, utm_campaign text
)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(utm_medium,'')) ~ '^(cpc|ppc|paid|paidsocial|paid_social|display|banner|retargeting)$'
      then 'Pago'
    when coalesce(utm_source, utm_campaign) is not null then 'Campanha'
    when referrer is null or referrer = '' then 'Direto'
    when referrer ~* '(google\.|bing\.|duckduckgo\.|yahoo\.|yandex\.|ecosia\.|brave\.com|startpage\.|qwant\.)'
      then 'Busca'
    when referrer ~* '(chat\.openai|chatgpt\.com|perplexity\.ai|claude\.ai|gemini\.google|copilot\.microsoft|you\.com|phind\.com|poe\.com)'
      then 'IA'
    when referrer ~* '(t\.co|twitter\.com|x\.com|facebook\.|instagram\.|reddit\.|linkedin\.|t\.me|telegram\.|discord\.|youtube\.|youtu\.be|tiktok\.|threads\.|bsky\.|mastodon|nostr)'
      then 'Social'
    else 'Referencia'
  end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- analytics_ingest — o evento, a sessao e o visitante numa transacao so
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.analytics_ingest(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type     text := p->>'event_type';
  v_sid      text := nullif(p->>'session_id', '');
  v_vid      text := nullif(p->>'visitor_id', '');
  v_ua       text := nullif(p->>'user_agent', '');
  v_ref      text := nullif(p->>'referrer', '');
  v_page     text := coalesce(nullif(p->>'page', ''), '/');
  v_utm_s    text := nullif(p->>'utm_source', '');
  v_utm_m    text := nullif(p->>'utm_medium', '');
  v_utm_c    text := nullif(p->>'utm_campaign', '');
  v_bot_why  text;
  v_is_bot   boolean;
  v_channel  text;
  v_dur      int  := greatest(0, least(coalesce((p->>'duration_ms')::int, 0), 1800000));
  v_scroll   int  := greatest(0, least(coalesce((p->>'scroll_pct')::int, 0), 100));
  v_is_new   boolean := false;
  v_new_sess boolean := false;
begin
  if v_type is null or v_type not in ('pageview','vital','engagement','event') then
    return jsonb_build_object('ok', false, 'error', 'event_type invalido');
  end if;

  -- Novidade de visitante e de sessao sao resolvidas ANTES de qualquer insert.
  -- Tentar deduzir depois, por RETURNING de um ON CONFLICT ou comparando
  -- first_seen_at com last_seen_at, e ambiguo: os dois carimbam o MESMO now()
  -- na linha recem-nascida, entao a comparacao responde "novo" pra sempre.
  if v_vid is not null then
    select not exists (select 1 from public.analytics_visitors where visitor_id = v_vid)
      into v_is_new;
  end if;
  if v_sid is not null then
    select not exists (select 1 from public.analytics_sessions where session_id = v_sid)
      into v_new_sess;
  end if;

  v_bot_why := public.analytics_bot_reason(v_ua);
  v_is_bot  := v_bot_why is not null;
  v_channel := public.analytics_channel(v_ref, v_utm_s, v_utm_m, v_utm_c);

  -- ── o evento cru ────────────────────────────────────────────────────────
  insert into public.page_events (
    event_type, page, referrer, country, city, region,
    device_type, browser, os, session_id, visitor_id,
    screen_w, screen_h, viewport_w, viewport_h, language, user_agent,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, channel,
    is_bot, bot_reason,
    vital_name, vital_value, vital_rating,
    duration_ms, scroll_pct, event_name, event_value, event_meta
  ) values (
    v_type, v_page, v_ref,
    nullif(p->>'country',''), nullif(p->>'city',''), nullif(p->>'region',''),
    nullif(p->>'device_type',''), nullif(p->>'browser',''), nullif(p->>'os',''),
    v_sid, v_vid,
    (p->>'screen_w')::int, (p->>'screen_h')::int,
    (p->>'viewport_w')::int, (p->>'viewport_h')::int,
    nullif(p->>'language',''), v_ua,
    v_utm_s, v_utm_m, v_utm_c, nullif(p->>'utm_term',''), nullif(p->>'utm_content',''), v_channel,
    v_is_bot, v_bot_why,
    nullif(p->>'vital_name',''), (p->>'vital_value')::real, nullif(p->>'vital_rating',''),
    nullif(v_dur, 0), nullif(v_scroll, 0),
    nullif(p->>'event_name',''), (p->>'event_value')::double precision, nullif(p->'event_meta', 'null'::jsonb)
  );

  -- Vital nao mexe em sessao nem visitante: ele dispara uma vez por sessao e
  -- contaria como atividade que o visitante nao teve.
  if v_type = 'vital' or v_vid is null then
    return jsonb_build_object('ok', true, 'bot', v_is_bot);
  end if;

  -- ── o visitante ─────────────────────────────────────────────────────────
  -- Primeiro toque so entra no INSERT. O DO UPDATE nao toca em nenhuma coluna
  -- first_*: e isso que faz "de onde veio quem doou" continuar respondendo a
  -- origem real seis meses depois, e nao a ultima aba que a pessoa abriu.
  insert into public.analytics_visitors as av (
    visitor_id, first_seen_at, last_seen_at, sessions, pageviews, engaged_ms,
    first_channel, first_referrer, first_page,
    first_utm_source, first_utm_medium, first_utm_campaign, first_country,
    last_channel, last_country, last_device, is_bot
  ) values (
    v_vid, now(), now(),
    case when v_new_sess then 1 else 0 end,
    case when v_type = 'pageview' then 1 else 0 end,
    case when v_type = 'engagement' then v_dur else 0 end,
    v_channel, v_ref, v_page, v_utm_s, v_utm_m, v_utm_c, nullif(p->>'country',''),
    v_channel, nullif(p->>'country',''), nullif(p->>'device_type',''), v_is_bot
  )
  on conflict (visitor_id) do update set
    last_seen_at = now(),
    -- Ultimo toque e o canal da ultima SESSAO, nao do ultimo evento. Sem a
    -- guarda de v_new_sess, o segundo pageview de qualquer visita (navegacao
    -- interna nao carrega referrer) reclassificava o visitante como 'Direto' e
    -- apagava a origem da visita que estava acontecendo naquele instante.
    last_channel = case when v_new_sess then v_channel else av.last_channel end,
    last_country = coalesce(nullif(p->>'country',''), av.last_country),
    last_device  = coalesce(nullif(p->>'device_type',''), av.last_device),
    sessions     = av.sessions   + (case when v_new_sess then 1 else 0 end),
    pageviews    = av.pageviews  + (case when v_type = 'pageview' then 1 else 0 end),
    engaged_ms   = av.engaged_ms + (case when v_type = 'engagement' then v_dur else 0 end);

  if v_sid is null then
    return jsonb_build_object('ok', true, 'bot', v_is_bot, 'new_visitor', v_is_new);
  end if;

  -- ── a sessao ────────────────────────────────────────────────────────────
  -- entry_page grava uma vez e nunca mais (coalesce guarda o valor antigo);
  -- exit_page anda a cada pageview, e o ultimo que sobrar e a saida de fato.
  insert into public.analytics_sessions as s (
    session_id, visitor_id, started_at, last_seen_at,
    pageviews, events, engaged_ms, max_scroll_pct,
    entry_page, exit_page,
    country, city, region, device_type, browser, os,
    referrer, channel, utm_source, utm_medium, utm_campaign,
    is_new_visitor, is_bot, bot_reason
  ) values (
    v_sid, v_vid, now(), now(),
    case when v_type = 'pageview' then 1 else 0 end,
    case when v_type = 'event' then 1 else 0 end,
    case when v_type = 'engagement' then v_dur else 0 end,
    v_scroll,
    v_page, v_page,
    nullif(p->>'country',''), nullif(p->>'city',''), nullif(p->>'region',''),
    nullif(p->>'device_type',''), nullif(p->>'browser',''), nullif(p->>'os',''),
    v_ref, v_channel, v_utm_s, v_utm_m, v_utm_c,
    v_is_new, v_is_bot, v_bot_why
  )
  on conflict (session_id) do update set
    last_seen_at   = now(),
    pageviews      = s.pageviews  + (case when v_type = 'pageview' then 1 else 0 end),
    events         = s.events     + (case when v_type = 'event' then 1 else 0 end),
    engaged_ms     = s.engaged_ms + (case when v_type = 'engagement' then v_dur else 0 end),
    max_scroll_pct = greatest(s.max_scroll_pct, v_scroll),
    exit_page      = case when v_type = 'pageview' then v_page else s.exit_page end,
    country        = coalesce(s.country, nullif(p->>'country','')),
    city           = coalesce(s.city,    nullif(p->>'city','')),
    region         = coalesce(s.region,  nullif(p->>'region','')),
    os             = coalesce(s.os,      nullif(p->>'os',''));

  return jsonb_build_object('ok', true, 'bot', v_is_bot, 'new_visitor', v_is_new);
end;
$$;

revoke all on function public.analytics_ingest(jsonb) from public, anon, authenticated;

comment on function public.analytics_ingest is
  'Ingestao de um evento de analytics em uma transacao: grava o evento cru e reconcilia analytics_sessions e analytics_visitors. Classifica robo e canal no banco para que o reprocessamento historico use a MESMA regra da ingestao ao vivo.';
