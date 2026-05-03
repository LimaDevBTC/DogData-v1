#!/usr/bin/env python3
"""
For lost-relaxed diamond paws (spent_txo_count == 0), fetch the date of their
most recent on-chain tx using Esplora /address/{addr}/txs.

The endpoint can return huge JSON (10-20MB for taproot addrs with many inscriptions).
We only need the FIRST tx's status, so we stream the response and stop reading once
we've matched the first "block_height":N,"block_time":N pair (the first tx is always
the most recent on this endpoint).

Output: data/diamond_paws_analysis/last_tx.jsonl
  {"address": ..., "last_block_height": N, "last_block_time": N}
or {"address": ..., "ok": false, "error": ...}

Resumable.
"""
import csv
import json
import random
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock

import requests

ROOT = Path(__file__).resolve().parent.parent
ANALYSIS_DIR = ROOT / "data" / "diamond_paws_analysis"
INPUT_CSV = ANALYSIS_DIR / "lost_addresses_relaxed.csv"
OUTPUT_JSONL = ANALYSIS_DIR / "last_tx.jsonl"
ERRORS_JSONL = ANALYSIS_DIR / "last_tx_errors.jsonl"

ENDPOINTS = ["https://blockstream.info/api", "https://mempool.space/api"]
CONCURRENCY = 2
TIMEOUT = 45
BASE_SLEEP = 0.30
MAX_BYTES = 256 * 1024  # 256KB max read per address — first tx always in first ~5KB
MAX_429_BACKOFF = 180

# Two regexes, field-order agnostic. First match = first tx (Esplora orders most-recent first).
# block_height / block_time only appear inside the status object in Esplora responses.
HEIGHT_RE = re.compile(rb'"block_height":(\d+)')
TIME_RE = re.compile(rb'"block_time":(\d+)')

session = requests.Session()
session.headers.update({"User-Agent": "dogdata-research/1.0"})
endpoint_state = {ep: {"banned_until": 0.0} for ep in ENDPOINTS}
ep_lock = Lock()
write_lock = Lock()


def load_done():
    done = set()
    if OUTPUT_JSONL.exists():
        with OUTPUT_JSONL.open() as fh:
            for line in fh:
                try:
                    done.add(json.loads(line)["address"])
                except Exception:
                    pass
    return done


def pick_endpoint():
    now = time.time()
    avail = [ep for ep in ENDPOINTS if endpoint_state[ep]["banned_until"] <= now]
    if not avail:
        return min(ENDPOINTS, key=lambda e: endpoint_state[e]["banned_until"])
    return random.choice(avail)


def mark_banned(ep, seconds):
    with ep_lock:
        until = time.time() + seconds
        if until > endpoint_state[ep]["banned_until"]:
            endpoint_state[ep]["banned_until"] = until


def fetch(addr: str) -> dict:
    last_status = None
    last_err = None
    attempts = 0
    while attempts < 5:
        ep = pick_endpoint()
        wait = endpoint_state[ep]["banned_until"] - time.time()
        if wait > 0:
            time.sleep(min(wait, 30))
        url = f"{ep}/address/{addr}/txs"
        try:
            with session.get(url, timeout=TIMEOUT, stream=True) as r:
                last_status = r.status_code
                if r.status_code == 429:
                    ra = r.headers.get("Retry-After")
                    backoff = int(ra) if (ra and ra.isdigit()) else min(MAX_429_BACKOFF, 30 * (attempts + 1))
                    mark_banned(ep, backoff)
                    attempts += 1
                    continue
                if r.status_code in (502, 503, 504):
                    time.sleep(2 ** attempts + random.random())
                    attempts += 1
                    continue
                if r.status_code != 200:
                    return {"address": addr, "ok": False, "error": f"HTTP {r.status_code}", "endpoint": ep}

                # Stream + match
                buf = bytearray()
                for chunk in r.iter_content(chunk_size=8192):
                    if not chunk:
                        continue
                    buf.extend(chunk)
                    h = HEIGHT_RE.search(buf)
                    t = TIME_RE.search(buf)
                    if h and t:
                        return {
                            "address": addr,
                            "ok": True,
                            "last_block_height": int(h.group(1)),
                            "last_block_time": int(t.group(1)),
                            "endpoint": ep,
                        }
                    if len(buf) >= MAX_BYTES:
                        break
                # Couldn't match — check if empty or unconfirmed-only
                text = bytes(buf).decode("utf-8", errors="replace")
                if text.strip().startswith("[]"):
                    return {"address": addr, "ok": True, "last_block_height": None, "last_block_time": None, "endpoint": ep}
                # Some addrs may have only unconfirmed txs ("confirmed":false, no block_*)
                if b'"confirmed":false' in buf and not HEIGHT_RE.search(buf):
                    return {"address": addr, "ok": True, "last_block_height": None, "last_block_time": None, "note": "unconfirmed_only", "endpoint": ep}
                return {"address": addr, "ok": False, "error": f"no status match in {len(buf)}B", "endpoint": ep}
        except requests.RequestException as e:
            last_err = type(e).__name__ + ": " + str(e)[:120]
            time.sleep(2 ** attempts + random.random())
            attempts += 1
    return {"address": addr, "ok": False, "error": last_err or f"HTTP {last_status}"}


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
        time.sleep(BASE_SLEEP + random.random() * 0.2)
        return fetch(addr)

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futs = {ex.submit(worker, r["address"]): r["address"] for r in rows}
        for fut in as_completed(futs):
            res = fut.result()
            n_done += 1
            with write_lock:
                if res["ok"]:
                    line = {"address": res["address"], "last_block_height": res["last_block_height"], "last_block_time": res["last_block_time"]}
                    out_fh.write(json.dumps(line) + "\n")
                    out_fh.flush()
                else:
                    n_err += 1
                    err_fh.write(json.dumps(res) + "\n")
                    err_fh.flush()
            if n_done % 100 == 0:
                elapsed = time.time() - start
                rate = n_done / max(1, elapsed)
                eta = (len(rows) - n_done) / max(0.1, rate) / 60
                bans = " | ".join(
                    f"{ep.split('//')[1].split('/')[0]}:{max(0, int(s['banned_until']-time.time()))}s"
                    for ep, s in endpoint_state.items()
                )
                print(f"  {n_done}/{len(rows)} ({n_err} err) | {rate:.2f}/s | eta {eta:.1f}m | {bans}", flush=True)

    out_fh.close()
    err_fh.close()
    print(f"done: {n_done} ({n_err} err) in {(time.time()-start)/60:.1f} min", flush=True)


if __name__ == "__main__":
    main()
