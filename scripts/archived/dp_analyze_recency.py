#!/usr/bin/env python3
"""
Refine the lost-paws analysis with last-funded recency.

Inputs:
  data/diamond_paws_analysis/lost_addresses_relaxed.csv  (6,035 lost wallets)
  data/diamond_paws_analysis/last_tx.jsonl                (per-wallet first/last UTXO block_time)
  data/diamond_paws_analysis/last_tx_errors.jsonl         (HTTP 400 = "too many history" → mark as active)

Outputs:
  data/diamond_paws_analysis/lost_recency.json
  data/diamond_paws_analysis/lost_recency.txt
"""
import csv
import datetime as dt
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "data" / "diamond_paws_analysis"
LOST_CSV = DIR / "lost_addresses_relaxed.csv"
LAST_TX = DIR / "last_tx.jsonl"
ERRORS = DIR / "last_tx_errors.jsonl"

NOW = dt.datetime(2026, 5, 3, tzinfo=dt.timezone.utc)
DAYS = 86400

BUCKETS = [
    ("≤30 days",       30),
    ("31-90 days",     90),
    ("91-180 days",   180),
    ("181-365 days",  365),
    ("1-2 years",     365 * 2),
    ("> 2 years",     None),  # everything else
]


def bucket_for(age_days: float) -> str:
    for label, ub in BUCKETS:
        if ub is None:
            return label
        if age_days <= ub:
            return label
    return "> 2 years"


def load_lost():
    out = {}
    with LOST_CSV.open() as fh:
        for r in csv.DictReader(fh):
            out[r["address"]] = {
                "airdrop_dog": float(r["airdrop_dog"]),
                "addr_type": r["addr_type"],
                "funded_txo_count": int(r["funded_txo_count"]),
                "receive_count": int(r["receive_count"]),
            }
    return out


def load_last_tx():
    out = {}
    with LAST_TX.open() as fh:
        for line in fh:
            d = json.loads(line)
            out[d["address"]] = d
    return out


def load_errors_too_many():
    """HTTP 400 'too many history entries' = wallet has 1000+ txs → definitely active."""
    out = set()
    if not ERRORS.exists():
        return out
    with ERRORS.open() as fh:
        for line in fh:
            try:
                d = json.loads(line)
                if d.get("error") == "HTTP 400":
                    out.add(d["address"])
            except Exception:
                pass
    return out


def main():
    lost = load_lost()
    lt = load_last_tx()
    too_many = load_errors_too_many()

    print(f"lost wallets: {len(lost)}")
    print(f"with last_tx data: {len(lt)}")
    print(f"too-many-history (active): {len(too_many)}")
    missing = set(lost) - set(lt) - too_many
    print(f"missing data: {len(missing)}")

    # Per-wallet classification
    by_bucket_count = Counter()
    by_bucket_dog = Counter()
    by_addr_type_bucket = defaultdict(lambda: Counter())
    by_addr_type_dog = defaultdict(lambda: Counter())

    too_many_dog = 0
    missing_dog = 0
    truly_dormant_count = 0   # last_funded > 2 years ago
    truly_dormant_dog = 0
    only_airdrop_count = 0    # last_funded == first_funded == within airdrop window (apr 2024)
    only_airdrop_dog = 0
    yearly = defaultdict(int)
    yearly_dog = defaultdict(float)

    for addr, info in lost.items():
        if addr in too_many:
            too_many_dog += info["airdrop_dog"]
            by_bucket_count["[active: too many txs]"] += 1
            by_bucket_dog["[active: too many txs]"] += info["airdrop_dog"]
            by_addr_type_bucket[info["addr_type"]]["[active: too many txs]"] += 1
            by_addr_type_dog[info["addr_type"]]["[active: too many txs]"] += info["airdrop_dog"]
            continue
        d = lt.get(addr)
        if not d or d.get("last_block_time") is None:
            missing_dog += info["airdrop_dog"]
            continue
        last_t = dt.datetime.fromtimestamp(d["last_block_time"], tz=dt.timezone.utc)
        age = (NOW - last_t).total_seconds() / DAYS
        bucket = bucket_for(age)
        by_bucket_count[bucket] += 1
        by_bucket_dog[bucket] += info["airdrop_dog"]
        by_addr_type_bucket[info["addr_type"]][bucket] += 1
        by_addr_type_dog[info["addr_type"]][bucket] += info["airdrop_dog"]

        yr = last_t.strftime("%Y-%m")
        yearly[yr] += 1
        yearly_dog[yr] += info["airdrop_dog"]

        if age > 365 * 2:
            truly_dormant_count += 1
            truly_dormant_dog += info["airdrop_dog"]
        # "Only airdrop" = first AND last funded within airdrop window (block 840000-841000, ~2024-04-22 → 2024-04-29)
        if d.get("first_block_height") and d.get("last_block_height"):
            if d["first_block_height"] >= 840000 and d["last_block_height"] <= 841500:
                only_airdrop_count += 1
                only_airdrop_dog += info["airdrop_dog"]

    # Build a fresh "true ghost" cohort: lost-relaxed AND last-funded > 2 years ago
    # (since airdrop = ~2 years ago, this means: never received anything since the airdrop)

    report = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "as_of": NOW.isoformat(),
        "inputs": {
            "lost_relaxed_total": len(lost),
            "with_last_tx_data": len(lt),
            "too_many_history_active": len(too_many),
            "missing": len(missing),
            "coverage_pct": (len(lt) + len(too_many)) / len(lost) * 100,
        },
        "by_recency_bucket": {
            "wallets": dict(by_bucket_count),
            "dog_locked": {k: float(v) for k, v in by_bucket_dog.items()},
        },
        "truly_dormant_2y_plus": {
            "definition": "Lost-relaxed wallets whose most recent UTXO was funded > 2 years ago, "
                          "i.e. nothing received since around airdrop time. Strongest evidence of abandonment.",
            "wallets": truly_dormant_count,
            "dog_locked": truly_dormant_dog,
            "pct_of_supply": truly_dormant_dog / 100_000_000_000 * 100,
            "pct_of_diamond_paws_dog": truly_dormant_dog / 20_510_028_300 * 100,
        },
        "only_airdrop_window": {
            "definition": "Lost-relaxed wallets where ALL UTXOs were funded between block 840000 and 841500 "
                          "(roughly the airdrop distribution window in April 2024).",
            "wallets": only_airdrop_count,
            "dog_locked": only_airdrop_dog,
        },
        "by_address_type": {
            t: {
                "wallets_per_bucket": dict(by_addr_type_bucket[t]),
                "dog_per_bucket": {k: float(v) for k, v in by_addr_type_dog[t].items()},
            } for t in by_addr_type_bucket
        },
        "last_funded_by_yearmonth_top": dict(sorted(yearly.items(), key=lambda x: -x[1])[:24]),
    }

    out_json = DIR / "lost_recency.json"
    out_json.write_text(json.dumps(report, indent=2))

    # Human summary
    lines = []
    lines.append("=" * 70)
    lines.append("DIAMOND PAWS LOST WALLETS — RECENCY OF LAST DEPOSIT")
    lines.append("=" * 70)
    lines.append(f"Coverage: {len(lt)} with date + {len(too_many)} known-active (HTTP 400) = {(len(lt)+len(too_many))/len(lost)*100:.1f}% of {len(lost)} lost-relaxed wallets")
    lines.append(f"Missing data: {len(missing)} wallets ({missing_dog:,.0f} DOG)")
    lines.append("")
    lines.append("─── DISTRIBUTION BY LAST DEPOSIT AGE ─────────────────────────────────")
    lines.append(f"  {'bucket':<28s}  {'wallets':>8s}  {'DOG locked':>16s}  {'% of lost':>10s}")
    total_dog_with_data = sum(by_bucket_dog.values())
    bucket_order = [b for b, _ in BUCKETS] + ["[active: too many txs]"]
    for b in bucket_order:
        n = by_bucket_count.get(b, 0)
        dog = by_bucket_dog.get(b, 0)
        pct = dog / total_dog_with_data * 100 if total_dog_with_data else 0
        lines.append(f"  {b:<28s}  {n:>8,}  {dog:>16,.0f}  {pct:>9.1f}%")
    lines.append("")
    lines.append("─── TRULY DORMANT (last funded > 2y ago) ─────────────────────────────")
    lines.append(f"  wallets:         {truly_dormant_count:,}")
    lines.append(f"  DOG locked:      {truly_dormant_dog:,.0f}")
    lines.append(f"  % of supply:     {truly_dormant_dog/100_000_000_000*100:.3f}%")
    lines.append(f"  % of diamond paws: {truly_dormant_dog/20_510_028_300*100:.2f}%")
    lines.append("")
    lines.append("─── ALL UTXOs INSIDE AIRDROP WINDOW (block 840k-841.5k, apr 2024) ────")
    lines.append(f"  wallets:         {only_airdrop_count:,}")
    lines.append(f"  DOG locked:      {only_airdrop_dog:,.0f}")
    lines.append("  → received only the airdrop, never any later drops; strongest 'lost' signal")
    lines.append("")
    lines.append("─── BY ADDRESS TYPE × BUCKET ─────────────────────────────────────────")
    for t in ["p2tr", "p2wpkh/p2wsh", "p2sh", "p2pkh"]:
        if t not in by_addr_type_bucket:
            continue
        lines.append(f"  {t}:")
        for b in bucket_order:
            n = by_addr_type_bucket[t].get(b, 0)
            if n:
                lines.append(f"    {b:<28s}  {n:>5,}")
    lines.append("")
    lines.append("─── TOP 12 (year-month) WHEN LAST FUNDED ────────────────────────────")
    for ym, n in sorted(yearly.items(), key=lambda x: -x[1])[:12]:
        dog = yearly_dog.get(ym, 0)
        lines.append(f"  {ym}  →  {n:>5,} wallets   {dog:>16,.0f} DOG")
    lines.append("")
    lines.append("=" * 70)

    summary = "\n".join(lines)
    (DIR / "lost_recency.txt").write_text(summary)
    print(summary)


if __name__ == "__main__":
    main()
