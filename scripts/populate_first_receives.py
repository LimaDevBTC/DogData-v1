#!/usr/bin/env python3
"""
Populate `first_receive_block` and `first_receive_time` in airdrop_recipients.json.

Reads every data/dog_transactions/block_*.json (35k+ files, blocks 840,654 →
latest), builds a map of `address → (earliest_block, earliest_timestamp)`,
and rewrites data/airdrop_recipients.json with the populated fields.

This unblocks API issue #8 — the audit found all 75,497 OG profiles had
`first_receive_block: 0` and `first_receive_time: ""`.

After running, re-execute scripts/update_forensic_analysis.py to propagate
the populated values into forensic_behavioral_analysis.json.

Usage:
    python3 scripts/populate_first_receives.py
    python3 scripts/populate_first_receives.py --dry-run   # report only
"""
import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Tuple

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
TX_DIR = PROJECT_ROOT / 'data' / 'dog_transactions'
RECIPIENTS_FILE = PROJECT_ROOT / 'data' / 'airdrop_recipients.json'


def build_first_receive_index() -> Dict[str, Tuple[int, str]]:
    """Walk every block file, return {address: (earliest_block, earliest_timestamp)}."""
    block_files = sorted(p for p in TX_DIR.iterdir() if p.name.startswith('block_') and p.suffix == '.json')
    print(f'[populate] Scanning {len(block_files):,} block files…', flush=True)

    first: Dict[str, Tuple[int, str]] = {}
    for i, path in enumerate(block_files):
        if i % 5000 == 0 and i > 0:
            print(f'[populate]   {i:,}/{len(block_files):,} blocks scanned, {len(first):,} unique receivers indexed', flush=True)

        try:
            with open(path) as f:
                block = json.load(f)
        except Exception as e:
            print(f'[populate]   ⚠️ skip {path.name}: {e}', file=sys.stderr)
            continue

        block_height = block.get('block_height')
        if not isinstance(block_height, int):
            continue

        for tx in block.get('transactions') or []:
            ts = tx.get('timestamp') or ''
            for receiver in tx.get('receivers') or []:
                # skip change outputs and zero-amount entries
                if receiver.get('is_change') is True:
                    continue
                if receiver.get('has_dog') is False:
                    continue
                amount = receiver.get('amount_dog') or 0
                if amount <= 0:
                    continue

                addr = receiver.get('address')
                if not addr:
                    continue

                existing = first.get(addr)
                if existing is None or block_height < existing[0]:
                    first[addr] = (block_height, ts)

    print(f'[populate] Done — {len(first):,} unique receiver addresses indexed', flush=True)
    return first


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Report what would change without writing.')
    args = parser.parse_args()

    if not TX_DIR.exists():
        print(f'[populate] ❌ tx dir not found: {TX_DIR}', file=sys.stderr)
        return 1
    if not RECIPIENTS_FILE.exists():
        print(f'[populate] ❌ recipients file not found: {RECIPIENTS_FILE}', file=sys.stderr)
        return 1

    first_receive = build_first_receive_index()

    print(f'[populate] Loading {RECIPIENTS_FILE.name}…')
    with open(RECIPIENTS_FILE) as f:
        data = json.load(f)
    recipients = data.get('recipients') or []
    print(f'[populate] {len(recipients):,} recipients loaded')

    populated = 0
    missing = 0
    already = 0
    for r in recipients:
        addr = r.get('address')
        if not addr:
            continue

        if r.get('first_receive_block', 0) > 0 and r.get('first_receive_time'):
            already += 1
            continue

        hit = first_receive.get(addr)
        if not hit:
            missing += 1
            continue

        block_height, ts = hit
        r['first_receive_block'] = block_height
        r['first_receive_time'] = ts
        populated += 1

    print(f'[populate] Result: populated={populated:,} | already_set={already:,} | missing_in_index={missing:,}')

    if args.dry_run:
        print('[populate] --dry-run set; no file written.')
        return 0

    if populated == 0:
        print('[populate] Nothing to write.')
        return 0

    with open(RECIPIENTS_FILE, 'w') as f:
        json.dump(data, f, indent=2)
    print(f'[populate] ✅ Wrote {RECIPIENTS_FILE.name}')

    pub = PROJECT_ROOT / 'public' / 'data' / 'airdrop_recipients.json'
    if pub.exists():
        with open(pub, 'w') as f:
            json.dump(data, f, indent=2)
        print(f'[populate] ✅ Wrote public/{pub.name}')

    print('[populate] Next: run scripts/update_forensic_analysis.py to propagate')
    return 0


if __name__ == '__main__':
    sys.exit(main())
