-- ─── Bitcoin transaction classification (per-block + daily rollup) ─────────────
-- Stores aggregated counts per (block, class) and per (day, class).
-- Source: scripts/tx_classifier.py — classes are
--   coinbase | runes | inscription | op_return_protocol | op_return_other | financial
-- subclass_counts (JSONB) holds protocol breakdown for op_return_protocol
--   e.g. {"babylon": 2, "thorchain": 13, "lifi": 3}

-- ── 1. Per-block aggregates ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tx_class_block (
  height          INT  NOT NULL,
  class           TEXT NOT NULL,
  count           INT  NOT NULL,
  subclass_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  block_hash      TEXT NOT NULL,
  block_time      TIMESTAMPTZ NOT NULL,
  tx_count_total  INT  NOT NULL,                 -- redundante, evita JOIN no rollup
  inserted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (height, class)
);

CREATE INDEX IF NOT EXISTS idx_tx_class_block_time      ON tx_class_block (block_time);
CREATE INDEX IF NOT EXISTS idx_tx_class_block_class     ON tx_class_block (class, block_time);

ALTER TABLE tx_class_block ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on tx_class_block" ON tx_class_block
  FOR ALL USING (true) WITH CHECK (true);


-- ── 2. Daily rollup (UI/API consumes this) ────────────────────────────────
CREATE TABLE IF NOT EXISTS tx_class_daily (
  day             DATE NOT NULL,
  class           TEXT NOT NULL,
  count           BIGINT NOT NULL,
  subclass_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  tx_count_total  BIGINT NOT NULL,                -- soma de tx_count_total dos blocos do dia
  blocks_in_day   INT  NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (day, class)
);

CREATE INDEX IF NOT EXISTS idx_tx_class_daily_day_class ON tx_class_daily (day, class);

ALTER TABLE tx_class_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on tx_class_daily" ON tx_class_daily
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read on tx_class_daily" ON tx_class_daily
  FOR SELECT USING (true);


-- ── 3. Function: rebuild rollup for a given day from tx_class_block ────────
-- Idempotente: deleta linhas do dia e reinsere.
-- tx_count_total e blocks_in_day são totais do DIA inteiro (iguais para todas as classes).
CREATE OR REPLACE FUNCTION refresh_tx_class_daily(p_day DATE)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_total BIGINT;
  v_blocks INT;
BEGIN
  SELECT
    COALESCE(SUM(per_block.tx_count_total), 0),
    COALESCE(COUNT(*), 0)
  INTO v_total, v_blocks
  FROM (
    SELECT DISTINCT height, tx_count_total
    FROM tx_class_block
    WHERE block_time::DATE = p_day
  ) per_block;

  DELETE FROM tx_class_daily WHERE day = p_day;

  INSERT INTO tx_class_daily (day, class, count, subclass_counts, tx_count_total, blocks_in_day, updated_at)
  SELECT
    p_day                                              AS day,
    class                                              AS class,
    SUM(count)::BIGINT                                 AS count,
    COALESCE(
      (SELECT jsonb_object_agg(k, v)
       FROM (
         SELECT key AS k, SUM((value)::int) AS v
         FROM tx_class_block b2,
              LATERAL jsonb_each_text(b2.subclass_counts)
         WHERE b2.block_time::DATE = p_day
           AND b2.class = b1.class
         GROUP BY key
       ) sub),
      '{}'::jsonb
    )                                                  AS subclass_counts,
    v_total                                            AS tx_count_total,
    v_blocks                                           AS blocks_in_day,
    NOW()                                              AS updated_at
  FROM tx_class_block b1
  WHERE block_time::DATE = p_day
  GROUP BY class;
END;
$$;


-- ── 4. Convenience view: pivoted % per day (chart-friendly) ────────────────
CREATE OR REPLACE VIEW tx_class_daily_pct AS
SELECT
  day,
  MAX(tx_count_total) AS tx_count_total,
  ROUND(100.0 * SUM(CASE WHEN class = 'financial'          THEN count ELSE 0 END) / NULLIF(MAX(tx_count_total),0), 2) AS pct_financial,
  ROUND(100.0 * SUM(CASE WHEN class = 'runes'              THEN count ELSE 0 END) / NULLIF(MAX(tx_count_total),0), 2) AS pct_runes,
  ROUND(100.0 * SUM(CASE WHEN class = 'inscription'        THEN count ELSE 0 END) / NULLIF(MAX(tx_count_total),0), 2) AS pct_inscription,
  ROUND(100.0 * SUM(CASE WHEN class = 'op_return_protocol' THEN count ELSE 0 END) / NULLIF(MAX(tx_count_total),0), 2) AS pct_op_return_protocol,
  ROUND(100.0 * SUM(CASE WHEN class = 'op_return_other'    THEN count ELSE 0 END) / NULLIF(MAX(tx_count_total),0), 2) AS pct_op_return_other,
  ROUND(100.0 * SUM(CASE WHEN class = 'coinbase'           THEN count ELSE 0 END) / NULLIF(MAX(tx_count_total),0), 2) AS pct_coinbase
FROM tx_class_daily
GROUP BY day
ORDER BY day;
