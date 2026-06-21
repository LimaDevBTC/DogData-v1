#!/usr/bin/env python3
"""
Accumulates daily A-source metrics into public/data/metrics_a_history.json.

Reads dog_holders.json (updated hourly) and upserts one entry per calendar
day. On the first run it backfills total_utxos from utxo_count_history.json.

Output is a static JSON served by Next.js; the chart grid reads it instead of
hitting the Supabase API for these concentration/activity metrics.
"""
import json
from datetime import datetime, timezone, date
from pathlib import Path

DATA    = Path(__file__).resolve().parent.parent / 'data'
PROJECT = Path(__file__).resolve().parent.parent
OUT     = PROJECT / 'public' / 'data' / 'metrics_a_history.json'


def compute_gini(amounts: list[float]) -> float:
    if not amounts:
        return 0.0
    s = sorted(amounts)
    n = len(s)
    total = sum(s)
    if total == 0:
        return 0.0
    weighted = sum((i + 1) * v for i, v in enumerate(s))
    return (2 * weighted) / (n * total) - (n + 1) / n


def main():
    src = DATA / 'dog_holders.json'
    if not src.exists():
        print('[A-snap] dog_holders.json not found — skipping')
        return

    data    = json.loads(src.read_text())
    holders = data.get('holders', [])
    uas     = data.get('utxo_age_stats', {})
    today   = date.today().isoformat()

    # concentration — computed from full holder list
    amounts = [h['total_dog'] for h in holders if h.get('total_dog', 0) > 0]
    held    = sum(amounts)
    desc    = sorted(amounts, reverse=True)
    gini    = compute_gini(amounts)

    snapshot = {
        'date':                  today,
        'total_holders':         data.get('total_holders', len(holders)),
        'total_utxos':           data.get('total_utxos', 0),
        'gini_coefficient':      round(gini, 6),
        'top10_supply_pct':      round(sum(desc[:10])   / held * 100, 4) if held else 0.0,
        'top100_supply_pct':     round(sum(desc[:100])  / held * 100, 4) if held else 0.0,
        'top1000_supply_pct':    round(sum(desc[:1000]) / held * 100, 4) if held else 0.0,
        'avg_age_days':          uas.get('avg_age_days', 0),
        'median_age_days':       uas.get('median_age_days', 0),
        'sth_percentage':        uas.get('sth_percentage', 0),
        'lth_percentage':        uas.get('lth_percentage', 0),
        'mvrv_ratio':            uas.get('mvrv_ratio', 0),
        'supply_in_profit_pct':  uas.get('supply_in_profit_pct', 0),
        'supply_in_loss_pct':    uas.get('supply_in_loss_pct', 0),
        'current_price':         uas.get('current_price', 0),
    }

    # load existing
    existing = json.loads(OUT.read_text()) if OUT.exists() else {'daily': []}
    daily    = existing.get('daily', [])

    # first-run backfill: inject total_utxos history from utxo_count_history.json
    if not daily:
        uch = DATA / 'utxo_count_history.json'
        if uch.exists():
            utxo_hist = json.loads(uch.read_text()).get('history', [])
            for e in utxo_hist:
                d, u = e.get('date'), e.get('total_utxos')
                if d and u:
                    daily.append({'date': d, 'total_utxos': u})
            print(f'[A-snap] backfilled {len(daily)} utxo_count entries')

    # upsert today
    idx = next((i for i, e in enumerate(daily) if e.get('date') == today), -1)
    if idx >= 0:
        daily[idx] = snapshot
    else:
        daily.append(snapshot)

    daily.sort(key=lambda e: e['date'])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'daily':        daily,
    }))
    print(f'[A-snap] metrics_a_history.json: {len(daily)} entries → {today}')
    print(f'         gini={gini:.4f}  top10={snapshot["top10_supply_pct"]:.2f}%  holders={snapshot["total_holders"]:,}')


if __name__ == '__main__':
    main()
