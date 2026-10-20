-- Migration 034: DogCity licences paid in Bitcoin.
--
-- A licence is still priced in $DOG (Personal 10,000, Commercial 50,000, Patron
-- 500,000). A wallet may pay the same value in BTC. Two tables hold the money trail:
--
--   dogcity_licence_quotes   the 15 minute price lock. One row per quote request. It links
--                            the PAYMENT address to the ORDINALS address of the same wallet,
--                            which is how DOG and BTC of one wallet are added together.
--   dogcity_btc_payments     every payment seen at the fund's Bitcoin address, with how it
--                            was (or was not) credited to an ordinals address.
--
-- BTC NEVER counts toward the 10,000,000 $DOG that triggers the mint. Nothing here is read by
-- /api/donate/leaderboard's total_received, by lib/dog/mint-b.ts or by /api/dogcity/mint-b.
--
-- Written and read ONLY by server routes (service role). RLS on, zero policies, like 006/033:
-- the anon role sees nothing. Public repo: no secret in this file.

create table if not exists public.dogcity_licence_quotes (
  id uuid primary key default gen_random_uuid(),
  tier text not null check (tier in ('personal', 'commercial', 'patron')),
  -- the wallet's ordinals (taproot) address: where the credit lands
  ordinals_address text not null check (length(ordinals_address) between 26 and 90),
  -- the address that will pay: the payment tx must spend from it
  payment_address text not null check (length(payment_address) between 26 and 90),
  -- the licence value in $DOG at quote time (10000, 50000 or 500000)
  dog_amount numeric not null check (dog_amount > 0),
  -- exact sats to pay inside the lock
  sats bigint not null check (sats > 0),
  dog_usd numeric not null check (dog_usd > 0),
  btc_usd numeric not null check (btc_usd > 0),
  -- which exchanges made the median, for audit
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

create index if not exists dogcity_licence_quotes_payment_idx
  on public.dogcity_licence_quotes (payment_address, created_at desc);
create index if not exists dogcity_licence_quotes_ordinals_idx
  on public.dogcity_licence_quotes (ordinals_address);

alter table public.dogcity_licence_quotes enable row level security;

-- A quote is a receipt of a price that was promised: it never changes and is never deleted.
create or replace function public.dogcity_licence_quotes_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'dogcity_licence_quotes is immutable: a quote is a receipt';
end;
$$;

drop trigger if exists dogcity_licence_quotes_imutavel on public.dogcity_licence_quotes;
create trigger dogcity_licence_quotes_imutavel
  before update or delete on public.dogcity_licence_quotes
  for each row execute function public.dogcity_licence_quotes_imutavel();


create table if not exists public.dogcity_btc_payments (
  txid text not null check (txid ~ '^[0-9a-f]{64}$'),
  vout integer not null check (vout >= 0),
  -- value of this output to the fund's Bitcoin address
  sats bigint not null check (sats > 0),
  -- every address that funded the tx (lowercase for bech32)
  payer_addresses text[] not null default '{}',
  -- the earliest evidence that the network had this tx: our first sweep or mempool.space
  first_seen_at timestamptz not null,
  block_height integer,
  block_time timestamptz,
  -- observed       not enough confirmations yet
  -- credited       counted toward an ordinals address (immutable from here on)
  -- unmatched      no quote links the payer: general support, never a licence
  -- pending_review a human decides: ambiguous owner, underpaid for the quote, above the
  --                ceiling, or no reliable price (that last one retries by itself)
  status text not null default 'observed'
    check (status in ('observed', 'credited', 'unmatched', 'pending_review')),
  review_reason text,
  ordinals_address text,
  quote_id uuid references public.dogcity_licence_quotes (id),
  -- value credited, in $DOG, at the rate named in `basis`
  credit_dog numeric check (credit_dog is null or credit_dog > 0),
  -- quote: the locked rate. block: the median at the confirming block's time.
  basis text check (basis is null or basis in ('quote', 'block')),
  dog_usd numeric,
  btc_usd numeric,
  credited_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (txid, vout),
  -- a credited row is complete, and only a credited row carries a credit
  check (
    (status = 'credited' and ordinals_address is not null and quote_id is not null
      and credit_dog is not null and basis is not null and dog_usd > 0 and btc_usd > 0
      and credited_at is not null)
    or (status <> 'credited' and credit_dog is null)
  )
);

create index if not exists dogcity_btc_payments_ordinals_idx
  on public.dogcity_btc_payments (ordinals_address) where status = 'credited';
create index if not exists dogcity_btc_payments_status_idx
  on public.dogcity_btc_payments (status);

alter table public.dogcity_btc_payments enable row level security;

-- A credit is never re-priced, moved or removed by code. Fixing a mistake is a deliberate
-- human act (drop the trigger, correct, recreate it), never a side effect of a sweep.
create or replace function public.dogcity_btc_payments_credito_imutavel() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'credited' then
      raise exception 'dogcity_btc_payments: a credited payment cannot be deleted';
    end if;
    return old;
  end if;
  if old.status = 'credited' then
    raise exception 'dogcity_btc_payments: a credited payment is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists dogcity_btc_payments_credito_imutavel on public.dogcity_btc_payments;
create trigger dogcity_btc_payments_credito_imutavel
  before update or delete on public.dogcity_btc_payments
  for each row execute function public.dogcity_btc_payments_credito_imutavel();
