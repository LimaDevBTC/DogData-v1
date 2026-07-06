-- ═══════════════════════════════════════════════════════════════════════════════
-- 006_dogcity_lots — CrossChainCity registry (crosschaincity.md · BLOCO A)
--
-- The foundation of the living, multichain DogCity. Inverts the old model where
-- app/api/city/data regenerated every position from sort(dog) on each request:
-- here the position is a STORED FACT, minted once per address and never moved.
--
--   • one wallet  = one permanent lot (address is the PK)
--   • a wallet that zeroes → state='ruin' (lot preserved, last_balance=0)
--   • it comes back      → state='active' on the SAME lot
--
-- Run in the Supabase SQL Editor (Dashboard → SQL → New Query). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dogcity_lots (
  address       TEXT PRIMARY KEY,
  chain         TEXT NOT NULL,             -- 'bitcoin' | 'solana' | 'stacks'
  zone          TEXT NOT NULL,             -- macro-zone: 'btc-core' | 'solana' | 'stacks'
  district      SMALLINT NOT NULL,         -- wealth district within the zone (0-9)
  lot_x         REAL NOT NULL,             -- permanent world position
  lot_z         REAL NOT NULL,
  rot           REAL NOT NULL DEFAULT 0,
  street        TEXT,                      -- BLOCO E: named street
  number        INT,                       -- BLOCO E: building number along the street
  state         TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'ruin'
  last_balance  DOUBLE PRECISION NOT NULL DEFAULT 0,   -- balance at last snapshot (for diff)
  height_tier   SMALLINT NOT NULL DEFAULT 0,
  footprint     REAL NOT NULL DEFAULT 4,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dogcity_lots_zone    ON dogcity_lots (zone);
CREATE INDEX IF NOT EXISTS idx_dogcity_lots_state   ON dogcity_lots (state);
CREATE INDEX IF NOT EXISTS idx_dogcity_lots_updated ON dogcity_lots (updated_at DESC);

-- ─── Per-zone/district mint cursor ─────────────────────────────────────────────
-- A monotonic counter per (zone, district). The lot index it hands out is fed to
-- the deterministic spiral in lib/city/zones.ts to derive a fresh, collision-free
-- world position at the frontier. Bumping the counter is the ONLY write that must
-- be serialized, which the RPC below does atomically — so two concurrent requests
-- can never mint the same lot.
CREATE TABLE IF NOT EXISTS dogcity_cursors (
  zone      TEXT NOT NULL,
  district  SMALLINT NOT NULL,
  next_idx  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (zone, district)
);

-- Atomically reserve `p_n` consecutive lot indices for (zone, district) and return
-- the FIRST index of the reserved block. The INSERT … ON CONFLICT … RETURNING is a
-- single statement executed under a row lock, so the read-modify-write is atomic
-- and two concurrent requests can never receive overlapping index blocks.
CREATE OR REPLACE FUNCTION dogcity_reserve_lots(p_zone TEXT, p_district SMALLINT, p_n INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_start INT;
BEGIN
  INSERT INTO dogcity_cursors AS c (zone, district, next_idx)
    VALUES (p_zone, p_district, p_n)
  ON CONFLICT (zone, district)
    DO UPDATE SET next_idx = c.next_idx + EXCLUDED.next_idx
  RETURNING c.next_idx - p_n INTO v_start;
  RETURN v_start;
END;
$$;

-- ─── Event log (BLOCO C) ───────────────────────────────────────────────────────
-- A small append-only ring the client polls (?since=<id>) to animate the delta of
-- the last snapshot: construct / implode / resize / rebuild. Only the hour's delta
-- lands here (a handful of rows next to 86k lots), so polling stays cheap. Old rows
-- are pruned by the committer to keep the table bounded.
CREATE TABLE IF NOT EXISTS dogcity_events (
  id           BIGSERIAL PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  address      TEXT NOT NULL,
  zone         TEXT NOT NULL,
  district     SMALLINT NOT NULL,
  event        TEXT NOT NULL,             -- 'construct' | 'implode' | 'resize' | 'rebuild'
  lot_x        REAL NOT NULL,
  lot_z        REAL NOT NULL,
  height_tier  SMALLINT NOT NULL DEFAULT 0,
  footprint    REAL NOT NULL DEFAULT 4
);

CREATE INDEX IF NOT EXISTS idx_dogcity_events_id ON dogcity_events (id DESC);
