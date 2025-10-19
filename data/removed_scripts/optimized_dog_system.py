#!/usr/bin/env python3
"""
Sistema DOG Otimizado
- Arquitetura baseada em transações
- Performance: ~1-2 segundos por bloco
- Validação automática em background
- Sistema profissional e escalável
"""

import time
import subprocess
import json
import requests
import signal
import sys
import logging
from datetime import datetime
from incremental_dog_updater import IncrementalDogUpdater
from background_validator import DogBackgroundValidator

class OptimizedDogSystem:
    def __init__(self):
        self.updater = IncrementalDogUpdater()
        self.validator = DogBackgroundValidator()
        self.running = True
        self.last_block_height = None
        
        # Configurar logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('/home/bitmax/Projects/bitcoin-fullstack/optimized_dog_system.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        # Configurar handlers para parada limpa
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        self.logger.info("🚀 Sistema DOG Otimizado iniciado")
    
    def signal_handler(self, signum, frame):
        self.logger.info("🛑 Recebido sinal de parada. Finalizando sistema...")
        self.running = False
    
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
    
    def is_new_block(self):
        """Verifica se há um novo bloco"""
        current_height = self.get_current_block_height()
        if current_height is None:
            return False
        
        if self.last_block_height is None:
            self.last_block_height = current_height
            self.logger.info(f"📊 Altura inicial do bloco: {current_height}")
            return False
        
        if current_height > self.last_block_height:
            self.logger.info(f"🆕 Novo bloco detectado! {self.last_block_height} → {current_height}")
            self.last_block_height = current_height
            return True
        
        return False
    
    def process_new_block(self):
        """Processa um novo bloco de forma otimizada"""
        try:
            start_time = time.time()
            self.logger.info("🔄 Processando novo bloco...")
            
            # Usar o sistema incremental otimizado
            if self.updater.update_dog_data():
                elapsed = time.time() - start_time
                self.logger.info(f"✅ Bloco processado em {elapsed:.2f} segundos")
                return True
            else:
                self.logger.error("❌ Falha ao processar bloco")
                return False
                
        except Exception as e:
            self.logger.error(f"Erro ao processar bloco: {e}")
            return False
    
    def run_validation_if_needed(self):
        """Executa validação se necessário"""
        try:
            current_hour = datetime.now().hour
            
            # Validação nas horas programadas (2, 8, 14)
            if current_hour in [2, 8, 14] and not hasattr(self, 'last_validation_hour'):
                self.logger.info(f"🔍 Executando validação programada às {current_hour}:00...")
                if self.validator.run_validation_now():
                    self.logger.info("✅ Validação programada concluída")
                else:
                    self.logger.error("❌ Erro na validação programada")
                
                self.last_validation_hour = current_hour
            elif current_hour not in [2, 8, 14]:
                # Reset do flag quando sair das horas de validação
                if hasattr(self, 'last_validation_hour'):
                    delattr(self, 'last_validation_hour')
                    
        except Exception as e:
            self.logger.error(f"Erro na validação: {e}")
    
    def check_system_health(self):
        """Verifica saúde do sistema"""
        try:
            # Verificar se backend está respondendo
            response = requests.get("http://localhost:3001/api/health", timeout=5)
            if response.status_code != 200:
                self.logger.warning("⚠️ Backend não está respondendo corretamente")
                return False
            
            # Verificar se Bitcoin Core está respondendo
            current_height = self.get_current_block_height()
            if current_height is None:
                self.logger.warning("⚠️ Bitcoin Core não está respondendo")
                return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Erro na verificação de saúde: {e}")
            return False
    
    def run(self):
        """Loop principal do sistema otimizado"""
        self.logger.info("🔄 Iniciando loop de monitoramento otimizado...")
        
        while self.running:
            try:
                # Verificar saúde do sistema
                if not self.check_system_health():
                    self.logger.warning("⚠️ Sistema com problemas de saúde - aguardando...")
                    time.sleep(60)
                    continue
                
                # Verificar novo bloco
                if self.is_new_block():
                    self.process_new_block()
                
                # Executar validação se necessário
                self.run_validation_if_needed()
                
                # Aguardar antes da próxima verificação
                time.sleep(30)
                
            except KeyboardInterrupt:
                self.logger.info("🛑 Interrompido pelo usuário")
                break
            except Exception as e:
                self.logger.error(f"Erro no loop principal: {e}")
                time.sleep(60)  # Aguardar 1 minuto em caso de erro
        
        self.logger.info("🏁 Sistema finalizado")

if __name__ == "__main__":
    system = OptimizedDogSystem()
    system.run()


