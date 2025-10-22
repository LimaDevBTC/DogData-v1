#!/usr/bin/env python3
"""
Analisador Comportamental Forense do Airdrop DOG

Este script faz ANÁLISE CRUZADA PROFUNDA:
1. Carrega dados forenses do airdrop
2. Cruza com holders atuais
3. Calcula métricas comportamentais avançadas:
   - Acumulação desde o airdrop (ganhou quanto)
   - Venda desde o airdrop (perdeu quanto)
   - Taxa de retenção individual
   - Padrão de dumping (vendendo aos poucos)
   - Velocidade de acumulação
   - Ranking no airdrop vs ranking atual
   - Mudança de posição
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Configurações
BASE_DIR = Path(__file__).parent.parent
FORENSIC_DATA_FILE = BASE_DIR / 'data' / 'forensic_airdrop_data.json'
HOLDERS_FILE = BASE_DIR / 'backend' / 'data' / 'dog_holders_by_address.json'
OUTPUT_FILE = BASE_DIR / 'data' / 'forensic_behavioral_analysis.json'

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
                'current_rank': idx + 1,
                'utxo_count': holder.get('utxo_count', 0)
            }
    
    return holders_map

def calculate_behavior_metrics(recipient, holders_map):
    """
    Calcula métricas comportamentais AVANÇADAS.
    
    Retorna perfil completo com:
    - Status atual (holding, sold, etc)
    - Mudança absoluta (ganhou/perdeu quanto)
    - Mudança percentual
    - Taxa de retenção
    - Mudança de ranking
    - Padrão comportamental
    - Velocidade de mudança
    """
    address = recipient['address']
    airdrop_amount = recipient['total_received']
    airdrop_rank = recipient['airdrop_rank']
    
    profile = {
        'address': address,
        'airdrop_rank': airdrop_rank,
        'airdrop_amount': airdrop_amount,
        'receive_count': recipient['receive_count'],
        'first_receive_block': recipient['first_receive_block'],
        'first_receive_time': recipient['first_receive_time'],
        'current_balance': 0,
        'current_rank': None,
        'absolute_change': 0,
        'percentage_change': -100,
        'retention_rate': 0,
        'rank_change': None,
        'behavior_pattern': 'paper_hands',
        'behavior_category': 'Sold Everything',
        'accumulation_rate': 0,
        'is_dumping': False,
        'diamond_score': 0,  # 0-100 score
        'insights': []
    }
    
    # Verificar se ainda é holder
    if address in holders_map:
        holder = holders_map[address]
        current_balance = holder['current_balance']
        current_rank = holder['current_rank']
        
        profile['current_balance'] = current_balance
        profile['current_rank'] = current_rank
        
        # Calcular mudanças
        profile['absolute_change'] = current_balance - airdrop_amount
        
        if airdrop_amount > 0:
            profile['percentage_change'] = (profile['absolute_change'] / airdrop_amount) * 100
            profile['retention_rate'] = (current_balance / airdrop_amount) * 100
        
        # Mudança de ranking
        profile['rank_change'] = airdrop_rank - current_rank  # Positivo = subiu
        
        # Taxa de acumulação (DOG ganho por dia desde airdrop)
        # Aproximação: blocos desde 840000
        blocks_since = 918786 - 840000  # Aproximado
        days_since = blocks_since / 144  # ~144 blocos por dia
        if days_since > 0:
            profile['accumulation_rate'] = profile['absolute_change'] / days_since
        
        # Classificar padrão comportamental
        profile = classify_behavior(profile)
        
        # Gerar insights
        profile['insights'] = generate_insights(profile)
    
    return profile

def classify_behavior(profile):
    """Classifica o padrão comportamental com análise profunda"""
    
    balance = profile['current_balance']
    change_pct = profile['percentage_change']
    retention = profile['retention_rate']
    rank_change = profile['rank_change'] or 0
    
    # Diamond Score (0-100)
    diamond_score = 0
    
    # ACCUMULATORS: Qualquer um que comprou mais (change_pct > 0)
    if change_pct >= 1000:  # 10x ou mais
        profile['behavior_pattern'] = 'satoshi_visionary'
        profile['behavior_category'] = 'Accumulator'  # Categoria consolidada
        profile['behavior_detail'] = 'Satoshi Visionary (10x+)'  # Detalhe interno
        diamond_score = 95
        
    elif change_pct >= 500:  # 5x-10x
        profile['behavior_pattern'] = 'btc_maximalist'
        profile['behavior_category'] = 'Accumulator'
        profile['behavior_detail'] = 'BTC Maximalist (5x-10x)'
        diamond_score = 90
        
    elif change_pct >= 200:  # 2x-5x
        profile['behavior_pattern'] = 'rune_master'
        profile['behavior_category'] = 'Accumulator'
        profile['behavior_detail'] = 'Rune Master (2x-5x)'
        diamond_score = 85
        
    elif change_pct >= 50:  # 50%-200%
        profile['behavior_pattern'] = 'ordinal_believer'
        profile['behavior_category'] = 'Accumulator'
        profile['behavior_detail'] = 'Ordinal Believer (50%+)'
        diamond_score = 80
        
    elif change_pct > 0:  # Qualquer acumulação positiva
        profile['behavior_pattern'] = 'dog_legend'
        profile['behavior_category'] = 'Accumulator'
        profile['behavior_detail'] = 'DOG Legend (Added Any Amount)'
        diamond_score = 75
        
    # HOLDERS: Manteve EXATAMENTE o airdrop (apenas 100%)
    elif change_pct == 0:  # Manteve exatamente 100%
        profile['behavior_pattern'] = 'diamond_paws'
        profile['behavior_category'] = 'Holder'
        profile['behavior_detail'] = 'Diamond Paws 🐾 (Kept Exact Airdrop)'
        diamond_score = 100
        
    # SELLERS: Venderam qualquer quantidade (mesmo que parcial)
    elif retention >= 90:  # Vendeu até 10%
        profile['behavior_pattern'] = 'hodl_hero'
        profile['behavior_category'] = 'Seller'
        profile['behavior_detail'] = 'HODL Hero (90%+)'
        diamond_score = 65
        
    elif retention >= 75:  # Vendeu 10%-25%
        profile['behavior_pattern'] = 'steady_holder'
        profile['behavior_category'] = 'Seller'
        profile['behavior_detail'] = 'Steady Holder (75%+)'
        diamond_score = 55
        
    elif retention >= 50:  # Vendeu 25%-50%
        profile['behavior_pattern'] = 'profit_taker'
        profile['behavior_category'] = 'Seller'
        profile['behavior_detail'] = 'Profit Taker (50%+)'
        diamond_score = 45
        
    elif retention >= 25:  # Vendeu 50%-75%
        profile['behavior_pattern'] = 'early_exit'
        profile['behavior_category'] = 'Seller'
        profile['behavior_detail'] = 'Early Exit (25%+)'
        diamond_score = 30
        profile['is_dumping'] = True
        
    elif retention >= 10:  # Vendeu 75%-90%
        profile['behavior_pattern'] = 'panic_seller'
        profile['behavior_category'] = 'Seller'
        profile['behavior_detail'] = 'Panic Seller (10%+)'
        diamond_score = 15
        profile['is_dumping'] = True
        
    else:  # Vendeu 90%+ ou tudo
        profile['behavior_pattern'] = 'paper_hands'
        profile['behavior_category'] = 'Seller'
        profile['behavior_detail'] = 'Paper Hands 📄 (<10%)'
        diamond_score = 5
        profile['is_dumping'] = True
    
    # Ajustar score baseado em rank change
    if rank_change > 1000:  # Subiu muito
        diamond_score = min(100, diamond_score + 10)
    elif rank_change > 500:
        diamond_score = min(100, diamond_score + 5)
    elif rank_change < -1000:  # Caiu muito
        diamond_score = max(0, diamond_score - 10)
    
    profile['diamond_score'] = diamond_score
    
    return profile

def generate_insights(profile):
    """Gera insights personalizados baseado no perfil"""
    insights = []
    
    # Insight sobre acumulação
    if profile['percentage_change'] >= 100:
        insights.append(f"Accumulated {profile['percentage_change']:.0f}% since airdrop")
    
    # Insight sobre ranking
    if profile['rank_change'] and profile['rank_change'] > 0:
        insights.append(f"Climbed {profile['rank_change']:,} positions in ranking")
    elif profile['rank_change'] and profile['rank_change'] < -100:
        insights.append(f"Dropped {abs(profile['rank_change']):,} positions in ranking")
    
    # Insight sobre dumping
    if profile['is_dumping']:
        sold_amount = profile['airdrop_amount'] - profile['current_balance']
        insights.append(f"Sold {sold_amount:,.0f} DOG ({100-profile['retention_rate']:.1f}%)")
    
    # Insight sobre velocidade
    if profile['accumulation_rate'] > 10000:
        insights.append(f"Fast accumulator: +{profile['accumulation_rate']:,.0f} DOG/day")
    elif profile['accumulation_rate'] < -10000:
        insights.append(f"Fast seller: {profile['accumulation_rate']:,.0f} DOG/day")
    
    # Insight sobre diamond score
    if profile['diamond_score'] >= 90:
        insights.append("Elite holder")
    elif profile['diamond_score'] >= 70:
        insights.append("Strong conviction")
    elif profile['diamond_score'] <= 20:
        insights.append("High sell pressure")
    
    return insights

def generate_behavioral_analysis(forensic_data, holders_data):
    """Gera análise comportamental completa"""
    print("\nGerando análise comportamental...")
    
    recipients = forensic_data.get('recipients', [])
    holders_map = create_holders_map(holders_data)
    
    print(f"   {len(recipients):,} recipients do airdrop")
    print(f"   {len(holders_map):,} holders atuais")
    
    # Analisar cada recipient
    profiles = []
    
    # Contadores para estatísticas
    stats = {
        'total_analyzed': len(recipients),
        'still_holding': 0,
        'sold_everything': 0,
        'accumulated': 0,
        'dumping': 0,
        'diamond_hands': 0,
        'by_pattern': {}
    }
    
    for recipient in recipients:
        profile = calculate_behavior_metrics(recipient, holders_map)
        profiles.append(profile)
        
        # Atualizar estatísticas
        if profile['current_balance'] > 0:
            stats['still_holding'] += 1
        else:
            stats['sold_everything'] += 1
        
        if profile['percentage_change'] > 0:
            stats['accumulated'] += 1
        
        if profile['is_dumping']:
            stats['dumping'] += 1
        
        if profile['behavior_pattern'] == 'diamond_paws':
            stats['diamond_hands'] += 1  # Mantém nome da chave para compatibilidade
        
        # Contar por padrão
        pattern = profile['behavior_pattern']
        stats['by_pattern'][pattern] = stats['by_pattern'].get(pattern, 0) + 1
    
    # Ordenar por diamond score (maiores primeiro)
    profiles.sort(key=lambda x: x['diamond_score'], reverse=True)
    
    # Calcular percentuais
    total = stats['total_analyzed']
    stats['retention_rate'] = (stats['still_holding'] / total * 100) if total > 0 else 0
    stats['accumulator_rate'] = (stats['accumulated'] / total * 100) if total > 0 else 0
    stats['dumper_rate'] = (stats['dumping'] / total * 100) if total > 0 else 0
    
    print(f"\nAnálise comportamental completa!")
    print(f"   Diamond Hands: {stats['diamond_hands']:,}")
    print(f"   Accumulators: {stats['accumulated']:,}")
    print(f"   Dumpers: {stats['dumping']:,}")
    print(f"   Paper Hands: {stats['sold_everything']:,}")
    
    return profiles, stats

def save_behavioral_analysis(profiles, stats, forensic_data):
    """Salva análise comportamental"""
    print(f"\nSalvando análise em {OUTPUT_FILE}...")
    
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # Top performers
    top_diamond_paws = [p for p in profiles if p['behavior_pattern'] == 'diamond_paws'][:50]
    top_accumulators = [p for p in profiles if p['behavior_pattern'] in ['satoshi_visionary', 'btc_maximalist', 'rune_master', 'ordinal_believer', 'dog_legend']][:50]
    biggest_sellers = sorted([p for p in profiles if p['is_dumping']], 
                            key=lambda x: x['retention_rate'])[:50]
    
    output_data = {
        'timestamp': datetime.now().isoformat(),
        'analysis_type': 'forensic_behavioral',
        'statistics': stats,
        'top_performers': {
            'diamond_hands': top_diamond_paws,  # Mantém nome da chave para compatibilidade
            'accumulators': top_accumulators,
            'sellers': biggest_sellers
        },
        'all_profiles': profiles
    }
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"{len(profiles):,} perfis comportamentais salvos!")
    
    # Mostrar top insights
    print(f"\nTOP 10 DIAMOND PAWS 🐾:")
    for i, p in enumerate(top_diamond_paws[:10]):
        print(f"   #{i+1}: {p['address'][:30]}... - Score: {p['diamond_score']} - {p['behavior_category']}")
    
    print(f"\nTOP 10 ACCUMULATORS:")
    for i, p in enumerate(top_accumulators[:10]):
        print(f"   #{i+1}: {p['address'][:30]}... - Change: +{p['percentage_change']:.1f}% - {p['behavior_category']}")

def main():
    print("="*80)
    print("ANALISADOR COMPORTAMENTAL FORENSE")
    print("="*80)
    
    # 1. Carregar dados forenses do airdrop
    print(f"\nCarregando dados forenses de {FORENSIC_DATA_FILE}...")
    forensic_data = load_json(FORENSIC_DATA_FILE)
    if not forensic_data:
        print("\nExecute primeiro: python3 scripts/forensic_airdrop_extractor.py")
        sys.exit(1)
    print(f"{forensic_data['statistics']['total_recipients']:,} recipients carregados")
    
    # 2. Carregar holders atuais
    print(f"\nCarregando holders atuais de {HOLDERS_FILE}...")
    holders_data = load_json(HOLDERS_FILE)
    if not holders_data:
        print("\nExecute primeiro: cd ../ord && python3 efficient_dog_extractor.py")
        sys.exit(1)
    print(f"{holders_data.get('total_holders', 0):,} holders carregados")
    
    # 3. Gerar análise comportamental
    profiles, stats = generate_behavioral_analysis(forensic_data, holders_data)
    
    # 4. Salvar resultado
    save_behavioral_analysis(profiles, stats, forensic_data)
    
    print("\n" + "="*80)
    print("ANÁLISE COMPORTAMENTAL COMPLETA!")
    print("="*80)
    print(f"\nArquivo salvo: {OUTPUT_FILE}")
    print(f"\nDados prontos para API e frontend!")

if __name__ == "__main__":
    main()

