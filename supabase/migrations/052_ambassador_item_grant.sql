-- Migration 052: concessão manual de item Ambassador Edition (27/11/2026), parte do bônus único de embaixador. NÃO APLICADA:
-- o maestro revisa e aplica. Depende da 043 (lot_referral_items) e da 042 (dc_points_norm_wallet, dc_points_has_handle).
-- A régua é a MESMA do contrato (/dogcity/docs#referrals): 3 conversões quad, 10 jet, 25 m4. O operador informa as conversões
-- equivalentes (p_lots) e uma nota; abaixo da régua a função LANÇA. Só acrescenta: nunca remove nem troca item.
-- O item concedido à mão é uma linha comum de lot_referral_items (order_id nulo, note e granted_by preenchidos): a rota
-- GET /api/dogcity/referral-items lê só (wallet, item), então o jogo não distingue de um item ganho por lotes.
-- Se a carteira ganhar o mesmo item depois por lotes de verdade, lot_referral_credit tenta inserir com 'on conflict do nothing':
-- sem erro e sem duplicar (chave primária wallet+item). Esta concessão não toca em lot_referral_rewards nem no livro de DC.
--
-- A chamada do operador:
--   select public.ambassador_item_grant_handle('@jdog', 'quad', 4, 'One-time ambassador bonus: 4 visitors reached the mint through the link');
-- Rodar de novo devolve status 'already'.

begin;

alter table public.lot_referral_items add column if not exists note text;
alter table public.lot_referral_items add column if not exists granted_by text;

create or replace function public.ambassador_item_grant(
  p_wallet text,
  p_item text,
  p_lots integer,
  p_note text
) returns jsonb
language plpgsql as $$
declare
  v_wallet text := public.dc_points_norm_wallet(p_wallet);
  v_note text := btrim(coalesce(p_note, ''));
  v_need integer;
  v_got text;
begin
  if v_wallet is null then raise exception 'ambassador_item_grant: bad wallet'; end if;
  v_need := case p_item when 'quad' then 3 when 'jet' then 10 when 'm4' then 25 else null end;
  if v_need is null then raise exception 'ambassador_item_grant: unknown item'; end if;
  if p_lots is null or p_lots < v_need then raise exception 'ambassador_item_grant: below the contract threshold'; end if;
  if length(v_note) < 1 or length(v_note) > 200 then raise exception 'ambassador_item_grant: a reason is required'; end if;
  if not public.dc_points_has_handle(v_wallet) then
    return jsonb_build_object('status', 'no_handle');
  end if;
  insert into public.lot_referral_items (wallet, item, lots_at_unlock, order_id, note, granted_by)
    values (v_wallet, p_item, p_lots, null, v_note, 'operator')
  on conflict (wallet, item) do nothing
  returning item into v_got;
  return jsonb_build_object(
    'status', case when v_got is null then 'already' else 'unlocked' end,
    'item', p_item,
    'wallet_short', left(v_wallet, 8) || '...' || right(v_wallet, 4)
  );
end;
$$;

create or replace function public.ambassador_item_grant_handle(
  p_handle text,
  p_item text,
  p_lots integer,
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
  return public.ambassador_item_grant(v_address, p_item, p_lots, p_note);
end;
$$;

revoke all on function public.ambassador_item_grant(text, text, integer, text) from public, anon, authenticated;
revoke all on function public.ambassador_item_grant_handle(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.ambassador_item_grant(text, text, integer, text) to service_role;
grant execute on function public.ambassador_item_grant_handle(text, text, integer, text) to service_role;

commit;
