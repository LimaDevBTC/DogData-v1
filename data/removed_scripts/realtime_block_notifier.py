#!/usr/bin/env python3
"""
Sistema de Notificação em Tempo Real para Novos Blocos Bitcoin
Usa ZMQ para receber notificações instantâneas quando um novo bloco é minerado
"""

import zmq
import json
import subprocess
import time
import signal
import sys
import logging
from datetime import datetime

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/bitmax/Projects/bitcoin-fullstack/block_notifier.log'),
        logging.StreamHandler()
    ]
)

class RealtimeBlockNotifier:
    def __init__(self):
        self.context = zmq.Context()
        self.socket = None
        self.running = True
        self.last_block_height = 0
        self.ord_dir = "/home/bitmax/Projects/bitcoin-fullstack/ord"
        self.backend_url = "http://localhost:3001"
        
        # Configurar handlers para parada limpa
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        logging.info("🚀 Sistema de Notificação de Blocos Bitcoin iniciado")
    
    def signal_handler(self, signum, frame):
        logging.info("🛑 Recebido sinal de parada. Finalizando sistema...")
        self.running = False
    
    def setup_zmq_connection(self):
        """Configura conexão ZMQ com Bitcoin Node"""
        try:
            # Conectar ao socket ZMQ do Bitcoin Node
            self.socket = self.context.socket(zmq.SUB)
            self.socket.connect("tcp://127.0.0.1:28332")  # Porta padrão do Bitcoin ZMQ
            
            # Subscrever a notificações de blocos
            self.socket.setsockopt(zmq.SUBSCRIBE, b"rawblock")
            self.socket.setsockopt(zmq.SUBSCRIBE, b"hashblock")
            
            logging.info("✅ Conexão ZMQ estabelecida com Bitcoin Node")
            return True
            
        except Exception as e:
            logging.error(f"❌ Erro ao conectar ZMQ: {e}")
            return False
    
    def get_current_block_height(self):
        """Obtém a altura atual do bloco"""
        try:
            result = subprocess.run(['bitcoin-cli', 'getblockcount'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                return int(result.stdout.strip())
        except Exception as e:
            logging.error(f"Erro ao obter altura do bloco: {e}")
        return 0
    
    def update_ord_index(self):
        """Atualiza o índice do Ord"""
        try:
            logging.info("📚 Atualizando índice do Ord...")
            result = subprocess.run([
                "./target/release/ord", "index", "update"
            ], cwd=self.ord_dir, capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0:
                logging.info("✅ Índice do Ord atualizado")
                return True
            else:
                logging.error(f"❌ Erro ao atualizar Ord: {result.stderr}")
                return False
        except Exception as e:
            logging.error(f"❌ Exceção ao atualizar Ord: {e}")
            return False
    
    def extract_dog_data(self):
        """Extrai dados de DOG"""
        try:
            logging.info("🐕 Extraindo dados de DOG...")
            result = subprocess.run([
                "python3", "efficient_dog_extractor.py"
            ], cwd=self.ord_dir, capture_output=True, text=True, timeout=600)
            
            if result.returncode == 0:
                logging.info("✅ Dados de DOG extraídos")
                return True
            else:
                logging.error(f"❌ Erro ao extrair DOG: {result.stderr}")
                return False
        except Exception as e:
            logging.error(f"❌ Exceção ao extrair DOG: {e}")
            return False
    
    def reload_backend(self):
        """Recarrega dados no backend"""
        try:
            import requests
            response = requests.post(f"{self.backend_url}/api/reload-data", timeout=10)
            if response.status_code == 200:
                logging.info("✅ Backend recarregado")
                return True
            else:
                logging.error(f"❌ Erro ao recarregar backend: {response.status_code}")
                return False
        except Exception as e:
            logging.error(f"❌ Exceção ao recarregar backend: {e}")
            return False
    
    def process_new_block(self, block_height):
        """Processa um novo bloco"""
        logging.info(f"🆕 Processando novo bloco #{block_height}...")
        
        # 1. Atualizar índice Ord
        if not self.update_ord_index():
            logging.error("❌ Falha ao atualizar Ord")
            return False
        
        # 2. Extrair dados DOG
        if not self.extract_dog_data():
            logging.error("❌ Falha ao extrair DOG")
            return False
        
        # 3. Recarregar backend
        if not self.reload_backend():
            logging.error("❌ Falha ao recarregar backend")
            return False
        
        logging.info(f"✅ Bloco #{block_height} processado com sucesso!")
        return True
    
    def run(self):
        """Loop principal do sistema"""
        if not self.setup_zmq_connection():
            logging.error("❌ Falha ao configurar ZMQ. Usando fallback...")
            self.run_fallback()
            return
        
        # Obter altura inicial
        self.last_block_height = self.get_current_block_height()
        logging.info(f"📊 Altura inicial do bloco: {self.last_block_height}")
        
        logging.info("🔄 Aguardando notificações de novos blocos...")
        
        while self.running:
            try:
                # Aguardar notificação ZMQ (timeout de 1 segundo)
                if self.socket.poll(1000):  # 1000ms timeout
                    message = self.socket.recv_multipart()
                    topic = message[0].decode('utf-8')
                    
                    if topic == "hashblock":
                        block_hash = message[1].hex()
                        current_height = self.get_current_block_height()
                        
                        if current_height > self.last_block_height:
                            logging.info(f"🆕 Novo bloco detectado via ZMQ: #{current_height} ({block_hash[:16]}...)")
                            self.process_new_block(current_height)
                            self.last_block_height = current_height
                
            except KeyboardInterrupt:
                logging.info("🛑 Interrompido pelo usuário")
                break
            except Exception as e:
                logging.error(f"❌ Erro no loop ZMQ: {e}")
                time.sleep(5)
        
        self.cleanup()
    
    def run_fallback(self):
        """Fallback: verificação periódica se ZMQ não funcionar"""
        logging.info("🔄 Executando em modo fallback (verificação a cada 30s)...")
        
        self.last_block_height = self.get_current_block_height()
        
        while self.running:
            try:
                current_height = self.get_current_block_height()
                
                if current_height > self.last_block_height:
                    logging.info(f"🆕 Novo bloco detectado via fallback: #{current_height}")
                    self.process_new_block(current_height)
                    self.last_block_height = current_height
                
                time.sleep(30)  # Verificar a cada 30 segundos
                
            except KeyboardInterrupt:
                logging.info("🛑 Interrompido pelo usuário")
                break
            except Exception as e:
                logging.error(f"❌ Erro no fallback: {e}")
                time.sleep(60)
    
    def cleanup(self):
        """Limpeza dos recursos"""
        if self.socket:
            self.socket.close()
        if self.context:
            self.context.term()
        logging.info("🧹 Recursos limpos")

if __name__ == "__main__":
    notifier = RealtimeBlockNotifier()
    notifier.run()
