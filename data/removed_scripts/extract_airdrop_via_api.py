#!/usr/bin/env python3
"""
Extrator de Recipients do Airdrop DOG via API

Este script usa APIs públicas de blockchain explorers para:
1. Identificar todas as transações da carteira distribuidora
2. Extrair todos os recipients únicos
3. Salvar a lista completa de ~79k endereços

APIs suportadas:
- mempool.space (padrão, gratuita)
- blockstream.info (backup)
"""

import json
import requests
import time
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Configurações
DISTRIBUTOR_ADDRESS = "bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t"
AIRDROP_START_BLOCK = 840000
AIRDROP_END_BLOCK = 841000  # Estimativa - ajustar conforme necessário

BASE_DIR = Path(__file__).parent.parent
OUTPUT_FILE = BASE_DIR / 'data' / 'airdrop_recipients.json'

# APIs
MEMPOOL_API = "https://mempool.space/api"
BLOCKSTREAM_API = "https://blockstream.info/api"

def get_address_txs(address, api_base=MEMPOOL_API):
    """
    Obtém todas as transações de um endereço.
    
    Retorna lista de txids onde o endereço gastou UTXOs (inputs).
    """
    print(f"🔍 Buscando transações de {address[:20]}...")
    
    try:
        # Endpoint para transações do endereço
        url = f"{api_base}/address/{address}/txs"
        
        all_txs = []
        last_seen_txid = None
        
        while True:
            # Paginação
            if last_seen_txid:
                response = requests.get(f"{url}/chain/{last_seen_txid}", timeout=30)
            else:
                response = requests.get(url, timeout=30)
            
            if response.status_code != 200:
                print(f"❌ Erro na API: {response.status_code}")
                break
            
            txs = response.json()
            
            if not txs:
                break
            
            all_txs.extend(txs)
            last_seen_txid = txs[-1]['txid']
            
            print(f"   📊 {len(all_txs)} transações encontradas...")
            
            # Rate limiting
            time.sleep(0.5)
            
            # Limite de segurança
            if len(all_txs) > 10000:
                print("⚠️  Limite de transações atingido")
                break
        
        print(f"✅ Total: {len(all_txs)} transações")
        return all_txs
        
    except Exception as e:
        print(f"❌ Erro ao buscar transações: {e}")
        return []

def extract_recipients_from_txs(txs, distributor_address):
    """
    Extrai recipients únicos das transações onde a carteira distribuidora
    enviou DOG para outros endereços.
    """
    print("\n📊 Extraindo recipients das transações...")
    
    recipients = defaultdict(int)  # address -> count (número de recebimentos)
    distribution_txs = []
    
    for tx in txs:
        txid = tx['txid']
        
        # Verificar se a carteira distribuidora está nos inputs
        is_sender = any(
            vin.get('prevout', {}).get('scriptpubkey_address') == distributor_address
            for vin in tx.get('vin', [])
        )
        
        if not is_sender:
            continue
        
        # Extrair outputs que NÃO são para a própria distribuidora
        tx_recipients = []
        for vout in tx.get('vout', []):
            recipient_addr = vout.get('scriptpubkey_address')
            
            if recipient_addr and recipient_addr != distributor_address:
                recipients[recipient_addr] += 1
                tx_recipients.append(recipient_addr)
        
        if tx_recipients:
            distribution_txs.append({
                'txid': txid,
                'block_height': tx.get('status', {}).get('block_height'),
                'recipients_count': len(tx_recipients)
            })
    
    print(f"✅ {len(recipients):,} recipients únicos encontrados")
    print(f"✅ {len(distribution_txs):,} transações de distribuição")
    
    return recipients, distribution_txs

def save_recipients(recipients, distribution_txs):
    """Salva lista de recipients em arquivo JSON"""
    print(f"\n💾 Salvando recipients em {OUTPUT_FILE}...")
    
    # Criar diretório se não existe
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # Converter para lista ordenada
    recipients_list = [
        {
            'address': addr,
            'receive_count': count,
            'rank': idx + 1
        }
        for idx, (addr, count) in enumerate(
            sorted(recipients.items(), key=lambda x: x[1], reverse=True)
        )
    ]
    
    output_data = {
        'timestamp': datetime.now().isoformat(),
        'distributor_address': DISTRIBUTOR_ADDRESS,
        'extraction_method': 'mempool.space_api',
        'total_recipients': len(recipients_list),
        'total_distribution_txs': len(distribution_txs),
        'recipients': recipients_list,
        'distribution_txs': distribution_txs[:100]  # Apenas primeiras 100 para não ficar muito grande
    }
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"✅ {len(recipients_list):,} recipients salvos!")
    
    # Mostrar top 10
    print(f"\n🏆 Top 10 recipients (mais recebimentos):")
    for recipient in recipients_list[:10]:
        print(f"   #{recipient['rank']}: {recipient['address'][:30]}... - {recipient['receive_count']} recebimentos")

def main():
    print("="*80)
    print("🎁 EXTRATOR DE RECIPIENTS DO AIRDROP VIA API")
    print("="*80)
    print(f"\n📋 Configuração:")
    print(f"   Carteira distribuidora: {DISTRIBUTOR_ADDRESS}")
    print(f"   API: {MEMPOOL_API}")
    print(f"\n⚠️  AVISO: Este processo pode demorar vários minutos")
    print(f"   A API tem rate limiting, então vamos devagar...")
    
    # Confirmar
    response = input("\nDeseja continuar? (s/n): ")
    if response.lower() != 's':
        print("❌ Operação cancelada")
        return
    
    # 1. Buscar todas as transações da carteira distribuidora
    all_txs = get_address_txs(DISTRIBUTOR_ADDRESS)
    
    if not all_txs:
        print("\n❌ Nenhuma transação encontrada!")
        return
    
    # 2. Extrair recipients
    recipients, distribution_txs = extract_recipients_from_txs(all_txs, DISTRIBUTOR_ADDRESS)
    
    if not recipients:
        print("\n❌ Nenhum recipient encontrado!")
        return
    
    # 3. Salvar resultado
    save_recipients(recipients, distribution_txs)
    
    print("\n" + "="*80)
    print("✅ EXTRAÇÃO COMPLETA!")
    print("="*80)
    print(f"\n📁 Arquivo salvo: {OUTPUT_FILE}")
    print(f"\n💡 Próximo passo:")
    print(f"   python3 scripts/analyze_airdrop.py")

if __name__ == "__main__":
    main()

