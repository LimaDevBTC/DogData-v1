#!/usr/bin/env python3
"""
Script para calcular fees de transações DOG usando Bitcoin Core RPC
Atualiza o cache de transações com fees calculadas localmente

Uso:
    python3 calculate_transaction_fees.py
    
Ou com variáveis de ambiente:
    UPSTASH_KV_REST_API_URL=... UPSTASH_KV_REST_API_TOKEN=... python3 calculate_transaction_fees.py
"""

import subprocess
import json
import sys
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pathlib import Path
import requests

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
MAX_FEES_TO_PROCESS = 100  # Processar até 100 fees por execução

def run_bitcoin_cli(*args):
    """Executa comando bitcoin-cli"""
    try:
        result = subprocess.run(
            [BITCOIN_CLI] + list(args),
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
        return None
    except Exception as e:
        print(f"❌ Erro ao executar bitcoin-cli: {e}")
        return None

def calculate_transaction_fee(txid: str) -> Optional[int]:
    """
    Calcula a fee de uma transação usando Bitcoin Core RPC
    Fee = soma dos inputs - soma dos outputs
    
    Usa getrawtransaction com verbose=true para obter vin/vout diretamente
    """
    try:
        # Obter transação decodificada (com vin e vout)
        # O parâmetro 'true' retorna a transação decodificada diretamente
        tx_data = run_bitcoin_cli('getrawtransaction', txid, 'true')
        if not tx_data:
            return None
        
        # Calcular soma dos outputs (sempre disponível)
        total_output = 0
        vout_list = tx_data.get('vout', [])
        for vout in vout_list:
            # value já vem em BTC, converter para sats
            value_btc = vout.get('value', 0)
            if isinstance(value_btc, (int, float)) and value_btc > 0:
                total_output += int(value_btc * 100_000_000)
        
        if total_output == 0:
            return None
        
        # Calcular soma dos inputs (precisa buscar transações anteriores)
        total_input = 0
        vin_list = tx_data.get('vin', [])
        
        if not vin_list:
            return None
        
        for vin in vin_list:
            prev_txid = vin.get('txid')
            prev_vout = vin.get('vout')
            
            if not prev_txid or prev_vout is None:
                continue
            
            # Obter transação anterior decodificada
            prev_tx = run_bitcoin_cli('getrawtransaction', prev_txid, 'true')
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
            # Validar fee razoável (entre 1 sat e 0.1 BTC = 10M sats)
            if 1 <= fee <= 10_000_000:
                return fee
            else:
                print(f"⚠️ Fee fora do range válido para {txid[:8]}...: {fee} sats (in: {total_input}, out: {total_output})")
        
        return None
    except Exception as e:
        print(f"⚠️ Erro ao calcular fee para {txid[:8]}...: {e}")
        return None

def get_cache_from_upstash() -> Optional[Dict[str, Any]]:
    """Busca cache de transações do Upstash"""
    if not UPSTASH_KV_REST_API_URL or not UPSTASH_KV_REST_API_TOKEN:
        print("⚠️ Variáveis de ambiente Upstash não configuradas")
        print("   Configure UPSTASH_KV_REST_API_URL e UPSTASH_KV_REST_API_TOKEN")
        return None
    
    try:
        # Upstash REST API usa /get/{key}
        url = f"{UPSTASH_KV_REST_API_URL}/get/{CACHE_KEY}"
        headers = {
            'Authorization': f'Bearer {UPSTASH_KV_REST_API_TOKEN}',
            'Content-Type': 'application/json'
        }
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            result = data.get('result')
            if result:
                # result pode ser string JSON ou já parseado
                if isinstance(result, str):
                    return json.loads(result)
                return result
        else:
            print(f"⚠️ Erro HTTP ao buscar cache: {response.status_code}")
        return None
    except Exception as e:
        print(f"❌ Erro ao buscar cache do Upstash: {e}")
        return None

def update_cache_in_upstash(data: Dict[str, Any]) -> bool:
    """Atualiza cache de transações no Upstash"""
    if not UPSTASH_KV_REST_API_URL or not UPSTASH_KV_REST_API_TOKEN:
        return False
    
    try:
        # Upstash REST API usa /set/{key} com POST
        url = f"{UPSTASH_KV_REST_API_URL}/set/{CACHE_KEY}"
        headers = {
            'Authorization': f'Bearer {UPSTASH_KV_REST_API_TOKEN}',
            'Content-Type': 'application/json'
        }
        payload = json.dumps(data, ensure_ascii=False)
        response = requests.post(url, headers=headers, data=payload, timeout=30)
        
        if response.status_code == 200:
            return True
        else:
            print(f"⚠️ Erro HTTP ao atualizar cache: {response.status_code}")
            print(f"   Resposta: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ Erro ao atualizar cache no Upstash: {e}")
        return False

def main():
    print("🔄 Iniciando cálculo de fees usando Bitcoin Core RPC...")
    
    # Buscar cache
    print("📥 Buscando cache de transações...")
    cache_data = get_cache_from_upstash()
    if not cache_data:
        print("❌ Não foi possível buscar cache do Upstash")
        return
    
    transactions = cache_data.get('transactions', [])
    if not transactions:
        print("⚠️ Nenhuma transação encontrada no cache")
        return
    
    print(f"📊 Encontradas {len(transactions)} transações no cache")
    
    # Filtrar transações das últimas 24h sem fees
    now = datetime.now()
    threshold_24h = now - timedelta(hours=24)
    
    transactions_needing_fees = []
    for tx in transactions:
        try:
            tx_time = datetime.fromisoformat(tx['timestamp'].replace('Z', '+00:00'))
            if tx_time >= threshold_24h:
                if not tx.get('fee_sats') or tx.get('fee_sats') == 0:
                    transactions_needing_fees.append(tx)
        except:
            continue
    
    if not transactions_needing_fees:
        print("✅ Todas as transações das últimas 24h já têm fees calculadas")
        return
    
    print(f"🔄 Encontradas {len(transactions_needing_fees)} transações das últimas 24h sem fees")
    
    # Processar até MAX_FEES_TO_PROCESS transações
    to_process = transactions_needing_fees[:MAX_FEES_TO_PROCESS]
    print(f"💰 Calculando fees para {len(to_process)} transações...")
    
    fees_calculated = 0
    fees_failed = 0
    tx_map = {tx['txid']: tx for tx in transactions}
    
    for i, tx in enumerate(to_process, 1):
        txid = tx['txid']
        print(f"  [{i}/{len(to_process)}] Calculando fee para {txid[:8]}...", end=' ', flush=True)
        
        fee = calculate_transaction_fee(txid)
        if fee:
            tx['fee_sats'] = fee
            fees_calculated += 1
            print(f"✅ {fee} sats")
        else:
            fees_failed += 1
            print("❌")
    
    # Atualizar cache
    if fees_calculated > 0:
        print(f"\n💾 Atualizando cache com {fees_calculated} fees calculadas...")
        cache_data['transactions'] = transactions
        cache_data['last_update'] = datetime.now().isoformat()
        
        if update_cache_in_upstash(cache_data):
            print(f"✅ Cache atualizado com sucesso!")
            print(f"📊 Resumo: {fees_calculated} fees calculadas, {fees_failed} falhas")
            if len(transactions_needing_fees) > MAX_FEES_TO_PROCESS:
                remaining = len(transactions_needing_fees) - MAX_FEES_TO_PROCESS
                print(f"⏳ {remaining} transações aguardando próxima execução")
        else:
            print("❌ Erro ao atualizar cache no Upstash")
    else:
        print("⚠️ Nenhuma fee foi calculada com sucesso")

if __name__ == "__main__":
    main()



