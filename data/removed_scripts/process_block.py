#!/usr/bin/env python3
"""
📦 Processador de Blocos - DOG Data v2.0

Processa um bloco específico e extrai todas as transações DOG.
Salva em /data/blocks/{height}.json

Uso:
    python3 process_block.py <block_height>
    python3 process_block.py          # Processa próximo bloco
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
INDEX_DIR = DATA_DIR / 'index'

# DOG Rune ID
DOG_RUNE_ID = "840000:3"

def run_bitcoin_cli(cmd):
    """Executa comando bitcoin-cli"""
    try:
        result = subprocess.run(
            f"bitcoin-cli {cmd}",
            shell=True,
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode != 0:
            raise Exception(f"Erro bitcoin-cli: {result.stderr}")
        return result.stdout.strip()
    except Exception as e:
        print(f"❌ Erro: {e}")
        return None

def get_block_data(height):
    """Obtém dados do bloco"""
    print(f"🔍 Obtendo bloco {height}...")
    
    # Obter hash do bloco
    block_hash = run_bitcoin_cli(f"getblockhash {height}")
    if not block_hash:
        return None
    
    # Obter dados do bloco (verbosity=2 para incluir transações)
    block_json = run_bitcoin_cli(f"getblock {block_hash} 2")
    if not block_json:
        return None
    
    return json.loads(block_json)

def check_utxo_for_dog(txid, vout):
    """Verifica se um UTXO específico contém DOG"""
    try:
        # Tentar via gettxout (funciona se UTXO ainda existe)
        output = run_bitcoin_cli(f"gettxout {txid} {vout} true")
        if output and output != "null":
            output_data = json.loads(output)
            # Verificar se tem scriptPubKey com OP_RETURN de runes
            script = output_data.get('scriptPubKey', {}).get('hex', '')
            if '6a5d' in script:  # OP_RETURN + pushdata para runes
                return True
        
        # Se UTXO já foi gasto, tentar via getrawtransaction
        raw_tx = run_bitcoin_cli(f"getrawtransaction {txid} true")
        if raw_tx and raw_tx != "null":
            tx_data = json.loads(raw_tx)
            # Verificar se tem OP_RETURN com dados de runes
            for vout_data in tx_data.get('vout', []):
                if vout_data.get('n') == vout:
                    script = vout_data.get('scriptPubKey', {}).get('hex', '')
                    if '6a5d' in script:
                        return True
        
        return False
    except:
        return False

def extract_address(vout_data):
    """Extrai endereço de um output"""
    script_pub_key = vout_data.get('scriptPubKey', {})
    addresses = script_pub_key.get('addresses', [])
    if addresses:
        return addresses[0]
    # Tentar address diretamente
    address = script_pub_key.get('address')
    if address:
        return address
    return None

def load_current_holders():
    """Carrega holders atuais para ranking"""
    holders_file = HOLDERS_DIR / 'current.json'
    if not holders_file.exists():
        return {}
    
    with open(holders_file, 'r') as f:
        data = json.load(f)
    
    # Criar dicionário address -> holder
    holder_dict = {}
    for holder in data.get('holders', []):
        holder_dict[holder['address']] = holder
    
    return holder_dict

def process_transaction(tx, holders_dict):
    """Processa uma transação e extrai dados DOG"""
    txid = tx['txid']
    
    # Verificar se tem OP_RETURN com runes
    has_rune_data = False
    for vout in tx.get('vout', []):
        script = vout.get('scriptPubKey', {}).get('hex', '')
        if '6a5d' in script:  # OP_RETURN runes
            has_rune_data = True
            break
    
    if not has_rune_data:
        return None
    
    # Processar inputs
    inputs = []
    for vin in tx.get('vin', []):
        if 'txid' in vin:
            prev_txid = vin['txid']
            prev_vout = vin['vout']
            
            # Verificar se o UTXO anterior tinha DOG
            had_dog = check_utxo_for_dog(prev_txid, prev_vout)
            
            if had_dog:
                # Tentar obter endereço
                prev_tx_raw = run_bitcoin_cli(f"getrawtransaction {prev_txid} true")
                if prev_tx_raw:
                    prev_tx = json.loads(prev_tx_raw)
                    prev_vout_data = prev_tx['vout'][prev_vout]
                    address = extract_address(prev_vout_data)
                    
                    if address:
                        holder = holders_dict.get(address, {})
                        inputs.append({
                            'address': address,
                            'rank': holder.get('rank'),
                            'is_holder': address in holders_dict
                        })
    
    # Processar outputs (apenas outputs com valor > 0 exceto OP_RETURN)
    outputs = []
    for vout in tx.get('vout', []):
        # Pular OP_RETURN
        if vout.get('scriptPubKey', {}).get('type') == 'nulldata':
            continue
        
        address = extract_address(vout)
        if address:
            holder = holders_dict.get(address, {})
            outputs.append({
                'address': address,
                'rank': holder.get('rank'),
                'is_holder': address in holders_dict,
                'is_new': False  # Será calculado pelo backend comparando com holder
            })
    
    # Se tem inputs ou outputs com DOG, é uma transação relevante
    if inputs or outputs:
        return {
            'txid': txid,
            'position': tx.get('position', 0),
            'inputs': inputs,
            'outputs': outputs
        }
    
    return None

def process_block(height):
    """Processa um bloco completo"""
    print(f"\n{'='*80}")
    print(f"📦 Processando Bloco {height}")
    print(f"{'='*80}\n")
    
    # Obter dados do bloco
    block = get_block_data(height)
    if not block:
        print(f"❌ Não foi possível obter bloco {height}")
        return False
    
    # Carregar holders atuais
    holders_dict = load_current_holders()
    print(f"👥 Holders carregados: {len(holders_dict):,}")
    
    # Processar transações
    transactions = []
    total_txs = len(block.get('tx', []))
    print(f"🔍 Analisando {total_txs} transações...\n")
    
    for idx, tx in enumerate(block.get('tx', [])):
        if (idx + 1) % 100 == 0:
            print(f"   Progresso: {idx+1}/{total_txs} transações...")
        
        tx_data = process_transaction(tx, holders_dict)
        if tx_data:
            transactions.append(tx_data)
    
    # Preparar dados do bloco
    block_data = {
        'block_height': height,
        'block_hash': block['hash'],
        'block_time': datetime.fromtimestamp(block['time']).isoformat(),
        'tx_count': len(transactions),
        'transactions': transactions
    }
    
    # Salvar
    output_file = BLOCKS_DIR / f"{height}.json"
    with open(output_file, 'w') as f:
        json.dump(block_data, f, indent=2)
    
    # Resumo
    print(f"\n✅ Bloco processado!")
    print(f"   Transações DOG: {len(transactions)}")
    print(f"   Arquivo: {output_file}")
    
    return True

def main():
    if len(sys.argv) > 1:
        # Bloco específico foi passado
        try:
            height = int(sys.argv[1])
        except:
            print("❌ Altura do bloco inválida")
            sys.exit(1)
    else:
        # Processar próximo bloco
        state_file = INDEX_DIR / 'state.json'
        if not state_file.exists():
            print("❌ Sistema não inicializado! Rode: python3 initialize_system.py")
            sys.exit(1)
        
        with open(state_file, 'r') as f:
            state = json.load(f)
        
        height = state['last_processed_block'] + 1
    
    success = process_block(height)
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()


