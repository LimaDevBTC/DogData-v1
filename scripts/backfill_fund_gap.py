#!/usr/bin/env python3
"""Fills the holes in dog_transactions for transactions that touch the construction fund.

WHY: the founders ledger (lib/dog/founders-ledger.ts) reads dog_transactions. Some blocks (e.g. 965159, donation
57782273... of 10,000 DOG) exist in the local index (data/dog_transactions/block_*.json) but were never pushed, so the
donor vanished from the site. This script finds local-index transactions that cite the fund and are absent from the
table, and upserts exactly those rows (same row shape as backfill_supabase.py).

DEFAULT IS DRY-RUN (lists what is missing, writes nothing). Pass --apply to write.
"""
import argparse, glob, json, os, sys
from pathlib import Path
import requests

FUND = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p'
INDEX = Path(os.environ.get('DOG_INDEX', Path.home() / 'Projects/bitcoin-fullstack/DogData-v1/data/dog_transactions'))
URL = os.environ['SUPABASE_URL']
KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['SUPABASE_ANON_KEY']
H = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json',
     'Prefer': 'resolution=merge-duplicates,return=minimal'}


def row(tx):
    s, r = tx.get('senders', []), tx.get('receivers', [])
    return {'txid': tx['txid'], 'block_height': tx['block_height'], 'timestamp': tx['timestamp'],
            'type': tx.get('type', 'transfer'), 'total_dog_moved': tx.get('total_dog_moved', 0),
            'net_transfer': tx.get('net_transfer', 0), 'change_amount': tx.get('change_amount', 0),
            'has_change': tx.get('has_change', False), 'fee_sats': tx.get('fee_sats'),
            'sender_count': tx.get('sender_count', 0), 'receiver_count': tx.get('receiver_count', 0),
            'senders': json.dumps(s), 'receivers': json.dumps(r),
            'addresses': sorted({a['address'] for a in s + r if a.get('address')})}


def have_in_db():
    out, f = set(), 0
    while True:
        r = requests.get(f'{URL}/rest/v1/dog_transactions?select=txid&addresses=cs.%7B{FUND}%7D&order=id.asc',
                         headers={**H, 'Range-Unit': 'items', 'Range': f'{f}-{f + 999}'}, timeout=120)
        r.raise_for_status()
        d = r.json()
        out |= {x['txid'] for x in d}
        if len(d) < 1000:
            return out
        f += 1000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()
    db = have_in_db()
    missing = []
    for fn in sorted(glob.glob(str(INDEX / 'block_*.json'))):
        for t in json.load(open(fn)).get('transactions', []):
            if t['txid'] in db:
                continue
            if any(x.get('address') == FUND for x in t.get('receivers', []) + t.get('senders', [])):
                missing.append(t)
    for t in missing:
        print(('WRITE ' if a.apply else 'MISSING ') + t['txid'], t['block_height'])
    print(f'{len(missing)} fund transaction(s) absent from dog_transactions ({len(db)} present)')
    if a.apply and missing:
        r = requests.post(f'{URL}/rest/v1/dog_transactions?on_conflict=txid', headers=H, json=[row(t) for t in missing], timeout=60)
        r.raise_for_status()
        print('upserted', len(missing))
    return 0


if __name__ == '__main__':
    sys.exit(main())
