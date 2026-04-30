-- Migration: Explorer historical backfill — add denormalized address index
-- Run in Supabase SQL Editor (Dashboard → SQL → New Query)

-- 1. Denormalized addresses array (union of all senders + receivers)
ALTER TABLE dog_transactions
  ADD COLUMN IF NOT EXISTS addresses TEXT[];

-- 2. GIN index for fast `addresses && ARRAY['bc1...']` lookups
CREATE INDEX IF NOT EXISTS idx_dog_tx_addresses
  ON dog_transactions USING gin (addresses);

-- 3. Block height index (for ordering / range queries)
CREATE INDEX IF NOT EXISTS idx_dog_tx_block_height
  ON dog_transactions (block_height DESC);

-- 4. Unique txid index (also enforces dedup on upsert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dog_tx_txid_unique
  ON dog_transactions (txid);

-- 5. Backfill existing rows: extract addresses from senders/receivers JSON strings.
--    Usa regex pra só castar quando o valor começa com '[' (JSON array válido).
UPDATE dog_transactions
SET addresses = COALESCE(
  (
    SELECT ARRAY(
      SELECT DISTINCT addr FROM (
        SELECT (elem->>'address') AS addr
        FROM jsonb_array_elements(
          CASE WHEN senders::text ~ '^\s*\[' THEN senders::text::jsonb ELSE '[]'::jsonb END
        ) AS elem
        UNION ALL
        SELECT (elem->>'address') AS addr
        FROM jsonb_array_elements(
          CASE WHEN receivers::text ~ '^\s*\[' THEN receivers::text::jsonb ELSE '[]'::jsonb END
        ) AS elem
      ) AS combined
      WHERE addr IS NOT NULL
    )
  ),
  ARRAY[]::TEXT[]
)
WHERE addresses IS NULL;
