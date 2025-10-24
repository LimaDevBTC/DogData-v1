#!/usr/bin/env python3
"""
Extrator COMPLETO do Airdrop DOG usando Bitcoin Core + Ord local
Não depende de APIs externas limitadas
"""

import subprocess
import json
import sys
from collections import defaultdict
from datetime import datetime

# Configurações
DISTRIBUTOR_ADDRESS = "bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t"
DOG_RUNE_ID = "1:0"  # DOG•GO•TO•THE•MOON
STANDARD_AIRDROP = 889806
OUTPUT_FILE = "../data/airdrop_recipients.json"

print("=" * 80)
print("🔬 EXTRATOR COMPLETO DO AIRDROP DOG")
print("=" * 80)
print(f"\n📋 Usando Bitcoin Core + Ord local")
print(f"📋 Distribuidor: {DISTRIBUTOR_ADDRESS[:30]}...")
print(f"📋 Rune: DOG•GO•TO•THE•MOON")

# Passo 1: Usar Ord para listar TODOS os outputs DOG
print("\n" + "=" * 80)
print("📊 PASSO 1: Extraindo TODOS os UTXOs DOG do Ord indexer")
print("=" * 80)

print("\n⏳ Consultando Ord... (pode demorar alguns minutos)")

try:
    # Consultar o Ord CLI para listar todos os outputs do rune DOG
    cmd = ["ord", "runes"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    
    if result.returncode != 0:
        print(f"❌ Erro ao consultar Ord: {result.stderr}")
        sys.exit(1)
    
    print("✅ Dados do Ord recuperados")
    
except Exception as e:
    print(f"❌ Erro: {e}")
    sys.exit(1)

# Passo 2: Analisar os outputs e identificar os originais do airdrop
print("\n" + "=" * 80)
print("📊 PASSO 2: Identificando outputs originais do airdrop")
print("=" * 80)

print("\n💡 ESTRATÉGIA ALTERNATIVA:")
print("   Como a API do Mempool.space tem limitações, vamos usar")
print("   um serviço alternativo ou escanear a blockchain localmente")

# Solução mais robusta: usar getrawtransaction do Bitcoin Core
# para cada bloco do período do airdrop

AIRDROP_START_BLOCK = 840654  # Bloco aproximado do início do airdrop
AIRDROP_END_BLOCK = 858370    # Bloco aproximado do fim do airdrop

print(f"\n📍 Período do airdrop:")
print(f"   Bloco inicial: {AIRDROP_START_BLOCK}")
print(f"   Bloco final: {AIRDROP_END_BLOCK}")
print(f"   Total de blocos: {AIRDROP_END_BLOCK - AIRDROP_START_BLOCK}")

print("\n⚠️  AVISO: Escanear todos esses blocos levará muito tempo!")
print("    Melhor solução: usar um explorador alternativo ou API completa")

print("\n" + "=" * 80)
print("💡 RECOMENDAÇÃO:")
print("=" * 80)
print("""
Para extrair TODOS os 112,000 airdrops, precisamos usar uma das seguintes opções:

1. 🌐 API Alternativa: Usar um explorador que retorne TODAS as transações
   - OKX Explorer API
   - Blockchain.info API
   - Blockchair API

2. 🔍 Escanear blockchain local: Iterar por todos os blocos do período
   - Mais lento mas 100% completo
   - Requer processamento de ~18,000 blocos

3. 📊 Usar dados do Ord: O Ord já tem TODOS os runes indexados
   - Mais rápido
   - Requer consultar o banco de dados do Ord diretamente

Para continuar, escolha uma opção acima e implemente a extração completa.
""")
print("=" * 80)

