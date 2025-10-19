#!/usr/bin/env python3
"""
DOG Transaction Tracker Eficiente
- Usa Ord para obter dados diretos de transações DOG
- Monitora apenas mudanças nos UTXOs DOG
- Sistema baseado em diferenças, não análise completa
"""

import subprocess
import json
import time
import logging
from datetime import datetime
import os

class EfficientDogTracker:
    def __init__(self):
        self.ord_dir = "/home/bitmax/Projects/bitcoin-fullstack/ord"
        self.data_dir = "/home/bitmax/Projects/bitcoin-fullstack/dog_data"
        self.last_balances_file = f"{self.data_dir}/last_balances.json"
        self.transactions_log = f"{self.data_dir}/transactions.json"
        
        # Criar diretório se não existir
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
        
        self.logger.info("🚀 Efficient DOG Tracker iniciado")
    
    def get_dog_balances(self):
        """Obtém balances DOG atuais do Ord"""
        try:
            result = subprocess.run([
                './target/release/ord', '--data-dir', 'data', 'balances'
            ], cwd=self.ord_dir, capture_output=True, text=True, timeout=60)
            
            if result.returncode != 0:
                self.logger.error(f"Erro ao obter balances: {result.stderr}")
                return None
            
            balances = json.loads(result.stdout)
            dog_balances = balances.get('runes', {}).get('DOG•GO•TO•THE•MOON', {})
            
            return {
                'timestamp': datetime.now().isoformat(),
                'balances': dog_balances,
                'total_utxos': len(dog_balances)
            }
            
        except Exception as e:
            self.logger.error(f"Erro ao obter balances DOG: {e}")
            return None
    
    def load_last_balances(self):
        """Carrega últimos balances conhecidos"""
        try:
            if os.path.exists(self.last_balances_file):
                with open(self.last_balances_file, 'r') as f:
                    return json.load(f)
            return None
        except Exception as e:
            self.logger.error(f"Erro ao carregar últimos balances: {e}")
            return None
    
    def save_balances(self, balances_data):
        """Salva balances atuais"""
        try:
            with open(self.last_balances_file, 'w') as f:
                json.dump(balances_data, f, indent=2)
        except Exception as e:
            self.logger.error(f"Erro ao salvar balances: {e}")
    
    def compare_balances(self, old_balances, new_balances):
        """Compara balances antigos e novos para detectar mudanças"""
        if not old_balances:
            return [], [], []
        
        old_utxos = set(old_balances.get('balances', {}).keys())
        new_utxos = set(new_balances.get('balances', {}).keys())
        
        # UTXOs que foram gastos (estavam no antigo, não estão no novo)
        spent_utxos = old_utxos - new_utxos
        
        # UTXOs que foram criados (estão no novo, não estavam no antigo)
        new_utxos_created = new_utxos - old_utxos
        
        # UTXOs que mudaram de quantidade
        changed_utxos = []
        common_utxos = old_utxos & new_utxos
        for utxo in common_utxos:
            old_amount = old_balances['balances'][utxo].get('amount', 0)
            new_amount = new_balances['balances'][utxo].get('amount', 0)
            if old_amount != new_amount:
                changed_utxos.append({
                    'utxo': utxo,
                    'old_amount': old_amount,
                    'new_amount': new_amount,
                    'change': new_amount - old_amount
                })
        
        return list(spent_utxos), list(new_utxos_created), changed_utxos
    
    def get_address_from_utxo(self, utxo_key):
        """Obtém endereço de um UTXO"""
        try:
            txid, output = utxo_key.split(':')
            result = subprocess.run([
                'bitcoin-cli', 'gettxout', txid, output
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                data = json.loads(result.stdout)
                return data.get('scriptPubKey', {}).get('address', '')
        except:
            pass
        return None
    
    def process_balance_changes(self, spent_utxos, new_utxos, changed_utxos):
        """Processa mudanças nos balances DOG"""
        transactions = []
        
        # Processar UTXOs gastos
        for utxo in spent_utxos:
            address = self.get_address_from_utxo(utxo)
            if address:
                transactions.append({
                    'type': 'spent',
                    'utxo': utxo,
                    'address': address,
                    'timestamp': datetime.now().isoformat()
                })
        
        # Processar novos UTXOs
        for utxo in new_utxos:
            address = self.get_address_from_utxo(utxo)
            if address:
                transactions.append({
                    'type': 'created',
                    'utxo': utxo,
                    'address': address,
                    'timestamp': datetime.now().isoformat()
                })
        
        # Processar UTXOs que mudaram
        for change in changed_utxos:
            address = self.get_address_from_utxo(change['utxo'])
            if address:
                transactions.append({
                    'type': 'changed',
                    'utxo': change['utxo'],
                    'address': address,
                    'old_amount': change['old_amount'],
                    'new_amount': change['new_amount'],
                    'change': change['change'],
                    'timestamp': datetime.now().isoformat()
                })
        
        return transactions
    
    def save_transactions(self, transactions):
        """Salva transações detectadas"""
        try:
            # Carregar transações existentes
            if os.path.exists(self.transactions_log):
                with open(self.transactions_log, 'r') as f:
                    existing_data = json.load(f)
            else:
                existing_data = {'transactions': []}
            
            # Adicionar novas transações
            existing_data['transactions'].extend(transactions)
            existing_data['last_updated'] = datetime.now().isoformat()
            
            # Salvar
            with open(self.transactions_log, 'w') as f:
                json.dump(existing_data, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Erro ao salvar transações: {e}")
    
    def run(self):
        """Loop principal do tracker eficiente"""
        self.logger.info("🔄 Iniciando monitoramento eficiente...")
        
        # Obter balances iniciais
        initial_balances = self.get_dog_balances()
        if initial_balances:
            self.save_balances(initial_balances)
            self.logger.info(f"📊 Balances iniciais: {initial_balances['total_utxos']} UTXOs")
        
        while True:
            try:
                # Obter balances atuais
                current_balances = self.get_dog_balances()
                if not current_balances:
                    self.logger.warning("⚠️ Não foi possível obter balances atuais")
                    time.sleep(60)
                    continue
                
                # Carregar balances anteriores
                last_balances = self.load_last_balances()
                
                # Comparar balances
                spent_utxos, new_utxos, changed_utxos = self.compare_balances(
                    last_balances, current_balances
                )
                
                # Se há mudanças, processar
                if spent_utxos or new_utxos or changed_utxos:
                    self.logger.info(f"🐕 Mudanças detectadas:")
                    self.logger.info(f"   💸 UTXOs gastos: {len(spent_utxos)}")
                    self.logger.info(f"   🆕 Novos UTXOs: {len(new_utxos)}")
                    self.logger.info(f"   🔄 UTXOs alterados: {len(changed_utxos)}")
                    
                    # Processar mudanças
                    transactions = self.process_balance_changes(
                        spent_utxos, new_utxos, changed_utxos
                    )
                    
                    # Salvar transações
                    self.save_transactions(transactions)
                    
                    self.logger.info(f"✅ Processadas {len(transactions)} transações DOG")
                else:
                    self.logger.info("ℹ️ Nenhuma mudança detectada")
                
                # Salvar balances atuais como referência
                self.save_balances(current_balances)
                
                # Aguardar antes da próxima verificação
                time.sleep(30)
                
            except KeyboardInterrupt:
                self.logger.info("🛑 Interrompido pelo usuário")
                break
            except Exception as e:
                self.logger.error(f"Erro no loop principal: {e}")
                time.sleep(60)

if __name__ == "__main__":
    tracker = EfficientDogTracker()
    tracker.run()


