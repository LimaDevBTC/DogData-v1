-- Migration 033: o bloco B da DogCity, congelado.
--
-- B e o bloco da transacao de doacao que fez o fundo de construcao cruzar
-- 10.000.000 $DOG (contrato publico: /dogcity/docs, secao 7). A rota
-- GET /api/dogcity/mint-b recalcula B do livro enquanto ele tem menos de 6
-- confirmacoes. Na primeira vez que ve B com 6 ou mais, grava aqui UMA linha, e
-- dali em diante so le esta linha: B nunca mais muda (nem por doacao devolvida,
-- nem por linha antiga que o scanner insira depois).
--
-- Uma linha so (id = 1), imutavel por trigger: insert uma vez, nunca update nem
-- delete. Lida e escrita SO pela rota de servidor (service role). RLS ligado e
-- zero policies, como a 006: o papel anon fica sem nada. Sem esta tabela a rota
-- continua funcionando, segurando B na memoria do processo.
create table if not exists public.dogcity_mint_b (
  id smallint primary key default 1 check (id = 1),
  b integer not null check (b > 0),
  -- DOG confirmado no fundo no instante do congelamento
  raised numeric not null,
  -- ponta lida no instante do congelamento (b + 5 ou mais)
  tip integer not null check (tip >= b + 5),
  -- a transacao que cruzou a meta, so para auditoria
  txid text,
  frozen_at timestamptz not null default now()
);

alter table public.dogcity_mint_b enable row level security;

create or replace function public.dogcity_mint_b_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'dogcity_mint_b is immutable: B is frozen once set';
end;
$$;

drop trigger if exists dogcity_mint_b_imutavel on public.dogcity_mint_b;
create trigger dogcity_mint_b_imutavel
  before update or delete on public.dogcity_mint_b
  for each row execute function public.dogcity_mint_b_imutavel();
