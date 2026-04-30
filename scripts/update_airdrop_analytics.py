#!/usr/bin/env python3
"""
Regenera airdrop_analytics.json cruzando a lista fixa de airdrop recipients
com os holders atuais (dog_holders_by_address.json).

Deve ser executado após cada atualização de holders para manter os dados frescos.

Uso:
    python3 scripts/update_airdrop_analytics.py
"""

import json
from pathlib import Path
from datetime import datetime, timezone


def utc_now_iso() -> str:
    """ISO 8601 UTC timestamp with 'Z' suffix (millisecond precision)."""
    n = datetime.now(timezone.utc)
    return n.strftime('%Y-%m-%dT%H:%M:%S.') + f"{n.microsecond // 1000:03d}Z"


BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / 'data'
PUBLIC_DATA_DIR = BASE_DIR / 'public' / 'data'

AIRDROP_FILE = DATA_DIR / 'airdrop_recipients.json'
HOLDERS_FILE = DATA_DIR / 'dog_holders_by_address.json'
OUTPUT_FILE = DATA_DIR / 'airdrop_analytics.json'
PUBLIC_OUTPUT = PUBLIC_DATA_DIR / 'airdrop_analytics.json'


def main():
    print("[airdrop_analytics] Carregando dados...")

    with open(AIRDROP_FILE, 'r') as f:
        airdrop_data = json.load(f)
    recipients = airdrop_data['recipients']

    with open(HOLDERS_FILE, 'r') as f:
        holders_data = json.load(f)
    holders_map = {h['address']: h for h in holders_data.get('holders', [])}

    print(f"[airdrop_analytics] {len(recipients):,} recipients x {len(holders_map):,} holders atuais")

    still_holding = 0
    sold_everything = 0
    total_current_balance = 0
    recipients_with_multiple = sum(1 for r in recipients if r['receive_count'] > 1)
    total_airdrops = sum(r['receive_count'] for r in recipients)

    enhanced = []

    for recipient in recipients:
        address = recipient['address']
        airdrop_amount = recipient['airdrop_amount']
        current_balance = 0
        status = 'sold_all'

        if address in holders_map:
            current_balance = holders_map[address].get('total_dog', 0)
            still_holding += 1
            total_current_balance += current_balance

            if current_balance > airdrop_amount:
                status = 'accumulated'
            elif current_balance == airdrop_amount:
                status = 'holding'
            elif current_balance > 0:
                status = 'partial_sold'
        else:
            sold_everything += 1

        enhanced.append({
            'address': address,
            'airdrop_amount': airdrop_amount,
            'receive_count': recipient['receive_count'],
            'current_balance': current_balance,
            'status': status,
            'rank': recipient['rank']
        })

    enhanced.sort(key=lambda x: (x['receive_count'], x['airdrop_amount']), reverse=True)

    total_recipients = len(recipients)
    retention_rate = (still_holding / total_recipients * 100) if total_recipients > 0 else 0

    by_category = {
        'accumulated': sum(1 for r in enhanced if r['status'] == 'accumulated'),
        'holding': sum(1 for r in enhanced if r['status'] == 'holding'),
        'partial_sold': sum(1 for r in enhanced if r['status'] == 'partial_sold'),
        'sold_all': sum(1 for r in enhanced if r['status'] == 'sold_all')
    }

    analytics = {
        'timestamp': utc_now_iso(),
        'data_source': 'trace_dog_flow_complete',
        'analytics': {
            'summary': {
                'total_recipients': total_recipients,
                'still_holding': still_holding,
                'sold_everything': sold_everything,
                'retention_rate': retention_rate,
                'total_current_balance': total_current_balance,
                'recipients_with_multiple': recipients_with_multiple,
                'total_airdrops': total_airdrops
            },
            'by_category': by_category,
            'recipients': enhanced
        }
    }

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(analytics, f, indent=2)

    # Copiar para public/data se existir
    if PUBLIC_DATA_DIR.exists():
        with open(PUBLIC_OUTPUT, 'w') as f:
            json.dump(analytics, f, indent=2)

    print(f"[airdrop_analytics] Concluído! Retention: {retention_rate:.1f}% | "
          f"Holding: {still_holding:,} | Sold: {sold_everything:,} | "
          f"Accumulated: {by_category['accumulated']:,}")


if __name__ == "__main__":
    main()
