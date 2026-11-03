-- Migration 036: DogCity game save + daily check-in. WRITTEN, NOT APPLIED (the coordinator applies it).
--
-- Two small tables behind /api/game/save and /api/game/checkin (see lib/game/checkin.ts):
--   dogcity_game_saves     one row per verified wallet: the whole `dogcity.jogo.v1` envelope as jsonb
--                          (the route caps it at 64 KB). Last write wins.
--   dogcity_game_checkins  one row per (wallet, game day). The game day turns at 08:00 UTC. The primary key
--                          is what makes the daily check-in idempotent: a second POST the same day is a no-op.
--
-- Written and read ONLY by server routes (service role), after the dg_wallet session is resolved. RLS on,
-- ZERO policies, like 006/033/034/035: the anon role sees nothing. Wallet addresses already live in
-- dogcity_profiles; no new personal data. Public repo: no secret here.
--
-- Safe order: apply BEFORE merging the code. Without the tables the routes answer 500 and the game keeps
-- working from localStorage.

create table if not exists public.dogcity_game_saves (
  wallet text primary key check (length(wallet) between 26 and 90),
  save jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.dogcity_game_saves enable row level security;

create table if not exists public.dogcity_game_checkins (
  wallet text not null check (length(wallet) between 26 and 90),
  day date not null,
  created_at timestamptz not null default now(),
  primary key (wallet, day)
);

alter table public.dogcity_game_checkins enable row level security;

-- Belt and braces: RLS with zero policies already hides the rows; also take the table grants away from the
-- client roles, so only the service role (server routes) touches them.
revoke all on table public.dogcity_game_saves from anon, authenticated;
revoke all on table public.dogcity_game_checkins from anon, authenticated;
