-- ═══════════════════════════════════════════════════════════════════════════════
-- 007_dogcity_reorganize — ReorganizeCity (reorganizecity.md)
--
-- Adds the columns the age-organised, plaza-centred city needs on top of the
-- crosschaincity registry (006):
--   • kind        — 'build' (≥10k DOG) | 'open' (1-10k DOG green space). <1 DOG dust
--                   is dropped entirely (never gets a row).
--   • utxo_count  — drives building FORM: few UTXOs = one tower, many = low condo.
--   • age_score   — the centrality metric: age (days) of the wallet's oldest UTXO
--                   ≥10k DOG (fallback: its oldest UTXO). Higher = closer to plaza.
--   • prestige    — 1-5 star rating (age + accumulation + LTH) shown in the profile.
--
-- Run in the Supabase SQL editor after 006. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE dogcity_lots
  ADD COLUMN IF NOT EXISTS kind       TEXT NOT NULL DEFAULT 'build',   -- 'build' | 'open'
  ADD COLUMN IF NOT EXISTS utxo_count INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS age_score  DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prestige   SMALLINT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_dogcity_lots_kind ON dogcity_lots (kind);
