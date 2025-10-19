#!/usr/bin/env python3
"""
Script para explorar transações DOG usando ord
"""

import subprocess
import json
import sys

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
    """Obtém detalhes de uma transação específica"""
    print(f"🔍 Analisando transação: {txid}")
    
    # Tentar decodificar a transação
    output = run_ord_command(["decode", txid])
    if output:
        print(f"✅ Decodificação bem-sucedida:")
        print(output)
        return output
    else:
        print(f"❌ Falha ao decodificar transação {txid}")
        return None

def main():
    """Função principal"""
    print("🚀 Explorando transações DOG com ord...")
    
    # Vamos tentar analisar uma transação conhecida
    # Primeiro, vamos pegar uma transação recente
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
        
        # Analisar as primeiras 5 transações
        for i, txid in enumerate(txids[:5]):
            print(f"\n--- Transação {i+1}: {txid} ---")
            get_transaction_details(txid)
            
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")

if __name__ == "__main__":
    main()

