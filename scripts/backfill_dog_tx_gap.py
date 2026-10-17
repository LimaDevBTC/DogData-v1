#!/usr/bin/env python3
"""Repoe em dog_transactions o que existe no indice local e nao esta na tabela (buraco de LINHA).

CAUSA: dog_block_scanner.process_pending_blocks grava o arquivo local, chama push_to_supabase e IGNORA o retorno;
o last_block avanca de qualquer jeito. Um push que falha (timeout, 5xx, IO esgotado) nunca e reprocessado.

SEGURANCA
  * DEFAULT = DRY-RUN: so le (GET com filtro por indice unico em txid), lista e estima; nao escreve nada.
  * --apply escreve com `Prefer: resolution=ignore-duplicates`: linha que ja existe NUNCA e sobrescrita
    (o upsert normal do scanner faria merge-duplicates e trocaria campos de linhas boas).
  * Lotes de --batch (100) e pausa de --pause (1.0 s) entre lotes; para na 1a falha depois de 3 tentativas.
  * Escopo: so blocos >= --from-block (default 934000). Abaixo disso a TABELA e superconjunto do indice local
    (o replay-genesis de 24/08 escreveu direto no banco, nao nos block_*.json), entao "falta" nao e buraco.
  * Credenciais: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY do ambiente ou de .env.local; nunca impressas.

USO
    python3 scripts/backfill_dog_tx_gap.py                      # dry-run, lista por bloco
    python3 scripts/backfill_dog_tx_gap.py --from-block 950000  # recorte
    python3 scripts/backfill_dog_tx_gap.py --apply              # escreve (so apos o fundador liberar)
    python3 scripts/backfill_dog_tx_gap.py --verify             # contagem por faixa (local x tabela), so leitura
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

try:
    from dotenv import load_dotenv
    for p in (Path(os.environ.get('DOG_ENV', '')), Path.home() / 'Projects/bitcoin-fullstack/DogData-v1/.env.local'):
        if p.is_file():
            load_dotenv(p)
except ImportError:
    pass

INDEX = Path(os.environ.get('DOG_INDEX', Path.home() / 'Projects/bitcoin-fullstack/DogData-v1/data/dog_transactions'))
URL = os.environ['SUPABASE_URL']
KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['SUPABASE_ANON_KEY']
H = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}


def row(tx):  # mesmo formato de backfill_supabase.py / scanner
    s, r = tx.get('senders', []), tx.get('receivers', [])
    return {'txid': tx['txid'], 'block_height': tx['block_height'], 'timestamp': tx['timestamp'],
            'type': tx.get('type', 'transfer'), 'total_dog_moved': tx.get('total_dog_moved', 0),
            'net_transfer': tx.get('net_transfer', 0), 'change_amount': tx.get('change_amount', 0),
            'has_change': tx.get('has_change', False), 'fee_sats': tx.get('fee_sats'),
            'sender_count': tx.get('sender_count', 0), 'receiver_count': tx.get('receiver_count', 0),
            'senders': json.dumps(s), 'receivers': json.dumps(r),
            'addresses': sorted({a['address'] for a in s + r if a.get('address')})}


def load_local(from_block):
    out = []
    for fn in sorted(INDEX.glob('block_*.json')):
        h = int(fn.stem[6:])
        if h < from_block:
            continue
        out += json.load(open(fn)).get('transactions', [])
    return out


def get(path, extra=None, tries=4):
    for i in range(tries):
        try:
            r = requests.get(f'{URL}/rest/v1/{path}', headers={**H, **(extra or {})}, timeout=60)
            if r.status_code == 200 or r.status_code == 206:
                return r
        except requests.RequestException:
            pass
        time.sleep(2 * (i + 1))
    raise SystemExit(f'GET falhou: {path[:80]}')


def present(txids, pause):
    """Subconjunto de txids que ja esta na tabela (txid tem indice UNIQUE; lotes de 100)."""
    have = set()
    for i in range(0, len(txids), 100):
        ch = txids[i:i + 100]
        have |= {x['txid'] for x in get(f"dog_transactions?select=txid&txid=in.({','.join(ch)})").json()}
        time.sleep(pause)
    return have


def verify(from_block):
    local = {}
    for fn in sorted(INDEX.glob('block_*.json')):
        h = int(fn.stem[6:])
        if h >= from_block:
            local[h // 1000] = local.get(h // 1000, 0) + len(json.load(open(fn)).get('transactions', []))
    top = max(local)
    bad = 0
    for k in range(from_block // 1000, top + 1):
        n = int(get(f'dog_transactions?select=txid&block_height=gte.{k * 1000}&block_height=lt.{k * 1000 + 1000}',
                    {'Prefer': 'count=exact', 'Range': '0-0'}).headers['content-range'].split('/')[-1])
        if n < local.get(k, 0):
            bad += 1
            print(f'FALTA faixa {k * 1000}: local {local.get(k, 0)} tabela {n}')
        time.sleep(0.15)
    print('OK, nenhuma faixa com menos linhas que o local' if not bad else f'{bad} faixas com buraco')
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from-block', type=int, default=934000)
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--verify', action='store_true')
    ap.add_argument('--batch', type=int, default=100)
    ap.add_argument('--pause', type=float, default=1.0)
    a = ap.parse_args()
    if a.verify:
        sys.exit(1 if verify(a.from_block) else 0)

    txs = load_local(a.from_block)
    have = present([t['txid'] for t in txs], 0.05)
    missing = [t for t in txs if t['txid'] not in have]
    per_block = {}
    for t in missing:
        per_block.setdefault(t['block_height'], []).append(t['txid'])
    blocks_all = {t['block_height'] for t in txs}
    loc_n = {}
    for t in txs:
        loc_n[t['block_height']] = loc_n.get(t['block_height'], 0) + 1
    zero = [b for b in per_block if loc_n[b] == len(per_block[b])]
    print(f'indice local >= {a.from_block}: {len(txs)} txs em {len(blocks_all)} blocos')
    print(f'FALTAM na tabela: {len(missing)} txs em {len(per_block)} blocos '
          f'({len(zero)} blocos sem nenhuma linha na tabela)')
    for b in sorted(per_block):
        print(f'  bloco {b}: {len(per_block[b])} tx')
    nb = -(-len(missing) // a.batch)
    print(f'plano: {nb} lotes de {a.batch} com pausa de {a.pause}s = ~{nb * (a.pause + 0.5):.0f}s; escrita com ignore-duplicates')
    if not a.apply:
        print('DRY-RUN: nada foi escrito. Use --apply para gravar.')
        return
    wh = {**H, 'Content-Type': 'application/json', 'Prefer': 'resolution=ignore-duplicates,return=minimal'}
    done = 0
    for i in range(0, len(missing), a.batch):
        rows = [row(t) for t in missing[i:i + a.batch]]
        for k in range(3):
            r = requests.post(f'{URL}/rest/v1/dog_transactions?on_conflict=txid', headers=wh, json=rows, timeout=60)
            if r.status_code in (200, 201, 204):
                break
            time.sleep(5 * (k + 1))
        else:
            raise SystemExit(f'POST falhou ({r.status_code}) apos {done} linhas; reexecute (idempotente)')
        done += len(rows)
        print(f'  gravadas {done}/{len(missing)}', flush=True)
        time.sleep(a.pause)
    still = set(x['txid'] for x in missing) - present([x['txid'] for x in missing], 0.05)
    print(f'conferencia: ainda ausentes {len(still)}')


if __name__ == '__main__':
    main()
