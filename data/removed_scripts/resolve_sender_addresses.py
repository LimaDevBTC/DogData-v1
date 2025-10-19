#!/usr/bin/env python3
"""
Script para resolver endereços de senders corretamente
"""

import subprocess
import json

def get_sender_address(txid, vout_index):
    """Obtém o endereço de um UTXO gasto"""
    try:
        # 1. Obter a transação raw que CRIOU o UTXO
        result = subprocess.run(["bitcoin-cli", "getrawtransaction", txid], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Erro ao obter transação {txid}: {result.stderr}")
            return None
        
        raw_tx = result.stdout.strip()
        
        # 2. Decodificar a transação
        result = subprocess.run(["bitcoin-cli", "decoderawtransaction", raw_tx], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Erro ao decodificar transação: {result.stderr}")
            return None
        
        tx_data = json.loads(result.stdout)
        
        # 3. Obter o output correspondente
        if vout_index < len(tx_data['vout']):
            vout = tx_data['vout'][vout_index]
            if 'scriptPubKey' in vout and 'address' in vout['scriptPubKey']:
                address = vout['scriptPubKey']['address']
                print(f"✅ Endereço encontrado: {address}")
                return address
            else:
                print(f"❌ Output {vout_index} não tem endereço")
                return None
        else:
            print(f"❌ Output index {vout_index} fora do range")
            return None
        
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")
        return None

def analyze_transaction_senders(txid):
    """Analisa os senders de uma transação"""
    try:
        # 1. Obter a transação que estamos analisando
        result = subprocess.run(["bitcoin-cli", "getrawtransaction", txid], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Erro ao obter transação: {result.stderr}")
            return None
        
        raw_tx = result.stdout.strip()
        
        # 2. Decodificar a transação
        result = subprocess.run(["bitcoin-cli", "decoderawtransaction", raw_tx], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Erro ao decodificar: {result.stderr}")
            return None
        
        tx_data = json.loads(result.stdout)
        
        print(f"\n🔍 Analisando transação: {txid}")
        print(f"📊 Inputs: {len(tx_data['vin'])}")
        print(f"📊 Outputs: {len(tx_data['vout'])}")
        
        # 3. Para cada input, resolver o endereço
        senders = []
        for i, vin in enumerate(tx_data['vin']):
            if 'txid' in vin:
                input_txid = vin['txid']
                input_vout = vin['vout']
                
                print(f"\n  Input {i}: {input_txid}:{input_vout}")
                address = get_sender_address(input_txid, input_vout)
                
                if address:
                    senders.append({
                        "input_index": i,
                        "address": address,
                        "from_txid": input_txid,
                        "from_vout": input_vout
                    })
        
        return senders
        
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")
        return None

def main():
    """Função principal"""
    print("🚀 Resolvendo endereços de senders...")
    
    # Analisar a transação que sabemos que tem DOG
    txid = "89d51802169c5f9fa8c563836bcee38c734e9e02ae194fb8126da2bfae440000"
    
    senders = analyze_transaction_senders(txid)
    
    if senders:
        print(f"\n✅ {len(senders)} senders encontrados:")
        for sender in senders:
            print(f"  - {sender['address']} (input {sender['input_index']})")
    else:
        print(f"\n❌ Nenhum sender encontrado")

if __name__ == "__main__":
    main()


