#!/usr/bin/env python3
"""
PHASE 0 SPIKE — offline historical reconstruction of DOG on-chain state.

Thesis to prove: from the already-reconstructed per-block flow files
(data/dog_transactions/block_*.json), we can rebuild the COMPLETE cost-basis
state of DOG over time using a lot/FIFO model — WITHOUT re-running the chain,
touching the ord index, or stopping the live scanner.

Model
-----
Each receiver output = a "lot": (amount_dog, block, date, cost_basis=price@date).
Each sender input = consume that address's lots FIFO (oldest first).
A self-transfer therefore consumes a lot and recreates it at the new block/price
— i.e. coin age resets and cost basis updates when coins move (Glassnode convention).

From the live set of lots at any day boundary we derive, coin-weighted:
  realized_cap = Σ amount·cost_basis     market_cap = supply·price
  MVRV = market/realized                 supply_in_profit = Σ amount where cost_basis < price
  age distribution / STH(<155d) vs LTH(≥155d)
And from lots consumed that day: SOPR, coin-days-destroyed (CDD), realized P/L.

Validation
----------
Reconstructed CURRENT state is reconciled against the ground-truth
utxo_age_stats in dog_holders.json (computed from the real UTXO set).

Usage: python3 scripts/spike_reconstruct_history.py [--max-blocks N]
"""

import json, glob, re, sys, os
from collections import deque, defaultdict
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
TX_DIR = os.path.join(DATA, "dog_transactions")

STH_THRESHOLD_DAYS = 155
PREMINE_DOG = 100_000_000_000.0  # 1e11 DOG, 100% premine at etching (block 840000)
ETCH_BLOCK = 840000
ETCH_DATE = "2024-04-24"  # first price we have; genesis lot is consumed almost immediately

# Age buckets for HODL waves (days)
AGE_BUCKETS = [(0, 1), (1, 7), (7, 30), (30, 90), (90, 155),
               (155, 365), (365, 730), (730, 10000)]
AGE_LABELS = ["<1d", "1-7d", "7-30d", "30-90d", "90-155d", "155d-1y", "1-2y", ">2y"]


def load_prices():
    with open(os.path.join(DATA, "dog_price_history.json")) as f:
        p = json.load(f)
    days = sorted(p.keys())
    return p, days


def price_of(prices, sorted_days, date):
    """Price on `date`, forward-filling gaps and after the last known day."""
    v = prices.get(date)
    if v is not None:
        return v
    # forward fill: largest known day <= date, else earliest
    import bisect
    i = bisect.bisect_right(sorted_days, date)
    if i == 0:
        return prices[sorted_days[0]]
    return prices[sorted_days[i - 1]]


_ORD_CACHE = {}


def date_ord(date):
    o = _ORD_CACHE.get(date)
    if o is None:
        o = datetime.strptime(date, "%Y-%m-%d").toordinal()
        _ORD_CACHE[date] = o
    return o


def days_between(d1, d2):
    return abs(date_ord(d2) - date_ord(d1))


def snapshot(lots_by_addr, date, price):
    """Coin-weighted state metrics from live lots at `date`."""
    supply = 0.0
    realized = 0.0
    profit_supply = 0.0
    age_buckets = [0.0] * len(AGE_BUCKETS)
    sth = lth = 0.0
    age_weighted = 0.0
    for lots in lots_by_addr.values():
        for amt, blk, ldate, cb in lots:
            supply += amt
            realized += amt * cb
            if cb < price:
                profit_supply += amt
            age = days_between(ldate, date)
            age_weighted += amt * age
            if age < STH_THRESHOLD_DAYS:
                sth += amt
            else:
                lth += amt
            for i, (lo, hi) in enumerate(AGE_BUCKETS):
                if lo <= age < hi:
                    age_buckets[i] += amt
                    break
    market = supply * price
    return {
        "date": date,
        "price": price,
        "supply": supply,
        "realized_cap": realized,
        "market_cap": market,
        "mvrv_ratio": (market / realized) if realized else 0.0,
        "supply_in_profit_pct": (profit_supply / supply * 100) if supply else 0.0,
        "avg_age_days": (age_weighted / supply) if supply else 0.0,
        "sth_percentage": (sth / supply * 100) if supply else 0.0,
        "lth_percentage": (lth / supply * 100) if supply else 0.0,
        "hodl_waves": {AGE_LABELS[i]: age_buckets[i] for i in range(len(AGE_BUCKETS))},
    }


def main():
    max_blocks = None
    if "--max-blocks" in sys.argv:
        max_blocks = int(sys.argv[sys.argv.index("--max-blocks") + 1])

    prices, pdays = load_prices()
    print(f"[spike] loaded {len(pdays)} price days ({pdays[0]} → {pdays[-1]})")

    files = glob.glob(os.path.join(TX_DIR, "block_*.json"))
    heights = sorted(int(re.search(r"block_(\d+)", f).group(1)) for f in files)
    if max_blocks:
        heights = heights[:max_blocks]
    print(f"[spike] processing {len(heights)} block files ({heights[0]} → {heights[-1]})")

    # lots_by_addr[address] = deque of [amount_dog, block, date, cost_basis]
    lots_by_addr = defaultdict(deque)

    # Seed genesis premine lot
    genesis_price = price_of(prices, pdays, ETCH_DATE)
    # The genesis address is the sender of the very first tx; seed lazily by
    # giving any address that goes negative the benefit only via deficit tracking.
    # Simpler: seed the known premine holder once we see the first sender.
    seeded = False

    daily = {}
    daily_flow = defaultdict(lambda: {"cdd": 0.0, "spent_value": 0.0, "cost_value": 0.0,
                                      "realized_pl": 0.0, "spent_dog": 0.0})
    cur_date = None
    deficit_events = 0
    deficit_dog = 0.0

    for n, h in enumerate(heights):
        fp = os.path.join(TX_DIR, f"block_{h:07d}.json")
        try:
            with open(fp) as f:
                blk = json.load(f)
        except Exception:
            continue
        txs = blk.get("transactions", [])
        if not txs:
            continue
        # Block-level date/price (all txs in a block share block time)
        ts0 = txs[0].get("timestamp", "")
        date = ts0[:10] if ts0 else cur_date
        if not date:
            continue
        price = price_of(prices, pdays, date)

        # Day rollover -> snapshot previous day's end state
        if cur_date is not None and date != cur_date and date > cur_date:
            daily[cur_date] = snapshot(lots_by_addr, cur_date, price_of(prices, pdays, cur_date))
        cur_date = date

        # Seed genesis on the very first sender (the premine holder)
        if not seeded:
            for tx in txs:
                for s in tx.get("senders", []):
                    if s.get("has_dog"):
                        lots_by_addr[s["address"]].append(
                            [PREMINE_DOG, ETCH_BLOCK, ETCH_DATE, genesis_price])
                        seeded = True
                        break
                if seeded:
                    break

        def coverable(tx):
            need = defaultdict(float)
            for s in tx.get("senders", []):
                if s.get("has_dog"):
                    need[s["address"]] += float(s.get("amount_dog", 0.0))
            for addr, n in need.items():
                if sum(l[0] for l in lots_by_addr[addr]) + 1e-6 < n:
                    return False
            return True

        def apply_tx(tx, force=False):
            # 1) Consume sender lots (FIFO)
            for s in tx.get("senders", []):
                if not s.get("has_dog"):
                    continue
                need = float(s.get("amount_dog", 0.0))
                dq = lots_by_addr[s["address"]]
                while need > 1e-9 and dq:
                    amt, blk_h, ldate, cb = dq[0]
                    take = min(amt, need)
                    age = days_between(ldate, date)
                    fl = daily_flow[date]
                    fl["cdd"] += take * age
                    fl["spent_value"] += take * price
                    fl["cost_value"] += take * cb
                    fl["realized_pl"] += take * (price - cb)
                    fl["spent_dog"] += take
                    if take >= amt - 1e-9:
                        dq.popleft()
                    else:
                        dq[0][0] = amt - take
                    need -= take
                if need > 1e-6:
                    nonlocal_def[0] += 1
                    nonlocal_def[1] += need
            # 2) Create receiver lots
            for r in tx.get("receivers", []):
                if not r.get("has_dog"):
                    continue
                amt = float(r.get("amount_dog", 0.0))
                if amt > 0:
                    lots_by_addr[r["address"]].append([amt, h, date, price])

        nonlocal_def = [0, 0.0]
        # Intra-block topological ordering: process coverable txs first,
        # iterate to a fixpoint, then force any remainder (genuine missing receives).
        pending = list(txs)
        while pending:
            progressed = []
            still = []
            for tx in pending:
                if coverable(tx):
                    apply_tx(tx)
                    progressed.append(tx)
                else:
                    still.append(tx)
            if not progressed:
                # no coverable tx left -> force-apply remainder (records deficits)
                for tx in still:
                    apply_tx(tx, force=True)
                break
            pending = still
        deficit_events += nonlocal_def[0]
        deficit_dog += nonlocal_def[1]

        if (n + 1) % 10000 == 0:
            print(f"[spike] {n+1}/{len(heights)} blocks  (date {cur_date})  "
                  f"addrs={len(lots_by_addr)} deficits={deficit_events}")

    # Final snapshot
    if cur_date:
        daily[cur_date] = snapshot(lots_by_addr, cur_date, price_of(prices, pdays, cur_date))

    # ─── Reconciliation vs ground truth ──────────────────────────────────
    with open(os.path.join(DATA, "dog_holders.json")) as f:
        truth = json.load(f)["utxo_age_stats"]
    truth_price = truth["current_price"]

    final = snapshot(lots_by_addr, cur_date, truth_price)  # use live price for fair compare
    nonzero_addrs = sum(1 for lots in lots_by_addr.values() if sum(l[0] for l in lots) > 1e-6)

    def pct_err(got, exp):
        return abs(got - exp) / exp * 100 if exp else 0.0

    report = {
        "reconstructed": {
            "supply": final["supply"],
            "realized_cap": final["realized_cap"],
            "market_cap": final["market_cap"],
            "mvrv_ratio": final["mvrv_ratio"],
            "supply_in_profit_pct": final["supply_in_profit_pct"],
            "avg_age_days": final["avg_age_days"],
            "sth_percentage": final["sth_percentage"],
            "lth_percentage": final["lth_percentage"],
            "holders_nonzero": nonzero_addrs,
        },
        "truth": {
            "supply": truth["total_supply"] / 1e5,
            "realized_cap": truth["realized_cap"],
            "market_cap": truth["market_cap"],
            "mvrv_ratio": truth["mvrv_ratio"],
            "supply_in_profit_pct": truth["supply_in_profit_pct"],
            "avg_age_days": truth["avg_age_days"],
            "sth_percentage": truth["sth_percentage"],
            "lth_percentage": truth["lth_percentage"],
        },
        "deficit_events": deficit_events,
        "deficit_dog": deficit_dog,
        "daily_points": len(daily),
    }

    print("\n================ RECONCILIATION ================")
    r, t = report["reconstructed"], report["truth"]
    rows = [
        ("supply (DOG)", r["supply"], t["supply"]),
        ("realized_cap ($)", r["realized_cap"], t["realized_cap"]),
        ("market_cap ($)", r["market_cap"], t["market_cap"]),
        ("mvrv_ratio", r["mvrv_ratio"], t["mvrv_ratio"]),
        ("supply_in_profit %", r["supply_in_profit_pct"], t["supply_in_profit_pct"]),
        ("avg_age_days", r["avg_age_days"], t["avg_age_days"]),
        ("sth %", r["sth_percentage"], t["sth_percentage"]),
        ("lth %", r["lth_percentage"], t["lth_percentage"]),
    ]
    print(f"{'metric':22} {'reconstructed':>18} {'truth':>18} {'err%':>8}")
    for name, got, exp in rows:
        print(f"{name:22} {got:18.4f} {exp:18.4f} {pct_err(got,exp):7.2f}%")
    print(f"\nholders nonzero: {nonzero_addrs} (truth total_holders ~88273)")
    print(f"deficit events: {deficit_events}  deficit DOG: {deficit_dog:,.2f}")
    print(f"daily snapshots produced: {len(daily)}")

    # Persist daily panels + flow + report
    out = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "reconciliation": report,
        "daily": [daily[d] | daily_flow.get(d, {}) for d in sorted(daily.keys())],
    }
    outpath = os.path.join(DATA, "spike_reconstructed_history.json")
    with open(outpath, "w") as f:
        json.dump(out, f)
    print(f"\n[spike] wrote {outpath} ({len(daily)} daily points)")


if __name__ == "__main__":
    main()
