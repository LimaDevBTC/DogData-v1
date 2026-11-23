-- DOG PHONE: as fotos da Câmera (22/11/2026). A foto é um quadro do jogo (frente ou selfie do $DOG), tirado no celular do
-- jogo. O ARQUIVO mora no Supabase Storage, num bucket PRIVADO escrito e lido só pelo servidor (service role):
--   bucket dogcity-phone-photos   criar no painel do Supabase como privado, sem política pública (ver lib/phone/README.md)
-- Aqui fica o registro (de quem é, onde está, o tamanho e quando) e a foto em post do Social City: o post aponta a foto por id,
-- sem copiar o arquivo. Enviar foto por mensagem ainda não existe.
-- Depende da 046 (contas, bloqueios) e da 047 (posts): a tabela de posts ganha a coluna `photo`.

create table if not exists public.dogcity_phone_photo (
  id bigint generated always as identity primary key,
  owner uuid not null references public.dogcity_phone_account (id),
  path text not null unique,
  bytes int not null check (bytes between 1 and 2000000),
  w int not null check (w between 16 and 4096),
  h int not null check (h between 16 and 4096),
  kind text not null check (kind in ('front', 'selfie')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists dogcity_phone_photo_owner_idx on public.dogcity_phone_photo (owner, id desc) where deleted_at is null;
alter table public.dogcity_phone_photo enable row level security;

-- o post do Social City (047) ganha a foto: uma da galeria de quem publica (as funções que usam a coluna vêm abaixo)
alter table public.dogcity_phone_post add column if not exists photo bigint references public.dogcity_phone_photo (id);
create index if not exists dogcity_phone_post_photo_idx on public.dogcity_phone_post (photo) where photo is not null;

-- registra a foto que o servidor acabou de gravar no bucket. Tetos: por dia e no total guardado (as apagadas não contam)
create or replace function public.dogcity_phone_photo_add(p_me uuid, p_path text, p_bytes int, p_w int, p_h int, p_kind text, p_cap_day int, p_cap_total int) returns jsonb
language plpgsql as $$
declare
  v_id bigint;
begin
  perform public.dogcity_phone_lock(p_me);
  if (select count(*) from public.dogcity_phone_photo where owner = p_me and created_at > now() - interval '1 day') >= p_cap_day then
    return jsonb_build_object('status', 'cap_day');
  end if;
  if (select count(*) from public.dogcity_phone_photo where owner = p_me and deleted_at is null) >= p_cap_total then
    return jsonb_build_object('status', 'cap_total');
  end if;
  insert into public.dogcity_phone_photo (owner, path, bytes, w, h, kind) values (p_me, p_path, p_bytes, p_w, p_h, p_kind) returning id into v_id;
  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$$;

-- a galeria da conta, da mais nova para a mais velha, paginada por id
create or replace function public.dogcity_phone_photo_list(p_me uuid, p_before bigint, p_limit int) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'at', x.created_at, 'w', x.w, 'h', x.h, 'kind', x.kind) order by x.id desc), '[]'::jsonb)
  from (
    select p.id, p.created_at, p.w, p.h, p.kind from public.dogcity_phone_photo p
    where p.owner = p_me and p.deleted_at is null and (p_before is null or p.id < p_before)
    order by p.id desc limit greatest(1, least(p_limit, 61))
  ) x;
$$;

-- onde está o arquivo. Quem pode ler: a dona, sempre; e qualquer conta do celular quando a foto está num post vivo do Social
-- City, desde que não haja bloqueio entre ela e quem publicou (a mesma regra do feed).
create or replace function public.dogcity_phone_photo_path(p_me uuid, p_id bigint) returns text
language sql stable as $$
  select f.path from public.dogcity_phone_photo f
  where f.id = p_id and f.deleted_at is null
    and (f.owner = p_me or exists (
      select 1 from public.dogcity_phone_post p
      where p.photo = f.id and p.deleted_at is null
        and not exists (select 1 from public.dogcity_phone_block k
                         where (k.blocker = p_me and k.blocked = p.author) or (k.blocker = p.author and k.blocked = p_me))
    ));
$$;

-- apagar: só a dona; devolve o caminho para o servidor tirar o arquivo do bucket (null = não era dela ou já não existia)
create or replace function public.dogcity_phone_photo_delete(p_me uuid, p_id bigint) returns text
language plpgsql as $$
declare
  v_path text;
begin
  update public.dogcity_phone_photo set deleted_at = now() where id = p_id and owner = p_me and deleted_at is null returning path into v_path;
  return v_path;
end;
$$;

-- ------------------------------------------------------------------------------------------- foto em post do Social City
-- O post (047) ganha a foto: uma da galeria de quem publica. As duas funções da 047 são refeitas aqui com a foto.
drop function if exists public.dogcity_phone_post_add(uuid, text, int, int, bigint);

create or replace function public.dogcity_phone_post_add(p_me uuid, p_body text, p_cap_day int, p_gap_s int, p_reply bigint default null, p_photo bigint default null) returns jsonb
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
  -- texto ou foto: um dos dois tem de existir
  if p_photo is null and char_length(coalesce(p_body, '')) < 1 then
    return jsonb_build_object('status', 'empty');
  end if;
  -- a foto: só uma da própria conta, viva (tirada na Câmera e guardada pela rota de fotos)
  if p_photo is not null and not exists (select 1 from public.dogcity_phone_photo f where f.id = p_photo and f.owner = p_me and f.deleted_at is null) then
    return jsonb_build_object('status', 'no_photo');
  end if;
  insert into public.dogcity_phone_post (author, body, reply_to, photo) values (p_me, coalesce(p_body, ''), p_reply, p_photo) returning id into v_id;
  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$$;

create or replace function public.dogcity_phone_feed(p_me uuid, p_author uuid, p_before bigint, p_limit int, p_thread bigint default null) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'text', x.body, 'at', x.created_at, 'mine', x.author = p_me,
    'author', public.dogcity_phone_card(x.author),
    'reply_to', x.reply_to,
    -- a foto só aparece enquanto existir (a dona pode apagá-la da galeria: o post fica, sem a imagem)
    'photo', (select f.id from public.dogcity_phone_photo f where f.id = x.photo and f.deleted_at is null),
    'replies', (select count(*) from public.dogcity_phone_post r where r.reply_to = x.id and r.deleted_at is null
                 and not exists (select 1 from public.dogcity_phone_block k
                                  where (k.blocker = p_me and k.blocked = r.author) or (k.blocker = r.author and k.blocked = p_me))),
    'likes', (select count(*) from public.dogcity_phone_post_like l where l.post = x.id),
    'liked', exists (select 1 from public.dogcity_phone_post_like l where l.post = x.id and l.account = p_me)
  ) order by x.id desc), '[]'::jsonb)
  from (
    select p.id, p.body, p.created_at, p.author, p.reply_to, p.photo from public.dogcity_phone_post p
    where p.deleted_at is null
      and (case when p_thread is null then p.reply_to is null else (p.id = p_thread or p.reply_to = p_thread) end)
      and (p_author is null or p.author = p_author)
      and (p_before is null or p.id < p_before)
      and not exists (select 1 from public.dogcity_phone_block k
                       where (k.blocker = p_me and k.blocked = p.author) or (k.blocker = p.author and k.blocked = p_me))
    order by p.id desc limit greatest(1, least(p_limit, 51))
  ) x;
$$;

comment on table public.dogcity_phone_photo is 'DOG Phone: registro das fotos da Câmera (quadros do jogo). O arquivo fica no bucket privado dogcity-phone-photos.';
