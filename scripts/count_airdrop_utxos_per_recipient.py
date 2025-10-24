#!/usr/bin/env python3
"""
Contador EFICIENTE de UTXOs do Airdrop DOG
Para cada recipient conhecido, busca suas TXs e conta quantos UTXOs recebeu
"""

import json
import requests
import time
from collections import defaultdict
from datetime import datetime

# Configurações
AIRDROP_RECIPIENTS_FILE = "../data/airdrop_recipients.json"
OUTPUT_FILE = "../data/airdrop_recipients_complete.json"
DISTRIBUTOR_ADDRESS = "bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t"
AIRDROP_START_BLOCK = 840654
AIRDROP_END_BLOCK = 858370

print("=" * 80)
print("🔬 CONTADOR COMPLETO DE AIRDROPS POR RECIPIENT")
print("=" * 80)

# Carregar recipients conhecidos
print("\n📂 Carregando recipients conhecidos...")
with open(AIRDROP_RECIPIENTS_FILE, 'r') as f:
    data = json.load(f)
    recipients_list = data['recipients']

print(f"✅ {len(recipients_list):,} recipients carregados")

print(f"\n📋 Estratégia:")
print(f"   1. Para cada recipient, buscar SUAS transações")
print(f"   2. Filtrar TXs do período do airdrop (blocos {AIRDROP_START_BLOCK}-{AIRDROP_END_BLOCK})")
print(f"   3. Contar outputs recebidos do distribuidor")
print(f"   4. Cada output = 1 airdrop de 889,806 DOG")

print(f"\n⏱️  Estimativa: ~2-3 horas para processar {len(recipients_list):,} recipients")
print(f"   (com rate limiting para não sobrecarregar APIs)")

response = input("\nDeseja continuar? (s/n): ")
if response.lower() != 's':
    print("❌ Cancelado")
    exit(0)

# Processar recipients
updated_recipients = []
total_airdrops_found = 0
processed_count = 0
multi_airdrop_count = 0

print("\n🔍 Processando recipients...")
print("   (Progresso a cada 100 recipients)\n")

for recipient in recipients_list:
    addr = recipient['address']
    
    try:
        # Buscar TXs do recipient via Blockstream API
        url = f"https://blockstream.info/api/address/{addr}/txs"
        response = requests.get(url, timeout=30)
        
        if response.status_code != 200:
            # Se falhar, usar dados existentes
            updated_recipients.append(recipient)
            processed_count += 1
            continue
        
        txs = response.json()
        
        # Contar outputs recebidos do distribuidor no período do airdrop
        receive_count = 0
        airdrop_txs = []
        
        for tx in txs:
            # Verificar se TX está no período do airdrop
            block_height = tx.get('status', {}).get('block_height')
            if not block_height or block_height < AIRDROP_START_BLOCK or block_height > AIRDROP_END_BLOCK:
                continue
            
            # Verificar se o distribuidor está nos inputs
            has_distributor = False
            for vin in tx.get('vin', []):
                prev_addr = vin.get('prevout', {}).get('scriptpubkey_address')
                if prev_addr == DISTRIBUTOR_ADDRESS:
                    has_distributor = True
                    break
            
            if not has_distributor:
                continue
            
            # Contar outputs para este recipient
            for vout in tx.get('vout', []):
                if vout.get('scriptpubkey_address') == addr:
                    receive_count += 1
                    airdrop_txs.append({
                        'tx': tx['txid'],
                        'block': block_height,
                        'vout': vout.get('n')
                    })
        
        # Atualizar recipient
        updated_recipient = {
            'address': addr,
            'receive_count': receive_count,
            'rank': recipient.get('rank', 0),
            'airdrop_txs': airdrop_txs
        }
        
        updated_recipients.append(updated_recipient)
        total_airdrops_found += receive_count
        
        if receive_count > 1:
            multi_airdrop_count += 1
        
        processed_count += 1
        
        # Progresso
        if processed_count % 100 == 0:
            print(f"   ⏳ {processed_count:,}/{len(recipients_list):,} | "
                  f"Airdrops: {total_airdrops_found:,} | "
                  f"Multi: {multi_airdrop_count:,}")
        
        # Rate limiting
        time.sleep(0.2)  # 5 requests/segundo
        
    except Exception as e:
        print(f"   ⚠️  Erro no recipient {addr[:20]}...: {e}")
        updated_recipients.append(recipient)
        processed_count += 1
        time.sleep(1)
        continue

print(f"\n✅ Processamento completo!")
print(f"\n📊 RESULTADOS:")
print(f"   Recipients processados: {processed_count:,}")
print(f"   Total de airdrops: {total_airdrops_found:,}")
print(f"   Recipients com múltiplos airdrops: {multi_airdrop_count:,}")
print(f"   Percentual com múltiplos: {multi_airdrop_count/len(updated_recipients)*100:.2f}%")

# Reordenar por receive_count
updated_recipients.sort(key=lambda x: x['receive_count'], reverse=True)
for i, r in enumerate(updated_recipients, 1):
    r['rank'] = i

# Salvar
output_data = {
    'timestamp': datetime.now().isoformat(),
    'extraction_method': 'recipient_transaction_scan',
    'total_recipients': len(updated_recipients),
    'total_airdrops': total_airdrops_found,
    'recipients_with_multiple': multi_airdrop_count,
    'recipients': updated_recipients
}

print(f"\n💾 Salvando em {OUTPUT_FILE}...")
with open(OUTPUT_FILE, 'w') as f:
    json.dump(output_data, f, indent=2)

print(f"✅ Dados salvos!")

# Top 20
print(f"\n🏆 TOP 20 RECIPIENTS COM MAIS AIRDROPS:")
for r in updated_recipients[:20]:
    if r['receive_count'] > 1:
        print(f"   #{r['rank']}: {r['address'][:40]}... - {r['receive_count']}x airdrop")

print("\n" + "=" * 80)
print("✅ CONTAGEM COMPLETA!")
print("=" * 80)

