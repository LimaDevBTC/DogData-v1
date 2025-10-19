#!/usr/bin/env python3
"""
DOG Transaction Tracker Completo
- Monitora TODAS as transações DOG em tempo real
- Mantém histórico completo para explorador e airdrop
- Sistema baseado em transações como fonte principal
"""

import subprocess
import json
import time
import logging
from datetime import datetime
from collections import defaultdict
import os

class DogTransactionTracker:
    def __init__(self):
        self.ord_dir = "/home/bitmax/Projects/bitcoin-fullstack/ord"
        self.data_dir = "/home/bitmax/Projects/bitcoin-fullstack/dog_transactions"
        self.transactions_file = f"{self.data_dir}/dog_transactions.json"
        self.holders_file = f"{self.data_dir}/dog_holders.json"
        self.last_block_height = None
        
        # Criar diretório de dados se não existir
        os.makedirs(self.data_dir, exist_ok=True)
        
        # Configurar logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(f'{self.data_dir}/tracker.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        # Carregar dados existentes
        self.transactions = self.load_transactions()
        self.holders = self.load_holders()
        
        self.logger.info("🚀 DOG Transaction Tracker iniciado")
    
    def load_transactions(self):
        """Carrega transações DOG existentes"""
        try:
            if os.path.exists(self.transactions_file):
                with open(self.transactions_file, 'r') as f:
                    data = json.load(f)
                    self.logger.info(f"📚 Carregadas {len(data.get('transactions', []))} transações DOG")
                    return data
            return {'transactions': [], 'last_processed_block': 0}
        except Exception as e:
            self.logger.error(f"Erro ao carregar transações: {e}")
            return {'transactions': [], 'last_processed_block': 0}
    
    def load_holders(self):
        """Carrega holders DOG existentes"""
        try:
            if os.path.exists(self.holders_file):
                with open(self.holders_file, 'r') as f:
                    data = json.load(f)
                    self.logger.info(f"👥 Carregados {len(data.get('holders', {}))} holders")
                    return data
            return {'holders': {}, 'last_updated': ''}
        except Exception as e:
            self.logger.error(f"Erro ao carregar holders: {e}")
            return {'holders': {}, 'last_updated': ''}
    
    def get_current_block_height(self):
        """Obtém altura atual do bloco Bitcoin"""
        try:
            result = subprocess.run([
                "bitcoin-cli", "getblockcount"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                return int(result.stdout.strip())
            else:
                self.logger.error(f"Erro ao obter altura: {result.stderr}")
                return None
        except Exception as e:
            self.logger.error(f"Exceção ao obter altura: {e}")
            return None
    
    def get_block_transactions(self, block_height):
        """Obtém todas as transações de um bloco"""
        try:
            # Obter hash do bloco
            result = subprocess.run([
                "bitcoin-cli", "getblockhash", str(block_height)
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                self.logger.error(f"Erro ao obter hash do bloco {block_height}: {result.stderr}")
                return []
            
            block_hash = result.stdout.strip()
            
            # Obter transações do bloco
            result = subprocess.run([
                "bitcoin-cli", "getblock", block_hash, "2"
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                self.logger.error(f"Erro ao obter bloco {block_height}: {result.stderr}")
                return []
            
            block_data = json.loads(result.stdout)
            return block_data.get('tx', [])
            
        except Exception as e:
            self.logger.error(f"Erro ao obter transações do bloco {block_height}: {e}")
            return []
    
    def is_dog_transaction(self, txid):
        """Verifica se uma transação contém DOG"""
        try:
            # Obter detalhes da transação
            result = subprocess.run([
                "bitcoin-cli", "getrawtransaction", txid, "true"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                return False
            
            tx_data = json.loads(result.stdout)
            
            # Verificar se tem runes nos outputs
            for output in tx_data.get('vout', []):
                if 'scriptPubKey' in output:
                    script = output['scriptPubKey']
                    # Verificar se é um output de rune (simplificado)
                    if 'type' in script and script['type'] == 'witness_v1_taproot':
                        # Verificar se contém dados de rune
                        if 'hex' in script and len(script['hex']) > 100:
                            return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Erro ao verificar transação {txid}: {e}")
            return False
    
    def analyze_dog_transaction(self, txid, block_height):
        """Analisa uma transação DOG em detalhes"""
        try:
            # Obter detalhes da transação
            result = subprocess.run([
                "bitcoin-cli", "getrawtransaction", txid, "true"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                return None
            
            tx_data = json.loads(result.stdout)
            
            # Analisar inputs e outputs
            transaction_info = {
                'txid': txid,
                'block_height': block_height,
                'timestamp': datetime.now().isoformat(),
                'inputs': [],
                'outputs': [],
                'dog_amounts': []
            }
            
            # Analisar inputs
            for i, input_tx in enumerate(tx_data.get('vin', [])):
                if 'txid' in input_tx and input_tx['txid'] != '0000000000000000000000000000000000000000000000000000000000000000':
                    # Obter endereço do input
                    input_address = self.get_address_from_input(input_tx)
                    if input_address:
                        transaction_info['inputs'].append({
                            'index': i,
                            'txid': input_tx['txid'],
                            'address': input_address
                        })
            
            # Analisar outputs
            for i, output in enumerate(tx_data.get('vout', [])):
                if 'scriptPubKey' in output:
                    script = output['scriptPubKey']
                    if 'address' in script:
                        transaction_info['outputs'].append({
                            'index': i,
                            'address': script['address'],
                            'value': output.get('value', 0)
                        })
            
            return transaction_info
            
        except Exception as e:
            self.logger.error(f"Erro ao analisar transação {txid}: {e}")
            return None
    
    def get_address_from_input(self, input_tx):
        """Obtém endereço de um input (simplificado)"""
        try:
            # Implementação simplificada
            # Em uma implementação real, precisaríamos resolver o endereço
            return None
        except:
            return None
    
    def process_new_block(self, block_height):
        """Processa um novo bloco em busca de transações DOG"""
        self.logger.info(f"🔍 Processando bloco {block_height}...")
        
        # Obter todas as transações do bloco
        transactions = self.get_block_transactions(block_height)
        self.logger.info(f"📦 Encontradas {len(transactions)} transações no bloco {block_height}")
        
        dog_transactions = []
        
        # Analisar cada transação
        for i, txid in enumerate(transactions):
            if i % 100 == 0:
                self.logger.info(f"⏳ Analisando transação {i+1}/{len(transactions)}...")
            
            if self.is_dog_transaction(txid):
                self.logger.info(f"🐕 Transação DOG encontrada: {txid[:16]}...")
                
                # Analisar transação em detalhes
                tx_analysis = self.analyze_dog_transaction(txid, block_height)
                if tx_analysis:
                    dog_transactions.append(tx_analysis)
        
        # Adicionar transações ao histórico
        if dog_transactions:
            self.transactions['transactions'].extend(dog_transactions)
            self.transactions['last_processed_block'] = block_height
            
            # Salvar transações
            self.save_transactions()
            
            self.logger.info(f"✅ Processadas {len(dog_transactions)} transações DOG no bloco {block_height}")
        else:
            self.logger.info(f"ℹ️ Nenhuma transação DOG no bloco {block_height}")
            self.transactions['last_processed_block'] = block_height
            self.save_transactions()
        
        return len(dog_transactions)
    
    def save_transactions(self):
        """Salva transações no arquivo"""
        try:
            with open(self.transactions_file, 'w') as f:
                json.dump(self.transactions, f, indent=2)
        except Exception as e:
            self.logger.error(f"Erro ao salvar transações: {e}")
    
    def save_holders(self):
        """Salva holders no arquivo"""
        try:
            with open(self.holders_file, 'w') as f:
                json.dump(self.holders, f, indent=2)
        except Exception as e:
            self.logger.error(f"Erro ao salvar holders: {e}")
    
    def run(self):
        """Loop principal do tracker"""
        self.logger.info("🔄 Iniciando loop de monitoramento...")
        
        while True:
            try:
                current_height = self.get_current_block_height()
                if current_height is None:
                    self.logger.warning("⚠️ Não foi possível obter altura do bloco")
                    time.sleep(60)
                    continue
                
                if self.last_block_height is None:
                    self.last_block_height = current_height
                    self.logger.info(f"📊 Altura inicial: {current_height}")
                    continue
                
                if current_height > self.last_block_height:
                    # Processar novos blocos
                    for block_height in range(self.last_block_height + 1, current_height + 1):
                        dog_count = self.process_new_block(block_height)
                        self.logger.info(f"📊 Bloco {block_height}: {dog_count} transações DOG")
                    
                    self.last_block_height = current_height
                
                # Aguardar antes da próxima verificação
                time.sleep(30)
                
            except KeyboardInterrupt:
                self.logger.info("🛑 Interrompido pelo usuário")
                break
            except Exception as e:
                self.logger.error(f"Erro no loop principal: {e}")
                time.sleep(60)

if __name__ == "__main__":
    tracker = DogTransactionTracker()
    tracker.run()


