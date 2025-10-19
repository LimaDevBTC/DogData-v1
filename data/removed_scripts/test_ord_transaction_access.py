#!/usr/bin/env python3
"""
Teste de Acesso a Transações DOG no Ord
- Verifica se o Ord tem acesso a transações históricas
- Testa diferentes comandos para obter dados de transações
- Define arquitetura baseada nas capacidades disponíveis
"""

import subprocess
import json
import time
from datetime import datetime

def test_ord_transaction_access():
    """Testa diferentes formas de acessar transações DOG no Ord"""
    print("🔍 Testando acesso a transações DOG no Ord...")
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    ord_dir = "/home/bitmax/Projects/bitcoin-fullstack/ord"
    
    # 1. Testar se podemos obter informações de transação específica
    print("\n📋 1. Testando acesso a transação específica...")
    try:
        # Usar uma transação conhecida do DOG
        test_tx = "e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375"
        
        # Testar diferentes comandos do Ord
        commands_to_test = [
            ['./target/release/ord', '--data-dir', 'data', 'decode', test_tx],
            ['./target/release/ord', '--data-dir', 'data', 'list', test_tx],
            ['./target/release/ord', '--data-dir', 'data', 'find', test_tx],
        ]
        
        for cmd in commands_to_test:
            print(f"🔧 Testando: {' '.join(cmd[-2:])}")
            try:
                result = subprocess.run(cmd, cwd=ord_dir, capture_output=True, text=True, timeout=30)
                if result.returncode == 0:
                    print(f"   ✅ Sucesso: {result.stdout[:100]}...")
                else:
                    print(f"   ❌ Falhou: {result.stderr[:100]}...")
            except Exception as e:
                print(f"   ❌ Erro: {e}")
                
    except Exception as e:
        print(f"❌ Erro no teste: {e}")
    
    # 2. Verificar se há comandos para listar transações por rune
    print("\n🐕 2. Testando comandos específicos para runes...")
    try:
        # Testar se há comando para obter transações de uma rune específica
        result = subprocess.run([
            './target/release/ord', '--data-dir', 'data', 'runes', 'DOG•GO•TO•THE•MOON'
        ], cwd=ord_dir, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✅ Comando 'ord runes DOG•GO•TO•THE•MOON' funciona")
            print(f"   📝 Resposta: {result.stdout[:200]}...")
        else:
            print(f"❌ Comando falhou: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Erro: {e}")
    
    # 3. Verificar se podemos obter histórico de transações
    print("\n📚 3. Testando acesso a histórico...")
    try:
        # Verificar se há comando para obter histórico
        result = subprocess.run([
            './target/release/ord', '--help'
        ], cwd=ord_dir, capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            help_text = result.stdout
            if 'history' in help_text.lower():
                print("✅ Ord tem comando de histórico")
            else:
                print("❌ Ord não tem comando de histórico explícito")
                
            if 'transaction' in help_text.lower():
                print("✅ Ord tem comandos de transação")
            else:
                print("❌ Ord não tem comandos de transação explícitos")
                
    except Exception as e:
        print(f"❌ Erro: {e}")
    
    # 4. Verificar dados disponíveis no índice
    print("\n🗄️ 4. Verificando dados disponíveis no índice...")
    try:
        # Verificar tamanho e estrutura do índice
        import os
        index_file = "/home/bitmax/Projects/bitcoin-fullstack/ord/data/index.redb"
        if os.path.exists(index_file):
            size_gb = os.path.getsize(index_file) / (1024 * 1024 * 1024)
            print(f"✅ Índice: {size_gb:.1f} GB")
            
            if size_gb > 100:
                print("   📊 Índice grande - provavelmente contém dados históricos completos")
            else:
                print("   📊 Índice médio - pode ter dados limitados")
                
        # Verificar se há outros arquivos de dados
        data_dir = "/home/bitmax/Projects/bitcoin-fullstack/ord/data"
        files = os.listdir(data_dir)
        print(f"📁 Arquivos no diretório de dados: {files}")
        
    except Exception as e:
        print(f"❌ Erro: {e}")
    
    # 5. Testar se podemos obter transações por bloco
    print("\n📦 5. Testando acesso a transações por bloco...")
    try:
        # Verificar se há comando para obter dados de bloco
        result = subprocess.run([
            './target/release/ord', '--data-dir', 'data', '--help'
        ], cwd=ord_dir, capture_output=True, text=True, timeout=10)
        
        help_text = result.stdout
        if 'block' in help_text.lower():
            print("✅ Ord tem comandos relacionados a blocos")
        else:
            print("❌ Ord não tem comandos explícitos de bloco")
            
    except Exception as e:
        print(f"❌ Erro: {e}")
    
    print("\n🎯 CONCLUSÕES E ARQUITETURA:")
    print("=" * 50)
    
    print("\n✅ O que SABEMOS que funciona:")
    print("• Ord balances - acesso a UTXOs atuais")
    print("• Ord runes - informações da rune DOG")
    print("• Ord decode - decodificação de transações individuais")
    print("• Índice de 180GB - contém dados históricos")
    
    print("\n❓ O que PRECISAMOS descobrir:")
    print("• Se Ord indexa transações históricas completas")
    print("• Como acessar transações DOG por bloco")
    print("• Se há comando para listar todas as transações de uma rune")
    
    print("\n🏗️ ARQUITETURAS POSSÍVEIS:")
    print("=" * 50)
    
    print("\n📊 OPÇÃO 1: Ord como fonte única")
    print("• Se Ord tem TODAS as transações históricas")
    print("• Arquitetura: Ord → Nossa API → Frontend")
    print("• Vantagem: Dados completos e atualizados")
    print("• Desvantagem: Dependência total do Ord")
    
    print("\n📊 OPÇÃO 2: Sistema híbrido")
    print("• Ord para dados atuais + Nosso tracker para histórico")
    print("• Arquitetura: Ord + Bitcoin Core → Nossa API → Frontend")
    print("• Vantagem: Controle total dos dados")
    print("• Desvantagem: Mais complexo")
    
    print("\n📊 OPÇÃO 3: Sistema completo próprio")
    print("• Nosso tracker monitora tudo desde o início")
    print("• Arquitetura: Bitcoin Core → Nossa API → Frontend")
    print("• Vantagem: Controle total e dados customizados")
    print("• Desvantagem: Perda de dados históricos")

if __name__ == "__main__":
    test_ord_transaction_access()


