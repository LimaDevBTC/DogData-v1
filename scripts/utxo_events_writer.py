#!/usr/bin/env python3
"""
utxo_events_writer — F1-T2 instrumentation sink for the on-chain metrics catalog.

scan_block() already computes every UTXO create (receivers, with vout) and every
spend (spent_outpoints). This module persists those as an append-only event log
(JSONL), the foundation for the `utxo_events` table.

Design choice: emit to a LOCAL JSONL file, not direct Supabase writes. The
backfill replay produces ~1-2M events; per-tx REST calls would dwarf the actual
work and depend on flaky network. The JSONL is fast, durable, and the
reconciliation (F1-T5) can run on it directly. A separate loader bulk-imports it
into Supabase (F2).

Event lines:
  {"e":"C","outpoint":"txid:vout","txid","vout","address","amount_dog",
   "is_change","block","ts","price"}                       # UTXO created
  {"e":"S","outpoint":"txid:vout","spent_block","spent_ts",
   "spent_price","spent_txid"}                              # UTXO spent

Cost-basis prices come from data/dog_price_history.json (same source/forward-fill
as production update_holders_and_fees.py). created_price and spent_price both use
the price on the tx's own block date.

Activation: callers emit only when EMIT_EVENTS=1 (see dog_block_scanner.py /
replay_dog_history.py). With the flag off this module is never touched.
"""

import json
import bisect
from pathlib import Path

_DATA = Path(__file__).resolve().parent.parent / 'data'
_DEFAULT_LOG = _DATA / 'utxo_events.jsonl'

_PRICES = None
_PDAYS = None
_FH = None
_PATH = None
_stats = {'creates': 0, 'spends': 0, 'no_vout': 0}


def _load_prices():
    global _PRICES, _PDAYS
    _PRICES = json.loads((_DATA / 'dog_price_history.json').read_text())
    _PDAYS = sorted(_PRICES.keys())


def price_on(date):
    """DOG price on YYYY-MM-DD, forward-filled (largest known day <= date)."""
    if _PRICES is None:
        _load_prices()
    v = _PRICES.get(date)
    if v is not None:
        return v
    i = bisect.bisect_right(_PDAYS, date)
    if i == 0:
        return _PRICES[_PDAYS[0]]
    return _PRICES[_PDAYS[i - 1]]


def open_log(path=None, truncate=False):
    """Open the event log. truncate=True starts a fresh log (use for a full
    from-genesis backfill so the log is complete, not appended to a partial)."""
    global _FH, _PATH
    _PATH = Path(path) if path else _DEFAULT_LOG
    _FH = open(_PATH, 'w' if truncate else 'a')
    return _PATH


def record_tx(tx_data, spent_outpoints):
    """Append CREATE events (one per receiver) + SPEND events for this tx."""
    if _FH is None:
        open_log()
    txid = tx_data['txid']
    block = tx_data.get('block_height', 0)
    ts = tx_data.get('timestamp', '')
    price = price_on(ts[:10]) if ts else None

    out = []
    for r in tx_data.get('receivers', []):
        vout = r.get('vout')
        if vout is None:
            _stats['no_vout'] += 1
            continue
        out.append(json.dumps({
            'e': 'C',
            'outpoint': f'{txid}:{vout}',
            'txid': txid, 'vout': vout,
            'address': r.get('address'),
            'amount_dog': r.get('amount_dog'),
            'is_change': r.get('is_change', False),
            'block': block, 'ts': ts, 'price': price,
        }))
        _stats['creates'] += 1
    for op in spent_outpoints:
        out.append(json.dumps({
            'e': 'S',
            'outpoint': op,
            'spent_block': block, 'spent_ts': ts,
            'spent_price': price, 'spent_txid': txid,
        }))
        _stats['spends'] += 1
    if out:
        _FH.write('\n'.join(out) + '\n')


def flush():
    if _FH:
        _FH.flush()


def close():
    global _FH
    if _FH:
        _FH.flush()
        _FH.close()
        _FH = None


def stats():
    return dict(_stats)
