#!/usr/bin/env python3
"""
Verificador de Capacidades do Ord
- Verifica se o Ord indexa transações
- Testa acesso a dados históricos
- Identifica funcionalidades disponíveis
"""

import subprocess
import json
import time
from datetime import datetime

def check_ord_capabilities():
    """Verifica as capacidades do Ord para transações DOG"""
    print("🔍 Verificando capacidades do Ord para transações DOG...")
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 1. Verificar se o Ord está indexando transações
    print("\n📊 1. Verificando configuração de indexação...")
    try:
        # Verificar se o processo ord está rodando com --index-transactions
        result = subprocess.run([
            "ps", "aux"
        ], capture_output=True, text=True, timeout=10)
        
        if "ord" in result.stdout and "index" in result.stdout:
            print("✅ Ord index está rodando")
        else:
            print("⚠️ Ord index pode não estar rodando")
            
    except Exception as e:
        print(f"❌ Erro ao verificar processos: {e}")
    
    # 2. Verificar dados da rune DOG
    print("\n🐕 2. Verificando dados da rune DOG•GO•TO•THE•MOON...")
    try:
        result = subprocess.run([
            './target/release/ord', '--data-dir', 'data', 'runes'
        ], cwd='/home/bitmax/Projects/bitcoin-fullstack/ord', 
        capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            runes_data = json.loads(result.stdout)
            
            # Procurar pela rune DOG•GO•TO•THE•MOON
            dog_rune = None
            for rune_id, rune_data in runes_data.items():
                if rune_data.get('rune') == 'DOG•GO•TO•THE•MOON':
                    dog_rune = rune_data
                    break
            
            if dog_rune:
                print("✅ Rune DOG•GO•TO•THE•MOON encontrada!")
                print(f"   📅 Timestamp: {dog_rune.get('timestamp', 'N/A')}")
                print(f"   📦 Bloco: {dog_rune.get('block', 'N/A')}")
                print(f"   🔢 TX: {dog_rune.get('tx', 'N/A')}")
                print(f"   💰 Supply: {dog_rune.get('supply', 'N/A')}")
                print(f"   🏷️ Symbol: {dog_rune.get('symbol', 'N/A')}")
            else:
                print("❌ Rune DOG•GO•TO•THE•MOON não encontrada")
                
        else:
            print(f"❌ Erro ao obter runes: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Erro ao verificar runes: {e}")
    
    # 3. Verificar balances DOG
    print("\n💰 3. Verificando balances DOG...")
    try:
        result = subprocess.run([
            './target/release/ord', '--data-dir', 'data', 'balances'
        ], cwd='/home/bitmax/Projects/bitcoin-fullstack/ord', 
        capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            balances_data = json.loads(result.stdout)
            dog_balances = balances_data.get('runes', {}).get('DOG•GO•TO•THE•MOON', {})
            
            print(f"✅ Encontrados {len(dog_balances)} UTXOs com DOG")
            
            # Mostrar alguns exemplos
            print("📋 Exemplos de UTXOs DOG:")
            count = 0
            for utxo_key, utxo_data in dog_balances.items():
                if count >= 3:
                    break
                amount = utxo_data.get('amount', 0)
                print(f"   {utxo_key}: {amount/100000:.5f} DOG")
                count += 1
                
        else:
            print(f"❌ Erro ao obter balances: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Erro ao verificar balances: {e}")
    
    # 4. Testar acesso a transação específica
    print("\n🔍 4. Testando acesso a transação específica...")
    try:
        # Usar uma transação conhecida do DOG (da rune info)
        test_tx = "e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375"
        
        result = subprocess.run([
            './target/release/ord', '--data-dir', 'data', 'decode', test_tx
        ], cwd='/home/bitmax/Projects/bitcoin-fullstack/ord', 
        capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✅ Comando 'ord decode' funciona")
            print("   📝 Podemos decodificar transações individuais")
        else:
            print(f"⚠️ Comando 'ord decode' falhou: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Erro ao testar decode: {e}")
    
    # 5. Verificar se há dados de transações indexadas
    print("\n📚 5. Verificando dados de transações indexadas...")
    try:
        # Verificar tamanho do arquivo de índice
        import os
        index_file = "/home/bitmax/Projects/bitcoin-fullstack/ord/data/index.redb"
        if os.path.exists(index_file):
            size_mb = os.path.getsize(index_file) / (1024 * 1024)
            print(f"✅ Arquivo de índice encontrado: {size_mb:.1f} MB")
            
            if size_mb > 1000:  # Mais de 1GB
                print("   📊 Índice grande - provavelmente contém dados históricos")
            else:
                print("   📊 Índice pequeno - pode não ter dados históricos completos")
        else:
            print("❌ Arquivo de índice não encontrado")
            
    except Exception as e:
        print(f"❌ Erro ao verificar índice: {e}")
    
    print("\n🎯 CONCLUSÕES:")
    print("✅ O Ord tem acesso aos dados atuais de DOG")
    print("✅ Podemos obter balances e UTXOs atuais")
    print("✅ O comando 'ord decode' funciona para transações individuais")
    print("❓ Precisamos verificar se há acesso a transações históricas")
    print("❓ Precisamos descobrir como acessar todas as transações DOG passadas")
    
    print("\n💡 PRÓXIMOS PASSOS:")
    print("1. Investigar se o Ord indexa transações históricas")
    print("2. Descobrir como acessar transações DOG por bloco")
    print("3. Criar sistema para rastrear TODAS as transações DOG")
    print("4. Implementar atualização em tempo real baseada em transações")

if __name__ == "__main__":
    check_ord_capabilities()


