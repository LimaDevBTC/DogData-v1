#!/usr/bin/env python3
"""
Script OTIMIZADO para calcular fees de transações DOG usando Bitcoin Core RPC
- Processa apenas transações DOG do cache (não vasculha blocos)
- Usa cache de transações já buscadas para evitar chamadas duplicadas
- Processa em lotes eficientes
- Usa gettxout quando possível (mais rápido)

Uso:
    python3 calculate_transaction_fees_optimized.py
"""

import subprocess
import json
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Set
from pathlib import Path
import requests
import time

# Tentar carregar .env se disponível
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env.local'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

# Configurações
BITCOIN_CLI = 'bitcoin-cli'
UPSTASH_KV_REST_API_URL = os.environ.get('UPSTASH_KV_REST_API_URL')
UPSTASH_KV_REST_API_TOKEN = os.environ.get('UPSTASH_KV_REST_API_TOKEN')
CACHE_KEY = 'dog:transactions'
MAX_FEES_TO_PROCESS = 500  # Aumentado - processa mais por execução
BATCH_SIZE = 50  # Processar em lotes de 50
TX_CACHE = {}  # Cache de transações já buscadas (evita buscar a mesma tx múltiplas vezes)

def run_bitcoin_cli(*args):
    """Executa comando bitcoin-cli com timeout"""
    try:
        result = subprocess.run(
            [BITCOIN_CLI] + list(args),
            capture_output=True,
            text=True,
            timeout=15  # Timeout reduzido
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
        return None
    except subprocess.TimeoutExpired:
        return None
    except Exception:
        return None

def get_tx_cached(txid: str) -> Optional[Dict]:
    """Busca transação com cache para evitar chamadas duplicadas"""
    if txid in TX_CACHE:
        return TX_CACHE[txid]
    
    tx_data = run_bitcoin_cli('getrawtransaction', txid, 'true')
    if tx_data:
        TX_CACHE[txid] = tx_data
    return tx_data

def get_txout(txid: str, vout: int) -> Optional[float]:
    """Busca output específico diretamente (mais rápido que buscar tx inteira)"""
    try:
        result = run_bitcoin_cli('gettxout', txid, str(vout))
        if result and 'value' in result:
            return float(result['value'])
        return None
    except:
        return None

def calculate_transaction_fee_optimized(txid: str) -> Optional[int]:
    """
    Calcula fee de forma otimizada:
    1. Usa cache de transações
    2. Tenta gettxout primeiro (mais rápido)
    3. Só busca transação completa se necessário
    """
    try:
        # Buscar transação (com cache)
        tx_data = get_tx_cached(txid)
        if not tx_data:
            return None
        
        # Calcular soma dos outputs (sempre disponível na tx)
        total_output = 0
        vout_list = tx_data.get('vout', [])
        for vout in vout_list:
            value_btc = vout.get('value', 0)
            if isinstance(value_btc, (int, float)) and value_btc > 0:
                total_output += int(value_btc * 100_000_000)
        
        if total_output == 0:
            return None
        
        # Calcular soma dos inputs (otimizado)
        total_input = 0
        vin_list = tx_data.get('vin', [])
        
        if not vin_list:
            return None
        
        # Tentar usar gettxout primeiro (mais rápido)
        inputs_with_txout = 0
        for vin in vin_list:
            prev_txid = vin.get('txid')
            prev_vout = vin.get('vout')
            
            if not prev_txid or prev_vout is None:
                continue
            
            # Tentar gettxout primeiro (mais rápido)
            value_btc = get_txout(prev_txid, prev_vout)
            if value_btc is not None:
                total_input += int(value_btc * 100_000_000)
                inputs_with_txout += 1
                continue
            
            # Fallback: buscar transação anterior (com cache)
            prev_tx = get_tx_cached(prev_txid)
            if prev_tx:
                prev_vout_list = prev_tx.get('vout', [])
                if isinstance(prev_vout, int) and prev_vout < len(prev_vout_list):
                    prev_output = prev_vout_list[prev_vout]
                    value_btc = prev_output.get('value', 0)
                    if isinstance(value_btc, (int, float)) and value_btc > 0:
                        total_input += int(value_btc * 100_000_000)
        
        # Fee = inputs - outputs
        if total_input > 0 and total_output >= 0:
            fee = total_input - total_output
            # Validar fee razoável
            if 1 <= fee <= 10_000_000:
                return fee
        
        return None
    except Exception:
        return None

def get_cache_from_upstash() -> Optional[Dict[str, Any]]:
    """Busca cache de transações do Upstash"""
    if not UPSTASH_KV_REST_API_URL or not UPSTASH_KV_REST_API_TOKEN:
        print("⚠️ Variáveis de ambiente Upstash não configuradas")
        return None
    
    try:
        url = f"{UPSTASH_KV_REST_API_URL}/get/{CACHE_KEY}"
        headers = {
            'Authorization': f'Bearer {UPSTASH_KV_REST_API_TOKEN}',
            'Content-Type': 'application/json'
        }
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            result = data.get('result')
            if result:
                if isinstance(result, str):
                    return json.loads(result)
                return result
        return None
    except Exception as e:
        print(f"❌ Erro ao buscar cache: {e}")
        return None

def update_cache_in_upstash(data: Dict[str, Any]) -> bool:
    """Atualiza cache no Upstash"""
    if not UPSTASH_KV_REST_API_URL or not UPSTASH_KV_REST_API_TOKEN:
        return False
    
    try:
        url = f"{UPSTASH_KV_REST_API_URL}/set/{CACHE_KEY}"
        headers = {
            'Authorization': f'Bearer {UPSTASH_KV_REST_API_TOKEN}',
            'Content-Type': 'application/json'
        }
        payload = json.dumps(data, ensure_ascii=False)
        response = requests.post(url, headers=headers, data=payload, timeout=60)
        return response.status_code == 200
    except Exception:
        return False

def main():
    print("="*80)
    print("💰 CÁLCULO OTIMIZADO DE FEES - APENAS TRANSAÇÕES DOG DO CACHE")
    print("="*80)
    print(f"⏰ Iniciado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Limpar cache de transações
    TX_CACHE.clear()
    
    # Buscar cache
    print("\n📥 Buscando cache de transações DOG...")
    cache_data = get_cache_from_upstash()
    if not cache_data:
        print("❌ Não foi possível buscar cache do Upstash")
        return
    
    transactions = cache_data.get('transactions', [])
    if not transactions:
        print("⚠️ Nenhuma transação encontrada no cache")
        return
    
    print(f"✅ Encontradas {len(transactions)} transações DOG no cache")
    
    # Filtrar transações sem fees (prioridade para últimas 24h)
    # Usar UTC para comparação (transações estão em UTC)
    from datetime import timezone
    now = datetime.now(timezone.utc)
    threshold_24h = now - timedelta(hours=24)
    
    # Separar em duas listas: últimas 24h e mais antigas
    recent_needing_fees = []
    older_needing_fees = []
    
    for tx in transactions:
        try:
            tx_time_str = tx.get('timestamp', '')
            if 'Z' in tx_time_str:
                tx_time = datetime.fromisoformat(tx_time_str.replace('Z', '+00:00'))
            else:
                tx_time = datetime.fromisoformat(tx_time_str)
            
            # Só processar se não tem fee ou fee é zero
            if not tx.get('fee_sats') or tx.get('fee_sats') == 0:
                if tx_time >= threshold_24h:
                    recent_needing_fees.append(tx)
                else:
                    older_needing_fees.append(tx)
        except:
            continue
    
    # Priorizar últimas 24h
    to_process = recent_needing_fees[:MAX_FEES_TO_PROCESS]
    if len(to_process) < MAX_FEES_TO_PROCESS:
        remaining = MAX_FEES_TO_PROCESS - len(to_process)
        to_process.extend(older_needing_fees[:remaining])
    
    if not to_process:
        print("✅ Todas as transações já têm fees calculadas")
        return
    
    print(f"\n📊 Transações para processar:")
    print(f"   - Últimas 24h sem fees: {len(recent_needing_fees)}")
    print(f"   - Mais antigas sem fees: {len(older_needing_fees)}")
    print(f"   - Processando: {len(to_process)} transações")
    
    # Processar em lotes
    fees_calculated = 0
    fees_failed = 0
    start_time = time.time()
    
    for batch_start in range(0, len(to_process), BATCH_SIZE):
        batch = to_process[batch_start:batch_start + BATCH_SIZE]
        batch_num = (batch_start // BATCH_SIZE) + 1
        total_batches = (len(to_process) + BATCH_SIZE - 1) // BATCH_SIZE
        
        print(f"\n📦 Lote {batch_num}/{total_batches} ({len(batch)} transações)...")
        
        for i, tx in enumerate(batch, 1):
            txid = tx['txid']
            global_idx = batch_start + i
            
            print(f"  [{global_idx}/{len(to_process)}] {txid[:8]}...", end=' ', flush=True)
            
            fee = calculate_transaction_fee_optimized(txid)
            if fee:
                tx['fee_sats'] = fee
                fees_calculated += 1
                print(f"✅ {fee:,} sats")
            else:
                fees_failed += 1
                print("❌")
            
            # Delay mínimo apenas a cada 10 transações
            if i % 10 == 0 and i < len(batch):
                time.sleep(0.05)
        
        # Atualizar cache após cada lote (para não perder progresso)
        if fees_calculated > 0:
            print(f"  💾 Salvando progresso...", end=' ', flush=True)
            cache_data['transactions'] = transactions
            cache_data['last_update'] = datetime.now().isoformat()
            
            if update_cache_in_upstash(cache_data):
                print("✅")
            else:
                print("❌")
    
    elapsed = time.time() - start_time
    
    # Resumo final
    print("\n" + "="*80)
    print("📊 RESUMO FINAL")
    print("="*80)
    print(f"✅ Fees calculadas: {fees_calculated}")
    print(f"❌ Falhas: {fees_failed}")
    print(f"⏱️  Tempo total: {elapsed:.1f}s ({elapsed/60:.1f}min)")
    if fees_calculated > 0:
        print(f"⚡ Velocidade: {fees_calculated/elapsed:.2f} fees/segundo")
    print(f"💾 Cache de transações: {len(TX_CACHE)} transações em memória")
    
    remaining_recent = max(0, len(recent_needing_fees) - MAX_FEES_TO_PROCESS)
    remaining_older = max(0, len(older_needing_fees) - max(0, MAX_FEES_TO_PROCESS - len(recent_needing_fees)))
    
    if remaining_recent > 0 or remaining_older > 0:
        print(f"\n⏳ Transações restantes:")
        if remaining_recent > 0:
            print(f"   - Últimas 24h: {remaining_recent}")
        if remaining_older > 0:
            print(f"   - Mais antigas: {remaining_older}")
    
    print("="*80)

if __name__ == "__main__":
    main()









