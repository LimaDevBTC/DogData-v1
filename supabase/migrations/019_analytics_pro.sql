-- Migration 019: analytics interno de verdade.
--
-- O que existia media UMA coisa: que uma rota foi pintada. Sem identidade de
-- visitante (so sessao de aba), sem permanencia, sem intencao, sem campanha,
-- sem user-agent. Tres consequencias medidas em 27/08 sobre as 41.078 linhas
-- que ja estavam na page_events:
--
--   · duracao de sessao dava media de 9.132s e mediana 0. O session_id mora no
--     sessionStorage, entao aba esquecida aberta virava "sessao" de 2h32, e 56%
--     das sessoes tem um pageview so, logo duracao zero. Nao era query errada,
--     era evento que nunca existiu.
--   · a Austria era o 3o pais do painel: 1.005 views em 813 sessoes, 873 delas
--     Safari/mobile em 7 paginas. Sessao nova a cada visita, zero navegacao.
--     Assinatura de robo, ~7% do trafego, inflando o ranking acima da Alemanha.
--     Nao da pra confirmar retroativamente porque o user-agent nao era gravado.
--   · nao havia como ligar visita a doacao. A conversao do DogData e on-chain
--     (>=10k DOG pra carteira da obra), e nada no front amarrava as duas pontas.
--
-- Postura de escrita identica a 004/006/018: RLS ligado, ZERO policies, so a
-- service role entra. O papel anon nao le nem escreve nada disso por PostgREST.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. page_events — o sink cru, ampliado sem quebrar as 41k linhas de historico
-- ═══════════════════════════════════════════════════════════════════════════
-- Tudo nullable de proposito: as linhas de julho e agosto continuam validas e
-- respondem NULL pras colunas novas, que e a verdade (nao foi medido, nao e
-- zero). Toda leitura no painel filtra por janela, entao o degrau de 27/08
-- aparece sozinho conforme a janela anda.

alter table public.page_events
  -- identidade
  add column if not exists visitor_id     text,
  add column if not exists is_new_visitor boolean,
  -- contexto do cliente
  add column if not exists os             text,
  add column if not exists screen_w       int,
  add column if not exists screen_h       int,
  add column if not exists viewport_w     int,
  add column if not exists viewport_h     int,
  add column if not exists language       text,
  add column if not exists user_agent     text,
  -- geografia fina (headers da edge da Vercel)
  add column if not exists city           text,
  add column if not exists region         text,
  -- aquisicao
  add column if not exists utm_source     text,
  add column if not exists utm_medium     text,
  add column if not exists utm_campaign   text,
  add column if not exists utm_term       text,
  add column if not exists utm_content    text,
  add column if not exists channel        text,
  -- higiene
  add column if not exists is_bot         boolean not null default false,
  add column if not exists bot_reason     text,
  -- engajamento (event_type = 'engagement')
  add column if not exists duration_ms    int,
  add column if not exists scroll_pct     int,
  -- eventos nomeados (event_type = 'event')
  add column if not exists event_name     text,
  add column if not exists event_value    double precision,
  add column if not exists event_meta     jsonb;

-- O CHECK antigo so aceitava pageview|vital. Precisa soltar antes de qualquer
-- ingestao nova passar, senao o tracker novo apanha 500 em toda batida.
alter table public.page_events drop constraint if exists page_events_event_type_check;
alter table public.page_events add constraint page_events_event_type_check
  check (event_type in ('pageview', 'vital', 'engagement', 'event'));

-- Indices das leituras que o painel realmente faz. O parcial em is_bot=false
-- e o que mais paga: TODA consulta do painel filtra robo fora, e ele mantem o
-- indice do tamanho do trafego humano em vez do total.
create index if not exists idx_page_events_human
  on public.page_events (created_at desc) where is_bot = false;
create index if not exists idx_page_events_visitor
  on public.page_events (visitor_id, created_at desc) where visitor_id is not null;
create index if not exists idx_page_events_session
  on public.page_events (session_id, created_at) where session_id is not null;
create index if not exists idx_page_events_name
  on public.page_events (event_name, created_at desc) where event_name is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. analytics_visitors — uma linha por pessoa, nao por aba
-- ═══════════════════════════════════════════════════════════════════════════
-- O visitor_id e um UUID anonimo no localStorage. Nao e cookie, nao sai do
-- dominio, nao carrega nada que identifique alguem. E ele que destrava unicos
-- de verdade, novo vs recorrente e retencao por coorte.
--
-- first_* e primeiro toque e NUNCA e sobrescrito: e o que responde "de onde
-- veio quem doou", que e a pergunta que a landing existe pra responder. last_*
-- anda a cada visita.

create table if not exists public.analytics_visitors (
  visitor_id        text primary key,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  sessions          int not null default 0,
  pageviews         int not null default 0,
  engaged_ms        bigint not null default 0,
  -- primeiro toque, imutavel
  first_channel     text,
  first_referrer    text,
  first_page        text,
  first_utm_source  text,
  first_utm_medium  text,
  first_utm_campaign text,
  first_country     text,
  -- ultimo toque
  last_channel      text,
  last_country      text,
  last_device       text,
  is_bot            boolean not null default false
);

create index if not exists idx_visitors_first_seen on public.analytics_visitors (first_seen_at desc) where is_bot = false;
create index if not exists idx_visitors_last_seen  on public.analytics_visitors (last_seen_at desc)  where is_bot = false;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. analytics_sessions — a unidade que responde "quanto tempo ficou"
-- ═══════════════════════════════════════════════════════════════════════════
-- engaged_ms e SOMA de batidas de engajamento, nao (fim - inicio). Essa e a
-- correcao do bug de 9.132s: aba aberta parada nao acumula, porque o heartbeat
-- do cliente para quando o documento fica hidden. E tempo de atencao, nao de
-- calendario.
--
-- entry_page grava na criacao e nao muda; exit_page anda a cada pageview e o
-- ultimo que ficar e a saida real.

create table if not exists public.analytics_sessions (
  session_id     text primary key,
  visitor_id     text,
  started_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  pageviews      int not null default 0,
  events         int not null default 0,
  engaged_ms     int not null default 0,
  max_scroll_pct int not null default 0,
  entry_page     text,
  exit_page      text,
  country        text,
  city           text,
  region         text,
  device_type    text,
  browser        text,
  os             text,
  referrer       text,
  channel        text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  is_new_visitor boolean,
  is_bot         boolean not null default false,
  bot_reason     text
);

create index if not exists idx_sessions_started on public.analytics_sessions (started_at desc) where is_bot = false;
create index if not exists idx_sessions_visitor on public.analytics_sessions (visitor_id, started_at desc);
create index if not exists idx_sessions_channel on public.analytics_sessions (channel, started_at desc) where is_bot = false;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. analytics_identity — a ponte entre navegador e cadeia
-- ═══════════════════════════════════════════════════════════════════════════
-- Escrita SO depois de prova de posse (BIP-322/Schnorr em /api/wallet/verify).
-- Sem isso a doacao on-chain nunca encosta na sessao que a produziu, e o funil
-- de >=10k DOG fica sendo palpite temporal.
--
-- Chave composta: a mesma pessoa pode conectar duas carteiras, e a mesma
-- carteira pode ser conectada de dois navegadores. Os dois casos sao reais e
-- nenhum dos dois pode sobrescrever o outro.

create table if not exists public.analytics_identity (
  visitor_id  text not null,
  address     text not null,
  first_linked_at timestamptz not null default now(),
  last_linked_at  timestamptz not null default now(),
  session_id  text,
  wallet_id   text,
  primary key (visitor_id, address)
);

create index if not exists idx_identity_address on public.analytics_identity (address);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. analytics_conversions — a doacao, atribuida
-- ═══════════════════════════════════════════════════════════════════════════
-- Uma linha por doacao on-chain reconhecida. Preenchida por job que le
-- dog_transactions (mesma logica de /api/donate/leaderboard, inclusive a
-- guarda de saque) e cruza o endereco doador com analytics_identity.
--
-- attributed_visitor_id fica NULL quando o doador nunca conectou carteira no
-- site. Isso e informacao, nao falha: e a fatia do dinheiro que chegou sem
-- passar por um caminho que sabemos medir, e ela precisa aparecer no painel
-- com esse nome em vez de sumir da conta.

create table if not exists public.analytics_conversions (
  txid            text not null,
  address         text not null,
  amount_dog      double precision not null,
  block_height    int,
  occurred_at     timestamptz,
  cumulative_dog  double precision,
  tier            text,
  crossed_10k     boolean not null default false,
  attributed_visitor_id text,
  attribution     text not null default 'unattributed',
  first_channel   text,
  first_campaign  text,
  first_seen_at   timestamptz,
  hours_to_convert double precision,
  recorded_at     timestamptz not null default now(),
  primary key (txid, address)
);

create index if not exists idx_conversions_time on public.analytics_conversions (occurred_at desc);
create index if not exists idx_conversions_visitor on public.analytics_conversions (attributed_visitor_id) where attributed_visitor_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RLS: ligado, sem policy. So service role.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.analytics_visitors    enable row level security;
alter table public.analytics_sessions    enable row level security;
alter table public.analytics_identity    enable row level security;
alter table public.analytics_conversions enable row level security;

comment on table public.analytics_visitors is
  'Uma linha por visitor_id (UUID anonimo do localStorage). first_* e primeiro toque e nunca e sobrescrito. RLS sem policies: so service role.';
comment on table public.analytics_sessions is
  'Uma linha por sessao. engaged_ms e soma de batidas de atencao, NAO (fim-inicio) — aba parada nao acumula. RLS sem policies: so service role.';
comment on table public.analytics_identity is
  'Ponte visitor_id <-> endereco BTC, escrita so apos prova de posse em /api/wallet/verify. RLS sem policies: so service role.';
comment on table public.analytics_conversions is
  'Doacoes on-chain (>=10k DOG = licenca Personal) atribuidas ao primeiro toque. attribution=unattributed quando o doador nunca conectou carteira. RLS sem policies: so service role.';
