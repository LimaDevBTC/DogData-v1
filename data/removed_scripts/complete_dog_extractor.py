#!/usr/bin/env python3
import subprocess
import json
import sys
from collections import defaultdict

def get_address_from_utxo(txid, output):
    """Obtém o endereço de um UTXO específico usando gettxout"""
    try:
        result = subprocess.run(['bitcoin-cli', 'gettxout', txid, output], 
                              capture_output=True, text=True, timeout=15)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data['scriptPubKey']['address']
    except Exception as e:
        print(f"Erro ao resolver {txid}:{output} - {e}")
    return None

def extract_dog_holders():
    """Extrai holders de DOG agrupados por endereço"""
    print("🔍 Extraindo dados de DOG do indexador...")
    
    # Obter dados de balance
    print("📊 Carregando dados de balance...")
    result = subprocess.run(['./target/release/ord', '--data-dir', 'data', 'balances'], 
                          capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"❌ Erro ao obter dados: {result.stderr}")
        return
    
    balances = json.loads(result.stdout)
    dog_runes = balances['runes']['DOG•GO•TO•THE•MOON']
    
    print(f"📊 Encontrados {len(dog_runes)} UTXOs com DOG")
    
    # Agrupar por endereço
    address_balances = defaultdict(int)
    processed = 0
    errors = 0
    
    for utxo_key, rune_data in dog_runes.items():
        if rune_data['amount'] > 0:
            txid, output = utxo_key.split(':')
            address = get_address_from_utxo(txid, output)
            
            if address:
                address_balances[address] += rune_data['amount']
            else:
                errors += 1
            
            processed += 1
            if processed % 10000 == 0:
                print(f"⏳ Processados {processed}/{len(dog_runes)} UTXOs... (Erros: {errors})")
    
    # Converter para lista e ordenar
    holders = []
    for address, total_amount in address_balances.items():
        holders.append({
            'address': address,
            'total_amount': total_amount,
            'total_dog': total_amount / 100000
        })
    
    holders.sort(key=lambda x: x['total_amount'], reverse=True)
    
    print(f"✅ Encontrados {len(holders)} holders únicos")
    print(f"❌ UTXOs não resolvidos: {errors}")
    print("🏆 Top 10 holders:")
    for i, holder in enumerate(holders[:10]):
        print(f"{i+1}. {holder['address']}: {holder['total_dog']:.5f} DOG")
    
    # Verificar endereço específico mencionado
    target_address = 'bc1qj7dam98j6ktjcp320qu77y2vrylv49c2k2hkmu'
    target_holder = next((h for h in holders if h['address'] == target_address), None)
    if target_holder:
        print(f"🎯 Endereço encontrado: {target_holder['address']} com {target_holder['total_dog']:.5f} DOG")
    else:
        print(f"❌ Endereço {target_address} não encontrado")
    
    # Salvar dados
    output_data = {
        'timestamp': subprocess.run(['date', '-Iseconds'], capture_output=True, text=True).stdout.strip(),
        'total_holders': len(holders),
        'total_utxos': len(dog_runes),
        'unresolved_utxos': errors,
        'holders': holders
    }
    
    with open('../DogData-v1/backend/data/dog_holders_by_address.json', 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"💾 Dados salvos em ../DogData-v1/backend/data/dog_holders_by_address.json")
    print(f"📊 Resumo: {len(holders)} holders únicos de {len(dog_runes)} UTXOs")

if __name__ == "__main__":
    extract_dog_holders()
