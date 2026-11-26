-- Migration 046: DOG Phone, o app Mensagens do celular do jogo (22/11/2026). NÃO APLICADA.
--
-- Conversa privada 1:1 em texto entre duas contas que se aceitaram. O fluxo é buscar @handle -> pedir -> aceitar -> conversar:
-- antes do aceite não existe envio. As regras moram AQUI, em funções atômicas (uma trava consultiva por conta), e o
-- TypeScript (lib/phone/) só valida a entrada, resolve a sessão e traduz a resposta. Assim o teste roda o MESMO SQL
-- (lib/phone/phone.sql.test.ts, com PGlite) e não uma imitação em memória.
--
--   dogcity_phone_account      a conta do celular: o ID INTERNO (uuid) é a identidade permanente. Hoje nasce da carteira
--                              da sessão assinada (address); x_id fica reservado para a conta que entra pelo X sem carteira.
--                              O @handle NÃO mora aqui: é lido de dogcity_profiles na hora, então trocar o handle não perde
--                              conversa, e duas contas nunca são fundidas por nome parecido
--   dogcity_phone_link         o vínculo de um par (a < b): pending, friends ou declined, e quem pediu
--   dogcity_phone_request_log  um registro por pedido enviado (o teto por dia)
--   dogcity_phone_block        quem bloqueou quem: bloqueio desfaz o vínculo e impede pedido e mensagem novos
--   dogcity_phone_mute         silêncio: as mensagens chegam, mas não contam no selo
--   dogcity_phone_message      a mensagem (1 a 500 caracteres), com o `cid` do cliente para o reenvio não duplicar
--   dogcity_phone_read         até onde cada um leu a conversa com o outro
--   dogcity_phone_report       denúncia, com os ids das últimas mensagens do par como contexto
--
-- Lida e escrita SÓ pelas rotas do servidor (service role). RLS ligada, ZERO políticas, como 033/034/036/037/044/045.
-- Repo público: nenhum segredo aqui, e nenhum endereço de carteira.
--
-- ORDEM SEGURA: sem estas tabelas as rotas respondem "Messages are not open yet" (503); aplicar antes ou depois do deploy
-- não quebra nada.

-- a foto do perfil já existe em produção (app/api/profile/avatar); o `if not exists` só protege um banco novo
alter table public.dogcity_profiles add column if not exists avatar_inscription_id text;

create table if not exists public.dogcity_phone_account (
  id uuid primary key default gen_random_uuid(),
  address text unique check (address is null or length(address) between 26 and 90),
  x_id text unique check (x_id is null or x_id ~ '^[0-9]{1,24}$'),
  created_at timestamptz not null default now(),
  check (address is not null or x_id is not null)
);

create table if not exists public.dogcity_phone_link (
  a uuid not null references public.dogcity_phone_account (id),
  b uuid not null references public.dogcity_phone_account (id),
  state text not null check (state in ('pending', 'friends', 'declined')),
  requester uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b),
  check (requester in (a, b))
);
create index if not exists dogcity_phone_link_b_idx on public.dogcity_phone_link (b);

create table if not exists public.dogcity_phone_request_log (
  requester uuid not null,
  target uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists dogcity_phone_request_log_idx on public.dogcity_phone_request_log (requester, created_at desc);

create table if not exists public.dogcity_phone_block (
  blocker uuid not null references public.dogcity_phone_account (id),
  blocked uuid not null references public.dogcity_phone_account (id),
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists dogcity_phone_block_blocked_idx on public.dogcity_phone_block (blocked);

create table if not exists public.dogcity_phone_mute (
  owner uuid not null references public.dogcity_phone_account (id),
  other uuid not null references public.dogcity_phone_account (id),
  created_at timestamptz not null default now(),
  primary key (owner, other),
  check (owner <> other)
);

create table if not exists public.dogcity_phone_message (
  id bigint generated always as identity primary key,
  a uuid not null,
  b uuid not null,
  sender uuid not null,
  body text not null check (char_length(body) between 1 and 500),
  cid text not null check (cid ~ '^[A-Za-z0-9_-]{8,40}$'),
  created_at timestamptz not null default now(),
  check (a < b),
  check (sender in (a, b)),
  unique (sender, cid)
);
create index if not exists dogcity_phone_message_pair_idx on public.dogcity_phone_message (a, b, id desc);
create index if not exists dogcity_phone_message_sender_idx on public.dogcity_phone_message (sender, created_at desc);

create table if not exists public.dogcity_phone_read (
  owner uuid not null,
  other uuid not null,
  last_id bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner, other)
);

create table if not exists public.dogcity_phone_report (
  id bigint generated always as identity primary key,
  reporter uuid not null,
  reported uuid not null,
  reason text not null default '' check (char_length(reason) <= 300),
  context jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists dogcity_phone_report_idx on public.dogcity_phone_report (reporter, created_at desc);

alter table public.dogcity_phone_account enable row level security;
alter table public.dogcity_phone_link enable row level security;
alter table public.dogcity_phone_request_log enable row level security;
alter table public.dogcity_phone_block enable row level security;
alter table public.dogcity_phone_mute enable row level security;
alter table public.dogcity_phone_message enable row level security;
alter table public.dogcity_phone_read enable row level security;
alter table public.dogcity_phone_report enable row level security;

-- a trava por conta: dois pedidos ao mesmo tempo da mesma conta nunca furam um teto
create or replace function public.dogcity_phone_lock(p_id uuid) returns void
language sql as $$
  select pg_advisory_xact_lock(hashtextextended('dogphone:' || p_id::text, 0));
$$;

-- a conta da carteira da sessão (cria na primeira vez que o celular é usado, ou quando alguém a convida pelo handle)
create or replace function public.dogcity_phone_account_of(p_address text, p_create boolean) returns uuid
language plpgsql as $$
declare
  v uuid;
begin
  select id into v from public.dogcity_phone_account where address = p_address;
  if v is null and p_create then
    insert into public.dogcity_phone_account (address) values (p_address)
      on conflict (address) do nothing returning id into v;
    if v is null then
      select id into v from public.dogcity_phone_account where address = p_address;
    end if;
  end if;
  return v;
end;
$$;

-- o cartão público de uma conta: id, handle e foto. NUNCA o endereço
create or replace function public.dogcity_phone_card(p_id uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', a.id, 'handle', p.handle, 'avatar', p.avatar_inscription_id)
  from public.dogcity_phone_account a
  left join public.dogcity_profiles p on p.address = a.address
  where a.id = p_id;
$$;

create or replace function public.dogcity_phone_is_friend(p_x uuid, p_y uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.dogcity_phone_link
    where a = least(p_x, p_y) and b = greatest(p_x, p_y) and state = 'friends'
  );
$$;

-- busca pelo handle EXATO. Quem me bloqueou não aparece (a busca não revela o bloqueio)
create or replace function public.dogcity_phone_search(p_me uuid, p_handle text) returns jsonb
language plpgsql stable as $$
declare
  v_addr text;
  v_handle text;
  v_avatar text;
  v_other uuid;
  v_state text;
  v_requester uuid;
  v_rel text := 'none';
begin
  select address, handle, avatar_inscription_id into v_addr, v_handle, v_avatar
    from public.dogcity_profiles where handle = p_handle;
  if v_addr is null then
    return jsonb_build_object('found', false);
  end if;
  select id into v_other from public.dogcity_phone_account where address = v_addr;
  if v_other is not null then
    if v_other = p_me then
      v_rel := 'self';
    elsif exists (select 1 from public.dogcity_phone_block where blocker = v_other and blocked = p_me) then
      return jsonb_build_object('found', false);
    elsif exists (select 1 from public.dogcity_phone_block where blocker = p_me and blocked = v_other) then
      v_rel := 'blocked';
    else
      select state, requester into v_state, v_requester from public.dogcity_phone_link
        where a = least(p_me, v_other) and b = greatest(p_me, v_other);
      if v_state = 'friends' then
        v_rel := 'friends';
      elsif v_state = 'pending' then
        v_rel := case when v_requester = p_me then 'outgoing' else 'incoming' end;
      end if;
    end if;
  end if;
  return jsonb_build_object('found', true, 'handle', v_handle, 'avatar', v_avatar, 'relation', v_rel, 'id', v_other);
end;
$$;

-- pedido de amizade pelo handle. Se o outro já tinha pedido, vira amizade na hora
create or replace function public.dogcity_phone_request(
  p_me uuid, p_handle text, p_cap_pending int, p_cap_day int, p_cooldown_days int
) returns jsonb
language plpgsql as $$
declare
  v_addr text;
  v_other uuid;
  v_a uuid;
  v_b uuid;
  v_state text;
  v_requester uuid;
  v_updated timestamptz;
begin
  perform public.dogcity_phone_lock(p_me);
  select address into v_addr from public.dogcity_profiles where handle = p_handle;
  if v_addr is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  v_other := public.dogcity_phone_account_of(v_addr, true);
  if v_other = p_me then
    return jsonb_build_object('status', 'self');
  end if;
  if exists (select 1 from public.dogcity_phone_block where blocker = v_other and blocked = p_me) then
    return jsonb_build_object('status', 'not_found');
  end if;
  if exists (select 1 from public.dogcity_phone_block where blocker = p_me and blocked = v_other) then
    return jsonb_build_object('status', 'blocked');
  end if;
  v_a := least(p_me, v_other);
  v_b := greatest(p_me, v_other);
  select state, requester, updated_at into v_state, v_requester, v_updated
    from public.dogcity_phone_link where a = v_a and b = v_b for update;
  if v_state = 'friends' then
    return jsonb_build_object('status', 'already', 'id', v_other);
  elsif v_state = 'pending' and v_requester = p_me then
    return jsonb_build_object('status', 'requested', 'id', v_other);
  elsif v_state = 'pending' then
    update public.dogcity_phone_link set state = 'friends', updated_at = now() where a = v_a and b = v_b;
    return jsonb_build_object('status', 'accepted', 'id', v_other);
  elsif v_state = 'declined' and v_requester = p_me and v_updated > now() - make_interval(days => p_cooldown_days) then
    return jsonb_build_object('status', 'cooldown');
  end if;
  if (select count(*) from public.dogcity_phone_link where requester = p_me and state = 'pending') >= p_cap_pending then
    return jsonb_build_object('status', 'cap_pending');
  end if;
  if (select count(*) from public.dogcity_phone_request_log
        where requester = p_me and created_at > now() - interval '1 day') >= p_cap_day then
    return jsonb_build_object('status', 'cap_day');
  end if;
  insert into public.dogcity_phone_link (a, b, state, requester) values (v_a, v_b, 'pending', p_me)
    on conflict (a, b) do update set state = 'pending', requester = p_me, updated_at = now();
  insert into public.dogcity_phone_request_log (requester, target) values (p_me, v_other);
  return jsonb_build_object('status', 'requested', 'id', v_other);
end;
$$;

-- aceitar ou recusar um pedido RECEBIDO (quem pediu não aceita o próprio pedido)
create or replace function public.dogcity_phone_respond(p_me uuid, p_other uuid, p_accept boolean) returns text
language plpgsql as $$
declare
  v_n int;
begin
  perform public.dogcity_phone_lock(p_me);
  update public.dogcity_phone_link
    set state = case when p_accept then 'friends' else 'declined' end, updated_at = now()
    where a = least(p_me, p_other) and b = greatest(p_me, p_other) and state = 'pending' and requester = p_other;
  get diagnostics v_n = row_count;
  return case when v_n = 1 then 'ok' else 'not_found' end;
end;
$$;

-- cancelar um pedido ENVIADO
create or replace function public.dogcity_phone_cancel(p_me uuid, p_other uuid) returns text
language plpgsql as $$
declare
  v_n int;
begin
  perform public.dogcity_phone_lock(p_me);
  delete from public.dogcity_phone_link
    where a = least(p_me, p_other) and b = greatest(p_me, p_other) and state = 'pending' and requester = p_me;
  get diagnostics v_n = row_count;
  return case when v_n = 1 then 'ok' else 'not_found' end;
end;
$$;

-- desfazer a amizade (as mensagens ficam guardadas; sem vínculo ninguém as lê)
create or replace function public.dogcity_phone_remove(p_me uuid, p_other uuid) returns text
language plpgsql as $$
declare
  v_n int;
begin
  perform public.dogcity_phone_lock(p_me);
  delete from public.dogcity_phone_link
    where a = least(p_me, p_other) and b = greatest(p_me, p_other) and state = 'friends';
  get diagnostics v_n = row_count;
  return case when v_n = 1 then 'ok' else 'not_found' end;
end;
$$;

-- bloquear desfaz o vínculo (pedido ou amizade); desbloquear não o refaz
create or replace function public.dogcity_phone_block_set(p_me uuid, p_other uuid, p_on boolean) returns text
language plpgsql as $$
begin
  if p_me = p_other or not exists (select 1 from public.dogcity_phone_account where id = p_other) then
    return 'not_found';
  end if;
  perform public.dogcity_phone_lock(p_me);
  if p_on then
    insert into public.dogcity_phone_block (blocker, blocked) values (p_me, p_other) on conflict do nothing;
    delete from public.dogcity_phone_link where a = least(p_me, p_other) and b = greatest(p_me, p_other);
  else
    delete from public.dogcity_phone_block where blocker = p_me and blocked = p_other;
  end if;
  return 'ok';
end;
$$;

create or replace function public.dogcity_phone_mute_set(p_me uuid, p_other uuid, p_on boolean) returns text
language plpgsql as $$
begin
  if not public.dogcity_phone_is_friend(p_me, p_other) then
    return 'not_found';
  end if;
  if p_on then
    insert into public.dogcity_phone_mute (owner, other) values (p_me, p_other) on conflict do nothing;
  else
    delete from public.dogcity_phone_mute where owner = p_me and other = p_other;
  end if;
  return 'ok';
end;
$$;

-- denúncia: só de quem tem ou teve conversa ou pedido com a conta denunciada; guarda os ids das últimas mensagens do par
create or replace function public.dogcity_phone_report_add(p_me uuid, p_other uuid, p_reason text, p_cap_day int) returns text
language plpgsql as $$
declare
  v_ctx jsonb;
begin
  perform public.dogcity_phone_lock(p_me);
  if p_me = p_other
     or not (exists (select 1 from public.dogcity_phone_link where a = least(p_me, p_other) and b = greatest(p_me, p_other))
          or exists (select 1 from public.dogcity_phone_message where a = least(p_me, p_other) and b = greatest(p_me, p_other))) then
    return 'not_found';
  end if;
  if (select count(*) from public.dogcity_phone_report
        where reporter = p_me and created_at > now() - interval '1 day') >= p_cap_day then
    return 'cap';
  end if;
  select coalesce(jsonb_agg(m.id order by m.id desc), '[]'::jsonb) into v_ctx from (
    select id from public.dogcity_phone_message
      where a = least(p_me, p_other) and b = greatest(p_me, p_other) order by id desc limit 20
  ) m;
  insert into public.dogcity_phone_report (reporter, reported, reason, context) values (p_me, p_other, coalesce(p_reason, ''), v_ctx);
  return 'ok';
end;
$$;

-- enviar: só entre amigos, sem bloqueio, com teto por minuto; o mesmo cid devolve a mesma mensagem (reenvio depois de reconectar)
create or replace function public.dogcity_phone_send(p_me uuid, p_other uuid, p_body text, p_cid text, p_cap_min int) returns jsonb
language plpgsql as $$
declare
  v_a uuid := least(p_me, p_other);
  v_b uuid := greatest(p_me, p_other);
  v_row public.dogcity_phone_message%rowtype;
begin
  perform public.dogcity_phone_lock(p_me);
  select * into v_row from public.dogcity_phone_message where sender = p_me and cid = p_cid;
  if found then
    if v_row.a <> v_a or v_row.b <> v_b then
      return jsonb_build_object('status', 'invalid');
    end if;
    return jsonb_build_object('status', 'ok', 'dup', true, 'message',
      jsonb_build_object('id', v_row.id, 'sender', v_row.sender, 'text', v_row.body, 'at', v_row.created_at));
  end if;
  if not public.dogcity_phone_is_friend(p_me, p_other)
     or exists (select 1 from public.dogcity_phone_block
                 where (blocker = p_me and blocked = p_other) or (blocker = p_other and blocked = p_me)) then
    return jsonb_build_object('status', 'not_friends');
  end if;
  if (select count(*) from public.dogcity_phone_message
        where sender = p_me and created_at > now() - interval '1 minute') >= p_cap_min then
    return jsonb_build_object('status', 'rate');
  end if;
  insert into public.dogcity_phone_message (a, b, sender, body, cid) values (v_a, v_b, p_me, p_body, p_cid) returning * into v_row;
  -- quem escreve leu a conversa até aqui
  insert into public.dogcity_phone_read (owner, other, last_id) values (p_me, p_other, v_row.id)
    on conflict (owner, other) do update set last_id = greatest(public.dogcity_phone_read.last_id, excluded.last_id), updated_at = now();
  return jsonb_build_object('status', 'ok', 'dup', false, 'message',
    jsonb_build_object('id', v_row.id, 'sender', v_row.sender, 'text', v_row.body, 'at', v_row.created_at));
end;
$$;

-- o histórico de UMA conversa, do mais novo para o mais velho, paginado por id. Só para quem é do par e é amigo
create or replace function public.dogcity_phone_history(p_me uuid, p_other uuid, p_before bigint, p_limit int) returns jsonb
language plpgsql stable as $$
declare
  v_a uuid := least(p_me, p_other);
  v_b uuid := greatest(p_me, p_other);
  v_msgs jsonb;
begin
  if not public.dogcity_phone_is_friend(p_me, p_other) then
    return jsonb_build_object('status', 'not_friends');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'text', m.body, 'at', m.created_at) order by m.id desc), '[]'::jsonb)
    into v_msgs from (
      select id, sender, body, created_at from public.dogcity_phone_message
        where a = v_a and b = v_b and (p_before is null or id < p_before)
        order by id desc limit greatest(1, least(p_limit, 51))
    ) m;
  return jsonb_build_object(
    'status', 'ok',
    'messages', v_msgs,
    'read', coalesce((select last_id from public.dogcity_phone_read where owner = p_me and other = p_other), 0),
    'peer_read', coalesce((select last_id from public.dogcity_phone_read where owner = p_other and other = p_me), 0)
  );
end;
$$;

create or replace function public.dogcity_phone_read_set(p_me uuid, p_other uuid, p_upto bigint) returns text
language plpgsql as $$
declare
  v_max bigint;
begin
  if not public.dogcity_phone_is_friend(p_me, p_other) then
    return 'not_friends';
  end if;
  select coalesce(max(id), 0) into v_max from public.dogcity_phone_message
    where a = least(p_me, p_other) and b = greatest(p_me, p_other);
  insert into public.dogcity_phone_read (owner, other, last_id) values (p_me, p_other, least(greatest(p_upto, 0), v_max))
    on conflict (owner, other) do update set last_id = greatest(public.dogcity_phone_read.last_id, excluded.last_id), updated_at = now();
  return 'ok';
end;
$$;

-- a tela inicial do app: amigos (com a última mensagem e as não lidas), pedidos recebidos e enviados, bloqueados
create or replace function public.dogcity_phone_overview(p_me uuid) returns jsonb
language sql stable as $$
  with meus as (
    select case when l.a = p_me then l.b else l.a end as other, l.state, l.requester, l.updated_at
    from public.dogcity_phone_link l
    where (l.a = p_me or l.b = p_me) and l.state in ('pending', 'friends')
  ),
  linhas as (
    select
      m.other, m.state, m.requester, m.updated_at,
      exists (select 1 from public.dogcity_phone_mute u where u.owner = p_me and u.other = m.other) as muted,
      ult.id as last_id, ult.body as last_text, ult.created_at as last_at, ult.sender as last_sender,
      case when m.state = 'friends' then (
        select count(*) from public.dogcity_phone_message x
        where x.a = least(p_me, m.other) and x.b = greatest(p_me, m.other) and x.sender = m.other
          and x.id > coalesce((select r.last_id from public.dogcity_phone_read r where r.owner = p_me and r.other = m.other), 0)
      ) else 0 end as unread
    from meus m
    left join lateral (
      select x.id, x.body, x.created_at, x.sender from public.dogcity_phone_message x
      where m.state = 'friends' and x.a = least(p_me, m.other) and x.b = greatest(p_me, m.other)
      order by x.id desc limit 1
    ) ult on true
  )
  select jsonb_build_object(
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'card', public.dogcity_phone_card(l.other), 'state', l.state, 'mine', l.requester = p_me, 'at', l.updated_at,
        'muted', l.muted, 'unread', l.unread,
        'last', case when l.last_id is null then null else
          jsonb_build_object('id', l.last_id, 'text', l.last_text, 'at', l.last_at, 'mine', l.last_sender = p_me) end
      ) order by coalesce(l.last_at, l.updated_at) desc) from linhas l), '[]'::jsonb),
    'blocked', coalesce((
      select jsonb_agg(public.dogcity_phone_card(k.blocked) order by k.created_at desc)
      from public.dogcity_phone_block k where k.blocker = p_me), '[]'::jsonb)
  );
$$;

-- só os dois números do selo: não lidas (sem os silenciados) e pedidos recebidos
create or replace function public.dogcity_phone_counts(p_me uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'unread', coalesce((
      select sum((
        select count(*) from public.dogcity_phone_message x
        where x.a = l.a and x.b = l.b and x.sender <> p_me
          and x.id > coalesce((select r.last_id from public.dogcity_phone_read r
                                where r.owner = p_me and r.other = case when l.a = p_me then l.b else l.a end), 0)
      )) from public.dogcity_phone_link l
      where (l.a = p_me or l.b = p_me) and l.state = 'friends'
        and not exists (select 1 from public.dogcity_phone_mute u
                         where u.owner = p_me and u.other = case when l.a = p_me then l.b else l.a end)
    ), 0),
    'requests', (
      select count(*) from public.dogcity_phone_link l
      where (l.a = p_me or l.b = p_me) and l.state = 'pending' and l.requester <> p_me
    )
  );
$$;

comment on table public.dogcity_phone_account is 'DOG Phone: a conta do celular (id interno permanente). Escrita só pelas rotas /api/dogcity/phone com service role.';
comment on table public.dogcity_phone_message is 'DOG Phone: mensagens 1:1 entre contas que se aceitaram, até 500 caracteres. Nunca vai ao chat público.';

-- Acesso (revisao de 26/11/2026): como 044/045, nada do celular e' chamavel pela chave publica. As funcoes rodam com os direitos de
-- quem chama (sem security definer) e as tabelas tem RLS sem politica, entao anon/authenticated ja' nao leem nem escrevem; isto
-- fecha tambem o EXECUTE que o Postgres da' a todo mundo por padrao, para o servidor (service_role) ser o unico caminho.
-- Condicional ao papel `anon` existir: num Postgres local (PGlite, testes) nao ha' papeis do Supabase e o bloco nao faz nada.
do $$
declare r record;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') and exists (select 1 from pg_roles where rolname = 'service_role') then
    for r in select c.oid::regclass as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'dogcity\_phone\_%' loop
      execute format('revoke all on table %s from anon, authenticated', r.t);
    end loop;
    for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname like 'dogcity\_phone\_%' loop
      execute format('revoke all on function %s from public, anon, authenticated', r.f);
      execute format('grant execute on function %s to service_role', r.f);
    end loop;
  end if;
end;
$$;
