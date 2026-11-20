-- Migration 045: "Message the owner", a mensagem de texto de um jogador para o dono de um lote (pedido do fundador, 20/11/2026).
-- NÃO APLICADA.
--
-- É a coisa mais simples possível: texto puro, sem oferta, sem preço, sem negociação. Substitui a "lista telefônica": quem quer
-- falar com o vizinho deixa a mensagem no lote dele, sem ver telefone nem email de ninguém. As regras moram em
-- lib/dog/lot-message.ts e lib/dog/lot-message-service.ts; aqui só o registro e as duas trocas atômicas.
--
--   dogcity_lot_message        uma linha por mensagem: lote, remetente, destinatário (o dono NA HORA do envio, pelo mint),
--                              texto (1 a 500 caracteres), a conversa (thread_id) e a mensagem respondida (reply_to)
--   dogcity_lot_message_mute   quem o dono silenciou: as mensagens dessa carteira somem e não chegam mais
--   dogcity_lot_message_send   envia ou responde com os freios dentro da trava: 10 novas por dia por remetente, 1 por dia do
--                              mesmo remetente para o mesmo lote, e um teto de respostas por dia; silenciado não entra
--   dogcity_lot_message_mute_sender   silencia o remetente de uma mensagem recebida e some com as mensagens dele
--
-- A trava consultiva é POR REMETENTE: dois envios ao mesmo tempo da mesma carteira nunca furam o teto do dia.
-- Lida e escrita SÓ pelas rotas do servidor (service role). RLS ligada, ZERO políticas, como 033/034/036/037/044.
-- Repo público: nenhum segredo aqui, e nenhum endereço de carteira.
--
-- ORDEM SEGURA: sem estas tabelas as rotas respondem "Messages are not open yet" (503); aplicar antes ou depois do deploy não
-- quebra nada.

create table if not exists public.dogcity_lot_message (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  reply_to uuid references public.dogcity_lot_message (id),
  lot_id text not null check (lot_id ~ '^S[0-9]{2}-Q[0-9]{2}-B[0-9]{3,5}-L[0-9]{3,5}$'),
  from_wallet text not null check (length(from_wallet) between 26 and 90),
  to_wallet text not null check (length(to_wallet) between 26 and 90),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  deleted_at timestamptz,
  check (from_wallet <> to_wallet)
);

create index if not exists dogcity_lot_message_inbox_idx
  on public.dogcity_lot_message (to_wallet, created_at desc) where deleted_at is null;
create index if not exists dogcity_lot_message_sender_idx
  on public.dogcity_lot_message (from_wallet, created_at desc);
create index if not exists dogcity_lot_message_thread_idx
  on public.dogcity_lot_message (thread_id);

alter table public.dogcity_lot_message enable row level security;

create table if not exists public.dogcity_lot_message_mute (
  id uuid primary key default gen_random_uuid(),
  owner_wallet text not null check (length(owner_wallet) between 26 and 90),
  muted_wallet text not null check (length(muted_wallet) between 26 and 90),
  created_at timestamptz not null default now(),
  unique (owner_wallet, muted_wallet),
  check (owner_wallet <> muted_wallet)
);

alter table public.dogcity_lot_message_mute enable row level security;

-- o que foi escrito não muda: só a leitura (read_at) e o apagar do destinatário (deleted_at), e cada um só uma vez
create or replace function public.dogcity_lot_message_so_marcas() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'dogcity_lot_message: a message is never removed, only hidden';
  end if;
  if new.id <> old.id or new.thread_id <> old.thread_id or new.reply_to is distinct from old.reply_to or new.lot_id <> old.lot_id
     or new.from_wallet <> old.from_wallet or new.to_wallet <> old.to_wallet or new.body <> old.body
     or new.created_at <> old.created_at then
    raise exception 'dogcity_lot_message: only read_at and deleted_at change';
  end if;
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'dogcity_lot_message: read_at is set once';
  end if;
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'dogcity_lot_message: deleted_at is set once';
  end if;
  return new;
end;
$$;

drop trigger if exists dogcity_lot_message_so_marcas on public.dogcity_lot_message;
create trigger dogcity_lot_message_so_marcas
  before update or delete on public.dogcity_lot_message
  for each row execute function public.dogcity_lot_message_so_marcas();

-- Envia (p_reply_to null; p_to e p_lot obrigatórios: o dono pelo mint, conferido pela rota) ou responde (p_reply_to = uma mensagem
-- RECEBIDA por p_from e não apagada; o destinatário, o lote e a conversa saem dela, nunca do pedido).
-- Devolve: 'ok' | 'muted' (o destinatário silenciou p_from: nada entra, e a rota responde como se tivesse ido) | 'day_cap' |
-- 'lot_cap' | 'reply_cap' | 'not_found'
create or replace function public.dogcity_lot_message_send(
  p_from text,
  p_to text,
  p_lot text,
  p_body text,
  p_reply_to uuid,
  p_day_cap integer,
  p_reply_cap integer
) returns text
language plpgsql as $$
declare
  v_parent public.dogcity_lot_message%rowtype;
  v_to text;
  v_lot text;
  v_thread uuid;
  v_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtextextended('dogcity_lot_message:' || p_from, 0));
  if p_reply_to is null then
    if p_to is null or p_lot is null then
      raise exception 'dogcity_lot_message_send: a new message needs the owner and the lot';
    end if;
    if (select count(*) from public.dogcity_lot_message
         where from_wallet = p_from and reply_to is null and created_at > now() - interval '1 day') >= p_day_cap then
      return 'day_cap';
    end if;
    if exists (select 1 from public.dogcity_lot_message
                where from_wallet = p_from and lot_id = p_lot and reply_to is null and created_at > now() - interval '1 day') then
      return 'lot_cap';
    end if;
    v_to := p_to;
    v_lot := p_lot;
    v_thread := v_id;
  else
    select * into v_parent from public.dogcity_lot_message
     where id = p_reply_to and to_wallet = p_from and deleted_at is null;
    if not found then
      return 'not_found';
    end if;
    if (select count(*) from public.dogcity_lot_message
         where from_wallet = p_from and reply_to is not null and created_at > now() - interval '1 day') >= p_reply_cap then
      return 'reply_cap';
    end if;
    v_to := v_parent.from_wallet;
    v_lot := v_parent.lot_id;
    v_thread := v_parent.thread_id;
  end if;
  if exists (select 1 from public.dogcity_lot_message_mute where owner_wallet = v_to and muted_wallet = p_from) then
    return 'muted';
  end if;
  insert into public.dogcity_lot_message (id, thread_id, reply_to, lot_id, from_wallet, to_wallet, body)
  values (v_id, v_thread, p_reply_to, v_lot, p_from, v_to, p_body);
  return 'ok';
end;
$$;

-- Silencia o remetente de uma mensagem que p_owner recebeu: registra o silêncio e esconde as mensagens dele na caixa de p_owner.
-- false = a mensagem não existe ou não é de p_owner.
create or replace function public.dogcity_lot_message_mute_sender(
  p_owner text,
  p_message uuid
) returns boolean
language plpgsql as $$
declare
  v_from text;
begin
  select from_wallet into v_from from public.dogcity_lot_message where id = p_message and to_wallet = p_owner;
  if not found then
    return false;
  end if;
  insert into public.dogcity_lot_message_mute (owner_wallet, muted_wallet) values (p_owner, v_from)
  on conflict (owner_wallet, muted_wallet) do nothing;
  update public.dogcity_lot_message set deleted_at = now()
   where to_wallet = p_owner and from_wallet = v_from and deleted_at is null;
  return true;
end;
$$;

revoke all on table public.dogcity_lot_message from anon, authenticated;
revoke all on table public.dogcity_lot_message_mute from anon, authenticated;
revoke all on function public.dogcity_lot_message_send(text, text, text, text, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.dogcity_lot_message_mute_sender(text, uuid) from public, anon, authenticated;
grant execute on function public.dogcity_lot_message_send(text, text, text, text, uuid, integer, integer) to service_role;
grant execute on function public.dogcity_lot_message_mute_sender(text, uuid) to service_role;
