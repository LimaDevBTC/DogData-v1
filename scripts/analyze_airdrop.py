#!/usr/bin/env python3
"""
Analisador Dinâmico do Dossiê do Airdrop DOG•GO•TO•THE•MOON

Este script:
1. Carrega a lista de recipients do airdrop (gerada por trace_airdrop_distribution.py)
2. Carrega a lista atual de holders
3. Compara e gera analytics detalhados
4. Salva o dossiê atualizado

IMPORTANTE: Este script deve ser executado sempre que os holders forem atualizados!
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Configurações
BASE_DIR = Path(__file__).parent.parent
RECIPIENTS_FILE = BASE_DIR / 'data' / 'airdrop_recipients.json'
HOLDERS_FILE = BASE_DIR / 'backend' / 'data' / 'dog_holders_by_address.json'
OUTPUT_FILE = BASE_DIR / 'data' / 'airdrop_analytics.json'

def load_json(file_path):
    """Carrega arquivo JSON"""
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ Arquivo não encontrado: {file_path}")
        return None
    except json.JSONDecodeError:
        print(f"❌ Erro ao decodificar JSON: {file_path}")
        return None

def create_holders_map(holders_data):
    """Cria mapa de holders para busca rápida"""
    holders_map = {}
    
    if 'holders' in holders_data:
        for idx, holder in enumerate(holders_data['holders']):
            holders_map[holder['address']] = {
                'current_balance': holder.get('total_dog', 0),
                'rank': idx + 1,
                'utxo_count': holder.get('utxo_count', 0)
            }
    
    return holders_map

def analyze_recipient(recipient, holders_map):
    """
    Analisa um recipient individual do airdrop.
    
    Retorna classificação:
    - 'diamond_hands': Tem 100% ou mais do airdrop (nunca vendeu ou comprou mais)
    - 'accumulator': Tem mais que o airdrop original (comprou mais)
    - 'holder': Ainda tem DOG, mas menos que o airdrop (vendeu parte)
    - 'paper_hands': Vendeu tudo (não está nos holders atuais)
    - 'whale': Acumulou muito mais (10x ou mais)
    """
    address = recipient['address']
    receive_count = recipient.get('receive_count', 1)
    
    result = {
        'address': address,
        'receive_count': receive_count,
        'airdrop_rank': recipient.get('rank', 0),
        'current_balance': 0,
        'current_rank': None,
        'balance_change': 0,
        'balance_change_pct': -100,
        'status': 'paper_hands',
        'category': 'Sold Everything'
    }
    
    # Verificar se ainda é holder
    if address in holders_map:
        holder = holders_map[address]
        current_balance = holder['current_balance']
        
        result['current_balance'] = current_balance
        result['current_rank'] = holder['rank']
        result['balance_change'] = current_balance  # Não temos amount original
        result['balance_change_pct'] = 0  # Não podemos calcular sem amount original
        
        # Classificar comportamento (simplificado - sem amount original)
        # Usamos saldo atual como proxy
        if current_balance >= 1000000000:  # 1B+ DOG
            result['status'] = 'whale'
            result['category'] = 'Whale (1B+ DOG)'
        elif current_balance >= 100000000:  # 100M+ DOG
            result['status'] = 'mega_accumulator'
            result['category'] = 'Mega Accumulator (100M+ DOG)'
        elif current_balance >= 10000000:  # 10M+ DOG
            result['status'] = 'accumulator'
            result['category'] = 'Accumulator (10M+ DOG)'
        elif current_balance >= 1000000:  # 1M+ DOG
            result['status'] = 'holder'
            result['category'] = 'Holder (1M+ DOG)'
        else:
            result['status'] = 'small_holder'
            result['category'] = 'Small Holder (<1M DOG)'
    
    return result

def generate_analytics(recipients_data, holders_data):
    """Gera analytics completos comparando recipients com holders atuais"""
    print("\n📊 Gerando analytics do airdrop...")
    
    recipients = recipients_data.get('recipients', [])
    holders_map = create_holders_map(holders_data)
    
    print(f"   📋 {len(recipients):,} recipients do airdrop")
    print(f"   👥 {len(holders_map):,} holders atuais")
    
    # Analisar cada recipient
    analyzed_recipients = []
    stats = {
        'whale': 0,
        'mega_accumulator': 0,
        'accumulator': 0,
        'holder': 0,
        'small_holder': 0,
        'paper_hands': 0
    }
    
    total_current = 0
    
    for recipient in recipients:
        analysis = analyze_recipient(recipient, holders_map)
        analyzed_recipients.append(analysis)
        
        # Atualizar estatísticas
        stats[analysis['status']] += 1
        total_current += analysis['current_balance']
    
    # Ordenar por saldo atual (maiores primeiro)
    analyzed_recipients.sort(key=lambda x: x['current_balance'], reverse=True)
    
    # Calcular percentuais
    total_recipients = len(recipients)
    stats_pct = {
        key: (value / total_recipients * 100) if total_recipients > 0 else 0
        for key, value in stats.items()
    }
    
    # Calcular retention
    still_holding = total_recipients - stats['paper_hands']
    retention_rate = (still_holding / total_recipients * 100) if total_recipients > 0 else 0
    
    print(f"\n✅ Análise completa:")
    print(f"   🐋 Whales (1B+): {stats['whale']:,} ({stats_pct['whale']:.1f}%)")
    print(f"   📈 Mega Accumulators (100M+): {stats['mega_accumulator']:,} ({stats_pct['mega_accumulator']:.1f}%)")
    print(f"   📊 Accumulators (10M+): {stats['accumulator']:,} ({stats_pct['accumulator']:.1f}%)")
    print(f"   🤝 Holders (1M+): {stats['holder']:,} ({stats_pct['holder']:.1f}%)")
    print(f"   📉 Small Holders (<1M): {stats['small_holder']:,} ({stats_pct['small_holder']:.1f}%)")
    print(f"   📄 Paper Hands: {stats['paper_hands']:,} ({stats_pct['paper_hands']:.1f}%)")
    print(f"\n   💵 Total atual (recipients still holding): {total_current:,.2f} DOG")
    print(f"   🎯 Taxa de retenção: {retention_rate:.1f}%")
    
    return {
        'summary': {
            'total_recipients': total_recipients,
            'still_holding': still_holding,
            'sold_everything': stats['paper_hands'],
            'retention_rate': retention_rate,
            'total_current_balance': total_current
        },
        'by_category': {
            'whale': {
                'count': stats['whale'],
                'percentage': stats_pct['whale']
            },
            'mega_accumulator': {
                'count': stats['mega_accumulator'],
                'percentage': stats_pct['mega_accumulator']
            },
            'accumulator': {
                'count': stats['accumulator'],
                'percentage': stats_pct['accumulator']
            },
            'holder': {
                'count': stats['holder'],
                'percentage': stats_pct['holder']
            },
            'small_holder': {
                'count': stats['small_holder'],
                'percentage': stats_pct['small_holder']
            },
            'paper_hands': {
                'count': stats['paper_hands'],
                'percentage': stats_pct['paper_hands']
            }
        },
        'recipients': analyzed_recipients
    }

def save_analytics(analytics, recipients_data, holders_data):
    """Salva analytics em arquivo JSON"""
    print(f"\n💾 Salvando analytics em {OUTPUT_FILE}...")
    
    # Criar diretório se não existe
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    output_data = {
        'timestamp': datetime.now().isoformat(),
        'last_updated': datetime.now().isoformat(),
        'airdrop_info': {
            'mint_txid': recipients_data.get('mint_txid'),
            'distributor_address': recipients_data.get('distributor_address'),
            'recipients_extracted_at': recipients_data.get('timestamp')
        },
        'holders_info': {
            'total_holders': holders_data.get('total_holders', 0),
            'holders_updated_at': holders_data.get('timestamp')
        },
        'analytics': analytics
    }
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"✅ Analytics salvos com sucesso!")

def main():
    print("="*80)
    print("📊 ANALISADOR DINÂMICO DO DOSSIÊ DO AIRDROP")
    print("="*80)
    
    # 1. Carregar recipients do airdrop
    print(f"\n📋 Carregando recipients do airdrop de {RECIPIENTS_FILE}...")
    recipients_data = load_json(RECIPIENTS_FILE)
    if not recipients_data:
        print("\n❌ Execute primeiro: python3 trace_airdrop_distribution.py")
        sys.exit(1)
    print(f"✅ {recipients_data.get('total_recipients', 0):,} recipients carregados")
    
    # 2. Carregar holders atuais
    print(f"\n👥 Carregando holders atuais de {HOLDERS_FILE}...")
    holders_data = load_json(HOLDERS_FILE)
    if not holders_data:
        print("\n❌ Execute primeiro: cd ../ord && python3 efficient_dog_extractor.py")
        sys.exit(1)
    print(f"✅ {holders_data.get('total_holders', 0):,} holders carregados")
    
    # 3. Gerar analytics
    analytics = generate_analytics(recipients_data, holders_data)
    
    # 4. Salvar resultado
    save_analytics(analytics, recipients_data, holders_data)
    
    print("\n" + "="*80)
    print("✅ DOSSIÊ DO AIRDROP ATUALIZADO!")
    print("="*80)
    print(f"\n📁 Arquivo salvo: {OUTPUT_FILE}")
    print("\n💡 Este dossiê será atualizado automaticamente quando os holders forem atualizados")

if __name__ == "__main__":
    main()

