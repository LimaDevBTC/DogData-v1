#!/usr/bin/env python3
"""
Rastreador de Distribuição do Airdrop DOG•GO•TO•THE•MOON

Este script rastreia a cadeia completa de distribuição do airdrop:
1. Começa na transação de criação (mint)
2. Segue o UTXO inicial através de todas as transações
3. Mapeia todos os endereços finais que receberam o airdrop
4. Salva a lista completa de recipients (~79k endereços)
"""

import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict, deque

# Configurações
MINT_TXID = "1107d8477c6067fb47ff34aaea37ceb84842db07e4e829817964fcddfd713224"
DISTRIBUTOR_ADDRESS = "bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t"

BASE_DIR = Path(__file__).parent.parent
ORD_DATA_DIR = BASE_DIR.parent / 'ord' / 'data'
OUTPUT_FILE = BASE_DIR / 'data' / 'airdrop_recipients.json'

def run_ord_command(cmd, timeout=60):
    """Executa comando do ord CLI"""
    full_cmd = f"ord --data-dir {ORD_DATA_DIR} {cmd}"
    print(f"🔍 Executando: {cmd}")
    
    try:
        result = subprocess.run(
            full_cmd,
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
        print(f"❌ Erro: {e}")
        return None

def get_transaction_outputs(txid):
    """
    Obtém os outputs de uma transação usando ord CLI.
    Retorna lista de dicts com: {vout, address, amount}
    """
    # Usar ord para buscar a transação
    result = run_ord_command(f"runes outputs {txid}")
    
    if not result:
        return []
    
    outputs = []
    # Parse do resultado
    # Formato esperado do ord runes outputs: vout:address:amount
    for line in result.split('\n'):
        if line.strip():
            try:
                parts = line.split(':')
                if len(parts) >= 3:
                    outputs.append({
                        'vout': int(parts[0]),
                        'address': parts[1],
                        'amount': float(parts[2])
                    })
            except (ValueError, IndexError):
                continue
    
    return outputs

def find_spending_transaction(txid, vout):
    """
    Encontra a transação que gastou um UTXO específico.
    Retorna o txid da transação que gastou, ou None.
    """
    # Usar ord para buscar onde esse output foi gasto
    result = run_ord_command(f"find --txid {txid} --vout {vout}")
    
    if result:
        # Parse para encontrar o spending txid
        # Formato depende do ord, mas geralmente retorna o txid
        return result.strip()
    
    return None

def trace_distribution_chain(start_txid, distributor_address):
    """
    Rastreia toda a cadeia de distribuição começando da transação mint.
    
    Algoritmo:
    1. Começar com a tx mint
    2. Identificar outputs para o distributor
    3. Para cada output do distributor, encontrar a tx que o gastou
    4. Recursivamente seguir a cadeia até não haver mais gastos
    5. Coletar todos os endereços finais que receberam DOG
    """
    print("\n🔍 Rastreando cadeia de distribuição do airdrop...")
    
    recipients = {}  # address -> amount
    to_process = deque()  # Queue de (txid, vout) para processar
    processed = set()  # Set de (txid, vout) já processados
    
    # Começar com a transação mint
    print(f"\n📦 Analisando transação mint: {start_txid}")
    mint_outputs = get_transaction_outputs(start_txid)
    
    if not mint_outputs:
        print("❌ Não foi possível obter outputs da transação mint")
        return recipients
    
    print(f"✅ {len(mint_outputs)} outputs encontrados na mint")
    
    # Adicionar outputs do distributor à fila
    for output in mint_outputs:
        if output['address'] == distributor_address:
            print(f"   📌 Output {output['vout']}: {output['amount']:,.2f} DOG -> {output['address']}")
            to_process.append((start_txid, output['vout'], output['amount']))
    
    # Processar fila
    tx_count = 0
    while to_process:
        current_txid, current_vout, current_amount = to_process.popleft()
        
        # Evitar reprocessamento
        utxo_id = f"{current_txid}:{current_vout}"
        if utxo_id in processed:
            continue
        processed.add(utxo_id)
        
        # Encontrar transação que gastou esse UTXO
        spending_txid = find_spending_transaction(current_txid, current_vout)
        
        if not spending_txid:
            # UTXO não foi gasto - pode ser holder final ou erro
            print(f"   ⚠️  UTXO {utxo_id} não foi gasto")
            continue
        
        tx_count += 1
        if tx_count % 10 == 0:
            print(f"   📊 Processadas {tx_count} transações, {len(recipients)} recipients encontrados...")
        
        # Obter outputs da transação que gastou
        spending_outputs = get_transaction_outputs(spending_txid)
        
        for output in spending_outputs:
            addr = output['address']
            amount = output['amount']
            
            # Se for o distributor novamente, adicionar à fila para continuar rastreando
            if addr == distributor_address:
                to_process.append((spending_txid, output['vout'], amount))
            else:
                # É um recipient final!
                if addr in recipients:
                    recipients[addr] += amount
                else:
                    recipients[addr] = amount
    
    print(f"\n✅ Rastreamento completo!")
    print(f"   📊 {len(recipients)} endereços únicos receberam o airdrop")
    print(f"   📈 {tx_count} transações de distribuição processadas")
    
    return recipients

def save_recipients(recipients):
    """Salva lista de recipients em arquivo JSON"""
    print(f"\n💾 Salvando recipients em {OUTPUT_FILE}...")
    
    # Criar diretório se não existe
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # Converter para lista ordenada por amount (maior primeiro)
    recipients_list = [
        {
            'address': addr,
            'airdrop_amount': amount,
            'rank': idx + 1
        }
        for idx, (addr, amount) in enumerate(
            sorted(recipients.items(), key=lambda x: x[1], reverse=True)
        )
    ]
    
    # Calcular estatísticas
    total_airdropped = sum(recipients.values())
    
    output_data = {
        'timestamp': datetime.now().isoformat(),
        'mint_txid': MINT_TXID,
        'distributor_address': DISTRIBUTOR_ADDRESS,
        'total_recipients': len(recipients_list),
        'total_airdropped': total_airdropped,
        'recipients': recipients_list
    }
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"✅ {len(recipients_list):,} recipients salvos!")
    print(f"   💰 Total airdropped: {total_airdropped:,.2f} DOG")
    
    # Mostrar top 10
    print(f"\n🏆 Top 10 recipients do airdrop:")
    for recipient in recipients_list[:10]:
        print(f"   #{recipient['rank']}: {recipient['address'][:20]}... - {recipient['airdrop_amount']:,.2f} DOG")

def main():
    print("="*80)
    print("🎁 RASTREADOR DE DISTRIBUIÇÃO DO AIRDROP DOG•GO•TO•THE•MOON")
    print("="*80)
    print(f"\n📋 Configuração:")
    print(f"   Transação mint: {MINT_TXID}")
    print(f"   Carteira distribuidora: {DISTRIBUTOR_ADDRESS}")
    print(f"   Diretório ord: {ORD_DATA_DIR}")
    
    # Rastrear distribuição
    recipients = trace_distribution_chain(MINT_TXID, DISTRIBUTOR_ADDRESS)
    
    if not recipients:
        print("\n❌ Nenhum recipient encontrado!")
        sys.exit(1)
    
    # Salvar resultado
    save_recipients(recipients)
    
    print("\n" + "="*80)
    print("✅ RASTREAMENTO COMPLETO!")
    print("="*80)
    print(f"\n📁 Arquivo salvo: {OUTPUT_FILE}")
    print("\n💡 Próximo passo: Comparar com holders atuais para gerar analytics")

if __name__ == "__main__":
    main()

