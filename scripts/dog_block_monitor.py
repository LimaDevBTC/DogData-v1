#!/usr/bin/env python3
"""
🚀 DOG Block Monitor - Sistema Completo de Tracking
Sistema otimizado para 32GB RAM

WORKFLOW:
1. Detecta novo bloco Bitcoin
2. Rastreia TODAS transações DOG do bloco
3. Identifica senders (endereços de envio)
4. Salva transações para frontend
5. Atualiza holders
6. Repete a cada novo bloco

Autor: DOG Data Team
Data: 01/11/2025
Versão: 2.0 (otimizado para 32GB RAM)
"""

import subprocess
import json
import time
import os
import signal
import sys
import logging
from datetime import datetime
from pathlib import Path
from collections import defaultdict

class DogBlockMonitor:
    def __init__(self):
        # Caminhos
        self.base_dir = Path(__file__).parent.parent
        self.ord_dir = Path("/home/bitmax/Projects/bitcoin-fullstack/ord")
        self.data_dir = self.base_dir / 'data'
        self.backend_data_dir = self.base_dir / 'backend' / 'data'
        self.public_data_dir = self.base_dir / 'public' / 'data'
        
        # Arquivos de saída
        self.transactions_file = self.backend_data_dir / 'dog_transactions.json'
        self.holders_file = self.backend_data_dir / 'dog_holders_by_address.json'

        # Caminho do binário do ord
        self.ord_binary = self.ord_dir / 'target' / 'release' / 'ord'
        self.state_file = self.data_dir / 'monitor_state.json'
        
        # Estado
        self.last_block_height = None
        self.running = True
        
        # Configurar logging
        log_dir = self.data_dir / 'logs'
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / 'dog_block_monitor.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        # Signal handlers para parada limpa
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        self.logger.info("=" * 80)
        self.logger.info("🚀 DOG Block Monitor v2.0 - Sistema Completo")
        self.logger.info("=" * 80)
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
                    self.logger.info(f"📂 Estado carregado: último bloco {self.last_block_height}")
            except Exception as e:
                self.logger.warning(f"⚠️ Não foi possível carregar estado: {e}")
    
    def save_state(self):
        """Salva estado atual"""
        try:
            state = {
                'last_block_height': self.last_block_height,
                'last_update': datetime.now().isoformat()
            }
            with open(self.state_file, 'w') as f:
                json.dump(state, f, indent=2)
            self.logger.info(f"💾 Estado salvo: bloco {self.last_block_height}")
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
            self.logger.error(f"❌ Erro ao obter altura do bloco: {e}")
        return None
    
    def get_dog_utxos(self):
        """Obtém todos os UTXOs com DOG dos dados já extraídos"""
        try:
            self.logger.info("📊 Carregando UTXOs DOG do arquivo de holders...")
            
            # Usar dados já extraídos (mais eficiente e não causa lock)
            holders_candidates = [
                self.backend_data_dir / 'dog_holders_by_address.json',
                self.data_dir / 'dog_holders_by_address.json',
                self.public_data_dir / 'dog_holders_by_address.json'
            ]

            holders_file = next((path for path in holders_candidates if path.exists()), None)

            if not holders_file:
                self.logger.warning("⚠️ Arquivo de holders não encontrado em backend/data, data/ ou public/data. Execute efficient_dog_extractor.py primeiro")
                return {}
            
            with open(holders_file, 'r') as f:
                data = json.load(f)
            
            # Sem detalhamento de UTXOs aqui — retornamos dict vazio apenas para compatibilidade
            self.logger.info(f"✅ Dados de holders carregados: {data.get('total_holders', 0)} holders (fonte: {holders_file})")
            return {}
            
        except Exception as e:
            self.logger.error(f"❌ Erro ao carregar UTXOs DOG: {e}")
            return {}
    
    def get_sender_address(self, txid, vout):
        """Obtém o endereço que ENVIOU (sender) de um UTXO gasto"""
        try:
            # Obter a transação anterior
            result = subprocess.run(
                ['bitcoin-cli', 'getrawtransaction', txid, 'true'], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode == 0:
                prev_tx = json.loads(result.stdout)
                
                # Pegar o output específico que foi gasto
                if vout < len(prev_tx['vout']):
                    script_pubkey = prev_tx['vout'][vout]['scriptPubKey']
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
                    
        except subprocess.TimeoutExpired:
            self.logger.warning(f"⏱️ Timeout ao resolver sender {txid}:{vout}")
            return 'TIMEOUT'
        except Exception as e:
            self.logger.warning(f"⚠️ Erro ao resolver sender {txid}:{vout}: {e}")
            return 'ERROR'
        
        return 'UNKNOWN'
    
    def get_receiver_address(self, txid, vout):
        """Obtém o endereço que RECEBEU (receiver) - mais simples pois está na TX atual"""
        try:
            result = subprocess.run(
                ['bitcoin-cli', 'getrawtransaction', txid, 'true'], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode == 0:
                tx_data = json.loads(result.stdout)
                
                if vout < len(tx_data['vout']):
                    script_pubkey = tx_data['vout'][vout]['scriptPubKey']
                    return script_pubkey.get('address', 'UNKNOWN')
                    
        except Exception as e:
            self.logger.warning(f"⚠️ Erro ao resolver receiver {txid}:{vout}: {e}")
        
        return 'UNKNOWN'
    
    def analyze_transaction_dog(self, txid, dog_utxos, block_height, block_timestamp):
        """Analisa uma transação para ver se movimenta DOG"""
        try:
            # Obter dados da transação
            result = subprocess.run(
                ['bitcoin-cli', 'getrawtransaction', txid, 'true'], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode != 0:
                return None
            
            tx_data = json.loads(result.stdout)

            # Decodificar runestone via ord
            if not self.ord_binary.exists():
                self.logger.warning("⚠️ Binário do ord não encontrado, pulando decode")
                return None

            ord_result = subprocess.run(
                [str(self.ord_binary), 'decode', '--txid', txid],
                capture_output=True,
                text=True,
                timeout=15
            )

            if ord_result.returncode != 0:
                self.logger.warning(f"⚠️ Erro ao decodificar runestone da TX {txid}: {ord_result.stderr}")
                return None

            try:
                ord_data = json.loads(ord_result.stdout)
            except json.JSONDecodeError:
                self.logger.warning(f"⚠️ Não foi possível interpretar saída do ord para {txid}")
                return None

            runestone = (ord_data.get('runestone') or {}).get('Runestone')
            if not runestone:
                return None

            dog_edicts = [edict for edict in runestone.get('edicts', []) if edict.get('id') == '840000:3']
            if not dog_edicts:
                return None
 
            # Verificar inputs (quem ENVIOU)
            senders = []
            total_dog_in = 0
            
            for vin in tx_data.get('vin', []):
                if 'coinbase' in vin:
                    continue
                
                if 'txid' in vin and 'vout' in vin:
                    input_utxo_key = f"{vin['txid']}:{vin['vout']}"
                    
                    # Verificar se esse UTXO tinha DOG (antes de ser gasto)
                    # Precisamos verificar com Ord ou assumir baseado nos outputs
                    sender_address = self.get_sender_address(vin['txid'], vin['vout'])
                    
                    # Se a TX tem outputs com DOG, então inputs tinham DOG
                    # Vamos marcar e depois calcular
                    senders.append({
                        'address': sender_address,
                        'utxo': input_utxo_key,
                        'amount': 0  # Será calculado depois
                    })
            
            # Verificar outputs (quem RECEBEU)
            receivers = []
            total_dog_out = 0

            for edict in dog_edicts:
                output_index = edict.get('output')
                amount_raw = edict.get('amount', 0)
                if output_index is None or output_index >= len(tx_data.get('vout', [])):
                    if output_index is None:
                        continue
                    fallback_index = output_index - 1
                    if fallback_index < 0 or fallback_index >= len(tx_data.get('vout', [])):
                        self.logger.debug(f"⚠️ Edict aponta para output {output_index} inexistente na TX {txid[:8]}… ignorando")
                        continue
                    output_index = fallback_index
 
                vout = tx_data['vout'][output_index]
                script = vout.get('scriptPubKey', {})
                address = script.get('address')
                if not address:
                    # Tentar lista de addresses (ex: P2SH)
                    addresses = script.get('addresses')
                    if addresses:
                        address = addresses[0]
                    else:
                        address = script.get('desc', 'UNKNOWN')

                receivers.append({
                    'address': address,
                    'vout': output_index,
                    'amount': amount_raw,
                    'amount_dog': amount_raw / 100000,
                    'has_dog': True
                })

                total_dog_out += amount_raw
 
            # Se tem outputs com DOG, então é uma transação DOG!
            if len(receivers) > 0:
                # Calcular total DOG dos inputs (assumir igual ao total de outputs)
                total_dog_in = total_dog_out
                
                # Distribuir valor entre os senders proporcionalmente (simplificação)
                if len(senders) > 0:
                    dog_per_sender = total_dog_in // len(senders)
                    remainder = total_dog_in % len(senders)
                    for index, sender in enumerate(senders):
                        amount_raw = dog_per_sender + (remainder if index == 0 else 0)
                        sender['amount'] = amount_raw
                        sender['amount_dog'] = amount_raw / 100000
                        sender['has_dog'] = True

                # Determinar tipo de transação
                tx_type = 'transfer'
                if len(senders) == 0:
                    tx_type = 'mint'  # Criação
                elif len(receivers) == 0:
                    tx_type = 'burn'  # Queima
                
                return {
                    'txid': txid,
                    'block_height': block_height,
                    'timestamp': datetime.fromtimestamp(block_timestamp).isoformat() if block_timestamp else None,
                    'type': tx_type,
                    'senders': senders,
                    'receivers': receivers,
                    'total_dog_moved': total_dog_out / 100000,  # Em DOG
                    'sender_count': len(senders),
                    'receiver_count': len(receivers),
                    'runestone': runestone
                }
        
        except Exception as e:
            self.logger.warning(f"⚠️ Erro ao analisar TX {txid}: {e}")
        
        return None
    
    def find_dog_transactions_in_block(self, block_height):
        """Encontra todas as transações DOG em um bloco"""
        self.logger.info(f"🔍 Analisando bloco {block_height}...")
        
        try:
            # 1. Obter UTXOs com DOG
            dog_utxos = self.get_dog_utxos()

            # 2. Obter hash do bloco
            result = subprocess.run(
                ['bitcoin-cli', 'getblockhash', str(block_height)], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            if result.returncode != 0:
                self.logger.error(f"❌ Erro ao obter hash do bloco: {result.stderr}")
                return []
            
            block_hash = result.stdout.strip()
            
            # 3. Obter dados do bloco
            result = subprocess.run(
                ['bitcoin-cli', 'getblock', block_hash], 
                capture_output=True, 
                text=True, 
                timeout=30
            )
            if result.returncode != 0:
                self.logger.error(f"❌ Erro ao obter dados do bloco: {result.stderr}")
                return []
            
            block_data = json.loads(result.stdout)
            txids = block_data['tx']
            block_timestamp = block_data['time']
            
            self.logger.info(f"📦 Bloco tem {len(txids)} transações")
            
            # 4. Analisar cada transação
            dog_transactions = []
            processed = 0
            
            for txid in txids:
                processed += 1
                
                if processed % 500 == 0:
                    self.logger.info(f"⏳ Processadas {processed}/{len(txids)} transações...")
                
                dog_tx = self.analyze_transaction_dog(txid, dog_utxos, block_height, block_timestamp)
                
                if dog_tx:
                    dog_transactions.append(dog_tx)
                    self.logger.info(f"🎯 TX DOG: {txid} | {dog_tx['sender_count']} senders → {dog_tx['receiver_count']} receivers | {dog_tx['total_dog_moved']:.2f} DOG")
            
            self.logger.info(f"✅ Encontradas {len(dog_transactions)} transações DOG no bloco {block_height}")
            return dog_transactions
            
        except Exception as e:
            self.logger.error(f"❌ Erro ao processar bloco {block_height}: {e}")
            return []
    
    def save_transactions(self, new_transactions):
        """Salva transações (append ao arquivo existente)"""
        try:
            # Carregar transações existentes
            existing_transactions = []
            if self.transactions_file.exists():
                with open(self.transactions_file, 'r') as f:
                    data = json.load(f)
                    existing_transactions = data.get('transactions', [])
            
            # Adicionar novas (evitar duplicatas)
            existing_txids = {tx['txid'] for tx in existing_transactions}
            for tx in new_transactions:
                if tx['txid'] not in existing_txids:
                    existing_transactions.append(tx)
            
            # Ordenar por block_height e timestamp
            existing_transactions.sort(
                key=lambda x: (x['block_height'], x['timestamp'] or ''),
                reverse=True  # Mais recentes primeiro
            )
            
            # Salvar
            output_data = {
                'timestamp': datetime.now().isoformat(),
                'total_transactions': len(existing_transactions),
                'last_block': self.last_block_height,
                'transactions': existing_transactions
            }
            
            with open(self.transactions_file, 'w') as f:
                json.dump(output_data, f, indent=2)
            
            # Copiar para public/ (Vercel)
            public_file = self.public_data_dir / 'dog_transactions.json'
            with open(public_file, 'w') as f:
                json.dump(output_data, f, indent=2)
            
            self.logger.info(f"💾 Salvas {len(existing_transactions)} transações totais ({len(new_transactions)} novas)")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Erro ao salvar transações: {e}")
            return False
    
    def update_holders(self):
        """Atualiza holders usando efficient_dog_extractor.py"""
        try:
            self.logger.info("🔄 Atualizando holders...")
            
            result = subprocess.run(
                ['python3', 'efficient_dog_extractor.py'],
                cwd=str(self.ord_dir),
                capture_output=True,
                text=True,
                timeout=600  # 10 minutos max
            )
            
            if result.returncode == 0:
                self.logger.info("✅ Holders atualizados com sucesso")
                # Log do output do script
                for line in result.stdout.split('\n'):
                    if line.strip():
                        self.logger.info(f"  {line}")
                return True
            else:
                self.logger.error(f"❌ Erro ao atualizar holders: {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            self.logger.error("❌ Timeout ao atualizar holders (>10min)")
            return False
        except Exception as e:
            self.logger.error(f"❌ Erro ao atualizar holders: {e}")
            return False
    
    def process_new_block(self, block_height):
        """Processa um novo bloco completamente"""
        self.logger.info("=" * 80)
        self.logger.info(f"🆕 PROCESSANDO NOVO BLOCO: {block_height}")
        self.logger.info("=" * 80)
        
        start_time = time.time()
        
        try:
            # 1. Rastrear transações DOG
            self.logger.info("🔍 ETAPA 1: Rastreando transações DOG...")
            dog_transactions = self.find_dog_transactions_in_block(block_height)
            
            # 2. Salvar transações
            if dog_transactions:
                self.logger.info("💾 ETAPA 2: Salvando transações...")
                self.save_transactions(dog_transactions)
            else:
                self.logger.info("ℹ️ Nenhuma transação DOG neste bloco")
            
            # 3. Atualizar holders
            self.logger.info("👥 ETAPA 3: Atualizando holders...")
            self.update_holders()
            
            # 4. Atualizar estado
            self.last_block_height = block_height
            self.save_state()
            
            elapsed = time.time() - start_time
            self.logger.info("=" * 80)
            self.logger.info(f"✅ BLOCO {block_height} PROCESSADO EM {elapsed:.2f}s")
            self.logger.info("=" * 80)
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Erro ao processar bloco {block_height}: {e}")
            return False
    
    def run(self):
        """Loop principal de monitoramento"""
        self.logger.info("🎯 Iniciando monitoramento de blocos...")
        
        # Obter bloco inicial
        current_height = self.get_current_block_height()
        if not current_height:
            self.logger.error("❌ Não foi possível obter altura inicial do bloco")
            return
        
        if self.last_block_height is None:
            self.last_block_height = current_height
            self.logger.info(f"📊 Bloco inicial: {current_height}")
            self.logger.info("ℹ️ Sistema iniciado. Aguardando próximo bloco...")
        else:
            # Verificar se perdemos blocos
            if current_height > self.last_block_height:
                missed_blocks = current_height - self.last_block_height
                self.logger.warning(f"⚠️ Sistema estava offline! Perdemos {missed_blocks} blocos")
                self.logger.info(f"🔄 Processando blocos perdidos: {self.last_block_height + 1} até {current_height}")
                
                # Processar blocos perdidos
                for block in range(self.last_block_height + 1, current_height + 1):
                    self.logger.info(f"📦 Processando bloco perdido: {block}")
                    self.process_new_block(block)
        
        # Loop principal
        check_interval = 30  # Verificar a cada 30 segundos
        
        while self.running:
            try:
                time.sleep(check_interval)
                
                current_height = self.get_current_block_height()
                if not current_height:
                    continue
                
                # Novo bloco detectado?
                if current_height > self.last_block_height:
                    self.process_new_block(current_height)
                
            except Exception as e:
                self.logger.error(f"❌ Erro no loop principal: {e}")
                time.sleep(60)  # Aguardar 1 min antes de tentar novamente

def main():
    monitor = DogBlockMonitor()
    monitor.run()

if __name__ == "__main__":
    main()

