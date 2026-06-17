#!/usr/bin/env python3
"""
F1-T5 diagnosis — WHY does the replay reconstruct ~118k live UTXOs vs ~246k real?

Compares, per txid, the live DOG outpoints the REPLAY produced (from the event
log) against the TRUE live set (production dog_utxo_set.json). Reveals the exact
failure mode: output merging, wrong vout assignment, or under-creation.

Offline: reads data/utxo_events.jsonl + data/dog_utxo_set.json. No scanner stop.
"""
import json
from pathlib import Path
from collections import defaultdict

DATA = Path(__file__).resolve().parent.parent / 'data'
DOG_FACTOR = 100000
REPLAY_TIP = 953146  # event log frozen here; ignore prod outpoints created after

# ── Replay live set from event log: outpoint -> amount_dog, + per-txid vouts ──
replay_live = {}            # outpoint -> amount_dog
replay_created_txids = set()
with (DATA / 'utxo_events.jsonl').open() as f:
    for line in f:
        if not line.strip():
            continue
        e = json.loads(line)
        if e['e'] == 'C':
            replay_live[e['outpoint']] = e.get('amount_dog') or 0.0
            replay_created_txids.add(e['txid'])
        else:
            replay_live.pop(e['outpoint'], None)

# ── Production live set ───────────────────────────────────────────────────────
prod = json.load(open(DATA / 'dog_utxo_set.json'))   # outpoint -> amount_raw
prod_live = {op: amt / DOG_FACTOR for op, amt in prod.items()}

# Group live outpoints by txid
def by_txid(live):
    d = defaultdict(dict)   # txid -> {vout: amount}
    for op, amt in live.items():
        txid, vout = op.rsplit(':', 1)
        d[txid][int(vout)] = amt
    return d

R = by_txid(replay_live)
P = by_txid(prod_live)

# Only compare txids the replay actually SAW (created ≥1 output for), to exclude
# post-tip prod txids and txids the replay never reached.
common_txids = [t for t in P.keys() if t in replay_created_txids]
prod_only_txids = [t for t in P.keys() if t not in replay_created_txids]

print('════════ LIVE SET SHAPE ════════')
print(f'replay live outpoints: {len(replay_live):,} across {len(R):,} txids')
print(f'prod   live outpoints: {len(prod_live):,} across {len(P):,} txids')
print(f'prod txids the replay NEVER created any output for: {len(prod_only_txids):,}')

# ── Per-txid comparison on common txids ──────────────────────────────────────
exact = under = over = mismatch = 0
examples = []
for t in common_txids:
    rv = R.get(t, {})         # replay live vouts for this txid
    pv = P[t]                 # prod live vouts
    rset, pset = set(rv), set(pv)
    if rset == pset:
        exact += 1
    else:
        if rset < pset:
            under += 1        # replay has a strict subset → merged/dropped outputs
        elif rset > pset:
            over += 1
        else:
            mismatch += 1     # different vout indices
        if len(examples) < 6:
            examples.append((t, rv, pv))

print('\n════════ PER-TXID (common txids the replay saw) ════════')
print(f'common txids: {len(common_txids):,}')
print(f'  exact vout match:        {exact:,}')
print(f'  replay SUBSET (merged):  {under:,}')
print(f'  replay SUPERSET:         {over:,}')
print(f'  different vouts:         {mismatch:,}')

print('\n════════ CONCRETE EXAMPLES (txid: replay vouts vs prod vouts) ════════')
for t, rv, pv in examples:
    print(f'\n  txid {t[:24]}…')
    print(f'    replay live: {[(v, round(a,2)) for v, a in sorted(rv.items())]}')
    print(f'    prod   live: {[(v, round(a,2)) for v, a in sorted(pv.items())]}')

# ── Aggregate: do prod-only txids dominate the missing 128k? ─────────────────
prod_only_outpoints = sum(len(P[t]) for t in prod_only_txids)
print('\n════════ WHERE THE MISSING UTXOS ARE ════════')
print(f'live outpoints under prod-only txids (replay never created): {prod_only_outpoints:,}')
print(f'  → {"replay MISSED whole txs" if prod_only_outpoints > 50000 else "not the main cause"}')
