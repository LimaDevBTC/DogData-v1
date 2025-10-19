#!/usr/bin/env python3
import subprocess
import json
import time
import os
import requests
from collections import defaultdict
from datetime import datetime

class DogRealtimeMonitor:
    def __init__(self):
        self.ord_path = './target/release/ord'
        self.data_dir = 'data'
        self.output_file = '../DogData-v1/backend/data/dog_holders_by_address.json'
        self.last_block_height = 0
        self.holders_cache = {}
        
    def get_current_block_height(self):
        """Obtém a altura atual do bloco Bitcoin"""
        try:
            result = subprocess.run(['bitcoin-cli', 'getblockcount'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                return int(result.stdout.strip())
        except:
            pass
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
            print(f"Erro ao resolver {txid}:{output} - {e}")
        return None
    
    def reload_backend_data(self):
        """Recarrega dados no backend"""
        try:
            print("🔄 Recarregando dados no backend...")
            response = requests.post("http://localhost:3001/api/reload-data", timeout=10)
            if response.status_code == 200:
                print("✅ Dados recarregados no backend")
                return True
            else:
                print(f"❌ Erro ao recarregar backend: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Exceção ao recarregar backend: {e}")
            return False
    
    def extract_dog_holders(self):
        """Extrai holders de DOG agrupados por endereço"""
        print(f"🔍 [{datetime.now().strftime('%H:%M:%S')}] Extraindo dados de DOG...")
        
        try:
            # Obter dados de balance
            result = subprocess.run([self.ord_path, '--data-dir', self.data_dir, 'balances'], 
                                  capture_output=True, text=True, timeout=300)
            
            if result.returncode != 0:
                print(f"❌ Erro ao obter dados: {result.stderr}")
                return False
            
            balances = json.loads(result.stdout)
            dog_runes = balances['runes']['DOG•GO•TO•THE•MOON']
            
            print(f"�� Encontrados {len(dog_runes)} UTXOs com DOG")
            
            # Agrupar por endereço
            address_balances = defaultdict(int)
            processed = 0
            errors = 0
            
            for utxo_key, rune_data in dog_runes.items():
                if rune_data['amount'] > 0:
                    txid, output = utxo_key.split(':')
                    address = self.get_address_from_utxo(txid, output)
                    
                    if address:
                        address_balances[address] += rune_data['amount']
                    else:
                        errors += 1
                    
                    processed += 1
                    if processed % 10000 == 0:
                        print(f"⏳ Processados {processed}/{len(dog_runes)} UTXOs... (Erros: {errors})")
            
            # Converter para lista e ordenar
            holders = []
            for address, total_amount in address_balances.items():
                holders.append({
                    'address': address,
                    'total_amount': total_amount,
                    'total_dog': total_amount / 100000
                })
            
            holders.sort(key=lambda x: x['total_amount'], reverse=True)
            
            print(f"✅ Encontrados {len(holders)} holders únicos")
            print(f"❌ UTXOs não resolvidos: {errors}")
            
            # Salvar dados
            output_data = {
                'timestamp': datetime.now().isoformat(),
                'total_holders': len(holders),
                'total_utxos': len(dog_runes),
                'unresolved_utxos': errors,
                'holders': holders
            }
            
            with open(self.output_file, 'w') as f:
                json.dump(output_data, f, indent=2)
            
            print(f"💾 Dados salvos em {self.output_file}")
            print(f"🏆 Top 5 holders:")
            for i, holder in enumerate(holders[:5]):
                print(f"  {i+1}. {holder['address']}: {holder['total_dog']:.5f} DOG")
            
            # Recarregar dados no backend
            self.reload_backend_data()
            
            return True
            
        except Exception as e:
            print(f"❌ Erro durante extração: {e}")
            return False
    
    def check_for_new_blocks(self):
        """Verifica se há novos blocos"""
        current_height = self.get_current_block_height()
        if current_height > self.last_block_height:
            print(f"🆕 Novo bloco detectado: {current_height} (anterior: {self.last_block_height})")
            self.last_block_height = current_height
            return True
        return False
    
    def run_monitor(self):
        """Executa o monitor em tempo real"""
        print("🚀 Iniciando monitor de DOG em tempo real...")
        print("📊 Monitorando novos blocos Bitcoin para atualizar holders...")
        
        # Extração inicial
        if not self.extract_dog_holders():
            print("❌ Falha na extração inicial")
            return
        
        self.last_block_height = self.get_current_block_height()
        
        # Loop de monitoramento
        while True:
            try:
                time.sleep(30)  # Verificar a cada 30 segundos
                
                if self.check_for_new_blocks():
                    print(f"🔄 Atualizando dados de holders...")
                    if self.extract_dog_holders():
                        print("✅ Dados atualizados com sucesso!")
                    else:
                        print("❌ Falha na atualização")
                
            except KeyboardInterrupt:
                print("\n🛑 Monitor interrompido pelo usuário")
                break
            except Exception as e:
                print(f"❌ Erro no monitor: {e}")
                time.sleep(60)  # Aguardar 1 minuto antes de tentar novamente

if __name__ == "__main__":
    monitor = DogRealtimeMonitor()
    monitor.run_monitor()
