#!/usr/bin/env python3
"""
Script para construir histórico de preços de DOG desde o início
Busca dados da Gate.io API e armazena em data/dog_price_history.json
"""

import json
import requests
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional

# Configurações
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'data'
PRICE_HISTORY_FILE = DATA_DIR / 'dog_price_history.json'
PUBLIC_DATA_DIR = SCRIPT_DIR.parent / 'public' / 'data'

# Data de início: 25 de abril de 2024 (dia 1 da DOG na Gate.io)
START_DATE = datetime(2024, 4, 25)
GATEIO_API_BASE = 'https://api.gateio.ws/api/v4/spot/candlesticks'
CURRENCY_PAIR = 'DOG_USDT'
INTERVAL = '1d'  # Diário
MAX_CANDLES_PER_REQUEST = 1000  # Limite da API

def fetch_candlesticks(from_timestamp: int, to_timestamp: int) -> list:
    """Busca candlesticks da Gate.io API"""
    url = f"{GATEIO_API_BASE}"
    params = {
        'currency_pair': CURRENCY_PAIR,
        'interval': INTERVAL,
        'from': from_timestamp,
        'to': to_timestamp,
        'limit': MAX_CANDLES_PER_REQUEST
    }
    
    try:
        print(f"  📥 Buscando candles de {datetime.fromtimestamp(from_timestamp).date()} até {datetime.fromtimestamp(to_timestamp).date()}...")
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        # Formato: [timestamp, volume, open, high, low, close, quote_volume, is_closed]
        return data
    except Exception as e:
        print(f"  ❌ Erro ao buscar candles: {e}")
        return []

def timestamp_to_date(timestamp: int) -> str:
    """Converte timestamp Unix para data YYYY-MM-DD"""
    return datetime.fromtimestamp(int(timestamp)).strftime('%Y-%m-%d')

def date_to_timestamp(date_str: str) -> int:
    """Converte data YYYY-MM-DD para timestamp Unix"""
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    return int(dt.timestamp())

def load_existing_history() -> Dict[str, float]:
    """Carrega histórico existente se disponível"""
    if PRICE_HISTORY_FILE.exists():
        try:
            with open(PRICE_HISTORY_FILE, 'r') as f:
                data = json.load(f)
                print(f"✅ Histórico existente carregado: {len(data)} dias")
                return data
        except Exception as e:
            print(f"⚠️ Erro ao carregar histórico existente: {e}")
            return {}
    return {}

def save_price_history(history: Dict[str, float]):
    """Salva histórico de preços em JSON"""
    # Ordenar por data
    sorted_history = dict(sorted(history.items()))
    
    # Salvar em data/
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(PRICE_HISTORY_FILE, 'w') as f:
        json.dump(sorted_history, f, indent=2)
    print(f"💾 Histórico salvo em {PRICE_HISTORY_FILE}")
    
    # Copiar para public/data/ (para Next.js)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    public_file = PUBLIC_DATA_DIR / 'dog_price_history.json'
    with open(public_file, 'w') as f:
        json.dump(sorted_history, f, indent=2)
    print(f"💾 Cópia salva em {public_file}")

def build_price_history():
    """Constrói histórico completo de preços"""
    print("\n" + "="*80)
    print("📊 CONSTRUINDO HISTÓRICO DE PREÇOS DE DOG")
    print("="*80)
    
    # Carregar histórico existente
    existing_history = load_existing_history()
    
    # Determinar data de início
    if existing_history:
        last_date = max(existing_history.keys())
        last_dt = datetime.strptime(last_date, '%Y-%m-%d')
        start_dt = last_dt + timedelta(days=1)  # Começar do dia seguinte
        print(f"📅 Continuando a partir de {start_dt.date()} (última data: {last_date})")
    else:
        start_dt = START_DATE
        print(f"📅 Iniciando desde {start_dt.date()}")
    
    # Data final = hoje
    end_dt = datetime.now()
    
    if start_dt >= end_dt:
        print("✅ Histórico já está atualizado!")
        return existing_history
    
    # Buscar candles em lotes (API tem limite)
    all_candles = []
    current_start = start_dt
    
    while current_start < end_dt:
        # Calcular timestamp de fim (máximo 1000 dias por request)
        batch_end = min(current_start + timedelta(days=MAX_CANDLES_PER_REQUEST - 1), end_dt)
        
        from_ts = int(current_start.timestamp())
        to_ts = int(batch_end.timestamp())
        
        candles = fetch_candlesticks(from_ts, to_ts)
        if candles:
            all_candles.extend(candles)
            print(f"  ✅ {len(candles)} candles recebidos")
        else:
            print(f"  ⚠️ Nenhum candle recebido para este período")
        
        # Delay para não sobrecarregar API
        time.sleep(0.5)
        
        current_start = batch_end + timedelta(days=1)
    
    print(f"\n📊 Total de candles recebidos: {len(all_candles)}")
    
    # Processar candles e criar dicionário de preços
    # Formato: { "YYYY-MM-DD": close_price }
    price_history = existing_history.copy()
    
    for candle in all_candles:
        if len(candle) >= 6:
            timestamp = int(candle[0])
            close_price = float(candle[5])  # Preço de fechamento
            
            date_str = timestamp_to_date(timestamp)
            price_history[date_str] = close_price
    
    print(f"📈 Total de dias no histórico: {len(price_history)}")
    
    # Salvar
    save_price_history(price_history)
    
    # Estatísticas
    if price_history:
        prices = list(price_history.values())
        print(f"\n📊 Estatísticas:")
        print(f"   Primeira data: {min(price_history.keys())}")
        print(f"   Última data: {max(price_history.keys())}")
        print(f"   Preço mínimo: ${min(prices):.8f}")
        print(f"   Preço máximo: ${max(prices):.8f}")
        print(f"   Preço atual: ${prices[-1]:.8f}")
    
    return price_history

def get_price_at_date(date_str: str, history: Optional[Dict[str, float]] = None) -> Optional[float]:
    """Retorna o preço de DOG em uma data específica"""
    if history is None:
        history = load_existing_history()
    
    # Tentar data exata
    if date_str in history:
        return history[date_str]
    
    # Tentar data anterior mais próxima
    sorted_dates = sorted(history.keys())
    for date in reversed(sorted_dates):
        if date <= date_str:
            return history[date]
    
    # Tentar data posterior mais próxima (se não houver anterior)
    for date in sorted_dates:
        if date >= date_str:
            return history[date]
    
    return None

if __name__ == '__main__':
    try:
        history = build_price_history()
        print("\n✅ Histórico de preços construído com sucesso!")
        print(f"   Total de dias: {len(history)}")
    except KeyboardInterrupt:
        print("\n⚠️ Interrompido pelo usuário")
    except Exception as e:
        print(f"\n❌ Erro: {e}")
        import traceback
        traceback.print_exc()

