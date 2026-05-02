#!/usr/bin/env python3
"""
Persistência da classificação em Supabase.

Lê a saída de tx_classifier.classify_block(block) e:
  1. faz upsert em tx_class_block (uma linha por (height, class))
  2. chama refresh_tx_class_daily(day) pra recompor o rollup do dia

Uso:
    python3 tx_class_writer.py --block 947500
    python3 tx_class_writer.py --range 947500 947505
    python3 tx_class_writer.py --block 947500 --dry-run
"""

import argparse
import json
import logging
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

# .env loader (mesmo padrão do dog_block_scanner)
try:
    from dotenv import load_dotenv
    root = Path(__file__).parent.parent
    if (root / ".env").exists():
        load_dotenv(root / ".env")
    if (root / ".env.local").exists():
        load_dotenv(root / ".env.local", override=True)
except ImportError:
    pass

sys.path.insert(0, str(Path(__file__).parent))
from tx_classifier import classify_block, get_block

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "") or os.environ.get("SUPABASE_ANON_KEY", "")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s",
                    datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger("tx-class-writer")


def _supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }


def agg_to_rows(agg: dict) -> list[dict]:
    """
    Converte agregado do classifier em linhas para tx_class_block.
    Uma linha por classe presente no bloco.
    """
    block_time = datetime.fromtimestamp(agg["time"], tz=timezone.utc).isoformat()
    height = agg["height"]
    block_hash = agg["hash"]
    tx_count_total = agg["tx_count"]

    # Para cada classe, agrupa subclass_counts olhando rows
    sub_by_class: dict[str, Counter] = {}
    for row in agg["rows"]:
        if row["subclass"]:
            sub_by_class.setdefault(row["class"], Counter())[row["subclass"]] += 1

    rows = []
    for cls, count in agg["by_class"].items():
        rows.append({
            "height": height,
            "class": cls,
            "count": count,
            "subclass_counts": dict(sub_by_class.get(cls, {})),
            "block_hash": block_hash,
            "block_time": block_time,
            "tx_count_total": tx_count_total,
        })
    return rows


def upsert_block(rows: list[dict], dry_run: bool = False) -> bool:
    if dry_run:
        log.info(f"[dry-run] would upsert {len(rows)} rows: {[r['class'] for r in rows]}")
        return True
    if not (SUPABASE_URL and SUPABASE_KEY):
        log.error("SUPABASE_URL / SUPABASE_KEY não configurados")
        return False
    import requests
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/tx_class_block?on_conflict=height,class",
        headers=_supabase_headers(),
        json=rows,
        timeout=30,
    )
    if resp.status_code in (200, 201, 204):
        log.info(f"upserted {len(rows)} rows for height {rows[0]['height']}")
        return True
    log.error(f"upsert failed: {resp.status_code} {resp.text[:300]}")
    return False


def refresh_daily(day_iso: str, dry_run: bool = False) -> bool:
    if dry_run:
        log.info(f"[dry-run] would call refresh_tx_class_daily('{day_iso}')")
        return True
    if not (SUPABASE_URL and SUPABASE_KEY):
        return False
    import requests
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/refresh_tx_class_daily",
        headers=_supabase_headers(),
        json={"p_day": day_iso},
        timeout=30,
    )
    if resp.status_code in (200, 204):
        log.info(f"refreshed tx_class_daily for {day_iso}")
        return True
    log.error(f"refresh failed: {resp.status_code} {resp.text[:300]}")
    return False


def write_height(height: int, dry_run: bool = False) -> bool:
    blk = get_block(height)
    agg = classify_block(blk)
    rows = agg_to_rows(agg)
    if not upsert_block(rows, dry_run=dry_run):
        return False
    day = datetime.fromtimestamp(blk["time"], tz=timezone.utc).date().isoformat()
    return refresh_daily(day, dry_run=dry_run)


def main():
    p = argparse.ArgumentParser()
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--block", type=int)
    g.add_argument("--range", nargs=2, type=int, metavar=("START", "END"))
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    heights = [args.block] if args.block else range(args.range[0], args.range[1] + 1)
    days_touched = set()
    for h in heights:
        try:
            blk = get_block(h)
            agg = classify_block(blk)
            rows = agg_to_rows(agg)
            ok = upsert_block(rows, dry_run=args.dry_run)
            if ok:
                day = datetime.fromtimestamp(blk["time"], tz=timezone.utc).date().isoformat()
                days_touched.add(day)
            log.info(f"  block {h}: {dict(agg['by_class'])}")
        except Exception as e:
            log.error(f"block {h} failed: {e}")
    # rollup uma vez por dia tocado
    for d in days_touched:
        refresh_daily(d, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
