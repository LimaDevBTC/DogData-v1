#!/usr/bin/env python3
"""
Script para manter o cache de transações sempre atualizado
Mantém sempre as últimas 300 transações no JSON
"""

import json
import os
import sys
import time
from pathlib import Path
from datetime import datetime
import requests

# Configurações
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / 'public' / 'data'
CACHE_FILE = DATA_DIR / 'dog_transactions.json'
MAX_TRANSACTIONS = 500  # Manter apenas as últimas 500
DOG_DECIMALS = 5
DOG_FACTOR = 10 ** DOG_DECIMALS
NET_EPSILON = 1e-5
UNISAT_API_URL = 'https://open-api.unisat.io/v1/indexer/runes/event'

# Upstash (Redis) Config
UPSTASH_URL = os.environ.get('UPSTASH_KV_REST_API_URL')
UPSTASH_TOKEN = os.environ.get('UPSTASH_KV_REST_API_TOKEN')


def normalize_transaction(tx):
    """Normaliza campos numéricos para garantir consistência."""
    senders = tx.get('senders', []) or []
    receivers = tx.get('receivers', []) or []

    sender_addresses = set()
    total_in = 0.0

    for sender in senders:
        address = sender.get('address')
        if address:
            sender_addresses.add(address)

        amount = sender.get('amount')
        if amount is None:
            amount = sender.get('amount_dog', 0) * DOG_FACTOR
        if isinstance(amount, str):
            amount = int(amount or 0)

        dog = sender.get('amount_dog')
        if dog is None:
            dog = (amount or 0) / DOG_FACTOR

        dog = float(dog)

        sender['amount'] = int(amount or 0)
        sender['amount_dog'] = round(dog, 5)
        sender['has_dog'] = sender['amount_dog'] > NET_EPSILON
        total_in += sender['amount_dog']

    total_out = 0.0
    total_change = 0.0

    for receiver in receivers:
        address = receiver.get('address')
        amount = receiver.get('amount')
        if amount is None:
            amount = receiver.get('amount_dog', 0) * DOG_FACTOR
        if isinstance(amount, str):
            amount = int(amount or 0)

        dog = receiver.get('amount_dog')
        if dog is None:
            dog = (amount or 0) / DOG_FACTOR

        dog = float(dog)
        is_change = address in sender_addresses if address else False

        receiver['amount'] = int(amount or 0)
        receiver['amount_dog'] = round(dog, 5)
        receiver['is_change'] = is_change
        receiver['has_dog'] = receiver['amount_dog'] > NET_EPSILON

        total_out += receiver['amount_dog']
        if is_change:
            total_change += receiver['amount_dog']

    net_transfer = max(total_out - total_change, 0.0)

    tx['sender_count'] = len(senders)
    tx['receiver_count'] = len(receivers)
    tx['total_dog_in'] = round(total_in if total_in > NET_EPSILON else total_out, 5)
    tx['total_dog_out'] = round(total_out, 5)
    tx['total_dog_moved'] = round(total_out, 5)
    tx['net_transfer'] = round(net_transfer, 5)
    tx['change_amount'] = round(total_change, 5)
    tx['has_change'] = total_change > NET_EPSILON

    fee_sats = tx.get('fee_sats')
    if fee_sats is not None:
        tx['fee_sats'] = int(fee_sats)
    else:
        tx.pop('fee_sats', None)

    return tx


def sync_upstash(data: dict, reason: str = ""):
    """
    Envia o cache para o Upstash Redis usando o endpoint REST.
    """
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        print('⚠️ Variáveis UPSTASH_KV_REST_API_URL/UPSTASH_KV_REST_API_TOKEN não configuradas. Pulando envio para Redis.')
        return

    try:
        if reason:
            print(f'📡 Enviando cache para Upstash Redis ({reason})...')
        else:
            print('📡 Enviando cache para Upstash Redis...')

        cache_json = json.dumps(data, ensure_ascii=False)
        response = requests.post(
            f"{UPSTASH_URL}/set/dog:transactions",
            headers={
                'Authorization': f'Bearer {UPSTASH_TOKEN}',
                'Content-Type': 'application/json'
            },
            data=cache_json,
            timeout=30
        )
        response.raise_for_status()
        print('✅ Upstash Redis atualizado com sucesso!')
    except Exception as e:
        print(f'⚠️ Erro ao atualizar Upstash Redis: {e}')

def load_existing_cache():
    """Carrega o cache existente"""
    if not CACHE_FILE.exists():
        return {
            'total_transactions': 0,
            'last_block': 0,
            'last_updated': datetime.now().isoformat(),
            'transactions': []
        }
    
    with open(CACHE_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def fetch_transactions_with_fallback():
    """Busca transações usando Xverse com fallback para Unisat."""
    try:
        from unisat_dog_sync import XverseDogSync  # import tardio para evitar ciclo

        sync = XverseDogSync(MAX_TRANSACTIONS)
        transactions = sync.fetch_transactions()
        if transactions:
            print(f"✅ {len(transactions)} transações obtidas via Xverse.")
            return transactions, "xverse"
    except Exception as exc:  # pylint: disable=broad-except
        print(f"❌ Falha ao buscar via Xverse: {exc}")

    print("⚠️ Usando fallback Unisat...")
    try:
        from unisat_dog_sync import LegacyUnisatDogSync

        fallback = LegacyUnisatDogSync()
        transactions = fallback.fetch_transactions()
        if transactions:
            print(f"✅ {len(transactions)} transações obtidas via Unisat (fallback).")
        return transactions, "unisat"
    except Exception as exc:  # pylint: disable=broad-except
        print(f"❌ Falha também no fallback Unisat: {exc}")
        return [], "none"

def update_cache():
    """Atualiza o cache mantendo as últimas MAX_TRANSACTIONS transações."""
    print('🚀 Iniciando atualização do cache de transações...')

    cache = load_existing_cache()
    existing_txs = [normalize_transaction(tx) for tx in cache.get('transactions', [])]
    last_block = cache.get('last_block', 0)
    print(f'📦 Cache atual: {len(existing_txs)} transações, último bloco: {last_block}')

    new_transactions, source = fetch_transactions_with_fallback()
    new_transactions = [normalize_transaction(tx) for tx in new_transactions]

    if not new_transactions:
        print('⚠️ Nenhuma transação obtida das fontes disponíveis. Mantendo cache existente.')
        sync_upstash(cache, reason='sem dados novos')
        return

    newest_block = new_transactions[0]['block_height'] if new_transactions else last_block
    print(f'📌 Fonte utilizada: {source} | Bloco mais recente: {newest_block}')

    merged_map = {}
    for tx in new_transactions + existing_txs:
        txid = tx.get('txid')
        if not txid:
            continue
        current = merged_map.get(txid)
        if current is None or current['block_height'] < tx['block_height']:
            merged_map[txid] = tx

    merged = list(merged_map.values())
    merged.sort(key=lambda tx: (tx['block_height'], tx['timestamp']), reverse=True)
    trimmed = merged[:MAX_TRANSACTIONS]

    added_count = sum(1 for tx in trimmed if tx['block_height'] > last_block)

    updated_cache = {
        'total_transactions': len(trimmed),
        'last_block': trimmed[0]['block_height'] if trimmed else last_block,
        'last_updated': datetime.now().isoformat(),
        'transactions': trimmed,
        'source': source,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(updated_cache, f, ensure_ascii=False, indent=2)

    print('✅ Cache atualizado!')
    print(f'   📊 Total armazenado: {len(trimmed)}')
    print(f'   📌 Último bloco: {updated_cache["last_block"]}')
    print(f'   🆕 Novas transações adicionadas: {added_count}')
    print(f'   💾 Arquivo: {CACHE_FILE}')

    sync_upstash(updated_cache, reason=f'fonte {source}')

if __name__ == '__main__':
    try:
        update_cache()
    except Exception as e:
        print(f'❌ Erro fatal: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)

