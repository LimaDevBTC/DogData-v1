#!/usr/bin/env python3
"""
Extrator simples e confiável de holders DOG
Usa o método que já funcionou anteriormente
"""

import json
import subprocess
import os
from collections import defaultdict
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/data/logs/simple_extractor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def get_address_from_utxo(txid, output):
    """Resolve endereço de um UTXO usando bitcoin-cli"""
    try:
        result = subprocess.run([
            'bitcoin-cli', 'gettxout', txid, output
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data.get('scriptPubKey', {}).get('address')
    except Exception as e:
        logger.warning(f"Erro ao resolver {txid}:{output} - {e}")
    return None

def extract_dog_holders():
    """Extrai todos os holders de DOG"""
    logger.info("🚀 Iniciando extração simples de holders DOG...")
    
    try:
        # Usar ord balances
        result = subprocess.run([
            '/home/bitmax/Projects/bitcoin-fullstack/ord/target/release/ord',
            '--data-dir', '/home/bitmax/Projects/bitcoin-fullstack/ord/data',
            'balances'
        ], capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            logger.error(f"Erro ao executar ord: {result.stderr}")
            return False
        
        # Parsear JSON
        data = json.loads(result.stdout)
        
        if 'runes' not in data or 'DOG•GO•TO•THE•MOON' not in data['runes']:
            logger.error("DOG não encontrado nos dados")
            return False
        
        holders_by_address = defaultdict(float)
        total_utxos = 0
        unresolved_utxos = 0
        
        logger.info("📊 Processando UTXOs DOG...")
        
        for utxo, rune_data in data['runes']['DOG•GO•TO•THE•MOON'].items():
            amount = float(rune_data['amount'])
            
            # Resolver endereço
            txid, output = utxo.split(':')
            address = get_address_from_utxo(txid, output)
            
            if address:
                holders_by_address[address] += amount
                total_utxos += 1
            else:
                unresolved_utxos += 1
        
        # Converter para lista ordenada
        holders_list = []
        for address, amount in sorted(holders_by_address.items(), key=lambda x: x[1], reverse=True):
            holders_list.append({
                'address': address,
                'balance': amount,
                'balance_formatted': f"{amount:,.5f}"
            })
        
        # Salvar dados
        output_file = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/backend/data/dog_holders_by_address.json'
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        with open(output_file, 'w') as f:
            json.dump(holders_list, f, indent=2)
        
        logger.info(f"✅ Extração concluída!")
        logger.info(f"📊 Total de holders: {len(holders_list)}")
        logger.info(f"📊 Total de UTXOs processados: {total_utxos}")
        logger.info(f"⚠️ UTXOs não resolvidos: {unresolved_utxos}")
        logger.info(f"💾 Dados salvos em: {output_file}")
        
        return True
        
    except Exception as e:
        logger.error(f"Erro na extração: {e}")
        return False

if __name__ == "__main__":
    extract_dog_holders()
