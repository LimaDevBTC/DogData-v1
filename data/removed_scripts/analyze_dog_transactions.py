#!/usr/bin/env python3
"""
Script para analisar transações DOG usando ord
"""

import subprocess
import json
import sys
import time

def run_ord_command(args):
    """Executa comando ord"""
    try:
        cmd = ["/home/bitmax/Projects/bitcoin-fullstack/ord/target/release/ord", 
               "--data-dir", "/home/bitmax/Projects/bitcoin-fullstack/ord/data"] + args
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            print(f"❌ Erro no comando ord: {result.stderr}")
            return None
    except Exception as e:
        print(f"❌ Erro ao executar comando: {e}")
        return None

def get_transaction_details(txid):
    """Obtém detalhes de uma transação específica usando bitcoin-cli"""
    try:
        # Obter dados brutos da transação
        result = subprocess.run(["bitcoin-cli", "getrawtransaction", txid], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Erro ao obter transação {txid}: {result.stderr}")
            return None
        
        raw_tx = result.stdout.strip()
        
        # Decodificar transação
        result = subprocess.run(["bitcoin-cli", "decoderawtransaction", raw_tx], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Erro ao decodificar transação {txid}: {result.stderr}")
            return None
        
        tx_data = json.loads(result.stdout)
        
        # Analisar inputs e outputs
        print(f"\n🔍 Analisando transação: {txid}")
        print(f"📊 Inputs: {len(tx_data['vin'])}")
        print(f"📊 Outputs: {len(tx_data['vout'])}")
        
        # Analisar inputs
        for i, vin in enumerate(tx_data['vin']):
            if 'txid' in vin:
                print(f"  Input {i}: {vin['txid']}:{vin['vout']}")
                # Tentar obter endereço do input
                try:
                    result = subprocess.run(["bitcoin-cli", "gettxout", vin['txid'], str(vin['vout'])], 
                                          capture_output=True, text=True)
                    if result.returncode == 0 and result.stdout.strip() != 'null':
                        txout = json.loads(result.stdout)
                        if 'address' in txout:
                            print(f"    Endereço: {txout['address']}")
                        else:
                            print(f"    Endereço: Não disponível")
                    else:
                        print(f"    Endereço: UTXO já gasto")
                except:
                    print(f"    Endereço: Erro ao obter")
        
        # Analisar outputs
        for i, vout in enumerate(tx_data['vout']):
            if 'address' in vout:
                print(f"  Output {i}: {vout['address']} - {vout['value']} BTC")
            else:
                print(f"  Output {i}: {vout['scriptPubKey']['type']} - {vout['value']} BTC")
        
        return tx_data
        
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")
        return None

def main():
    """Função principal"""
    print("🚀 Analisando transações DOG...")
    
    # Vamos analisar algumas transações recentes
    try:
        # Obter hash do bloco mais recente
        result = subprocess.run(["bitcoin-cli", "getblockhash", "917250"], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print("❌ Erro ao obter hash do bloco")
            return
        
        block_hash = result.stdout.strip()
        print(f"📦 Hash do bloco 917250: {block_hash}")
        
        # Obter transações do bloco
        result = subprocess.run(["bitcoin-cli", "getblock", block_hash], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print("❌ Erro ao obter bloco")
            return
        
        block_data = json.loads(result.stdout)
        txids = block_data.get("tx", [])
        
        print(f"📊 Bloco contém {len(txids)} transações")
        
        # Analisar algumas transações
        for i, txid in enumerate(txids[:3]):
            print(f"\n{'='*60}")
            print(f"Transação {i+1}: {txid}")
            print(f"{'='*60}")
            get_transaction_details(txid)
            time.sleep(1)  # Pausa para não sobrecarregar
            
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")

if __name__ == "__main__":
    main()