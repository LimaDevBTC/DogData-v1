-- Migration 030: rotulos que vao pra tela passam a ser em ingles.
--
-- Instrucao do fundador: "nada em portugues no site". O painel de analytics e
-- parte do site, entao vale pra ele tambem — inclusive para os rotulos que
-- NASCEM AQUI e viajam ate a tela sem passar por nenhuma traducao no front:
--
--   analytics_channel      Direto→Direct, Busca→Search, Campanha→Campaign,
--                          Pago→Paid, Referencia→Referral, IA→AI
--   analytics_bot_reason   ambiente-local→local-env, automacao→automation,
--                          ua-declarado→declared-bot, agente-ia→ai-agent,
--                          cliente-script→script-client, preview-de-link→
--                          link-preview, monitoramento→monitoring,
--                          ua-ausente→no-user-agent
--   analytics_funnel_etapas  as cinco etapas
--   analytics_funnel         '(nao atribuido)' → '(unattributed)'
--
-- Comentarios e nomes de funcao/coluna continuam em portugues de proposito:
-- nao sao interface, sao documentacao, e o repo inteiro fala assim.
--
-- ⚠️ Os valores JA GRAVADOS foram reclassificados junto (UPDATE nas colunas
-- channel e bot_reason de page_events, analytics_sessions e analytics_visitors).
-- Sem isso o painel misturaria 'Direto' e 'Direct' como dois canais distintos —
-- e foi o que aconteceu por alguns minutos com uma sessao que entrou entre a
-- troca da funcao e o UPDATE. Se rodar esta migracao num banco novo, os UPDATEs
-- sao inocuos.

create or replace function public.analytics_channel(
  referrer text, utm_source text, utm_medium text, utm_campaign text
)
returns text language sql immutable as $fn$
  select case
    when lower(coalesce(utm_medium,'')) ~ '^(cpc|ppc|paid|paidsocial|paid_social|display|banner|retargeting)$'
      then 'Paid'
    when coalesce(utm_source, utm_campaign) is not null then 'Campaign'
    when referrer is null or referrer = '' then 'Direct'
    when referrer ~* '(google\.|bing\.|duckduckgo\.|yahoo\.|yandex\.|ecosia\.|brave\.com|startpage\.|qwant\.)'
      then 'Search'
    when referrer ~* '(chat\.openai|chatgpt\.com|perplexity\.ai|claude\.ai|gemini\.google|copilot\.microsoft|you\.com|phind\.com|poe\.com)'
      then 'AI'
    when referrer ~* '(t\.co|twitter\.com|x\.com|facebook\.|instagram\.|reddit\.|linkedin\.|t\.me|telegram\.|discord\.|youtube\.|youtu\.be|tiktok\.|threads\.|bsky\.|mastodon|nostr)'
      then 'Social'
    else 'Referral'
  end;
$fn$;

create or replace function public.analytics_bot_reason(ua text)
returns text language sql immutable as $fn$
  select case
    when ua is null or ua = '' then 'no-user-agent'
    -- agente de IA ANTES da regra generica de bot, senao GPTBot e ClaudeBot
    -- caem em declared-bot e essa classe fica sempre vazia
    when ua ~* '(gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|google-extended|ccbot|bytespider|amazonbot|applebot-extended|cohere-ai|diffbot|imagesiftbot|meta-externalagent|youbot|duckassistbot|ai2bot|omgili|timpibot|webzio)' then 'ai-agent'
    when ua ~* '(headless|phantomjs|puppeteer|playwright|selenium|webdriver|cypress)' then 'automation'
    when ua ~* '(python-requests|python-urllib|go-http-client|java/|okhttp|axios/|node-fetch|libwww|curl/|wget/|httpie|guzzle|scrapy)' then 'script-client'
    when ua ~* '(facebookexternalhit|whatsapp|telegrambot|twitterbot|discordbot|slackbot|linkedinbot|redditbot|embedly|skypeuripreview|vkshare|pinterest|bitlybot|nuzzel|quora link preview)' then 'link-preview'
    when ua ~* '(lighthouse|gtmetrix|pingdom|pagespeed|uptimerobot|statuscake|datadog|newrelic|site24x7)' then 'monitoring'
    when ua ~* '(ahrefs|semrush|mj12|dotbot|petalbot|dataforseo|serpstat|screaming frog|sitebulb|blexbot|seokicks)' then 'seo-scraper'
    when ua ~* '(bot|crawler|spider|crawling|slurp|mediapartners)' then 'declared-bot'
    else null
  end;
$fn$;

-- reclassificacao do que ja estava gravado
update public.analytics_sessions set channel = case channel
  when 'Direto' then 'Direct' when 'Busca' then 'Search' when 'Campanha' then 'Campaign'
  when 'Pago' then 'Paid' when 'Referencia' then 'Referral' when 'IA' then 'AI' else channel end
where channel in ('Direto','Busca','Campanha','Pago','Referencia','IA');
update public.page_events set channel = case channel
  when 'Direto' then 'Direct' when 'Busca' then 'Search' when 'Campanha' then 'Campaign'
  when 'Pago' then 'Paid' when 'Referencia' then 'Referral' when 'IA' then 'AI' else channel end
where channel in ('Direto','Busca','Campanha','Pago','Referencia','IA');
update public.analytics_visitors set
  first_channel = case first_channel when 'Direto' then 'Direct' when 'Busca' then 'Search'
    when 'Campanha' then 'Campaign' when 'Pago' then 'Paid' when 'Referencia' then 'Referral'
    when 'IA' then 'AI' else first_channel end,
  last_channel = case last_channel when 'Direto' then 'Direct' when 'Busca' then 'Search'
    when 'Campanha' then 'Campaign' when 'Pago' then 'Paid' when 'Referencia' then 'Referral'
    when 'IA' then 'AI' else last_channel end;

update public.analytics_sessions set bot_reason = case bot_reason
  when 'ambiente-local' then 'local-env' when 'automacao' then 'automation'
  when 'ua-declarado' then 'declared-bot' when 'agente-ia' then 'ai-agent'
  when 'cliente-script' then 'script-client' when 'preview-de-link' then 'link-preview'
  when 'monitoramento' then 'monitoring' when 'ua-ausente' then 'no-user-agent' else bot_reason end
where bot_reason is not null;
update public.page_events set bot_reason = case bot_reason
  when 'ambiente-local' then 'local-env' when 'automacao' then 'automation'
  when 'ua-declarado' then 'declared-bot' when 'agente-ia' then 'ai-agent'
  when 'cliente-script' then 'script-client' when 'preview-de-link' then 'link-preview'
  when 'monitoramento' then 'monitoring' when 'ua-ausente' then 'no-user-agent' else bot_reason end
where bot_reason is not null;

-- as cinco etapas do funil e o rotulo de "sem atribuicao" tambem vao pra tela;
-- a forma vigente esta na migracao 022 com estes textos trocados por:
--   Sessions / Saw the offer / Copied the address / Connected a wallet /
--   Donated 10k+ DOG   e   (unattributed)
