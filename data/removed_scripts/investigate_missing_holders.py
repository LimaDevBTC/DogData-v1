#!/usr/bin/env python3
import subprocess
import json
import sys
from collections import defaultdict

def get_address_from_utxo(txid, output):
    """Obtém o endereço de um UTXO específico"""
    try:
        result = subprocess.run(['bitcoin-cli', 'gettxout', txid, output], 
                              capture_output=True, text=True, timeout=15)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data['scriptPubKey']['address']
    except Exception as e:
        print(f"Erro ao resolver {txid}:{output} - {e}")
    return None

def investigate_missing_holders():
    """Investiga holders faltantes"""
    print("🔍 Investigando holders faltantes...")
    
    # Obter dados de balance
    print("📊 Carregando dados de balance...")
    result = subprocess.run(['./target/release/ord', '--data-dir', 'data', 'balances'], 
                          capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"❌ Erro ao obter dados: {result.stderr}")
        return
    
    balances = json.loads(result.stdout)
    dog_runes = balances['runes']['DOG•GO•TO•THE•MOON']
    
    print(f"📊 Total de UTXOs com DOG: {len(dog_runes)}")
    
    # Analisar tipos de endereços
    address_types = defaultdict(int)
    unresolved_utxos = []
    resolved_addresses = defaultdict(int)
    
    processed = 0
    errors = 0
    
    for utxo_key, rune_data in dog_runes.items():
        if rune_data['amount'] > 0:
            txid, output = utxo_key.split(':')
            address = get_address_from_utxo(txid, output)
            
            if address:
                if address.startswith('bc1p'):
                    address_types['taproot'] += 1
                elif address.startswith('bc1q'):
                    address_types['segwit_v0'] += 1
                elif address.startswith('bc1'):
                    address_types['segwit_unknown'] += 1
                elif address.startswith('1'):
                    address_types['legacy'] += 1
                elif address.startswith('3'):
                    address_types['p2sh'] += 1
                else:
                    address_types['other'] += 1
                
                resolved_addresses[address] += rune_data['amount']
            else:
                unresolved_utxos.append((utxo_key, rune_data['amount']))
                errors += 1
            
            processed += 1
            if processed % 10000 == 0:
                print(f"⏳ Processados {processed}/{len(dog_runes)} UTXOs... (Erros: {errors})")
    
    print(f"\n📊 Análise de tipos de endereços:")
    for addr_type, count in address_types.items():
        print(f"  {addr_type}: {count}")
    
    print(f"\n❌ UTXOs não resolvidos: {len(unresolved_utxos)}")
    print(f"✅ Endereços únicos resolvidos: {len(resolved_addresses)}")
    
    # Mostrar alguns UTXOs não resolvidos
    if unresolved_utxos:
        print(f"\n🔍 Primeiros 10 UTXOs não resolvidos:")
        for utxo, amount in unresolved_utxos[:10]:
            print(f"  {utxo}: {amount/100000:.5f} DOG")
    
    # Verificar endereço específico mencionado
    target_address = 'bc1qj7dam98j6ktjcp320qu77y2vrylv49c2k2hkmu'
    if target_address in resolved_addresses:
        print(f"\n🎯 Endereço encontrado: {target_address} com {resolved_addresses[target_address]/100000:.5f} DOG")
    else:
        print(f"\n❌ Endereço {target_address} NÃO encontrado")
    
    # Salvar dados para análise
    analysis_data = {
        'total_utxos': len(dog_runes),
        'resolved_addresses': len(resolved_addresses),
        'unresolved_utxos': len(unresolved_utxos),
        'address_types': dict(address_types),
        'unresolved_sample': unresolved_utxos[:50]
    }
    
    with open('holders_analysis.json', 'w') as f:
        json.dump(analysis_data, f, indent=2)
    
    print(f"\n💾 Análise salva em holders_analysis.json")

if __name__ == "__main__":
    investigate_missing_holders()
