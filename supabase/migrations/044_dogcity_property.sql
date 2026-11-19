-- Migration 044: a PROPRIEDADE UNIDA do jogo (desenho final do fundador, 19/11/2026). NÃO APLICADA.
--
-- O dono escolhe quais lotes vizinhos da carteira viram UM terreno no jogo ("Expand your house"). É opt-in, de graça e
-- só do JOGO: na cadeia cada lote segue a sua escritura e a sua licença (dogcity_licence_assignment, 037, intocada).
-- As regras estão em lib/dog/property-merge.ts; aqui só o registro e as duas trocas atômicas.
--
--   dogcity_property            uma linha por consolidação: carteira, lotes, âncora, estado, datas
--   dogcity_property_merge      consolida, se nenhum lote está numa propriedade ativa e nenhum participou de um evento
--                               voluntário nos últimos p_cooldown_days dias (o freio de 21 dias)
--   dogcity_property_dissolve   desfaz: 'voluntary' (o dono, com o freio) ou 'forced' (um lote saiu da carteira, sem freio)
--
-- Uma trava consultiva GLOBAL serializa as trocas (são raras: um clique de dono): duas consolidações ao mesmo tempo nunca
-- põem o mesmo lote em duas propriedades ativas. Lida e escrita SÓ pelas rotas do servidor (service role). RLS ligada,
-- ZERO políticas, como 033/034/036/037. Repo público: nenhum segredo aqui.
--
-- ORDEM SEGURA: o código cai em "lot merging is not open yet" sem esta tabela; aplicar antes ou depois do deploy não quebra nada.

create table if not exists public.dogcity_property (
  id uuid primary key default gen_random_uuid(),
  wallet text not null check (length(wallet) between 26 and 90),
  lots text[] not null check (cardinality(lots) between 2 and 12),
  anchor text not null check (anchor ~ '^S[0-9]{2}-Q[0-9]{2}-B[0-9]{3,5}-L[0-9]{3,5}$' and anchor !~ '^S08-'),
  state text not null default 'active' check (state in ('active', 'dissolved', 'dissolved_forced')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check ((state = 'active') = (ended_at is null)),
  check (anchor = lots[1])
);

create index if not exists dogcity_property_wallet_idx on public.dogcity_property (wallet);
create index if not exists dogcity_property_active_idx on public.dogcity_property (state) where state = 'active';
create index if not exists dogcity_property_lots_idx on public.dogcity_property using gin (lots);

alter table public.dogcity_property enable row level security;

-- só o estado e a data do fim mudam, e só de 'active' para um dos dois fins; os lotes e a carteira nunca
create or replace function public.dogcity_property_so_fim() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'dogcity_property: a property record is never removed';
  end if;
  if new.wallet <> old.wallet or new.lots <> old.lots or new.anchor <> old.anchor or new.created_at <> old.created_at then
    raise exception 'dogcity_property: only the state and the end date change';
  end if;
  if old.state <> 'active' then
    raise exception 'dogcity_property: a dissolved property stays dissolved';
  end if;
  return new;
end;
$$;

drop trigger if exists dogcity_property_so_fim on public.dogcity_property;
create trigger dogcity_property_so_fim
  before update or delete on public.dogcity_property
  for each row execute function public.dogcity_property_so_fim();

-- consolida: devolve o id, ou null quando o mundo mudou (lote já numa propriedade ativa, ou no freio)
create or replace function public.dogcity_property_merge(
  p_wallet text,
  p_lots text[],
  p_cooldown_days integer
) returns uuid
language plpgsql as $$
declare
  v_lots text[];
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('dogcity_property', 0));
  select array_agg(distinct l order by l) into v_lots from unnest(p_lots) as l;
  if exists (select 1 from public.dogcity_property where state = 'active' and lots && v_lots) then
    return null;
  end if;
  if exists (
    select 1 from public.dogcity_property
     where lots && v_lots
       and (created_at > now() - make_interval(days => p_cooldown_days)
            or (state = 'dissolved' and ended_at > now() - make_interval(days => p_cooldown_days)))
  ) then
    return null;
  end if;
  insert into public.dogcity_property (wallet, lots, anchor) values (p_wallet, v_lots, v_lots[1]) returning id into v_id;
  return v_id;
end;
$$;

-- desfaz: true = desfez; false = não estava ativa, não é da carteira, ou (voluntário) ainda no freio
create or replace function public.dogcity_property_dissolve(
  p_id uuid,
  p_wallet text,
  p_reason text,
  p_cooldown_days integer
) returns boolean
language plpgsql as $$
declare
  v public.dogcity_property%rowtype;
begin
  if p_reason not in ('voluntary', 'forced') then
    raise exception 'dogcity_property_dissolve: unknown reason %', p_reason;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('dogcity_property', 0));
  select * into v from public.dogcity_property where id = p_id for update;
  if not found or v.state <> 'active' or v.wallet <> p_wallet then
    return false;
  end if;
  if p_reason = 'voluntary' and (
    v.created_at > now() - make_interval(days => p_cooldown_days)
    or exists (
      select 1 from public.dogcity_property o
       where o.id <> v.id and o.lots && v.lots and o.state = 'dissolved'
         and o.ended_at > now() - make_interval(days => p_cooldown_days))
  ) then
    return false;
  end if;
  update public.dogcity_property
     set state = case when p_reason = 'forced' then 'dissolved_forced' else 'dissolved' end, ended_at = now()
   where id = p_id;
  return true;
end;
$$;

revoke all on table public.dogcity_property from anon, authenticated;
revoke all on function public.dogcity_property_merge(text, text[], integer) from public, anon, authenticated;
revoke all on function public.dogcity_property_dissolve(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.dogcity_property_merge(text, text[], integer) to service_role;
grant execute on function public.dogcity_property_dissolve(uuid, text, text, integer) to service_role;
