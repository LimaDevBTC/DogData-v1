#!/usr/bin/env python3
"""
Fetch chain_stats for diamond-paws addresses from blockstream.info / mempool.space.
Writes one JSON line per address to data/diamond_paws_analysis/chain_stats.jsonl.
Resumable: skips addresses already present in the output.

v2: lower concurrency, real 429 handling with long backoff, endpoint rotation.
"""
import csv
import json
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock

import requests

ROOT = Path(__file__).resolve().parent.parent
ANALYSIS_DIR = ROOT / "data" / "diamond_paws_analysis"
INPUT_CSV = ANALYSIS_DIR / "diamond_paws.csv"
OUTPUT_JSONL = ANALYSIS_DIR / "chain_stats.jsonl"
ERRORS_JSONL = ANALYSIS_DIR / "chain_stats_errors.jsonl"

ENDPOINTS = [
    "https://blockstream.info/api",
    "https://mempool.space/api",
]

CONCURRENCY = 2
TIMEOUT = 25
BASE_SLEEP = 0.30  # per-thread between requests (so ~6/s aggregate baseline)
MAX_429_BACKOFF = 180

session = requests.Session()
session.headers.update({"User-Agent": "dogdata-research/1.0 (read-only address stats)"})

write_lock = Lock()
endpoint_state = {ep: {"banned_until": 0.0, "fails": 0} for ep in ENDPOINTS}
endpoint_lock = Lock()


def load_done():
    done = set()
    if OUTPUT_JSONL.exists():
        with OUTPUT_JSONL.open() as fh:
            for line in fh:
                try:
                    done.add(json.loads(line)["address"])
                except Exception:
                    pass
    if ERRORS_JSONL.exists():
        # we'll re-try previously-errored addresses (don't skip them)
        pass
    return done


def pick_endpoint():
    now = time.time()
    candidates = [ep for ep in ENDPOINTS if endpoint_state[ep]["banned_until"] <= now]
    if not candidates:
        # all banned — pick the one unbanned soonest
        return min(ENDPOINTS, key=lambda e: endpoint_state[e]["banned_until"])
    return random.choice(candidates)


def mark_banned(ep, seconds):
    with endpoint_lock:
        until = time.time() + seconds
        if until > endpoint_state[ep]["banned_until"]:
            endpoint_state[ep]["banned_until"] = until
            endpoint_state[ep]["fails"] += 1


def fetch(addr: str) -> dict:
    last_status = None
    last_err = None
    attempts = 0
    while attempts < 6:
        ep = pick_endpoint()
        wait = endpoint_state[ep]["banned_until"] - time.time()
        if wait > 0:
            time.sleep(min(wait, 30))
        url = f"{ep}/address/{addr}"
        try:
            r = session.get(url, timeout=TIMEOUT)
            last_status = r.status_code
            if r.status_code == 200:
                return {"address": addr, "ok": True, "data": r.json(), "endpoint": ep}
            if r.status_code == 429:
                # Respect Retry-After if present
                ra = r.headers.get("Retry-After")
                try:
                    backoff = int(ra) if ra else min(MAX_429_BACKOFF, 30 * (attempts + 1))
                except ValueError:
                    backoff = 30 * (attempts + 1)
                mark_banned(ep, backoff)
                attempts += 1
                continue
            if r.status_code in (502, 503, 504):
                time.sleep(2 ** attempts + random.random())
                attempts += 1
                continue
            # other status — treat as terminal but record
            return {"address": addr, "ok": False, "error": f"HTTP {r.status_code}", "endpoint": ep}
        except requests.RequestException as e:
            last_err = type(e).__name__ + ": " + str(e)[:120]
            time.sleep(2 ** attempts + random.random())
            attempts += 1
    return {"address": addr, "ok": False, "error": last_err or f"HTTP {last_status}"}


def write_ok(line: dict, fh):
    with write_lock:
        fh.write(json.dumps(line) + "\n")
        fh.flush()


def write_err(line: dict, fh):
    with write_lock:
        fh.write(json.dumps(line) + "\n")
        fh.flush()


def main():
    done = load_done()
    print(f"already done: {len(done)}", flush=True)

    with INPUT_CSV.open() as fh:
        reader = csv.DictReader(fh)
        rows = [r for r in reader if r["address"] not in done]

    print(f"to fetch: {len(rows)}", flush=True)
    if not rows:
        return

    out_fh = OUTPUT_JSONL.open("a")
    err_fh = ERRORS_JSONL.open("a")
    start = time.time()
    n_done = 0
    n_err = 0

    def worker(addr):
        # per-thread baseline pacing (jitter)
        time.sleep(BASE_SLEEP + random.random() * 0.2)
        return fetch(addr)

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futs = {ex.submit(worker, r["address"]): r["address"] for r in rows}
        for fut in as_completed(futs):
            res = fut.result()
            n_done += 1
            if res["ok"]:
                cs = res["data"].get("chain_stats", {}) or {}
                ms = res["data"].get("mempool_stats", {}) or {}
                line = {
                    "address": res["address"],
                    "chain_tx_count": cs.get("tx_count", 0),
                    "chain_funded_txo_count": cs.get("funded_txo_count", 0),
                    "chain_spent_txo_count": cs.get("spent_txo_count", 0),
                    "chain_funded_sum": cs.get("funded_txo_sum", 0),
                    "chain_spent_sum": cs.get("spent_txo_sum", 0),
                    "mempool_tx_count": ms.get("tx_count", 0),
                    "endpoint": res.get("endpoint", ""),
                }
                write_ok(line, out_fh)
            else:
                n_err += 1
                write_err(res, err_fh)

            if n_done % 100 == 0:
                elapsed = time.time() - start
                rate = n_done / max(1, elapsed)
                eta = (len(rows) - n_done) / max(0.1, rate) / 60
                ban_status = " | ".join(
                    f"{ep.split('//')[1].split('/')[0]}:{max(0, int(s['banned_until']-time.time()))}s"
                    for ep, s in endpoint_state.items()
                )
                print(
                    f"  {n_done}/{len(rows)} ({n_err} err) | {rate:.2f}/s | eta {eta:.1f} min | bans: {ban_status}",
                    flush=True,
                )

    out_fh.close()
    err_fh.close()
    elapsed = time.time() - start
    print(f"done: {n_done} ({n_err} err) in {elapsed/60:.1f} min", flush=True)


if __name__ == "__main__":
    main()
