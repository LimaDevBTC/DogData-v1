-- ─── dog_transactions table ─────────────────────────────────────
-- Stores all DOG rune transactions for heatmap and historical analysis
CREATE TABLE IF NOT EXISTS dog_transactions (
  id BIGSERIAL PRIMARY KEY,
  txid TEXT NOT NULL UNIQUE,
  block_height INT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL DEFAULT 'transfer',
  total_dog_moved NUMERIC NOT NULL DEFAULT 0,
  net_transfer NUMERIC NOT NULL DEFAULT 0,
  change_amount NUMERIC NOT NULL DEFAULT 0,
  has_change BOOLEAN NOT NULL DEFAULT FALSE,
  fee_sats INT,
  sender_count INT NOT NULL DEFAULT 0,
  receiver_count INT NOT NULL DEFAULT 0,
  senders JSONB DEFAULT '[]',
  receivers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for heatmap time-range queries
CREATE INDEX IF NOT EXISTS idx_dog_tx_timestamp ON dog_transactions (timestamp);
CREATE INDEX IF NOT EXISTS idx_dog_tx_block ON dog_transactions (block_height);
CREATE INDEX IF NOT EXISTS idx_dog_tx_volume ON dog_transactions (total_dog_moved);
CREATE INDEX IF NOT EXISTS idx_dog_tx_ts_volume ON dog_transactions (timestamp, total_dog_moved);

-- RLS
ALTER TABLE dog_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on dog_transactions" ON dog_transactions
  FOR ALL USING (true) WITH CHECK (true);

-- ─── heatmap_buckets RPC function ───────────────────────────────
-- Aggregates transactions into time buckets for the heatmap grid.
-- Parameters:
--   p_start      - start of the time range (inclusive)
--   p_end        - end of the time range (exclusive)
--   p_bucket_secs - width of each bucket in seconds
-- Returns one row per bucket with pre-aggregated metrics.
CREATE OR REPLACE FUNCTION heatmap_buckets(
  p_start TIMESTAMPTZ,
  p_end   TIMESTAMPTZ,
  p_bucket_secs INT
)
RETURNS TABLE (
  bucket_idx    INT,
  tx_count      BIGINT,
  volume        NUMERIC,
  avg_fee       NUMERIC,
  whale_volume  NUMERIC,
  has_whale     BOOLEAN,
  retail_volume NUMERIC,
  medium_volume NUMERIC,
  large_volume  NUMERIC,
  net_flow      NUMERIC
)
LANGUAGE sql STABLE
AS $$
  SELECT
    FLOOR(EXTRACT(EPOCH FROM (timestamp - p_start)) / p_bucket_secs)::INT AS bucket_idx,
    COUNT(*)                                      AS tx_count,
    COALESCE(SUM(total_dog_moved), 0)             AS volume,
    AVG(fee_sats)                                 AS avg_fee,
    COALESCE(SUM(CASE WHEN total_dog_moved >= 1000000 THEN total_dog_moved ELSE 0 END), 0) AS whale_volume,
    BOOL_OR(total_dog_moved >= 1000000)           AS has_whale,
    COALESCE(SUM(CASE WHEN total_dog_moved < 10000 THEN total_dog_moved ELSE 0 END), 0)    AS retail_volume,
    COALESCE(SUM(CASE WHEN total_dog_moved >= 10000 AND total_dog_moved < 100000 THEN total_dog_moved ELSE 0 END), 0) AS medium_volume,
    COALESCE(SUM(CASE WHEN total_dog_moved >= 100000 AND total_dog_moved < 1000000 THEN total_dog_moved ELSE 0 END), 0) AS large_volume,
    COALESCE(SUM(net_transfer), 0)                AS net_flow
  FROM dog_transactions
  WHERE timestamp >= p_start
    AND timestamp < p_end
  GROUP BY bucket_idx
  ORDER BY bucket_idx;
$$;
