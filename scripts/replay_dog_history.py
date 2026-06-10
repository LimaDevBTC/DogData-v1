#!/usr/bin/env python3
"""
DOG history replay — reconstructs the COMPLETE `dog_transactions` table by
re-scanning every block from the etching (840,000) to chain tip with a
correctly seeded utxo_set.

Why this exists
---------------
The original backfill (phases 1+2 in `backfill_dog_history.py`) and the live
scanner share a design flaw: the scanner only logs a tx when at least one
input is in its in-memory utxo_set. If the bootstrap utxo_set was incomplete
at startup, every tx spending an unknown DOG UTXO is silently dropped, and
the gap cascades forward.

Diagnosis showed Supabase had only ~36% of source-txs for current UTXOs
(rank 9 holder: 3 of 17 source-txs present). The targeted output-only
backfill (`backfill_missing_dog_txs.py`) closed most of the visible gap but
left sender history incomplete for older rows.

DOG's etching has a 100% premine (no mints), so the entire 100B-DOG supply
flows from a single genesis UTXO at block 840,000. Seeding utxo_set with
that one entry and replaying forward via the scanner's existing
`scan_block` logic reconstructs perfect senders + receivers for every tx,
in chain order, with no historical-state queries needed.

Strategy
--------
1. Stop the live scanner (releases the ord index lock — handled outside).
2. Seed utxo_set = { etching_tx:1 → 100B DOG } (from the runestone's
   pointer, decoded via ord).
3. For each block 840,000 → tip:
     a. Pull the block from bitcoin-cli (verbosity 2).
     b. Run the scanner's scan_block() against utxo_set.
     c. For every detected DOG tx: save to local block file (idempotent),
        push to Redis cache, upsert to Supabase via push_to_supabase().
     d. Update utxo_set incrementally.
4. After completion, verify utxo_set == `ord balances` (should match
   exactly, modulo the live tip drifting during the run).
5. Persist utxo_set + state, restart the live scanner.

Resumability
------------
State is persisted to `replay_state.json` after every block. Re-running
from a partial state picks up where it left off (no double work). Supabase
upserts use `on_conflict=txid`, so re-pushes are idempotent.

Usage
-----
    # 1) confirm setup, dry-run init (does nothing destructive)
    python3 scripts/replay_dog_history.py --init

    # 2) run the actual replay
    python3 scripts/replay_dog_history.py --run

    # 3) resume (after interruption) — automatic
    python3 scripts/replay_dog_history.py --run

    # 4) only blocks N..M (for targeted re-runs)
    python3 scripts/replay_dog_history.py --run --from 840000 --to 858500
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ── reuse the scanner's logic ────────────────────────────────────────────────
# The scanner module already implements scan_block, process_dog_tx,
# allocate_dog_outputs, and push_to_supabase. Importing keeps replay logic
# byte-for-byte identical to live ingestion.
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / 'scripts'))
import dog_block_scanner as scanner  # noqa: E402

# F1-T2: emit UTXO create/spend events when EMIT_EVENTS=1 (off by default).
EMIT_EVENTS = os.environ.get('EMIT_EVENTS', '') == '1'
events = None
if EMIT_EVENTS:
    import utxo_events_writer as events  # noqa: E402

DATA_DIR = PROJECT_ROOT / 'data'
REPLAY_STATE_FILE = DATA_DIR / 'replay_state.json'
# Isolated UTXO snapshot for the replay. Keeps the live `dog_utxo_set.json`
# (which `update_holders_and_fees.py` reads every hour) untouched during the
# run, so a partial replay can't poison holder data downstream.
REPLAY_UTXO_FILE = DATA_DIR / 'replay_utxo_set.json'

# DOG genesis: etching at block 840,000, premine 100B DOG, pointer→vout 1.
# Confirmed via `ord decode --txid <etch>` against the local 182GB index.
ETCH_TXID = 'e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375'
ETCH_VOUT = 1
ETCH_PREMINE_ATOMIC = 10_000_000_000_000_000  # 100B DOG × 10^5

# DOG was etched at block 840,000. The etching tx itself has no DOG inputs
# (premine creates DOG ex nihilo via the runestone), so scan_block() would
# skip it. We seed manually.
ETCH_BLOCK = 840000
START_BLOCK = ETCH_BLOCK + 1  # first block scan_block() needs to see


def log(msg):
    print(f'[{datetime.now().strftime("%H:%M:%S")}] {msg}', flush=True)


def load_replay_state():
    if REPLAY_STATE_FILE.exists():
        return json.loads(REPLAY_STATE_FILE.read_text())
    return {'last_block': ETCH_BLOCK, 'started_at': None, 'tx_count': 0}


def save_replay_state(state):
    REPLAY_STATE_FILE.write_text(json.dumps(state, indent=2))


def init_seed():
    """Build the genesis utxo_set: just the etching's premine output."""
    return {f'{ETCH_TXID}:{ETCH_VOUT}': ETCH_PREMINE_ATOMIC}


def chain_tip():
    return int(scanner.bitcoin_cli('getblockcount').strip())


def _push_with_retry(all_txs, height, max_attempts=8):
    """Upsert into Supabase with bounded exponential backoff.

    The previous run lost 2 blocks (844443, 844446) to flaky residential
    internet — push_to_supabase returns False on connection errors but
    doesn't retry. Over an 18-hour run that adds up. This wrapper waits
    out transient outages: 5s, 10s, 20s, ... up to ~5 min between tries,
    then gives up, appending the block to a failed-blocks list for the
    end-of-run reconcile pass.
    """
    for attempt in range(max_attempts):
        try:
            ok = scanner.push_to_supabase(all_txs, addresses=True)
        except Exception as e:
            scanner.log.warning(f'  block {height}: push raised: {e}')
            ok = False
        if ok:
            return
        delay = min(5 * (2 ** attempt), 300)
        scanner.log.warning(
            f'  block {height}: supabase push failed (attempt {attempt + 1}/'
            f'{max_attempts}); retrying in {delay}s'
        )
        time.sleep(delay)
    # All retries exhausted — record so we can fix it after the run.
    failed_path = DATA_DIR / 'replay_failed_blocks.txt'
    with failed_path.open('a') as f:
        f.write(f'{height}\n')
    scanner.log.error(f'  block {height}: GAVE UP after {max_attempts} attempts; appended to {failed_path.name}')


def replay(from_block=None, to_block=None):
    state = load_replay_state()
    if state.get('started_at') is None:
        state['started_at'] = datetime.now(timezone.utc).isoformat()
    last_done = state['last_block']

    # decide range
    start = max(from_block or START_BLOCK, last_done + 1)
    end = to_block or chain_tip()

    if start > end:
        log(f'nothing to do (last_done={last_done}, requested {from_block}..{to_block})')
        return

    # rebuild or resume utxo_set (always from REPLAY_UTXO_FILE — never the
    # production dog_utxo_set.json, which the live data pipeline depends on)
    from_genesis = last_done == ETCH_BLOCK or not REPLAY_UTXO_FILE.exists()
    if from_genesis:
        utxo_set = init_seed()
        log(f'seeded utxo_set with genesis: {ETCH_TXID[:16]}…:{ETCH_VOUT} = {ETCH_PREMINE_ATOMIC:,} atomic ({ETCH_PREMINE_ATOMIC/scanner.DOG_FACTOR:,.0f} DOG)')
    else:
        utxo_set = json.loads(REPLAY_UTXO_FILE.read_text())
        log(f'resumed from block {last_done}; replay utxo_set has {len(utxo_set):,} entries')

    if EMIT_EVENTS:
        # Fresh log when replaying from genesis (complete, not appended to a
        # partial); append when resuming a run.
        log_path = events.open_log(truncate=from_genesis)
        log(f'EMIT_EVENTS on → writing utxo_events to {log_path.name} '
            f'(truncate={from_genesis})')

    log(f'replaying blocks {start} → {end}  ({end - start + 1:,} blocks)')

    started = time.time()
    txs_total = state.get('tx_count', 0)

    for height in range(start, end + 1):
        results = scanner.scan_block(height, utxo_set)
        if results:
            all_txs = []
            for tx_data, new_utxos, spent_outpoints in results:
                all_txs.append(tx_data)
                if EMIT_EVENTS:
                    events.record_tx(tx_data, spent_outpoints)
                for op in spent_outpoints:
                    utxo_set.pop(op, None)
                utxo_set.update(new_utxos)

            scanner.save_block_txs(height, all_txs)
            # Skip Redis pushes during replay. Redis only holds the live
            # hot-cache (latest 500 txs) which the live scanner re-populates
            # naturally once it resumes. Pushing every replayed block would
            # also trigger 15-s timeouts under flaky network and dwarf the
            # actual work — observed cost was ~50% of total wall time.
            _push_with_retry(all_txs, height)
            txs_total += len(all_txs)

        # Persist state + utxo_set together every 100 blocks. Atomicity
        # matters for resume — if the two drift, blocks between the saves
        # would be skipped on restart with a stale utxo_set, leaking DOG
        # history. Writing both here keeps them in lockstep.
        if height % 100 == 0:
            state['last_block'] = height
            state['tx_count'] = txs_total
            REPLAY_UTXO_FILE.write_text(json.dumps(utxo_set))
            save_replay_state(state)
            if EMIT_EVENTS:
                events.flush()

            elapsed = time.time() - started
            blocks_done = height - start + 1
            blocks_left = end - height
            rate_blocks = blocks_done / elapsed if elapsed else 0
            eta_min = blocks_left / rate_blocks / 60 if rate_blocks else 0
            log(f'  block {height} | utxos={len(utxo_set):,} | dog_txs_total={txs_total:,} | '
                f'rate={rate_blocks:.1f} blk/s | eta={eta_min:.1f}min')

    # final persist (still only to REPLAY_UTXO_FILE — promote to production
    # explicitly via the validation step after the run completes)
    state['last_block'] = end
    state['tx_count'] = txs_total
    save_replay_state(state)
    REPLAY_UTXO_FILE.write_text(json.dumps(utxo_set))

    if EMIT_EVENTS:
        events.close()
        st = events.stats()
        log(f'utxo_events log written: {st["creates"]:,} creates, {st["spends"]:,} spends '
            f'({st["no_vout"]} skipped no-vout)')

    elapsed = time.time() - started
    log(f'done in {elapsed/60:.1f}min — {txs_total:,} dog txs, {len(utxo_set):,} utxos')
    log(f'replay utxo set saved to {REPLAY_UTXO_FILE.name} (production file untouched)')
    log('next step: validate replay_utxo_set vs `ord balances`, then promote.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--init', action='store_true', help='print plan + dry checks, no work')
    ap.add_argument('--run', action='store_true', help='execute the replay')
    ap.add_argument('--from', dest='from_block', type=int, default=None)
    ap.add_argument('--to', dest='to_block', type=int, default=None)
    args = ap.parse_args()

    if args.init:
        state = load_replay_state()
        tip = chain_tip()
        log(f'replay state: last_block={state["last_block"]}  tx_count={state.get("tx_count",0)}')
        log(f'chain tip:    {tip}')
        log(f'genesis seed: {ETCH_TXID}:{ETCH_VOUT} = {ETCH_PREMINE_ATOMIC} atomic')
        log(f'plan:         replay {state["last_block"]+1} → {tip}  '
            f'({tip - state["last_block"]:,} blocks)')
        # quick sanity: the etching output must be reachable via bitcoind
        try:
            tx = json.loads(scanner.bitcoin_cli('getrawtransaction', ETCH_TXID, '1'))
            outs = tx.get('vout', [])
            log(f'etching tx outputs: {len(outs)}')
            assert len(outs) > ETCH_VOUT, 'pointer vout out of range'
            log(f'  vout {ETCH_VOUT}: value={outs[ETCH_VOUT]["value"]} BTC, '
                f'addr={outs[ETCH_VOUT].get("scriptPubKey",{}).get("address","?")}')
        except Exception as e:
            log(f'WARN: bitcoind sanity failed: {e}')
        return

    if args.run:
        replay(args.from_block, args.to_block)
        return

    ap.print_help()


if __name__ == '__main__':
    main()
