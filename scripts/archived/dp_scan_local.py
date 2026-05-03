#!/usr/bin/env python3
"""
Use local bitcoind scantxoutset to find UTXOs for lost-relaxed wallets.
Matches results by scriptPubKey (not desc, which scantxoutset normalizes).

Default: scan only addresses missing from last_tx.jsonl (skipping HTTP-400 actives).
--all: scan all 6,035 lost-relaxed addresses.

Output appends to data/diamond_paws_analysis/last_tx.jsonl with source="local_node".
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

CONF = "/home/bitmax/Projects/bitcoin-fullstack/bitcoin-node/bitcoin.conf"


def cli(args, timeout=600):
    res = subprocess.run(["bitcoin-cli", f"-conf={CONF}"] + args,
                         capture_output=True, text=True, timeout=timeout)
    if res.returncode != 0:
        raise RuntimeError(f"cli {args[:2]} failed: {res.stderr.strip()[:200]}")
    return res.stdout.strip()


def get_script_pubkey(addr: str) -> str:
    """Use bitcoin-cli validateaddress to derive scriptPubKey."""
    r = json.loads(cli(["validateaddress", addr]))
    if not r.get("isvalid"):
        raise ValueError(f"invalid address: {addr}")
    return r["scriptPubKey"]


def scan_chunk(addrs):
    scanobjects = json.dumps([{"desc": f"addr({a})"} for a in addrs])
    t0 = time.time()
    out = cli(["scantxoutset", "start", scanobjects])
    print(f"  scan ({len(addrs)} addrs): {time.time()-t0:.1f}s", flush=True)
    return json.loads(out)


def get_block_time(height, cache):
    if height in cache:
        return cache[height]
    h = cli(["getblockhash", str(height)])
    hdr = json.loads(cli(["getblockheader", h]))
    cache[height] = hdr["time"]
    return hdr["time"]


def load_done():
    done = set()
    if LAST_TX.exists():
        with LAST_TX.open() as fh:
            for line in fh:
                try:
                    rec = json.loads(line)
                    if rec.get("source") in (None, "blockstream", "local_node"):
                        done.add(rec["address"])
                except Exception:
                    pass
    return done


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
        # Need to identify what's already correctly resolved.
        # Previous bad runs wrote `local_node_no_utxos` for 214 addresses — those need redo.
        bad_local = set()
        if LAST_TX.exists():
            with LAST_TX.open() as fh:
                for line in fh:
                    try:
                        rec = json.loads(line)
                        if rec.get("source") == "local_node_no_utxos":
                            bad_local.add(rec["address"])
                    except Exception:
                        pass
        # Done = entries with valid last_block_height (from blockstream OR local_node with utxos)
        done = set()
        with LAST_TX.open() as fh:
            for line in fh:
                try:
                    rec = json.loads(line)
                    if rec.get("last_block_height") is not None and rec["address"] not in bad_local:
                        done.add(rec["address"])
                except Exception:
                    pass
        too_many = load_too_many()
        targets = [a for a in all_addrs if a not in done and a not in too_many]
        print(f"  done with valid data: {len(done)}")
        print(f"  bad local entries to redo: {len(bad_local)}")
    print(f"to scan: {len(targets)}")
    if not targets:
        return

    print("Resolving scriptPubKeys...", flush=True)
    t0 = time.time()
    spk_to_addr = {}
    for a in targets:
        try:
            spk = get_script_pubkey(a)
            spk_to_addr[spk] = a
        except Exception as e:
            print(f"  validateaddress failed for {a}: {e}", file=sys.stderr)
    print(f"  resolved {len(spk_to_addr)}/{len(targets)} in {time.time()-t0:.1f}s", flush=True)

    addr_to_heights = {a: [] for a in targets}
    for i in range(0, len(targets), args.chunk):
        chunk = targets[i:i + args.chunk]
        result = scan_chunk(chunk)
        if not result.get("success"):
            print(f"  scan failed for chunk {i}", file=sys.stderr)
            continue
        for u in result.get("unspents", []):
            spk = u.get("scriptPubKey")
            a = spk_to_addr.get(spk)
            if a:
                addr_to_heights[a].append(u["height"])

    # Resolve heights → times
    cache = {}
    n_with = 0
    n_empty = 0
    out_fh = LAST_TX.open("a")
    try:
        for addr, heights in addr_to_heights.items():
            if not heights:
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
                line = {
                    "address": addr,
                    "n_utxos": len(heights),
                    "first_block_height": first_h,
                    "first_block_time": get_block_time(first_h, cache),
                    "last_block_height": last_h,
                    "last_block_time": get_block_time(last_h, cache),
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
