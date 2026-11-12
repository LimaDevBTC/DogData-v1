-- Migration 037: a licença de construção pertence ao LOTE (decisão do fundador, 12/11/2026).
-- NÃO APLICADA. Contrato: LICENCA_NO_LOTE_CONTRATO.md (mint, DogData e jogo).
--
-- Até aqui a licença era CALCULADA por carteira ($DOG do livro do fundo + BTC creditado). Agora o pagamento
-- continua creditado à carteira que paga (scanner do $DOG e varredura do BTC intocados), e o crédito só vira
-- licença quando é APLICADO a um lote:
--
--   dogcity_licence_assignment  cada aplicação de crédito de uma carteira a um lote. Imutável (como o crédito
--                               em BTC da 034): corrigir é ato humano deliberado, nunca efeito de código.
--   dogcity_lot_licence         a licença de cada lote: a soma das aplicações e o degrau. Mantida SÓ pelo gatilho
--                               de dogcity_licence_assignment; escrita direta é recusada. Nada se soma entre lotes.
--   dogcity_licence_quotes.lot_id   a cotação em BTC pode nomear o lote que paga; o crédito dela cai direto nele.
--   dogcity_licence_apply(...)  o ÚNICO caminho de escrita do código: serializado por carteira (trava consultiva)
--                               e condicionado ao que a carteira já tinha aplicado quando o chamador calculou o
--                               crédito livre (troca condicional). Duas varreduras, ou uma varredura e uma leitura
--                               de standing ao mesmo tempo, nunca aplicam o mesmo crédito duas vezes.
--
-- Crédito livre de uma carteira = o que ela conta (lib/dog/licence-wallet.ts, a conta do placar) menos o que já
-- aplicou. Quem calcula e decide é lib/dog/licence-lot.ts; o banco só garante que a soma nunca anda duas vezes.
--
-- `source`:
--   dog        aplicação automática do crédito livre (a carteira guarda exatamente um lote, pelo mint). O crédito
--              livre é quase todo $DOG; BTC pago sem `lot_id` na cotação também entra por aqui.
--   btc        pagamento em BTC cuja cotação nomeou o lote (`ref` = 'btc:<txid>:<vout>', um por pagamento).
--   migration  a migração única: cada carteira com licença em 12/11 -> o lote dela no snapshot 966.670
--              (`ref` = 'migration:<carteira>'), gerada por scripts/city/licenca_no_lote.ts.
--
-- Setor 8 (Financial District) é só de empresa e nunca leva licença (app/dogcity/dogcity-data.ts,
-- SETOR_DAS_EMPRESAS): o check recusa lote S08.
--
-- Valores em $DOG com no máximo 5 casas (o átomo do livro, 10^-5): o check recusa mais casas, e a função
-- arredonda antes de comparar e gravar, para a troca condicional nunca travar por ruído de ponto flutuante.
-- As faixas do degrau são as de lib/dog/licence-btc.ts (LICENCE_DOG); um teste tranca a igualdade.
--
-- Lida e escrita SÓ pelas rotas do servidor (service role). RLS ligada, ZERO políticas, como 033/034/036.
-- Repo público: nenhum segredo aqui.
--
-- ORDEM SEGURA: aplicar ANTES de publicar o código. Sem estas tabelas o código novo cai no modo antigo (licença
-- por carteira) e não aplica nada; com elas e sem a migração de dados, as carteiras com licença só ganham o lote
-- quando o mint responder que guardam exatamente um.

-- ── o degrau pelo total do lote ────────────────────────────────────────────────────────────────────────────────
create or replace function public.dogcity_licence_tier(total numeric) returns text
language sql immutable as $$
  select case
    when total >= 500000 then 'patron'
    when total >= 50000 then 'commercial'
    when total >= 10000 then 'personal'
    else null
  end
$$;

-- ── a licença de cada lote ─────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.dogcity_lot_licence (
  lot_id text primary key check (lot_id ~ '^S[0-9]{2}-Q[0-9]{2}-B[0-9]{3,5}-L[0-9]{3,5}$'),
  total_dog numeric not null default 0 check (total_dog >= 0),
  tier text check (tier is null or tier in ('personal', 'commercial', 'patron')),
  updated_at timestamptz not null default now()
);

create index if not exists dogcity_lot_licence_tier_idx
  on public.dogcity_lot_licence (tier) where tier is not null;

alter table public.dogcity_lot_licence enable row level security;

-- ── cada aplicação de crédito a um lote ────────────────────────────────────────────────────────────────────────
create table if not exists public.dogcity_licence_assignment (
  id uuid primary key default gen_random_uuid(),
  lot_id text not null check (lot_id ~ '^S[0-9]{2}-Q[0-9]{2}-B[0-9]{3,5}-L[0-9]{3,5}$' and lot_id !~ '^S08-'),
  -- a carteira que pagou, como a rota normaliza (bech32 minúsculo, base58 intacto)
  wallet text not null check (length(wallet) between 26 and 90),
  amount_dog numeric not null check (amount_dog > 0 and amount_dog = round(amount_dog, 5)),
  source text not null check (source in ('dog', 'btc', 'migration')),
  -- o que tornou a aplicação única: 'btc:<txid>:<vout>' ou 'migration:<carteira>'; null na automática
  ref text unique,
  created_at timestamptz not null default now(),
  check ((source = 'dog') = (ref is null))
);

create index if not exists dogcity_licence_assignment_wallet_idx
  on public.dogcity_licence_assignment (wallet);
create index if not exists dogcity_licence_assignment_lot_idx
  on public.dogcity_licence_assignment (lot_id);

alter table public.dogcity_licence_assignment enable row level security;

-- uma aplicação é recibo: nunca muda e nunca sai
create or replace function public.dogcity_licence_assignment_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'dogcity_licence_assignment is immutable: an applied credit is a receipt';
end;
$$;

drop trigger if exists dogcity_licence_assignment_imutavel on public.dogcity_licence_assignment;
create trigger dogcity_licence_assignment_imutavel
  before update or delete on public.dogcity_licence_assignment
  for each row execute function public.dogcity_licence_assignment_imutavel();

-- a soma do lote anda junto com a aplicação, na mesma transação
create or replace function public.dogcity_licence_assignment_soma() returns trigger
language plpgsql as $$
begin
  insert into public.dogcity_lot_licence as l (lot_id, total_dog, tier, updated_at)
  values (new.lot_id, new.amount_dog, public.dogcity_licence_tier(new.amount_dog), now())
  on conflict (lot_id) do update
    set total_dog = l.total_dog + excluded.total_dog,
        tier = public.dogcity_licence_tier(l.total_dog + excluded.total_dog),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists dogcity_licence_assignment_soma on public.dogcity_licence_assignment;
create trigger dogcity_licence_assignment_soma
  after insert on public.dogcity_licence_assignment
  for each row execute function public.dogcity_licence_assignment_soma();

-- a licença do lote só se escreve pelo gatilho acima (profundidade 2); escrita direta (profundidade 1) é recusada
create or replace function public.dogcity_lot_licence_so_pela_soma() returns trigger
language plpgsql as $$
begin
  if pg_trigger_depth() < 2 then
    raise exception 'dogcity_lot_licence is written only by dogcity_licence_assignment';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'dogcity_lot_licence: a lot licence is never removed';
  end if;
  return new;
end;
$$;

drop trigger if exists dogcity_lot_licence_so_pela_soma on public.dogcity_lot_licence;
create trigger dogcity_lot_licence_so_pela_soma
  before insert or update or delete on public.dogcity_lot_licence
  for each row execute function public.dogcity_lot_licence_so_pela_soma();

-- ── a cotação em BTC pode nomear o lote ────────────────────────────────────────────────────────────────────────
-- (acrescentar coluna não reescreve linha nem dispara o gatilho de imutabilidade da 034)
alter table public.dogcity_licence_quotes
  add column if not exists lot_id text
  check (lot_id is null or (lot_id ~ '^S[0-9]{2}-Q[0-9]{2}-B[0-9]{3,5}-L[0-9]{3,5}$' and lot_id !~ '^S08-'));

-- ── aplicar: o único caminho de escrita do código ──────────────────────────────────────────────────────────────
-- Devolve o id da aplicação, ou null quando NÃO aplicou porque o mundo mudou desde que o chamador fez a conta
-- (outra aplicação da mesma carteira entrou no meio, ou este `ref` já foi aplicado). null não é erro: a próxima
-- volta refaz a conta. Erro de forma (lote S08, valor <= 0, origem desconhecida) é exceção, pelos checks.
create or replace function public.dogcity_licence_apply(
  p_wallet text,
  p_lot_id text,
  p_amount numeric,
  p_source text,
  p_ref text,
  p_applied_before numeric
) returns uuid
language plpgsql as $$
declare
  v_applied numeric;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('dogcity_licence_apply:' || p_wallet, 0));
  select coalesce(sum(amount_dog), 0) into v_applied
    from public.dogcity_licence_assignment where wallet = p_wallet;
  if round(v_applied, 5) <> round(p_applied_before, 5) then
    return null;
  end if;
  if p_ref is not null and exists (select 1 from public.dogcity_licence_assignment where ref = p_ref) then
    return null;
  end if;
  insert into public.dogcity_licence_assignment (lot_id, wallet, amount_dog, source, ref)
    values (p_lot_id, p_wallet, round(p_amount, 5), p_source, p_ref)
    returning id into v_id;
  return v_id;
end;
$$;

-- Só o service role (rotas do servidor) toca nisto. RLS sem políticas já esconde as linhas; tira também os
-- grants das tabelas e da função dos papéis do cliente.
revoke all on table public.dogcity_lot_licence from anon, authenticated;
revoke all on table public.dogcity_licence_assignment from anon, authenticated;
revoke all on function public.dogcity_licence_apply(text, text, numeric, text, text, numeric) from public, anon, authenticated;
grant execute on function public.dogcity_licence_apply(text, text, numeric, text, text, numeric) to service_role;
