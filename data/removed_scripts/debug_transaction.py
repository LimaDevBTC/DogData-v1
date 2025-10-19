#!/usr/bin/env python3
"""
Script para debugar transação específica e entender o que está acontecendo
"""

import json
import subprocess

def get_ord_balances():
    """Obtém dados de balances do Ord"""
    try:
        result = subprocess.run(
            ["/home/bitmax/Projects/bitcoin-fullstack/ord/target/release/ord", 
             "--data-dir", "/home/bitmax/Projects/bitcoin-fullstack/ord/data", "balances"],
            capture_output=True, text=True, check=True
        )
        return json.loads(result.stdout)
    except Exception as e:
        print(f"❌ Erro ao executar 'ord balances': {e}")
        return None

def get_utxo_map(balances_data):
    """Converte dados de balances em mapa de UTXOs"""
    utxo_map = {}
    dog_runes = balances_data.get("runes", {}).get("DOG•GO•TO•THE•MOON", {})
    for outpoint, utxo_data in dog_runes.items():
        utxo_map[outpoint] = {
            "address": "unknown",  # Precisamos resolver o endereço
            "amount": utxo_data["amount"]
        }
    return utxo_map

def analyze_transaction():
    """Analisa a transação atual em detalhes"""
    print("🔍 Analisando transação DOG em detalhes...")
    
    # Carregar dados atuais
    current_balances = get_ord_balances()
    if not current_balances:
        print("❌ Não foi possível obter dados de balances")
        return
    
    current_utxos = get_utxo_map(current_balances)
    print(f"📊 Total de UTXOs DOG atuais: {len(current_utxos)}")
    
    # Carregar transação detectada
    try:
        with open("/home/bitmax/Projects/bitcoin-fullstack/enhanced_dog_transactions.json", "r") as f:
            transactions = json.load(f)
        
        if not transactions:
            print("❌ Nenhuma transação encontrada")
            return
            
        latest_transaction = transactions[-1]
        print(f"\n📋 Última transação detectada:")
        print(f"   Bloco: {latest_transaction['block']}")
        print(f"   Timestamp: {latest_transaction['timestamp']}")
        print(f"   UTXOs gastos: {latest_transaction['spent_utxos']}")
        print(f"   UTXOs criados: {latest_transaction['new_utxos']}")
        print(f"   Senders: {len(latest_transaction['senders'])}")
        print(f"   Receivers: {len(latest_transaction['receivers'])}")
        
        print(f"\n📤 Receivers detalhados:")
        for i, receiver in enumerate(latest_transaction['receivers']):
            print(f"   {i+1}. {receiver['address'][:20]}...")
            print(f"      UTXOs: {receiver['utxo_count']}")
            print(f"      DOG: {receiver['total_dog']}")
            print(f"      Ranking: {receiver['ranking']}")
        
        # Verificar se os receivers estão nos UTXOs atuais
        print(f"\n🔍 Verificando receivers nos UTXOs atuais:")
        for receiver in latest_transaction['receivers']:
            address = receiver['address']
            utxos_count = sum(1 for utxo in current_utxos.values() if utxo['address'] == address)
            print(f"   {address[:20]}...: {utxos_count} UTXOs encontrados")
            
            # Mostrar alguns UTXOs desse endereço
            address_utxos = [utxo for utxo in current_utxos.items() if utxo[1]['address'] == address]
            if address_utxos:
                print(f"      Primeiros UTXOs:")
                for outpoint, utxo_data in address_utxos[:3]:
                    amount_dog = utxo_data['amount'] / (10**5)
                    print(f"        {outpoint}: {amount_dog:.5f} DOG")
        
    except Exception as e:
        print(f"❌ Erro ao analisar transação: {e}")

if __name__ == "__main__":
    analyze_transaction()

