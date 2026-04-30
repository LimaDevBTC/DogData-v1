#!/usr/bin/env python3
"""
Script unificado para atualizar:
1. Lista de holders de DOG (via ord indexer)
2. Fees de transações (via Bitcoin Core RPC)
3. Métricas de UTXO (histórico diário)

Uso:
    python3 update_holders_and_fees.py
    
Ou com variáveis de ambiente:
    UPSTASH_KV_REST_API_URL=... UPSTASH_KV_REST_API_TOKEN=... python3 update_holders_and_fees.py
"""

import subprocess
import json
import sys
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from pathlib import Path
import requests
from collections import defaultdict


def utc_now_iso() -> str:
    """ISO 8601 UTC timestamp with 'Z' suffix (millisecond precision)."""
    n = datetime.now(timezone.utc)
    return n.strftime('%Y-%m-%dT%H:%M:%S.') + f"{n.microsecond // 1000:03d}Z"

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
    
    # Verificar se ord server está rodando e parar temporariamente
    ord_dir = Path(__file__).parent.parent.parent / 'ord'
    if not ord_dir.exists():
        print(f"❌ Diretório ord não encontrado: {ord_dir}")
        return False
    
    ord_running = subprocess.run(['pgrep', '-f', 'ord.*server'], capture_output=True).returncode == 0
    ord_was_running = ord_running
    
    if ord_running:
        print("⏸️  Ord server está rodando. Parando temporariamente para acessar o banco...")
        subprocess.run(['pkill', '-TERM', '-f', 'ord.*server'], capture_output=True)
        # Aguardar até o ord parar completamente
        for i in range(20):
            if subprocess.run(['pgrep', '-f', 'ord.*server'], capture_output=True).returncode != 0:
                print(f"✅ Ord parou após {i+1} segundos")
                break
            time.sleep(1)
        else:
            # Se ainda estiver rodando, forçar kill
            print("⚠️  Ord não parou graciosamente, forçando parada...")
            subprocess.run(['pkill', '-KILL', '-f', 'ord.*server'], capture_output=True)
            time.sleep(2)
        time.sleep(3)  # Garantir que o banco foi liberado completamente
    
    # Obter dados de balance
    print("📊 Carregando dados de balance...")
    ord_cmd = [ORD_BINARY, '--data-dir', ORD_DATA_DIR, 'balances']
    result = subprocess.run(ord_cmd, capture_output=True, text=True, cwd=str(ord_dir))
    
    # Reiniciar ord se estava rodando antes
    if ord_was_running:
        print("🔄 Reiniciando Ord server...")
        subprocess.Popen(
            ['nohup', 'ord', '--data-dir', 'data', '--index-runes', 'server', '--http-port', '8080'],
            cwd=str(ord_dir),
            stdout=open(ord_dir / 'ord.log', 'a'),
            stderr=subprocess.STDOUT
        )
        time.sleep(2)
    
    if result.returncode != 0:
        print(f"❌ Erro ao obter dados: {result.stderr}")
        return False
    
    balances = json.loads(result.stdout)
    dog_runes = balances.get('runes', {}).get('DOG•GO•TO•THE•MOON', {})
    
    if not dog_runes:
        print("⚠️ Nenhum UTXO com DOG encontrado")
        return False
    
    print(f"📊 Encontrados {len(dog_runes)} UTXOs com DOG")
    
    # Agrupar por endereço e coletar informações de UTXOs
    address_balances = defaultdict(lambda: {'total_amount': 0, 'utxo_count': 0})
    utxo_details = []  # Armazenar detalhes de cada UTXO para análise de idade
    processed = 0
    errors = 0
    
    for utxo_key, rune_data in dog_runes.items():
        if rune_data.get('amount', 0) > 0:
            try:
                txid, output = utxo_key.split(':')
                output_int = int(output)
                address = get_address_from_utxo(txid, output_int)
                
                if address:
                    address_balances[address]['total_amount'] += rune_data['amount']
                    address_balances[address]['utxo_count'] += 1
                    
                    # Coletar detalhes do UTXO para análise de idade
                    utxo_details.append({
                        'txid': txid,
                        'vout': output_int,
                        'address': address,
                        'amount': rune_data['amount']
                    })
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
    
    # Carregar histórico de preços
    print("\n💰 Carregando histórico de preços de DOG...")
    price_history = load_price_history()
    if price_history:
        print(f"✅ Histórico carregado: {len(price_history)} dias")
    else:
        print("⚠️ Histórico de preços não encontrado. Execute build_price_history.py primeiro.")
    
    # Buscar preço atual
    current_price = get_current_price()
    if current_price:
        print(f"✅ Preço atual: ${current_price:.8f}")
    else:
        print("⚠️ Não foi possível obter preço atual")
    
    # Calcular idade de TODOS os UTXOs e preço de criação
    print("\n📅 Calculando idade e preço de criação de TODOS os UTXOs...")
    print(f"   Processando {len(utxo_details)} UTXOs (isso pode levar alguns minutos)...")
    utxo_ages = []
    age_processed = 0
    age_errors = 0
    price_errors = 0
    BLOCK_CACHE = {}  # Cache de blocos para evitar chamadas duplicadas
    
    for utxo in utxo_details:
        result = get_utxo_age_and_timestamp(utxo['txid'], utxo['vout'], BLOCK_CACHE)
        if result:
            age_days, block_timestamp = result
            price_at_creation = get_price_at_timestamp(block_timestamp, price_history) if price_history else None
            
            utxo_ages.append({
                'age_days': age_days,
                'amount': utxo['amount'],
                'creation_timestamp': block_timestamp,
                'price_at_creation': price_at_creation
            })
            
            if price_at_creation is None:
                price_errors += 1
        else:
            age_errors += 1
        
        age_processed += 1
        if age_processed % 1000 == 0:
            print(f"⏳ Calculando idade: {age_processed}/{len(utxo_details)} UTXOs ({len(utxo_ages)} sucesso, {age_errors} erros, {price_errors} sem preço)...")
        # Pequeno delay para não sobrecarregar o node
        if age_processed % 100 == 0:
            time.sleep(0.01)
    
    # Calcular estatísticas de idade e distribuição por tamanho
    utxo_age_stats = {}
    utxo_size_distribution = {}
    if utxo_ages:
        total_supply = sum(u['amount'] for u in utxo_ages)
        ages = [u['age_days'] for u in utxo_ages]
        
        # Classificar por idade
        sth_supply = sum(u['amount'] for u in utxo_ages if u['age_days'] < 155)  # < 155 dias = STH
        lth_supply = sum(u['amount'] for u in utxo_ages if u['age_days'] >= 155)  # >= 155 dias = LTH
        
        # Calcular distribuição por tamanho de UTXO (individual, não por holder)
        # Converter amount para DOG para comparação (1 DOG = 100,000 amount)
        size_ranges = [
            {'range': '< 1K DOG', 'min': 0, 'max': 1000 * 100000},
            {'range': '1K - 10K DOG', 'min': 1000 * 100000, 'max': 10000 * 100000},
            {'range': '10K - 100K DOG', 'min': 10000 * 100000, 'max': 100000 * 100000},
            {'range': '100K - 1M DOG', 'min': 100000 * 100000, 'max': 1000000 * 100000},
            {'range': '1M - 10M DOG', 'min': 1000000 * 100000, 'max': 10000000 * 100000},
            {'range': '> 10M DOG', 'min': 10000000 * 100000, 'max': float('inf')},
        ]
        
        for size_range in size_ranges:
            utxos_in_range = [u for u in utxo_ages if size_range['min'] <= u['amount'] < size_range['max']]
            count = len(utxos_in_range)
            supply = sum(u['amount'] for u in utxos_in_range)
            
            utxo_size_distribution[size_range['range']] = {
                'count': count,
                'supply': supply,  # Em amount (unidades menores)
                'percentage': (supply / total_supply * 100) if total_supply > 0 else 0
            }
        
        utxo_age_stats = {
            'total_utxos': len(utxo_ages),
            'total_supply': total_supply,
            'avg_age_days': sum(ages) / len(ages) if ages else 0,
            'median_age_days': sorted(ages)[len(ages) // 2] if ages else 0,
            'sth_supply': sth_supply,
            'lth_supply': lth_supply,
            'sth_percentage': (sth_supply / total_supply * 100) if total_supply > 0 else 0,
            'lth_percentage': (lth_supply / total_supply * 100) if total_supply > 0 else 0,
            'age_distribution': {
                '< 1 day': sum(u['amount'] for u in utxo_ages if u['age_days'] < 1),
                '1-7 days': sum(u['amount'] for u in utxo_ages if 1 <= u['age_days'] < 7),
                '7-30 days': sum(u['amount'] for u in utxo_ages if 7 <= u['age_days'] < 30),
                '30-90 days': sum(u['amount'] for u in utxo_ages if 30 <= u['age_days'] < 90),
                '90-180 days': sum(u['amount'] for u in utxo_ages if 90 <= u['age_days'] < 180),
                '180-365 days': sum(u['amount'] for u in utxo_ages if 180 <= u['age_days'] < 365),
                '> 365 days': sum(u['amount'] for u in utxo_ages if u['age_days'] >= 365),
            },
            'size_distribution': utxo_size_distribution
        }
        print(f"✅ Idade calculada para {len(utxo_ages)} UTXOs (TODOS)")
        print(f"   STH (< 155 dias): {utxo_age_stats['sth_percentage']:.2f}% ({utxo_age_stats['sth_supply'] / 100000:,.0f} DOG)")
        print(f"   LTH (>= 155 dias): {utxo_age_stats['lth_percentage']:.2f}% ({utxo_age_stats['lth_supply'] / 100000:,.0f} DOG)")
        if age_errors > 0:
            print(f"   ⚠️ {age_errors} UTXOs não puderam ter idade calculada")
        
        # Calcular Realized Cap e Supply in Profit/Loss
        if current_price and price_history:
            print("\n💰 Calculando Realized Cap e Supply in Profit/Loss...")
            realized_cap = 0
            supply_in_profit = 0
            supply_in_loss = 0
            utxos_with_price = 0
            
            for utxo in utxo_ages:
                if utxo.get('price_at_creation') is not None:
                    amount_dog = utxo['amount'] / 100000  # Converter para DOG
                    price_at_creation = utxo['price_at_creation']
                    
                    # Realized Cap
                    realized_cap += amount_dog * price_at_creation
                    
                    # Supply in Profit/Loss
                    if current_price > price_at_creation:
                        supply_in_profit += amount_dog
                    else:
                        supply_in_loss += amount_dog
                    
                    utxos_with_price += 1
            
            total_supply_dog = total_supply / 100000
            market_cap = total_supply_dog * current_price
            mvrv_ratio = market_cap / realized_cap if realized_cap > 0 else 0
            
            profit_pct = (supply_in_profit / total_supply_dog * 100) if total_supply_dog > 0 else 0
            loss_pct = (supply_in_loss / total_supply_dog * 100) if total_supply_dog > 0 else 0
            
            # Adicionar às estatísticas
            utxo_age_stats['realized_cap'] = realized_cap
            utxo_age_stats['market_cap'] = market_cap
            utxo_age_stats['mvrv_ratio'] = mvrv_ratio
            utxo_age_stats['supply_in_profit'] = supply_in_profit
            utxo_age_stats['supply_in_loss'] = supply_in_loss
            utxo_age_stats['supply_in_profit_pct'] = profit_pct
            utxo_age_stats['supply_in_loss_pct'] = loss_pct
            utxo_age_stats['current_price'] = current_price
            utxo_age_stats['utxos_with_price'] = utxos_with_price
            
            print(f"   Realized Cap: ${realized_cap:,.2f}")
            print(f"   Market Cap: ${market_cap:,.2f}")
            print(f"   MVRV Ratio: {mvrv_ratio:.2f}")
            print(f"   Supply in Profit: {profit_pct:.2f}% ({supply_in_profit:,.0f} DOG)")
            print(f"   Supply in Loss: {loss_pct:.2f}% ({supply_in_loss:,.0f} DOG)")
            print(f"   UTXOs com preço histórico: {utxos_with_price}/{len(utxo_ages)}")
        else:
            print("⚠️ Não foi possível calcular Realized Cap (faltam preço atual ou histórico)")
    
    # Criar estrutura de dados
    output_data = {
        'timestamp': utc_now_iso(),
        'total_holders': len(holders),
        'total_utxos': len(dog_runes),
        'holders': holders,
        'utxo_age_stats': utxo_age_stats if utxo_age_stats else None
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

def get_utxo_age_days(txid: str, vout: int, block_cache: dict = None) -> Optional[float]:
    """Calcula a idade de um UTXO em dias
    
    Retorna a idade em dias desde que o UTXO foi criado (quando a transação foi incluída no bloco)
    Usa cache de blocos para otimizar chamadas duplicadas
    """
    result = get_utxo_age_and_timestamp(txid, vout, block_cache)
    return result[0] if result else None

def get_utxo_age_and_timestamp(txid: str, vout: int, block_cache: dict = None) -> Optional[tuple]:
    """Calcula a idade de um UTXO em dias e retorna também o timestamp de criação
    
    Retorna: (age_days, block_timestamp) ou None
    Usa cache de blocos para otimizar chamadas duplicadas
    """
    if block_cache is None:
        block_cache = {}
    
    try:
        # Buscar a transação que criou o UTXO (com cache)
        tx_data = get_tx_cached(txid)
        if not tx_data:
            return None
        
        # Obter o bloco hash onde a transação foi incluída
        block_hash = tx_data.get('blockhash')
        if not block_hash:
            # Transação ainda não confirmada
            return (0, int(time.time()))
        
        # Verificar cache de bloco
        if block_hash in block_cache:
            block_time = block_cache[block_hash]
        else:
            # Obter informações do bloco
            block_data = run_bitcoin_cli('getblock', block_hash)
            if not block_data:
                return None
            
            # Obter timestamp do bloco
            block_time = block_data.get('time')
            if not block_time:
                return None
            
            # Armazenar no cache
            block_cache[block_hash] = block_time
        
        # Calcular idade em dias
        current_time = time.time()
        age_seconds = current_time - block_time
        age_days = age_seconds / (24 * 60 * 60)
        
        return (age_days, int(block_time))
    except Exception:
        return None

def load_price_history() -> Dict[str, float]:
    """Carrega histórico de preços de DOG"""
    price_file = DATA_DIR / 'dog_price_history.json'
    if price_file.exists():
        try:
            with open(price_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Erro ao carregar histórico de preços: {e}")
            return {}
    return {}

def get_price_at_timestamp(timestamp: int, price_history: Dict[str, float]) -> Optional[float]:
    """Retorna o preço de DOG no timestamp especificado
    
    Converte timestamp para data (YYYY-MM-DD) e busca no histórico
    Se não encontrar data exata, usa a data anterior mais próxima
    """
    try:
        # Converter timestamp para data
        dt = datetime.fromtimestamp(timestamp)
        date_str = dt.strftime('%Y-%m-%d')
        
        # Tentar data exata
        if date_str in price_history:
            return price_history[date_str]
        
        # Tentar data anterior mais próxima
        sorted_dates = sorted(price_history.keys())
        for date in reversed(sorted_dates):
            if date <= date_str:
                return price_history[date]
        
        # Tentar data posterior mais próxima (se não houver anterior)
        for date in sorted_dates:
            if date >= date_str:
                return price_history[date]
        
        return None
    except Exception:
        return None

def get_current_price() -> Optional[float]:
    """Busca preço atual de DOG da Gate.io"""
    try:
        response = requests.get(
            'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=DOG_USDT',
            timeout=10
        )
        if response.ok:
            data = response.json()
            if data and len(data) > 0:
                return float(data[0].get('last', 0))
    except Exception:
        pass
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
            cache_data['last_update'] = utc_now_iso()
            
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

def update_utxo_metrics():
    """Atualiza o histórico de métricas de UTXO"""
    print("\n" + "="*80)
    print("📊 ATUALIZANDO MÉTRICAS DE UTXO")
    print("="*80)
    
    # Ler dados atuais de holders (já atualizados)
    holders_file = PUBLIC_DATA_DIR / 'dog_holders.json'
    if not holders_file.exists():
        print(f"⚠️ Arquivo de holders não encontrado, pulando métricas de UTXO")
        return False
    
    with open(holders_file, 'r') as f:
        holders_data = json.load(f)
    
    current_utxos = holders_data.get('total_utxos', 0)
    if current_utxos == 0:
        print("⚠️ Total de UTXOs é 0, pulando atualização de métricas")
        return False
    
    # Ler ou criar histórico
    history_file = DATA_DIR / 'utxo_count_history.json'
    if history_file.exists():
        with open(history_file, 'r') as f:
            history_data = json.load(f)
    else:
        history_data = {
            "history": [],
            "last_updated": None
        }
    
    # Data de hoje
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Verificar se já temos entrada para hoje
    history = history_data.get('history', [])
    today_entry = next((entry for entry in history if entry.get('date') == today), None)
    
    if today_entry:
        # Atualizar entrada existente
        today_entry['total_utxos'] = current_utxos
        print(f"✅ Atualizado histórico para {today}: {current_utxos:,} UTXOs")
    else:
        # Adicionar nova entrada
        history.append({
            "date": today,
            "total_utxos": current_utxos
        })
        print(f"✅ Adicionado novo registro para {today}: {current_utxos:,} UTXOs")
    
    # Ordenar por data (mais antigo primeiro)
    history.sort(key=lambda x: x['date'])
    
    # Atualizar metadata
    history_data['history'] = history
    history_data['last_updated'] = utc_now_iso()
    history_data['total_points'] = len(history)
    
    # Salvar
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(history_file, 'w') as f:
        json.dump(history_data, f, indent=2)
    
    print(f"✅ Histórico salvo: {len(history)} pontos de dados")
    if history:
        print(f"   Primeiro registro: {history[0]['date']}")
        print(f"   Último registro: {history[-1]['date']}")
    
    return True

def main():
    print("\n" + "="*80)
    print("🚀 ATUALIZAÇÃO COMPLETA: HOLDERS, FEES E MÉTRICAS")
    print("="*80)
    print(f"⏰ Iniciado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 1. Atualizar holders
    holders_success = update_holders()
    
    # 2. Atualizar fees
    fees_success = update_fees()
    
    # 3. Atualizar métricas de UTXO (só se holders foram atualizados com sucesso)
    utxo_metrics_success = False
    if holders_success:
        utxo_metrics_success = update_utxo_metrics()
    else:
        print("\n⚠️ Pulando atualização de métricas UTXO (holders não foram atualizados)")
    
    # Resumo final
    print("\n" + "="*80)
    print("📊 RESUMO FINAL")
    print("="*80)
    print(f"✅ Holders: {'Sucesso' if holders_success else 'Falhou'}")
    print(f"✅ Fees: {'Sucesso' if fees_success else 'Falhou'}")
    print(f"✅ Métricas UTXO: {'Sucesso' if utxo_metrics_success else 'Falhou/Pulado'}")
    print(f"⏰ Finalizado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # Exit code baseado no sucesso
    if not holders_success:
        sys.exit(1)

if __name__ == "__main__":
    main()

