#!/usr/bin/env python3
"""
Script para atualizar todos os dados do sistema DOG
"""

import subprocess
import json
import requests
from datetime import datetime
import time

def get_ord_balances():
    """Obtém dados de balances do ord"""
    try:
        result = subprocess.run(
            ["ord", "balances"],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"❌ Erro ao executar ord balances: {result.stderr}")
            return None
        
        data = json.loads(result.stdout)
        return data
    except Exception as e:
        print(f"❌ Erro ao obter balances: {e}")
        return None

def process_holders_data(balances_data):
    """Processa dados de holders"""
    holders = []
    
    if "runes" not in balances_data:
        print("❌ Nenhum rune encontrado nos dados")
        return holders
    
    dog_rune_data = balances_data["runes"].get("DOG•GO•TO•THE•MOON", {})
    
    if not dog_rune_data:
        print("❌ DOG rune não encontrado")
        return holders
    
    for address, holder_data in dog_rune_data.items():
        total_amount = holder_data["amount"]
        total_dog = total_amount / (10**5)  # DOG tem 5 casas decimais
        
        holders.append({
            "address": address,
            "total_amount": total_amount,
            "total_dog": total_dog,
            "utxo_count": len(holder_data.get("utxos", []))
        })
    
    # Ordenar por total_dog (maior primeiro)
    holders.sort(key=lambda x: x["total_dog"], reverse=True)
    
    return holders

def save_holders_data(holders):
    """Salva dados de holders no arquivo JSON"""
    output_data = {
        "holders": holders,
        "total_holders": len(holders),
        "last_updated": datetime.now().isoformat(),
        "source": "ord_balances"
    }
    
    output_file = "/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/backend/data/dog_holders_by_address.json"
    
    try:
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)
        print(f"✅ Dados salvos em {output_file}")
        return True
    except Exception as e:
        print(f"❌ Erro ao salvar dados: {e}")
        return False

def reload_backend_data():
    """Solicita recarregamento dos dados no backend"""
    try:
        response = requests.post("http://localhost:3001/api/reload-data", timeout=10)
        if response.status_code == 200:
            print("✅ Backend recarregado com sucesso!")
            return True
        else:
            print(f"❌ Erro ao recarregar backend: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Erro ao conectar com backend: {e}")
        return False

def main():
    print("🔄 Atualizando todos os dados DOG...")
    print("=" * 50)
    
    # 1. Obter dados do ord
    print("📊 Obtendo dados do ord balances...")
    balances_data = get_ord_balances()
    if not balances_data:
        print("❌ Falha ao obter dados do ord")
        return
    
    # 2. Processar dados de holders
    print("🔄 Processando dados de holders...")
    holders = process_holders_data(balances_data)
    if not holders:
        print("❌ Nenhum holder processado")
        return
    
    print(f"✅ {len(holders)} holders processados")
    
    # 3. Salvar dados
    print("💾 Salvando dados...")
    if not save_holders_data(holders):
        return
    
    # 4. Recarregar backend
    print("🔄 Recarregando backend...")
    if not reload_backend_data():
        return
    
    print("=" * 50)
    print("✅ Todos os dados atualizados com sucesso!")
    print(f"📊 Total de holders: {len(holders):,}")
    print(f"⏰ Última atualização: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()

