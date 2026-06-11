#!/usr/bin/env bash
# ─── Post-backfill watcher (unattended) ──────────────────────────────────────
# Waits for the EMIT_EVENTS replay to finish, then:
#   1. ensures the live scanner is back (the runner's trap should restart it;
#      this is a belt-and-suspenders fallback),
#   2. runs F1-T5 reconciliation,
#   3. waits for the scanner to catch up to chain tip,
#   4. fires ONE automated_update to resume the hourly pipeline that was paused
#      during the replay (the rest is handled by the existing hourly cron).
# All output → a timestamped summary log.
set -uo pipefail

PROJ=/home/bitmax/Projects/bitcoin-fullstack/DogData-v1
SVC=dog-scanner.service
cd "$PROJ"
SUM="$PROJ/logs/post_backfill_$(date +%Y%m%d_%H%M%S).log"
exec > "$SUM" 2>&1

echo "════════════════════════════════════════════════════════════"
echo "[$(date)] post-backfill watcher started — summary: $SUM"

# ── 1. Wait for the replay to finish ─────────────────────────────────────────
echo "[$(date)] waiting for replay_dog_history to finish…"
while pgrep -f replay_dog_history >/dev/null 2>&1; do sleep 30; done
echo "[$(date)] replay process gone. Giving the runner's trap time to restart scanner…"
sleep 20

# ── 2. Ensure scanner is active ──────────────────────────────────────────────
state=$(systemctl is-active "$SVC" 2>/dev/null)
echo "[$(date)] scanner after trap: $state"
if [ "$state" != "active" ]; then
  echo "[$(date)] scanner not active — starting it (fallback)"
  sudo -n systemctl start "$SVC" && echo "  started" || echo "  ‼️ FAILED — run: sudo systemctl start $SVC"
  sleep 5
  echo "[$(date)] scanner now: $(systemctl is-active "$SVC")"
fi

# ── 3. F1-T5 reconciliation ──────────────────────────────────────────────────
echo ""
echo "════════ F1-T5 RECONCILIATION ════════"
python3 scripts/reconcile_utxo_events.py
echo ""

# ── 4. Wait for the scanner to catch up to tip ───────────────────────────────
tip=$(bitcoin-cli getblockcount 2>/dev/null || echo 0)
echo "[$(date)] chain tip: $tip — waiting for scanner to catch up (max ~10min)…"
for i in $(seq 1 40); do
  lb=$(python3 -c "import json;print(json.load(open('data/scanner_state.json'))['last_block'])" 2>/dev/null || echo 0)
  echo "  scanner last_block=$lb / tip=$tip"
  [ "$lb" -ge "$((tip-2))" ] && { echo "  ✅ caught up"; break; }
  sleep 15
done

# ── 5. Resume the hourly pipeline immediately (was paused since yesterday) ────
echo ""
echo "════════ CATCH-UP automated_update (resume hourly pipeline) ════════"
echo "[$(date)] running automated_update.py once to refresh paused data…"
/usr/bin/python3 scripts/automated_update.py >> "$PROJ/logs/automated_update.log" 2>&1 \
  && echo "[$(date)] ✅ automated_update finished (see logs/automated_update.log)" \
  || echo "[$(date)] ⚠️ automated_update returned non-zero — next hourly cron will retry"

echo ""
echo "[$(date)] ════ POST-BACKFILL COMPLETE ════"
echo "scanner: $(systemctl is-active "$SVC") | scanner last_block: $(python3 -c "import json;print(json.load(open('data/scanner_state.json'))['last_block'])" 2>/dev/null)"
echo "hourly cron intact (resumes on its own each :00)."
