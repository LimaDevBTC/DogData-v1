#!/usr/bin/env python3
"""
Script unificado para atualizar:
1. Lista de holders de DOG (via ord indexer)
2. Fees de transações (via Bitcoin Core RPC)

Uso:
    python3 update_holders_and_fees.py
    
Ou com variáveis de ambiente:
    UPSTASH_KV_REST_API_URL=... UPSTASH_KV_REST_API_TOKEN=... python3 update_holders_and_fees.py
"""

import subprocess
import json
import sys
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pathlib import Path
import requests
from collections import defaultdict

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
ORD_BINARY = '/home/bitmax/Projects/bitcoin-fullstack/ord/target/release/ord'
ORD_DATA_DIR = 'data'
UPSTASH_KV_REST_API_URL = os.environ.get('UPSTASH_KV_REST_API_URL')
UPSTASH_KV_REST_API_TOKEN = os.environ.get('UPSTASH_KV_REST_API_TOKEN')
CACHE_KEY = 'dog:transactions'
MAX_FEES_TO_PROCESS = 500  # Aumentado - processa mais fees por execução
BATCH_SIZE = 50  # Processar em lotes
TX_CACHE = {}  # Cache de transações já buscadas

# Caminhos dos arquivos
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / 'data'
PUBLIC_DATA_DIR = PROJECT_ROOT / 'public' / 'data'

def get_address_from_utxo(txid, output):
    """Obtém o endereço de um UTXO específico
    
    Tenta primeiro gettxout (para UTXOs não gastos).
    Se falhar, usa getrawtransaction como fallback (para UTXOs gastos).
    """
    # Método 1: gettxout (mais rápido, funciona para UTXOs não gastos)
    try:
        result = subprocess.run(['bitcoin-cli', 'gettxout', txid, str(output)], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0 and result.stdout.strip():
            data = json.loads(result.stdout)
            if data and 'scriptPubKey' in data:
                return data['scriptPubKey'].get('address')
    except:
        pass
    
    # Método 2: getrawtransaction (fallback para UTXOs gastos)
    try:
        result = subprocess.run(['bitcoin-cli', 'getrawtransaction', txid, 'true'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            tx_data = json.loads(result.stdout)
            if 'vout' in tx_data and isinstance(output, int) and output < len(tx_data['vout']):
                output_data = tx_data['vout'][output]
                script_pubkey = output_data.get('scriptPubKey', {})
                return script_pubkey.get('address')
    except:
        pass
    
    return None

def update_holders():
    """Atualiza a lista de holders de DOG"""
    print("\n" + "="*80)
    print("📊 ATUALIZANDO LISTA DE HOLDERS")
    print("="*80)
    
    print("🔍 Extraindo dados de DOG do indexador...")
    
    # Obter dados de balance
    print("📊 Carregando dados de balance...")
    ord_cmd = [ORD_BINARY, '--data-dir', ORD_DATA_DIR, 'balances']
    # Executar do diretório ord (3 níveis acima: scripts -> DogData-v1 -> bitcoin-fullstack -> ord)
    ord_dir = Path(__file__).parent.parent.parent / 'ord'
    if not ord_dir.exists():
        print(f"❌ Diretório ord não encontrado: {ord_dir}")
        return False
    result = subprocess.run(ord_cmd, capture_output=True, text=True, cwd=str(ord_dir))
    
    if result.returncode != 0:
        print(f"❌ Erro ao obter dados: {result.stderr}")
        return False
    
    balances = json.loads(result.stdout)
    dog_runes = balances.get('runes', {}).get('DOG•GO•TO•THE•MOON', {})
    
    if not dog_runes:
        print("⚠️ Nenhum UTXO com DOG encontrado")
        return False
    
    print(f"📊 Encontrados {len(dog_runes)} UTXOs com DOG")
    
    # Agrupar por endereço
    address_balances = defaultdict(lambda: {'total_amount': 0, 'utxo_count': 0})
    processed = 0
    errors = 0
    
    for utxo_key, rune_data in dog_runes.items():
        if rune_data.get('amount', 0) > 0:
            try:
                txid, output = utxo_key.split(':')
                address = get_address_from_utxo(txid, int(output))
                
                if address:
                    address_balances[address]['total_amount'] += rune_data['amount']
                    address_balances[address]['utxo_count'] += 1
                else:
                    errors += 1
            except Exception as e:
                errors += 1
                if errors <= 5:  # Mostrar apenas primeiros 5 erros
                    print(f"⚠️ Erro ao processar UTXO {utxo_key}: {e}")
            
            processed += 1
            if processed % 1000 == 0:
                print(f"⏳ Processados {processed}/{len(dog_runes)} UTXOs...")
    
    if errors > 0:
        print(f"⚠️ {errors} erros durante processamento")
    
    # Converter para lista e ordenar
    holders = []
    for address, data in address_balances.items():
        holders.append({
            'address': address,
            'total_amount': data['total_amount'],
            'total_dog': data['total_amount'] / 100000,
            'utxo_count': data['utxo_count']
        })
    
    # Ordenar por total_amount (decrescente) para definir ranking
    holders.sort(key=lambda x: x['total_amount'], reverse=True)
    
    # Adicionar ranking (1-indexed)
    for rank, holder in enumerate(holders, start=1):
        holder['rank'] = rank
    
    print(f"✅ Encontrados {len(holders)} holders únicos")
    print("🏆 Top 10 holders:")
    for i, holder in enumerate(holders[:10]):
        print(f"  {i+1}. {holder['address']}: {holder['total_dog']:.5f} DOG ({holder['utxo_count']} UTXOs)")
    
    # Criar estrutura de dados
    output_data = {
        'timestamp': datetime.now().isoformat(),
        'total_holders': len(holders),
        'total_utxos': len(dog_runes),
        'holders': holders
    }
    
    # Garantir que os diretórios existam
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # Salvar dog_holders_by_address.json
    output_path_by_address = DATA_DIR / 'dog_holders_by_address.json'
    with open(output_path_by_address, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"💾 Dados salvos em {output_path_by_address}")
    
    # Salvar também dog_holders.json (formato para API)
    output_path_holders = DATA_DIR / 'dog_holders.json'
    with open(output_path_holders, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"💾 Dados salvos em {output_path_holders}")
    
    # Copiar para public/data/ (para Vercel servir)
    import shutil
    public_path_by_address = PUBLIC_DATA_DIR / 'dog_holders_by_address.json'
    public_path_holders = PUBLIC_DATA_DIR / 'dog_holders.json'
    
    shutil.copy(output_path_by_address, public_path_by_address)
    shutil.copy(output_path_holders, public_path_holders)
    
    print(f"💾 Copiado para public/data/ (Vercel)")
    print(f"✅ Total de arquivos salvos: 4")
    
    return True

def run_bitcoin_cli(*args):
    """Executa comando bitcoin-cli com timeout reduzido"""
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
    """Busca output específico diretamente (mais rápido)"""
    try:
        result = run_bitcoin_cli('gettxout', txid, str(vout))
        if result and 'value' in result:
            return float(result['value'])
        return None
    except:
        return None

def calculate_transaction_fee(txid: str) -> Optional[int]:
    """Calcula fee de forma otimizada usando cache e gettxout"""
    try:
        # Buscar transação (com cache)
        tx_data = get_tx_cached(txid)
        if not tx_data:
            return None
        
        # Calcular soma dos outputs
        total_output = 0
        vout_list = tx_data.get('vout', [])
        for vout in vout_list:
            value_btc = vout.get('value', 0)
            if isinstance(value_btc, (int, float)) and value_btc > 0:
                total_output += int(value_btc * 100_000_000)
        
        if total_output == 0:
            return None
        
        # Calcular soma dos inputs
        total_input = 0
        vin_list = tx_data.get('vin', [])
        
        if not vin_list:
            return None
        
        for vin in vin_list:
            prev_txid = vin.get('txid')
            prev_vout = vin.get('vout')
            
            if not prev_txid or prev_vout is None:
                continue
            
            # Tentar gettxout primeiro (mais rápido)
            value_btc = get_txout(prev_txid, prev_vout)
            if value_btc is not None:
                total_input += int(value_btc * 100_000_000)
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
            # Validar fee razoável (entre 1 sat e 0.1 BTC = 10M sats)
            if 1 <= fee <= 10_000_000:
                return fee
        
        return None
    except Exception as e:
        return None

def get_cache_from_upstash() -> Optional[Dict[str, Any]]:
    """Busca cache de transações do Upstash"""
    if not UPSTASH_KV_REST_API_URL or not UPSTASH_KV_REST_API_TOKEN:
        print("⚠️ Variáveis de ambiente Upstash não configuradas")
        print("   Configure UPSTASH_KV_REST_API_URL e UPSTASH_KV_REST_API_TOKEN")
        return None
    
    try:
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

def update_fees():
    """Atualiza fees de transações (versão otimizada)"""
    print("\n" + "="*80)
    print("💰 ATUALIZANDO FEES DE TRANSAÇÕES (OTIMIZADO)")
    print("="*80)
    
    # Limpar cache de transações
    TX_CACHE.clear()
    
    # Buscar cache
    print("📥 Buscando cache de transações DOG...")
    cache_data = get_cache_from_upstash()
    if not cache_data:
        print("❌ Não foi possível buscar cache do Upstash")
        return False
    
    transactions = cache_data.get('transactions', [])
    if not transactions:
        print("⚠️ Nenhuma transação encontrada no cache")
        return False
    
    print(f"✅ Encontradas {len(transactions)} transações DOG no cache")
    
    # Filtrar transações sem fees (prioridade para últimas 24h)
    # Usar UTC para comparação (transações estão em UTC)
    from datetime import timezone
    now = datetime.now(timezone.utc)
    threshold_24h = now - timedelta(hours=24)
    
    recent_needing_fees = []
    older_needing_fees = []
    
    for tx in transactions:
        try:
            tx_time_str = tx.get('timestamp', '')
            if 'Z' in tx_time_str:
                tx_time = datetime.fromisoformat(tx_time_str.replace('Z', '+00:00'))
            else:
                tx_time = datetime.fromisoformat(tx_time_str)
            
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
        return True
    
    print(f"\n📊 Transações para processar:")
    print(f"   - Últimas 24h sem fees: {len(recent_needing_fees)}")
    print(f"   - Mais antigas sem fees: {len(older_needing_fees)}")
    print(f"   - Processando: {len(to_process)} transações")
    
    # Processar em lotes
    fees_calculated = 0
    fees_failed = 0
    import time
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
            
            fee = calculate_transaction_fee(txid)
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
        
        # Atualizar cache após cada lote
        if fees_calculated > 0:
            print(f"  💾 Salvando progresso...", end=' ', flush=True)
            cache_data['transactions'] = transactions
            cache_data['last_update'] = datetime.now().isoformat()
            
            if update_cache_in_upstash(cache_data):
                print("✅")
            else:
                print("❌")
    
    elapsed = time.time() - start_time
    
    # Resumo
    print(f"\n📊 Resumo: {fees_calculated} calculadas, {fees_failed} falhas")
    print(f"⏱️  Tempo: {elapsed:.1f}s ({elapsed/60:.1f}min)")
    if fees_calculated > 0:
        print(f"⚡ Velocidade: {fees_calculated/elapsed:.2f} fees/segundo")
    print(f"💾 Cache: {len(TX_CACHE)} transações em memória")
    
    remaining_recent = max(0, len(recent_needing_fees) - MAX_FEES_TO_PROCESS)
    remaining_older = max(0, len(older_needing_fees) - max(0, MAX_FEES_TO_PROCESS - len(recent_needing_fees)))
    
    if remaining_recent > 0 or remaining_older > 0:
        print(f"⏳ Restantes: {remaining_recent + remaining_older} transações")
    
    return fees_calculated > 0

def main():
    print("\n" + "="*80)
    print("🚀 ATUALIZAÇÃO DE HOLDERS E FEES")
    print("="*80)
    print(f"⏰ Iniciado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 1. Atualizar holders
    holders_success = update_holders()
    
    # 2. Atualizar fees
    fees_success = update_fees()
    
    # Resumo final
    print("\n" + "="*80)
    print("📊 RESUMO FINAL")
    print("="*80)
    print(f"✅ Holders: {'Sucesso' if holders_success else 'Falhou'}")
    print(f"✅ Fees: {'Sucesso' if fees_success else 'Falhou'}")
    print(f"⏰ Finalizado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

if __name__ == "__main__":
    main()

