#!/usr/bin/env python3
"""
Backfill dog_transactions table in Supabase from:
1. Local JSON files (data/dog_transactions/block_*.json)
2. Redis cache (last 500 txs)

Usage:
    python3 scripts/backfill_supabase.py
"""

import json
import os
import sys
from pathlib import Path
import requests

# Load .env
try:
    from dotenv import load_dotenv
    for env_file in ['.env', '.env.local']:
        p = Path(__file__).parent.parent / env_file
        if p.exists():
            load_dotenv(p, override=True)
except ImportError:
    pass

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '') or os.environ.get('SUPABASE_ANON_KEY', '')
UPSTASH_URL = os.environ.get('UPSTASH_KV_REST_API_URL', '')
UPSTASH_TOKEN = os.environ.get('UPSTASH_KV_REST_API_TOKEN', '')

DATA_DIR = Path(__file__).parent.parent / 'data' / 'dog_transactions'


def insert_batch(txs, source=''):
    """Insert a batch of transactions into Supabase. Returns count inserted."""
    if not txs:
        return 0

    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
    }

    rows = []
    for tx in txs:
        rows.append({
            'txid': tx['txid'],
            'block_height': tx.get('block_height', 0),
            'timestamp': tx.get('timestamp', ''),
            'type': tx.get('type', 'transfer'),
            'total_dog_moved': tx.get('total_dog_moved', 0),
            'net_transfer': tx.get('net_transfer', 0),
            'change_amount': tx.get('change_amount', 0),
            'has_change': tx.get('has_change', False),
            'fee_sats': tx.get('fee_sats'),
            'sender_count': tx.get('sender_count', 0),
            'receiver_count': tx.get('receiver_count', 0),
            'senders': json.dumps(tx.get('senders', [])),
            'receivers': json.dumps(tx.get('receivers', [])),
        })

    resp = requests.post(
        f'{SUPABASE_URL}/rest/v1/dog_transactions',
        headers=headers,
        json=rows,
        timeout=30
    )

    if resp.status_code in (200, 201):
        print(f'  [{source}] Inserted {len(rows)} txs')
        return len(rows)
    else:
        print(f'  [{source}] Error {resp.status_code}: {resp.text[:200]}')
        return 0


def backfill_from_local_json():
    """Read all block_*.json files and insert into Supabase."""
    files = sorted(DATA_DIR.glob('block_*.json'))
    if not files:
        print('No local JSON files found')
        return 0

    print(f'Found {len(files)} block JSON files')
    total = 0

    for f in files:
        with open(f) as fh:
            data = json.load(fh)
        txs = data.get('transactions', [])
        if txs:
            total += insert_batch(txs, source=f.stem)

    return total


def backfill_from_redis():
    """Fetch cached transactions from Redis and insert into Supabase."""
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        print('Upstash not configured, skipping Redis backfill')
        return 0

    print('Fetching from Redis...')
    headers = {'Authorization': f'Bearer {UPSTASH_TOKEN}'}
    resp = requests.get(f'{UPSTASH_URL}/get/dog:transactions', headers=headers, timeout=15)
    resp.raise_for_status()

    result = resp.json().get('result')
    if not result:
        print('No data in Redis')
        return 0

    data = json.loads(result)
    txs = data.get('transactions', [])
    print(f'Found {len(txs)} txs in Redis')

    # Insert in batches of 100
    total = 0
    for i in range(0, len(txs), 100):
        batch = txs[i:i+100]
        total += insert_batch(batch, source=f'redis[{i}:{i+len(batch)}]')

    return total


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print('Error: SUPABASE_URL and SUPABASE_KEY must be set')
        sys.exit(1)

    print('=== Backfill dog_transactions to Supabase ===')

    # 1. Redis first (has older data from before the scanner)
    redis_count = backfill_from_redis()

    # 2. Local JSON files (scanner output)
    json_count = backfill_from_local_json()

    # 3. Verify
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/dog_transactions?select=id&limit=1',
        headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Prefer': 'count=exact',
        },
        timeout=10
    )
    total_rows = resp.headers.get('content-range', '').split('/')[-1]

    print(f'\n=== Done ===')
    print(f'Redis: {redis_count} txs')
    print(f'JSON:  {json_count} txs')
    print(f'Total rows in Supabase: {total_rows}')


if __name__ == '__main__':
    main()
