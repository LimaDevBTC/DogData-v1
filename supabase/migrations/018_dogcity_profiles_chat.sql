-- Migration 018: perfis do DogCity (handle escolhido pela carteira) + chat da praca central.
-- Ver praca-central.md. Escrita SO por rota de servidor com service role
-- (app/api/profile, app/api/chat): a service role ignora RLS, entao a postura
-- e a mesma da 004 e da 006, RLS ligado e ZERO policies. O papel anon fica
-- sem nada, nem leitura direta via PostgREST.

-- dogcity_profiles: um endereco = um handle, escolhido uma vez depois de
-- prova de posse (sessao wsess: verificada em /api/wallet/verify). O CHECK do
-- regex repete a validacao que ja roda em lib/identity/handle.ts, defesa em
-- profundidade caso algo grave direto no banco sem passar pela rota.
create table if not exists public.dogcity_profiles (
  address text primary key,
  handle text unique not null check (handle ~ '^[a-z0-9_]{3,15}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- dogcity_chat: mensagens da praca, uma linha por mensagem. handle e address
-- ficam desnormalizados na propria linha de proposito, a mensagem continua
-- mostrando o nome de quando foi escrita mesmo se o handle mudar depois.
create table if not exists public.dogcity_chat (
  id bigserial primary key,
  address text not null,
  handle text not null,
  text text not null check (char_length(text) <= 280 and char_length(trim(text)) > 0),
  created_at timestamptz not null default now()
);

-- GET /api/chat le as ultimas 50 por created_at desc antes de inverter pra
-- ordem cronologica na resposta, esse e o indice que aquela consulta usa.
create index if not exists dogcity_chat_created_at_desc on public.dogcity_chat (created_at desc);

alter table public.dogcity_profiles enable row level security;
alter table public.dogcity_chat enable row level security;

comment on table public.dogcity_profiles is 'Handle por endereco, escolhido uma vez apos prova de posse. Escrita so por app/api/profile com service role.';
comment on table public.dogcity_chat is 'Mensagens da praca central do DogCity, ate 280 caracteres. Escrita so por app/api/chat com service role.';
comment on column public.dogcity_profiles.address is 'Endereco Bitcoin sempre em minusculas, normalizado na rota antes do upsert.';
comment on column public.dogcity_chat.address is 'Endereco de quem escreveu, minusculas, desnormalizado da sessao no momento do post.';
