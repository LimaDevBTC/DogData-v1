#!/usr/bin/env python3
"""
Script de Auditoria de Transações DOG
Verifica a integridade dos dados e identifica problemas
"""

import json
from collections import defaultdict

def load_data():
    """Carrega holders e transações"""
    with open('../backend/data/dog_holders_by_address.json', 'r') as f:
        holders_data = json.load(f)
    
    with open('../backend/data/dog_transactions.json', 'r') as f:
        transactions_data = json.load(f)
    
    return holders_data, transactions_data

def create_holder_dict(holders_data):
    """Cria dicionário rápido de holders"""
    holder_dict = {}
    for idx, holder in enumerate(holders_data['holders']):
        holder_dict[holder['address']] = {
            'rank': idx + 1,
            'balance': holder['total_dog']
        }
    return holder_dict

def audit_transactions(transactions, holder_dict):
    """Audita todas as transações"""
    
    print("=" * 80)
    print("🔍 AUDITORIA DE TRANSAÇÕES DOG")
    print("=" * 80)
    
    total_txs = len(transactions)
    print(f"\n📊 Total de transações: {total_txs}")
    
    # Contadores
    senders_with_ranking = 0
    senders_without_ranking = 0
    senders_not_in_holders = []
    receivers_new_holders = 0
    receivers_existing = 0
    
    # Análise por transação
    for tx in transactions:
        # Analisar INPUTS (senders)
        for inp in tx.get('all_inputs', []):
            if inp.get('has_dog', False):
                address = inp.get('address')
                if address in holder_dict:
                    senders_with_ranking += 1
                else:
                    senders_without_ranking += 1
                    senders_not_in_holders.append({
                        'txid': tx['txid'],
                        'address': address,
                        'block': tx['block_height']
                    })
        
        # Analisar OUTPUTS (receivers)
        for out in tx.get('dog_outputs', []):
            address = out.get('address')
            if address in holder_dict:
                receivers_existing += 1
            else:
                receivers_new_holders += 1
    
    # Relatório
    print("\n" + "=" * 80)
    print("📤 SENDERS (quem enviou DOG)")
    print("=" * 80)
    print(f"✅ Com ranking (ainda é holder): {senders_with_ranking}")
    print(f"❌ Sem ranking (não é mais holder): {senders_without_ranking}")
    
    if senders_without_ranking > 0:
        print(f"\n⚠️  {len(senders_not_in_holders)} endereços enviaram DOG mas não estão mais na lista de holders!")
        print("    Isso significa que eles já gastaram todo o saldo.")
        print("\n📋 Exemplos de senders que não são mais holders:")
        for example in senders_not_in_holders[:5]:
            print(f"    - {example['address'][:20]}... (tx: {example['txid'][:16]}..., bloco: {example['block']})")
    
    print("\n" + "=" * 80)
    print("📥 RECEIVERS (quem recebeu DOG)")
    print("=" * 80)
    print(f"✅ Holders existentes: {receivers_existing}")
    print(f"🆕 Novos holders: {receivers_new_holders}")
    
    # Análise de completude
    print("\n" + "=" * 80)
    print("📊 ANÁLISE DE COMPLETUDE")
    print("=" * 80)
    
    # Verificar se temos todas as transações
    blocks = sorted(set(tx['block_height'] for tx in transactions))
    if blocks:
        min_block = min(blocks)
        max_block = max(blocks)
        expected_blocks = max_block - min_block + 1
        actual_blocks = len(blocks)
        
        print(f"Primeiro bloco processado: {min_block}")
        print(f"Último bloco processado: {max_block}")
        print(f"Blocos com transações: {actual_blocks}")
        print(f"Range de blocos: {expected_blocks}")
        
        if actual_blocks < expected_blocks:
            print(f"\n⚠️  Faltam {expected_blocks - actual_blocks} blocos no range!")
        else:
            print(f"\n✅ Todos os blocos no range têm dados!")
    
    # Verificar transações sem senders conhecidos
    print("\n" + "=" * 80)
    print("🚨 TRANSAÇÕES PROBLEMÁTICAS")
    print("=" * 80)
    
    problematic = []
    for tx in transactions:
        has_known_sender = False
        for inp in tx.get('all_inputs', []):
            if inp.get('has_dog') and inp.get('address') in holder_dict:
                has_known_sender = True
                break
        
        if not has_known_sender:
            # Verificar se ALGUM input tinha DOG
            has_any_dog_input = any(inp.get('has_dog', False) for inp in tx.get('all_inputs', []))
            if has_any_dog_input:
                problematic.append({
                    'txid': tx['txid'],
                    'block': tx['block_height'],
                    'inputs_with_dog': sum(1 for inp in tx.get('all_inputs', []) if inp.get('has_dog')),
                })
    
    if problematic:
        print(f"\n⚠️  {len(problematic)} transações onde NENHUM sender está no ranking atual!")
        print("    Isso pode acontecer se:")
        print("    1. Todos os senders já gastaram todo seu DOG")
        print("    2. Os holders estão desatualizados")
        print("\n📋 Exemplos:")
        for example in problematic[:5]:
            print(f"    - TX: {example['txid'][:20]}... (bloco: {example['block']}, inputs com DOG: {example['inputs_with_dog']})")
    else:
        print("\n✅ Todas as transações têm pelo menos 1 sender no ranking!")
    
    # Recomendações
    print("\n" + "=" * 80)
    print("💡 RECOMENDAÇÕES")
    print("=" * 80)
    
    if senders_without_ranking > senders_with_ranking:
        print("⚠️  PROBLEMA CRÍTICO: Maioria dos senders não está no ranking!")
        print("   → Atualizar holders ANTES de mostrar transações no frontend")
        print("   → Considerar manter histórico de holders passados")
    elif senders_without_ranking > 0:
        print("⚠️  Alguns senders não estão no ranking (gastaram todo o DOG)")
        print("   → Isso é ESPERADO e NORMAL")
        print("   → Frontend deve mostrar que são 'ex-holders'")
    else:
        print("✅ Todos os senders estão no ranking atual!")
    
    if problematic:
        print("\n⚠️  Existem transações onde TODOS os senders sumiram do ranking")
        print("   → Opções:")
        print("     1. Marcar como 'Sender Desconhecido' (honesto)")
        print("     2. Manter cache de rankings históricos")
        print("     3. Aceitar que alguns senders podem não ter ranking")

def main():
    holders_data, transactions_data = load_data()
    holder_dict = create_holder_dict(holders_data)
    
    print(f"\n✅ Holders carregados: {len(holder_dict):,}")
    print(f"✅ Transações carregadas: {len(transactions_data['transactions']):,}")
    
    audit_transactions(transactions_data['transactions'], holder_dict)
    
    print("\n" + "=" * 80)
    print("✅ Auditoria concluída!")
    print("=" * 80 + "\n")

if __name__ == '__main__':
    main()


