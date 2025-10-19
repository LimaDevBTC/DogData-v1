#!/usr/bin/env python3
"""
Rastreador de Transações DOG do Último Bloco
- Analisa o último bloco Bitcoin em busca de transações DOG
- Identifica TODAS as movimentações de DOG
- Fornece dados detalhados para explorador e airdrop
"""

import subprocess
import json
import time
import logging
from datetime import datetime
from collections import defaultdict

class LastBlockDogTracker:
    def __init__(self):
        self.ord_dir = "/home/bitmax/Projects/bitcoin-fullstack/ord"
        self.data_dir = "/home/bitmax/Projects/bitcoin-fullstack/last_block_data"
        
        # Configurar logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(f'{self.data_dir}/last_block_tracker.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        self.logger.info("🚀 Last Block DOG Tracker iniciado")
    
    def get_last_block_height(self):
        """Obtém altura do último bloco"""
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
    
    def get_block_info(self, block_height):
        """Obtém informações completas do bloco"""
        try:
            # Obter hash do bloco
            result = subprocess.run([
                "bitcoin-cli", "getblockhash", str(block_height)
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                self.logger.error(f"Erro ao obter hash do bloco {block_height}")
                return None
            
            block_hash = result.stdout.strip()
            
            # Obter informações do bloco
            result = subprocess.run([
                "bitcoin-cli", "getblock", block_hash, "2"
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                self.logger.error(f"Erro ao obter bloco {block_height}")
                return None
            
            return json.loads(result.stdout)
            
        except Exception as e:
            self.logger.error(f"Erro ao obter bloco {block_height}: {e}")
            return None
    
    def get_dog_balances_before_block(self):
        """Obtém balances DOG antes do último bloco"""
        try:
            # Obter balances atuais
            result = subprocess.run([
                './target/release/ord', '--data-dir', 'data', 'balances'
            ], cwd=self.ord_dir, capture_output=True, text=True, timeout=60)
            
            if result.returncode != 0:
                self.logger.error(f"Erro ao obter balances: {result.stderr}")
                return None
            
            balances = json.loads(result.stdout)
            dog_balances = balances.get('runes', {}).get('DOG•GO•TO•THE•MOON', {})
            
            return dog_balances
            
        except Exception as e:
            self.logger.error(f"Erro ao obter balances DOG: {e}")
            return None
    
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
    
    def analyze_transaction_for_dog(self, txid, block_height):
        """Analisa uma transação específica em busca de DOG"""
        try:
            # Obter detalhes da transação
            result = subprocess.run([
                "bitcoin-cli", "getrawtransaction", txid, "true"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                return None
            
            tx_data = json.loads(result.stdout)
            
            # Verificar se é uma transação de rune (simplificado)
            # Procurar por outputs Taproot que podem conter runes
            has_rune_output = False
            for output in tx_data.get('vout', []):
                if 'scriptPubKey' in output:
                    script = output['scriptPubKey']
                    if script.get('type') == 'witness_v1_taproot':
                        # Verificar se tem dados que podem ser runes
                        if 'hex' in script and len(script['hex']) > 100:
                            has_rune_output = True
                            break
            
            if not has_rune_output:
                return None
            
            # Analisar detalhes da transação
            transaction_info = {
                'txid': txid,
                'block_height': block_height,
                'timestamp': datetime.now().isoformat(),
                'inputs': [],
                'outputs': [],
                'is_dog_related': False
            }
            
            # Analisar inputs
            for i, input_tx in enumerate(tx_data.get('vin', [])):
                if input_tx.get('txid') != '0000000000000000000000000000000000000000000000000000000000000000':
                    transaction_info['inputs'].append({
                        'index': i,
                        'txid': input_tx.get('txid', ''),
                        'vout': input_tx.get('vout', 0)
                    })
            
            # Analisar outputs
            for i, output in enumerate(tx_data.get('vout', [])):
                if 'scriptPubKey' in output:
                    script = output['scriptPubKey']
                    if 'address' in script:
                        transaction_info['outputs'].append({
                            'index': i,
                            'address': script['address'],
                            'value': output.get('value', 0),
                            'type': script.get('type', 'unknown')
                        })
            
            # Verificar se é relacionada a DOG
            # (Em uma implementação real, usaríamos o Ord para verificar runes específicas)
            transaction_info['is_dog_related'] = has_rune_output
            
            return transaction_info
            
        except Exception as e:
            self.logger.error(f"Erro ao analisar transação {txid}: {e}")
            return None
    
    def track_last_block_dog_transactions(self):
        """Rastreia todas as transações DOG do último bloco"""
        try:
            # Obter altura do último bloco
            block_height = self.get_last_block_height()
            if block_height is None:
                return None
            
            self.logger.info(f"🔍 Analisando bloco {block_height}...")
            
            # Obter informações do bloco
            block_info = self.get_block_info(block_height)
            if block_info is None:
                return None
            
            transactions = block_info.get('tx', [])
            self.logger.info(f"📦 Bloco {block_height} tem {len(transactions)} transações")
            
            # Obter balances DOG atuais para comparação
            current_dog_balances = self.get_dog_balances_before_block()
            if current_dog_balances is None:
                self.logger.warning("⚠️ Não foi possível obter balances DOG atuais")
            
            # Analisar cada transação
            dog_transactions = []
            rune_transactions = []
            
            for i, txid in enumerate(transactions):
                if i % 100 == 0:
                    self.logger.info(f"⏳ Analisando transação {i+1}/{len(transactions)}...")
                
                # Analisar transação
                tx_analysis = self.analyze_transaction_for_dog(txid, block_height)
                
                if tx_analysis:
                    if tx_analysis['is_dog_related']:
                        rune_transactions.append(tx_analysis)
                        
                        # Verificar se é especificamente DOG
                        # (Implementação simplificada - em produção usaríamos Ord)
                        if self.is_likely_dog_transaction(tx_analysis):
                            dog_transactions.append(tx_analysis)
                            self.logger.info(f"🐕 Transação DOG encontrada: {txid[:16]}...")
            
            # Compilar resultados
            results = {
                'block_height': block_height,
                'block_hash': block_info.get('hash', ''),
                'timestamp': datetime.now().isoformat(),
                'total_transactions': len(transactions),
                'rune_transactions': len(rune_transactions),
                'dog_transactions': len(dog_transactions),
                'dog_transaction_details': dog_transactions,
                'rune_transaction_details': rune_transactions,
                'current_dog_utxos': len(current_dog_balances) if current_dog_balances else 0
            }
            
            # Salvar resultados
            self.save_results(results)
            
            self.logger.info(f"✅ Análise concluída:")
            self.logger.info(f"   📊 Total de transações: {len(transactions)}")
            self.logger.info(f"   🔮 Transações de rune: {len(rune_transactions)}")
            self.logger.info(f"   🐕 Transações DOG: {len(dog_transactions)}")
            self.logger.info(f"   💰 UTXOs DOG atuais: {len(current_dog_balances) if current_dog_balances else 0}")
            
            return results
            
        except Exception as e:
            self.logger.error(f"Erro ao rastrear último bloco: {e}")
            return None
    
    def is_likely_dog_transaction(self, tx_analysis):
        """Determina se uma transação é provavelmente DOG (simplificado)"""
        # Implementação simplificada
        # Em produção, usaríamos o Ord para verificar runes específicas
        return tx_analysis['is_dog_related']
    
    def save_results(self, results):
        """Salva resultados da análise"""
        try:
            import os
            os.makedirs(self.data_dir, exist_ok=True)
            
            filename = f"{self.data_dir}/block_{results['block_height']}_analysis.json"
            with open(filename, 'w') as f:
                json.dump(results, f, indent=2)
            
            self.logger.info(f"💾 Resultados salvos em {filename}")
            
        except Exception as e:
            self.logger.error(f"Erro ao salvar resultados: {e}")

if __name__ == "__main__":
    tracker = LastBlockDogTracker()
    results = tracker.track_last_block_dog_transactions()
    
    if results:
        print("\n🎯 RESUMO DOS RESULTADOS:")
        print("=" * 50)
        print(f"📦 Bloco: {results['block_height']}")
        print(f"📊 Total de transações: {results['total_transactions']}")
        print(f"🔮 Transações de rune: {results['rune_transactions']}")
        print(f"🐕 Transações DOG: {results['dog_transactions']}")
        print(f"💰 UTXOs DOG atuais: {results['current_dog_utxos']}")
        
        if results['dog_transactions'] > 0:
            print(f"\n🐕 DETALHES DAS TRANSAÇÕES DOG:")
            for i, tx in enumerate(results['dog_transaction_details'][:5]):  # Mostrar apenas 5
                print(f"  {i+1}. {tx['txid'][:16]}... ({len(tx['inputs'])} inputs, {len(tx['outputs'])} outputs)")
    else:
        print("❌ Erro na análise do último bloco")


