#!/usr/bin/env python3
"""
update_diamond_paws_lost.py — Auto-incremental "Possible Lost DOG" pipeline.

Runs as a step of automated_update.py (hourly cron). Updates lost_analysis.json
which feeds the /api/airdrop/lost endpoint and the airdrop-page card.

Steady-state behavior (post-bootstrap):
  1. Read current diamond_paws set from forensic_behavioral_analysis.json
  2. Detect wallets that LEFT the lost set since last run via local bitcoind
     scantxoutset (no API). For each currently-lost wallet, compare current UTXO
     count vs the funded_txo_count we have on file — if it dropped, they spent
     something → they're no longer lost.
  3. Fetch chain_stats for any new diamond_paws addresses (small set, via API).
  4. Regenerate lost_analysis.json + lost_analysis.txt + lost_addresses_relaxed.csv.

First-run guard: if chain_stats.jsonl is missing, print bootstrap instructions
and exit non-fatally. (The repo ships with the file already populated.)

Non-fatal: any failure during the local scan or API fetch logs a warning and
continues with the freshest data we have — the cron should never fail because
of this step.
"""

import csv
import json
import subprocess
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests

# ─── Paths ────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
DP_DIR = DATA_DIR / "diamond_paws_analysis"

FORENSIC_FILE = DATA_DIR / "forensic_behavioral_analysis.json"
CHAIN_STATS = DP_DIR / "chain_stats.jsonl"
SPK_CACHE = DP_DIR / "address_to_scriptpubkey.json"
RUN_LOG = DP_DIR / "update_run.json"

LOST_ANALYSIS = DP_DIR / "lost_analysis.json"
LOST_TXT = DP_DIR / "lost_analysis.txt"
LOST_RELAXED_CSV = DP_DIR / "lost_addresses_relaxed.csv"
DIAMOND_PAWS_CSV = DP_DIR / "diamond_paws.csv"

# ─── Constants ────────────────────────────────────────────────────────────
BITCOIN_CONF = "/home/bitmax/Projects/bitcoin-fullstack/bitcoin-node/bitcoin.conf"
DOG_TOTAL_SUPPLY = 100_000_000_000
SCAN_CHUNK = 1000  # addresses per scantxoutset call (tested up to 300; 1000 OK with newer bitcoind)
API_TIMEOUT = 25
API_BASE = "https://blockstream.info/api"  # used only for new addresses

# ─── Logging ──────────────────────────────────────────────────────────────


def log(msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def warn(msg: str) -> None:
    log(f"⚠️  {msg}")


# ─── Helpers ──────────────────────────────────────────────────────────────


def cli(args, timeout=600) -> str:
    res = subprocess.run(
        ["bitcoin-cli", f"-conf={BITCOIN_CONF}"] + args,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if res.returncode != 0:
        raise RuntimeError(f"bitcoin-cli {args[:2]} failed: {res.stderr.strip()[:200]}")
    return res.stdout.strip()


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


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Loaders ──────────────────────────────────────────────────────────────


def read_diamond_paws() -> dict:
    """Returns {address: {airdrop_dog, receive_count, first_receive_block, first_receive_time}}."""
    with FORENSIC_FILE.open() as fh:
        d = json.load(fh)
    out = {}
    for p in d.get("all_profiles", []):
        if p.get("behavior_pattern") != "diamond_paws":
            continue
        out[p["address"]] = {
            "airdrop_dog": float(p["airdrop_amount"]),
            "receive_count": int(p.get("receive_count", 0)),
            "first_receive_block": p.get("first_receive_block"),
            "first_receive_time": p.get("first_receive_time", ""),
        }
    return out


def load_chain_stats() -> dict:
    """Returns {address: {chain_funded_txo_count, chain_spent_txo_count, ...}}."""
    out = {}
    if not CHAIN_STATS.exists():
        return out
    with CHAIN_STATS.open() as fh:
        for line in fh:
            try:
                d = json.loads(line)
                out[d["address"]] = d
            except Exception:
                pass
    return out


def save_chain_stats(records: dict) -> None:
    """Atomically rewrite chain_stats.jsonl from the in-memory dict."""
    tmp = CHAIN_STATS.with_suffix(".jsonl.tmp")
    with tmp.open("w") as fh:
        for addr in sorted(records):
            fh.write(json.dumps(records[addr]) + "\n")
    tmp.replace(CHAIN_STATS)


def load_spk_cache() -> dict:
    if not SPK_CACHE.exists():
        return {}
    with SPK_CACHE.open() as fh:
        return json.load(fh)


def save_spk_cache(cache: dict) -> None:
    tmp = SPK_CACHE.with_suffix(".json.tmp")
    with tmp.open("w") as fh:
        json.dump(cache, fh)
    tmp.replace(SPK_CACHE)


# ─── scriptPubKey resolution (one-time per address, then cached) ──────────


def ensure_spk_for(addresses: list[str], cache: dict) -> dict:
    """Resolve scriptPubKey for any address not yet in cache. Returns updated cache."""
    missing = [a for a in addresses if a not in cache]
    if not missing:
        return cache
    log(f"resolving scriptPubKey for {len(missing)} new address(es)…")
    for a in missing:
        try:
            r = json.loads(cli(["validateaddress", a]))
            if r.get("isvalid"):
                cache[a] = r["scriptPubKey"]
        except Exception as e:
            warn(f"validateaddress {a[:30]}…: {e}")
    save_spk_cache(cache)
    return cache


# ─── Local node verification ──────────────────────────────────────────────


def verify_lost_via_local_node(lost_addrs: list[str], chain_stats: dict, spk_cache: dict) -> tuple[int, int]:
    """
    For each currently-lost wallet, compare current scantxoutset UTXO count vs the
    funded_txo_count we recorded. If current < funded, they spent something →
    update chain_spent_txo_count and they leave the lost set.

    Returns (n_checked, n_newly_active).
    """
    spk_to_addr = {spk_cache[a]: a for a in lost_addrs if a in spk_cache}
    addr_to_utxo_count: dict[str, int] = {a: 0 for a in lost_addrs if a in spk_cache}

    for i in range(0, len(lost_addrs), SCAN_CHUNK):
        batch = [a for a in lost_addrs[i : i + SCAN_CHUNK] if a in spk_cache]
        if not batch:
            continue
        scanobjects = json.dumps([{"desc": f"addr({a})"} for a in batch])
        t0 = time.time()
        try:
            out = cli(["scantxoutset", "start", scanobjects])
        except Exception as e:
            warn(f"scantxoutset chunk {i}-{i+SCAN_CHUNK}: {e}")
            continue
        log(f"  scan ({len(batch)} addrs): {time.time()-t0:.1f}s")
        try:
            result = json.loads(out)
        except Exception as e:
            warn(f"scantxoutset parse error: {e}")
            continue
        if not result.get("success"):
            warn(f"scantxoutset chunk {i} returned success=false")
            continue
        for u in result.get("unspents", []):
            spk = u.get("scriptPubKey")
            a = spk_to_addr.get(spk)
            if a:
                addr_to_utxo_count[a] = addr_to_utxo_count.get(a, 0) + 1

    newly_active = 0
    for a in lost_addrs:
        if a not in chain_stats or a not in spk_cache:
            continue
        funded = chain_stats[a].get("chain_funded_txo_count", 0)
        if funded <= 0:
            continue
        current = addr_to_utxo_count.get(a, 0)
        if current < funded:
            spent_now = funded - current
            chain_stats[a]["chain_spent_txo_count"] = spent_now
            chain_stats[a]["spent_detected_at"] = now_iso()
            newly_active += 1
    return len(lost_addrs), newly_active


# ─── Incremental API fetch (only for diamond paws not yet in chain_stats) ──


def fetch_chain_stats_via_api(addresses: list[str]) -> dict:
    """Best-effort fetch from blockstream. Sequential, polite (~1 req/s)."""
    out = {}
    if not addresses:
        return out
    log(f"fetching chain_stats for {len(addresses)} new diamond paw(s) via API…")
    sess = requests.Session()
    sess.headers.update({"User-Agent": "dogdata-research/1.0"})
    for a in addresses:
        url = f"{API_BASE}/address/{a}"
        try:
            r = sess.get(url, timeout=API_TIMEOUT)
            if r.status_code == 200:
                d = r.json()
                cs = d.get("chain_stats", {}) or {}
                ms = d.get("mempool_stats", {}) or {}
                out[a] = {
                    "address": a,
                    "chain_tx_count": cs.get("tx_count", 0),
                    "chain_funded_txo_count": cs.get("funded_txo_count", 0),
                    "chain_spent_txo_count": cs.get("spent_txo_count", 0),
                    "chain_funded_sum": cs.get("funded_txo_sum", 0),
                    "chain_spent_sum": cs.get("spent_txo_sum", 0),
                    "mempool_tx_count": ms.get("tx_count", 0),
                    "endpoint": "blockstream.info",
                    "fetched_at": now_iso(),
                }
            elif r.status_code == 429:
                warn("blockstream rate-limited; backing off this address (will retry next run)")
                time.sleep(2)
            else:
                warn(f"  HTTP {r.status_code} for {a[:30]}…")
        except Exception as e:
            warn(f"  fetch {a[:30]}…: {type(e).__name__}: {str(e)[:80]}")
        time.sleep(1.0)
    return out


# ─── Analysis (writes lost_analysis.json + .txt + CSVs) ───────────────────


def regenerate_outputs(diamond_paws: dict, chain_stats: dict) -> dict:
    enriched = []
    for addr, info in diamond_paws.items():
        c = chain_stats.get(addr)
        if not c:
            continue
        enriched.append({
            "address": addr,
            "airdrop_dog": info["airdrop_dog"],
            "receive_count": info["receive_count"],
            "addr_type": addr_type(addr),
            "tx_count": c.get("chain_tx_count", 0),
            "funded_txo_count": c.get("chain_funded_txo_count", 0),
            "spent_txo_count": c.get("chain_spent_txo_count", 0),
            "mempool_tx_count": c.get("mempool_tx_count", 0),
            "chain_funded_sum": c.get("chain_funded_sum", 0),
        })

    n = len(enriched)
    total_airdrop_dog = sum(e["airdrop_dog"] for e in enriched)
    relaxed = [e for e in enriched if e["spent_txo_count"] == 0]
    strict = [
        e for e in relaxed
        if (e["funded_txo_count"] - e["receive_count"]) <= 2 and e["mempool_tx_count"] == 0
    ]
    active = [e for e in enriched if e["spent_txo_count"] > 0]

    sum_dog_relaxed = sum(e["airdrop_dog"] for e in relaxed)
    sum_dog_strict = sum(e["airdrop_dog"] for e in strict)
    sum_dog_active = sum(e["airdrop_dog"] for e in active)

    spent_buckets = Counter()
    for e in active:
        s = e["spent_txo_count"]
        if s == 1: spent_buckets["1"] += 1
        elif s <= 5: spent_buckets["2-5"] += 1
        elif s <= 20: spent_buckets["6-20"] += 1
        elif s <= 100: spent_buckets["21-100"] += 1
        else: spent_buckets["100+"] += 1

    extras_count = Counter()
    extras_dog = Counter()
    for e in relaxed:
        diff = e["funded_txo_count"] - e["receive_count"]
        if diff == 0: b = "0_only_airdrop"
        elif diff <= 2: b = "1_to_2"
        elif diff <= 5: b = "3_to_5"
        elif diff <= 20: b = "6_to_20"
        elif diff <= 100: b = "21_to_100"
        else: b = "100_plus"
        extras_count[b] += 1
        extras_dog[b] += e["airdrop_dog"]

    by_type_lost = Counter(); by_type_active = Counter()
    for e in relaxed: by_type_lost[e["addr_type"]] += 1
    for e in active: by_type_active[e["addr_type"]] += 1

    funded_extra = [e for e in relaxed if e["funded_txo_count"] > e["receive_count"]]

    top_lost = sorted(relaxed, key=lambda x: -x["airdrop_dog"])[:20]
    top_strict = sorted(strict, key=lambda x: -x["airdrop_dog"])[:20]

    report = {
        "generated_at": now_iso(),
        "data_source": {
            "forensic_behavioral_analysis": str(FORENSIC_FILE.relative_to(BASE_DIR)),
            "chain_stats_jsonl": str(CHAIN_STATS.relative_to(BASE_DIR)),
            "verification": "Local bitcoind scantxoutset detects newly-active wallets each run; new diamond paw addresses pulled via blockstream.info.",
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
            "diamond_paws_missing_stats": len(set(diamond_paws) - set(chain_stats)),
            "total_airdrop_dog": total_airdrop_dog,
            "pct_of_supply": total_airdrop_dog / DOG_TOTAL_SUPPLY * 100,
        },
        "lost_relaxed": {
            "count": len(relaxed),
            "pct_of_diamond_paws": len(relaxed) / n * 100 if n else 0,
            "dog_locked": sum_dog_relaxed,
            "pct_of_diamond_paws_dog": sum_dog_relaxed / total_airdrop_dog * 100 if total_airdrop_dog else 0,
            "pct_of_supply": sum_dog_relaxed / DOG_TOTAL_SUPPLY * 100,
        },
        "lost_strict": {
            "count": len(strict),
            "pct_of_diamond_paws": len(strict) / n * 100 if n else 0,
            "dog_locked": sum_dog_strict,
            "pct_of_diamond_paws_dog": sum_dog_strict / total_airdrop_dog * 100 if total_airdrop_dog else 0,
            "pct_of_supply": sum_dog_strict / DOG_TOTAL_SUPPLY * 100,
        },
        "active_after_airdrop": {
            "count": len(active),
            "pct_of_diamond_paws": len(active) / n * 100 if n else 0,
            "dog_held": sum_dog_active,
            "spent_txo_buckets": dict(spent_buckets),
            "note": "These wallets sent something (BTC, other runes…) but their DOG balance equals the airdrop amount — they're alive HODLers, not lost.",
        },
        "funded_after_airdrop_but_unspent": {
            "count": len(funded_extra),
            "dog_in_these_wallets": sum(e["airdrop_dog"] for e in funded_extra),
            "interpretation": "Received passive deposits (dust attacks, later airdrops, etc.) but never spent. Still 'lost relaxed' — incoming proves nothing about key control.",
            "extra_deposits_distribution": {
                b: {"wallets": extras_count[b], "dog": extras_dog[b]}
                for b in ["0_only_airdrop", "1_to_2", "3_to_5", "6_to_20", "21_to_100", "100_plus"]
                if b in extras_count
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
            {"address": e["address"], "dog": e["airdrop_dog"]} for e in top_strict
        ],
    }

    LOST_ANALYSIS.write_text(json.dumps(report, indent=2, default=str))

    # CSVs
    with DIAMOND_PAWS_CSV.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["address", "airdrop_amount_dog", "first_receive_block", "first_receive_time", "receive_count"])
        for addr, info in sorted(diamond_paws.items(), key=lambda x: -x[1]["airdrop_dog"]):
            w.writerow([addr, info["airdrop_dog"], info.get("first_receive_block", ""), info.get("first_receive_time", ""), info.get("receive_count", "")])
    with LOST_RELAXED_CSV.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["address", "airdrop_dog", "addr_type", "funded_txo_count", "receive_count"])
        for e in sorted(relaxed, key=lambda x: -x["airdrop_dog"]):
            w.writerow([e["address"], e["airdrop_dog"], e["addr_type"], e["funded_txo_count"], e["receive_count"]])

    # Plain-text summary
    L = []
    L.append("=" * 70)
    L.append("DIAMOND PAWS — POSSIBLE LOST DOG (auto-generated)")
    L.append("=" * 70)
    L.append(f"Generated: {report['generated_at']}")
    L.append(f"Diamond paws: {n:,}  (missing chain_stats: {report['totals']['diamond_paws_missing_stats']})")
    L.append(f"Total DOG held: {total_airdrop_dog:,.0f} ({report['totals']['pct_of_supply']:.2f}% of 100B supply)")
    L.append("")
    L.append("LOST RELAXED  (never spent any UTXO):")
    L.append(f"  wallets: {len(relaxed):,}  ({report['lost_relaxed']['pct_of_diamond_paws']:.1f}% of diamond paws)")
    L.append(f"  DOG locked: {sum_dog_relaxed:,.0f}  ({report['lost_relaxed']['pct_of_supply']:.2f}% of supply)")
    L.append("")
    L.append("ACTIVE (HODL but spent BTC/other runes):")
    L.append(f"  wallets: {len(active):,}  ({report['active_after_airdrop']['pct_of_diamond_paws']:.1f}%)")
    L.append("")
    LOST_TXT.write_text("\n".join(L))

    return report


# ─── Run-log ──────────────────────────────────────────────────────────────


def write_run_log(stats: dict) -> None:
    RUN_LOG.write_text(json.dumps(stats, indent=2, default=str))


# ─── Main ─────────────────────────────────────────────────────────────────


def main() -> int:
    log("=" * 60)
    log("update_diamond_paws_lost — START")
    log("=" * 60)

    if not FORENSIC_FILE.exists():
        log(f"❌ forensic file missing: {FORENSIC_FILE}")
        return 1

    diamond_paws = read_diamond_paws()
    log(f"diamond_paws set (current): {len(diamond_paws):,}")

    chain_stats = load_chain_stats()
    log(f"chain_stats records on file: {len(chain_stats):,}")

    if not chain_stats:
        log("❌ chain_stats.jsonl is empty or missing.")
        log("   Bootstrap with: python3 scripts/dp_fetch_chain_stats.py  (one-time)")
        log("   (skipping this run; will retry next hour)")
        return 0

    # Stale records — diamond paws no longer in current set (they moved DOG)
    stale = set(chain_stats) - set(diamond_paws)
    if stale:
        log(f"removing {len(stale)} stale record(s) (no longer diamond_paws)")
        for a in stale:
            chain_stats.pop(a, None)

    # New addresses — diamond paws not yet in chain_stats
    new_addrs = sorted(set(diamond_paws) - set(chain_stats))
    if new_addrs:
        try:
            new_stats = fetch_chain_stats_via_api(new_addrs)
            chain_stats.update(new_stats)
        except Exception as e:
            warn(f"API fetch for new addresses failed (non-fatal): {e}")

    # Verify currently-lost via local node
    spk_cache = load_spk_cache()
    lost_addrs = sorted(
        a for a, c in chain_stats.items()
        if c.get("chain_spent_txo_count", 0) == 0 and a in diamond_paws
    )
    log(f"currently-lost set: {len(lost_addrs):,}")

    n_checked = 0
    n_newly_active = 0
    if lost_addrs:
        try:
            spk_cache = ensure_spk_for(lost_addrs, spk_cache)
            n_checked, n_newly_active = verify_lost_via_local_node(lost_addrs, chain_stats, spk_cache)
            log(f"local-node verification: {n_checked:,} checked, {n_newly_active} newly active (left lost set)")
        except Exception as e:
            warn(f"local-node verification failed (non-fatal): {e}")

    save_chain_stats(chain_stats)

    # Regenerate outputs
    report = regenerate_outputs(diamond_paws, chain_stats)
    log(f"OK lost_relaxed = {report['lost_relaxed']['count']:,} wallets, "
        f"{report['lost_relaxed']['dog_locked']:,.0f} DOG "
        f"({report['lost_relaxed']['pct_of_supply']:.2f}% of supply)")

    write_run_log({
        "ran_at": now_iso(),
        "diamond_paws": len(diamond_paws),
        "chain_stats_records": len(chain_stats),
        "stale_removed": len(stale),
        "new_addresses_fetched": len(new_addrs),
        "lost_checked": n_checked,
        "lost_newly_active": n_newly_active,
        "lost_relaxed_count": report["lost_relaxed"]["count"],
        "lost_relaxed_dog": report["lost_relaxed"]["dog_locked"],
    })

    log("update_diamond_paws_lost — DONE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
