-- Migration 006: a mempool do DOG, para a praça viva. Ver praca-central.md §4 (fase 1).
--
-- Duas tabelas, escritas SÓ pelo watcher da casa (scripts/dog_mempool_watcher.py,
-- service role) e lidas SÓ por rota de servidor (app/api/mempool/dog). RLS ligado
-- e zero policies, como a 004: o papel anon fica sem nada.
--
-- dog_mempool: uma linha por transação de DOG que o nosso nó viu, da mempool ao
-- bloco. `pending` enquanto está em órbita, `confirmed` quando pousou (bloco),
-- `dropped` quando sumiu da mempool sem entrar em bloco (RBF, expulsão). Linhas
-- fechadas há mais de 24 h são apagadas pelo próprio watcher: isto é a cena de
-- agora, não o histórico (o histórico é dog_transactions).
create table if not exists public.dog_mempool (
  txid text primary key,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dropped')),
  -- Quando o NOSSO nó viu pela primeira vez. Se a tx só apareceu no bloco (entre
  -- duas leituras da mempool, ou direto do minerador), seen_pending fica false e
  -- first_seen é a hora do bloco.
  first_seen timestamptz not null default now(),
  seen_pending boolean not null default true,
  block_height integer,
  block_time timestamptz,
  confirmed_at timestamptz,
  dropped_at timestamptz,

  -- DOG em unidades inteiras de DOG (já dividido por 10^5).
  dog_in numeric not null default 0,
  dog_out numeric not null default 0,
  dog_burn numeric not null default 0,
  -- true quando o runestone tinha edict de DOG; false na transferência implícita
  -- (gastou UTXO de DOG sem edict: tudo vai para o pointer ou primeira saída).
  explicit_edict boolean not null default false,
  cenotaph boolean not null default false,
  senders text[] not null default '{}',
  -- [{"address": "...", "dog": 123.45}], só saídas que receberam DOG.
  receivers jsonb not null default '[]'::jsonb,

  fee_sats bigint,
  vsize integer,
  fee_rate numeric,
  n_in integer,
  n_out integer,
  rbf boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists dog_mempool_status_seen on public.dog_mempool (status, first_seen desc);
create index if not exists dog_mempool_confirmed on public.dog_mempool (confirmed_at desc)
  where status = 'confirmed';

-- mempool_snapshot: uma linha, o estado do nó agora, para o painel da praça:
-- quantas txs esperam, a taxa que compra a próxima janela, o último bloco, e o
-- resumo do DOG em órbita.
create table if not exists public.mempool_snapshot (
  id smallint primary key default 1 check (id = 1),
  updated_at timestamptz not null default now(),
  tx_count integer not null default 0,
  vbytes bigint not null default 0,
  min_fee_rate numeric,
  fee_fast numeric,
  fee_normal numeric,
  fee_slow numeric,
  tip_height integer,
  tip_hash text,
  tip_time timestamptz,
  dog_pending integer not null default 0,
  dog_pending_amount numeric not null default 0,
  last_dog_block integer,
  last_dog_block_time timestamptz,
  last_dog_block_count integer,
  last_dog_block_amount numeric
);

alter table public.dog_mempool enable row level security;
alter table public.mempool_snapshot enable row level security;

comment on table public.dog_mempool is 'Transacoes de DOG vistas pelo nosso no, da mempool ao bloco. Escrita pelo dog_mempool_watcher.py; retencao 24h apos fechar.';
comment on table public.mempool_snapshot is 'Estado da mempool e do topo da cadeia agora, uma linha, para o painel da praca.';
