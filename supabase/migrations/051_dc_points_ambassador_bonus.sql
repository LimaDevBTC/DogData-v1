-- Migration 051: bônus único de embaixador em DC Points, concedido pelo OPERADOR (27/11/2026). NÃO APLICADA: o fundador cola no SQL
-- Editor (o script roda inteiro numa transação; trocar uma check constraint exige soltar a antiga, por isso há comandos de remover constraint, listados no PR).
-- Depende da 042 (livro dc_points_*), da 043 (kind 'referral') e da 050 (ranking, só lido; nada muda nele).
--
-- O QUE É: antes de o registro de indicações funcionar, embaixadores trouxeram visitas que não viraram lançamento. O fundador quer
-- reconhecer isso UMA vez, a mão, com valores aprovados por ele, para cerca de 15 carteiras. Não é ganho automático, não é a regra
-- pública de 500 DC por lote mintado (essa continua valendo igual): é uma exceção do operador.
--
-- O LIVRO passa a aceitar um lançamento de bônus:
--   kind 'referral', source 'bonus', ref 'bonus:<slug>' (slug [a-z0-9_-]{3,48}, ex.: bonus:traffic-2026-11), nota obrigatória (o
--   motivo, 1 a 200 caracteres), requested = delta, de 1 a 5.000 por linha. Uma carteira recebe cada slug UMA vez: a unicidade
--   (wallet, ref) que a 042 já garante no livro. Fora do teto diário de ganho (480, só soma kind 'earn') e fora do teto diário de
--   indicação (5.000, lot_referral_credit): esta migração reescreve essa função só para o bônus não entrar na soma do teto.
--   Como o kind continua 'referral', o bônus entra sozinho no quadro Ambassador e no Total do ranking (050 não filtra source).
--
-- NÃO MUDA NADA ALÉM DISSO. As três checks da 043 são recriadas com as MESMAS regras, só acrescentando o caso do bônus:
--   * kind_check: igual.
--   * ref_check: igual + a alternativa bonus:<slug>.
--   * kinds_check: os cinco ramos antigos iguais; o ramo referral (1 a 1000) ganha `source <> 'bonus'` e há um ramo novo, do bônus.
--   * uma quarta check, dc_points_ledger_bonus_ref_check, amarra o ref 'bonus:' ao par (referral, bonus): nenhum earn, spend, car,
--     migration ou refund consegue usar esse ref, e nenhum bônus consegue outro ref.
--
-- ITENS AMBASSADOR EDITION (quad com 3 lotes, jet com 10, M4 com 25): este bônus NÃO desbloqueia item e NÃO cria recompensa de lote.
-- O desbloqueio conta linhas de lot_referral_rewards (side 'owner', status 'credited'), e aqui nada é gravado nessa tabela:
-- inventar pedidos falsos mentiria sobre o que foi mintado. Se o fundador quiser dar um item a um embaixador, é outra função
-- (descrita no PR, não incluída aqui).
--
-- COMO CONCEDER (SQL Editor, uma linha por embaixador, depois de aplicar esta migração; sem palavra destrutiva):
--   select public.dc_points_ambassador_bonus_handle('@handle', 1000, 'traffic-2026-11', 'One-time bonus for ambassador link traffic');
-- Rodar de novo a mesma linha não paga duas vezes (devolve status 'already').

begin;

-- a 043 tem de estar aplicada (o tipo referral): sem ela, parar aqui sem mudar nada
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.dc_points_ledger'::regclass and conname = 'dc_points_ledger_kinds_check'
       and pg_get_constraintdef(oid) like '%referral%'
  ) then
    raise exception '051: apply 043 first (the referral kind is missing from the ledger)';
  end if;
end
$$;

-- ── o livro aceita o bônus: as três checks trocadas dentro desta mesma transação (sem janela sem regra) ─────────
alter table public.dc_points_ledger drop constraint if exists dc_points_ledger_kind_check;
alter table public.dc_points_ledger drop constraint if exists dc_points_ledger_ref_check;
alter table public.dc_points_ledger drop constraint if exists dc_points_ledger_kinds_check;
alter table public.dc_points_ledger drop constraint if exists dc_points_ledger_bonus_ref_check;

alter table public.dc_points_ledger add constraint dc_points_ledger_kind_check
  check (kind in ('earn', 'spend', 'car', 'migration', 'refund', 'referral'));
alter table public.dc_points_ledger add constraint dc_points_ledger_ref_check
  check (ref ~ '^((earn|spend|car):[A-Za-z0-9_-]{8,64}|checkin:[0-9]{4}-[0-9]{2}-[0-9]{2}|once:[a-z][a-z0-9_]{1,31}|migration|refund:[A-Za-z0-9_-]{1,64}|referral:[0-9a-f]{32}:(owner|guest)|bonus:[a-z0-9_-]{3,48})$');
alter table public.dc_points_ledger add constraint dc_points_ledger_kinds_check
  check (
    (kind = 'earn' and requested between 1 and 10000 and delta between 0 and requested)
    or (kind = 'spend' and delta between -10000 and -1 and requested = -delta and item is not null and qty is not null and unit_price is not null)
    or (kind = 'car' and delta between -250000 and -1 and requested = -delta and item is not null)
    or (kind = 'migration' and delta between 1 and 1000000 and requested >= delta)
    or (kind = 'refund' and delta between 1 and 250000 and requested = delta and note is not null)
    or (kind = 'referral' and source <> 'bonus' and requested between 1 and 1000 and delta between 0 and requested)
    or (kind = 'referral' and source = 'bonus' and requested between 1 and 5000 and delta = requested and note is not null)
  );
-- o ref 'bonus:' é só do bônus, e o bônus só usa esse ref
alter table public.dc_points_ledger add constraint dc_points_ledger_bonus_ref_check
  check ((ref like 'bonus:%') = (kind = 'referral' and source = 'bonus'));

-- ── o teto diário de indicação (5.000) não conta o bônus: a função da 043, igual, com `source <> 'bonus'` na soma ──
create or replace function public.lot_referral_credit(
  p_order uuid,
  p_side text,
  p_wallet text,
  p_amount integer,
  p_lot text,
  p_referrer_lot text,
  p_referrer_handle text,
  p_referrer_wallet text,
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
  v_ref_handle text;
begin
  if p_side not in ('owner', 'guest') then raise exception 'lot_referral_credit: bad side'; end if;
  if p_referrer_lot is null and p_referrer_handle is null then raise exception 'lot_referral_credit: no referrer'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000 then raise exception 'lot_referral_credit: bad amount'; end if;
  if p_daily_cap is null or p_daily_cap < 1 or p_daily_cap > 5000 then raise exception 'lot_referral_credit: bad cap'; end if;
  v_bal := public.dc_points_open(p_wallet);  -- trava a carteira e garante a linha dela
  select * into v_done from public.lot_referral_rewards where order_id = p_order and side = p_side;
  if found then
    return jsonb_build_object('status', 'duplicate', 'credited', v_done.credited, 'balance', v_bal);
  end if;
  if p_side = 'guest' and exists (select 1 from public.lot_referral_rewards where wallet = p_wallet and side = 'guest' and status = 'credited') then
    insert into public.lot_referral_rewards (order_id, side, status, lot_id, referrer_lot, referrer_handle, wallet, guest_wallet, same_block, amount, indexed_block, indexed_at, game_day, reason)
      values (p_order, p_side, 'guest_taken', p_lot, p_referrer_lot, p_referrer_handle, p_wallet, p_guest_wallet, p_same_block, p_amount, p_indexed_block, p_indexed_at, v_day, 'welcome already paid');
    return jsonb_build_object('status', 'guest_taken', 'credited', 0, 'balance', v_bal);
  end if;
  if not public.dc_points_has_handle(p_wallet) then
    return jsonb_build_object('status', 'no_handle');
  end if;
  select coalesce(sum(delta), 0)::integer into v_today from public.dc_points_ledger
   where wallet = p_wallet and kind = 'referral' and source <> 'bonus' and game_day = v_day;
  if v_today + p_amount > p_daily_cap then
    insert into public.lot_referral_rewards (order_id, side, status, lot_id, referrer_lot, referrer_handle, wallet, guest_wallet, same_block, amount, indexed_block, indexed_at, game_day, reason)
      values (p_order, p_side, 'review', p_lot, p_referrer_lot, p_referrer_handle, p_wallet, p_guest_wallet, p_same_block, p_amount, p_indexed_block, p_indexed_at, v_day, 'daily ceiling');
    return jsonb_build_object('status', 'review', 'credited', 0, 'balance', v_bal);
  end if;
  v_credit := least(p_amount, greatest(0, 1000000 - v_bal));
  v_ref := 'referral:' || replace(p_order::text, '-', '') || ':' || p_side;
  perform set_config('dogcity.dc_points', 'on', true);
  insert into public.dc_points_ledger (wallet, kind, source, ref, requested, delta, game_day)
    values (p_wallet, 'referral', 'referral', v_ref, p_amount, v_credit, v_day)
    returning id, balance_after into v_ledger, v_after;
  perform set_config('dogcity.dc_points', 'off', true);
  insert into public.lot_referral_rewards (order_id, side, status, lot_id, referrer_lot, referrer_handle, wallet, guest_wallet, same_block, amount, credited, indexed_block, indexed_at, ledger_id, game_day)
    values (p_order, p_side, 'credited', p_lot, p_referrer_lot, p_referrer_handle, p_wallet, p_guest_wallet, p_same_block, p_amount, v_credit, p_indexed_block, p_indexed_at, v_ledger, v_day);
  -- o vínculo do indicado ao indicador (a mesma tabela do programa do perfil, 035): um indicador por carteira, o primeiro vence
  -- (chave primária + gatilho de só-inserir), então 'do nothing' mantém o primeiro. Sem handle do indicador, não grava.
  select handle into v_ref_handle from public.dogcity_profiles where address = lower(p_referrer_wallet);
  if v_ref_handle is not null and lower(p_guest_wallet) <> lower(p_referrer_wallet) then
    insert into public.referral_links (referred_address, referrer_address, referrer_handle)
      values (p_guest_wallet, p_referrer_wallet, v_ref_handle)
    on conflict (referred_address) do nothing;
  end if;
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

-- ── o bônus por carteira ────────────────────────────────────────────────────────────────────────────────────────
-- Devolve { status: 'credited' | 'already' | 'no_handle' | 'balance_cap', credited, balance, ledger_id }.
--   no_handle: a carteira não tem handle (a mesma exigência de quem acumula); NADA é gravado, nem a linha da carteira.
--   already: a carteira já recebeu este slug; nada é gravado, devolve o que foi pago na primeira vez.
--   balance_cap: o saldo passaria de 1.000.000; nada é gravado (o bônus é inteiro ou nada).
-- LANÇA em carteira malformada, valor fora de 1 a 5.000, slug fora de [a-z0-9_-]{3,48} ou nota vazia (mais de 200).
create or replace function public.dc_points_ambassador_bonus(
  p_wallet text,
  p_amount integer,
  p_slug text,
  p_note text
) returns jsonb
language plpgsql as $$
declare
  v_wallet text := public.dc_points_norm_wallet(p_wallet);
  v_ref text;
  v_note text := btrim(coalesce(p_note, ''));
  v_bal integer;
  v_done public.dc_points_ledger%rowtype;
  v_ledger bigint;
  v_after integer;
begin
  if v_wallet is null then raise exception 'dc_points_ambassador_bonus: bad wallet'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 5000 then raise exception 'dc_points_ambassador_bonus: bad amount'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9_-]{3,48}$' then raise exception 'dc_points_ambassador_bonus: bad slug'; end if;
  if length(v_note) < 1 or length(v_note) > 200 then raise exception 'dc_points_ambassador_bonus: a reason is required'; end if;
  if not public.dc_points_has_handle(v_wallet) then
    return jsonb_build_object('status', 'no_handle');
  end if;
  v_ref := 'bonus:' || p_slug;
  v_bal := public.dc_points_open(v_wallet);  -- trava a carteira e garante a linha dela
  select * into v_done from public.dc_points_ledger where wallet = v_wallet and ref = v_ref;
  if found then
    return jsonb_build_object('status', 'already', 'credited', v_done.delta, 'balance', v_bal, 'ledger_id', v_done.id);
  end if;
  if v_bal + p_amount > 1000000 then
    return jsonb_build_object('status', 'balance_cap', 'credited', 0, 'balance', v_bal);
  end if;
  perform set_config('dogcity.dc_points', 'on', true);
  insert into public.dc_points_ledger (wallet, kind, source, ref, requested, delta, note)
    values (v_wallet, 'referral', 'bonus', v_ref, p_amount, p_amount, v_note)
    returning id, balance_after into v_ledger, v_after;
  perform set_config('dogcity.dc_points', 'off', true);
  return jsonb_build_object('status', 'credited', 'credited', p_amount, 'balance', v_after, 'ledger_id', v_ledger);
end;
$$;

-- o mesmo, pelo @handle (com ou sem @, sem distinguir maiúsculas). Handle sem perfil: { status: 'no_profile' }.
-- O perfil guarda o endereço em minúsculas: só endereços bech32 (bc1...) voltam à carteira do livro sem perda; outro formato
-- devolve { status: 'unsupported_address' } e nada é gravado.
create or replace function public.dc_points_ambassador_bonus_handle(
  p_handle text,
  p_amount integer,
  p_slug text,
  p_note text
) returns jsonb
language plpgsql as $$
declare
  v_handle text := lower(regexp_replace(btrim(coalesce(p_handle, '')), '^@', ''));
  v_address text;
begin
  if v_handle !~ '^[a-z0-9_]{3,15}$' then
    return jsonb_build_object('status', 'no_profile');
  end if;
  select address into v_address from public.dogcity_profiles where lower(handle) = v_handle;
  if v_address is null then
    return jsonb_build_object('status', 'no_profile');
  end if;
  if v_address !~ '^bc1' then
    return jsonb_build_object('status', 'unsupported_address');
  end if;
  return public.dc_points_ambassador_bonus(v_address, p_amount, p_slug, p_note);
end;
$$;

-- ── permissões: o mesmo fecho das outras dc_points_* ──────────────────────────────────────────────────────────
revoke all on function public.lot_referral_credit(uuid, text, text, integer, text, text, text, text, text, boolean, integer, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.lot_referral_credit(uuid, text, text, integer, text, text, text, text, text, boolean, integer, timestamptz, integer) to service_role;
revoke all on function public.dc_points_ambassador_bonus(text, integer, text, text) from public, anon, authenticated;
revoke all on function public.dc_points_ambassador_bonus_handle(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.dc_points_ambassador_bonus(text, integer, text, text) to service_role;
grant execute on function public.dc_points_ambassador_bonus_handle(text, integer, text, text) to service_role;

commit;
