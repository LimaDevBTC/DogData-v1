#!/usr/bin/env python3
"""
Detector Simples de Transações DOG
- Usa a estrutura correta do ord balances
- Detecta mudanças nos UTXOs do DOG
"""

import subprocess
import json
import time
import requests
from datetime import datetime
import os

# Configurações
ORD_PATH = "/home/bitmax/Projects/bitcoin-fullstack/ord/target/release/ord"
ORD_DATA_DIR = "/home/bitmax/Projects/bitcoin-fullstack/ord/data"
DOG_RUNE_ID = "DOG•GO•TO•THE•MOON"
DOG_DIVISIBILITY = 5
TRANSACTIONS_FILE = "/home/bitmax/Projects/bitcoin-fullstack/dog_transactions.json"
LAST_UTXOS_FILE = "/tmp/last_dog_utxos.json"
HOLDERS_DATA_FILE = "/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/backend/data/dog_holders_by_address.json"
BACKEND_RELOAD_URL = "http://localhost:3001/api/reload-data"

def get_current_block_height():
    """Obtém a altura atual do bloco Bitcoin"""
    try:
        result = subprocess.run(
            ["bitcoin-cli", "getblockcount"],
            capture_output=True, text=True, check=True
        )
        return int(result.stdout.strip())
    except Exception as e:
        print(f"❌ Erro ao obter altura do bloco: {e}")
        return None

def get_ord_balances():
    """Obtém dados de balances do Ord"""
    try:
        result = subprocess.run(
            [ORD_PATH, "--data-dir", ORD_DATA_DIR, "balances"],
            capture_output=True, text=True, check=True
        )
        return json.loads(result.stdout)
    except Exception as e:
        print(f"❌ Erro ao executar 'ord balances': {e}")
        return None

def get_dog_utxos(balances_data):
    """Extrai UTXOs do DOG dos dados de balances"""
    dog_utxos = balances_data.get("runes", {}).get(DOG_RUNE_ID, {})
    return dog_utxos

def get_address_from_outpoint(outpoint):
    """Resolve endereço a partir do outpoint (funciona para UTXOs gastos e não gastos)"""
    try:
        txid, vout = outpoint.split(":")
        
        # Obter a transação que criou o UTXO
        result = subprocess.run(
            ["bitcoin-cli", "getrawtransaction", txid],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            return "unknown"
        
        raw_tx = result.stdout.strip()
        
        # Decodificar a transação
        result = subprocess.run(
            ["bitcoin-cli", "decoderawtransaction", raw_tx],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            return "unknown"
        
        tx_data = json.loads(result.stdout)
        
        # Obter o endereço do output correspondente
        vout_index = int(vout)
        if vout_index < len(tx_data['vout']):
            vout_data = tx_data['vout'][vout_index]
            if 'scriptPubKey' in vout_data and 'address' in vout_data['scriptPubKey']:
                return vout_data['scriptPubKey']['address']
        
        return "unknown"
    except Exception as e:
        return "unknown"

def get_holder_info(address, holders_data):
    """Obtém informações do holder incluindo ranking"""
    holders = holders_data.get("holders", [])
    for i, holder in enumerate(holders):
        if holder["address"] == address:
            return {
                "address": address,
                "utxo_count": holder["utxo_count"],
                "ranking": i + 1,  # Ranking baseado na posição na lista (1-indexed)
                "total_dog": holder["total_dog"]
            }
    
    # Se não encontrou o holder, retorna informações básicas
    return {
        "address": address,
        "utxo_count": 0,
        "ranking": "N/A",
        "total_dog": 0.0
    }


def get_txid_from_block(block_height):
    """Tenta obter o txid de uma transação que contém DOG no bloco"""
    try:
        # Obter hash do bloco
        result = subprocess.run(["bitcoin-cli", "getblockhash", str(block_height)], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            return None
        
        block_hash = result.stdout.strip()
        
        # Obter transações do bloco
        result = subprocess.run(["bitcoin-cli", "getblock", block_hash], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            return None
        
        block_data = json.loads(result.stdout)
        txids = block_data.get("tx", [])
        
        # Retornar a primeira transação (coinbase)
        if txids:
            return txids[0]
        
        return None
        
    except Exception as e:
        print(f"❌ Erro ao obter txid do bloco {block_height}: {e}")
        return None

def detect_transactions(old_utxos, new_utxos, block_height, holders_data):
    """Detecta transações DOG comparando UTXOs"""
    senders = {}
    receivers = {}
    total_dog_moved = 0
    
    # Detectar UTXOs gastos (senders)
    spent_utxos = []
    for outpoint, old_data in old_utxos.items():
        if outpoint not in new_utxos:
            spent_utxos.append(old_data)
            # Resolver endereço do UTXO gasto
            address = get_address_from_outpoint(outpoint)
            if address and address != "unknown" and address not in senders:
                senders[address] = get_holder_info(address, holders_data)
            total_dog_moved += old_data["amount"]
    
    # Detectar UTXOs novos (receivers)
    new_utxos_list = []
    for outpoint, new_data in new_utxos.items():
        if outpoint not in old_utxos:
            new_utxos_list.append(new_data)
            # Resolver endereço para novos UTXOs
            address = get_address_from_outpoint(outpoint)
            if address not in receivers:
                receivers[address] = get_holder_info(address, holders_data)
    
    # Se há atividade, criar transação
    if spent_utxos or new_utxos_list:
        total_dog_formatted = total_dog_moved / (10**DOG_DIVISIBILITY)
        
        # Tentar obter o txid da primeira transação do bloco que contém DOG
        txid = get_txid_from_block(block_height)
        
        return {
            "txid": txid,
            "block": block_height,
            "timestamp": datetime.now().isoformat(),
            "total_dog_moved": total_dog_formatted,
            "total_dog_moved_sats": total_dog_moved,
            "new_utxos": len(new_utxos_list),
            "spent_utxos": len(spent_utxos),
            "senders": list(senders.values()),
            "receivers": list(receivers.values())
        }
    
    return None

def load_last_utxos():
    """Carrega o estado anterior dos UTXOs"""
    if os.path.exists(LAST_UTXOS_FILE):
        with open(LAST_UTXOS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_current_utxos(utxos):
    """Salva o estado atual dos UTXOs"""
    with open(LAST_UTXOS_FILE, 'w') as f:
        json.dump(utxos, f, indent=2)

def load_transactions():
    """Carrega transações existentes"""
    if os.path.exists(TRANSACTIONS_FILE):
        with open(TRANSACTIONS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_transactions(transactions):
    """Salva transações"""
    with open(TRANSACTIONS_FILE, 'w') as f:
        json.dump(transactions, f, indent=2)

def load_holders_data():
    """Carrega dados de holders para ranking"""
    if os.path.exists(HOLDERS_DATA_FILE):
        with open(HOLDERS_DATA_FILE, 'r') as f:
            return json.load(f)
    return {"holders": []}

def reload_backend_data():
    """Solicita recarregamento de dados no backend"""
    print(f"🔄 Solicitando recarregamento de dados no backend...")
    try:
        response = requests.post(BACKEND_RELOAD_URL)
        if response.ok:
            print("✅ Backend recarregado com sucesso!")
            return True
        else:
            print(f"❌ Erro ao recarregar backend: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Erro de conexão ao recarregar backend: {e}")
        return False

def main():
    print("🐕 Detector Simples de Transações DOG")
    print("=" * 50)
    print("Monitora mudanças nos UTXOs DOG")
    print("Pressione Ctrl+C para parar.")
    print("=" * 50)

    last_block_height = None
    all_transactions = load_transactions()
    
    print("🚀 Iniciando detecção de transações DOG")

    while True:
        try:
            current_block_height = get_current_block_height()

            if current_block_height and current_block_height != last_block_height:
                print(f"\n📦 Novo bloco detectado: {current_block_height}")
                
                current_balances = get_ord_balances()
                if not current_balances:
                    time.sleep(30)
                    continue

                current_utxos = get_dog_utxos(current_balances)
                last_utxos = load_last_utxos()
                holders_data = load_holders_data()

                if last_block_height is None:
                    print("📋 Primeira execução - salvando estado inicial")
                else:
                    transaction = detect_transactions(
                        last_utxos, current_utxos, current_block_height, holders_data
                    )
                    
                    if transaction:
                        total_dog = transaction["total_dog_moved"]
                        print(f"🔄 Bloco {current_block_height}: {total_dog:,.5f} DOG movidos")
                        print(f"   📤 {transaction['spent_utxos']} UTXOs gastos")
                        print(f"   📥 {transaction['new_utxos']} UTXOs criados")
                        print(f"   👤 {len(transaction['senders'])} senders")
                        print(f"   👥 {len(transaction['receivers'])} receivers")
                        
                        all_transactions.append(transaction)
                        save_transactions(all_transactions)
                        
                        # Recarregar backend com novas transações
                        reload_backend_data()
                        
                        print(f"💾 {len(all_transactions)} transações salvas")
                    else:
                        print(f"✅ Bloco {current_block_height}: Nenhuma transação DOG detectada.")

                save_current_utxos(current_utxos)
                last_block_height = current_block_height
                print(f"✅ Bloco {current_block_height} processado")

            time.sleep(30)  # Verificar a cada 30 segundos
            
        except KeyboardInterrupt:
            print("\n🛑 Detecção interrompida pelo usuário")
            break
        except Exception as e:
            print(f"❌ Erro inesperado: {e}")
            time.sleep(60)

if __name__ == "__main__":
    main()
