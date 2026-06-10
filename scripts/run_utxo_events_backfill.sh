#!/usr/bin/env bash
# ─── F1-T4: utxo_events backfill runner ──────────────────────────────────────
# Full from-genesis DOG replay that emits the utxo_events log (CREATE+SPEND per
# outpoint, with cost-basis price). This is the accurate foundation the Phase 0
# spike proved we need (the offline block-file path had a ~6% supply gap).
#
# Sequence (mirrors replay_dog_history.py docstring):
#   1. Stop the live scanner  → releases the ord index lock (single-writer redb)
#   2. Force a from-genesis replay (reset replay_state + drop replay_utxo_set)
#   3. Run replay with EMIT_EVENTS=1 → writes data/utxo_events.jsonl
#   4. ALWAYS restart the scanner (trap on EXIT, even on failure/interrupt)
#
# Safety:
#   - Touches only the ISOLATED replay files; production dog_utxo_set.json and
#     dog_holders.json are never written by the replay.
#   - The scanner is restarted no matter how this script exits.
#
# Requires: passwordless sudo for `systemctl stop/start dog-scanner.service`
#   (a cron/at run has no tty). If sudo needs a password this aborts cleanly at
#   step 1 without having touched anything.
#
# Usage:  bash scripts/run_utxo_events_backfill.sh
set -uo pipefail

PROJ=/home/bitmax/Projects/bitcoin-fullstack/DogData-v1
SCANNER_SVC=dog-scanner.service
TS=$(date +%Y%m%d_%H%M%S)
LOG="$PROJ/logs/utxo_events_backfill_$TS.log"
mkdir -p "$PROJ/logs"
exec > >(tee -a "$LOG") 2>&1

echo "════════════════════════════════════════════════════════════"
echo "[$(date)] F1-T4 utxo_events backfill — log: $LOG"
echo "════════════════════════════════════════════════════════════"

scanner_restarted=0
restart_scanner() {
  [ "$scanner_restarted" = 1 ] && return
  scanner_restarted=1
  echo "[$(date)] restarting $SCANNER_SVC …"
  if sudo -n systemctl start "$SCANNER_SVC"; then
    echo "[$(date)] ✅ scanner restarted"
  else
    echo "[$(date)] ‼️  FAILED to restart scanner — run manually:"
    echo "          sudo systemctl start $SCANNER_SVC"
  fi
}
trap restart_scanner EXIT

# ── Preflight ────────────────────────────────────────────────────────────────
echo "[$(date)] preflight: bitcoind reachable?"
if ! bitcoin-cli getblockcount >/dev/null 2>&1; then
  echo "‼️  bitcoin-cli not responding — aborting (scanner untouched)."
  trap - EXIT
  exit 1
fi
echo "  bitcoind tip: $(bitcoin-cli getblockcount)"

echo "[$(date)] preflight: passwordless sudo for systemctl stop/start?"
# Probe NOPASSWD with `start` — idempotent no-op while the service is active
# (is-active is intentionally NOT in the sudoers rule, so don't probe with it).
if ! sudo -n systemctl start "$SCANNER_SVC" >/dev/null 2>&1; then
  echo "‼️  passwordless sudo NOT available for stop/start $SCANNER_SVC."
  echo "    Cannot drive the scanner unattended. Aborting (nothing changed)."
  echo "    Fix: add the NOPASSWD sudoers rule (see plan F1-T4) or run this"
  echo "    script in an interactive shell where sudo is cached."
  trap - EXIT
  exit 1
fi
echo "  ✅ passwordless stop/start confirmed"

# ── 1. Stop scanner (free ord lock) ──────────────────────────────────────────
echo "[$(date)] stopping $SCANNER_SVC (releases ord lock) …"
sudo -n systemctl stop "$SCANNER_SVC" || { echo "‼️ stop failed; aborting"; exit 1; }
sleep 5
echo "  scanner active? $(systemctl is-active "$SCANNER_SVC" 2>/dev/null)"

# ── 2. Force from-genesis ────────────────────────────────────────────────────
echo "[$(date)] resetting replay state for a complete from-genesis event log …"
python3 - <<'PY'
import json
from pathlib import Path
d = Path('/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/data')
# replay reseeds genesis when last_block == ETCH_BLOCK (840000)
(d/'replay_state.json').write_text(json.dumps({'last_block': 840000, 'tx_count': 0}))
f = d/'replay_utxo_set.json'
if f.exists():
    f.unlink()
print('  replay_state → last_block=840000; replay_utxo_set.json removed')
PY

# ── 3. Replay with event emission ────────────────────────────────────────────
echo "[$(date)] running replay (EMIT_EVENTS=1) from genesis → tip …"
cd "$PROJ"
EMIT_EVENTS=1 python3 scripts/replay_dog_history.py --run
RC=$?
echo "[$(date)] replay exited rc=$RC"

# ── 4. Event-log summary ─────────────────────────────────────────────────────
EVLOG="$PROJ/data/utxo_events.jsonl"
if [ -f "$EVLOG" ]; then
  echo "[$(date)] utxo_events.jsonl lines: $(wc -l < "$EVLOG")"
  echo "  size: $(du -h "$EVLOG" | cut -f1)"
else
  echo "‼️  no utxo_events.jsonl produced — check the replay log above."
fi

echo "[$(date)] backfill finished (rc=$RC). Scanner restart handled by trap."
echo "Next: F1-T5 reconciliation (validate live set vs ord balances + metrics)."
exit $RC
