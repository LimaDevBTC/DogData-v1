-- ─── utxo_events ────────────────────────────────────────────────────────────
-- The foundation table for the on-chain metrics catalog (F1-T1).
--
-- One row per DOG UTXO ever created. The row is INSERTed on creation and
-- UPDATEd in place when the UTXO is spent (spent_* stay NULL while it is live).
-- This is exactly what scan_block() already computes — it returns
-- (tx_data, new_utxos, spent_outpoints); today the spend info is discarded
-- after updating the in-memory UTXO set. F1-T2 instruments that path to persist
-- here.
--
-- Cost basis convention (matches production update_holders_and_fees.py):
--   created_price_usd = DOG price on the block where the UTXO was created
--   spent_price_usd   = DOG price on the block where the UTXO was spent
-- These two prices unlock realized cap, MVRV, supply-in-profit, SOPR, CDD,
-- realized P&L, NUPL — i.e. half the catalog.
--
-- Scale note: lifetime DOG UTXOs are on the order of 1-2M rows. Postgres
-- handles that comfortably WITHOUT partitioning, so we keep a plain table with
-- targeted indexes. Revisit partitioning only if row count grows >50M.

CREATE TABLE IF NOT EXISTS utxo_events (
  outpoint          TEXT PRIMARY KEY,          -- 'txid:vout'
  txid              TEXT NOT NULL,
  vout              INT  NOT NULL,
  address           TEXT,                      -- receiver address ('unknown' if unresolved)
  amount_dog        NUMERIC NOT NULL,          -- DOG units (raw / 100000)
  is_change         BOOLEAN NOT NULL DEFAULT FALSE,

  created_block     INT NOT NULL,
  created_ts        TIMESTAMPTZ NOT NULL,
  created_price_usd NUMERIC,                    -- NULL if price unknown for that date

  spent_block       INT,                        -- NULL while the UTXO is live
  spent_ts          TIMESTAMPTZ,
  spent_price_usd   NUMERIC,
  spent_txid        TEXT,                        -- tx that spent this UTXO

  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Live UTXO set (spent_block IS NULL): used to reconcile vs `ord balances`
-- and to snapshot current-state metrics. Partial index keeps it small/fast.
CREATE INDEX IF NOT EXISTS idx_utxo_events_live
  ON utxo_events (address) WHERE spent_block IS NULL;

-- Daily state reconstruction: "UTXOs alive on day D" = created <= D AND
-- (spent IS NULL OR spent > D). These two indexes serve the range scans.
CREATE INDEX IF NOT EXISTS idx_utxo_events_created ON utxo_events (created_block);
CREATE INDEX IF NOT EXISTS idx_utxo_events_spent   ON utxo_events (spent_block);
CREATE INDEX IF NOT EXISTS idx_utxo_events_created_ts ON utxo_events (created_ts);
CREATE INDEX IF NOT EXISTS idx_utxo_events_spent_ts   ON utxo_events (spent_ts);

-- Flow metrics (SOPR / CDD / realized P&L) aggregate spends per day.
CREATE INDEX IF NOT EXISTS idx_utxo_events_address ON utxo_events (address);

-- RLS — match the project convention (service role full access).
ALTER TABLE utxo_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on utxo_events" ON utxo_events;
CREATE POLICY "Service role full access on utxo_events" ON utxo_events
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Convenience: current live-supply sanity check ──────────────────────────
-- SELECT COUNT(*) live_utxos, SUM(amount_dog) live_supply
-- FROM utxo_events WHERE spent_block IS NULL;
--   Expected after F1-T4 backfill: ~246k UTXOs, ~99.97B DOG (matches ord balances).
