#!/usr/bin/env python3
"""
DOG Robust Monitor - Sistema Confiável de Atualização
- Varredura completa a cada bloco (mais confiável)
- Detecção automática de novos blocos
- Recarregamento automático do backend
- Logs detalhados
- Sistema de fallback
"""

import subprocess
import json
import time
import os
import requests
import logging
from datetime import datetime
from collections import defaultdict

class RobustDogMonitor:
    def __init__(self):
        self.ord_path = './target/release/ord'
        self.data_dir = 'data'
        self.output_file = '../DogData-v1/backend/data/dog_holders_by_address.json'
        self.last_block_height = 0
        self.backend_url = "http://localhost:3001"
        self.check_interval = 30  # Verificar a cada 30 segundos
        
        # Configurar logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('../DogData-v1/data/logs/robust_monitor.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def get_current_block_height(self):
        """Obtém a altura atual do bloco Bitcoin"""
        try:
            result = subprocess.run(['bitcoin-cli', 'getblockcount'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                return int(result.stdout.strip())
        except Exception as e:
            self.logger.error(f"Erro ao obter altura do bloco: {e}")
        return 0
    
    def get_address_from_utxo(self, txid, output):
        """Obtém o endereço de um UTXO específico usando gettxout"""
        try:
            result = subprocess.run(['bitcoin-cli', 'gettxout', txid, output], 
                                  capture_output=True, text=True, timeout=15)
            if result.returncode == 0:
                data = json.loads(result.stdout)
                return data['scriptPubKey']['address']
        except Exception as e:
            self.logger.warning(f"Erro ao resolver {txid}:{output} - {e}")
        return None
    
    def extract_dog_holders_complete(self):
        """Extrai todos os holders de DOG (método completo e confiável)"""
        self.logger.info("🔍 Iniciando extração completa de holders DOG...")
        
        try:
            # Obter dados de balance do Ord
            result = subprocess.run([self.ord_path, '--data-dir', self.data_dir, 'balances'], 
                                  capture_output=True, text=True, timeout=300)
            
            if result.returncode != 0:
                self.logger.error(f"Erro ao obter dados do Ord: {result.stderr}")
                return False
            
            # Processar dados
            holders_by_address = defaultdict(float)
            total_utxos = 0
            unresolved_utxos = 0
            
            self.logger.info("📊 Processando dados de balance...")
            
            try:
                # Tentar parsear como JSON completo
                data = json.loads(result.stdout)
                if 'runes' in data and 'DOG•GO•TO•THE•MOON' in data['runes']:
                    self.logger.info("📊 Processando estrutura JSON completa...")
                    for utxo, rune_data in data['runes']['DOG•GO•TO•THE•MOON'].items():
                        amount = float(rune_data['amount'])
                        
                        # Resolver endereço
                        txid, output = utxo.split(':')
                        address = self.get_address_from_utxo(txid, output)
                        
                        if address:
                            holders_by_address[address] += amount
                            total_utxos += 1
                        else:
                            unresolved_utxos += 1
                else:
                    self.logger.warning("DOG não encontrado na estrutura JSON")
                    return False
                    
            except json.JSONDecodeError as e:
                self.logger.error(f"Erro ao parsear JSON: {e}")
                return False
            
            # Converter para lista ordenada
            holders_list = []
            for address, amount in sorted(holders_by_address.items(), key=lambda x: x[1], reverse=True):
                holders_list.append({
                    'address': address,
                    'amount': amount
                })
            
            # Criar estrutura final
            final_data = {
                'total_holders': len(holders_list),
                'total_utxos': total_utxos,
                'unresolved_utxos': unresolved_utxos,
                'timestamp': datetime.now().isoformat(),
                'source': 'robust_complete_extraction',
                'holders': holders_list
            }
            
            # Salvar arquivo
            os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
            with open(self.output_file, 'w') as f:
                json.dump(final_data, f, indent=2)
            
            self.logger.info(f"✅ Extração concluída: {len(holders_list)} holders, {total_utxos} UTXOs")
            return True
            
        except Exception as e:
            self.logger.error(f"Erro na extração: {e}")
            return False
    
    def reload_backend_data(self):
        """Recarrega dados no backend"""
        try:
            self.logger.info("🔄 Recarregando dados no backend...")
            response = requests.post(f"{self.backend_url}/api/reload-data", timeout=10)
            if response.status_code == 200:
                self.logger.info("✅ Dados recarregados no backend")
                return True
            else:
                self.logger.error(f"❌ Erro ao recarregar backend: {response.status_code}")
                return False
        except Exception as e:
            self.logger.error(f"❌ Exceção ao recarregar backend: {e}")
            return False
    
    def check_backend_status(self):
        """Verifica se o backend está funcionando"""
        try:
            response = requests.get(f"{self.backend_url}/api/dog-rune/stats", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def run(self):
        """Loop principal do monitor"""
        self.logger.info("🚀 Iniciando DOG Robust Monitor...")
        
        # Verificar se estamos no diretório correto
        if not os.path.exists(self.ord_path):
            self.logger.error(f"❌ Ord não encontrado em {self.ord_path}")
            return
        
        # Verificar backend
        if not self.check_backend_status():
            self.logger.warning("⚠️ Backend não está respondendo, mas continuando...")
        
        # Obter altura inicial
        self.last_block_height = self.get_current_block_height()
        self.logger.info(f"📊 Altura inicial do bloco: {self.last_block_height}")
        
        # Primeira extração
        self.logger.info("🔄 Executando primeira extração...")
        if self.extract_dog_holders_complete():
            self.reload_backend_data()
        
        # Loop principal
        while True:
            try:
                current_height = self.get_current_block_height()
                
                if current_height > self.last_block_height:
                    self.logger.info(f"🆕 Novo bloco detectado: {current_height} (anterior: {self.last_block_height})")
                    
                    # Extrair dados atualizados
                    if self.extract_dog_holders_complete():
                        # Recarregar backend
                        self.reload_backend_data()
                        self.last_block_height = current_height
                    else:
                        self.logger.error("❌ Falha na extração, tentando novamente em 60 segundos...")
                        time.sleep(60)
                        continue
                else:
                    self.logger.debug(f"⏳ Aguardando novo bloco... (atual: {current_height})")
                
                time.sleep(self.check_interval)
                
            except KeyboardInterrupt:
                self.logger.info("🛑 Monitor interrompido pelo usuário")
                break
            except Exception as e:
                self.logger.error(f"❌ Erro no loop principal: {e}")
                time.sleep(60)

if __name__ == "__main__":
    monitor = RobustDogMonitor()
    monitor.run()
