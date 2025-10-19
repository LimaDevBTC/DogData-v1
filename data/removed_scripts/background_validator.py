#!/usr/bin/env python3
"""
DOG Background Validator
- Validação completa de dados 2-3x por dia
- Execução noturna para não impactar performance
- Corrige inconsistências e valida integridade
"""

import subprocess
import json
import time
import logging
import schedule
from datetime import datetime, time as dt_time
from collections import defaultdict

class DogBackgroundValidator:
    def __init__(self):
        self.ord_dir = "/home/bitmax/Projects/bitcoin-fullstack/ord"
        self.data_file = "/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/backend/data/dog_holders_by_address.json"
        self.validation_log = "/home/bitmax/Projects/bitcoin-fullstack/validation.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.validation_log),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
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
    
    def perform_full_validation(self):
        """Executa validação completa dos dados DOG"""
        try:
            self.logger.info("🔍 Iniciando validação completa dos dados DOG...")
            start_time = time.time()
            
            # 1. Obter dados atuais do arquivo
            with open(self.data_file, 'r') as f:
                current_data = json.load(f)
            
            current_holders = {h['address']: h for h in current_data.get('holders', [])}
            current_total = current_data.get('total_holders', 0)
            
            self.logger.info(f"📊 Dados atuais: {current_total} holders")
            
            # 2. Obter dados frescos do Ord
            self.logger.info("🔄 Obtendo dados frescos do Ord...")
            result = subprocess.run([
                './target/release/ord', '--data-dir', 'data', 'balances'
            ], cwd=self.ord_dir, capture_output=True, text=True, timeout=300)
            
            if result.returncode != 0:
                self.logger.error(f"❌ Erro ao obter dados do Ord: {result.stderr}")
                return False
            
            ord_data = json.loads(result.stdout)
            dog_balances = ord_data.get('runes', {}).get('DOG•GO•TO•THE•MOON', {})
            
            self.logger.info(f"📊 Ord retornou {len(dog_balances)} UTXOs DOG")
            
            # 3. Recalcular holders do zero
            self.logger.info("🔄 Recalculando holders do zero...")
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
                    if processed % 5000 == 0:
                        self.logger.info(f"⏳ Processados {processed}/{len(dog_balances)} UTXOs...")
            
            # 4. Comparar resultados
            fresh_holders = {}
            for address, total_amount in address_balances.items():
                fresh_holders[address] = {
                    'total_amount': total_amount,
                    'total_dog': total_amount / 100000
                }
            
            fresh_total = len(fresh_holders)
            
            self.logger.info(f"📊 Validação concluída:")
            self.logger.info(f"  - Holders atuais: {current_total}")
            self.logger.info(f"  - Holders frescos: {fresh_total}")
            self.logger.info(f"  - Diferença: {fresh_total - current_total}")
            self.logger.info(f"  - UTXOs processados: {processed}")
            self.logger.info(f"  - Erros de endereço: {errors}")
            
            # 5. Se há diferenças significativas, atualizar dados
            if abs(fresh_total - current_total) > 10:  # Tolerância de 10 holders
                self.logger.warning(f"⚠️ Diferença significativa detectada! Atualizando dados...")
                
                # Converter para lista e ordenar
                holders_list = []
                for address, data in fresh_holders.items():
                    holders_list.append({
                        'address': address,
                        'total_amount': data['total_amount'],
                        'total_dog': data['total_dog']
                    })
                
                holders_list.sort(key=lambda x: x['total_amount'], reverse=True)
                
                # Salvar dados validados
                validated_data = {
                    'timestamp': datetime.now().isoformat(),
                    'total_holders': fresh_total,
                    'total_utxos': len(dog_balances),
                    'last_processed_block': current_data.get('last_processed_block', 0),
                    'validation_timestamp': datetime.now().isoformat(),
                    'holders': holders_list
                }
                
                with open(self.data_file, 'w') as f:
                    json.dump(validated_data, f, indent=2)
                
                self.logger.info("✅ Dados atualizados com validação completa")
            else:
                self.logger.info("✅ Dados estão consistentes - nenhuma atualização necessária")
            
            elapsed = time.time() - start_time
            self.logger.info(f"🏁 Validação concluída em {elapsed:.2f} segundos")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Erro na validação: {e}")
            return False
    
    def schedule_validation(self):
        """Agenda validações automáticas"""
        # Validação às 2:00, 8:00 e 14:00
        schedule.every().day.at("02:00").do(self.perform_full_validation)
        schedule.every().day.at("08:00").do(self.perform_full_validation)
        schedule.every().day.at("14:00").do(self.perform_full_validation)
        
        self.logger.info("📅 Validações agendadas para 02:00, 08:00 e 14:00")
        
        while True:
            schedule.run_pending()
            time.sleep(60)  # Verificar a cada minuto
    
    def run_validation_now(self):
        """Executa validação imediatamente"""
        return self.perform_full_validation()

if __name__ == "__main__":
    validator = DogBackgroundValidator()
    
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "schedule":
        print("📅 Iniciando validador em modo agendado...")
        validator.schedule_validation()
    else:
        print("🔍 Executando validação imediata...")
        if validator.run_validation_now():
            print("✅ Validação concluída com sucesso!")
        else:
            print("❌ Erro na validação")
