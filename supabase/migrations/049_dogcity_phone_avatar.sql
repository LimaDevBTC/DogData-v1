-- DOG PHONE: a foto de perfil do Social City (27/11/2026). A pessoa sobe uma foto SUA (do aparelho: galeria ou camera do
-- celular); o jogo recorta em quadrado e reduz antes de enviar, e o servidor faz com ela o mesmo que com as fotos da Camera
-- (lib/phone/fotos.ts limparJpeg: confere a estrutura do JPEG, as medidas e o tamanho, tira todo metadado) e grava no MESMO
-- bucket privado dogcity-phone-photos. Nada de bucket novo.
--
--   - a foto de perfil e' uma linha de dogcity_phone_photo com kind = 'avatar' (fica fora da galeria do app Fotos);
--   - a conta aponta a foto em uso (dogcity_phone_account.avatar_photo); trocar ou tirar apaga a anterior (o servidor tira o
--     arquivo do bucket com o caminho que a funcao devolve);
--   - quem pode ver: a dona e qualquer conta do celular sem bloqueio com ela (a mesma regra do feed). O cartao
--     (dogcity_phone_card) passa a levar 'photo' (o id) ao lado do 'avatar' (a inscricao do perfil, que continua igual).
-- Depende da 046 (contas, bloqueios, cartao) e da 048 (fotos).

alter table public.dogcity_phone_photo drop constraint if exists dogcity_phone_photo_kind_check;
alter table public.dogcity_phone_photo add constraint dogcity_phone_photo_kind_check check (kind in ('front', 'selfie', 'avatar'));

alter table public.dogcity_phone_account add column if not exists avatar_photo bigint references public.dogcity_phone_photo (id);

-- o cartao de uma conta (046) ganha a foto de perfil viva
create or replace function public.dogcity_phone_card(p_id uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', a.id, 'handle', p.handle, 'avatar', p.avatar_inscription_id,
    'photo', (select f.id from public.dogcity_phone_photo f where f.id = a.avatar_photo and f.deleted_at is null))
  from public.dogcity_phone_account a
  left join public.dogcity_profiles p on p.address = a.address
  where a.id = p_id;
$$;

-- troca (p_photo = uma foto 'avatar' viva da propria conta) ou tira (p_photo null) a foto de perfil. A anterior e' apagada e o
-- caminho dela volta para o servidor tirar o arquivo do bucket.
create or replace function public.dogcity_phone_avatar_set(p_me uuid, p_photo bigint) returns jsonb
language plpgsql as $$
declare
  v_old bigint;
  v_path text;
begin
  perform public.dogcity_phone_lock(p_me);
  if p_photo is not null and not exists (
    select 1 from public.dogcity_phone_photo where id = p_photo and owner = p_me and kind = 'avatar' and deleted_at is null
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;
  select avatar_photo into v_old from public.dogcity_phone_account where id = p_me;
  update public.dogcity_phone_account set avatar_photo = p_photo where id = p_me;
  if v_old is not null and v_old is distinct from p_photo then
    update public.dogcity_phone_photo set deleted_at = now()
      where id = v_old and owner = p_me and kind = 'avatar' and deleted_at is null
      returning path into v_path;
  end if;
  return jsonb_build_object('status', 'ok', 'old_path', v_path);
end;
$$;

-- a galeria (048) sem as fotos de perfil
create or replace function public.dogcity_phone_photo_list(p_me uuid, p_before bigint, p_limit int) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'at', x.created_at, 'w', x.w, 'h', x.h, 'kind', x.kind) order by x.id desc), '[]'::jsonb)
  from (
    select p.id, p.created_at, p.w, p.h, p.kind from public.dogcity_phone_photo p
    where p.owner = p_me and p.deleted_at is null and p.kind <> 'avatar' and (p_before is null or p.id < p_before)
    order by p.id desc limit greatest(1, least(p_limit, 61))
  ) x;
$$;

-- onde esta' o arquivo (048) + a foto de perfil: quem pode ler e' a dona, quem ve o post em que a foto esta' e, agora, qualquer
-- conta sem bloqueio com a dona quando a foto e' a de perfil EM USO.
create or replace function public.dogcity_phone_photo_path(p_me uuid, p_id bigint) returns text
language sql stable as $$
  select f.path from public.dogcity_phone_photo f
  where f.id = p_id and f.deleted_at is null
    and (f.owner = p_me
      or exists (
        select 1 from public.dogcity_phone_post p
        where p.photo = f.id and p.deleted_at is null
          and not exists (select 1 from public.dogcity_phone_block k
                           where (k.blocker = p_me and k.blocked = p.author) or (k.blocker = p.author and k.blocked = p_me)))
      or exists (
        select 1 from public.dogcity_phone_account a
        where a.avatar_photo = f.id and a.id = f.owner
          and not exists (select 1 from public.dogcity_phone_block k
                           where (k.blocker = p_me and k.blocked = a.id) or (k.blocker = a.id and k.blocked = p_me))));
$$;

-- apagar da galeria (048) nao alcanca a foto de perfil: ela sai por dogcity_phone_avatar_set
create or replace function public.dogcity_phone_photo_delete(p_me uuid, p_id bigint) returns text
language plpgsql as $$
declare
  v_path text;
begin
  update public.dogcity_phone_photo set deleted_at = now()
    where id = p_id and owner = p_me and kind <> 'avatar' and deleted_at is null
    returning path into v_path;
  return v_path;
end;
$$;

comment on column public.dogcity_phone_account.avatar_photo is 'DOG Phone: a foto de perfil do Social City em uso (dogcity_phone_photo, kind avatar).';

-- Acesso: o mesmo fechamento da 048 (nada do celular e' chamavel pela chave publica; so' o servidor, service_role).
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
