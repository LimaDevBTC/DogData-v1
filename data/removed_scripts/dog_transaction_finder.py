#!/usr/bin/env python3
"""
Script para encontrar transações DOG no último bloco
Baseado na lógica: transação tem DOG se algum input ou output tem DOG
"""
import subprocess
import json
import sys
import os
from datetime import datetime

def get_address_from_utxo(txid, output):
    """Obtém o endereço de um UTXO específico"""
    try:
        result = subprocess.run(['bitcoin-cli', 'gettxout', txid, output], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data['scriptPubKey']['address']
    except:
        pass
    return None

def get_input_addresses(tx_data):
    """Obtém os endereços dos inputs de uma transação"""
    input_addresses = []
    
    for vin in tx_data['vin']:
        if 'txid' in vin and 'vout' in vin:
            # Obter a transação anterior para pegar o endereço do output
            try:
                result = subprocess.run(['bitcoin-cli', 'getrawtransaction', vin['txid']], 
                                      capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    raw_tx = result.stdout.strip()
                    
                    # Decodificar a transação anterior
                    result = subprocess.run(['bitcoin-cli', 'decoderawtransaction', raw_tx], 
                                          capture_output=True, text=True, timeout=10)
                    if result.returncode == 0:
                        prev_tx_data = json.loads(result.stdout)
                        vout_index = vin['vout']
                        
                        if vout_index < len(prev_tx_data['vout']):
                            script_pubkey = prev_tx_data['vout'][vout_index]['scriptPubKey']
                            address = script_pubkey.get('address', 'unknown')
                            
                            # Se não tem address, pode ser OP_RETURN ou script complexo
                            if address == 'unknown' and 'type' in script_pubkey:
                                if script_pubkey['type'] == 'nulldata':
                                    address = 'OP_RETURN'
                                elif script_pubkey['type'] == 'nonstandard':
                                    address = 'NONSTANDARD'
                                else:
                                    address = f"UNKNOWN_{script_pubkey['type']}"
                            
                            input_addresses.append(address)
                        else:
                            input_addresses.append('INVALID_VOUT')
                    else:
                        input_addresses.append('DECODE_ERROR')
                else:
                    input_addresses.append('TX_NOT_FOUND')
            except subprocess.TimeoutExpired:
                input_addresses.append('TIMEOUT')
            except Exception as e:
                error_msg = str(e)
                if 'Argument list too long' in error_msg:
                    input_addresses.append('ARG_TOO_LONG')
                elif 'Connection refused' in error_msg:
                    input_addresses.append('CONN_REFUSED')
                else:
                    input_addresses.append(f'ERROR_{error_msg[:15]}')
    
    return input_addresses

def check_utxo_had_dog_before_spending(txid, vout):
    """Verifica se um UTXO tinha DOG antes de ser gasto"""
    try:
        # Usar ord para verificar se o UTXO tinha DOG
        # Como o UTXO foi gasto, vamos tentar usar o bitcoin-cli para obter informações
        result = subprocess.run(['bitcoin-cli', 'gettxout', txid, str(vout)], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            # Se retornou dados, o UTXO ainda existe (não foi gasto)
            return False
        
        # Se não retornou dados, o UTXO foi gasto
        # Vamos tentar usar o ord para verificar se tinha DOG
        # Mas como o UTXO foi gasto, isso pode não funcionar
        return None  # Não conseguimos determinar
    except:
        return None

def get_current_block():
    """Obtém o bloco atual"""
    try:
        result = subprocess.run(['bitcoin-cli', 'getblockchaininfo'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data['blocks']
    except:
        pass
    return None

def get_block_transactions(block_height):
    """Obtém todas as transações de um bloco"""
    try:
        # Obter hash do bloco
        result = subprocess.run(['bitcoin-cli', 'getblockhash', str(block_height)], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return [], None
        
        block_hash = result.stdout.strip()
        
        # Obter dados do bloco
        result = subprocess.run(['bitcoin-cli', 'getblock', block_hash], 
                              capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return [], None
        
        block_data = json.loads(result.stdout)
        return block_data['tx'], block_data['time']
    except:
        return [], None

def get_dog_utxos():
    """Obtém todos os UTXOs com DOG"""
    try:
        result = subprocess.run(['/home/bitmax/Projects/bitcoin-fullstack/ord/target/release/ord', '--data-dir', '/home/bitmax/Projects/bitcoin-fullstack/ord/data', 'balances'], 
                              capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            print(f"❌ Erro ord balances: {result.stderr}")
            return {}
        
        balances = json.loads(result.stdout)
        return balances['runes']['DOG•GO•TO•THE•MOON']
    except Exception as e:
        print(f"❌ Erro ao obter UTXOs DOG: {e}")
        return {}

def decode_transaction(txid):
    """Decodifica uma transação"""
    try:
        # Obter transação raw
        result = subprocess.run(['bitcoin-cli', 'getrawtransaction', txid], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return None
        
        raw_tx = result.stdout.strip()
        
        # Decodificar
        result = subprocess.run(['bitcoin-cli', 'decoderawtransaction', raw_tx], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return None
        
        return json.loads(result.stdout)
    except:
        return None

def has_dog_utxo(utxo_key, dog_utxos):
    """Verifica se um UTXO tem DOG"""
    return utxo_key in dog_utxos

def get_transaction_timestamp(txid):
    """Obtém o timestamp individual de uma transação"""
    try:
        result = subprocess.run(['bitcoin-cli', 'getrawtransaction', txid, 'true'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            tx_info = json.loads(result.stdout)
            return tx_info.get('time')
    except:
        pass
    return None

def analyze_transaction(txid, dog_utxos, block_timestamp=None):
    """Analisa uma transação para ver se tem DOG"""
    tx_data = decode_transaction(txid)
    if not tx_data:
        return None
    
    # Obter endereços dos inputs
    input_addresses = get_input_addresses(tx_data)
    
    # Verificar inputs
    dog_inputs = []
    all_inputs = []  # Capturar todos os inputs, mesmo sem DOG
    
    for i, vin in enumerate(tx_data['vin']):
        if 'txid' in vin and 'vout' in vin:
            input_utxo = f"{vin['txid']}:{vin['vout']}"
            
            # Capturar endereço do input
            input_address = 'unknown'
            if i < len(input_addresses):
                input_address = input_addresses[i]
            
            # Verificar se o UTXO tinha DOG antes de ser gasto
            had_dog_before = check_utxo_had_dog_before_spending(vin['txid'], vin['vout'])
            has_dog_now = has_dog_utxo(input_utxo, dog_utxos)
            
            # Para transações DOG, se há dog_outputs, então alguns inputs devem ter tido DOG
            # Vamos usar uma lógica mais inteligente: se o UTXO está na lista de dog_utxos,
            # significa que tinha DOG antes de ser gasto
            input_utxo_key = f"{vin['txid']}:{vin['vout']}"
            had_dog_before = input_utxo_key in dog_utxos
            
            # Nota: A verificação se a transação tem dog_outputs será feita depois
            
            # Sempre adicionar ao all_inputs
            all_inputs.append({
                'txid': vin['txid'],
                'vout': vin['vout'],
                'address': input_address,
                'has_dog': had_dog_before,  # Usar had_dog_before em vez de has_dog_now
                'had_dog_before': had_dog_before,
                'amount': dog_utxos[input_utxo_key]['amount'] if had_dog_before else 0
            })
            
            # Se tem DOG, adicionar também ao dog_inputs
            if has_dog_utxo(input_utxo, dog_utxos):
                dog_inputs.append({
                    'txid': vin['txid'],
                    'vout': vin['vout'],
                    'address': input_address,
                    'amount': dog_utxos[input_utxo]['amount']
                })
    
    # Verificar outputs
    dog_outputs = []
    for i, vout in enumerate(tx_data['vout']):
        output_utxo = f"{txid}:{i}"
        if has_dog_utxo(output_utxo, dog_utxos):
            dog_outputs.append({
                'vout': i,
                'address': vout['scriptPubKey'].get('address', 'unknown'),
                'amount': dog_utxos[output_utxo]['amount']
            })
    
    # Se tem inputs ou outputs com DOG, é uma transação DOG
    if dog_inputs or dog_outputs:
        # Correção: Se a transação tem dog_outputs mas não tem dog_inputs,
        # significa que os inputs tinham DOG antes de ser gastos
        if len(dog_outputs) > 0 and len(dog_inputs) == 0:
            print(f"🔧 Aplicando correção para transação {txid}: {len(dog_outputs)} outputs, {len(dog_inputs)} inputs")
            # Atualizar all_inputs para marcar que tinham DOG antes
            for input_item in all_inputs:
                if not input_item['has_dog']:
                    print(f"   📝 Corrigindo input {input_item['address']}: has_dog {input_item['has_dog']} -> True")
                    input_item['has_dog'] = True
                    input_item['had_dog_before'] = True
                    # Tentar obter o valor do UTXO original
                    input_utxo_key = f"{input_item['txid']}:{input_item['vout']}"
                    if input_utxo_key in dog_utxos:
                        input_item['amount'] = dog_utxos[input_utxo_key]['amount']
                        print(f"   💰 Valor encontrado: {input_item['amount']}")
                    else:
                        print(f"   ⚠️ UTXO {input_utxo_key} não encontrado na lista de dog_utxos")
        # Calcular total de DOG movido (soma de inputs e outputs)
        total_dog_moved = sum(inp['amount'] for inp in dog_inputs) + sum(out['amount'] for out in dog_outputs)
        
        # Determinar tipo de transação
        is_transfer = len(dog_inputs) > 0 and len(dog_outputs) > 0
        is_mint = len(dog_inputs) == 0 and len(dog_outputs) > 0
        is_burn = len(dog_inputs) > 0 and len(dog_outputs) == 0
        
        # Para DOG, não há mints reais - são transferências
        # Se tem dog_outputs, então algum input tinha DOG (DOG não é criado do nada)
        if is_mint:
            is_mint = False
            is_transfer = True
            # Se dog_inputs está vazio mas há dog_outputs, precisamos popular dog_inputs
            # com os inputs que tinham DOG (já foram corrigidos em all_inputs)
            if len(dog_inputs) == 0 and len(dog_outputs) > 0:
                # Copiar os inputs com has_dog=true para dog_inputs
                dog_inputs = [
                    {
                        'txid': inp['txid'],
                        'vout': inp['vout'],
                        'address': inp['address'],
                        'amount': inp['amount']
                    }
                    for inp in all_inputs if inp.get('has_dog', False)
                ]
                print(f"   ✅ Populou dog_inputs com {len(dog_inputs)} inputs")
        
        # Obter timestamp individual da transação
        tx_timestamp = get_transaction_timestamp(txid)
        
        # Converter timestamp Unix para ISO string
        timestamp_iso = None
        if tx_timestamp:
            from datetime import datetime
            timestamp_iso = datetime.fromtimestamp(tx_timestamp).isoformat()
        elif block_timestamp:
            # Fallback para timestamp do bloco se não conseguir o individual
            from datetime import datetime
            timestamp_iso = datetime.fromtimestamp(block_timestamp).isoformat()
        
        return {
            'txid': txid,
            'block_height': None,  # Será preenchido depois
            'timestamp': timestamp_iso,
            'dog_inputs': dog_inputs,
            'all_inputs': all_inputs,  # Todos os inputs, mesmo sem DOG
            'dog_outputs': dog_outputs,
            'total_dog_moved': total_dog_moved,
            'total_dog_moved_formatted': round(total_dog_moved / 100000, 5),  # Converter para DOG com 5 casas decimais
            'is_transfer': is_transfer,
            'is_mint': is_mint,
            'is_burn': is_burn
        }
    
    return None

def find_dog_transactions_in_block(block_height):
    """Encontra todas as transações DOG em um bloco"""
    print(f"🔍 Analisando bloco {block_height}...")
    
    # Obter UTXOs com DOG
    print("📊 Carregando UTXOs com DOG...")
    dog_utxos = get_dog_utxos()
    if not dog_utxos:
        print("❌ Não foi possível obter UTXOs DOG")
        return []
    
    print(f"📊 Encontrados {len(dog_utxos)} UTXOs com DOG")
    
    # Obter transações do bloco
    print(f"📦 Obtendo transações do bloco {block_height}...")
    txids, block_timestamp = get_block_transactions(block_height)
    if not txids:
        print("❌ Não foi possível obter transações do bloco")
        return []
    
    print(f"📦 Encontradas {len(txids)} transações no bloco")
    if block_timestamp:
        from datetime import datetime
        timestamp_str = datetime.fromtimestamp(block_timestamp).strftime('%Y-%m-%d %H:%M:%S')
        print(f"🕒 Timestamp do bloco: {timestamp_str}")
    
    # Analisar cada transação
    dog_transactions = []
    processed = 0
    
    for txid in txids:
        processed += 1
        if processed % 100 == 0:
            print(f"⏳ Processadas {processed}/{len(txids)} transações...")
        
        dog_tx = analyze_transaction(txid, dog_utxos, block_timestamp)
        if dog_tx:
            dog_tx['block_height'] = block_height
            dog_transactions.append(dog_tx)
            print(f"🎯 Transação DOG encontrada: {txid}")
    
    return dog_transactions

def load_existing_transactions():
    """Carrega transações existentes do arquivo"""
    output_file = "../backend/data/dog_transactions.json"
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r') as f:
                data = json.load(f)
                transactions = data.get('transactions', [])
                
                # Aplicar correção nas transações existentes
                corrected_transactions = []
                for tx in transactions:
                    corrected_tx = apply_correction_to_existing_transaction(tx)
                    corrected_transactions.append(corrected_tx)
                
                return corrected_transactions
        except:
            pass
    return []

def apply_correction_to_existing_transaction(tx):
    """Aplica correção em uma transação existente"""
    # Se a transação tem dog_outputs mas não tem dog_inputs,
    # significa que os inputs tinham DOG antes de ser gastos
    if len(tx.get('dog_outputs', [])) > 0 and len(tx.get('dog_inputs', [])) == 0:
        print(f"🔧 Aplicando correção em transação existente {tx['txid']}")
        # Atualizar all_inputs para marcar que tinham DOG antes
        for input_item in tx.get('all_inputs', []):
            if not input_item.get('has_dog', False):
                print(f"   📝 Corrigindo input {input_item['address']}: has_dog {input_item['has_dog']} -> True")
                input_item['has_dog'] = True
                input_item['had_dog_before'] = True
                # Como não temos acesso aos dog_utxos aqui, vamos deixar amount como 0
                # O valor será calculado pelo backend baseado no total movido
    return tx

def save_transactions(transactions, block_height):
    """Salva transações no arquivo"""
    # Mostrar resumo
    transfers = [tx for tx in transactions if tx['is_transfer']]
    mints = [tx for tx in transactions if tx['is_mint']]
    burns = [tx for tx in transactions if tx['is_burn']]
    
    output_data = {
        'timestamp': datetime.now().isoformat(),
        'block_height': block_height,
        'total_transactions': len(transactions),
        'transfers': len(transfers),
        'mints': len(mints),
        'burns': len(burns),
        'transactions': transactions
    }
    
    output_file = "../backend/data/dog_transactions.json"
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    return output_file

def main():
    """Função principal"""
    print("🚀 Iniciando busca por transações DOG...")
    
    # Obter bloco atual
    current_block = get_current_block()
    if not current_block:
        print("❌ Não foi possível obter bloco atual")
        return
    
    print(f"📊 Bloco atual: {current_block}")
    
    # Carregar transações existentes
    existing_transactions = load_existing_transactions()
    print(f"📋 Carregadas {len(existing_transactions)} transações existentes")
    
    # Analisar último bloco
    new_dog_transactions = find_dog_transactions_in_block(current_block)
    
    if new_dog_transactions:
        print(f"🎉 Encontradas {len(new_dog_transactions)} transações DOG no bloco {current_block}")
        
        # Combinar com transações existentes
        all_transactions = existing_transactions + new_dog_transactions
        
        # Remover duplicatas baseado no txid
        seen_txids = set()
        unique_transactions = []
        for tx in all_transactions:
            if tx['txid'] not in seen_txids:
                seen_txids.add(tx['txid'])
                unique_transactions.append(tx)
        
        print(f"📊 Total de transações únicas: {len(unique_transactions)}")
        
        # Salvar dados
        output_file = save_transactions(unique_transactions, current_block)
        print(f"💾 Dados salvos em {output_file}")
        
        # Mostrar resumo das novas transações
        print("\n🔍 NOVAS TRANSAÇÕES:")
        for i, tx in enumerate(new_dog_transactions):
            print(f"{i+1}. {tx['txid']}")
            print(f"   Tipo: {'Transfer' if tx['is_transfer'] else 'Mint' if tx['is_mint'] else 'Burn'}")
            print(f"   DOG movido: {tx['total_dog_moved_formatted']:,.2f}")
            print(f"   Inputs: {len(tx['dog_inputs'])}, Outputs: {len(tx['dog_outputs'])}")
            print(f"   Timestamp: {tx['timestamp']}")
            print()
    else:
        print(f"❌ Nenhuma transação DOG encontrada no bloco {current_block}")

if __name__ == "__main__":
    main()

