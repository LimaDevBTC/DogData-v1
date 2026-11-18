-- Migration 043: crédito da indicação por lote (17/11/2026, decisão do fundador): DC Points e itens. NÃO APLICADA: o orquestrador
-- revisa e aplica. Depende da 042 (livro-caixa dc_points_*). Contrato público: /dogcity/docs#referrals e
-- GET /api/dogcity/referral-items. Quem lê o mint e chama estas funções: app/api/cron/lot-referrals (lib/lot-referral).
--
-- REGRAS: 500 DC por lote indicado para o DONO ATUAL do lote que indicou; 250 DC ao indicado no primeiro mint; dobro para os dois
-- se os lotes são da mesma quadra; crédito 144 blocos depois do `indexed`; nunca o próprio lote nem a própria carteira; um nível
-- só; teto de 5.000 DC por dia de jogo por carteira (acima: fila de revisão, NÃO credita); itens por quantidade de lotes
-- indicados pela carteira dona: 3 quad, 10 jet, 25 m4 (ficam com a carteira que os conquistou).
-- As decisões ficam em lib/lot-referral/rules.ts (testadas); aqui moram a idempotência, o teto, o livro e os itens.
--
--   lot_referral_rewards  uma linha por (pedido do mint, lado): 'owner' (quem indicou), 'guest' (o indicado) ou 'order' (o pedido
--                         inteiro recusado). Chave única por pedido+lado: rodar o job duas vezes nunca credita duas vezes.
--                         status: credited | review (passou do teto diário: revisão manual) | rejected (própria carteira/lote, ...)
--                         | guest_taken (a boas-vindas do indicado já foi paga em outro pedido).
--   lot_referral_items    os itens conquistados por carteira (quad, jet, m4), para sempre.
-- Revisão manual: o fundador confere as linhas status = 'review'; para creditar, apagar a linha no SQL Editor e o próximo
-- giro do job tenta de novo (o teto vale por dia de jogo).
--
-- O LIVRO: ganha o tipo 'referral' (fonte 'referral', ref `referral:<id do pedido sem hífen>:<owner|guest>`). Fora do teto de 480
-- DC por dia do jogo (dc_points_earned_on só soma kind 'earn') e com o teto próprio de 5.000.

begin;

-- ── o livro aceita 'referral' ─────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'public.dc_points_ledger'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ~ '(earn|refund)'
  loop
    execute format('alter table public.dc_points_ledger drop constraint %I', r.conname);
  end loop;
end
$$;

alter table public.dc_points_ledger add constraint dc_points_ledger_kind_check
  check (kind in ('earn', 'spend', 'car', 'migration', 'refund', 'referral'));
alter table public.dc_points_ledger add constraint dc_points_ledger_ref_check
  check (ref ~ '^((earn|spend|car):[A-Za-z0-9_-]{8,64}|checkin:[0-9]{4}-[0-9]{2}-[0-9]{2}|once:[a-z][a-z0-9_]{1,31}|migration|refund:[A-Za-z0-9_-]{1,64}|referral:[0-9a-f]{32}:(owner|guest))$');
alter table public.dc_points_ledger add constraint dc_points_ledger_kinds_check
  check (
    (kind = 'earn' and requested between 1 and 10000 and delta between 0 and requested)
    or (kind = 'spend' and delta between -10000 and -1 and requested = -delta and item is not null and qty is not null and unit_price is not null)
    or (kind = 'car' and delta between -250000 and -1 and requested = -delta and item is not null)
    or (kind = 'migration' and delta between 1 and 1000000 and requested >= delta)
    or (kind = 'refund' and delta between 1 and 250000 and requested = delta and note is not null)
    or (kind = 'referral' and requested between 1 and 1000 and delta between 0 and requested)
  );

create index if not exists dc_points_ledger_referral_day_idx on public.dc_points_ledger (wallet, game_day) where kind = 'referral';

-- ── as tabelas ───────────────────────────────────────────────────────────
create table if not exists public.lot_referral_rewards (
  order_id uuid not null,
  side text not null check (side in ('owner', 'guest', 'order')),
  status text not null check (status in ('credited', 'review', 'rejected', 'guest_taken')),
  -- o lote indicado (o que foi mintado) e o lote que indicou
  lot_id text not null check (lot_id ~ '^S[0-9]{2}-Q[0-9]{2}-B[0-9]{3,5}-L[0-9]{3,5}$'),
  referrer_lot text not null check (referrer_lot ~ '^S[0-9]{2}-Q[0-9]{2}-B[0-9]{3,5}-L[0-9]{3,5}$'),
  -- a carteira deste lado (null no lado 'order'); o endereço de entrega do indicado
  wallet text check (wallet is null or length(wallet) between 26 and 90),
  guest_wallet text check (guest_wallet is null or length(guest_wallet) between 26 and 90),
  same_block boolean not null default false,
  amount integer not null default 0 check (amount between 0 and 1000),
  credited integer not null default 0 check (credited between 0 and 1000),
  reason text check (reason is null or length(reason) <= 60),
  indexed_block integer check (indexed_block is null or indexed_block >= 0),
  indexed_at timestamptz,
  ledger_id bigint references public.dc_points_ledger (id),
  game_day date,
  created_at timestamptz not null default now(),
  primary key (order_id, side)
);
-- a boas-vindas é UMA por carteira indicada (o primeiro mint dela)
create unique index if not exists lot_referral_guest_once on public.lot_referral_rewards (wallet) where side = 'guest' and status = 'credited';
create index if not exists lot_referral_owner_idx on public.lot_referral_rewards (wallet, created_at) where side = 'owner' and status = 'credited';
create index if not exists lot_referral_review_idx on public.lot_referral_rewards (created_at) where status = 'review';
alter table public.lot_referral_rewards enable row level security;

create table if not exists public.lot_referral_items (
  wallet text not null check (length(wallet) between 26 and 90),
  item text not null check (item in ('quad', 'jet', 'm4')),
  -- quantos lotes a carteira tinha indicado quando ganhou, e o pedido que destravou
  lots_at_unlock integer not null check (lots_at_unlock >= 1),
  order_id uuid,
  unlocked_at timestamptz not null default now(),
  primary key (wallet, item)
);
alter table public.lot_referral_items enable row level security;

-- ── o crédito de UM lado de UM pedido (atômico, idempotente) ──────────────────────
-- Devolve { status: 'ok' | 'duplicate' | 'no_handle' | 'review' | 'guest_taken', credited, balance }.
--   no_handle: a carteira ainda não tem handle (a mesma exigência de quem acumula na 042); NADA é gravado, o job tenta no
--   próximo giro. review: passou de p_daily_cap no dia de jogo; grava a linha 'review' e não credita.
create or replace function public.lot_referral_credit(
  p_order uuid,
  p_side text,
  p_wallet text,
  p_amount integer,
  p_lot text,
  p_referrer_lot text,
  p_guest_wallet text,
  p_same_block boolean,
  p_indexed_block integer,
  p_indexed_at timestamptz,
  p_daily_cap integer default 5000
) returns jsonb
language plpgsql as $$
declare
  v_day date := public.dc_points_today();
  v_bal integer;
  v_done record;
  v_today integer;
  v_credit integer;
  v_ledger bigint;
  v_after integer;
  v_n integer;
  v_ref text;
begin
  if p_side not in ('owner', 'guest') then raise exception 'lot_referral_credit: bad side'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000 then raise exception 'lot_referral_credit: bad amount'; end if;
  if p_daily_cap is null or p_daily_cap < 1 or p_daily_cap > 5000 then raise exception 'lot_referral_credit: bad cap'; end if;
  v_bal := public.dc_points_open(p_wallet);  -- trava a carteira e garante a linha dela
  select * into v_done from public.lot_referral_rewards where order_id = p_order and side = p_side;
  if found then
    return jsonb_build_object('status', 'duplicate', 'credited', v_done.credited, 'balance', v_bal);
  end if;
  if p_side = 'guest' and exists (select 1 from public.lot_referral_rewards where wallet = p_wallet and side = 'guest' and status = 'credited') then
    insert into public.lot_referral_rewards (order_id, side, status, lot_id, referrer_lot, wallet, guest_wallet, same_block, amount, indexed_block, indexed_at, game_day, reason)
      values (p_order, p_side, 'guest_taken', p_lot, p_referrer_lot, p_wallet, p_guest_wallet, p_same_block, p_amount, p_indexed_block, p_indexed_at, v_day, 'welcome already paid');
    return jsonb_build_object('status', 'guest_taken', 'credited', 0, 'balance', v_bal);
  end if;
  if not public.dc_points_has_handle(p_wallet) then
    return jsonb_build_object('status', 'no_handle');
  end if;
  select coalesce(sum(delta), 0)::integer into v_today from public.dc_points_ledger
   where wallet = p_wallet and kind = 'referral' and game_day = v_day;
  if v_today + p_amount > p_daily_cap then
    insert into public.lot_referral_rewards (order_id, side, status, lot_id, referrer_lot, wallet, guest_wallet, same_block, amount, indexed_block, indexed_at, game_day, reason)
      values (p_order, p_side, 'review', p_lot, p_referrer_lot, p_wallet, p_guest_wallet, p_same_block, p_amount, p_indexed_block, p_indexed_at, v_day, 'daily ceiling');
    return jsonb_build_object('status', 'review', 'credited', 0, 'balance', v_bal);
  end if;
  v_credit := least(p_amount, greatest(0, 1000000 - v_bal));
  v_ref := 'referral:' || replace(p_order::text, '-', '') || ':' || p_side;
  perform set_config('dogcity.dc_points', 'on', true);
  insert into public.dc_points_ledger (wallet, kind, source, ref, requested, delta, game_day)
    values (p_wallet, 'referral', 'referral', v_ref, p_amount, v_credit, v_day)
    returning id, balance_after into v_ledger, v_after;
  perform set_config('dogcity.dc_points', 'off', true);
  insert into public.lot_referral_rewards (order_id, side, status, lot_id, referrer_lot, wallet, guest_wallet, same_block, amount, credited, indexed_block, indexed_at, ledger_id, game_day)
    values (p_order, p_side, 'credited', p_lot, p_referrer_lot, p_wallet, p_guest_wallet, p_same_block, p_amount, v_credit, p_indexed_block, p_indexed_at, v_ledger, v_day);
  if p_side = 'owner' then
    select count(*)::integer into v_n from public.lot_referral_rewards where wallet = p_wallet and side = 'owner' and status = 'credited';
    insert into public.lot_referral_items (wallet, item, lots_at_unlock, order_id)
      select p_wallet, t.item, v_n, p_order from (values ('quad', 3), ('jet', 10), ('m4', 25)) as t(item, need)
       where v_n >= t.need
    on conflict (wallet, item) do nothing;
  end if;
  return jsonb_build_object('status', 'ok', 'credited', v_credit, 'balance', v_after);
end;
$$;

-- o pedido inteiro recusado (própria carteira, próprio lote): grava e não volta mais
create or replace function public.lot_referral_reject(
  p_order uuid, p_lot text, p_referrer_lot text, p_guest_wallet text, p_reason text, p_indexed_block integer, p_indexed_at timestamptz
) returns jsonb
language plpgsql as $$
begin
  insert into public.lot_referral_rewards (order_id, side, status, lot_id, referrer_lot, guest_wallet, reason, indexed_block, indexed_at)
    values (p_order, 'order', 'rejected', p_lot, p_referrer_lot, p_guest_wallet, left(coalesce(p_reason, 'rejected'), 60), p_indexed_block, p_indexed_at)
  on conflict (order_id, side) do nothing;
  return jsonb_build_object('status', 'rejected');
end;
$$;

-- ── permissões: só o service role (as rotas do servidor) ──────────────────────
revoke all on table public.lot_referral_rewards from anon, authenticated;
revoke all on table public.lot_referral_items from anon, authenticated;
revoke all on function public.lot_referral_credit(uuid, text, text, integer, text, text, text, boolean, integer, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.lot_referral_reject(uuid, text, text, text, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.lot_referral_credit(uuid, text, text, integer, text, text, text, boolean, integer, timestamptz, integer) to service_role;
grant execute on function public.lot_referral_reject(uuid, text, text, text, text, integer, timestamptz) to service_role;

commit;
