#!/usr/bin/env python3
"""
Extrator usando Bitcoin Core LOCAL
Usa bitcoin-cli para buscar dados diretamente da blockchain
"""

import subprocess
import json
import sys
from collections import defaultdict

AIRDROP_RECIPIENTS_FILE = "../data/airdrop_recipients.json"
OUTPUT_FILE = "../data/airdrop_recipients_exact.json"
AIRDROP_BLOCKS = [840654, 840655, 840656, 840657, 840658, 850677, 858368]
AIRDROP_AMOUNT = 889806

print("=" * 80)
print("🎯 EXTRATOR USANDO BITCOIN CORE LOCAL")
print("=" * 80)

# Carregar recipients
print("\n📂 Carregando recipients...")
with open(AIRDROP_RECIPIENTS_FILE, 'r') as f:
    data = json.load(f)
    recipients_list = data['recipients']

# Criar mapa de recipients para busca rápida
recipients_map = {r['address']: {'receive_count': 0, 'txs': []} for r in recipients_list}

print(f"✅ {len(recipients_list):,} recipients carregados")

print(f"\n📋 ESTRATÉGIA:")
print(f"   1. Escanear os {len(AIRDROP_BLOCKS)} blocos do airdrop")
print(f"   2. Para cada TX, verificar se algum recipient está nos outputs")
print(f"   3. Contar quantos outputs cada recipient recebeu")
print(f"   4. Cada output = 1 airdrop de {AIRDROP_AMOUNT:,} DOG")

print(f"\n⏱️  Tempo estimado: ~5-10 minutos")
print(f"🚀 Iniciando extração...\n", flush=True)

total_outputs_found = 0
blocks_processed = 0

for block_height in AIRDROP_BLOCKS:
    print(f"📦 Processando bloco {block_height}...", end=" ", flush=True)
    
    try:
        # Obter hash do bloco
        cmd_hash = ['bitcoin-cli', 'getblockhash', str(block_height)]
        result = subprocess.run(cmd_hash, capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            print(f"❌ Erro ao obter hash")
            continue
        
        block_hash = result.stdout.strip()
        
        # Obter bloco completo com transações
        cmd_block = ['bitcoin-cli', 'getblock', block_hash, '2']
        result = subprocess.run(cmd_block, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            print(f"❌ Erro ao obter bloco")
            continue
        
        block = json.loads(result.stdout)
        txs_in_block = len(block.get('tx', []))
        outputs_in_block = 0
        
        # Processar cada transação do bloco
        for tx in block.get('tx', []):
            txid = tx['txid']
            
            # Verificar cada output
            for vout in tx.get('vout', []):
                script_pub_key = vout.get('scriptPubKey', {})
                recipient_addr = script_pub_key.get('address')
                addresses = script_pub_key.get('addresses', [])
                
                if not recipient_addr and addresses:
                    recipient_addr = addresses[0]
                
                # Verificar se este endereço é um recipient do airdrop
                if recipient_addr in recipients_map:
                    recipients_map[recipient_addr]['receive_count'] += 1
                    recipients_map[recipient_addr]['txs'].append({
                        'tx': txid,
                        'block': block_height,
                        'vout': vout.get('n')
                    })
                    outputs_in_block += 1
                    total_outputs_found += 1
        
        blocks_processed += 1
        print(f"✅ {txs_in_block} TXs, {outputs_in_block} outputs para recipients", flush=True)
        
    except Exception as e:
        print(f"❌ Erro: {e}", flush=True)
        continue

print(f"\n{'='*80}")
print(f"📊 SCAN COMPLETO!")
print(f"{'='*80}")
print(f"   Blocos processados: {blocks_processed}")
print(f"   Total de outputs encontrados: {total_outputs_found:,}")

# Preparar resultados
results = []
multi_count = 0

for addr, data in recipients_map.items():
    count = data['receive_count']
    results.append({
        'address': addr,
        'receive_count': count,
        'airdrop_amount': count * AIRDROP_AMOUNT,
        'airdrop_txs': data['txs']
    })
    
    if count > 1:
        multi_count += 1

# Ordenar por receive_count
results.sort(key=lambda x: x['receive_count'], reverse=True)
for i, r in enumerate(results, 1):
    r['rank'] = i

print(f"\n📊 ESTATÍSTICAS:")
print(f"   Recipients com airdrops: {sum(1 for r in results if r['receive_count'] > 0):,}")
print(f"   Recipients com múltiplos airdrops: {multi_count:,}")
print(f"   Total de airdrops distribuídos: {sum(r['receive_count'] for r in results):,}")

# Salvar
output_data = {
    'timestamp': subprocess.run(['date', '-Iseconds'], capture_output=True, text=True).stdout.strip(),
    'extraction_method': 'bitcoin_core_local_scan',
    'airdrop_blocks': AIRDROP_BLOCKS,
    'airdrop_amount_per_utxo': AIRDROP_AMOUNT,
    'total_recipients': len(results),
    'total_airdrops': sum(r['receive_count'] for r in results),
    'recipients_with_multiple': multi_count,
    'recipients': results
}

print(f"\n💾 Salvando em {OUTPUT_FILE}...")
with open(OUTPUT_FILE, 'w') as f:
    json.dump(output_data, f, indent=2)

print(f"✅ Dados salvos!")

# Top recipients com múltiplos
multi_recipients = [r for r in results if r['receive_count'] > 1]
if multi_recipients:
    print(f"\n🏆 TOP RECIPIENTS COM MÚLTIPLOS AIRDROPS:")
    for r in multi_recipients[:50]:
        print(f"   {r['address'][:40]}... → {r['receive_count']}x = {r['airdrop_amount']:,.0f} DOG")

print("\n" + "=" * 80)
print("✅ EXTRAÇÃO COMPLETA!")
print("=" * 80)

