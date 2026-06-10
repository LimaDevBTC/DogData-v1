#!/usr/bin/env python3
"""
F1-T5 — reconcile the utxo_events backfill against ground truth.

Reads data/utxo_events.jsonl (produced by the EMIT_EVENTS replay), reconstructs
the live UTXO set (creates minus spends) and validates it against:
  1. data/dog_utxo_set.json   — production live set {outpoint: amount_raw}
  2. dog_holders.json utxo_age_stats — production realized_cap / MVRV / profit

This is the gate that decides whether the accurate foundation is trustworthy.
The Phase 0 offline path failed here (6% phantom supply, realized_cap 77% off);
the from-genesis replay should pass (orphan spends ~0, supply/realized within ~1%).

Usage: python3 scripts/reconcile_utxo_events.py
"""

import json
import os
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data'
EVENTS = DATA / 'utxo_events.jsonl'
DOG_FACTOR = 100000  # raw → DOG (divisibility 5)
STH_DAYS = 155


def main():
    if not EVENTS.exists():
        print(f'❌ {EVENTS} not found — run the backfill first.')
        return

    # ── Replay the event log into a live set ─────────────────────────────────
    # live[outpoint] = {amount, address, created_price, created_block}
    live = {}
    creates = spends = orphan_spends = 0
    orphan_dog = 0.0

    with EVENTS.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            e = json.loads(line)
            if e['e'] == 'C':
                creates += 1
                live[e['outpoint']] = {
                    'amount': e.get('amount_dog') or 0.0,
                    'address': e.get('address'),
                    'price': e.get('price'),
                    'block': e.get('block'),
                }
            else:  # 'S'
                spends += 1
                if e['outpoint'] in live:
                    del live[e['outpoint']]
                else:
                    orphan_spends += 1  # spend with no matching create = data gap

    live_supply = sum(u['amount'] for u in live.values())
    live_count = len(live)
    print('════════ EVENT LOG ════════')
    print(f'creates: {creates:,} | spends: {spends:,} | live utxos: {live_count:,}')
    print(f'orphan spends (no create): {orphan_spends:,}  '
          f'→ {"✅ clean" if orphan_spends == 0 else "⚠️ DATA GAP"}')
    print(f'live supply: {live_supply:,.2f} DOG')

    # ── Reconcile vs production live UTXO set ────────────────────────────────
    prod_path = DATA / 'dog_utxo_set.json'
    if prod_path.exists():
        prod = json.load(open(prod_path))  # {outpoint: amount_raw}
        prod_supply = sum(prod.values()) / DOG_FACTOR
        prod_set = set(prod.keys())
        live_set = set(live.keys())
        only_recon = live_set - prod_set
        only_prod = prod_set - live_set
        print('\n════════ vs dog_utxo_set.json (production live set) ════════')
        print(f'prod utxos: {len(prod_set):,} | recon utxos: {live_count:,}')
        print(f'prod supply: {prod_supply:,.2f} DOG')
        print(f'supply Δ: {(live_supply - prod_supply):+,.2f} DOG '
              f'({(live_supply - prod_supply) / prod_supply * 100:+.3f}%)')
        print(f'outpoints only in recon: {len(only_recon):,} | only in prod: {len(only_prod):,}'
              f'  (small tip diff expected — replay tip vs scanner tip)')

    # ── Reconcile cost-basis metrics vs production utxo_age_stats ────────────
    holders_path = DATA / 'dog_holders.json'
    if holders_path.exists():
        truth = json.load(open(holders_path))['utxo_age_stats']
        cur_price = truth['current_price']
        realized = sum(u['amount'] * u['price'] for u in live.values() if u['price'] is not None)
        priced = sum(1 for u in live.values() if u['price'] is not None)
        profit = sum(u['amount'] for u in live.values()
                     if u['price'] is not None and u['price'] < cur_price)
        market = live_supply * cur_price
        mvrv = market / realized if realized else 0
        profit_pct = profit / live_supply * 100 if live_supply else 0

        def err(a, b):
            return abs(a - b) / b * 100 if b else 0.0

        print('\n════════ cost-basis vs utxo_age_stats (production) ════════')
        rows = [
            ('realized_cap $', realized, truth['realized_cap']),
            ('market_cap $', market, truth['market_cap']),
            ('mvrv_ratio', mvrv, truth['mvrv_ratio']),
            ('supply_in_profit %', profit_pct, truth['supply_in_profit_pct']),
        ]
        print(f'{"metric":22}{"recon":>16}{"truth":>16}{"err%":>8}')
        for n, a, b in rows:
            print(f'{n:22}{a:16.4f}{b:16.4f}{err(a, b):7.2f}%')
        print(f'priced utxos: {priced:,}/{live_count:,} '
              f'(unpriced = created on a date missing from price_history)')

    # ── Verdict ──────────────────────────────────────────────────────────────
    print('\n════════ VERDICT ════════')
    ok = orphan_spends == 0
    if prod_path.exists():
        ok = ok and abs(live_supply - prod_supply) / prod_supply < 0.01
    print('✅ PASS — foundation trustworthy' if ok else
          '⚠️ REVIEW — gaps remain (see above); do not promote yet')


if __name__ == '__main__':
    main()
