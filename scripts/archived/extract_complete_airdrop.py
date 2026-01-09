#!/usr/bin/env python3
"""
Extrator COMPLETO - Expandindo busca para encontrar os 112,384 UTXOs
"""

import subprocess
import json
import sys

AIRDROP_RECIPIENTS_FILE = "../data/airdrop_recipients.json"
OUTPUT_FILE = "../data/airdrop_recipients_complete.json"
AIRDROP_AMOUNT = 889806
TARGET_UTXOS = 112384

print("=" * 80)
print("🎯 EXTRATOR COMPLETO - META: 112,384 UTXOs")
print("=" * 80)

# Carregar recipients
print("\n📂 Carregando recipients...")
with open(AIRDROP_RECIPIENTS_FILE, 'r') as f:
    data = json.load(f)
    recipients_list = data['recipients']

recipients_map = {r['address']: {'receive_count': 0, 'txs': []} for r in recipients_list}

print(f"✅ {len(recipients_list):,} recipients carregados")

# Expandir busca gradualmente
print(f"\n📋 ESTRATÉGIA:")
print(f"   Range expandido: blocos 840650 a 841000 (350 blocos)")
print(f"   Meta: {TARGET_UTXOS:,} UTXOs")

print(f"\n🚀 Escaneando...\n", flush=True)

total_outputs = 0
blocks_processed = 0
blocks_with_data = []

for block_height in range(840650, 841000):
    try:
        cmd_hash = ['bitcoin-cli', 'getblockhash', str(block_height)]
        result = subprocess.run(cmd_hash, capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            continue
        
        block_hash = result.stdout.strip()
        
        cmd_block = ['bitcoin-cli', 'getblock', block_hash, '2']
        result = subprocess.run(cmd_block, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            continue
        
        block = json.loads(result.stdout)
        outputs_in_block = 0
        
        for tx in block.get('tx', []):
            txid = tx['txid']
            for vout in tx.get('vout', []):
                script_pub_key = vout.get('scriptPubKey', {})
                recipient_addr = script_pub_key.get('address')
                addresses = script_pub_key.get('addresses', [])
                
                if not recipient_addr and addresses:
                    recipient_addr = addresses[0]
                
                if recipient_addr in recipients_map:
                    recipients_map[recipient_addr]['receive_count'] += 1
                    recipients_map[recipient_addr]['txs'].append({
                        'tx': txid,
                        'block': block_height,
                        'vout': vout.get('n')
                    })
                    outputs_in_block += 1
                    total_outputs += 1
        
        if outputs_in_block > 0:
            blocks_with_data.append(block_height)
            print(f"   📦 Bloco {block_height}: {outputs_in_block} outputs | Total: {total_outputs:,}", flush=True)
        
        blocks_processed += 1
        
        # Parar se atingir a meta
        if total_outputs >= TARGET_UTXOS:
            print(f"\n🎯 META ATINGIDA! {total_outputs:,} outputs encontrados!", flush=True)
            break
        
    except Exception as e:
        continue

print(f"\n{'='*80}")
print(f"📊 SCAN COMPLETO!")
print(f"{'='*80}")
print(f"   Blocos escaneados: {blocks_processed}")
print(f"   Blocos com dados: {len(blocks_with_data)}")
print(f"   Outputs encontrados: {total_outputs:,}")
print(f"   Meta: {TARGET_UTXOS:,}")
print(f"   Diferença: {TARGET_UTXOS - total_outputs:,} ({(TARGET_UTXOS - total_outputs)/TARGET_UTXOS*100:.1f}%)")

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

results.sort(key=lambda x: x['receive_count'], reverse=True)
for i, r in enumerate(results, 1):
    r['rank'] = i

print(f"\n📊 ESTATÍSTICAS:")
print(f"   Recipients com airdrops: {sum(1 for r in results if r['receive_count'] > 0):,}")
print(f"   Recipients com múltiplos: {multi_count:,}")
print(f"   Total de airdrops: {sum(r['receive_count'] for r in results):,}")

# Salvar
output_data = {
    'timestamp': subprocess.run(['date', '-Iseconds'], capture_output=True, text=True).stdout.strip(),
    'extraction_method': 'bitcoin_core_expanded_range',
    'blocks_scanned': blocks_with_data,
    'target_utxos': TARGET_UTXOS,
    'airdrop_amount_per_utxo': AIRDROP_AMOUNT,
    'total_recipients': len(results),
    'total_airdrops': sum(r['receive_count'] for r in results),
    'recipients_with_multiple': multi_count,
    'recipients': results
}

print(f"\n💾 Salvando em {OUTPUT_FILE}...")
with open(OUTPUT_FILE, 'w') as f:
    json.dump(output_data, f, indent=2)

print(f"✅ Salvo!")

# Top múltiplos
multi = [r for r in results if r['receive_count'] > 1]
if multi:
    print(f"\n🏆 TOP 30 COM MÚLTIPLOS AIRDROPS:")
    for r in multi[:30]:
        print(f"   {r['address'][:40]}... → {r['receive_count']}x = {r['airdrop_amount']:,.0f} DOG")

print("\n" + "=" * 80)
print("✅ EXTRAÇÃO COMPLETA!")
print("=" * 80)

