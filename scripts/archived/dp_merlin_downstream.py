#!/usr/bin/env python3
"""
Identify lost-relaxed diamond paws that received DOG from Merlin custody wallets,
either directly (1 hop) or via N-hop genealogy.

Walks data/dog_transactions/block_*.json forward from Merlin source wallets,
expanding the set of "Merlin downstream" addresses BFS-style up to MAX_HOPS hops.

Output:
  data/diamond_paws_analysis/merlin_downstream_addresses.json
  data/diamond_paws_analysis/merlin_overlap_with_lost.txt

Usage: python3 dp_merlin_downstream.py [--max-hops N]
"""
import argparse
import csv
import json
import os
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DIR = DATA / "diamond_paws_analysis"

TX_DIR = DATA / "dog_transactions"
LOST_CSV = DIR / "lost_addresses_relaxed.csv"

MERLIN_SOURCES = {
    "bc1qcmj5lkumeycyn35lxc3yr32k3fzue87yrjrna6",
    "bc1q97ufxcw0l440m30us0g8vsqmdgqh5ysc7h4ezw2eugx4ne5hxvws7zv8yu",
}


def load_lost():
    out = {}
    with LOST_CSV.open() as fh:
        for r in csv.DictReader(fh):
            out[r["address"]] = float(r["airdrop_dog"])
    return out


def iterate_blocks():
    """Yield (block_height, txs) sorted by height."""
    files = sorted(os.listdir(TX_DIR))
    for f in files:
        if not f.endswith(".json"):
            continue
        with open(TX_DIR / f) as fh:
            d = json.load(fh)
        yield d.get("block_height"), d.get("transactions", [])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--max-hops", type=int, default=4)
    args = p.parse_args()

    lost = load_lost()
    print(f"lost-relaxed wallets: {len(lost)}")

    # BFS over hops. At each hop, find all txs where current_set is a sender,
    # add receivers (excluding senders to avoid loop) to next set.
    # We need to do multiple passes over the data because the dataset is per-block;
    # we batch hops.

    # Simpler: we read all blocks once, build a mapping: for each address that ever
    # appeared as a SENDER, the set of (receiver, amount, block, txid).
    # Then BFS through that mapping.

    print("Building sender → receiver index from dog_transactions...", flush=True)
    sender_to_receivers = defaultdict(lambda: defaultdict(int))  # sender -> receiver -> total_dog
    sender_to_first_block = defaultdict(lambda: defaultdict(lambda: 10**9))
    n_txs = 0
    for height, txs in iterate_blocks():
        for tx in txs:
            senders = [s for s in tx.get("senders", []) if s.get("has_dog") is not False and s.get("amount_dog", 0) > 0]
            receivers = [r for r in tx.get("receivers", [])
                         if r.get("has_dog") is not False and r.get("amount_dog", 0) > 0
                         and not r.get("is_change", False)]
            sender_addrs = {s["address"] for s in senders}
            for s in senders:
                for r in receivers:
                    if r["address"] in sender_addrs:
                        continue
                    sender_to_receivers[s["address"]][r["address"]] += r["amount_dog"]
                    if height < sender_to_first_block[s["address"]][r["address"]]:
                        sender_to_first_block[s["address"]][r["address"]] = height
            n_txs += 1
    print(f"  indexed {n_txs:,} txs, {len(sender_to_receivers):,} unique senders", flush=True)

    # BFS from MERLIN_SOURCES
    visited = set(MERLIN_SOURCES)
    by_hop = {0: set(MERLIN_SOURCES)}
    frontier = set(MERLIN_SOURCES)
    for hop in range(1, args.max_hops + 1):
        next_set = set()
        for s in frontier:
            for r in sender_to_receivers.get(s, {}):
                if r not in visited:
                    next_set.add(r)
        by_hop[hop] = next_set
        visited |= next_set
        frontier = next_set
        print(f"  hop {hop}: +{len(next_set):,}, total {len(visited):,}", flush=True)
        if not next_set:
            break

    # Identify lost wallets at each hop
    lost_set = set(lost.keys())
    overlap_by_hop = {}
    cumulative_overlap = set()
    for hop in sorted(by_hop):
        if hop == 0:
            continue
        hop_addrs = by_hop[hop]
        hop_overlap = hop_addrs & lost_set
        cumulative_overlap |= hop_overlap
        overlap_by_hop[hop] = {
            "new_addresses_at_hop": len(hop_addrs),
            "lost_overlap_new": len(hop_overlap),
            "lost_overlap_cumulative": len(cumulative_overlap),
            "dog_locked_in_overlap": sum(lost[a] for a in cumulative_overlap),
        }

    # Per-overlap detail
    detail = []
    for a in sorted(cumulative_overlap, key=lambda x: -lost[x]):
        # find first hop reached
        h = next((hop for hop, addrs in by_hop.items() if a in addrs and hop > 0), None)
        detail.append({"address": a, "airdrop_dog": lost[a], "merlin_hop": h})

    out_dir_addrs = DIR / "merlin_downstream_addresses.json"
    out_dir_addrs.write_text(json.dumps({
        "max_hops": args.max_hops,
        "merlin_sources": list(MERLIN_SOURCES),
        "addresses_per_hop": {str(h): len(by_hop.get(h, set())) for h in range(args.max_hops + 1)},
        "overlap_with_lost_relaxed": overlap_by_hop,
        "total_lost_in_overlap": len(cumulative_overlap),
        "total_dog_in_overlap": sum(lost[a] for a in cumulative_overlap),
        "details_top_50": detail[:50],
    }, indent=2))

    # Summary
    L = []
    L.append("=" * 78)
    L.append("MERLIN-CHAIN DOWNSTREAM × LOST DIAMOND PAWS")
    L.append("=" * 78)
    L.append(f"Merlin custody sources: {sorted(MERLIN_SOURCES)}")
    L.append(f"Trace depth: {args.max_hops} hops in dog_transactions index ({n_txs:,} txs)")
    L.append("")
    L.append("Per-hop discovery:")
    for h in sorted(by_hop):
        L.append(f"  hop {h}: {len(by_hop[h]):>8,} new addresses")
    L.append(f"  TOTAL traced (visited):      {len(visited):,}")
    L.append("")
    L.append("Lost-relaxed wallets reached at each hop (cumulative):")
    L.append(f"  {'hop':<5s} {'new_at_hop':>12s} {'lost_new':>10s} {'lost_cum':>10s} {'DOG_locked':>15s}")
    for hop, info in sorted(overlap_by_hop.items()):
        L.append(f"  {hop:<5d} {info['new_addresses_at_hop']:>12,} {info['lost_overlap_new']:>10,} {info['lost_overlap_cumulative']:>10,} {info['dog_locked_in_overlap']:>15,.0f}")
    L.append("")
    final = overlap_by_hop[max(overlap_by_hop)]
    L.append(f"Total lost wallets confirmed downstream of Merlin: {final['lost_overlap_cumulative']:,} / {len(lost):,}  ({final['lost_overlap_cumulative']/len(lost)*100:.1f}%)")
    L.append(f"DOG locked in those wallets:                       {final['dog_locked_in_overlap']:,.0f}")
    L.append(f"  (vs total lost-relaxed DOG = {sum(lost.values()):,.0f}; share = {final['dog_locked_in_overlap']/sum(lost.values())*100:.1f}%)")
    L.append("")
    L.append("Top 20 lost wallets reached from Merlin:")
    for d in detail[:20]:
        L.append(f"  hop={d['merlin_hop']}  {d['address']}  {d['airdrop_dog']:>16,.0f} DOG")
    L.append("")
    L.append("=" * 78)

    summary = "\n".join(L)
    (DIR / "merlin_overlap_with_lost.txt").write_text(summary)
    print(summary)


if __name__ == "__main__":
    main()
