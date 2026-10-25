-- Migration 035: the referral board (phase 1: count only). WRITTEN, NOT APPLIED.
--
-- Founder decision (25/10/2026): phase 1 only COUNTS. A public board shows how many referrals each
-- verified account brought; what that unlocks is announced later, with the data in hand. Everything
-- here is off-chain, in DogData. Rules and fields: referral.md at the repo root.
--
-- Four things live here:
--   wallet_first_verify  one row per wallet, written the FIRST time it proves ownership (/api/wallet/verify).
--                        It is how "first verification only" stays true: a wallet that is already here can
--                        never be claimed by a referral link. Append-only.
--   referral_links       the link wallet -> referrer. ONE referrer per wallet, the first, for good: the
--                        primary key is the unique index on the referred wallet, and a trigger refuses any
--                        update or delete. A wallet cannot refer itself.
--   referral_progress    what each referred wallet did AFTER the link (lots minted, licence paid, in $DOG).
--                        DERIVED data filled by the cron /api/cron/referrals; safe to truncate, the cron
--                        rebuilds it from referral_links and the sources.
--   referral_board()     the board in one cheap call: aggregates the three small tables. The public
--                        route caches it at the CDN; nothing scans a big table per request (the IO
--                        exhaustion of 26/08 is why).
--
-- Written and read ONLY by server routes (service role). RLS on, ZERO policies, like 006/033/034: the anon
-- role sees nothing. No personal data is added: wallet addresses already live in dogcity_profiles; the only
-- new facts are "when did this wallet first verify" and "who referred it". Public repo: no secret here.
--
-- SAFE ORDER (see the PR): apply this BEFORE merging the code. The code fails closed without it (no link
-- is made, /api/wallet/verify keeps working), but wallets that verify while the tables are missing would
-- not be recorded as already verified. The backfill below is idempotent: it can be run again right after
-- the deploy goes live to close that window.

-- 1. wallet_first_verify ------------------------------------------------------------------------------
create table if not exists public.wallet_first_verify (
  address text primary key check (length(address) between 26 and 90),
  first_verified_at timestamptz not null default now(),
  -- 'verify' = recorded live by /api/wallet/verify; backfill_* = known before this migration existed
  source text not null default 'verify' check (source in ('verify', 'backfill_profile', 'backfill_analytics'))
);

alter table public.wallet_first_verify enable row level security;

create or replace function public.referral_append_only() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only: no update, no delete', tg_table_name;
end;
$$;

drop trigger if exists wallet_first_verify_append_only on public.wallet_first_verify;
create trigger wallet_first_verify_append_only
  before update or delete on public.wallet_first_verify
  for each row execute function public.referral_append_only();

-- 2. referral_links -----------------------------------------------------------------------------------
create table if not exists public.referral_links (
  -- the wallet that was referred. PRIMARY KEY = the unique index: one referrer per wallet.
  referred_address text primary key check (length(referred_address) between 26 and 90),
  -- the account that referred it (a verified account: its handle only exists after proof of ownership)
  referrer_address text not null check (length(referrer_address) between 26 and 90),
  -- the referrer's handle at link time, for audit only (handles can be renamed; the address is the key)
  referrer_handle text not null check (referrer_handle ~ '^[a-z0-9_]{3,15}$'),
  linked_at timestamptz not null default now(),
  -- chain tip when the link was made; null when no explorer answered. "After the link" means a block
  -- strictly greater than this; without it the program falls back to time.
  linked_block integer check (linked_block is null or linked_block > 0),
  check (referred_address <> referrer_address)
);

create index if not exists referral_links_referrer_idx on public.referral_links (referrer_address);

alter table public.referral_links enable row level security;

-- "The first referrer, for good": a link is never moved, re-pointed or removed by code. Correcting
-- abuse is a deliberate human act (drop the trigger, fix, recreate it), never a side effect.
drop trigger if exists referral_links_append_only on public.referral_links;
create trigger referral_links_append_only
  before update or delete on public.referral_links
  for each row execute function public.referral_append_only();

-- 3. referral_progress --------------------------------------------------------------------------------
create table if not exists public.referral_progress (
  referred_address text primary key references public.referral_links (referred_address),
  -- lots whose deed was minted in a block after the link
  minted_lots integer not null default 0 check (minted_lots >= 0),
  first_mint_block integer,
  -- $DOG paid to the building fund AFTER the link (DOG plus BTC at the locked $DOG value), and the
  -- licence tier those later payments reach (citizen = below Personal = not a licence)
  licence_dog numeric not null default 0 check (licence_dog >= 0),
  licence_tier text not null default 'citizen' check (licence_tier in ('citizen', 'personal', 'commercial', 'patron')),
  -- every minted lot already resolved to a block, {lotId: {b: block, t: block time ms}}; a confirmed
  -- mint never changes, so the cron does not ask for it again
  mint_lots jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

alter table public.referral_progress enable row level security;

-- 4. the cron's queue: never-checked wallets first, then the oldest check ---------------------------------
create or replace function public.referral_next_batch(p_limit int default 80)
returns table (referred_address text, referrer_address text, linked_at timestamptz, linked_block integer, mint_lots jsonb)
language sql stable security definer set search_path = public as $$
  select l.referred_address, l.referrer_address, l.linked_at, l.linked_block, coalesce(p.mint_lots, '{}'::jsonb)
    from public.referral_links l
    left join public.referral_progress p on p.referred_address = l.referred_address
   order by p.checked_at asc nulls first, l.linked_at asc
   limit least(greatest(p_limit, 1), 500)
$$;

-- 5. the board ----------------------------------------------------------------------------------------
-- One row per referrer. Ranked by referrals brought; ties by wallets that minted, then $DOG of licences,
-- then who started first. p_referrer narrows to one account (the profile page). The two window totals
-- count ALL referrers and ALL referrals, not only the rows under the limit.
create or replace function public.referral_board(p_limit int default 100, p_referrer text default null)
returns table (
  referrer_address text,
  handle text,
  referred bigint,
  minted bigint,
  minted_lots bigint,
  licences_personal bigint,
  licences_commercial bigint,
  licences_patron bigint,
  licence_dog numeric,
  counted_at timestamptz,
  referrers_total bigint,
  referred_total bigint
)
language sql stable security definer set search_path = public as $$
  select l.referrer_address,
         max(h.handle) as handle,
         count(*) as referred,
         count(*) filter (where coalesce(p.minted_lots, 0) > 0) as minted,
         coalesce(sum(p.minted_lots), 0)::bigint as minted_lots,
         count(*) filter (where p.licence_tier = 'personal') as licences_personal,
         count(*) filter (where p.licence_tier = 'commercial') as licences_commercial,
         count(*) filter (where p.licence_tier = 'patron') as licences_patron,
         coalesce(sum(p.licence_dog), 0) as licence_dog,
         max(p.checked_at) as counted_at,
         count(*) over () as referrers_total,
         sum(count(*)) over ()::bigint as referred_total
    from public.referral_links l
    left join public.referral_progress p on p.referred_address = l.referred_address
    left join public.dogcity_profiles h on h.address = l.referrer_address
   where p_referrer is null or l.referrer_address = p_referrer
   group by l.referrer_address
   order by count(*) desc,
            count(*) filter (where coalesce(p.minted_lots, 0) > 0) desc,
            coalesce(sum(p.licence_dog), 0) desc,
            min(l.linked_at) asc
   limit least(greatest(p_limit, 1), 500)
$$;

-- the functions run as their owner (security definer) and are for the server only
revoke all on function public.referral_next_batch(int) from public, anon, authenticated;
revoke all on function public.referral_board(int, text) from public, anon, authenticated;
grant execute on function public.referral_next_batch(int) to service_role;
grant execute on function public.referral_board(int, text) to service_role;

-- 6. backfill: wallets that verified BEFORE this table existed ----------------------------------------
-- A profile (handle) and an analytics bridge row both exist only after a proven signature, so their
-- addresses have verified before. They go in as already verified, so no link can claim them. Idempotent.
-- Run it in a calm window: it reads dogcity_profiles and analytics_identity once.
insert into public.wallet_first_verify (address, first_verified_at, source)
select p.address, p.created_at, 'backfill_profile'
  from public.dogcity_profiles p
 where length(p.address) between 26 and 90
on conflict (address) do nothing;

insert into public.wallet_first_verify (address, first_verified_at, source)
select case when i.address ilike 'bc1%' then lower(i.address) else i.address end,
       min(i.first_linked_at), 'backfill_analytics'
  from public.analytics_identity i
 where length(i.address) between 26 and 90
 group by 1
on conflict (address) do nothing;

comment on table public.wallet_first_verify is 'One row per wallet, written the first time it proves ownership. Append-only. Lets the referral program refuse to claim a wallet that already verified.';
comment on table public.referral_links is 'Referral link: referred wallet -> referrer account. One referrer per wallet, the first, for good (primary key plus append-only trigger). Written only by /api/wallet/verify.';
comment on table public.referral_progress is 'Derived, rebuildable: what each referred wallet did after the link (lots minted, licence paid in DOG). Filled by /api/cron/referrals.';
