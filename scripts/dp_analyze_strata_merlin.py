#!/usr/bin/env python3
"""
Stratified lost analysis with relaxed thresholds + Merlin downstream overlap.

Outputs:
  data/diamond_paws_analysis/lost_strata_merlin.json
  data/diamond_paws_analysis/lost_strata_merlin.txt
"""
import csv
import datetime as dt
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "data" / "diamond_paws_analysis"
DATA = ROOT / "data"

LOST_CSV = DIR / "lost_addresses_relaxed.csv"
LAST_TX = DIR / "last_tx.jsonl"
ERRORS = DIR / "last_tx_errors.jsonl"

DOG_SUPPLY = 100_000_000_000
DP_TOTAL_DOG = 20_510_028_300

NOW = dt.datetime(2026, 5, 3, tzinfo=dt.timezone.utc)
DAYS = 86400

THRESHOLDS = [30, 90, 180, 365, 540, 730]  # days


def load_lost():
    out = {}
    with LOST_CSV.open() as fh:
        for r in csv.DictReader(fh):
            out[r["address"]] = {
                "airdrop_dog": float(r["airdrop_dog"]),
                "addr_type": r["addr_type"],
            }
    return out


def load_last_tx():
    out = {}
    with LAST_TX.open() as fh:
        for line in fh:
            try:
                d = json.loads(line)
                out[d["address"]] = d
            except Exception:
                pass
    return out


def load_too_many():
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


def load_merlin_destinations():
    """Collect every address that received DOG from a Merlin source wallet."""
    dests = set()
    flow = DATA / "merlin_flow_analysis.json"
    if flow.exists():
        with flow.open() as fh:
            d = json.load(fh)
        for entry in d.get("destinations", []):
            if isinstance(entry, dict) and "address" in entry:
                dests.add(entry["address"])
            elif isinstance(entry, str):
                dests.add(entry)

    deep = DATA / "merlin_deep_analysis.json"
    if deep.exists():
        with deep.open() as fh:
            d = json.load(fh)
        # Top holders give a sample
        for entry in d.get("top_100_holders", []):
            if isinstance(entry, dict) and "address" in entry:
                dests.add(entry["address"])

    geneal = DATA / "merlin_genealogy.json"
    if geneal.exists():
        with geneal.open() as fh:
            d = json.load(fh)
        # Walk branches recursively
        def walk(node):
            if isinstance(node, dict):
                for k, v in node.items():
                    if k == "address" and isinstance(v, str):
                        dests.add(v)
                    walk(v)
            elif isinstance(node, list):
                for x in node:
                    walk(x)
        walk(d)

    return dests


def load_merlin_destinations_with_amounts():
    """Per-address aggregated DOG received from Merlin sources, if available."""
    by_addr = {}
    flow = DATA / "merlin_flow_analysis.json"
    if flow.exists():
        with flow.open() as fh:
            d = json.load(fh)
        for entry in d.get("destinations", []):
            if isinstance(entry, dict) and "address" in entry:
                by_addr[entry["address"]] = entry.get("total_received_dog") or entry.get("amount_dog") or entry.get("total_dog") or 0
    return by_addr


def main():
    lost = load_lost()
    lt = load_last_tx()
    too_many = load_too_many()
    merlin_dests = load_merlin_destinations()
    merlin_amounts = load_merlin_destinations_with_amounts()

    print(f"lost-relaxed: {len(lost)}")
    print(f"last_tx data: {len(lt)}")
    print(f"too-many-active: {len(too_many)}")
    print(f"Merlin destinations (collected): {len(merlin_dests)}")

    # Compute age in days for each lost wallet (last_block_time)
    rows = []
    for a, info in lost.items():
        d = lt.get(a)
        if a in too_many:
            age = -1  # active flag
            last_t = None
        elif not d or d.get("last_block_time") is None:
            age = None  # unknown
            last_t = None
        else:
            last_t = dt.datetime.fromtimestamp(d["last_block_time"], tz=dt.timezone.utc)
            age = (NOW - last_t).total_seconds() / DAYS
        rows.append({
            "address": a,
            "airdrop_dog": info["airdrop_dog"],
            "addr_type": info["addr_type"],
            "age_days": age,
            "last_t": last_t,
            "from_merlin": a in merlin_dests,
        })

    # Stratified cumulative buckets: "older than N days" (i.e. wallet inactive ≥ N days)
    print("\n─── STRATIFIED BUCKETS (age ≥ N days = N days without ANY deposit) ───")
    strata = []
    for n in THRESHOLDS:
        cohort = [r for r in rows if r["age_days"] is not None and r["age_days"] >= 0 and r["age_days"] >= n]
        wallets = len(cohort)
        dog = sum(r["airdrop_dog"] for r in cohort)
        merlin_w = sum(1 for r in cohort if r["from_merlin"])
        merlin_dog = sum(r["airdrop_dog"] for r in cohort if r["from_merlin"])
        strata.append({
            "threshold_days": n,
            "approx_year_label": f"≥ {n}d (~{n//30}m)",
            "wallets": wallets,
            "dog_locked": dog,
            "pct_of_supply": dog / DOG_SUPPLY * 100,
            "pct_of_diamond_paws_dog": dog / DP_TOTAL_DOG * 100,
            "merlin_wallets": merlin_w,
            "merlin_dog": merlin_dog,
            "merlin_pct_of_cohort": (merlin_dog / dog * 100) if dog else 0,
        })

    # Distribution of last-deposit year-month with merlin overlay
    by_ym = Counter()
    by_ym_dog = Counter()
    by_ym_merlin = Counter()
    by_ym_merlin_dog = Counter()
    for r in rows:
        if r["last_t"] is None:
            continue
        ym = r["last_t"].strftime("%Y-%m")
        by_ym[ym] += 1
        by_ym_dog[ym] += r["airdrop_dog"]
        if r["from_merlin"]:
            by_ym_merlin[ym] += 1
            by_ym_merlin_dog[ym] += r["airdrop_dog"]

    # Overall Merlin overlap
    merlin_in_lost = [r for r in rows if r["from_merlin"]]
    merlin_in_lost_dog = sum(r["airdrop_dog"] for r in merlin_in_lost)

    report = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "as_of": NOW.isoformat(),
        "totals": {
            "lost_relaxed_wallets": len(lost),
            "lost_relaxed_dog": DP_TOTAL_DOG * 0.2798,  # from prior analysis, but recompute below
            "merlin_destinations_known": len(merlin_dests),
        },
        "merlin_overlap": {
            "lost_wallets_from_merlin": len(merlin_in_lost),
            "merlin_dog_in_lost_cohort": merlin_in_lost_dog,
            "pct_of_lost_dog_via_merlin": merlin_in_lost_dog / sum(r["airdrop_dog"] for r in rows) * 100,
        },
        "stratified": strata,
        "by_yearmonth": {
            ym: {
                "wallets": by_ym[ym],
                "dog": by_ym_dog[ym],
                "merlin_wallets": by_ym_merlin.get(ym, 0),
                "merlin_dog": by_ym_merlin_dog.get(ym, 0),
            }
            for ym in sorted(by_ym, key=lambda x: -by_ym[x])[:24]
        },
    }

    out_json = DIR / "lost_strata_merlin.json"
    out_json.write_text(json.dumps(report, indent=2))

    # Human summary
    L = []
    L.append("=" * 78)
    L.append("LOST DIAMOND PAWS — STRATIFIED + MERLIN OVERLAP")
    L.append("=" * 78)
    L.append(f"As of {NOW.date()}.  Universe: 6,035 lost-relaxed wallets, {sum(r['airdrop_dog'] for r in rows):,.0f} DOG total.")
    L.append("")
    L.append("─── CUMULATIVE STRATA — wallets inactive ≥ N days (no deposit since) ─────")
    L.append(f"  {'threshold':<14s} {'wallets':>8s} {'DOG':>15s} {'%supply':>9s} {'%DP':>7s} {'merlin_w':>9s} {'merlin_DOG':>13s} {'%cohort':>9s}")
    for s in strata:
        L.append(
            f"  ≥{s['threshold_days']:>4d}d ({s['threshold_days']//30:>2d}m){'':3s}"
            f"{s['wallets']:>8,} {s['dog_locked']:>15,.0f} {s['pct_of_supply']:>8.2f}% "
            f"{s['pct_of_diamond_paws_dog']:>6.2f}% {s['merlin_wallets']:>9,} "
            f"{s['merlin_dog']:>13,.0f} {s['merlin_pct_of_cohort']:>8.1f}%"
        )
    L.append("")
    L.append("Note: %supply = % of 100B DOG total supply.")
    L.append("      %DP    = % of 20.51B DOG held by all 19,878 diamond paws.")
    L.append("      merlin_* = subset of the cohort that received from Merlin custody wallets.")
    L.append("")
    L.append("─── MERLIN-CHAIN OVERLAP (overall) ─────────────────────────────────────")
    L.append(f"  Lost wallets that received from Merlin custody: {len(merlin_in_lost):,} / {len(lost):,}  ({len(merlin_in_lost)/len(lost)*100:.1f}%)")
    L.append(f"  DOG locked in those wallets:                    {merlin_in_lost_dog:,.0f}  ({merlin_in_lost_dog/DOG_SUPPLY*100:.2f}% of supply)")
    L.append("  → If Merlin distributed to L2 users, those represent unclaimed/abandoned L2 user wallets.")
    L.append("")
    L.append("─── LAST-DEPOSIT YEAR-MONTH × MERLIN ────────────────────────────────────")
    L.append(f"  {'month':<9s} {'wallets':>8s} {'DOG':>15s} {'merlin_w':>9s} {'merlin_DOG':>15s} {'merlin %':>9s}")
    for ym in sorted(by_ym, key=lambda x: -by_ym[x])[:14]:
        mw = by_ym_merlin.get(ym, 0)
        md = by_ym_merlin_dog.get(ym, 0)
        L.append(
            f"  {ym:<9s} {by_ym[ym]:>8,} {by_ym_dog[ym]:>15,.0f} "
            f"{mw:>9,} {md:>15,.0f} {(mw/by_ym[ym]*100 if by_ym[ym] else 0):>8.1f}%"
        )
    L.append("")
    L.append("=" * 78)

    summary = "\n".join(L)
    (DIR / "lost_strata_merlin.txt").write_text(summary)
    print(summary)


if __name__ == "__main__":
    main()
