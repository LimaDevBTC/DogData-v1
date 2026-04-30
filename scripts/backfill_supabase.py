#!/usr/bin/env python3
"""
Backfill histórico do Supabase a partir dos block files locais.

Lê todos os arquivos data/dog_transactions/block_*.json e faz upsert
em dog_transactions via REST API. Usa `Prefer: resolution=merge-duplicates`
no txid (precisa do índice UNIQUE em txid — rodar a migration primeiro).

Inclui também a coluna denormalizada `addresses` (TEXT[]) — união de
sender+receiver addresses, com índice GIN pra lookup O(log n) no Explorer.

Uso:
    python3 scripts/backfill_supabase.py             # backfill completo
    python3 scripts/backfill_supabase.py --resume    # continua do checkpoint
    python3 scripts/backfill_supabase.py --verify    # só conta linhas
    python3 scripts/backfill_supabase.py --from-block N
"""
import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path

import requests
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
load_dotenv(PROJECT_ROOT / '.env.local', override=True)

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
TX_DIR = PROJECT_ROOT / 'data' / 'dog_transactions'
STATE_FILE = PROJECT_ROOT / 'data' / 'backfill_supabase_state.json'

BATCH_SIZE = 500

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger()

H = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal',
}


def tx_to_row(tx):
    senders = tx.get('senders', [])
    receivers = tx.get('receivers', [])
    addresses = list({
        a['address']
        for a in (senders + receivers)
        if a.get('address')
    })
    return {
        'txid': tx['txid'],
        'block_height': tx['block_height'],
        'timestamp': tx['timestamp'],
        'type': tx.get('type', 'transfer'),
        'total_dog_moved': tx.get('total_dog_moved', 0),
        'net_transfer': tx.get('net_transfer', 0),
        'change_amount': tx.get('change_amount', 0),
        'has_change': tx.get('has_change', False),
        'fee_sats': tx.get('fee_sats'),
        'sender_count': tx.get('sender_count', 0),
        'receiver_count': tx.get('receiver_count', 0),
        'senders': json.dumps(senders),
        'receivers': json.dumps(receivers),
        'addresses': addresses,
    }


def upsert(rows, retries=3):
    for attempt in range(retries):
        try:
            r = requests.post(
                f'{SUPABASE_URL}/rest/v1/dog_transactions?on_conflict=txid',
                headers=H, json=rows, timeout=60,
            )
            if r.status_code in (200, 201, 204):
                return True
            log.warning(f'HTTP {r.status_code}: {r.text[:300]}')
        except requests.exceptions.RequestException as e:
            log.warning(f'request error: {e}')
        time.sleep(2 ** attempt)
    return False


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {'last_block': 0, 'rows_inserted': 0}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))


def count_supabase():
    r = requests.get(
        f'{SUPABASE_URL}/rest/v1/dog_transactions?select=count',
        headers={**H, 'Prefer': 'count=exact', 'Range': '0-0'},
    )
    return int(r.headers.get('content-range', '0-0/0').split('/')[-1])


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--resume', action='store_true')
    p.add_argument('--verify', action='store_true')
    p.add_argument('--from-block', type=int, default=0)
    args = p.parse_args()

    block_files = sorted(TX_DIR.glob('block_*.json'))
    log.info(f'Block files locais: {len(block_files)} ({block_files[0].stem} → {block_files[-1].stem})')

    if args.verify:
        log.info(f'Supabase row count: {count_supabase()}')
        return

    state = load_state()
    start_block = max(args.from_block, state['last_block'] if args.resume else 0)
    log.info(f'Iniciando do bloco > {start_block} (já inseridas: {state["rows_inserted"]})')

    todo = [f for f in block_files if int(f.stem.replace('block_', '')) > start_block]
    log.info(f'Blocos a processar: {len(todo)}')

    buffer = []
    blocks_done = 0
    rows_inserted = state['rows_inserted']
    last_block = start_block
    t0 = time.time()

    for f in todo:
        block_height = int(f.stem.replace('block_', ''))
        try:
            data = json.loads(f.read_text())
        except Exception as e:
            log.error(f'Erro lendo {f.name}: {e}')
            continue

        for tx in data.get('transactions', []):
            buffer.append(tx_to_row(tx))

        last_block = block_height
        blocks_done += 1

        if len(buffer) >= BATCH_SIZE:
            if upsert(buffer):
                rows_inserted += len(buffer)
                buffer = []
            else:
                log.error(f'Upsert falhou no bloco {block_height}, abortando')
                save_state({'last_block': last_block - 1, 'rows_inserted': rows_inserted})
                sys.exit(1)

        if blocks_done % 1000 == 0:
            elapsed = time.time() - t0
            rate = blocks_done / elapsed if elapsed > 0 else 0
            remaining = len(todo) - blocks_done
            eta_min = remaining / rate / 60 if rate > 0 else 0
            log.info(
                f'  ── {blocks_done:>6}/{len(todo)} blocos | '
                f'{rows_inserted:>6} rows | {rate:.1f} bl/s | ETA {eta_min:.1f}min'
            )
            save_state({'last_block': last_block, 'rows_inserted': rows_inserted})

    if buffer:
        if upsert(buffer):
            rows_inserted += len(buffer)

    save_state({'last_block': last_block, 'rows_inserted': rows_inserted})

    log.info('═' * 60)
    log.info(f'Backfill concluído:')
    log.info(f'  Blocos processados: {blocks_done}')
    log.info(f'  Rows upserted:      {rows_inserted}')
    log.info(f'  Último bloco:       {last_block}')
    log.info(f'  Tempo total:        {(time.time() - t0)/60:.1f}min')
    log.info(f'  Supabase total:     {count_supabase()}')


if __name__ == '__main__':
    main()
