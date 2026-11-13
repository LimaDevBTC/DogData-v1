-- Migration 039: DOG MOTORS, os carros do DOG CITY comprados em $DOG ou BTC. NÃO APLICADA: o fundador aplica.
-- (Numerada depois da 038 da corrida, PR #61: o prêmio da corrida, race_prizes, conta como posse do modelo.)
--
-- Sem Ordinal: o carro fica registrado por carteira neste banco e o jogo lê (/api/dogcity/cars?address=).
-- Rota IRMÃ da licença: nenhuma tabela da licença (034/037) é lida ou escrita aqui, e o dinheiro do carro vai
-- para endereços próprios (CAR_FUND_BTC_ADDRESS, CAR_FUND_DOG_ADDRESS), nunca para o fundo da licença. Por isso
-- o carro não entra no placar da licença, no livro dos founders nem no gatilho dos 10.000.000 $DOG do mint.
--
--   car_models     os 18 modelos da DOG MOTORS, o preço em $DOG e se está à venda. O preço só vale quando ESTA
--                  linha e o catálogo do código (lib/game/cars/catalog.ts) dão o mesmo número. ⚠️ Os preços
--                  semeados aqui são PROVISÓRIOS (os mesmos marcadores do código); o fundador grava os reais.
--   car_orders     cada cotação + pedido. Imutável (é recibo de um preço prometido). BTC: os sats e as cotações
--                  travadas por 15 min. $DOG: o valor EXATO em átomos (preço + sufixo único de 1 a 99.999 átomos).
--                  Os dois: a carteira ordinals da sessão (dona do carro), o endereço pagador e o prazo.
--   car_payments   cada pagamento visto num endereço do fundo do carro. Chave: moeda + txid + saída (no $DOG, a
--                  saída que recebeu as runas). observed -> credited | unmatched | pending_review. Creditado é
--                  imutável, e só a função dogcity_car_credit cria um crédito.
--   car_ownership  a posse: UM carro de cada modelo por carteira. origem purchase (ref = 'btc:<txid>:<vout>' ou
--                  'dog:<txid>:<vout>', com o pedido) ou prize (ref = 'prize:<race_prizes.id>', entrega manual).
--                  Imutável. Compra só entra pela função dogcity_car_credit.
--
-- O prêmio da corrida (race_prizes da 038, estado approved ou delivered) conta como posse do modelo SEM precisar
-- de linha aqui: as funções leem race_prizes quando a tabela existe (sem a 038, não há prêmio nenhum).
--
-- Lido e escrito SÓ pelas rotas do servidor (service role). RLS ligada, ZERO políticas, como 033/034/036/037/038:
-- o anon não vê nada. Repo público: nenhum segredo aqui (os endereços do fundo do carro são variáveis da Vercel).
--
-- ORDEM SEGURA: aplicar ANTES de criar as variáveis CAR_FUND_*. Sem as variáveis a loja está fechada (503
-- sales_closed) e o cron não faz nada, com ou sem estas tabelas.
--
-- RESOLVER UM pending_review (ato humano deliberado, nunca efeito de código): devolver o dinheiro na cadeia, ou,
-- conferido o pagamento, dar o carro numa transação só:
--   begin;
--   select set_config('dogcity.car_credit', 'on', true);
--   insert into public.car_ownership (wallet, model, source, ref, order_id) values ('<carteira>', '<modelo>', 'purchase', '<moeda>:<txid>:<vout>', '<pedido>');
--   update public.car_payments set review_reason = 'resolved_manual', updated_at = now() where currency = '<moeda>' and txid = '<txid>' and vout = <vout>;
--   commit;

-- ── os modelos ─────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.car_models (
  id text primary key check (id ~ '^c[0-9]{2}$'),
  name text not null check (length(name) between 1 and 60),
  -- preço em $DOG inteiro; o teto e o piso são os de lib/game/cars/catalog.ts (MIN/MAX_CAR_PRICE_DOG)
  price_dog bigint not null check (price_dog between 1000 and 5000000),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.car_models enable row level security;

-- Preços do fundador (13/11/2026), iguais aos de lib/game/cars/catalog.ts. Mudar preço = mudar nos dois lugares.
insert into public.car_models (id, name, price_dog) values
  ('c02', 'DOG Centurion', 250000),
  ('c05', 'DOG Revolt', 250000),
  ('c15', 'DOG Bison', 75000),
  ('c39', 'DOG Horizon R', 60000),
  ('c40', 'DOG Apex 90', 60000),
  ('c41', 'DOG Surge IV', 60000),
  ('c10', 'DOG Sovereign', 100000),
  ('c25', 'DOG Turbo 75', 40000),
  ('c26', 'DOG Gullwing 54', 40000),
  ('c28', 'DOG Monarch GT', 40000),
  ('c62', 'DOG Breeze', 30000),
  ('c30', 'DOG Cutter 71', 35000),
  ('c32', 'DOG Stallion', 35000),
  ('c61', 'DOG Stallion 65 Convertible', 35000),
  ('c42', 'DOG Field 41', 25000),
  ('c43', 'DOG Outpost 110', 25000),
  ('c52', 'DOG Bug', 10000),
  ('c56', 'DOG Bug Classic', 10000)
on conflict (id) do nothing;

-- ── os pedidos ─────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.car_orders (
  id uuid primary key,
  model text not null references public.car_models (id),
  -- a carteira ordinals da sessão (quem fica com o carro), como a rota normaliza (bech32 minúsculo, base58 intacto)
  wallet text not null check (length(wallet) between 26 and 90),
  currency text not null check (currency in ('btc', 'dog')),
  -- o endereço de onde o pagamento TEM de sair
  payer_address text not null check (length(payer_address) between 26 and 90),
  -- o endereço do fundo do carro que recebe, gravado para auditoria
  pay_to text not null check (length(pay_to) between 26 and 90),
  price_dog bigint not null check (price_dog between 1000 and 5000000),
  -- BTC: sats exatos a pagar dentro da trava (teto 0,5 BTC, piso 1.000 sats)
  sats bigint check (sats is null or sats between 1000 and 50000000),
  -- $DOG: o valor exato em átomos, sempre entre o preço e o preço + 1 $DOG (o sufixo de 1 a 99.999 átomos)
  dog_exact_atoms bigint check (dog_exact_atoms is null or (dog_exact_atoms > price_dog * 100000 and dog_exact_atoms < (price_dog + 1) * 100000)),
  dog_usd numeric check (dog_usd is null or dog_usd > 0),
  btc_usd numeric check (btc_usd is null or btc_usd > 0),
  -- as corretoras da mediana, para auditoria
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at and expires_at <= created_at + interval '2 hours'),
  check (
    (currency = 'btc' and sats is not null and dog_usd is not null and btc_usd is not null and dog_exact_atoms is null)
    or (currency = 'dog' and dog_exact_atoms is not null and sats is null)
  )
);

create index if not exists car_orders_wallet_idx on public.car_orders (wallet, created_at desc);
create index if not exists car_orders_payer_idx on public.car_orders (payer_address, created_at desc);
create index if not exists car_orders_dog_exact_idx on public.car_orders (dog_exact_atoms, created_at desc) where currency = 'dog';
create index if not exists car_orders_expires_idx on public.car_orders (expires_at);

alter table public.car_orders enable row level security;

create or replace function public.car_orders_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'car_orders is immutable: an order is a receipt';
end;
$$;

drop trigger if exists car_orders_imutavel on public.car_orders;
create trigger car_orders_imutavel
  before update or delete on public.car_orders
  for each row execute function public.car_orders_imutavel();

-- ── os pagamentos ──────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.car_payments (
  currency text not null check (currency in ('btc', 'dog')),
  txid text not null check (txid ~ '^[0-9a-f]{64}$'),
  -- BTC: a saída da transação. $DOG: a saída que recebeu as runas (o vout do receptor no índice do scanner)
  vout integer not null check (vout >= 0),
  -- BTC: sats. $DOG: átomos (10^-5 $DOG). Sempre inteiro positivo; nunca float
  amount bigint not null check (amount > 0),
  payer_addresses text[] not null default '{}',
  -- BTC: a primeira vista (nossa ou do mempool.space). $DOG: o horário do bloco
  first_seen_at timestamptz not null,
  block_height integer,
  block_time timestamptz,
  -- observed       poucas confirmações ainda
  -- credited       virou carro (imutável daqui em diante; só pela função dogcity_car_credit)
  -- unmatched      nenhum pedido liga o pagador (poeira, fundo como pagador, sem pedido)
  -- pending_review um humano decide: a menor, a maior, vencido, pagador trocado, ambíguo, acima do teto,
  --                carteira que já tem o modelo, pedido já pago
  status text not null default 'observed'
    check (status in ('observed', 'credited', 'unmatched', 'pending_review')),
  review_reason text check (review_reason is null or length(review_reason) <= 40),
  order_id uuid references public.car_orders (id),
  wallet text check (wallet is null or length(wallet) between 26 and 90),
  model text references public.car_models (id),
  credited_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (currency, txid, vout),
  check (
    (status = 'credited' and order_id is not null and wallet is not null and model is not null
      and credited_at is not null and review_reason is null)
    or (status <> 'credited' and credited_at is null)
  )
);

-- um pedido vira no máximo UM carro
create unique index if not exists car_payments_one_credit_per_order
  on public.car_payments (order_id) where status = 'credited';
create index if not exists car_payments_status_idx on public.car_payments (status);

alter table public.car_payments enable row level security;

-- Crédito só pela função (a bandeira da transação), e creditado nunca muda nem sai. Corrigir é ato humano
-- deliberado (derrubar o gatilho, corrigir, recriar), nunca efeito de uma varredura.
create or replace function public.car_payments_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'credited' then
      raise exception 'car_payments: a credited payment cannot be deleted';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status = 'credited' then
    raise exception 'car_payments: a credited payment is immutable';
  end if;
  if new.status = 'credited' and coalesce(current_setting('dogcity.car_credit', true), '') <> 'on' then
    raise exception 'car_payments: a credit is written only by dogcity_car_credit';
  end if;
  return new;
end;
$$;

drop trigger if exists car_payments_guard on public.car_payments;
create trigger car_payments_guard
  before insert or update or delete on public.car_payments
  for each row execute function public.car_payments_guard();

-- ── a posse ────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.car_ownership (
  id uuid primary key default gen_random_uuid(),
  wallet text not null check (length(wallet) between 26 and 90),
  model text not null references public.car_models (id),
  source text not null check (source in ('purchase', 'prize')),
  -- o que tornou a posse única: 'btc:<txid>:<vout>', 'dog:<txid>:<vout>' ou 'prize:<race_prizes.id>'
  ref text not null unique check (ref ~ '^(btc:[0-9a-f]{64}:[0-9]+|dog:[0-9a-f]{64}:[0-9]+|prize:[0-9a-f-]{36})$'),
  order_id uuid references public.car_orders (id),
  created_at timestamptz not null default now(),
  -- UM carro de cada modelo por carteira
  unique (wallet, model),
  check ((source = 'purchase') = (order_id is not null)),
  check ((source = 'purchase') = (ref !~ '^prize:'))
);

create index if not exists car_ownership_wallet_idx on public.car_ownership (wallet);

alter table public.car_ownership enable row level security;

create or replace function public.car_ownership_guard() returns trigger
language plpgsql as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'car_ownership is immutable: a car is never moved or removed by code';
  end if;
  if new.source = 'purchase' and coalesce(current_setting('dogcity.car_credit', true), '') <> 'on' then
    raise exception 'car_ownership: a purchase is written only by dogcity_car_credit';
  end if;
  return new;
end;
$$;

drop trigger if exists car_ownership_guard on public.car_ownership;
create trigger car_ownership_guard
  before insert or update or delete on public.car_ownership
  for each row execute function public.car_ownership_guard();

-- ── o prêmio da corrida conta como posse ───────────────────────────────────────────────────────────────────────
-- race_prizes é da 038; sem ela não há prêmio nenhum. SQL dinâmico para esta função existir com ou sem a 038.
create or replace function public.dogcity_car_prize_owned(p_wallet text, p_model text) returns boolean
language plpgsql stable as $$
declare
  v boolean := false;
begin
  if to_regclass('public.race_prizes') is null then
    return false;
  end if;
  execute 'select exists (select 1 from public.race_prizes where wallet = $1 and model = $2 and state in (''approved'', ''delivered''))'
    into v using p_wallet, p_model;
  return coalesce(v, false);
end;
$$;

-- a carteira já tem o modelo? (compra, prêmio entregue registrado, ou prêmio aprovado/entregue na corrida)
create or replace function public.dogcity_car_owned(p_wallet text, p_model text) returns boolean
language plpgsql stable as $$
begin
  return exists (select 1 from public.car_ownership where wallet = p_wallet and model = p_model)
    or public.dogcity_car_prize_owned(p_wallet, p_model);
end;
$$;

-- os carros de uma carteira, para o jogo: a posse registrada mais os prêmios aprovados/entregues da corrida
create or replace function public.dogcity_cars_of(p_wallet text)
returns table (model text, source text, since timestamptz)
language plpgsql stable as $$
begin
  return query
    select o.model, o.source, o.created_at from public.car_ownership o where o.wallet = p_wallet;
  if to_regclass('public.race_prizes') is not null then
    return query execute
      'select p.model, ''prize''::text, coalesce(p.delivered_at, p.reviewed_at, p.created_at)
         from public.race_prizes p
        where p.wallet = $1 and p.state in (''approved'', ''delivered'')
          and not exists (select 1 from public.car_ownership o where o.wallet = p.wallet and o.model = p.model)'
      using p_wallet;
  end if;
end;
$$;

-- ── creditar: o ÚNICO caminho de escrita de uma compra ─────────────────────────────────────────────────────────
-- Numa transação só: confere de novo o pedido (moeda, pagador, valor), serializa por carteira + modelo, recusa a
-- carteira que já tem o modelo ou o pedido já pago (o pagamento vai para pending_review com o motivo), e só então
-- grava o pagamento creditado e a posse. Devolve 'credited' | 'already_owned' | 'order_already_paid', ou o estado
-- final que o pagamento já tinha ('unmatched' | 'pending_review') quando outra volta chegou antes. Repetir o mesmo
-- pagamento devolve 'credited' sem gravar nada. Pedido torto (moeda, pagador ou valor que não pagam o pedido) é
-- exceção: nada se grava.
create or replace function public.dogcity_car_credit(
  p_currency text,
  p_txid text,
  p_vout integer,
  p_amount bigint,
  p_payers text[],
  p_first_seen timestamptz,
  p_block_height integer,
  p_block_time timestamptz,
  p_order_id uuid
) returns text
language plpgsql as $$
declare
  o public.car_orders%rowtype;
  v_status text;
  v_reason text;
  v_ref text;
  v_n integer;
begin
  select * into o from public.car_orders where id = p_order_id;
  if not found then
    raise exception 'dogcity_car_credit: unknown order';
  end if;
  if o.currency is distinct from p_currency then
    raise exception 'dogcity_car_credit: the currency does not match the order';
  end if;
  if p_payers is null or not (o.payer_address = any (p_payers)) then
    raise exception 'dogcity_car_credit: the payment does not come from the order payer';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'dogcity_car_credit: bad amount';
  end if;
  if p_currency = 'btc' and (p_amount < o.sats or p_amount > 50000000) then
    raise exception 'dogcity_car_credit: the amount does not pay this order';
  end if;
  if p_currency = 'dog' and p_amount <> o.dog_exact_atoms then
    raise exception 'dogcity_car_credit: the amount is not the exact amount of this order';
  end if;

  v_ref := p_currency || ':' || p_txid || ':' || p_vout;
  perform pg_advisory_xact_lock(hashtextextended('dogcity_car:' || o.wallet || ':' || o.model, 0));

  select status into v_status from public.car_payments
   where currency = p_currency and txid = p_txid and vout = p_vout
   for update;
  if v_status is not null and v_status <> 'observed' then
    return v_status;
  end if;

  if public.dogcity_car_owned(o.wallet, o.model) then
    v_reason := 'already_owned';
  elsif exists (select 1 from public.car_payments where order_id = o.id and status = 'credited') then
    v_reason := 'order_already_paid';
  end if;

  if v_reason is not null then
    insert into public.car_payments as cp
      (currency, txid, vout, amount, payer_addresses, first_seen_at, block_height, block_time, status, review_reason, order_id, wallet, model, updated_at)
    values
      (p_currency, p_txid, p_vout, p_amount, p_payers, p_first_seen, p_block_height, p_block_time, 'pending_review', v_reason, o.id, o.wallet, o.model, now())
    on conflict (currency, txid, vout) do update
      set status = 'pending_review', review_reason = excluded.review_reason, order_id = excluded.order_id,
          wallet = excluded.wallet, model = excluded.model, block_height = excluded.block_height,
          block_time = excluded.block_time, updated_at = now()
      where cp.status = 'observed';
    return v_reason;
  end if;

  perform set_config('dogcity.car_credit', 'on', true);
  insert into public.car_payments as cp
    (currency, txid, vout, amount, payer_addresses, first_seen_at, block_height, block_time, status, review_reason, order_id, wallet, model, credited_at, updated_at)
  values
    (p_currency, p_txid, p_vout, p_amount, p_payers, p_first_seen, p_block_height, p_block_time, 'credited', null, o.id, o.wallet, o.model, now(), now())
  on conflict (currency, txid, vout) do update
    set status = 'credited', review_reason = null, order_id = excluded.order_id, wallet = excluded.wallet,
        model = excluded.model, block_height = excluded.block_height, block_time = excluded.block_time,
        credited_at = now(), updated_at = now()
    where cp.status = 'observed';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    perform set_config('dogcity.car_credit', 'off', true);
    select status into v_status from public.car_payments where currency = p_currency and txid = p_txid and vout = p_vout;
    return coalesce(v_status, 'pending_review');
  end if;
  -- (wallet, model) e ref são únicos: qualquer conflito aqui desfaz a transação inteira, crédito incluído
  insert into public.car_ownership (wallet, model, source, ref, order_id)
    values (o.wallet, o.model, 'purchase', v_ref, o.id);
  perform set_config('dogcity.car_credit', 'off', true);
  return 'credited';
end;
$$;

-- ── permissões ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Só o service role (rotas do servidor) toca nisto. RLS sem políticas já esconde as linhas; tira também os grants
-- das tabelas e das funções dos papéis do cliente.
revoke all on table public.car_models from anon, authenticated;
revoke all on table public.car_orders from anon, authenticated;
revoke all on table public.car_payments from anon, authenticated;
revoke all on table public.car_ownership from anon, authenticated;
revoke all on function public.car_orders_imutavel() from public, anon, authenticated;
revoke all on function public.car_payments_guard() from public, anon, authenticated;
revoke all on function public.car_ownership_guard() from public, anon, authenticated;
revoke all on function public.dogcity_car_prize_owned(text, text) from public, anon, authenticated;
revoke all on function public.dogcity_car_owned(text, text) from public, anon, authenticated;
revoke all on function public.dogcity_cars_of(text) from public, anon, authenticated;
revoke all on function public.dogcity_car_credit(text, text, integer, bigint, text[], timestamptz, integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.dogcity_car_prize_owned(text, text) to service_role;
grant execute on function public.dogcity_car_owned(text, text) to service_role;
grant execute on function public.dogcity_cars_of(text) to service_role;
grant execute on function public.dogcity_car_credit(text, text, integer, bigint, text[], timestamptz, integer, timestamptz, uuid) to service_role;
