#!/usr/bin/env python3
"""
Targeted backfill — fill `dog_transactions` rows for source-txs of every
current DOG UTXO that the original backfill missed.

Strategy
--------
The scanner's local `dog_utxo_set.json` is the ground truth for current DOG
UTXOs (~247k entries, only 22 short of chain reality). For every entry, the
source transaction is known (txid before the colon). We compare against
Supabase and, for each missing one, insert a row reconstructed from
bitcoin-cli + ord.

Reconstruction is intentionally output-only:
  • receivers — every output of the missing tx that is currently a DOG UTXO,
    with the address resolved via getrawtransaction.
  • senders   — left empty. The scanner's senders array is computed from a
    historical UTXO state we don't have. The chain of consumed prev-outputs
    needed to recover senders accurately would require replaying every
    block from the etching forward, which is plan B.

That trade-off is fine for the immediate UX problem (current-holder pages
show wildly wrong "Total Received" because the source-txs of their UTXOs
aren't in `dog_transactions`). After this runs:
  • Total Received  → correct for every current holder.
  • Current balance → reconciles against Total Received − Total Sent
                      within the limits of what the scanner had logged.
  • Total Sent      → unchanged (still best-effort — sender history of
                      missing txs is unrecoverable from current state alone).

Usage:
    python3 scripts/backfill_missing_dog_txs.py             # dry-run, prints stats
    python3 scripts/backfill_missing_dog_txs.py --apply     # actually inserts
    python3 scripts/backfill_missing_dog_txs.py --apply --limit 1000   # cap
"""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# ── Setup ────────────────────────────────────────────────────────────────────

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env.local')
except ImportError:
    pass

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / 'data'
UTXO_FILE = DATA_DIR / 'dog_utxo_set.json'

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_KEY')
if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (.env.local)')

DOG_FACTOR = 100_000          # 5 divisibility
DOG_DIVISIBILITY = 5

PROGRESS_EVERY = 100
SUPABASE_BATCH = 50           # txids per ?in=(...) probe; URL length cap on PostgREST
SUPABASE_INSERT_BATCH = 100
HTTP_TIMEOUT = 30

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal',
}


def log(msg):
    print(f'[{datetime.now().strftime("%H:%M:%S")}] {msg}', flush=True)


# ── Bitcoin Core helpers ──────────────────────────────────────────────────────

def bitcoin_cli(*args, timeout=15):
    res = subprocess.run(
        ['bitcoin-cli', *args],
        capture_output=True, text=True, timeout=timeout
    )
    if res.returncode != 0:
        raise RuntimeError(f'bitcoin-cli {args[0]} failed: {res.stderr.strip()}')
    return res.stdout


def get_raw_tx(txid):
    # ⚠️ VERBOSIDADE 2, E NÃO 1, e essa diferença de um caractere custou 23% do
    # histórico. Com `1` a transação vem sem os prevouts, e foi por isso que a
    # primeira versão deste script gravou 111.799 linhas com `senders: []`: ele
    # tinha o nó na mão e não perguntou quem tinha mandado. Com `2` cada entrada
    # já vem com endereço e valor, numa chamada só, porque o txindex está ligado.
    # Reparado em 2026-08-24 por scripts/rebuild-backfill-senders.py.
    return json.loads(bitcoin_cli('getrawtransaction', txid, '2'))


def get_block_header(blockhash):
    return json.loads(bitcoin_cli('getblockheader', blockhash))


# ── Supabase helpers ──────────────────────────────────────────────────────────

def supabase_existing_txids(txids):
    """Return the subset of `txids` already present in dog_transactions."""
    present = set()
    txids = list(txids)
    for i in range(0, len(txids), SUPABASE_BATCH):
        chunk = txids[i:i + SUPABASE_BATCH]
        ids = ','.join(chunk)
        url = f'{SUPABASE_URL}/rest/v1/dog_transactions?select=txid&txid=in.({ids})'
        r = requests.get(url, headers=HEADERS, timeout=HTTP_TIMEOUT)
        if r.status_code == 200:
            for row in r.json():
                present.add(row['txid'])
        else:
            log(f'  WARN: supabase batch {i} failed: HTTP {r.status_code} {r.text[:200]}')
        if (i // SUPABASE_BATCH) % 100 == 0 and i > 0:
            log(f'    probed {i}/{len(txids)} (present so far: {len(present)})')
    return present


def supabase_insert_rows(rows):
    if not rows:
        return True
    url = f'{SUPABASE_URL}/rest/v1/dog_transactions?on_conflict=txid'
    r = requests.post(url, headers=HEADERS, json=rows, timeout=HTTP_TIMEOUT)
    if r.status_code in (200, 201, 204):
        return True
    log(f'  ERROR: supabase insert {r.status_code}: {r.text[:300]}')
    return False


# ── Reconstruction logic ──────────────────────────────────────────────────────

def reconstruct_tx(txid, dog_outputs_for_txid):
    """Build a dog_transactions row for a missing source-tx.

    dog_outputs_for_txid: list of (vout, amount_atomic) — the outputs of this
    tx that are currently DOG-bearing UTXOs.

    Returns the row dict (matching push_to_supabase format), or None on
    unrecoverable error.
    """
    try:
        tx = get_raw_tx(txid)
    except Exception as e:
        log(f'  skip {txid[:16]}…: {e}')
        return None

    # block height + timestamp
    block_height = None
    timestamp = None
    blockhash = tx.get('blockhash')
    if blockhash:
        try:
            hdr = get_block_header(blockhash)
            block_height = hdr.get('height')
            ts = hdr.get('time')
            if ts:
                timestamp = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace('+00:00', 'Z')
        except Exception as e:
            log(f'  warn header({blockhash[:16]}): {e}')
    if block_height is None or timestamp is None:
        log(f'  skip {txid[:16]}…: no block info')
        return None

    # Build receivers from the known DOG outputs.
    receivers = []
    total_dog_atomic = 0
    for vout_idx, amount_atomic in dog_outputs_for_txid:
        addr = None
        if vout_idx < len(tx.get('vout', [])):
            addr = tx['vout'][vout_idx].get('scriptPubKey', {}).get('address')
        receivers.append({
            'vout': vout_idx,
            'address': addr or 'unknown',
            'amount': amount_atomic,
            'amount_dog': round(amount_atomic / DOG_FACTOR, DOG_DIVISIBILITY),
            'has_dog': True,
            # Conservative: we can't tell from current state alone whether
            # this output was change or transfer. Marking false keeps it
            # visible in the receiver-side accounting.
            'is_change': False,
        })
        total_dog_atomic += amount_atomic

    # ⚠️ OS REMETENTES SAEM DOS PREVOUTS, e valor só onde ele é sabido.
    # Uma única entrada de 546 sats é o UTXO de rune e o resto é gás: ali o total
    # da transação é dela. Havendo mais de uma candidata, o endereço entra com
    # `attribution: pending` e valor nulo. Nulo é "não sei"; zero seria afirmar
    # que a pessoa não mandou DOG, e isso seria mentira.
    entradas = []
    for vin in tx.get('vin', []):
        prev = vin.get('prevout') or {}
        addr = (prev.get('scriptPubKey') or {}).get('address')
        if addr:
            entradas.append((addr, round(float(prev.get('value', 0)) * 1e8)))
    poeira = [a for a, v in entradas if v == 546]
    direto = len(poeira) == 1
    senders = []
    for addr in sorted({a for a, _ in entradas}):
        carrega = direto and addr == poeira[0]
        senders.append({
            'address': addr,
            'amount': total_dog_atomic if carrega else None,
            'amount_dog': round(total_dog_atomic / DOG_FACTOR, DOG_DIVISIBILITY) if carrega else None,
            'has_dog': carrega if direto else None,
            'attribution': 'direct' if direto else 'pending',
        })

    addresses = sorted(
        {r['address'] for r in receivers if r['address'] != 'unknown'}
        | {s['address'] for s in senders}
    )

    return {
        'txid': txid,
        'block_height': block_height,
        'timestamp': timestamp,
        'type': 'backfilled_partial',
        'total_dog_moved': round(total_dog_atomic / DOG_FACTOR, DOG_DIVISIBILITY),
        'net_transfer': round(total_dog_atomic / DOG_FACTOR, DOG_DIVISIBILITY),
        'change_amount': 0,
        'has_change': False,
        'fee_sats': None,
        'sender_count': len(senders),
        'receiver_count': len(receivers),
        'senders': json.dumps(senders),
        'receivers': json.dumps(receivers),
        'addresses': addresses,
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='actually insert (default: dry-run)')
    ap.add_argument('--limit', type=int, default=None, help='cap on # of missing txs to process')
    args = ap.parse_args()

    log(f'loading {UTXO_FILE.name}…')
    utxo_set = json.loads(UTXO_FILE.read_text())
    log(f'  utxo_set: {len(utxo_set):,} UTXOs')

    # group UTXOs by source-txid
    by_source = {}
    for outpoint, amt in utxo_set.items():
        txid, vout = outpoint.split(':')
        by_source.setdefault(txid, []).append((int(vout), amt))
    log(f'  unique source txids: {len(by_source):,}')

    log('checking which source-txids are already in supabase…')
    present = supabase_existing_txids(by_source.keys())
    missing_txids = [t for t in by_source if t not in present]
    log(f'  present: {len(present):,}')
    log(f'  MISSING: {len(missing_txids):,}  ({100*len(missing_txids)/len(by_source):.1f}% of utxo source-txs)')

    if args.limit:
        missing_txids = missing_txids[:args.limit]
        log(f'  capped at --limit {args.limit}')

    if not args.apply:
        log('')
        log('DRY-RUN: no inserts will happen. re-run with --apply to write.')
        return

    log('')
    log(f'reconstructing {len(missing_txids):,} txs…')

    batch = []
    inserted = skipped = errors = 0
    started = time.time()

    for i, txid in enumerate(missing_txids, 1):
        row = reconstruct_tx(txid, by_source[txid])
        if row is None:
            errors += 1
            continue
        batch.append(row)

        if len(batch) >= SUPABASE_INSERT_BATCH:
            if supabase_insert_rows(batch):
                inserted += len(batch)
            else:
                errors += len(batch)
            batch = []

        if i % PROGRESS_EVERY == 0:
            elapsed = time.time() - started
            rate = i / elapsed if elapsed else 0
            eta_s = (len(missing_txids) - i) / rate if rate else 0
            log(f'  {i:>6}/{len(missing_txids):,}  inserted={inserted}  errors={errors}  rate={rate:.1f}/s  eta={eta_s/60:.1f}min')

    # tail
    if batch:
        if supabase_insert_rows(batch):
            inserted += len(batch)
        else:
            errors += len(batch)

    elapsed = time.time() - started
    log('')
    log(f'done in {elapsed/60:.1f}min')
    log(f'  inserted: {inserted:,}')
    log(f'  errors:   {errors:,}')
    log(f'  skipped:  {skipped:,}')


if __name__ == '__main__':
    main()
