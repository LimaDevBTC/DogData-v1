#!/usr/bin/env python3
"""
🚀 DOG Transaction Tracker v2.0
Sistema otimizado para 32GB RAM com Ord server sempre rodando

FEATURES:
- Usa 'ord decode' (não causa lock no database)
- Resolve senders corretamente (Bitcoin Core RPC)
- Detecta TODAS transações DOG do bloco
- Ord server permanece online
- Otimizado para 32GB RAM

Workflow:
1. Pega todas TXs do bloco (Bitcoin Core)
2. Decodifica cada TX com 'ord decode --txid XXX'
3. Se tem runestone DOG → analisa
4. Resolve senders via Bitcoin Core RPC
5. Resolve receivers da própria TX
6. Salva dados para frontend

Autor: DOG Data Team
Data: 01/11/2025
"""

import subprocess
import json
import sys
import os
from datetime import datetime
from pathlib import Path

class DogTxTracker:
    def __init__(self):
        self.base_dir = Path(__file__).parent.parent
        self.ord_dir = Path("/home/bitmax/Projects/bitcoin-fullstack/ord")
        self.backend_data_dir = self.base_dir / 'backend' / 'data'
        self.public_data_dir = self.base_dir / 'public' / 'data'
        self.transactions_file = self.backend_data_dir / 'dog_transactions.json'
        
        # Criar diretórios se não existirem
        self.backend_data_dir.mkdir(parents=True, exist_ok=True)
        self.public_data_dir.mkdir(parents=True, exist_ok=True)
    
    def get_current_block(self):
        """Obtém o bloco atual do Bitcoin Core"""
        try:
            result = subprocess.run(
                ['bitcoin-cli', 'getblockchaininfo'], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            if result.returncode == 0:
                data = json.loads(result.stdout)
                return data['blocks']
        except Exception as e:
            print(f"❌ Erro ao obter bloco atual: {e}")
        return None
    
    def get_block_transactions(self, block_height):
        """Obtém todas as transações de um bloco"""
        try:
            # Obter hash do bloco
            result = subprocess.run(
                ['bitcoin-cli', 'getblockhash', str(block_height)], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            if result.returncode != 0:
                return [], None
            
            block_hash = result.stdout.strip()
            
            # Obter dados do bloco
            result = subprocess.run(
                ['bitcoin-cli', 'getblock', block_hash], 
                capture_output=True, 
                text=True, 
                timeout=30
            )
            if result.returncode != 0:
                return [], None
            
            block_data = json.loads(result.stdout)
            return block_data['tx'], block_data['time']
        except Exception as e:
            print(f"❌ Erro ao obter TXs do bloco: {e}")
            return [], None
    
    def decode_runestone(self, txid):
        """Decodifica runestone de uma TX usando ord decode (não causa lock!)"""
        try:
            result = subprocess.run(
                ['./target/release/ord', '--datadir', 'data', 'decode', '--txid', txid],
                cwd=str(self.ord_dir),
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode != 0:
                return None
            
            decoded = json.loads(result.stdout)
            runestone = decoded.get('runestone', {}).get('Runestone', {})
            
            if not runestone:
                return None
            
            # Verificar se tem DOG
            edicts = runestone.get('edicts', [])
            dog_edict = None
            
            for edict in edicts:
                if edict.get('id') == '840000:3':  # DOG rune ID
                    dog_edict = edict
                    break
            
            if dog_edict:
                return runestone
            
            return None
            
        except subprocess.TimeoutExpired:
            return None
        except Exception as e:
            return None
    
    def get_sender_address(self, prev_txid, prev_vout):
        """Resolve o endereço que ENVIOU (sender) de um UTXO gasto"""
        try:
            result = subprocess.run(
                ['bitcoin-cli', 'getrawtransaction', prev_txid, 'true'], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode == 0:
                prev_tx = json.loads(result.stdout)
                
                if prev_vout < len(prev_tx['vout']):
                    script_pubkey = prev_tx['vout'][prev_vout]['scriptPubKey']
                    address = script_pubkey.get('address', 'unknown')
                    
                    # Tratar casos especiais
                    if address == 'unknown' and 'type' in script_pubkey:
                        if script_pubkey['type'] == 'nulldata':
                            return 'OP_RETURN'
                        elif script_pubkey['type'] == 'nonstandard':
                            return 'NONSTANDARD'
                        else:
                            return f"UNKNOWN_{script_pubkey['type']}"
                    
                    return address
        except Exception as e:
            return 'ERROR'
        
        return 'UNKNOWN'
    
    def analyze_dog_transaction(self, txid, runestone, block_height, block_timestamp):
        """Analisa uma transação DOG completa"""
        try:
            # Obter dados completos da TX
            result = subprocess.run(
                ['bitcoin-cli', 'getrawtransaction', txid, 'true'], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode != 0:
                return None
            
            tx_data = json.loads(result.stdout)
            
            # Resolver SENDERS (inputs) COM VALORES
            senders = []
            for vin in tx_data.get('vin', []):
                if 'coinbase' in vin:
                    continue
                
                if 'txid' in vin and 'vout' in vin:
                    sender_address = self.get_sender_address(vin['txid'], vin['vout'])
                    
                    # Decodificar TX anterior para pegar valor DOG do input
                    prev_runestone = self.decode_runestone(vin['txid'])
                    input_dog_amount = 0
                    
                    if prev_runestone:
                        # Procurar edict que criou este output específico
                        for edict in prev_runestone.get('edicts', []):
                            if edict.get('id') == '840000:3':  # DOG
                                if edict.get('output') == vin['vout']:
                                    input_dog_amount = edict.get('amount', 0)
                                    break
                    
                    senders.append({
                        'address': sender_address,
                        'input': f"{vin['txid']}:{vin['vout']}",
                        'amount': input_dog_amount,
                        'amount_dog': input_dog_amount / 100000,
                        'has_dog': input_dog_amount > 0
                    })
            
            # Resolver RECEIVERS (outputs)
            # IMPORTANTE: Uma TX pode ter MÚLTIPLOS edicts DOG (consolidação + transferência)
            receivers = []
            edicts = runestone.get('edicts', [])
            
            # Processar TODOS os edicts DOG, não apenas o primeiro!
            for edict in edicts:
                if edict.get('id') == '840000:3':  # DOG
                    output_num = edict.get('output', 0)
                    amount = edict.get('amount', 0)
                    
                    if output_num < len(tx_data['vout']):
                        receiver_address = tx_data['vout'][output_num]['scriptPubKey'].get('address', 'UNKNOWN')
                        receivers.append({
                            'address': receiver_address,
                            'vout': output_num,
                            'amount': amount,
                            'amount_dog': amount / 100000  # Converter para DOG
                        })
            
            # Calcular total movido
            total_dog = sum(r['amount'] for r in receivers)
            
            # Determinar tipo
            tx_type = 'transfer'
            if len(senders) == 0:
                tx_type = 'mint'
            elif len(receivers) == 0:
                tx_type = 'burn'
            
            return {
                'txid': txid,
                'block_height': block_height,
                'timestamp': datetime.fromtimestamp(block_timestamp).isoformat() if block_timestamp else None,
                'type': tx_type,
                'senders': senders,
                'receivers': receivers,
                'total_dog_moved': total_dog / 100000,  # Em DOG
                'sender_count': len(senders),
                'receiver_count': len(receivers),
                'runestone': runestone  # Dados completos do runestone
            }
            
        except Exception as e:
            print(f"⚠️ Erro ao analisar TX {txid}: {e}")
            return None
    
    def find_dog_txs_in_block(self, block_height):
        """Encontra todas as transações DOG em um bloco"""
        print(f"\n🔍 Analisando bloco {block_height}...")
        
        # 1. Obter TXs do bloco
        txids, block_timestamp = self.get_block_transactions(block_height)
        if not txids:
            print("❌ Não foi possível obter TXs do bloco")
            return []
        
        print(f"📦 Bloco tem {len(txids)} transações")
        
        # 2. Analisar cada TX usando ord decode
        dog_transactions = []
        processed = 0
        
        for txid in txids:
            processed += 1
            
            # Log a cada 500 TXs
            if processed % 500 == 0:
                print(f"⏳ Processadas {processed}/{len(txids)} TXs...")
            
            # Decodificar runestone
            runestone = self.decode_runestone(txid)
            
            # Se não tem runestone ou não tem DOG, pular
            if not runestone:
                continue
            
            # Tem DOG! Analisar completamente
            dog_tx = self.analyze_dog_transaction(txid, runestone, block_height, block_timestamp)
            
            if dog_tx:
                dog_transactions.append(dog_tx)
                print(f"🎯 TX DOG: {txid}")
                print(f"   {dog_tx['sender_count']} senders → {dog_tx['receiver_count']} receivers")
                print(f"   Total: {dog_tx['total_dog_moved']:.2f} DOG")
        
        print(f"\n✅ Encontradas {len(dog_transactions)} transações DOG")
        return dog_transactions
    
    def load_existing_transactions(self):
        """Carrega transações existentes"""
        if self.transactions_file.exists():
            try:
                with open(self.transactions_file, 'r') as f:
                    data = json.load(f)
                    return data.get('transactions', [])
            except Exception as e:
                print(f"⚠️ Erro ao carregar transações existentes: {e}")
        return []
    
    def save_transactions(self, new_transactions, block_height):
        """Salva transações (append)"""
        try:
            # Carregar existentes
            existing = self.load_existing_transactions()
            
            # Adicionar novas (evitar duplicatas)
            existing_txids = {tx['txid'] for tx in existing}
            
            for tx in new_transactions:
                if tx['txid'] not in existing_txids:
                    existing.append(tx)
            
            # Ordenar por bloco e timestamp (mais recentes primeiro)
            existing.sort(
                key=lambda x: (x['block_height'], x['timestamp'] or ''),
                reverse=True
            )
            
            # Preparar dados
            output_data = {
                'timestamp': datetime.now().isoformat(),
                'total_transactions': len(existing),
                'last_block': block_height,
                'last_update': datetime.now().isoformat(),
                'transactions': existing
            }
            
            # Salvar em backend/data
            with open(self.transactions_file, 'w') as f:
                json.dump(output_data, f, indent=2)
            
            # Copiar para public/data (Vercel)
            public_file = self.public_data_dir / 'dog_transactions.json'
            with open(public_file, 'w') as f:
                json.dump(output_data, f, indent=2)
            
            print(f"💾 Salvas {len(existing)} transações totais ({len(new_transactions)} novas)")
            
            return True
            
        except Exception as e:
            print(f"❌ Erro ao salvar transações: {e}")
            return False

def main():
    """Função principal - processa bloco atual"""
    print("="*80)
    print("🚀 DOG Transaction Tracker v2.0")
    print("   Sistema otimizado - Ord server sempre online")
    print("="*80)
    
    tracker = DogTxTracker()
    
    # Obter bloco atual
    current_block = tracker.get_current_block()
    if not current_block:
        print("❌ Não foi possível obter bloco atual")
        return
    
    print(f"📊 Bloco atual: {current_block}")
    
    # Carregar transações existentes
    existing = tracker.load_existing_transactions()
    print(f"📋 Transações existentes: {len(existing)}")
    
    # Processar bloco atual
    new_dog_txs = tracker.find_dog_txs_in_block(current_block)
    
    # Salvar se encontrou algo
    if new_dog_txs:
        print(f"\n🎉 Encontradas {len(new_dog_txs)} novas transações DOG!")
        tracker.save_transactions(new_dog_txs, current_block)
        
        # Mostrar resumo
        print("\n📊 RESUMO DAS TRANSAÇÕES:")
        for i, tx in enumerate(new_dog_txs[:5]):  # Top 5
            print(f"{i+1}. {tx['txid'][:16]}...")
            print(f"   Tipo: {tx['type']}")
            print(f"   Senders: {', '.join([s['address'][:20] + '...' for s in tx['senders'][:2]])}")
            print(f"   Receivers: {', '.join([r['address'][:20] + '...' for r in tx['receivers'][:2]])}")
            print(f"   Total: {tx['total_dog_moved']:.2f} DOG")
        
        if len(new_dog_txs) > 5:
            print(f"   ... e mais {len(new_dog_txs) - 5} transações")
    else:
        print(f"\nℹ️ Nenhuma transação DOG no bloco {current_block}")
    
    print("\n✅ Processamento concluído!")

if __name__ == "__main__":
    main()

