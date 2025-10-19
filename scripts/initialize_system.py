#!/usr/bin/env python3
"""
🚀 Inicializador do Sistema DOG Data v2.0

Este script prepara o sistema para começar a monitorar a partir do bloco atual.
Não busca dados históricos - apenas prepara o estado inicial.

Uso:
    python3 initialize_system.py
"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Caminhos
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / 'data'
BLOCKS_DIR = DATA_DIR / 'blocks'
HOLDERS_DIR = DATA_DIR / 'holders'
SNAPSHOTS_DIR = DATA_DIR / 'snapshots'
INDEX_DIR = DATA_DIR / 'index'
TEMP_DIR = DATA_DIR / 'temp'

# Arquivos
CURRENT_HOLDERS = HOLDERS_DIR / 'current.json'
STATE_FILE = INDEX_DIR / 'state.json'
STATS_FILE = INDEX_DIR / 'stats.json'

def run_command(cmd):
    """Executa comando do shell"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=600  # 10 minutos
        )
        if result.returncode != 0:
            raise Exception(f"Erro: {result.stderr}")
        return result.stdout.strip()
    except Exception as e:
        print(f"❌ Erro ao executar comando: {e}")
        return None

def get_current_block():
    """Obtém o bloco atual do Bitcoin Core"""
    print("🔍 Obtendo bloco atual do Bitcoin Core...")
    block_height = run_command("bitcoin-cli getblockcount")
    if not block_height:
        raise Exception("Não foi possível obter bloco atual")
    return int(block_height)

def extract_current_holders():
    """Extrai holders atuais usando efficient_dog_extractor.py"""
    print("\n👥 Extraindo holders atuais...")
    print("⏳ Isso pode levar alguns minutos...")
    
    # Rodar o extractor
    extractor_path = BASE_DIR.parent / 'ord' / 'efficient_dog_extractor.py'
    result = run_command(f"cd {BASE_DIR.parent / 'ord'} && python3 efficient_dog_extractor.py")
    
    if result is None:
        raise Exception("Falha ao extrair holders")
    
    # Ler o arquivo gerado
    holders_file = BASE_DIR.parent / 'ord' / 'dog_holders_by_address.json'
    if not holders_file.exists():
        raise Exception(f"Arquivo de holders não encontrado: {holders_file}")
    
    with open(holders_file, 'r') as f:
        data = json.load(f)
    
    return data

def prepare_holders_data(raw_data, current_block):
    """Prepara dados de holders no novo formato"""
    print("\n📊 Preparando dados de holders...")
    
    # Adicionar ranking
    holders_with_rank = []
    for rank, holder in enumerate(raw_data['holders'], 1):
        holders_with_rank.append({
            'rank': rank,
            'address': holder['address'],
            'balance': holder['total_dog'],
            'percentage': round((holder['total_dog'] / 100000000000) * 100, 4),
            'utxo_count': holder['utxo_count']
        })
    
    # Calcular estatísticas
    total_dog = sum(h['balance'] for h in holders_with_rank)
    
    return {
        'updated_at': datetime.now().isoformat(),
        'block_height': current_block,
        'total_holders': len(holders_with_rank),
        'total_supply': 100000000000,
        'circulating': total_dog,
        'burned': 100000000000 - total_dog,
        'holders': holders_with_rank
    }

def save_holders(holders_data):
    """Salva holders no novo formato"""
    print("\n💾 Salvando holders...")
    
    # Salvar current.json
    with open(CURRENT_HOLDERS, 'w') as f:
        json.dump(holders_data, f, indent=2)
    print(f"✅ Salvo: {CURRENT_HOLDERS}")
    
    # Salvar snapshot inicial
    snapshot_file = SNAPSHOTS_DIR / f"{holders_data['block_height']}.json"
    with open(snapshot_file, 'w') as f:
        json.dump(holders_data, f, indent=2)
    print(f"✅ Snapshot salvo: {snapshot_file}")

def create_initial_state(current_block):
    """Cria arquivo de estado inicial"""
    print("\n📝 Criando estado inicial...")
    
    state = {
        'last_processed_block': current_block,
        'last_holders_update': current_block,
        'processing': False,
        'started_at': datetime.now().isoformat(),
        'total_blocks_processed': 0,
        'total_transactions': 0,
        'mode': 'live'  # live = tempo real, catch_up = recuperando blocos perdidos
    }
    
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)
    print(f"✅ Estado salvo: {STATE_FILE}")

def create_initial_stats(holders_data):
    """Cria arquivo de estatísticas inicial"""
    print("\n📊 Criando estatísticas iniciais...")
    
    stats = {
        'updated_at': datetime.now().isoformat(),
        'current_block': holders_data['block_height'],
        'total_holders': holders_data['total_holders'],
        'total_transactions': 0,
        'blocks_range': {
            'first': holders_data['block_height'],
            'last': holders_data['block_height']
        },
        'top_24h': {
            'transactions': 0,
            'volume': 0,
            'new_holders': 0
        }
    }
    
    with open(STATS_FILE, 'w') as f:
        json.dump(stats, f, indent=2)
    print(f"✅ Estatísticas salvas: {STATS_FILE}")

def display_summary(holders_data):
    """Exibe resumo do sistema inicializado"""
    print("\n" + "="*80)
    print("✅ SISTEMA INICIALIZADO COM SUCESSO!")
    print("="*80)
    print(f"\n📦 Bloco inicial: {holders_data['block_height']}")
    print(f"👥 Total de holders: {holders_data['total_holders']:,}")
    print(f"🐕 Supply circulante: {holders_data['circulating']:,.2f} DOG")
    print(f"🔥 Queimado: {holders_data['burned']:,.2f} DOG")
    print(f"\n📁 Arquivos criados:")
    print(f"   ✓ {CURRENT_HOLDERS}")
    snapshot_file = SNAPSHOTS_DIR / f"{holders_data['block_height']}.json"
    print(f"   ✓ {snapshot_file}")
    print(f"   ✓ {STATE_FILE}")
    print(f"   ✓ {STATS_FILE}")
    print(f"\n🚀 Próximo passo: Rodar o monitor")
    print(f"   python3 scripts/monitor.py")
    print("="*80 + "\n")

def main():
    print("="*80)
    print("🚀 INICIALIZADOR DO SISTEMA DOG DATA v2.0")
    print("="*80)
    print("\nEste script irá:")
    print("  1. Obter o bloco atual da blockchain")
    print("  2. Extrair holders atuais")
    print("  3. Preparar estrutura de dados")
    print("  4. Criar estado inicial")
    print("\n⚠️  ATENÇÃO: Não busca dados históricos!")
    print("   O monitoramento começará do bloco atual em diante.\n")
    
    response = input("Deseja continuar? (s/n): ")
    if response.lower() != 's':
        print("❌ Cancelado pelo usuário")
        return
    
    try:
        # 1. Obter bloco atual
        current_block = get_current_block()
        print(f"✅ Bloco atual: {current_block}")
        
        # 2. Extrair holders
        raw_holders = extract_current_holders()
        print(f"✅ Holders extraídos: {len(raw_holders['holders']):,}")
        
        # 3. Preparar dados
        holders_data = prepare_holders_data(raw_holders, current_block)
        
        # 4. Salvar tudo
        save_holders(holders_data)
        create_initial_state(current_block)
        create_initial_stats(holders_data)
        
        # 5. Resumo
        display_summary(holders_data)
        
    except KeyboardInterrupt:
        print("\n\n❌ Interrompido pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Erro fatal: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

