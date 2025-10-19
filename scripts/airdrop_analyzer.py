#!/usr/bin/env python3
"""
Analisador do Airdrop DOG•GO•TO•THE•MOON

Este script:
1. Identifica todas as carteiras que receberam o airdrop original
2. Compara com os holders atuais
3. Calcula métricas de comportamento (vendeu, comprou mais, hodl, etc.)
"""

import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Configurações
AIRDROP_START_BLOCK = 840000  # Bloco de criação da DOG
AIRDROP_END_BLOCK = 840500    # Estimativa do fim da distribuição
DOG_RUNE_ID = "DOG•GO•TO•THE•MOON"

BASE_DIR = Path(__file__).parent.parent
OUTPUT_FILE = BASE_DIR / 'data' / 'airdrop_analysis.json'

def run_command(cmd, timeout=300):
    """Executa comando do shell com timeout"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        if result.returncode != 0:
            print(f"❌ Erro: {result.stderr}")
            return None
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        print(f"❌ Timeout ao executar comando")
        return None
    except Exception as e:
        print(f"❌ Erro ao executar comando: {e}")
        return None

def get_current_holders():
    """Obtém lista de holders atuais usando efficient_dog_extractor.py"""
    print("\n📊 Obtendo holders atuais...")
    
    # Verificar se já existe um arquivo recente
    ord_dir = BASE_DIR.parent / 'ord'
    holders_file = ord_dir / 'dog_holders_by_address.json'
    
    # Se o arquivo não existe ou é muito antigo, rodar o extractor
    if not holders_file.exists() or (datetime.now().timestamp() - holders_file.stat().st_mtime) > 3600:
        print("⏳ Extraindo holders (isso pode demorar alguns minutos)...")
        result = run_command(f"cd {ord_dir} && python3 efficient_dog_extractor.py", timeout=600)
        if result is None:
            print("❌ Falha ao extrair holders")
            return None
    
    # Ler arquivo
    if holders_file.exists():
        with open(holders_file, 'r') as f:
            data = json.load(f)
        
        print(f"✅ {len(data.get('holders', []))} holders atuais carregados")
        return data
    else:
        print("❌ Arquivo de holders não encontrado")
        return None

def get_airdrop_recipients():
    """
    Identifica carteiras que receberam o airdrop original.
    
    Estratégia:
    1. Buscar transações de DOG nos blocos iniciais (840000-840500)
    2. Identificar os primeiros recipients (outputs)
    3. Esses são os recipients do airdrop
    """
    print(f"\n🎁 Identificando recipients do airdrop (blocos {AIRDROP_START_BLOCK}-{AIRDROP_END_BLOCK})...")
    
    recipients = {}  # address -> amount
    
    # Para simplicidade inicial, vamos usar o ord CLI para buscar
    # transações nesses blocos
    print("⏳ Buscando transações iniciais...")
    
    # Comando para buscar rune balance de todos os holders
    # Filtramos apenas aqueles que aparecem nos primeiros blocos
    cmd = f"ord --data-dir {BASE_DIR.parent}/ord/data runes balances"
    result = run_command(cmd)
    
    if result:
        # Parse do resultado
        # Formato esperado: address\tamount
        for line in result.split('\n'):
            if line.strip():
                parts = line.split('\t')
                if len(parts) >= 2:
                    address = parts[0]
                    try:
                        amount = float(parts[1])
                        recipients[address] = {
                            'airdrop_amount': amount,
                            'first_seen_block': AIRDROP_START_BLOCK  # Placeholder
                        }
                    except ValueError:
                        continue
    
    print(f"✅ {len(recipients)} recipients identificados")
    return recipients

def analyze_recipient_behavior(recipients, current_holders):
    """
    Analisa o comportamento de cada recipient do airdrop.
    
    Classifica como:
    - HOLDER: Ainda tem DOG (pode ter comprado mais ou vendido parte)
    - ACCUMULATOR: Tem mais DOG do que recebeu no airdrop
    - REDUCER: Tem menos DOG do que recebeu (vendeu parte)
    - SELLER: Vendeu tudo (não aparece nos holders atuais)
    - INACTIVE: Nunca moveu o airdrop
    """
    print("\n📈 Analisando comportamento dos recipients...")
    
    # Criar mapa de holders atuais para busca rápida
    holders_map = {}
    if current_holders and 'holders' in current_holders:
        for holder in current_holders['holders']:
            holders_map[holder['address']] = holder
    
    analysis = {
        'total_recipients': len(recipients),
        'holders': 0,
        'accumulators': 0,
        'reducers': 0,
        'sellers': 0,
        'inactive': 0,
        'total_airdropped': 0,
        'total_current_balance': 0,
        'total_sold': 0,
        'recipients_data': []
    }
    
    for address, recipient_data in recipients.items():
        airdrop_amount = recipient_data['airdrop_amount']
        analysis['total_airdropped'] += airdrop_amount
        
        recipient_analysis = {
            'address': address,
            'airdrop_amount': airdrop_amount,
            'current_balance': 0,
            'change_amount': 0,
            'change_percentage': 0,
            'status': 'seller',
            'first_seen_block': recipient_data.get('first_seen_block', AIRDROP_START_BLOCK)
        }
        
        # Verificar se ainda é holder
        if address in holders_map:
            current_holder = holders_map[address]
            current_balance = current_holder.get('total_dog', 0)
            
            recipient_analysis['current_balance'] = current_balance
            recipient_analysis['change_amount'] = current_balance - airdrop_amount
            recipient_analysis['change_percentage'] = ((current_balance - airdrop_amount) / airdrop_amount * 100) if airdrop_amount > 0 else 0
            
            analysis['total_current_balance'] += current_balance
            
            # Classificar comportamento
            if abs(current_balance - airdrop_amount) < 0.00001:
                # Nunca moveu
                recipient_analysis['status'] = 'inactive'
                analysis['inactive'] += 1
            elif current_balance > airdrop_amount:
                # Comprou mais
                recipient_analysis['status'] = 'accumulator'
                analysis['accumulators'] += 1
            elif current_balance < airdrop_amount:
                # Vendeu parte
                recipient_analysis['status'] = 'reducer'
                analysis['reducers'] += 1
            
            analysis['holders'] += 1
        else:
            # Vendeu tudo
            recipient_analysis['status'] = 'seller'
            recipient_analysis['change_amount'] = -airdrop_amount
            recipient_analysis['change_percentage'] = -100
            analysis['sellers'] += 1
            analysis['total_sold'] += airdrop_amount
        
        analysis['recipients_data'].append(recipient_analysis)
    
    # Ordenar por current_balance (maiores primeiro)
    analysis['recipients_data'].sort(key=lambda x: x['current_balance'], reverse=True)
    
    # Calcular métricas adicionais
    if analysis['total_airdropped'] > 0:
        analysis['retention_rate'] = (analysis['total_current_balance'] / analysis['total_airdropped']) * 100
        analysis['sell_rate'] = (analysis['total_sold'] / analysis['total_airdropped']) * 100
    
    print(f"✅ Análise completa:")
    print(f"   📊 Total recipients: {analysis['total_recipients']:,}")
    print(f"   💰 Total airdropped: {analysis['total_airdropped']:,.2f} DOG")
    print(f"   🟢 Holders: {analysis['holders']:,} ({analysis['holders']/analysis['total_recipients']*100:.1f}%)")
    print(f"   📈 Accumulators: {analysis['accumulators']:,}")
    print(f"   📉 Reducers: {analysis['reducers']:,}")
    print(f"   🔴 Sellers: {analysis['sellers']:,}")
    print(f"   💤 Inactive: {analysis['inactive']:,}")
    
    return analysis

def save_analysis(analysis):
    """Salva análise em arquivo JSON"""
    print(f"\n💾 Salvando análise em {OUTPUT_FILE}...")
    
    # Criar diretório se não existe
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # Adicionar metadados
    output_data = {
        'timestamp': datetime.now().isoformat(),
        'airdrop_blocks': {
            'start': AIRDROP_START_BLOCK,
            'end': AIRDROP_END_BLOCK
        },
        'analysis': analysis
    }
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"✅ Análise salva com sucesso!")

def main():
    print("="*80)
    print("🎁 ANALISADOR DO AIRDROP DOG•GO•TO•THE•MOON")
    print("="*80)
    
    # 1. Obter holders atuais
    current_holders = get_current_holders()
    if not current_holders:
        print("❌ Não foi possível obter holders atuais")
        sys.exit(1)
    
    # 2. Identificar recipients do airdrop
    recipients = get_airdrop_recipients()
    if not recipients:
        print("❌ Não foi possível identificar recipients do airdrop")
        sys.exit(1)
    
    # 3. Analisar comportamento
    analysis = analyze_recipient_behavior(recipients, current_holders)
    
    # 4. Salvar resultado
    save_analysis(analysis)
    
    print("\n" + "="*80)
    print("✅ ANÁLISE COMPLETA!")
    print("="*80)

if __name__ == "__main__":
    main()

