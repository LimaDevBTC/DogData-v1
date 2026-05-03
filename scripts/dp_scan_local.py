#!/usr/bin/env python3
"""
Use local bitcoind scantxoutset to find UTXOs for the lost-relaxed wallets we
couldn't fetch via API. For lost-relaxed wallets (spent_txo_count == 0), ALL
their UTXOs are still in the current UTXO set, so scantxoutset gives us full
reception history.

Usage:
  dp_scan_local.py [--all]

Default: scan only addresses missing from last_tx.jsonl AND last_tx_errors.jsonl
         won't get from blockstream (HTTP 400 too-many means active anyway, skip those).
--all: scan all 6,035 lost-relaxed addresses (verify the full set).

Output: appends to data/diamond_paws_analysis/last_tx.jsonl with the same schema.
        Block-time is derived via getblockheader (~few-µs each, cached).
"""
import argparse
import csv
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "data" / "diamond_paws_analysis"
LOST_CSV = DIR / "lost_addresses_relaxed.csv"
LAST_TX = DIR / "last_tx.jsonl"
ERRORS = DIR / "last_tx_errors.jsonl"

BITCOIN_CLI = "bitcoin-cli"
CONF = "/home/bitmax/Projects/bitcoin-fullstack/bitcoin-node/bitcoin.conf"


def run_cli(args):
    cmd = [BITCOIN_CLI, f"-conf={CONF}"] + args
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if res.returncode != 0:
        raise RuntimeError(f"bitcoin-cli failed: {res.stderr}")
    return res.stdout.strip()


def scan_chunk(addrs):
    scanobjects = json.dumps([{"desc": f"addr({a})"} for a in addrs])
    t0 = time.time()
    out = run_cli(["scantxoutset", "start", scanobjects])
    print(f"  scan ({len(addrs)} addrs): {time.time()-t0:.1f}s", flush=True)
    return json.loads(out)


def get_block_time(height, cache):
    if height in cache:
        return cache[height]
    h = run_cli(["getblockhash", str(height)])
    hdr = json.loads(run_cli(["getblockheader", h]))
    cache[height] = hdr["time"]
    return hdr["time"]


def load_done():
    done = set()
    if LAST_TX.exists():
        with LAST_TX.open() as fh:
            for line in fh:
                try:
                    done.add(json.loads(line)["address"])
                except Exception:
                    pass
    return done


def load_too_many():
    """HTTP 400 = active wallet, no need to fetch."""
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--chunk", type=int, default=300)
    args = parser.parse_args()

    with LOST_CSV.open() as fh:
        all_addrs = [r["address"] for r in csv.DictReader(fh)]
    print(f"lost-relaxed total: {len(all_addrs)}")

    if args.all:
        targets = list(all_addrs)
    else:
        done = load_done()
        too_many = load_too_many()
        targets = [a for a in all_addrs if a not in done and a not in too_many]
    print(f"to scan: {len(targets)}")
    if not targets:
        return

    # Scan in chunks (UTXO set scan is single-pass per call regardless of N descriptors,
    # but we chunk to keep each call's command-line size reasonable)
    addr_to_heights = {a: [] for a in targets}
    for i in range(0, len(targets), args.chunk):
        chunk = targets[i:i + args.chunk]
        result = scan_chunk(chunk)
        if not result.get("success"):
            print(f"  scan failed for chunk {i}", file=sys.stderr)
            continue
        for u in result.get("unspents", []):
            # The desc looks like "addr(bc1...)#checksum"; extract the address.
            desc = u.get("desc", "")
            try:
                a = desc[desc.index("(") + 1 : desc.rindex(")")]
            except ValueError:
                continue
            if a in addr_to_heights:
                addr_to_heights[a].append(u["height"])

    # Resolve block heights → block times (cached)
    cache = {}
    n_with = 0
    n_empty = 0
    out_fh = LAST_TX.open("a")
    try:
        for addr, heights in addr_to_heights.items():
            if not heights:
                # No UTXOs found locally for this address. Possible reasons:
                # 1. Address has been COMPLETELY spent (but it's marked spent_txo_count==0 — shouldn't happen)
                # 2. Edge case: blockstream said "0 spent" but they were spent in mempool? unlikely
                # Record as empty.
                line = {
                    "address": addr,
                    "n_utxos": 0,
                    "first_block_height": None,
                    "first_block_time": None,
                    "last_block_height": None,
                    "last_block_time": None,
                    "source": "local_node_no_utxos",
                }
                n_empty += 1
            else:
                last_h = max(heights)
                first_h = min(heights)
                last_t = get_block_time(last_h, cache)
                first_t = get_block_time(first_h, cache)
                line = {
                    "address": addr,
                    "n_utxos": len(heights),
                    "first_block_height": first_h,
                    "first_block_time": first_t,
                    "last_block_height": last_h,
                    "last_block_time": last_t,
                    "source": "local_node",
                }
                n_with += 1
            out_fh.write(json.dumps(line) + "\n")
        out_fh.flush()
    finally:
        out_fh.close()

    print(f"resolved with utxos: {n_with}, empty: {n_empty}, blocks cached: {len(cache)}")


if __name__ == "__main__":
    main()
