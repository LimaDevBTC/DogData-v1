#!/usr/bin/env python3
"""
Gerador de Analytics do Airdrop
Baseado nos dados definitivos e corretos
"""

import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).parent.parent
AIRDROP_DATA_FILE = BASE_DIR / 'data' / 'airdrop_recipients.json'
HOLDERS_FILE = BASE_DIR / 'backend' / 'data' / 'dog_holders_by_address.json'
OUTPUT_FILE = BASE_DIR / 'data' / 'airdrop_analytics.json'

def load_json(file_path):
    """Carrega arquivo JSON"""
    with open(file_path, 'r') as f:
        return json.load(f)

def main():
    print("="*80)
    print("GERADOR DE ANALYTICS DO AIRDROP")
    print("="*80)
    
    # Carregar dados
    print(f"\nCarregando airdrop de {AIRDROP_DATA_FILE}...")
    airdrop_data = load_json(AIRDROP_DATA_FILE)
    recipients = airdrop_data['recipients']
    
    print(f"Carregando holders de {HOLDERS_FILE}...")
    holders_data = load_json(HOLDERS_FILE)
    holders_map = {h['address']: h for h in holders_data.get('holders', [])}
    
    # Calcular estatísticas
    print("\nCalculando estatísticas...")
    
    total_recipients = len(recipients)
    recipients_with_multiple = sum(1 for r in recipients if r['receive_count'] > 1)
    total_airdrops = sum(r['receive_count'] for r in recipients)
    
    still_holding = 0
    sold_everything = 0
    total_current_balance = 0
    
    enhanced_recipients = []
    
    for recipient in recipients:
        address = recipient['address']
        airdrop_amount = recipient['airdrop_amount']
        
        # Verificar se ainda é holder
        current_balance = 0
        status = 'sold_all'
        
        if address in holders_map:
            current_balance = holders_map[address].get('total_dog', 0)
            still_holding += 1
            total_current_balance += current_balance
            
            # Determinar status
            if current_balance > airdrop_amount:
                status = 'accumulated'
            elif current_balance == airdrop_amount:
                status = 'holding'
            elif current_balance > 0:
                status = 'partial_sold'
        else:
            sold_everything += 1
        
        enhanced_recipients.append({
            'address': address,
            'airdrop_amount': airdrop_amount,
            'receive_count': recipient['receive_count'],
            'current_balance': current_balance,
            'status': status,
            'rank': recipient['rank']
        })
    
    # Ordenar por receive_count e depois por airdrop_amount
    enhanced_recipients.sort(
        key=lambda x: (x['receive_count'], x['airdrop_amount']),
        reverse=True
    )
    
    retention_rate = (still_holding / total_recipients * 100) if total_recipients > 0 else 0
    
    # Categorias
    by_category = {
        'accumulated': sum(1 for r in enhanced_recipients if r['status'] == 'accumulated'),
        'holding': sum(1 for r in enhanced_recipients if r['status'] == 'holding'),
        'partial_sold': sum(1 for r in enhanced_recipients if r['status'] == 'partial_sold'),
        'sold_all': sum(1 for r in enhanced_recipients if r['status'] == 'sold_all')
    }
    
    # Montar analytics
    analytics = {
        'timestamp': datetime.now().isoformat(),
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
            'recipients': enhanced_recipients
        }
    }
    
    # Salvar
    print(f"\nSalvando em {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(analytics, f, indent=2)
    
    print("\n" + "="*80)
    print("ANALYTICS GERADOS COM SUCESSO!")
    print("="*80)
    print(f"Total Recipients: {total_recipients:,}")
    print(f"Recipients com múltiplos airdrops: {recipients_with_multiple:,}")
    print(f"Total Airdrops: {total_airdrops:,}")
    print(f"Still Holding: {still_holding:,} ({retention_rate:.1f}%)")
    print(f"Sold Everything: {sold_everything:,}")
    print(f"\nBy Category:")
    for cat, count in by_category.items():
        print(f"  {cat}: {count:,}")

if __name__ == "__main__":
    main()

