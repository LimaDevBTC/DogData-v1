-- DOG PHONE: as fotos da Câmera (22/11/2026). A foto é um quadro do jogo (frente ou selfie do $DOG), tirado no celular do
-- jogo. O ARQUIVO mora no Supabase Storage, num bucket PRIVADO escrito e lido só pelo servidor (service role):
--   bucket dogcity-phone-photos   criar no painel do Supabase como privado, sem política pública (ver lib/phone/README.md)
-- Aqui fica só o registro: de quem é, onde está, o tamanho e quando. Nesta versão a foto é da própria conta (a galeria do
-- celular); publicar em post e enviar por mensagem vêm depois e vão pendurar a foto por id, sem copiar o arquivo.
-- Depende da 046 (dogcity_phone_account, dogcity_phone_lock). Nenhuma tabela anterior muda.

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

-- onde está o arquivo: só a dona lê (nesta versão a foto não aparece para mais ninguém)
create or replace function public.dogcity_phone_photo_path(p_me uuid, p_id bigint) returns text
language sql stable as $$
  select p.path from public.dogcity_phone_photo p where p.id = p_id and p.owner = p_me and p.deleted_at is null;
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

comment on table public.dogcity_phone_photo is 'DOG Phone: registro das fotos da Câmera (quadros do jogo). O arquivo fica no bucket privado dogcity-phone-photos.';
