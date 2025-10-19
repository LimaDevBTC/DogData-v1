#!/usr/bin/env python3
"""
Sistema Automatizado DOG Data
- Monitora novos blocos Bitcoin
- Atualiza dados de DOG automaticamente
- Continua indexação do Ord
- Mantém sistema sempre atualizado
"""

import time
import subprocess
import json
import requests
import os
import signal
import sys
from datetime import datetime
import logging

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/bitmax/Projects/bitcoin-fullstack/dog_system.log'),
        logging.StreamHandler()
    ]
)

class AutomatedDogSystem:
    def __init__(self):
        self.ord_dir = "/home/bitmax/Projects/bitcoin-fullstack/ord"
        self.backend_dir = "/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/backend"
        self.data_file = "/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/backend/data/dog_holders_by_address.json"
        self.last_block_height = None
        self.running = True
        
        # Configurar handlers para parada limpa
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        logging.info("🚀 Sistema Automatizado DOG Data iniciado")
    
    def signal_handler(self, signum, frame):
        logging.info("🛑 Recebido sinal de parada. Finalizando sistema...")
        self.running = False
    
    def get_current_block_height(self):
        """Obtém a altura atual do bloco Bitcoin"""
        try:
            result = subprocess.run([
                "bitcoin-cli", "getblockcount"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                return int(result.stdout.strip())
            else:
                logging.error(f"Erro ao obter altura do bloco: {result.stderr}")
                return None
        except Exception as e:
            logging.error(f"Exceção ao obter altura do bloco: {e}")
            return None
    
    def is_new_block(self):
        """Verifica se há um novo bloco"""
        current_height = self.get_current_block_height()
        if current_height is None:
            return False
        
        if self.last_block_height is None:
            self.last_block_height = current_height
            logging.info(f"📊 Altura inicial do bloco: {current_height}")
            return False
        
        if current_height > self.last_block_height:
            logging.info(f"🆕 Novo bloco detectado! {self.last_block_height} → {current_height}")
            self.last_block_height = current_height
            return True
        
        return False
    
    def update_ord_index(self):
        """Aguarda o indexador principal processar o novo bloco"""
        try:
            logging.info("⏳ Aguardando indexador principal processar novo bloco...")
            # Aguarda 30 segundos para o indexador principal processar
            time.sleep(30)
            logging.info("✅ Aguardou processamento do indexador principal")
            return True
        except Exception as e:
            logging.error(f"❌ Exceção ao aguardar indexador: {e}")
            return False
    
    def extract_dog_data(self):
        """Extrai dados atualizados de DOG"""
        try:
            logging.info("🐕 Extraindo dados de DOG...")
            result = subprocess.run([
                "python3", "efficient_dog_extractor.py"
            ], cwd=self.ord_dir, capture_output=True, text=True, timeout=600)
            
            if result.returncode == 0:
                logging.info("✅ Dados de DOG extraídos com sucesso")
                return True
            else:
                logging.error(f"❌ Erro ao extrair dados DOG: {result.stderr}")
                return False
        except subprocess.TimeoutExpired:
            logging.error("⏰ Timeout ao extrair dados DOG")
            return False
        except Exception as e:
            logging.error(f"❌ Exceção ao extrair dados DOG: {e}")
            return False
    
    def reload_backend_data(self):
        """Recarrega dados no backend"""
        try:
            logging.info("🔄 Recarregando dados no backend...")
            response = requests.post("http://localhost:3001/api/reload-data", timeout=10)
            if response.status_code == 200:
                logging.info("✅ Dados recarregados no backend")
                return True
            else:
                logging.error(f"❌ Erro ao recarregar backend: {response.status_code}")
                return False
        except Exception as e:
            logging.error(f"❌ Exceção ao recarregar backend: {e}")
            return False
    
    def process_new_block(self):
        """Processa um novo bloco"""
        logging.info("🔄 Processando novo bloco...")
        
        # 1. Atualizar índice Ord
        if not self.update_ord_index():
            logging.error("❌ Falha ao atualizar índice Ord")
            return False
        
        # 2. Extrair dados DOG
        if not self.extract_dog_data():
            logging.error("❌ Falha ao extrair dados DOG")
            return False
        
        # 3. Recarregar backend
        if not self.reload_backend_data():
            logging.error("❌ Falha ao recarregar backend")
            return False
        
        logging.info("✅ Novo bloco processado com sucesso!")
        return True
    
    def run(self):
        """Loop principal do sistema"""
        logging.info("🔄 Iniciando loop de monitoramento...")
        
        while self.running:
            try:
                if self.is_new_block():
                    self.process_new_block()
                
                # Aguardar 30 segundos antes da próxima verificação
                time.sleep(30)
                
            except KeyboardInterrupt:
                logging.info("🛑 Interrompido pelo usuário")
                break
            except Exception as e:
                logging.error(f"❌ Erro no loop principal: {e}")
                time.sleep(60)  # Aguardar 1 minuto em caso de erro
        
        logging.info("🏁 Sistema finalizado")

if __name__ == "__main__":
    system = AutomatedDogSystem()
    system.run()
