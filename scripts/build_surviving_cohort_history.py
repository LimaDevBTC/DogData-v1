#!/usr/bin/env python3
"""
Option B — surviving-cohort historical backfill (F1-T5 pivot, decided 2026-06-17).

The from-genesis replay was abandoned (allocation cascade, see
diagnose_replay_allocation.py). Instead we reconstruct history from the TRUE
current UTXO set — `data/dog_utxos_by_address.json`, which production builds
hourly with each UTXO's real creation timestamp (from ord) — joined with
price_history for cost basis.

For each day D, the "surviving cohort" alive at D = current UTXOs whose creation
date <= D (they all survive to today by construction). From it we derive the
same panel as production's utxo_age_stats. This is EXACT at D=today
(coverage 100%) and survivorship-biased going back (coverage = surviving supply
at D / total). Each row carries `coverage_pct` so the UI can be honest.

Accurate for: recent history (last ~12 months, 60-100% coverage), HODL waves,
age bands, LTH/STH, realized cap of held supply. NOT for spent-coin metrics
(SOPR/CDD/realized-P&L) — those stay forward-only.

Built-in validation: the last row must match production utxo_age_stats.

Usage: python3 scripts/build_surviving_cohort_history.py
"""
import json
import bisect
from datetime import datetime, timezone, date
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data'
STH_DAYS = 155
TOTAL_SUPPLY = 100_000_000_000.0
AGE_BUCKETS = [(0, 1), (1, 7), (7, 30), (30, 90), (90, 155),
               (155, 365), (365, 730), (730, 10**9)]
AGE_LABELS = ['<1d', '1-7d', '7-30d', '30-90d', '90-155d', '155d-1y', '1-2y', '>2y']

# ── price history (forward-filled) ──────────────────────────────────────────
_p = json.loads((DATA / 'dog_price_history.json').read_text())
_pdays = sorted(_p.keys())


def price_on(dstr):
    v = _p.get(dstr)
    if v is not None:
        return v
    i = bisect.bisect_right(_pdays, dstr)
    return _p[_pdays[i - 1]] if i else _p[_pdays[0]]


def main():
    # ── load the true current UTXO set with creation timestamps ─────────────
    by_addr = json.loads((DATA / 'dog_utxos_by_address.json').read_text())
    utxos = []  # (creation_ordinal, amount, creation_price)
    for lst in by_addr.values():
        for u in lst:
            cd = datetime.fromtimestamp(u['ts'], tz=timezone.utc).date()
            utxos.append((cd.toordinal(), u['dog'], price_on(cd.isoformat())))
    utxos.sort(key=lambda x: x[0])
    total_now = sum(a for _, a, _ in utxos)
    print(f'[B] current set: {len(utxos):,} UTXOs, {total_now:,.0f} DOG')

    first_ord = utxos[0][0]
    today_ord = datetime.now(timezone.utc).date().toordinal()

    daily = []
    ptr = 0
    n = len(utxos)
    cum_supply = 0.0
    cum_realized = 0.0
    for O in range(first_ord, today_ord + 1):
        # Admit UTXOs created on/before day O (cumulative running totals).
        while ptr < n and utxos[ptr][0] <= O:
            cum_supply += utxos[ptr][1]
            cum_realized += utxos[ptr][1] * utxos[ptr][2]
            ptr += 1
        if ptr == 0:
            continue
        dstr = date.fromordinal(O).isoformat()
        price = price_on(dstr)

        # Single pass over admitted UTXOs for all age/price-dependent metrics.
        profit = sth = lth = age_weighted = 0.0
        sth_realized = lth_realized = 0.0
        buckets = [0.0] * len(AGE_BUCKETS)
        for cord, amt, cprice in utxos[:ptr]:
            if cprice < price:
                profit += amt
            age = O - cord
            age_weighted += amt * age
            if age < STH_DAYS:
                sth += amt
                sth_realized += amt * cprice
            else:
                lth += amt
                lth_realized += amt * cprice
            for i, (lo, hi) in enumerate(AGE_BUCKETS):
                if lo <= age < hi:
                    buckets[i] += amt
                    break

        market = cum_supply * price
        nupl = (market - cum_realized) / market if market else 0.0
        realized_price = cum_realized / cum_supply if cum_supply else 0.0
        sth_cost_basis = sth_realized / sth if sth else 0.0
        lth_cost_basis = lth_realized / lth if lth else 0.0

        daily.append({
            'date': dstr,
            'price': price,
            'coverage_pct': round(cum_supply / TOTAL_SUPPLY * 100, 3),
            'supply': cum_supply,
            'realized_cap': cum_realized,
            'market_cap': market,
            'mvrv_ratio': (market / cum_realized) if cum_realized else 0.0,
            'nupl': nupl,
            'realized_price': realized_price,
            'supply_in_profit_pct': profit / cum_supply * 100 if cum_supply else 0.0,
            'supply_in_loss_pct': (cum_supply - profit) / cum_supply * 100 if cum_supply else 0.0,
            'sth_percentage': sth / cum_supply * 100 if cum_supply else 0.0,
            'lth_percentage': lth / cum_supply * 100 if cum_supply else 0.0,
            'sth_realized_cap': sth_realized,
            'lth_realized_cap': lth_realized,
            'sth_cost_basis': sth_cost_basis,
            'lth_cost_basis': lth_cost_basis,
            'sth_mvrv': (sth * price / sth_realized) if sth_realized else 0.0,
            'lth_mvrv': (lth * price / lth_realized) if lth_realized else 0.0,
            'avg_age_days': age_weighted / cum_supply if cum_supply else 0.0,
            'hodl_wave_lt1d':    buckets[0],
            'hodl_wave_1_7d':    buckets[1],
            'hodl_wave_7_30d':   buckets[2],
            'hodl_wave_30_90d':  buckets[3],
            'hodl_wave_90_155d': buckets[4],
            'hodl_wave_155d_1y': buckets[5],
            'hodl_wave_1_2y':    buckets[6],
            'hodl_wave_gt2y':    buckets[7],
            'hodl_waves': {AGE_LABELS[i]: buckets[i] for i in range(len(AGE_BUCKETS))},
        })

    out = {'generated_at': datetime.now(timezone.utc).isoformat(),
           'method': 'surviving-cohort (Option B); survivorship-biased pre-100%-coverage',
           'daily': daily}
    payload = json.dumps(out)
    (DATA / 'surviving_cohort_history.json').write_text(payload)
    # also publish to public/data so the frontend can fetch it statically
    pub = DATA.parent / 'public' / 'data'
    pub.mkdir(parents=True, exist_ok=True)
    (pub / 'surviving_cohort_history.json').write_text(payload)
    print(f'[B] wrote {len(daily)} daily points → data/ + public/data/surviving_cohort_history.json')

    # ── validation: last row vs production utxo_age_stats ───────────────────
    last = daily[-1]
    truth = json.loads((DATA / 'dog_holders.json').read_text())['utxo_age_stats']

    def err(a, b):
        return abs(a - b) / b * 100 if b else 0.0

    print(f"\n════ VALIDATION: today (coverage {last['coverage_pct']}%) vs production ════")
    print(f'{"metric":22}{"cohort":>16}{"production":>16}{"err%":>8}')
    for key, tk in [('realized_cap', 'realized_cap'), ('market_cap', 'market_cap'),
                    ('mvrv_ratio', 'mvrv_ratio'), ('supply_in_profit_pct', 'supply_in_profit_pct'),
                    ('sth_percentage', 'sth_percentage'), ('lth_percentage', 'lth_percentage'),
                    ('avg_age_days', 'avg_age_days')]:
        a, b = last[key], truth[tk]
        print(f'{key:22}{a:16.4f}{b:16.4f}{err(a, b):7.2f}%')


if __name__ == '__main__':
    main()
