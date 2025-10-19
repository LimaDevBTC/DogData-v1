#!/usr/bin/env python3
"""
🎯 Monitor Principal - DOG Data v2.0

Orquestra todo o sistema:
- Processa novos blocos em tempo real
- Atualiza holders quando não está processando blocos
- Cria snapshots a cada 100 blocos
- Mantém estatísticas atualizadas

Uso:
    python3 monitor_v2.py
"""

import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# Configurações
BLOCK_CHECK_INTERVAL = 10  # Segundos entre checagens de novo bloco
HOLDERS_UPDATE_INTERVAL = 300  # 5 minutos entre atualizações de holders
SNAPSHOT_INTERVAL = 100  # Snapshot a cada N blocos

# Caminhos
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / 'data'
BLOCKS_DIR = DATA_DIR / 'blocks'
HOLDERS_DIR = DATA_DIR / 'holders'
SNAPSHOTS_DIR = DATA_DIR / 'snapshots'
INDEX_DIR = DATA_DIR / 'index'
TEMP_DIR = DATA_DIR / 'temp'
SCRIPTS_DIR = BASE_DIR / 'scripts'

# Arquivos
STATE_FILE = INDEX_DIR / 'state.json'
STATS_FILE = INDEX_DIR / 'stats.json'
CURRENT_HOLDERS = HOLDERS_DIR / 'current.json'
LOCK_FILE = TEMP_DIR / 'processing.lock'

def log(message, level="INFO"):
    """Log formatado"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    emoji = {
        "INFO": "ℹ️ ",
        "SUCCESS": "✅",
        "ERROR": "❌",
        "WARNING": "⚠️ ",
        "BLOCK": "📦",
        "HOLDERS": "👥",
        "STATS": "📊"
    }.get(level, "  ")
    print(f"{timestamp} {emoji} {message}")

def run_command(cmd, timeout=60):
    """Executa comando shell"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Timeout"
    except Exception as e:
        return False, "", str(e)

def get_current_block_height():
    """Obtém altura do bloco atual do Bitcoin Core"""
    success, stdout, stderr = run_command("bitcoin-cli getblockcount", timeout=10)
    if success and stdout:
        return int(stdout.strip())
    return None

def load_state():
    """Carrega estado do sistema"""
    if not STATE_FILE.exists():
        log("Estado não encontrado! Execute initialize_system.py primeiro.", "ERROR")
        sys.exit(1)
    
    with open(STATE_FILE, 'r') as f:
        return json.load(f)

def save_state(state):
    """Salva estado do sistema"""
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

def is_processing():
    """Verifica se está processando algo"""
    return LOCK_FILE.exists()

def create_lock(lock_type, block=None):
    """Cria arquivo de lock"""
    lock_data = {
        'type': lock_type,
        'started_at': datetime.now().isoformat(),
        'block': block
    }
    with open(LOCK_FILE, 'w') as f:
        json.dump(lock_data, f)

def remove_lock():
    """Remove arquivo de lock"""
    if LOCK_FILE.exists():
        LOCK_FILE.unlink()

def process_new_block(height):
    """Processa um novo bloco"""
    log(f"Processando bloco {height}...", "BLOCK")
    
    create_lock('block_processing', height)
    
    try:
        # Usar nosso script dog_transaction_finder.py existente
        # mas salvar no novo formato
        cmd = f"cd {SCRIPTS_DIR} && python3 dog_transaction_finder.py {height} {height}"
        success, stdout, stderr = run_command(cmd, timeout=300)
        
        if not success:
            log(f"Erro ao processar bloco {height}: {stderr}", "ERROR")
            return False
        
        log(f"Bloco {height} processado!", "SUCCESS")
        return True
        
    finally:
        remove_lock()

def update_holders():
    """Atualiza lista de holders"""
    log("Atualizando holders...", "HOLDERS")
    
    create_lock('holders_update')
    
    try:
        # Rodar efficient_dog_extractor.py
        cmd = f"cd {BASE_DIR.parent / 'ord'} && python3 efficient_dog_extractor.py"
        success, stdout, stderr = run_command(cmd, timeout=600)
        
        if not success:
            log(f"Erro ao atualizar holders: {stderr}", "ERROR")
            return False
        
        # Converter para novo formato
        holders_file = BASE_DIR.parent / 'ord' / 'dog_holders_by_address.json'
        if holders_file.exists():
            with open(holders_file, 'r') as f:
                raw_data = json.load(f)
            
            # Preparar novo formato
            holders_with_rank = []
            for rank, holder in enumerate(raw_data['holders'], 1):
                holders_with_rank.append({
                    'rank': rank,
                    'address': holder['address'],
                    'balance': holder['total_dog'],
                    'percentage': round((holder['total_dog'] / 100000000000) * 100, 4),
                    'utxo_count': holder['utxo_count']
                })
            
            total_dog = sum(h['balance'] for h in holders_with_rank)
            
            holders_data = {
                'updated_at': datetime.now().isoformat(),
                'block_height': get_current_block_height(),
                'total_holders': len(holders_with_rank),
                'total_supply': 100000000000,
                'circulating': total_dog,
                'burned': 100000000000 - total_dog,
                'holders': holders_with_rank
            }
            
            # Salvar
            with open(CURRENT_HOLDERS, 'w') as f:
                json.dump(holders_data, f, indent=2)
            
            log(f"Holders atualizados: {len(holders_with_rank):,}", "SUCCESS")
            return True
        
        return False
        
    finally:
        remove_lock()

def create_snapshot(height):
    """Cria snapshot dos holders"""
    log(f"Criando snapshot do bloco {height}...", "HOLDERS")
    
    if CURRENT_HOLDERS.exists():
        import shutil
        snapshot_file = SNAPSHOTS_DIR / f"{height}.json"
        shutil.copy(CURRENT_HOLDERS, snapshot_file)
        log(f"Snapshot criado: {snapshot_file}", "SUCCESS")

def update_stats(state):
    """Atualiza estatísticas"""
    # Contar transações nos últimos blocos
    recent_tx_count = 0
    for height in range(max(840000, state['last_processed_block'] - 144), state['last_processed_block'] + 1):
        block_file = BLOCKS_DIR / f"{height}.json"
        if block_file.exists():
            with open(block_file, 'r') as f:
                block_data = json.load(f)
                recent_tx_count += len(block_data.get('transactions', []))
    
    stats = {
        'updated_at': datetime.now().isoformat(),
        'current_block': state['last_processed_block'],
        'total_holders': 0,
        'total_transactions': state['total_transactions'],
        'blocks_range': {
            'first': state.get('first_processed_block', state['last_processed_block']),
            'last': state['last_processed_block']
        },
        'last_24h': {
            'transactions': recent_tx_count,
            'blocks': 144
        }
    }
    
    if CURRENT_HOLDERS.exists():
        with open(CURRENT_HOLDERS, 'r') as f:
            holders = json.load(f)
            stats['total_holders'] = holders.get('total_holders', 0)
    
    with open(STATS_FILE, 'w') as f:
        json.dump(stats, f, indent=2)

def main_loop():
    """Loop principal do monitor"""
    log("="*80)
    log("🚀 DOG Data Monitor v2.0 - INICIADO")
    log("="*80)
    
    state = load_state()
    last_holders_update = time.time()
    
    log(f"Último bloco processado: {state['last_processed_block']}")
    log(f"Total de transações: {state['total_transactions']}")
    log("Monitoramento iniciado. Pressione Ctrl+C para parar.\n")
    
    try:
        while True:
            current_time = time.time()
            
            # Verificar se não está processando
            if is_processing():
                log("Aguardando processamento atual terminar...")
                time.sleep(5)
                continue
            
            # Obter altura atual da blockchain
            current_block = get_current_block_height()
            if current_block is None:
                log("Erro ao obter bloco atual. Bitcoin Core está rodando?", "ERROR")
                time.sleep(BLOCK_CHECK_INTERVAL)
                continue
            
            # Se tem novo bloco, processar
            if current_block > state['last_processed_block']:
                next_block = state['last_processed_block'] + 1
                
                if process_new_block(next_block):
                    state['last_processed_block'] = next_block
                    state['total_blocks_processed'] += 1
                    state['total_transactions'] += 1  # Será contado corretamente depois
                    
                    # Criar snapshot se necessário
                    if next_block % SNAPSHOT_INTERVAL == 0:
                        create_snapshot(next_block)
                    
                    save_state(state)
                    update_stats(state)
                    
                    # Recarregar backend
                    log("Recarregando backend...")
                    run_command("curl -s http://localhost:3001/api/reload", timeout=5)
                
                continue  # Processar próximo bloco imediatamente
            
            # Se não tem novo bloco e passou tempo suficiente, atualizar holders
            if current_time - last_holders_update > HOLDERS_UPDATE_INTERVAL:
                if update_holders():
                    state['last_holders_update'] = current_block
                    save_state(state)
                    update_stats(state)
                    
                    # Recarregar backend
                    run_command("curl -s http://localhost:3001/api/reload", timeout=5)
                
                last_holders_update = current_time
            
            # Aguardar próxima verificação
            time.sleep(BLOCK_CHECK_INTERVAL)
    
    except KeyboardInterrupt:
        log("\n\nMonitor interrompido pelo usuário", "WARNING")
        remove_lock()
    except Exception as e:
        log(f"Erro fatal: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        remove_lock()
        sys.exit(1)

if __name__ == '__main__':
    main_loop()

