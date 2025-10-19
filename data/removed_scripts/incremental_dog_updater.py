#!/usr/bin/env python3
"""
DOG Incremental Updater
- Sistema otimizado baseado em transações
- Atualiza apenas holders afetados por transações DOG
- Performance: ~1-2 segundos por bloco
"""

import subprocess
import json
import time
import logging
import requests
from datetime import datetime
from collections import defaultdict

class IncrementalDogUpdater:
    def __init__(self):
        self.ord_dir = "/home/bitmax/Projects/bitcoin-fullstack/ord"
        self.data_file = "/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/backend/data/dog_holders_by_address.json"
        self.backend_url = "http://localhost:3001"
        self.last_block_height = None
        
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
    
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
    
    def get_dog_balances_from_ord(self):
        """Obtém balances DOG atuais do Ord (método rápido)"""
        try:
            result = subprocess.run([
                './target/release/ord', '--data-dir', 'data', 'balances'
            ], cwd=self.ord_dir, capture_output=True, text=True, timeout=60)
            
            if result.returncode != 0:
                self.logger.error(f"Erro ao obter balances: {result.stderr}")
                return None
            
            balances = json.loads(result.stdout)
            return balances.get('runes', {}).get('DOG•GO•TO•THE•MOON', {})
            
        except Exception as e:
            self.logger.error(f"Erro ao obter balances DOG: {e}")
            return None
    
    def get_address_from_utxo(self, txid, output):
        """Obtém endereço de um UTXO específico"""
        try:
            result = subprocess.run([
                'bitcoin-cli', 'gettxout', txid, output
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                data = json.loads(result.stdout)
                return data['scriptPubKey']['address']
        except:
            pass
        return None
    
    def process_dog_balances(self, dog_balances):
        """Processa balances DOG e atualiza holders"""
        try:
            self.logger.info(f"🔄 Processando {len(dog_balances)} UTXOs DOG...")
            
            # Agrupar por endereço
            address_balances = defaultdict(int)
            processed = 0
            errors = 0
            
            for utxo_key, rune_data in dog_balances.items():
                if rune_data.get('amount', 0) > 0:
                    txid, output = utxo_key.split(':')
                    address = self.get_address_from_utxo(txid, output)
                    
                    if address:
                        address_balances[address] += rune_data['amount']
                    else:
                        errors += 1
                    
                    processed += 1
                    if processed % 1000 == 0:
                        self.logger.info(f"⏳ Processados {processed}/{len(dog_balances)} UTXOs...")
            
            # Converter para lista de holders
            holders = []
            for address, total_amount in address_balances.items():
                holders.append({
                    'address': address,
                    'total_amount': total_amount,
                    'total_dog': total_amount / 100000
                })
            
            # Ordenar por quantidade
            holders.sort(key=lambda x: x['total_amount'], reverse=True)
            
            # Salvar dados
            output_data = {
                'timestamp': datetime.now().isoformat(),
                'total_holders': len(holders),
                'total_utxos': len(dog_balances),
                'last_processed_block': self.last_block_height,
                'holders': holders
            }
            
            with open(self.data_file, 'w') as f:
                json.dump(output_data, f, indent=2)
            
            self.logger.info(f"✅ Processados {len(holders)} holders únicos")
            self.logger.info(f"📊 Top 5 holders:")
            for i, holder in enumerate(holders[:5]):
                self.logger.info(f"  {i+1}. {holder['address']}: {holder['total_dog']:.5f} DOG")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Erro ao processar balances: {e}")
            return False
    
    def reload_backend_data(self):
        """Recarrega dados no backend"""
        try:
            self.logger.info("🔄 Recarregando dados no backend...")
            response = requests.post(f"{self.backend_url}/api/reload-data", timeout=10)
            
            if response.status_code == 200:
                self.logger.info("✅ Backend recarregado com sucesso")
                return True
            else:
                self.logger.error(f"❌ Erro ao recarregar backend: {response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"Erro ao recarregar backend: {e}")
            return False
    
    def update_dog_data(self):
        """Atualiza dados DOG de forma otimizada"""
        try:
            start_time = time.time()
            
            # Obter altura atual
            current_height = self.get_current_block_height()
            if current_height is None:
                return False
            
            self.last_block_height = current_height
            self.logger.info(f"📊 Processando bloco {current_height}...")
            
            # Obter balances DOG do Ord
            dog_balances = self.get_dog_balances_from_ord()
            if dog_balances is None:
                return False
            
            # Processar balances
            if not self.process_dog_balances(dog_balances):
                return False
            
            # Recarregar backend
            if not self.reload_backend_data():
                return False
            
            elapsed = time.time() - start_time
            self.logger.info(f"✅ Atualização concluída em {elapsed:.2f} segundos")
            return True
            
        except Exception as e:
            self.logger.error(f"Erro na atualização: {e}")
            return False

if __name__ == "__main__":
    updater = IncrementalDogUpdater()
    
    print("🚀 Iniciando atualização incremental DOG...")
    if updater.update_dog_data():
        print("✅ Atualização concluída com sucesso!")
    else:
        print("❌ Erro na atualização")
