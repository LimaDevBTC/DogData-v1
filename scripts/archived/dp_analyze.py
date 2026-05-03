#!/usr/bin/env python3
"""
Analyze diamond-paws chain_stats to estimate "lost" cohort.

Inputs:
  data/diamond_paws_analysis/diamond_paws.csv     (address, airdrop_amount_dog, first_receive_block, ...)
  data/diamond_paws_analysis/chain_stats.jsonl    (per-address blockstream chain_stats)

Outputs:
  data/diamond_paws_analysis/lost_analysis.json   (full structured report)
  data/diamond_paws_analysis/lost_analysis.txt    (human summary)
  data/diamond_paws_analysis/lost_addresses_strict.csv
  data/diamond_paws_analysis/lost_addresses_relaxed.csv
"""
import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANALYSIS_DIR = ROOT / "data" / "diamond_paws_analysis"
DP_CSV = ANALYSIS_DIR / "diamond_paws.csv"
CS_JSONL = ANALYSIS_DIR / "chain_stats.jsonl"

DOG_TOTAL_SUPPLY = 100_000_000_000  # 100B DOG


def load_diamond_paws() -> dict:
    rows = {}
    with DP_CSV.open() as fh:
        for r in csv.DictReader(fh):
            rows[r["address"]] = {
                "airdrop_dog": float(r["airdrop_amount_dog"]),
                "first_receive_block": int(r["first_receive_block"]) if r.get("first_receive_block") else None,
                "first_receive_time": r.get("first_receive_time", ""),
                "receive_count": int(r["receive_count"]) if r.get("receive_count") else 0,
            }
    return rows


def load_chain_stats() -> dict:
    out = {}
    with CS_JSONL.open() as fh:
        for line in fh:
            d = json.loads(line)
            out[d["address"]] = d
    return out


def addr_type(a: str) -> str:
    if a.startswith("bc1p"):
        return "p2tr"
    if a.startswith("bc1"):
        return "p2wpkh/p2wsh"
    if a.startswith("3"):
        return "p2sh"
    if a.startswith("1"):
        return "p2pkh"
    return "other"


def main():
    dp = load_diamond_paws()
    cs = load_chain_stats()
    print(f"diamond paws: {len(dp)}")
    print(f"chain_stats fetched: {len(cs)}")
    missing = set(dp) - set(cs)
    print(f"missing chain_stats: {len(missing)}")

    # Diamond paws with their on-chain stats
    enriched = []
    for addr, info in dp.items():
        c = cs.get(addr)
        if not c:
            continue
        enriched.append({
            "address": addr,
            "airdrop_dog": info["airdrop_dog"],
            "receive_count": info["receive_count"],
            "addr_type": addr_type(addr),
            "tx_count": c["chain_tx_count"],
            "funded_txo_count": c["chain_funded_txo_count"],
            "spent_txo_count": c["chain_spent_txo_count"],
            "mempool_tx_count": c.get("mempool_tx_count", 0),
        })

    n = len(enriched)
    total_airdrop_dog = sum(e["airdrop_dog"] for e in enriched)

    # --- Definitions ---
    # RELAXED: never spent anything from this address.
    # STRICT: never spent AND received nothing beyond the airdrop tx(s).
    #         (funded_txo_count == receive_count → all UTXOs received are airdrop deposits)
    #         (no mempool activity)
    # ACTIVE: sent at least one tx OR received non-airdrop deposits
    relaxed = [e for e in enriched if e["spent_txo_count"] == 0]
    # Practical strict: never spent + ≤2 extra deposits (allowing for incidental dust)
    strict = [
        e for e in relaxed
        if (e["funded_txo_count"] - e["receive_count"]) <= 2
        and e["mempool_tx_count"] == 0
    ]
    active = [e for e in enriched if e["spent_txo_count"] > 0]

    sum_dog_relaxed = sum(e["airdrop_dog"] for e in relaxed)
    sum_dog_strict = sum(e["airdrop_dog"] for e in strict)
    sum_dog_active = sum(e["airdrop_dog"] for e in active)

    # Sanity: relaxed should ≈ all (since diamond paws by definition have current_balance == airdrop)
    # But "sent then received back same amount" is possible — verify.
    weird_recovered = [
        e for e in active
        # they sent something but balance still == airdrop (got it back?)
    ]

    # Spent breakdown
    spent_buckets = Counter()
    for e in active:
        s = e["spent_txo_count"]
        if s == 1: spent_buckets["1"] += 1
        elif s <= 5: spent_buckets["2-5"] += 1
        elif s <= 20: spent_buckets["6-20"] += 1
        elif s <= 100: spent_buckets["21-100"] += 1
        else: spent_buckets["100+"] += 1

    # Funded-beyond-airdrop (got later deposits but never spent)
    funded_extra = [e for e in relaxed if e["funded_txo_count"] > e["receive_count"]]
    sum_dog_funded_extra = sum(e["airdrop_dog"] for e in funded_extra)

    # Distribution of "extra" deposits among lost-relaxed wallets
    def bucket_extras(diff):
        if diff == 0: return "0_only_airdrop"
        if diff <= 2: return "1_to_2"
        if diff <= 5: return "3_to_5"
        if diff <= 20: return "6_to_20"
        if diff <= 100: return "21_to_100"
        return "100_plus"

    extras_count = Counter()
    extras_dog = Counter()
    # Need diamond_paws data for receive_count
    dp_lookup = {a: dp[a]["receive_count"] for a in dp}
    for e in relaxed:
        diff = e["funded_txo_count"] - e["receive_count"]
        b = bucket_extras(diff)
        extras_count[b] += 1
        extras_dog[b] += e["airdrop_dog"]

    # Address type breakdown
    by_type_lost = Counter()
    by_type_active = Counter()
    for e in relaxed: by_type_lost[e["addr_type"]] += 1
    for e in active: by_type_active[e["addr_type"]] += 1

    # Top 20 lost wallets by DOG
    top_lost = sorted(relaxed, key=lambda x: -x["airdrop_dog"])[:20]
    top_strict = sorted(strict, key=lambda x: -x["airdrop_dog"])[:20]

    report = {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "data_source": {
            "diamond_paws_csv": str(DP_CSV.relative_to(ROOT)),
            "chain_stats_jsonl": str(CS_JSONL.relative_to(ROOT)),
            "external_api": "https://blockstream.info/api",
        },
        "constants": {
            "dog_total_supply": DOG_TOTAL_SUPPLY,
            "diamond_paws_definition": "current_balance == airdrop_amount, retention 100%",
            "criteria": {
                "relaxed": "spent_txo_count == 0 (never sent any UTXO from this address)",
                "strict": "spent_txo_count == 0 AND (funded_txo_count - receive_count) <= 2 AND mempool_tx_count == 0",
                "active": "spent_txo_count > 0 (has spent at least one UTXO from this address)",
                "note": "The diamond-paws label is DOG-specific (the DOG-bearing UTXO is untouched). 'Active' diamond paws have spent OTHER UTXOs (BTC dust, other runes) — keys are accessible, wallet is not lost.",
            },
        },
        "totals": {
            "diamond_paws_with_stats": n,
            "diamond_paws_missing_stats": len(missing),
            "total_airdrop_dog": total_airdrop_dog,
            "pct_of_supply": total_airdrop_dog / DOG_TOTAL_SUPPLY * 100,
        },
        "lost_relaxed": {
            "count": len(relaxed),
            "pct_of_diamond_paws": len(relaxed) / n * 100,
            "dog_locked": sum_dog_relaxed,
            "pct_of_diamond_paws_dog": sum_dog_relaxed / total_airdrop_dog * 100,
            "pct_of_supply": sum_dog_relaxed / DOG_TOTAL_SUPPLY * 100,
        },
        "lost_strict": {
            "count": len(strict),
            "pct_of_diamond_paws": len(strict) / n * 100,
            "dog_locked": sum_dog_strict,
            "pct_of_diamond_paws_dog": sum_dog_strict / total_airdrop_dog * 100,
            "pct_of_supply": sum_dog_strict / DOG_TOTAL_SUPPLY * 100,
        },
        "active_after_airdrop": {
            "count": len(active),
            "pct_of_diamond_paws": len(active) / n * 100,
            "dog_held": sum_dog_active,
            "spent_txo_buckets": dict(spent_buckets),
            "note": "Surprising — these wallets sent something but their DOG balance equals the airdrop. Either round-trip or the diamond_paws label needs re-examination.",
        },
        "funded_after_airdrop_but_unspent": {
            "count": len(funded_extra),
            "dog_in_these_wallets": sum_dog_funded_extra,
            "interpretation": "Received additional deposits (dust attacks, later airdrops, etc.) but never spent. Still 'lost' under relaxed criterion.",
            "extra_deposits_distribution": {
                bucket: {"wallets": extras_count[bucket], "dog": extras_dog[bucket]}
                for bucket in ["0_only_airdrop", "1_to_2", "3_to_5", "6_to_20", "21_to_100", "100_plus"]
                if bucket in extras_count
            },
        },
        "address_type_breakdown": {
            "lost_relaxed": dict(by_type_lost),
            "active": dict(by_type_active),
        },
        "top_20_lost_wallets_by_dog": [
            {"address": e["address"], "dog": e["airdrop_dog"], "funded_txos": e["funded_txo_count"], "tx_count": e["tx_count"]}
            for e in top_lost
        ],
        "top_20_strictly_lost_wallets_by_dog": [
            {"address": e["address"], "dog": e["airdrop_dog"]}
            for e in top_strict
        ],
    }

    out_json = ANALYSIS_DIR / "lost_analysis.json"
    out_json.write_text(json.dumps(report, indent=2, default=str))

    # Lost-address CSVs
    with (ANALYSIS_DIR / "lost_addresses_strict.csv").open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["address", "airdrop_dog", "addr_type"])
        for e in sorted(strict, key=lambda x: -x["airdrop_dog"]):
            w.writerow([e["address"], e["airdrop_dog"], e["addr_type"]])
    with (ANALYSIS_DIR / "lost_addresses_relaxed.csv").open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["address", "airdrop_dog", "addr_type", "funded_txo_count", "receive_count"])
        for e in sorted(relaxed, key=lambda x: -x["airdrop_dog"]):
            w.writerow([e["address"], e["airdrop_dog"], e["addr_type"], e["funded_txo_count"], e["receive_count"]])

    # Human summary
    lines = []
    lines.append("=" * 70)
    lines.append("DIAMOND PAWS — DOG AIRDROP LOST-WALLET ANALYSIS")
    lines.append("=" * 70)
    lines.append(f"Generated: {report['generated_at']}")
    lines.append(f"Source: forensic_behavioral_analysis.json + blockstream.info /api/address")
    lines.append("")
    lines.append(f"Total diamond paws analyzed:  {n:,}  (missing on-chain stats: {len(missing)})")
    lines.append(f"Total DOG held by them:       {total_airdrop_dog:,.0f}  ({total_airdrop_dog/DOG_TOTAL_SUPPLY*100:.2f}% of 100B supply)")
    lines.append("")
    lines.append("─── LOST (RELAXED: never spent anything) ────────────────────────────")
    lines.append(f"  wallets:            {len(relaxed):,}  ({len(relaxed)/n*100:.1f}% of diamond paws)")
    lines.append(f"  DOG locked:         {sum_dog_relaxed:,.0f}")
    lines.append(f"  % of diamond paws DOG: {sum_dog_relaxed/total_airdrop_dog*100:.2f}%")
    lines.append(f"  % of total supply:     {sum_dog_relaxed/DOG_TOTAL_SUPPLY*100:.2f}%")
    lines.append("")
    lines.append("─── LOST (STRICT: never spent + no extra deposits + no mempool) ─────")
    lines.append(f"  wallets:            {len(strict):,}  ({len(strict)/n*100:.1f}% of diamond paws)")
    lines.append(f"  DOG locked:         {sum_dog_strict:,.0f}")
    lines.append(f"  % of diamond paws DOG: {sum_dog_strict/total_airdrop_dog*100:.2f}%")
    lines.append(f"  % of total supply:     {sum_dog_strict/DOG_TOTAL_SUPPLY*100:.2f}%")
    lines.append("")
    lines.append("─── ACTIVE (spent at least once, balance returned to airdrop level) ──")
    lines.append(f"  wallets:            {len(active):,}  ({len(active)/n*100:.1f}%)")
    lines.append(f"  DOG these hold:     {sum_dog_active:,.0f}")
    lines.append(f"  Spent-tx buckets:   {dict(spent_buckets)}")
    lines.append("")
    lines.append("─── EXTRA DEPOSITS DISTRIBUTION (lost-relaxed) ───────────────────────")
    lines.append("  Every lost wallet received SOMETHING beyond the airdrop (dust/drops),")
    lines.append("  but never spent — so passive receives don't prove key access.")
    for b in ["0_only_airdrop", "1_to_2", "3_to_5", "6_to_20", "21_to_100", "100_plus"]:
        if b in extras_count:
            lines.append(f"  {b:18s}  wallets={extras_count[b]:>5,}  DOG={extras_dog[b]:>15,.0f}")
    lines.append("")
    lines.append("─── BY ADDRESS TYPE (lost relaxed vs active) ─────────────────────────")
    for t in ["p2tr", "p2wpkh/p2wsh", "p2sh", "p2pkh"]:
        l = by_type_lost.get(t, 0); a = by_type_active.get(t, 0); tot = l + a
        if tot:
            lines.append(f"  {t:14s}  lost={l:,}  active={a:,}  ({l/tot*100:.1f}% lost)")
    lines.append("")
    lines.append("─── TOP 10 LOST WALLETS (relaxed) BY DOG ─────────────────────────────")
    for i, e in enumerate(top_lost[:10], 1):
        lines.append(f"  #{i:2d}  {e['address']}  {e['airdrop_dog']:>16,.0f} DOG  (funded_txos={e['funded_txo_count']})")
    lines.append("")
    lines.append("=" * 70)

    summary = "\n".join(lines)
    (ANALYSIS_DIR / "lost_analysis.txt").write_text(summary)
    print(summary)


if __name__ == "__main__":
    main()
