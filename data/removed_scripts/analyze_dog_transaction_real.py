#!/usr/bin/env python3
"""
Script para analisar transações DOG reais usando ord
"""

import subprocess
import json
import sys

def run_ord_command(args):
    """Executa comando ord"""
    try:
        cmd = ["/home/bitmax/Projects/bitcoin-fullstack/ord/target/release/ord", 
               "--data-dir", "/home/bitmax/Projects/bitcoin-fullstack/ord/data"] + args
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            print(f"❌ Erro no comando ord: {result.stderr}")
            return None
    except Exception as e:
        print(f"❌ Erro ao executar comando: {e}")
        return None

def run_bitcoin_cli_command(args):
    """Executa comando bitcoin-cli"""
    try:
        cmd = ["bitcoin-cli"] + args
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            print(f"❌ Erro no comando bitcoin-cli: {result.stderr}")
            return None
    except Exception as e:
        print(f"❌ Erro ao executar comando: {e}")
        return None

def analyze_dog_transaction(txid):
    """Analisa uma transação DOG específica"""
    print(f"🔍 Analisando transação DOG: {txid}")
    
    # 1. Decodificar com ord para obter runestone
    ord_output = run_ord_command(["decode", "--txid", txid])
    if not ord_output:
        print(f"❌ Falha ao decodificar com ord")
        return None
    
    ord_data = json.loads(ord_output)
    
    # 2. Verificar se tem runestone
    if not ord_data.get("runestone"):
        print(f"❌ Transação não tem runestone")
        return None
    
    runestone = ord_data["runestone"]["Runestone"]
    print(f"✅ Runestone encontrado!")
    
    # 3. Analisar edicts (movimentações de runes)
    for edict in runestone.get("edicts", []):
        if edict["id"] == "840000:3":  # DOG•GO•TO•THE•MOON
            amount = edict["amount"]
            output_index = edict["output"]
            print(f"🐕 DOG movido: {amount} para output {output_index}")
    
    # 4. Obter dados da transação com bitcoin-cli
    raw_tx = run_bitcoin_cli_command(["getrawtransaction", txid])
    if not raw_tx:
        return None
    
    tx_data = json.loads(run_bitcoin_cli_command(["decoderawtransaction", raw_tx]))
    
    print(f"📊 Transação tem {len(tx_data['vin'])} inputs e {len(tx_data['vout'])} outputs")
    
    # 5. Analisar inputs para obter endereços dos senders
    senders = []
    for i, vin in enumerate(tx_data['vin']):
        if 'txid' in vin:
            input_txid = vin['txid']
            input_vout = vin['vout']
            
            # Obter dados do UTXO de input
            input_raw = run_bitcoin_cli_command(["getrawtransaction", input_txid])
            if input_raw:
                input_tx = json.loads(run_bitcoin_cli_command(["decoderawtransaction", input_raw]))
                if input_vout < len(input_tx['vout']):
                    output = input_tx['vout'][input_vout]
                    if 'address' in output:
                        senders.append({
                            "address": output['address'],
                            "amount": output['value'],
                            "input_index": i
                        })
                        print(f"  Sender {i}: {output['address']} - {output['value']} BTC")
    
    # 6. Analisar outputs para obter endereços dos receivers
    receivers = []
    for i, vout in enumerate(tx_data['vout']):
        if 'address' in vout:
            receivers.append({
                "address": vout['address'],
                "amount": vout['value'],
                "output_index": i
            })
            print(f"  Receiver {i}: {vout['address']} - {vout['value']} BTC")
    
    return {
        "txid": txid,
        "runestone": runestone,
        "senders": senders,
        "receivers": receivers,
        "tx_data": tx_data
    }

def main():
    """Função principal"""
    print("🚀 Analisando transações DOG reais...")
    
    # Analisar a transação que sabemos que tem DOG
    txid = "89d51802169c5f9fa8c563836bcee38c734e9e02ae194fb8126da2bfae440000"
    
    result = analyze_dog_transaction(txid)
    if result:
        print(f"\n✅ Análise concluída!")
        print(f"📋 Resultado:")
        print(f"  TXID: {result['txid']}")
        print(f"  Senders: {len(result['senders'])}")
        print(f"  Receivers: {len(result['receivers'])}")
        
        # Salvar resultado
        with open("/home/bitmax/Projects/bitcoin-fullstack/dog_transaction_analysis.json", "w") as f:
            json.dump(result, f, indent=2)
        print(f"💾 Resultado salvo em dog_transaction_analysis.json")
    else:
        print(f"❌ Falha na análise")

if __name__ == "__main__":
    main()

