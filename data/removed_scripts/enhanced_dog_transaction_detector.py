#!/usr/bin/env python3
"""
Detector de Transações DOG Aprimorado
- Calcula quantidade de DOG movida
- Inclui endereços de sender/receiver
- Adiciona ranking de holders
- Sistema baseado em ord balances
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
ENHANCED_TRANSACTIONS_FILE = "/home/bitmax/Projects/bitcoin-fullstack/enhanced_dog_transactions.json"
LAST_BALANCES_FILE = "/tmp/last_dog_balances_enhanced.json"
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

def load_last_balances():
    """Carrega o estado anterior dos balances"""
    if os.path.exists(LAST_BALANCES_FILE):
        with open(LAST_BALANCES_FILE, 'r') as f:
            return json.load(f)
    return {"outputs": []}

def save_current_balances(balances):
    """Salva o estado atual dos balances"""
    with open(LAST_BALANCES_FILE, 'w') as f:
        json.dump(balances, f, indent=2)

def load_enhanced_transactions():
    """Carrega transações existentes"""
    if os.path.exists(ENHANCED_TRANSACTIONS_FILE):
        with open(ENHANCED_TRANSACTIONS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_enhanced_transactions(transactions):
    """Salva transações aprimoradas"""
    with open(ENHANCED_TRANSACTIONS_FILE, 'w') as f:
        json.dump(transactions, f, indent=2)

def load_holders_data():
    """Carrega dados de holders para ranking"""
    if os.path.exists(HOLDERS_DATA_FILE):
        with open(HOLDERS_DATA_FILE, 'r') as f:
            return json.load(f)
    return {"holders": []}

def get_utxo_map(balances_data):
    """Cria mapa de UTXOs com endereços e quantidades"""
    utxo_map = {}
    dog_runes = balances_data.get("runes", {}).get(DOG_RUNE_ID, {})
    for outpoint, utxo_data in dog_runes.items():
        # Precisamos resolver o endereço do outpoint
        address = get_address_from_outpoint(outpoint)
        utxo_map[outpoint] = {
            "address": address,
            "amount": utxo_data["amount"]
        }
    return utxo_map

def get_holder_info(address, holders_data):
    """Obtém informações do holder incluindo ranking"""
    for holder in holders_data.get("holders", []):
        if holder["address"] == address:
            return {
                "address": address,
                "utxo_count": holder["utxo_count"],
                "ranking": holder["ranking"],
                "total_dog": holder["total_dog"]
            }
    return {
        "address": address,
        "utxo_count": 0,
        "ranking": "N/A",
        "total_dog": 0.0
    }

def detect_enhanced_dog_transactions(old_utxos, new_utxos, block_height, holders_data):
    """Detecta transações DOG com detalhes aprimorados"""
    senders = {}
    receivers = {}
    total_dog_moved = 0
    
    # Detectar UTXOs gastos (senders)
    spent_utxos = []
    for outpoint, old_data in old_utxos.items():
        if outpoint not in new_utxos:
            spent_utxos.append(old_data)
            sender_address = old_data["address"]
            if sender_address not in senders:
                senders[sender_address] = get_holder_info(sender_address, holders_data)
            total_dog_moved += old_data["amount"]
    
    # Detectar UTXOs novos (receivers)
    new_utxos_list = []
    for outpoint, new_data in new_utxos.items():
        if outpoint not in old_utxos:
            new_utxos_list.append(new_data)
            receiver_address = new_data["address"]
            if receiver_address not in receivers:
                receivers[receiver_address] = get_holder_info(receiver_address, holders_data)
    
    # Se há atividade, criar transação
    if spent_utxos or new_utxos_list:
        total_dog_formatted = total_dog_moved / (10**DOG_DIVISIBILITY)
        
        return {
            "block": block_height,
            "timestamp": datetime.now().isoformat(),
            "total_dog_moved": total_dog_formatted,
            "total_dog_moved_sats": total_dog_moved,
            "new_utxos": len(new_utxos_list),
            "spent_utxos": len(spent_utxos),
            "senders": list(senders.values()),
            "receivers": list(receivers.values()),
            "details": {
                "spent_utxos": [{"outpoint": k, "address": v["address"], "amount": v["amount"]} 
                               for k, v in old_utxos.items() if k not in new_utxos],
                "new_utxos": [{"outpoint": k, "address": v["address"], "amount": v["amount"]} 
                             for k, v in new_utxos.items() if k not in old_utxos]
            }
        }
    
    return None

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
    print("🐕 Detector de Transações DOG (Aprimorado)")
    print("=" * 60)
    print("Este script monitora mudanças nos UTXOs DOG")
    print("e detecta transações com detalhes de DOG movida.")
    print("Pressione Ctrl+C para parar.")
    print("=" * 60)

    last_block_height = None
    all_enhanced_transactions = load_enhanced_transactions()
    
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

                current_utxo_map = get_utxo_map(current_balances)
                last_utxo_map = load_last_balances()
                holders_data = load_holders_data()

                if last_block_height is None:
                    print("📋 Primeira execução - salvando estado inicial")
                else:
                    transaction = detect_enhanced_dog_transactions(
                        last_utxo_map, current_utxo_map, current_block_height, holders_data
                    )
                    
                    if transaction:
                        total_dog = transaction["total_dog_moved"]
                        print(f"🔄 Bloco {current_block_height}: {total_dog:,.5f} DOG movidos")
                        print(f"   📤 {transaction['spent_utxos']} UTXOs gastos")
                        print(f"   📥 {transaction['new_utxos']} UTXOs criados")
                        
                        all_enhanced_transactions.append(transaction)
                        save_enhanced_transactions(all_enhanced_transactions)
                        
                        # Recarregar backend com novas transações
                        reload_backend_data()
                        
                        print(f"💾 {len(all_enhanced_transactions)} transações salvas")
                    else:
                        print(f"✅ Bloco {current_block_height}: Nenhuma transação DOG detectada.")

                save_current_balances(current_utxo_map)
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