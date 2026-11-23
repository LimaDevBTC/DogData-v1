-- Migration 047: DOG Phone, Ligações e Mural (22/11/2026). NÃO APLICADA. Depende da 046 (contas, vínculos, bloqueio, silêncio).
--
-- LIGAÇÕES: chamada de voz 1:1 entre amigos aceitos. O servidor NÃO carrega áudio: ele só guarda a sinalização do WebRTC (a
-- oferta de quem liga e a resposta de quem atende, uma mensagem cada, sem trickle) e decide QUEM pode ligar para QUEM. O áudio
-- vai direto de um navegador ao outro, cifrado (DTLS-SRTP). Nada é gravado.
--
--   dogcity_phone_call    uma linha por chamada: quem ligou, quem recebeu, estado (ringing, active, ended), motivo do fim,
--                         a oferta e a resposta (apagadas quando a chamada acaba), e quando cada lado foi visto pela última vez
--   dogcity_phone_prefs   preferências da conta: não perturbe
--
-- Regras, todas com `p_me` vindo só da sessão: só amigos (046) e sem bloqueio; quem recebe em não perturbe ou silenciou quem
-- liga não toca (fica como perdida, e quem liga só vê "sem resposta": o silêncio não é revelado); uma conta numa chamada
-- responde ocupado; só quem recebe atende; só os dois participantes leem ou encerram.
--
-- MURAL: feed de texto do celular. Um mural NOVO: não lê, não migra e não apaga nada de outros murais do jogo ou do site.
--
--   dogcity_phone_post         o post (1 a 500 caracteres), do autor (conta da 046); apagar é marcar deleted_at
--   dogcity_phone_post_like    uma curtida por conta por post
--   dogcity_phone_post_report  denúncia de post
--
-- O feed some com os posts de quem a conta bloqueou e de quem a bloqueou. A autoria é a conta da sessão; o perfil mostra só
-- @handle e foto, nunca carteira. Imagem em post fica para depois (não há upload seguro e moderável neste repo).
--
-- RLS ligada, ZERO políticas, só service role, como a 046. Repo público: nenhum segredo aqui.

create table if not exists public.dogcity_phone_prefs (
  owner uuid primary key references public.dogcity_phone_account (id),
  dnd boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.dogcity_phone_call (
  id uuid primary key default gen_random_uuid(),
  caller uuid not null references public.dogcity_phone_account (id),
  callee uuid not null references public.dogcity_phone_account (id),
  state text not null check (state in ('ringing', 'active', 'ended')),
  -- por que acabou: declined, hangup, cancel, missed (ninguém atendeu), failed (o áudio não fechou), lost (os dois sumiram)
  reason text check (reason in ('declined', 'hangup', 'cancel', 'missed', 'failed', 'lost')),
  -- a chamada não toca para quem recebe (não perturbe ou silenciou quem liga)
  silent boolean not null default false,
  offer text check (offer is null or char_length(offer) <= 20000),
  answer text check (answer is null or char_length(answer) <= 20000),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  caller_seen timestamptz not null default now(),
  callee_seen timestamptz,
  -- quem recebe já viu a perdida
  missed_seen boolean not null default false,
  check (caller <> callee)
);
create index if not exists dogcity_phone_call_callee_idx on public.dogcity_phone_call (callee, created_at desc);
create index if not exists dogcity_phone_call_caller_idx on public.dogcity_phone_call (caller, created_at desc);
create index if not exists dogcity_phone_call_viva_idx on public.dogcity_phone_call (state) where state <> 'ended';

create table if not exists public.dogcity_phone_post (
  id bigint generated always as identity primary key,
  author uuid not null references public.dogcity_phone_account (id),
  -- o texto pode vir vazio quando o post leva uma foto (048); a regra "texto ou foto" é da função que publica
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- resposta a um post do feed (um nível só: não há resposta de resposta)
  reply_to bigint references public.dogcity_phone_post (id)
);
create index if not exists dogcity_phone_post_feed_idx on public.dogcity_phone_post (id desc) where deleted_at is null;
create index if not exists dogcity_phone_post_reply_idx on public.dogcity_phone_post (reply_to, id) where reply_to is not null;
create index if not exists dogcity_phone_post_author_idx on public.dogcity_phone_post (author, id desc);

create table if not exists public.dogcity_phone_post_like (
  post bigint not null references public.dogcity_phone_post (id),
  account uuid not null references public.dogcity_phone_account (id),
  created_at timestamptz not null default now(),
  primary key (post, account)
);

create table if not exists public.dogcity_phone_post_report (
  id bigint generated always as identity primary key,
  post bigint not null references public.dogcity_phone_post (id),
  reporter uuid not null,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  unique (post, reporter)
);

alter table public.dogcity_phone_prefs enable row level security;
alter table public.dogcity_phone_call enable row level security;
alter table public.dogcity_phone_post enable row level security;
alter table public.dogcity_phone_post_like enable row level security;
alter table public.dogcity_phone_post_report enable row level security;

-- ---------------------------------------------------------------------------------------------------------------- ligações

-- limpa o que ficou velho numa conta: tocando há mais de p_ring_s vira perdida; ativa sem ninguém visto há p_lost_s vira lost
create or replace function public.dogcity_phone_call_sweep(p_me uuid, p_ring_s int, p_lost_s int) returns void
language sql as $$
  update public.dogcity_phone_call
    set state = 'ended', reason = 'missed', ended_at = now(), offer = null, answer = null
    where state = 'ringing' and (caller = p_me or callee = p_me) and created_at < now() - make_interval(secs => p_ring_s);
  update public.dogcity_phone_call
    set state = 'ended', reason = 'lost', ended_at = now(), offer = null, answer = null
    where state = 'active' and (caller = p_me or callee = p_me)
      and greatest(caller_seen, coalesce(callee_seen, caller_seen)) < now() - make_interval(secs => p_lost_s);
$$;

create or replace function public.dogcity_phone_call_start(p_me uuid, p_other uuid, p_offer text, p_ring_s int, p_lost_s int, p_cap_hour int) returns jsonb
language plpgsql as $$
declare
  v_id uuid;
  v_silent boolean;
begin
  perform public.dogcity_phone_lock(p_me);
  if p_me = p_other or not public.dogcity_phone_is_friend(p_me, p_other)
     or exists (select 1 from public.dogcity_phone_block
                 where (blocker = p_me and blocked = p_other) or (blocker = p_other and blocked = p_me)) then
    return jsonb_build_object('status', 'not_friends');
  end if;
  perform public.dogcity_phone_call_sweep(p_me, p_ring_s, p_lost_s);
  perform public.dogcity_phone_call_sweep(p_other, p_ring_s, p_lost_s);
  if exists (select 1 from public.dogcity_phone_call where state <> 'ended' and (caller = p_me or (callee = p_me and not silent))) then
    return jsonb_build_object('status', 'busy_self');
  end if;
  if (select count(*) from public.dogcity_phone_call where caller = p_me and created_at > now() - interval '1 hour') >= p_cap_hour then
    return jsonb_build_object('status', 'rate');
  end if;
  -- quem recebe ja' esta' numa chamada que TOCA para ele ou ativa: ocupado (a silenciosa nao conta: ele nem sabe dela)
  if exists (select 1 from public.dogcity_phone_call
              where state <> 'ended' and (caller = p_other or (callee = p_other and not silent))) then
    return jsonb_build_object('status', 'busy');
  end if;
  v_silent := coalesce((select dnd from public.dogcity_phone_prefs where owner = p_other), false)
           or exists (select 1 from public.dogcity_phone_mute where owner = p_other and other = p_me);
  insert into public.dogcity_phone_call (caller, callee, state, silent, offer) values (p_me, p_other, 'ringing', v_silent, p_offer)
    returning id into v_id;
  -- `ring` diz ao servidor se avisa o outro lado; quem liga nunca recebe esse campo
  return jsonb_build_object('status', 'ok', 'id', v_id, 'ring', not v_silent);
end;
$$;

create or replace function public.dogcity_phone_call_answer(p_me uuid, p_call uuid, p_answer text) returns text
language plpgsql as $$
declare
  v_n int;
begin
  update public.dogcity_phone_call
    set state = 'active', answer = p_answer, answered_at = now(), callee_seen = now()
    where id = p_call and callee = p_me and state = 'ringing' and not silent;
  get diagnostics v_n = row_count;
  return case when v_n = 1 then 'ok' else 'not_found' end;
end;
$$;

-- encerrar: quem recebe recusa (ringing) ou desliga; quem liga cancela (ringing) ou desliga. Devolve a outra conta para o aviso
create or replace function public.dogcity_phone_call_end(p_me uuid, p_call uuid, p_failed boolean) returns jsonb
language plpgsql as $$
declare
  v public.dogcity_phone_call%rowtype;
  v_reason text;
begin
  select * into v from public.dogcity_phone_call where id = p_call and (caller = p_me or callee = p_me) for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v.state = 'ended' then
    return jsonb_build_object('status', 'ok', 'other', case when v.caller = p_me then v.callee else v.caller end, 'ring', false);
  end if;
  v_reason := case
    when p_failed then 'failed'
    when v.state = 'active' then 'hangup'
    when v.caller = p_me then 'cancel'
    else 'declined' end;
  update public.dogcity_phone_call
    set state = 'ended', reason = v_reason, ended_at = now(), offer = null, answer = null,
        missed_seen = missed_seen or (v.callee = p_me)
    where id = p_call;
  return jsonb_build_object('status', 'ok', 'other', case when v.caller = p_me then v.callee else v.caller end,
                            'ring', not v.silent or v.callee = p_me);
end;
$$;

-- o que a conta precisa saber AGORA: a chamada viva dela (com a oferta ou a resposta) e quantas perdidas não vistas
create or replace function public.dogcity_phone_call_poll(p_me uuid, p_ring_s int, p_lost_s int) returns jsonb
language plpgsql as $$
declare
  v public.dogcity_phone_call%rowtype;
  v_call jsonb := null;
  v_last jsonb := null;
begin
  perform public.dogcity_phone_call_sweep(p_me, p_ring_s, p_lost_s);
  update public.dogcity_phone_call set caller_seen = now() where caller = p_me and state <> 'ended';
  update public.dogcity_phone_call set callee_seen = now() where callee = p_me and state <> 'ended' and not silent;
  select * into v from public.dogcity_phone_call
    where state <> 'ended' and (caller = p_me or (callee = p_me and not silent))
    order by created_at desc limit 1;
  if found then
    v_call := jsonb_build_object(
      'id', v.id, 'state', v.state, 'incoming', v.callee = p_me,
      'peer', public.dogcity_phone_card(case when v.caller = p_me then v.callee else v.caller end),
      'at', v.created_at, 'answered_at', v.answered_at,
      -- cada lado so' recebe o que e' dele: quem recebe, a oferta; quem ligou, a resposta
      'offer', case when v.callee = p_me and v.state = 'ringing' then v.offer else null end,
      'answer', case when v.caller = p_me then v.answer else null end
    );
  else
    -- a ultima que acabou ha' pouco (para quem ligou saber por que: recusada, ocupado, sem resposta)
    select jsonb_build_object('id', c.id, 'reason', case when c.silent and c.caller = p_me then 'missed' else c.reason end, 'incoming', c.callee = p_me)
      into v_last from public.dogcity_phone_call c
      where c.state = 'ended' and (c.caller = p_me or (c.callee = p_me and not c.silent)) and c.ended_at > now() - interval '20 seconds'
      order by c.ended_at desc limit 1;
  end if;
  return jsonb_build_object(
    'call', v_call,
    'last', v_last,
    'missed', (select count(*) from public.dogcity_phone_call
                where callee = p_me and state = 'ended' and reason = 'missed' and not missed_seen and not silent
                  and created_at > now() - interval '7 days'),
    'dnd', coalesce((select dnd from public.dogcity_phone_prefs where owner = p_me), false)
  );
end;
$$;

-- o histórico (feitas, recebidas, perdidas). Ver a lista marca as perdidas como vistas
create or replace function public.dogcity_phone_call_log(p_me uuid, p_limit int) returns jsonb
language plpgsql as $$
declare
  v jsonb;
begin
  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) into v from (
    select c.created_at, jsonb_build_object(
      'id', c.id, 'incoming', c.callee = p_me,
      'peer', public.dogcity_phone_card(case when c.caller = p_me then c.callee else c.caller end),
      'at', c.created_at,
      'result', case
        when c.answered_at is not null then 'talked'
        when c.callee = p_me then 'missed'
        when c.reason = 'cancel' then 'cancelled'
        else 'no_answer' end,
      'seconds', case when c.answered_at is not null then greatest(0, extract(epoch from (coalesce(c.ended_at, now()) - c.answered_at))::int) else 0 end
    ) as j
    from public.dogcity_phone_call c
    where c.state = 'ended' and (c.caller = p_me or (c.callee = p_me and (not c.silent or c.reason = 'missed')))
    order by c.created_at desc limit greatest(1, least(p_limit, 50))
  ) x;
  update public.dogcity_phone_call set missed_seen = true where callee = p_me and state = 'ended' and not missed_seen;
  return v;
end;
$$;

create or replace function public.dogcity_phone_dnd_set(p_me uuid, p_on boolean) returns text
language sql as $$
  insert into public.dogcity_phone_prefs (owner, dnd) values (p_me, p_on)
    on conflict (owner) do update set dnd = excluded.dnd, updated_at = now();
  select 'ok'::text;
$$;

-- ------------------------------------------------------------------------------------------------------------------- mural

create or replace function public.dogcity_phone_post_add(p_me uuid, p_body text, p_cap_day int, p_gap_s int, p_reply bigint default null) returns jsonb
language plpgsql as $$
declare
  v_id bigint;
begin
  perform public.dogcity_phone_lock(p_me);
  -- quem publica precisa de um @handle (é o nome que aparece no post)
  if (public.dogcity_phone_card(p_me) ->> 'handle') is null then
    return jsonb_build_object('status', 'no_handle');
  end if;
  if exists (select 1 from public.dogcity_phone_post where author = p_me and created_at > now() - make_interval(secs => p_gap_s)) then
    return jsonb_build_object('status', 'rate');
  end if;
  if (select count(*) from public.dogcity_phone_post where author = p_me and created_at > now() - interval '1 day') >= p_cap_day then
    return jsonb_build_object('status', 'cap_day');
  end if;
  -- resposta: só a um post vivo do feed (não a outra resposta), e nunca atravessando um bloqueio
  if p_reply is not null and not exists (
    select 1 from public.dogcity_phone_post p
    where p.id = p_reply and p.deleted_at is null and p.reply_to is null
      and not exists (select 1 from public.dogcity_phone_block k
                       where (k.blocker = p_me and k.blocked = p.author) or (k.blocker = p.author and k.blocked = p_me))
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;
  insert into public.dogcity_phone_post (author, body, reply_to) values (p_me, p_body, p_reply) returning id into v_id;
  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$$;

-- o feed cronológico (do mais novo para o mais velho), paginado por id; p_author filtra o perfil de uma conta.
-- Sem p_thread vêm só os posts do feed (as respostas não); com p_thread vêm aquele post e as respostas a ele.
create or replace function public.dogcity_phone_feed(p_me uuid, p_author uuid, p_before bigint, p_limit int, p_thread bigint default null) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'text', x.body, 'at', x.created_at, 'mine', x.author = p_me,
    'author', public.dogcity_phone_card(x.author),
    'reply_to', x.reply_to,
    'replies', (select count(*) from public.dogcity_phone_post r where r.reply_to = x.id and r.deleted_at is null
                 and not exists (select 1 from public.dogcity_phone_block k
                                  where (k.blocker = p_me and k.blocked = r.author) or (k.blocker = r.author and k.blocked = p_me))),
    'likes', (select count(*) from public.dogcity_phone_post_like l where l.post = x.id),
    'liked', exists (select 1 from public.dogcity_phone_post_like l where l.post = x.id and l.account = p_me)
  ) order by x.id desc), '[]'::jsonb)
  from (
    select p.id, p.body, p.created_at, p.author, p.reply_to from public.dogcity_phone_post p
    where p.deleted_at is null
      and (case when p_thread is null then p.reply_to is null else (p.id = p_thread or p.reply_to = p_thread) end)
      and (p_author is null or p.author = p_author)
      and (p_before is null or p.id < p_before)
      and not exists (select 1 from public.dogcity_phone_block k
                       where (k.blocker = p_me and k.blocked = p.author) or (k.blocker = p.author and k.blocked = p_me))
    order by p.id desc limit greatest(1, least(p_limit, 51))
  ) x;
$$;

-- curtir e descurtir (não dá para curtir post de quem bloqueou ou foi bloqueado, nem post apagado)
create or replace function public.dogcity_phone_post_like_set(p_me uuid, p_post bigint, p_on boolean) returns jsonb
language plpgsql as $$
declare
  v_author uuid;
begin
  select author into v_author from public.dogcity_phone_post where id = p_post and deleted_at is null;
  if v_author is null or exists (select 1 from public.dogcity_phone_block k
       where (k.blocker = p_me and k.blocked = v_author) or (k.blocker = v_author and k.blocked = p_me)) then
    return jsonb_build_object('status', 'not_found');
  end if;
  if p_on then
    insert into public.dogcity_phone_post_like (post, account) values (p_post, p_me) on conflict do nothing;
  else
    delete from public.dogcity_phone_post_like where post = p_post and account = p_me;
  end if;
  return jsonb_build_object('status', 'ok', 'likes', (select count(*) from public.dogcity_phone_post_like where post = p_post), 'liked', p_on);
end;
$$;

-- apagar: só o autor, e só o próprio post
create or replace function public.dogcity_phone_post_delete(p_me uuid, p_post bigint) returns text
language plpgsql as $$
declare
  v_n int;
begin
  update public.dogcity_phone_post set deleted_at = now() where id = p_post and author = p_me and deleted_at is null;
  get diagnostics v_n = row_count;
  return case when v_n = 1 then 'ok' else 'not_found' end;
end;
$$;

create or replace function public.dogcity_phone_post_report_add(p_me uuid, p_post bigint, p_reason text, p_cap_day int) returns text
language plpgsql as $$
begin
  perform public.dogcity_phone_lock(p_me);
  if not exists (select 1 from public.dogcity_phone_post where id = p_post and deleted_at is null and author <> p_me) then
    return 'not_found';
  end if;
  if (select count(*) from public.dogcity_phone_post_report where reporter = p_me and created_at > now() - interval '1 day') >= p_cap_day then
    return 'cap';
  end if;
  insert into public.dogcity_phone_post_report (post, reporter, reason) values (p_post, p_me, coalesce(p_reason, ''))
    on conflict (post, reporter) do nothing;
  return 'ok';
end;
$$;

comment on table public.dogcity_phone_call is 'DOG Phone: sinalização de chamadas de voz 1:1 entre amigos. O áudio é ponta a ponta entre os navegadores; nada é gravado.';
comment on table public.dogcity_phone_post is 'DOG Phone: o Mural (feed de texto do celular). Mural novo, independente de qualquer outro mural do jogo.';
