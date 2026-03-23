-- ─── Block-based heatmap bucketing function ─────────────────────
-- Groups transactions by block_height ranges instead of time.
-- Each cell in the heatmap represents a range of Bitcoin blocks.
CREATE OR REPLACE FUNCTION heatmap_block_buckets(
  p_start_block INT,
  p_end_block   INT,
  p_blocks_per_bucket INT
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
    FLOOR((block_height - p_start_block)::NUMERIC / p_blocks_per_bucket)::INT AS bucket_idx,
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
  WHERE block_height >= p_start_block
    AND block_height < p_end_block
  GROUP BY bucket_idx
  ORDER BY bucket_idx;
$$;
