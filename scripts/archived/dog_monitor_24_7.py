#!/usr/bin/env python3
"""
🔄 DOG Monitor 24/7 - Sistema Completo
Monitora blocos Bitcoin e atualiza transações + holders automaticamente

WORKFLOW a cada novo bloco:
1. Detecta novo bloco Bitcoin (poll a cada 30s)
2. Rastreia transações DOG (dog_tx_tracker_v2.py)
3. Atualiza holders (efficient_dog_extractor.py)
4. Frontend sempre atualizado
5. Repete

FEATURES:
- Sistema robusto com retry
- Salva estado (pode parar e retomar)
- Recupera blocos perdidos se ficar offline
- Ord server sempre online
- Logs detalhados

Autor: DOG Data Team
Data: 01/11/2025
Versão: 2.0 (32GB RAM)
"""

import subprocess
import json
import time
import signal
import sys
import logging
from datetime import datetime
from pathlib import Path

class DogMonitor247:
    def __init__(self):
        self.base_dir = Path(__file__).parent.parent
        self.ord_dir = Path("/home/bitmax/Projects/bitcoin-fullstack/ord")
        self.data_dir = self.base_dir / 'data'
        self.state_file = self.data_dir / 'monitor_state.json'
        self.snapshot_file = self.data_dir / 'last_utxo_snapshot.json'
        self.last_block_height = None
        self.last_snapshot = {}
        self.running = True
        
        # Criar diretórios
        (self.base_dir / 'data' / 'logs').mkdir(parents=True, exist_ok=True)
        
        # Configurar logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.base_dir / 'data' / 'logs' / 'dog_monitor_24_7.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        # Signal handlers
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        self.logger.info("="*80)
        self.logger.info("🚀 DOG Monitor 24/7 - Sistema Completo Iniciado")
        self.logger.info("="*80)
        
        self.load_state()
    
    def signal_handler(self, signum, frame):
        """Handler para parada limpa"""
        self.logger.info("🛑 Recebido sinal de parada. Salvando estado...")
        self.save_state()
        self.running = False
        sys.exit(0)
    
    def load_state(self):
        """Carrega estado anterior"""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    state = json.load(f)
                    self.last_block_height = state.get('last_block_height')
                    self.logger.info(f"📂 Estado carregado: último bloco processado = {self.last_block_height}")
            except Exception as e:
                self.logger.warning(f"⚠️ Erro ao carregar estado: {e}")
    
    def save_state(self):
        """Salva estado atual"""
        try:
            state = {
                'last_block_height': self.last_block_height,
                'last_update': datetime.now().isoformat()
            }
            with open(self.state_file, 'w') as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            self.logger.error(f"❌ Erro ao salvar estado: {e}")
    
    def get_current_block_height(self):
        """Obtém altura atual do bloco Bitcoin"""
        try:
            result = subprocess.run(
                ['bitcoin-cli', 'getblockcount'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                return int(result.stdout.strip())
        except Exception as e:
            self.logger.error(f"❌ Erro ao obter altura: {e}")
        return None
    
    def track_transactions(self, block_height):
        """Rastreia transações DOG do bloco"""
        self.logger.info(f"🔍 Rastreando transações do bloco {block_height}...")
        
        try:
            result = subprocess.run(
                ['python3', 'scripts/dog_tx_tracker_v2.py'],
                cwd=str(self.base_dir),
                capture_output=True,
                text=True,
                timeout=600  # 10min max por bloco
            )
            
            if result.returncode == 0:
                # Contar quantas TXs foram encontradas
                output_lines = result.stdout.split('\n')
                for line in output_lines:
                    if 'Encontradas' in line and 'transações DOG' in line:
                        self.logger.info(f"   {line.strip()}")
                
                self.logger.info("✅ Transações rastreadas com sucesso")
                return True
            else:
                self.logger.error(f"❌ Erro ao rastrear transações: {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            self.logger.error("❌ Timeout ao rastrear transações (>10min)")
            return False
        except Exception as e:
            self.logger.error(f"❌ Erro: {e}")
            return False
    
    def update_holders(self):
        """Atualiza holders usando efficient_dog_extractor.py"""
        self.logger.info("👥 Atualizando holders...")
        
        try:
            # IMPORTANTE: Parar Ord temporariamente para evitar lock
            self.logger.info("   Parando Ord server temporariamente...")
            subprocess.run(['pkill', '-f', 'ord.*server'], timeout=5)
            time.sleep(3)
            
            # Executar extrator
            result = subprocess.run(
                ['python3', 'efficient_dog_extractor.py'],
                cwd=str(self.ord_dir),
                capture_output=True,
                text=True,
                timeout=600
            )
            
            # Religar Ord
            self.logger.info("   Religando Ord server...")
            subprocess.Popen(
                ['nohup', 'ord', '--datadir', 'data', '--index-runes', 'server', '--http-port', '8080'],
                cwd=str(self.ord_dir),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            time.sleep(5)
            
            if result.returncode == 0:
                # Parsear output
                for line in result.stdout.split('\n'):
                    if 'holders' in line.lower() or 'UTXOs' in line:
                        self.logger.info(f"   {line.strip()}")
                
                self.logger.info("✅ Holders atualizados com sucesso")
                return True
            else:
                self.logger.error(f"❌ Erro ao atualizar holders: {result.stderr}")
                return False
                
        except Exception as e:
            self.logger.error(f"❌ Erro ao atualizar holders: {e}")
            # Tentar religar Ord mesmo com erro
            try:
                subprocess.Popen(
                    ['nohup', 'ord', '--datadir', 'data', '--index-runes', 'server', '--http-port', '8080'],
                    cwd=str(self.ord_dir),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            except:
                pass
            return False
    
    def get_dog_utxos_snapshot(self):
        """Obtém snapshot completo de UTXOs DOG (ORD OFFLINE)"""
        try:
            self.logger.info("📸 Obtendo snapshot de UTXOs DOG...")
            
            ord_dir = Path("/home/bitmax/Projects/bitcoin-fullstack/ord")
            result = subprocess.run(
                ['./target/release/ord', '--datadir', 'data', 'balances'],
                cwd=str(ord_dir),
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode != 0:
                self.logger.error(f"❌ Erro ao obter balances: {result.stderr}")
                return {}
            
            balances = json.loads(result.stdout)
            dog_utxos = balances.get('runes', {}).get('DOG•GO•TO•THE•MOON', {})
            
            self.logger.info(f"✅ Snapshot: {len(dog_utxos)} UTXOs DOG")
            return dog_utxos
            
        except Exception as e:
            self.logger.error(f"❌ Erro ao obter snapshot: {e}")
            return {}
    
    def track_transactions_v3(self, block_height, dog_utxos):
        """Rastreia transações usando tracker v3 com snapshot"""
        self.logger.info(f"🔍 Rastreando transações do bloco {block_height}...")
        
        try:
            # Salvar snapshot temporário
            temp_snapshot = self.data_dir / 'temp_utxo_snapshot.json'
            with open(temp_snapshot, 'w') as f:
                json.dump(dog_utxos, f)
            
            # Chamar tracker v3
            result = subprocess.run(
                ['python3', 'scripts/dog_tx_tracker_v3.py', str(temp_snapshot)],
                cwd=str(self.base_dir),
                capture_output=True,
                text=True,
                timeout=600
            )
            
            # Remover snapshot temporário
            temp_snapshot.unlink()
            
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if 'Encontradas' in line or 'TX DOG' in line or 'Salvas' in line:
                        self.logger.info(f"   {line.strip()}")
                
                self.logger.info("✅ Transações rastreadas")
                return True
            else:
                self.logger.error(f"❌ Erro: {result.stderr}")
                return False
                
        except Exception as e:
            self.logger.error(f"❌ Erro: {e}")
            return False
    
    def process_block(self, block_height):
        """Processa um bloco completo - WORKFLOW COM SNAPSHOT ANTERIOR"""
        self.logger.info("="*80)
        self.logger.info(f"📦 PROCESSANDO BLOCO {block_height}")
        self.logger.info("="*80)
        
        start_time = time.time()
        
        try:
            # 1. PARAR ORD
            self.logger.info("🛑 Parando Ord server...")
            subprocess.run(['pkill', '-f', 'ord.*server'], timeout=5)
            time.sleep(3)
            
            # 2. SNAPSHOT DE UTXOs (estado ANTES deste bloco!)
            # Este snapshot contém os UTXOs que serão gastos no bloco atual
            current_snapshot = self.get_dog_utxos_snapshot()
            
            if not current_snapshot:
                self.logger.error("❌ Falha ao obter snapshot")
                # Tentar religar Ord
                subprocess.Popen(
                    ['nohup', 'ord', '--datadir', 'data', '--index-runes', 'server', '--http-port', '8080'],
                    cwd=str(self.ord_dir),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                return False
            
            # 3. RASTREAR TRANSAÇÕES usando snapshot atual (bloco N-1)
            # Os inputs do bloco N estarão neste snapshot!
            if not self.track_transactions_v3(block_height, current_snapshot):
                self.logger.warning("⚠️ Falha ao rastrear transações")
            
            # 4. ATUALIZAR HOLDERS
            # Isso vai gerar novo snapshot (bloco N)
            if not self.update_holders():
                self.logger.warning("⚠️ Falha ao atualizar holders")
            
            # 5. SALVAR SNAPSHOT ATUAL para próximo bloco
            # (Opcional - snapshot é feito no próximo ciclo)
            
            # 6. RELIGAR ORD
            self.logger.info("🔄 Religando Ord server...")
            subprocess.Popen(
                ['nohup', 'ord', '--datadir', 'data', '--index-runes', 'server', '--http-port', '8080'],
                cwd=str(self.ord_dir),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            time.sleep(5)
            
            # 7. SALVAR ESTADO
            self.last_block_height = block_height
            self.save_state()
            
            elapsed = time.time() - start_time
            self.logger.info("="*80)
            self.logger.info(f"✅ BLOCO {block_height} PROCESSADO EM {elapsed:.1f}s")
            self.logger.info("="*80)
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Erro crítico: {e}")
            # Tentar religar Ord mesmo com erro
            try:
                subprocess.Popen(
                    ['nohup', 'ord', '--datadir', 'data', '--index-runes', 'server', '--http-port', '8080'],
                    cwd=str(self.ord_dir),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            except:
                pass
            return False
    
    def run(self):
        """Loop principal de monitoramento"""
        self.logger.info("🎯 Iniciando monitoramento contínuo...")
        
        # Obter altura inicial
        current_height = self.get_current_block_height()
        if not current_height:
            self.logger.error("❌ Não foi possível obter altura inicial")
            return
        
        if self.last_block_height is None:
            self.last_block_height = current_height
            self.logger.info(f"📊 Altura inicial: {current_height}")
            self.logger.info("ℹ️ Sistema pronto. Aguardando próximo bloco...")
        else:
            # Verificar blocos perdidos
            if current_height > self.last_block_height:
                missed = current_height - self.last_block_height
                self.logger.warning(f"⚠️ Sistema estava offline! {missed} blocos perdidos")
                
                # Perguntar se quer processar blocos perdidos
                if missed <= 10:
                    self.logger.info(f"🔄 Processando {missed} blocos perdidos...")
                    for block in range(self.last_block_height + 1, current_height + 1):
                        self.logger.info(f"📦 Processando bloco perdido: {block}/{current_height}")
                        self.process_block(block)
                        time.sleep(2)  # Pequena pausa entre blocos
                else:
                    self.logger.warning(f"⚠️ Muitos blocos perdidos ({missed}). Pulando para o atual.")
                    self.last_block_height = current_height - 1
        
        # Loop principal
        check_interval = 30  # Checar a cada 30 segundos
        
        while self.running:
            try:
                time.sleep(check_interval)
                
                current_height = self.get_current_block_height()
                if not current_height:
                    self.logger.warning("⚠️ Não conseguiu obter altura. Tentando novamente...")
                    continue
                
                # Novo bloco?
                if current_height > self.last_block_height:
                    self.logger.info(f"🆕 NOVO BLOCO DETECTADO: {self.last_block_height} → {current_height}")
                    self.process_block(current_height)
                
            except KeyboardInterrupt:
                self.logger.info("🛑 Interrompido pelo usuário")
                break
            except Exception as e:
                self.logger.error(f"❌ Erro no loop: {e}")
                time.sleep(60)  # Aguardar 1min antes de tentar novamente

def main():
    monitor = DogMonitor247()
    monitor.run()

if __name__ == "__main__":
    main()

