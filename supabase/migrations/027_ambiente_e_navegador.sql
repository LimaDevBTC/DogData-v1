-- Migration 027+028: trafego de desenvolvimento sai da audiencia, e navegador
-- embutido de app deixa de ser "Other".
--
-- Os dois vieram do fundador perguntando "ainda temos trafego desconhecido nas
-- origens? ainda tem bandeira faltando". A resposta foi que NENHUMA bandeira
-- estava faltando — os 85 codigos de pais geram bandeira — e que o unico 🏴 era
-- o balde de pais NULO. Puxar esse fio achou duas coisas.
--
-- ── 1. AMBIENTE LOCAL CONTANDO COMO AUDIENCIA ─────────────────────────────
-- O balde de pais nulo tinha 849 sessoes em 30 dias (3o maior, acima da
-- Alemanha) e 824 contavam no painel. A prova de que nao era geo perdida:
--
--   · sessoes sem pais COM referrer externo: ZERO
--   · user-agents: HeadlessChrome/151, iPhone 14 Pro e Pixel 7 emulados
--
-- Era o servidor de desenvolvimento, que aponta pro MESMO Supabase da
-- producao: toda captura de tela e todo teste entrava na audiencia do site.
--
-- A REGRA: em requisicao servida pela Vercel o header x-vercel-ip-country
-- SEMPRE existe (confirmado: 100% do trafego com referrer externo tem pais).
-- Logo pais nulo => nao passou pela borda da Vercel => localhost ou preview.
-- Marca com bot_reason='ambiente-local'. Marcar, nunca apagar: a linha fica no
-- banco, sai das leituras (que filtram is_bot=false) e aparece no quadro
-- "Trafego descartado" com o motivo, pra decisao ser auditavel.
--
-- ── 2. O NAVEGADOR DO X ERA "OTHER" ───────────────────────────────────────
-- 384 sessoes (10% do trafego limpo) caiam em 'Other'. O UA delas:
--
--   Mozilla/5.0 (iPhone; ...) AppleWebKit/605.1.15 (KHTML, like Gecko)
--   Mobile/23G71 Twitter for iPhone/12.20
--
-- Sem o token `Safari/`, entao a deteccao caia no else. E como Social (t.co) e
-- ~20% do trafego, esse e provavelmente o maior segmento unico da audiencia:
-- gente lendo o site dentro do app do X. Chama-lo de "outro" escondia quem
-- mais chega. Webview de app nao tem extensao, tem storage restrito (o que
-- explica parte das sessoes sem visitor_id da 026) e o caminho ate a carteira
-- e outro — por isso a distincao e acionavel, nao cosmetica.
--
-- Reclassificacao medida: 622 eventos eram X (app), divididos entre 'Chrome' e
-- 'Other'; e 454 eventos eram Chrome no iOS rotulados Safari, porque o UA do
-- Chrome de iPhone e `CriOS/` e CARREGA `Safari/`.
--
-- A CLASSIFICACAO MUDOU DE LADO: o cliente ainda manda `browser`, mas com UA
-- presente quem decide e o servidor. O UA do servidor nao pode ser forjado por
-- JS e, principalmente, uma regra em SQL reclassifica o que ja esta gravado —
-- coisa que regra vivendo so no bundle nunca faz.
--
-- O que sobrou como 'Other' de antes de 27/08 virou NULL: sem UA gravado nao
-- da pra refazer a conta, e 'Other' afirmava "conferimos, e outro navegador",
-- afirmacao que agora sabemos ser falsa.

create or replace function public.analytics_navegador(ua text)
returns text language sql immutable as $fn$
  select case
    when ua is null or ua = '' then null
    -- ── embutidos em app, ANTES dos normais ──────────────────────────────
    -- A ordem e obrigatoria: varios destes carregam 'Chrome/' ou 'Safari/' no
    -- meio do UA e seriam classificados como o navegador hospedeiro, apagando
    -- a informacao que interessa (a pessoa esta dentro de um app).
    when ua ~* 'Twitter for iPhone|TwitterAndroid'      then 'X (app)'
    when ua ~* 'Instagram'                              then 'Instagram (app)'
    when ua ~* 'FBAN|FBAV|FB_IAB'                       then 'Facebook (app)'
    when ua ~* 'MicroMessenger'                         then 'WeChat (app)'
    when ua ~* 'Line/'                                  then 'LINE (app)'
    when ua ~* 'TikTok|BytedanceWebview|musical_ly'     then 'TikTok (app)'
    when ua ~* 'Snapchat'                               then 'Snapchat (app)'
    when ua ~* 'LinkedInApp'                            then 'LinkedIn (app)'
    when ua ~* 'Reddit'                                 then 'Reddit (app)'
    when ua ~* 'Discord'                                then 'Discord (app)'
    when ua ~* '\mGSA/'                                 then 'Google App'
    when ua ~* 'DuckDuckGo'                             then 'DuckDuckGo'
    -- ── navegadores ──────────────────────────────────────────────────────
    when ua ~* 'Edg/|EdgiOS|EdgA/'                      then 'Edge'
    when ua ~* 'OPR/|Opera|OPiOS'                       then 'Opera'
    when ua ~* 'SamsungBrowser'                         then 'Samsung Internet'
    when ua ~* 'Brave/'                                 then 'Brave'
    when ua ~* 'YaBrowser'                              then 'Yandex'
    -- CriOS antes de Safari: Chrome no iOS carrega `Safari/` no UA e sem esta
    -- linha todo Chrome de iPhone era contado como Safari (454 eventos).
    when ua ~* 'CriOS'                                  then 'Chrome'
    when ua ~* 'FxiOS|Firefox/'                         then 'Firefox'
    when ua ~* 'Chrome/'                                then 'Chrome'
    when ua ~* 'Safari/'                                then 'Safari'
    -- Webview crua: WebKit em movel sem token de navegador nenhum. Nao da pra
    -- dizer QUAL app, mas "webview" ja e muito mais util que "outro".
    when ua ~* 'AppleWebKit' and ua ~* 'Mobile/'        then 'WebView'
    when ua ~* '\mwv\M'                                 then 'WebView'
    else 'Outro'
  end;
$fn$;

comment on function public.analytics_navegador is
  'Navegador a partir do user-agent do SERVIDOR. Navegadores embutidos em app (X, Instagram, Facebook...) sao testados ANTES dos normais porque muitos carregam Chrome/ ou Safari/ no UA e seriam classificados como o hospedeiro.';

-- ── reclassificacao do que ja estava gravado ──────────────────────────────
update public.page_events set is_bot = true, bot_reason = 'ambiente-local'
where country is null and bot_reason is null;
update public.analytics_sessions set is_bot = true, bot_reason = 'ambiente-local'
where country is null and bot_reason is null;

update public.page_events set browser = public.analytics_navegador(user_agent)
where user_agent is not null
  and browser is distinct from public.analytics_navegador(user_agent);

with primeiro as (
  select distinct on (session_id) session_id, public.analytics_navegador(user_agent) nav
  from public.page_events
  where session_id is not null and user_agent is not null
  order by session_id, created_at
)
update public.analytics_sessions s set browser = p.nav
from primeiro p
where s.session_id = p.session_id and p.nav is not null and s.browser is distinct from p.nav;

-- 'Other' da era sem user-agent vira NULL: nao ha UA pra refazer a conta, e
-- 'Other' afirmava algo que sabemos ser falso.
update public.analytics_sessions set browser = null
where browser = 'Other'
  and session_id not in (select session_id from public.page_events
                         where session_id is not null and user_agent is not null);
update public.page_events set browser = null
where browser = 'Other' and user_agent is null;

-- ⚠️ analytics_ingest tambem mudou nesta rodada (ambiente-local + preferir
-- analytics_navegador quando ha UA). A versao vigente e a da migracao 026 com
-- essas duas adicoes; ver o historico de migracoes do Supabase.
