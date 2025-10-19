#!/usr/bin/env python3
"""
Analisador Simples do Último Bloco
- Versão otimizada e rápida
- Foca apenas no essencial
"""

import subprocess
import json
import time
from datetime import datetime

def get_last_block_info():
    """Obtém informações básicas do último bloco"""
    print("🔍 Analisando último bloco...")
    
    try:
        # Obter altura atual
        result = subprocess.run([
            "bitcoin-cli", "getblockcount"
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode != 0:
            print(f"❌ Erro: {result.stderr}")
            return None
        
        block_height = int(result.stdout.strip())
        print(f"📊 Altura atual: {block_height}")
        
        # Obter hash do bloco
        result = subprocess.run([
            "bitcoin-cli", "getblockhash", str(block_height)
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode != 0:
            print(f"❌ Erro ao obter hash: {result.stderr}")
            return None
        
        block_hash = result.stdout.strip()
        print(f"📦 Hash do bloco: {block_hash}")
        
        # Obter informações básicas do bloco
        result = subprocess.run([
            "bitcoin-cli", "getblock", block_hash, "1"
        ], capture_output=True, text=True, timeout=15)
        
        if result.returncode != 0:
            print(f"❌ Erro ao obter bloco: {result.stderr}")
            return None
        
        block_data = json.loads(result.stdout)
        tx_count = len(block_data.get('tx', []))
        
        print(f"📋 Transações no bloco: {tx_count}")
        
        return {
            'height': block_height,
            'hash': block_hash,
            'tx_count': tx_count,
            'timestamp': block_data.get('time', 0)
        }
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        return None

def get_dog_balances():
    """Obtém balances DOG atuais"""
    print("\n🐕 Obtendo balances DOG...")
    
    try:
        result = subprocess.run([
            './target/release/ord', '--data-dir', 'data', 'balances'
        ], cwd='/home/bitmax/Projects/bitcoin-fullstack/ord', 
        capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            print(f"❌ Erro ao obter balances: {result.stderr}")
            return None
        
        balances = json.loads(result.stdout)
        dog_balances = balances.get('runes', {}).get('DOG•GO•TO•THE•MOON', {})
        
        print(f"💰 UTXOs DOG atuais: {len(dog_balances)}")
        
        # Mostrar alguns exemplos
        count = 0
        for utxo_key, utxo_data in dog_balances.items():
            if count >= 3:
                break
            amount = utxo_data.get('amount', 0)
            print(f"   {utxo_key}: {amount/100000:.5f} DOG")
            count += 1
        
        return len(dog_balances)
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        return None

def analyze_sample_transactions(block_height, sample_size=10):
    """Analisa uma amostra de transações do bloco"""
    print(f"\n🔍 Analisando amostra de {sample_size} transações...")
    
    try:
        # Obter hash do bloco
        result = subprocess.run([
            "bitcoin-cli", "getblockhash", str(block_height)
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode != 0:
            return None
        
        block_hash = result.stdout.strip()
        
        # Obter transações do bloco
        result = subprocess.run([
            "bitcoin-cli", "getblock", block_hash, "2"
        ], capture_output=True, text=True, timeout=20)
        
        if result.returncode != 0:
            return None
        
        block_data = json.loads(result.stdout)
        transactions = block_data.get('tx', [])
        
        print(f"📋 Total de transações: {len(transactions)}")
        
        # Analisar amostra
        rune_like_transactions = 0
        for i, txid in enumerate(transactions[:sample_size]):
            print(f"   Analisando {i+1}/{sample_size}: {txid[:16]}...")
            
            # Obter detalhes da transação
            result = subprocess.run([
                "bitcoin-cli", "getrawtransaction", txid, "true"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                tx_data = json.loads(result.stdout)
                
                # Verificar se tem outputs Taproot (potenciais runes)
                has_taproot = False
                for output in tx_data.get('vout', []):
                    if output.get('scriptPubKey', {}).get('type') == 'witness_v1_taproot':
                        has_taproot = True
                        break
                
                if has_taproot:
                    rune_like_transactions += 1
                    print(f"      🔮 Possível transação de rune!")
        
        print(f"🔮 Transações com potencial de rune: {rune_like_transactions}/{sample_size}")
        return rune_like_transactions
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        return None

def main():
    print("🚀 Analisador Simples do Último Bloco")
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 1. Obter informações do último bloco
    block_info = get_last_block_info()
    if not block_info:
        print("❌ Falha ao obter informações do bloco")
        return
    
    # 2. Obter balances DOG
    dog_utxos = get_dog_balances()
    if dog_utxos is None:
        print("❌ Falha ao obter balances DOG")
        return
    
    # 3. Analisar amostra de transações
    rune_transactions = analyze_sample_transactions(block_info['height'], 20)
    
    print("\n🎯 RESUMO:")
    print("=" * 40)
    print(f"📦 Bloco: {block_info['height']}")
    print(f"📋 Total de transações: {block_info['tx_count']}")
    print(f"🐕 UTXOs DOG atuais: {dog_utxos}")
    if rune_transactions is not None:
        print(f"🔮 Transações com runes (amostra): {rune_transactions}")
    
    print("\n💡 PRÓXIMOS PASSOS:")
    print("• Para análise completa, precisamos de mais tempo")
    print("• Podemos focar apenas em transações com outputs Taproot")
    print("• Usar Ord para verificar runes específicas")

if __name__ == "__main__":
    main()


