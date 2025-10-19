#!/usr/bin/env python3
"""
Contador de UTXOs DOG
- Analisa o arquivo completo de balances do Ord
- Conta todos os UTXOs de DOG•GO•TO•THE•MOON
"""

import json
import sys

def count_dog_utxos():
    """Conta UTXOs DOG no arquivo de balances"""
    try:
        print("🔍 Carregando dados do Ord...")
        
        # Carregar dados JSON
        with open('/tmp/ord_balances.json', 'r') as f:
            data = json.load(f)
        
        print("📊 Dados carregados com sucesso!")
        
        # Obter dados de DOG
        runes = data.get('runes', {})
        dog_data = runes.get('DOG•GO•TO•THE•MOON', {})
        
        total_utxos = len(dog_data)
        
        print(f"🐕 Total de UTXOs DOG: {total_utxos}")
        
        # Mostrar alguns exemplos
        print("\n📋 Exemplos de UTXOs DOG:")
        count = 0
        for utxo_key, utxo_data in dog_data.items():
            if count >= 10:
                break
            amount = utxo_data.get('amount', 0)
            dog_amount = amount / 100000  # Divisibilidade 5
            print(f"   {utxo_key}: {dog_amount:.5f} DOG")
            count += 1
        
        # Calcular total de DOG
        total_dog = sum(utxo_data.get('amount', 0) for utxo_data in dog_data.values())
        total_dog_formatted = total_dog / 100000
        
        print(f"\n💰 Total de DOG em circulação: {total_dog_formatted:,.5f} DOG")
        
        return total_utxos, total_dog_formatted
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        return None, None

if __name__ == "__main__":
    utxos, total_dog = count_dog_utxos()
    
    if utxos:
        print(f"\n🎯 RESULTADO FINAL:")
        print(f"   📊 UTXOs DOG: {utxos:,}")
        print(f"   💰 Total DOG: {total_dog:,.5f}")
    else:
        print("❌ Falha ao contar UTXOs DOG")


