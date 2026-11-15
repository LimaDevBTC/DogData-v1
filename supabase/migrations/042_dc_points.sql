-- Migration 042: o saldo de DC Points no servidor e a compra de carro da DOG MOTORS em DC Points. NÃO APLICADA: o fundador
-- aplica (bloco para colar: DOGMOTORS_SQL/COLAR_042_dc_points.sql, o mesmo conteúdo entre begin/commit).
-- Decisões do fundador de 15/11/2026: assets_carros/projeto/CARROS_DC_POINTS.md. Contrato das rotas: o PR e
-- assets_carros/projeto/CARROS_DC_POINTS_CONTRATO.md. Regras dos DC Points: dogcity-mundo src/economia/README.md.
--
-- POR QUE: até aqui o saldo morava no navegador e o servidor só guardava o save que o aparelho manda (o último a gravar
-- ganha): qualquer um se dava 1 milhão. Antes de vender carro por DC Points, o saldo passa para o banco.
--
-- DC Points são PONTOS, não moeda: não se compram, não se transferem entre carteiras, nunca viram $DOG. Nada aqui toca
-- dinheiro de verdade (licença, mint, fundo, car_orders/car_payments ficam como estão).
--
--   dc_points_wallets  uma linha por carteira: o saldo (0 a 1.000.000) e se a migração única do save já rodou.
--   dc_points_ledger   o LIVRO-CAIXA, só de inclusão: cada ganho, gasto, compra de carro, migração e estorno, com a
--                      referência (idempotência: unique por carteira), o dia do jogo e o saldo depois. O saldo da
--                      carteira é mantido pelo GATILHO do livro (nunca negativo, nunca acima do teto). Imutável.
--   dc_points_legacy   a FOTO do saldo de cada save no momento em que esta migration é aplicada, limitada a 480 x dias de
--                      jogo de 2026-10-29 até o dia da foto (inclusive). Tirada UMA vez (dc_points_meta): rodar de novo
--                      não refaz, e save inflado depois da foto não migra nada.
--   dc_points_meta     marcadores (a foto já foi tirada, quando, com que teto).
--
-- AS REGRAS (iguais às do jogo, src/economia/regras_saldo.ts, copiadas em lib/game/points com teste de igualdade):
--   * quem ACUMULA é a carteira verificada COM handle (dogcity_profiles, a mesma fonte de GET /api/profile);
--   * teto diário de 480 DC Points GANHOS por carteira por dia do jogo (vira às 08:00 UTC), todas as fontes somadas;
--     não contam no teto a migração única e o estorno;
--   * ganho e gasto no mercado: 1 a 10.000 por operação; saldo 0 a 1.000.000; o carro: o preço do carro (até 250.000);
--   * idempotência por referência: a mesma operação com o mesmo ref devolve o resultado original; ref usado para outra
--     operação = 'ref_conflict';
--   * TRAVA por carteira (pg_advisory_xact_lock) em toda escrita; a compra de carro trava também carteira + modelo, a MESMA
--     chave de dogcity_car_credit (039): uma compra em DC e um crédito em cripto do mesmo modelo nunca correm juntos.
--
-- O DIA DO JOGO é do relógio do BANCO (dc_points_today), nunca de quem chama.
--
-- CARROS: car_models ganha price_dc (seed = preço em $DOG / 20, conferido contra lib/game/cars/catalog.ts por teste); os
-- dois FUSCAS (c52 DOG Bug, c56 DOG Bug Classic) saíram da frota em 15/11/2026 (fundador): as linhas ficam, INATIVAS e sem
-- price_dc, e a compra os recusa ('not_for_sale'). A frota da DOG MOTORS passa a 16 carros;
-- car_ownership aceita a origem 'dc' (ref 'dc:<id do livro>'), escrita SÓ por dc_points_buy_car (a bandeira da 039). Um de
-- cada modelo por carteira continua: unique (wallet, model) da 039 e dogcity_car_owned (compra em cripto, compra em DC e
-- prêmio da corrida contam).
--
-- Lido e escrito SÓ pelas rotas do servidor (service role). RLS ligada, ZERO políticas, como 036/039: o anon não vê nada.
-- Repo público: nenhum segredo aqui.
--
-- ORDEM SEGURA: aplicar ANTES de mesclar o PR (as rotas novas chamam estas funções; sem elas respondem 503). Aplicar o mais
-- perto possível do merge do jogo: o que o jogo creditar localmente entre a foto e o jogo novo no ar não migra.
--
-- ESTORNO (ato humano deliberado, no SQL Editor, nunca efeito de código):
--   select public.dc_points_refund('<carteira>', <valor>, '<ref único>', '<motivo>');
-- DESLIGAR A VENDA DE UM CARRO: update public.car_models set active = false where id = '<modelo>';

-- ── o dia do jogo ──────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.dc_points_today() returns date
language sql stable as $$
  select ((now() at time zone 'utc') - interval '8 hours')::date
$$;

-- ── as tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.dc_points_wallets (
  -- a carteira como as rotas normalizam (bech32 minúsculo, base58 intacto), a mesma chave de car_ownership
  wallet text primary key check (length(wallet) between 26 and 90),
  balance integer not null default 0 check (balance between 0 and 1000000),
  migrated_at timestamptz,
  migrated_amount integer check (migrated_amount is null or migrated_amount between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((migrated_at is null) = (migrated_amount is null))
);

alter table public.dc_points_wallets enable row level security;

create table if not exists public.dc_points_ledger (
  id bigint generated always as identity primary key,
  wallet text not null references public.dc_points_wallets (wallet),
  -- earn: ganho (conta no teto diário); spend: mercado do jogo; car: compra de carro; migration: a migração única do
  -- save; refund: estorno manual
  kind text not null check (kind in ('earn', 'spend', 'car', 'migration', 'refund')),
  -- a fonte do ganho (pesca, venda, checkin...), 'market' no gasto, o modelo na compra de carro, 'save', 'refund'
  source text not null check (source ~ '^[a-z][a-z0-9_]{1,31}$'),
  -- a referência da operação, com o prefixo que a rota põe (earn:, spend:, car:, checkin:<dia>, once:<fonte>, migration,
  -- refund:). Única por carteira: é ela que torna toda escrita idempotente.
  ref text not null check (ref ~ '^((earn|spend|car):[A-Za-z0-9_-]{8,64}|checkin:[0-9]{4}-[0-9]{2}-[0-9]{2}|once:[a-z][a-z0-9_]{1,31}|migration|refund:[A-Za-z0-9_-]{1,64})$'),
  -- o que se pediu (no ganho pode ter entrado menos, pelo teto diário)
  requested integer not null,
  -- o que mudou no saldo (0 = pedido que não coube no teto do dia: fica registrado e consome o ref)
  delta integer not null,
  game_day date not null default public.dc_points_today(),
  -- o saldo depois desta linha (o gatilho calcula; quem insere não escolhe)
  balance_after integer not null default 0 check (balance_after between 0 and 1000000),
  -- o mercado e o carro: o item (ou o modelo), a quantidade e o preço unitário cobrado (do servidor)
  item text check (item is null or item ~ '^[a-z][a-z0-9_]{1,31}$'),
  qty integer check (qty is null or qty between 1 and 100),
  unit_price integer check (unit_price is null or unit_price between 1 and 250000),
  note text check (note is null or length(note) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (wallet, ref),
  check (
    (kind = 'earn' and requested between 1 and 10000 and delta between 0 and requested)
    or (kind = 'spend' and delta between -10000 and -1 and requested = -delta and item is not null and qty is not null and unit_price is not null)
    or (kind = 'car' and delta between -250000 and -1 and requested = -delta and item is not null)
    or (kind = 'migration' and delta between 1 and 1000000 and requested >= delta)
    or (kind = 'refund' and delta between 1 and 250000 and requested = delta and note is not null)
  )
);

create index if not exists dc_points_ledger_day_idx on public.dc_points_ledger (wallet, game_day) where kind = 'earn';
create index if not exists dc_points_ledger_wallet_idx on public.dc_points_ledger (wallet, id desc);

alter table public.dc_points_ledger enable row level security;

create table if not exists public.dc_points_meta (
  key text primary key check (length(key) between 1 and 60),
  value jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.dc_points_meta enable row level security;

create table if not exists public.dc_points_legacy (
  wallet text primary key check (length(wallet) between 26 and 90),
  -- o saldo que o save tinha na foto (validado como validarSecao do jogo: lixo = 0)
  save_balance integer not null check (save_balance between 0 and 1000000),
  -- 480 x dias de jogo de 2026-10-29 até o dia da foto (inclusive)
  cap integer not null check (cap >= 0),
  -- o que migra: o menor dos dois
  amount integer not null check (amount >= 0 and amount <= save_balance and amount <= cap),
  save_updated_at timestamptz,
  captured_day date not null,
  captured_at timestamptz not null default now()
);

alter table public.dc_points_legacy enable row level security;

-- ── os guardas: só as funções escrevem; o livro nunca muda nem sai ─────────────────────────────────────────────
-- A bandeira da transação 'dogcity.dc_points' = 'on' é posta pelas funções em volta de cada escrita (o mesmo desenho
-- de dogcity.car_credit na 039). Correção manual: estorno por dc_points_refund, nunca editar o livro.
create or replace function public.dc_points_wallets_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'dc_points_wallets: a wallet is never removed';
  end if;
  if coalesce(current_setting('dogcity.dc_points', true), '') <> 'on' then
    raise exception 'dc_points_wallets: written only by the dc_points functions';
  end if;
  if tg_op = 'INSERT' and new.balance <> 0 then
    raise exception 'dc_points_wallets: a wallet starts at zero';
  end if;
  if tg_op = 'UPDATE' and old.migrated_at is not null and new.migrated_at is distinct from old.migrated_at then
    raise exception 'dc_points_wallets: the save migration happens once';
  end if;
  return new;
end;
$$;

drop trigger if exists dc_points_wallets_guard on public.dc_points_wallets;
create trigger dc_points_wallets_guard
  before insert or update or delete on public.dc_points_wallets
  for each row execute function public.dc_points_wallets_guard();

-- o livro mantém o saldo: cada linha nova aplica o delta na carteira (trava a linha dela) e grava o saldo depois
create or replace function public.dc_points_ledger_apply() returns trigger
language plpgsql as $$
declare
  v_bal integer;
begin
  if tg_op <> 'INSERT' then
    raise exception 'dc_points_ledger is append-only: a line is never changed or removed';
  end if;
  if coalesce(current_setting('dogcity.dc_points', true), '') <> 'on' then
    raise exception 'dc_points_ledger: written only by the dc_points functions';
  end if;
  select balance into v_bal from public.dc_points_wallets where wallet = new.wallet for update;
  if not found then
    raise exception 'dc_points_ledger: unknown wallet';
  end if;
  if v_bal + new.delta < 0 then
    raise exception 'dc_points_ledger: the balance never goes negative';
  end if;
  if v_bal + new.delta > 1000000 then
    raise exception 'dc_points_ledger: the balance cap is 1000000';
  end if;
  new.balance_after := v_bal + new.delta;
  if new.delta <> 0 then
    update public.dc_points_wallets set balance = new.balance_after, updated_at = now() where wallet = new.wallet;
  end if;
  return new;
end;
$$;

drop trigger if exists dc_points_ledger_apply on public.dc_points_ledger;
create trigger dc_points_ledger_apply
  before insert or update or delete on public.dc_points_ledger
  for each row execute function public.dc_points_ledger_apply();

create or replace function public.dc_points_meta_guard() returns trigger
language plpgsql as $$
begin
  raise exception 'dc_points_meta: a marker is never changed or removed';
end;
$$;

drop trigger if exists dc_points_meta_guard on public.dc_points_meta;
create trigger dc_points_meta_guard
  before update or delete on public.dc_points_meta
  for each row execute function public.dc_points_meta_guard();

create or replace function public.dc_points_legacy_guard() returns trigger
language plpgsql as $$
begin
  raise exception 'dc_points_legacy: the snapshot is never changed or removed';
end;
$$;

drop trigger if exists dc_points_legacy_guard on public.dc_points_legacy;
create trigger dc_points_legacy_guard
  before update or delete on public.dc_points_legacy
  for each row execute function public.dc_points_legacy_guard();

-- ── ajudantes ──────────────────────────────────────────────────────────────────────────────────────────────────
-- a carteira como as rotas normalizam (lib/dog/licence-btc.ts normalizeAddress): bech32 minúsculo, base58 intacto
create or replace function public.dc_points_norm_wallet(p text) returns text
language sql immutable as $$
  select case
    when x ~ '^(bc1|1|3)[a-zA-HJ-NP-Z0-9]{25,61}$' then x
    else null
  end
  from (select case when lower(btrim(coalesce(p, ''))) like 'bc1%' then lower(btrim(p)) else btrim(coalesce(p, '')) end as x) t
$$;

-- um número JSON inteiro entre lo e hi (o Number.isInteger + faixa do jogo); qualquer outra coisa: false
create or replace function public.dc_points_json_int_between(v jsonb, lo numeric, hi numeric) returns boolean
language plpgsql immutable as $$
declare
  n numeric;
begin
  if v is null or jsonb_typeof(v) <> 'number' then
    return false;
  end if;
  n := (v #>> '{}')::numeric;
  return n = trunc(n) and n between lo and hi;
end;
$$;

-- O saldo da seção `economia` de um save dogcity.jogo.v1, validado como validarSecao do jogo
-- (src/economia/persistencia.ts): envelope v 1, seção v 1, saldo inteiro de 0 a 1.000.000, recebido.dia inteiro de 0 a
-- 10.000.000, recebido.total inteiro de 0 a 480. Qualquer lixo: 0 (o jogo também zera).
create or replace function public.dc_points_save_balance(p_save jsonb) returns integer
language plpgsql immutable as $$
declare
  e jsonb;
  r jsonb;
begin
  if p_save is null or jsonb_typeof(p_save) <> 'object' then
    return 0;
  end if;
  if not public.dc_points_json_int_between(p_save -> 'v', 1, 1) then
    return 0;
  end if;
  e := p_save -> 'economia';
  if e is null or jsonb_typeof(e) <> 'object' then
    return 0;
  end if;
  if not public.dc_points_json_int_between(e -> 'v', 1, 1) then
    return 0;
  end if;
  if not public.dc_points_json_int_between(e -> 'saldo', 0, 1000000) then
    return 0;
  end if;
  r := e -> 'recebido';
  if r is null or jsonb_typeof(r) <> 'object' then
    return 0;
  end if;
  if not public.dc_points_json_int_between(r -> 'dia', 0, 10000000) then
    return 0;
  end if;
  if not public.dc_points_json_int_between(r -> 'total', 0, 480) then
    return 0;
  end if;
  return ((e -> 'saldo') #>> '{}')::numeric::integer;
end;
$$;

-- o teto da migração: 480 x dias de jogo de 2026-10-29 até p_day (inclusive)
create or replace function public.dc_points_migration_cap(p_day date) returns integer
language sql immutable as $$
  select 480 * greatest(0, (p_day - date '2026-10-29') + 1)
$$;

-- quem acumula: carteira com handle (dogcity_profiles guarda o endereço em minúsculas, como app/api/profile grava)
create or replace function public.dc_points_has_handle(p_wallet text) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.dogcity_profiles
     where address = lower(p_wallet) and handle is not null and length(btrim(handle)) > 0
  )
$$;

-- quanto a carteira já GANHOU no dia (só kind 'earn': migração e estorno não contam no teto)
create or replace function public.dc_points_earned_on(p_wallet text, p_day date) returns integer
language sql stable as $$
  select coalesce(sum(delta), 0)::integer from public.dc_points_ledger
   where wallet = p_wallet and kind = 'earn' and game_day = p_day
$$;

-- abre a escrita de uma carteira: confere a chave, TRAVA a carteira até o fim da transação e garante a linha dela
create or replace function public.dc_points_open(p_wallet text) returns integer
language plpgsql as $$
declare
  v integer;
begin
  if p_wallet is null or public.dc_points_norm_wallet(p_wallet) is distinct from p_wallet then
    raise exception 'dc_points: the wallet is not a normalized mainnet address';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('dc_points:' || p_wallet, 0));
  perform set_config('dogcity.dc_points', 'on', true);
  insert into public.dc_points_wallets (wallet) values (p_wallet) on conflict (wallet) do nothing;
  perform set_config('dogcity.dc_points', 'off', true);
  select balance into v from public.dc_points_wallets where wallet = p_wallet;
  return v;
end;
$$;

-- ── a foto dos saves (UMA vez) ─────────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_day date := public.dc_points_today();
  v_cap integer := public.dc_points_migration_cap(public.dc_points_today());
  v_n integer;
begin
  if exists (select 1 from public.dc_points_meta where key = 'legacy_snapshot') then
    return;
  end if;
  insert into public.dc_points_legacy (wallet, save_balance, cap, amount, save_updated_at, captured_day)
  select w, b, v_cap, least(b, v_cap), u, v_day
    from (
      select public.dc_points_norm_wallet(s.wallet) as w,
             max(public.dc_points_save_balance(s.save)) as b,
             max(s.updated_at) as u
        from public.dogcity_game_saves s
       where public.dc_points_norm_wallet(s.wallet) is not null
       group by 1
    ) t
  on conflict (wallet) do nothing;
  get diagnostics v_n = row_count;
  insert into public.dc_points_meta (key, value)
    values ('legacy_snapshot', jsonb_build_object('at', now(), 'day', v_day, 'cap', v_cap, 'wallets', v_n));
end
$$;

-- ── carros: o preço em DC Points ───────────────────────────────────────────────────────────────────────────────
alter table public.car_models add column if not exists price_dc integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.car_models'::regclass and conname = 'car_models_price_dc_check') then
    alter table public.car_models add constraint car_models_price_dc_check check (price_dc is null or price_dc between 1 and 250000);
  end if;
end
$$;

-- Preço em DC Points = preço em $DOG / 20 (fundador, 15/11/2026), igual a lib/game/cars/catalog.ts (priceDc). Só preenche
-- o que está vazio: rodar de novo não desfaz um preço mudado à mão. Mudar preço = mudar aqui (ou um update) E no código.
-- Os 16 da frota; os dois Fuscas ficam sem preço em DC (saíram da frota, logo abaixo).
update public.car_models m set price_dc = v.p, updated_at = now()
  from (values
    ('c02', 12500),
    ('c05', 12500),
    ('c15', 3750),
    ('c39', 3000),
    ('c40', 3000),
    ('c41', 3000),
    ('c10', 5000),
    ('c25', 2000),
    ('c26', 2000),
    ('c28', 2000),
    ('c62', 1500),
    ('c30', 1750),
    ('c32', 1750),
    ('c61', 1750),
    ('c42', 1250),
    ('c43', 1250)
  ) as v (id, p)
 where m.id = v.id and m.price_dc is null;

-- Os dois FUSCAS saem da frota (fundador, 15/11/2026): nada se apaga (car_orders e a história citam car_models); a linha
-- fica inativa e sem preço em DC. Nenhuma rota os vende (o código também não os conhece mais) e a corrida não os larga.
update public.car_models set active = false, price_dc = null, updated_at = now()
 where id in ('c52', 'c56') and (active or price_dc is not null);

-- ── carros: a origem 'dc' na posse ─────────────────────────────────────────────────────────────────────────────
-- Os checks da 039 que falam de source ou ref (nomes automáticos) saem e entram os novos, nomeados. Toda linha que já
-- existe (compra em cripto, prêmio) continua valendo pelos novos.
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.car_ownership'::regclass and contype = 'c'
       and (pg_get_constraintdef(oid) ilike '%source%' or pg_get_constraintdef(oid) ilike '%ref%')
  loop
    execute format('alter table public.car_ownership drop constraint %I', r.conname);
  end loop;
end
$$;

alter table public.car_ownership
  add constraint car_ownership_source_chk check (source in ('purchase', 'prize', 'dc'));
alter table public.car_ownership
  add constraint car_ownership_ref_chk check (ref ~ '^(btc:[0-9a-f]{64}:[0-9]+|dog:[0-9a-f]{64}:[0-9]+|prize:[0-9a-f-]{36}|dc:[0-9]{1,18})$');
alter table public.car_ownership
  add constraint car_ownership_order_chk check ((source = 'purchase') = (order_id is not null));
alter table public.car_ownership
  add constraint car_ownership_ref_source_chk check (
    (source = 'purchase' and ref ~ '^(btc|dog):')
    or (source = 'prize' and ref ~ '^prize:')
    or (source = 'dc' and ref ~ '^dc:')
  );

-- a compra (cripto OU DC) só entra pela função dela (a bandeira dogcity.car_credit da 039)
create or replace function public.car_ownership_guard() returns trigger
language plpgsql as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'car_ownership is immutable: a car is never moved or removed by code';
  end if;
  if new.source in ('purchase', 'dc') and coalesce(current_setting('dogcity.car_credit', true), '') <> 'on' then
    raise exception 'car_ownership: a purchase is written only by dogcity_car_credit or dc_points_buy_car';
  end if;
  return new;
end;
$$;

-- ── ler o saldo ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.dc_points_state(p_wallet text) returns jsonb
language plpgsql stable as $$
declare
  w public.dc_points_wallets%rowtype;
  v_day date := public.dc_points_today();
begin
  select * into w from public.dc_points_wallets where wallet = p_wallet;
  return jsonb_build_object(
    'balance', coalesce(w.balance, 0),
    'earned_today', public.dc_points_earned_on(p_wallet, v_day),
    'day', v_day,
    'migrated', w.migrated_at is not null,
    'migrated_amount', coalesce(w.migrated_amount, 0),
    'has_handle', public.dc_points_has_handle(p_wallet)
  );
end;
$$;

-- ── a migração única do save ───────────────────────────────────────────────────────────────────────────────────
-- Uma vez por carteira, só COM handle, pelo valor da FOTO (dc_points_legacy), fora do teto diário. Devolve
-- { status: 'migrated' | 'already' | 'no_handle', amount, balance }.
create or replace function public.dc_points_migrate(p_wallet text) returns jsonb
language plpgsql as $$
declare
  w public.dc_points_wallets%rowtype;
  v_amount integer := 0;
  v_save integer := 0;
  v_after integer;
begin
  perform public.dc_points_open(p_wallet);
  select * into w from public.dc_points_wallets where wallet = p_wallet;
  if w.migrated_at is not null then
    return jsonb_build_object('status', 'already', 'amount', w.migrated_amount, 'balance', w.balance);
  end if;
  if not public.dc_points_has_handle(p_wallet) then
    return jsonb_build_object('status', 'no_handle', 'amount', 0, 'balance', w.balance);
  end if;
  select amount, save_balance into v_amount, v_save from public.dc_points_legacy where wallet = p_wallet;
  v_amount := coalesce(v_amount, 0);
  v_after := w.balance;
  perform set_config('dogcity.dc_points', 'on', true);
  if v_amount > 0 then
    insert into public.dc_points_ledger (wallet, kind, source, ref, requested, delta)
      values (p_wallet, 'migration', 'save', 'migration', v_save, v_amount)
      returning balance_after into v_after;
  end if;
  update public.dc_points_wallets set migrated_at = now(), migrated_amount = v_amount, updated_at = now() where wallet = p_wallet;
  perform set_config('dogcity.dc_points', 'off', true);
  return jsonb_build_object('status', 'migrated', 'amount', v_amount, 'balance', v_after);
end;
$$;

-- ── ganhar ─────────────────────────────────────────────────────────────────────────────────────────────────────
-- Credita min(pedido, 480 - ganho hoje, 1.000.000 - saldo); com p_all_or_nothing, tudo ou nada. O pedido que não coube
-- também fica no livro (delta 0) e consome o ref. Só carteira com handle. A fonte e o teto por operação dela vêm da rota
-- (lib/game/points/rules.ts, lista fechada); aqui valem o formato e o teto absoluto. Devolve
-- { status: 'ok' | 'duplicate' | 'no_handle' | 'ref_conflict', requested, credited, balance, earned_today, day }.
create or replace function public.dc_points_earn(
  p_wallet text,
  p_source text,
  p_amount integer,
  p_ref text,
  p_max_per_op integer,
  p_all_or_nothing boolean default false
) returns jsonb
language plpgsql as $$
declare
  v_day date := public.dc_points_today();
  l public.dc_points_ledger%rowtype;
  v_bal integer;
  v_earned integer;
  v_credit integer;
  v_after integer;
begin
  if p_max_per_op is null or p_max_per_op < 1 or p_max_per_op > 10000 then
    raise exception 'dc_points_earn: bad per-operation cap';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > p_max_per_op then
    raise exception 'dc_points_earn: bad amount';
  end if;
  if p_source is null or p_source !~ '^[a-z][a-z0-9_]{1,31}$' then
    raise exception 'dc_points_earn: bad source';
  end if;
  if p_ref is null or p_ref !~ '^((earn:[A-Za-z0-9_-]{8,64})|checkin:[0-9]{4}-[0-9]{2}-[0-9]{2}|once:[a-z][a-z0-9_]{1,31})$' then
    raise exception 'dc_points_earn: bad ref';
  end if;
  v_bal := public.dc_points_open(p_wallet);
  select * into l from public.dc_points_ledger where wallet = p_wallet and ref = p_ref;
  if found then
    if l.kind = 'earn' and l.source = p_source and l.requested = p_amount then
      return jsonb_build_object('status', 'duplicate', 'requested', l.requested, 'credited', l.delta, 'balance', v_bal,
        'earned_today', public.dc_points_earned_on(p_wallet, v_day), 'day', v_day);
    end if;
    return jsonb_build_object('status', 'ref_conflict');
  end if;
  if not public.dc_points_has_handle(p_wallet) then
    return jsonb_build_object('status', 'no_handle');
  end if;
  v_earned := public.dc_points_earned_on(p_wallet, v_day);
  v_credit := least(p_amount, greatest(0, 480 - v_earned), greatest(0, 1000000 - v_bal));
  if coalesce(p_all_or_nothing, false) and v_credit < p_amount then
    v_credit := 0;
  end if;
  perform set_config('dogcity.dc_points', 'on', true);
  insert into public.dc_points_ledger (wallet, kind, source, ref, requested, delta, game_day)
    values (p_wallet, 'earn', p_source, p_ref, p_amount, v_credit, v_day)
    returning balance_after into v_after;
  perform set_config('dogcity.dc_points', 'off', true);
  return jsonb_build_object('status', 'ok', 'requested', p_amount, 'credited', v_credit, 'balance', v_after,
    'earned_today', v_earned + v_credit, 'day', v_day);
end;
$$;

-- ── gastar no mercado do jogo ──────────────────────────────────────────────────────────────────────────────────
-- O preço unitário vem da ROTA, que o calcula (lib/game/points/regras_preco.ts, cópia do jogo); o cliente nunca manda
-- preço. Aqui: total inteiro de 1 a 10.000, saldo que chegue, ref idempotente. p_max_total (opcional) é o que o jogador viu:
-- total acima dele não debita ('price_changed'); é conferido DEPOIS do ref, para a repetição de uma compra que já entrou
-- devolver 'duplicate' mesmo com o preço do dia mudado. Devolve
-- { status: 'ok' | 'duplicate' | 'insufficient' | 'price_changed' | 'ref_conflict', item, qty, unit_price, debited,
--   balance, needed, total }.
create or replace function public.dc_points_spend(
  p_wallet text,
  p_item text,
  p_qty integer,
  p_unit_price integer,
  p_ref text,
  p_max_total integer default null
) returns jsonb
language plpgsql as $$
declare
  l public.dc_points_ledger%rowtype;
  v_bal integer;
  v_total bigint;
  v_after integer;
begin
  if p_item is null or p_item !~ '^[a-z][a-z0-9_]{1,31}$' then
    raise exception 'dc_points_spend: bad item';
  end if;
  if p_qty is null or p_qty < 1 or p_qty > 100 then
    raise exception 'dc_points_spend: bad quantity';
  end if;
  if p_unit_price is null or p_unit_price < 1 or p_unit_price > 10000 then
    raise exception 'dc_points_spend: bad unit price';
  end if;
  v_total := p_qty::bigint * p_unit_price::bigint;
  if v_total < 1 or v_total > 10000 then
    raise exception 'dc_points_spend: the total is above the per-operation cap';
  end if;
  if p_ref is null or p_ref !~ '^spend:[A-Za-z0-9_-]{8,64}$' then
    raise exception 'dc_points_spend: bad ref';
  end if;
  v_bal := public.dc_points_open(p_wallet);
  select * into l from public.dc_points_ledger where wallet = p_wallet and ref = p_ref;
  if found then
    if l.kind = 'spend' and l.item = p_item and l.qty = p_qty then
      return jsonb_build_object('status', 'duplicate', 'item', l.item, 'qty', l.qty, 'unit_price', l.unit_price,
        'debited', -l.delta, 'balance', v_bal);
    end if;
    return jsonb_build_object('status', 'ref_conflict');
  end if;
  if p_max_total is not null and v_total > p_max_total then
    return jsonb_build_object('status', 'price_changed', 'unit_price', p_unit_price, 'total', v_total, 'balance', v_bal);
  end if;
  if v_bal < v_total then
    return jsonb_build_object('status', 'insufficient', 'balance', v_bal, 'needed', v_total);
  end if;
  perform set_config('dogcity.dc_points', 'on', true);
  insert into public.dc_points_ledger (wallet, kind, source, ref, requested, delta, item, qty, unit_price)
    values (p_wallet, 'spend', 'market', p_ref, v_total, -v_total, p_item, p_qty, p_unit_price)
    returning balance_after into v_after;
  perform set_config('dogcity.dc_points', 'off', true);
  return jsonb_build_object('status', 'ok', 'item', p_item, 'qty', p_qty, 'unit_price', p_unit_price,
    'debited', v_total, 'balance', v_after);
end;
$$;

-- ── comprar um carro da DOG MOTORS em DC Points ────────────────────────────────────────────────────────────────
-- Numa transação: trava a carteira (DC) e carteira + modelo (a chave de dogcity_car_credit); confere o ref, o modelo
-- ativo, o preço do BANCO igual ao do código (p_expected_price, de lib/game/cars/catalog.ts), um de cada modelo por
-- carteira (dogcity_car_owned: cripto, DC e prêmio contam) e o saldo; debita e grava a posse com origem 'dc'. Devolve
-- { status: 'ok' | 'duplicate' | 'unknown_model' | 'not_for_sale' | 'price_mismatch' | 'already_owned' |
--   'insufficient' | 'ref_conflict', model, price, balance, ownership_ref }.
create or replace function public.dc_points_buy_car(
  p_wallet text,
  p_model text,
  p_expected_price integer,
  p_ref text
) returns jsonb
language plpgsql as $$
declare
  l public.dc_points_ledger%rowtype;
  v_bal integer;
  v_price integer;
  v_active boolean;
  v_id bigint;
  v_after integer;
begin
  if p_model is null or p_model !~ '^c[0-9]{2}$' then
    raise exception 'dc_points_buy_car: bad model';
  end if;
  if p_expected_price is null or p_expected_price < 1 or p_expected_price > 250000 then
    raise exception 'dc_points_buy_car: bad expected price';
  end if;
  if p_ref is null or p_ref !~ '^car:[A-Za-z0-9_-]{8,64}$' then
    raise exception 'dc_points_buy_car: bad ref';
  end if;
  v_bal := public.dc_points_open(p_wallet);
  perform pg_advisory_xact_lock(hashtextextended('dogcity_car:' || p_wallet || ':' || p_model, 0));
  select * into l from public.dc_points_ledger where wallet = p_wallet and ref = p_ref;
  if found then
    if l.kind = 'car' and l.source = p_model then
      return jsonb_build_object('status', 'duplicate', 'model', p_model, 'price', -l.delta, 'balance', v_bal,
        'ownership_ref', 'dc:' || l.id);
    end if;
    return jsonb_build_object('status', 'ref_conflict');
  end if;
  select price_dc, active into v_price, v_active from public.car_models where id = p_model;
  if not found then
    return jsonb_build_object('status', 'unknown_model', 'model', p_model);
  end if;
  if not coalesce(v_active, false) or v_price is null then
    return jsonb_build_object('status', 'not_for_sale', 'model', p_model);
  end if;
  if v_price <> p_expected_price then
    return jsonb_build_object('status', 'price_mismatch', 'model', p_model, 'price', v_price);
  end if;
  if public.dogcity_car_owned(p_wallet, p_model) then
    return jsonb_build_object('status', 'already_owned', 'model', p_model, 'price', v_price, 'balance', v_bal);
  end if;
  if v_bal < v_price then
    return jsonb_build_object('status', 'insufficient', 'model', p_model, 'price', v_price, 'balance', v_bal);
  end if;
  perform set_config('dogcity.dc_points', 'on', true);
  insert into public.dc_points_ledger (wallet, kind, source, ref, requested, delta, item, qty, unit_price)
    values (p_wallet, 'car', p_model, p_ref, v_price, -v_price, p_model, 1, v_price)
    returning id, balance_after into v_id, v_after;
  perform set_config('dogcity.dc_points', 'off', true);
  -- (wallet, model) e ref são únicos: qualquer conflito aqui desfaz a transação inteira, débito incluído
  perform set_config('dogcity.car_credit', 'on', true);
  insert into public.car_ownership (wallet, model, source, ref, order_id)
    values (p_wallet, p_model, 'dc', 'dc:' || v_id, null);
  perform set_config('dogcity.car_credit', 'off', true);
  return jsonb_build_object('status', 'ok', 'model', p_model, 'price', v_price, 'balance', v_after, 'ownership_ref', 'dc:' || v_id);
end;
$$;

-- ── estorno (manual, SQL Editor) ───────────────────────────────────────────────────────────────────────────────
-- Fora do teto diário, com motivo obrigatório. Nenhuma rota chama: não tem grant para o service_role.
create or replace function public.dc_points_refund(
  p_wallet text,
  p_amount integer,
  p_ref text,
  p_note text
) returns jsonb
language plpgsql as $$
declare
  l public.dc_points_ledger%rowtype;
  v_ref text := 'refund:' || coalesce(p_ref, '');
  v_after integer;
begin
  if p_amount is null or p_amount < 1 or p_amount > 250000 then
    raise exception 'dc_points_refund: bad amount';
  end if;
  if p_ref is null or p_ref !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'dc_points_refund: bad ref';
  end if;
  if p_note is null or length(btrim(p_note)) < 1 or length(p_note) > 200 then
    raise exception 'dc_points_refund: a reason is required';
  end if;
  perform public.dc_points_open(p_wallet);
  select * into l from public.dc_points_ledger where wallet = p_wallet and ref = v_ref;
  if found then
    if l.kind = 'refund' and l.delta = p_amount then
      return jsonb_build_object('status', 'duplicate', 'credited', l.delta, 'balance', l.balance_after);
    end if;
    return jsonb_build_object('status', 'ref_conflict');
  end if;
  perform set_config('dogcity.dc_points', 'on', true);
  insert into public.dc_points_ledger (wallet, kind, source, ref, requested, delta, note)
    values (p_wallet, 'refund', 'refund', v_ref, p_amount, p_amount, p_note)
    returning balance_after into v_after;
  perform set_config('dogcity.dc_points', 'off', true);
  return jsonb_build_object('status', 'ok', 'credited', p_amount, 'balance', v_after);
end;
$$;

-- ── permissões ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Só o service role (rotas do servidor) executa as funções das rotas. RLS sem políticas já esconde as linhas; tira também
-- os grants das tabelas e das funções dos papéis do cliente. O estorno fica só para o dono (SQL Editor).
revoke all on table public.dc_points_wallets from anon, authenticated;
revoke all on table public.dc_points_ledger from anon, authenticated;
revoke all on table public.dc_points_meta from anon, authenticated;
revoke all on table public.dc_points_legacy from anon, authenticated;
revoke all on function public.dc_points_today() from public, anon, authenticated;
revoke all on function public.dc_points_wallets_guard() from public, anon, authenticated;
revoke all on function public.dc_points_ledger_apply() from public, anon, authenticated;
revoke all on function public.dc_points_meta_guard() from public, anon, authenticated;
revoke all on function public.dc_points_legacy_guard() from public, anon, authenticated;
revoke all on function public.dc_points_norm_wallet(text) from public, anon, authenticated;
revoke all on function public.dc_points_json_int_between(jsonb, numeric, numeric) from public, anon, authenticated;
revoke all on function public.dc_points_save_balance(jsonb) from public, anon, authenticated;
revoke all on function public.dc_points_migration_cap(date) from public, anon, authenticated;
revoke all on function public.dc_points_has_handle(text) from public, anon, authenticated;
revoke all on function public.dc_points_earned_on(text, date) from public, anon, authenticated;
revoke all on function public.dc_points_open(text) from public, anon, authenticated;
revoke all on function public.dc_points_state(text) from public, anon, authenticated;
revoke all on function public.dc_points_migrate(text) from public, anon, authenticated;
revoke all on function public.dc_points_earn(text, text, integer, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.dc_points_spend(text, text, integer, integer, text, integer) from public, anon, authenticated;
revoke all on function public.dc_points_buy_car(text, text, integer, text) from public, anon, authenticated;
revoke all on function public.dc_points_refund(text, integer, text, text) from public, anon, authenticated, service_role;
revoke all on function public.car_ownership_guard() from public, anon, authenticated;
grant execute on function public.dc_points_today() to service_role;
grant execute on function public.dc_points_norm_wallet(text) to service_role;
grant execute on function public.dc_points_json_int_between(jsonb, numeric, numeric) to service_role;
grant execute on function public.dc_points_save_balance(jsonb) to service_role;
grant execute on function public.dc_points_migration_cap(date) to service_role;
grant execute on function public.dc_points_has_handle(text) to service_role;
grant execute on function public.dc_points_earned_on(text, date) to service_role;
grant execute on function public.dc_points_open(text) to service_role;
grant execute on function public.dc_points_state(text) to service_role;
grant execute on function public.dc_points_migrate(text) to service_role;
grant execute on function public.dc_points_earn(text, text, integer, text, integer, boolean) to service_role;
grant execute on function public.dc_points_spend(text, text, integer, integer, text, integer) to service_role;
grant execute on function public.dc_points_buy_car(text, text, integer, text) to service_role;
