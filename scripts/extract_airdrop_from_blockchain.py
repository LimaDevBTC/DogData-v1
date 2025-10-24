#!/usr/bin/env python3
"""
Extrator COMPLETO do Airdrop DOG
Usa Bitcoin Core local para escanear blocos do período do airdrop
"""

import subprocess
import json
from collections import defaultdict
from datetime import datetime

# Configurações
DISTRIBUTOR_ADDRESS = "bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t"
# Blocos onde o airdrop realmente aconteceu (verificado nos dados)
AIRDROP_BLOCKS = [840654, 840655, 840656, 840657, 840658, 850677, 858368]
OUTPUT_FILE = "../data/airdrop_recipients.json"

print("=" * 80)
print("🔬 EXTRATOR COMPLETO DO AIRDROP DOG VIA BITCOIN CORE")
print("=" * 80)
print(f"\n📋 Blocos específicos do airdrop: {AIRDROP_BLOCKS}")
print(f"📋 Total de blocos: {len(AIRDROP_BLOCKS)}")
print(f"📋 Distribuidor: {DISTRIBUTOR_ADDRESS[:30]}...")

print("\n⏱️  Tempo estimado: ~2-5 minutos!")
print(f"    Escaneando apenas {len(AIRDROP_BLOCKS)} blocos específicos")

response = input("\nDeseja continuar? (s/n): ")
if response.lower() != 's':
    print("❌ Cancelado pelo usuário")
    exit(0)

# Contador de recipients
recipients = defaultdict(lambda: {
    'address': '',
    'receive_count': 0,
    'first_receive_block': None,
    'last_receive_block': None,
    'first_receive_time': None,
    'last_receive_time': None,
    'receive_history': []
})

total_outputs = 0
blocks_processed = 0
distributor_txs_found = 0

print("\n🔍 Escaneando blockchain...")

for block_height in AIRDROP_BLOCKS:
    try:
        # Obter hash do bloco
        cmd_hash = ['bitcoin-cli', 'getblockhash', str(block_height)]
        result_hash = subprocess.run(cmd_hash, capture_output=True, text=True, timeout=10)
        if result_hash.returncode != 0:
            continue
        
        block_hash = result_hash.stdout.strip()
        
        # Obter bloco completo com transações
        cmd_block = ['bitcoin-cli', 'getblock', block_hash, '2']  # verbosity 2 = com TXs
        result_block = subprocess.run(cmd_block, capture_output=True, text=True, timeout=30)
        if result_block.returncode != 0:
            continue
        
        block = json.loads(result_block.stdout)
        block_time = block.get('time')
        
        # Processar transações do bloco
        for tx in block.get('tx', []):
            # Verificar se o distribuidor está nos inputs
            has_distributor_input = False
            for vin in tx.get('vin', []):
                if 'coinbase' in vin:
                    continue
                    
                # Obter TX anterior para ver o scriptPubKey
                prev_txid = vin.get('txid')
                prev_vout = vin.get('vout')
                
                if not prev_txid:
                    continue
                
                try:
                    cmd_prev = ['bitcoin-cli', 'getrawtransaction', prev_txid, '1']
                    result_prev = subprocess.run(cmd_prev, capture_output=True, text=True, timeout=10)
                    if result_prev.returncode == 0:
                        prev_tx = json.loads(result_prev.stdout)
                        prev_output = prev_tx.get('vout', [])[prev_vout]
                        addresses = prev_output.get('scriptPubKey', {}).get('addresses', [])
                        address = prev_output.get('scriptPubKey', {}).get('address')
                        
                        if address == DISTRIBUTOR_ADDRESS or DISTRIBUTOR_ADDRESS in addresses:
                            has_distributor_input = True
                            break
                except:
                    pass
            
            if not has_distributor_input:
                continue
            
            # Esta TX foi enviada pelo distribuidor!
            distributor_txs_found += 1
            txid = tx.get('txid')
            
            # Processar outputs
            for vout in tx.get('vout', []):
                script_pub_key = vout.get('scriptPubKey', {})
                recipient_addr = script_pub_key.get('address')
                addresses = script_pub_key.get('addresses', [])
                
                if not recipient_addr and addresses:
                    recipient_addr = addresses[0]
                
                if not recipient_addr or recipient_addr == DISTRIBUTOR_ADDRESS:
                    continue
                
                # Registrar recebimento
                recipient = recipients[recipient_addr]
                recipient['address'] = recipient_addr
                recipient['receive_count'] += 1
                recipient['receive_history'].append({
                    'tx': txid,
                    'block': block_height,
                    'time': block_time,
                    'vout': vout.get('n')
                })
                
                if recipient['first_receive_block'] is None:
                    recipient['first_receive_block'] = block_height
                    recipient['first_receive_time'] = block_time
                
                recipient['last_receive_block'] = block_height
                recipient['last_receive_time'] = block_time
                
                total_outputs += 1
        
        blocks_processed += 1
        
        # Progresso a cada bloco
        print(f"   ✅ Bloco {block_height}: {distributor_txs_found} TXs | "
              f"{total_outputs:,} outputs | {len(recipients):,} recipients")
        
    except Exception as e:
        print(f"   ⚠️  Erro no bloco {block_height}: {e}")
        continue

print("\n✅ Scan completo!")
print(f"\n📊 RESULTADOS:")
print(f"   Blocos processados: {blocks_processed:,}")
print(f"   TXs do distribuidor: {distributor_txs_found:,}")
print(f"   Total de outputs: {total_outputs:,}")
print(f"   Recipients únicos: {len(recipients):,}")

# Preparar para salvar
recipients_list = []
for i, (addr, data) in enumerate(sorted(recipients.items(), key=lambda x: x[1]['receive_count'], reverse=True), 1):
    recipients_list.append({
        'address': addr,
        'receive_count': data['receive_count'],
        'rank': i,
        'first_receive_block': data['first_receive_block'],
        'last_receive_block': data['last_receive_block'],
        'first_receive_time': datetime.fromtimestamp(data['first_receive_time']).isoformat() if data['first_receive_time'] else None,
        'last_receive_time': datetime.fromtimestamp(data['last_receive_time']).isoformat() if data['last_receive_time'] else None,
    })

# Salvar
output_data = {
    'timestamp': datetime.now().isoformat(),
    'extraction_method': 'bitcoin_core_blockchain_scan',
    'distributor_address': DISTRIBUTOR_ADDRESS,
    'total_recipients': len(recipients_list),
    'total_distribution_txs': distributor_txs_found,
    'total_outputs': total_outputs,
    'scanned_blocks': AIRDROP_BLOCKS,
    'recipients': recipients_list
}

print(f"\n💾 Salvando em {OUTPUT_FILE}...")
with open(OUTPUT_FILE, 'w') as f:
    json.dump(output_data, f, indent=2)

print(f"✅ {len(recipients_list):,} recipients salvos!")

# Top 20
print(f"\n🏆 TOP 20 RECIPIENTS COM MAIS AIRDROPS:")
for r in recipients_list[:20]:
    print(f"   #{r['rank']}: {r['address'][:35]}... - {r['receive_count']}x airdrop")

print("\n" + "=" * 80)
print("✅ EXTRAÇÃO COMPLETA!")
print("=" * 80)

