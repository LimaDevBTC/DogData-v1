#!/usr/bin/env python3
"""
Exporta o breakdown LTH/STH por carteira (Long Term Holders vs Short Term Holders),
como SNAPSHOT avulso sob demanda.

Em produção, esse breakdown já é gerado de hora em hora como byproduct do
update_holders_and_fees.py (ver write_holders_by_age lá). Este script é só para
gerar um snapshot manual fora do ciclo (ex.: pedido pontual de um researcher).
Ele reutiliza EXATAMENTE a mesma função de escrita — formato idêntico, sem divergência.

Definição (idêntica à métrica publicada):
  - STH: UTXO com idade  < 155 dias
  - LTH: UTXO com idade >= 155 dias

Saídas (em data/): holders_by_age.csv | holders_by_age.json | holders_by_age_meta.json

IMPORTANTE (lock do redb):
  Usa `ord balances`. NÃO rode enquanto dog_block_scanner, os extractors de airdrop
  ou update_holders_and_fees.py estiverem rodando.

Uso:
    python3 export_holders_by_age.py
"""

import json
import subprocess
import time
from pathlib import Path

# Reutiliza helpers e a função de escrita do script de produção (fonte única do formato).
from update_holders_and_fees import (
    ORD_BINARY,
    ORD_DATA_DIR,
    get_address_from_utxo,
    get_utxo_age_and_timestamp,
    write_holders_by_age,
    write_utxos_by_address,
)


def extract_dog_utxos():
    """Roda `ord balances` e retorna o dict de UTXOs de DOG.

    Replica a parada/retomada do ord server de update_holders_and_fees.py para
    respeitar o lock single-writer do redb.
    """
    ord_dir = Path(ORD_BINARY).parent.parent.parent  # .../ord
    if not ord_dir.exists():
        raise SystemExit(f"❌ Diretório ord não encontrado: {ord_dir}")

    ord_running = subprocess.run(['pgrep', '-f', 'ord.*server'], capture_output=True).returncode == 0
    ord_was_running = ord_running

    if ord_running:
        print("⏸️  Ord server rodando. Parando temporariamente para acessar o índice...")
        subprocess.run(['pkill', '-TERM', '-f', 'ord.*server'], capture_output=True)
        for i in range(20):
            if subprocess.run(['pgrep', '-f', 'ord.*server'], capture_output=True).returncode != 0:
                print(f"✅ Ord parou após {i+1}s")
                break
            time.sleep(1)
        else:
            print("⚠️  Ord não parou graciosamente, forçando...")
            subprocess.run(['pkill', '-KILL', '-f', 'ord.*server'], capture_output=True)
            time.sleep(2)
        time.sleep(3)

    print("📊 Carregando balances do ord...")
    result = subprocess.run(
        [ORD_BINARY, '--data-dir', ORD_DATA_DIR, 'balances'],
        capture_output=True, text=True, cwd=str(ord_dir)
    )

    if ord_was_running:
        print("🔄 Reiniciando Ord server...")
        subprocess.Popen(
            ['nohup', 'ord', '--data-dir', 'data', '--index-runes', 'server', '--http-port', '8080'],
            cwd=str(ord_dir),
            stdout=open(ord_dir / 'ord.log', 'a'),
            stderr=subprocess.STDOUT
        )
        time.sleep(2)

    if result.returncode != 0:
        raise SystemExit(f"❌ Erro no `ord balances`: {result.stderr}")

    balances = json.loads(result.stdout)
    dog_runes = balances.get('runes', {}).get('DOG•GO•TO•THE•MOON', {})
    if not dog_runes:
        raise SystemExit("⚠️ Nenhum UTXO com DOG encontrado")
    return dog_runes


def collect_utxo_ages(dog_runes):
    """Para cada UTXO de DOG, resolve endereço + idade. Retorna a lista no formato
    que write_holders_by_age / write_utxos_by_address esperam
    ({'address', 'amount', 'age_days', 'txid', 'vout', 'creation_timestamp'})."""
    utxo_ages = []
    block_cache = {}
    total = len(dog_runes)
    processed = 0
    no_address = 0
    no_age = 0

    print(f"📅 Processando {total} UTXOs (endereço + idade)...")
    for utxo_key, rune_data in dog_runes.items():
        amount = rune_data.get('amount', 0)
        if amount <= 0:
            continue
        try:
            txid, output = utxo_key.split(':')
            output_int = int(output)
        except ValueError:
            continue

        address = get_address_from_utxo(txid, output_int)
        if not address:
            no_address += 1
            continue

        age_result = get_utxo_age_and_timestamp(txid, output_int, block_cache)
        if not age_result:
            no_age += 1
            continue

        utxo_ages.append({
            'address': address,
            'amount': amount,
            'age_days': age_result[0],
            'txid': txid,
            'vout': output_int,
            'creation_timestamp': age_result[1],
        })

        processed += 1
        if processed % 1000 == 0:
            print(f"⏳ {processed}/{total} (sem endereço: {no_address}, sem idade: {no_age})...")
        if processed % 100 == 0:
            time.sleep(0.01)

    print(f"✅ {processed} UTXOs resolvidos (sem endereço: {no_address}, sem idade: {no_age})")
    return utxo_ages


def main():
    print("=" * 60)
    print("🐕 EXPORT LTH/STH POR CARTEIRA (snapshot manual)")
    print("=" * 60)
    dog_runes = extract_dog_utxos()
    print(f"📊 {len(dog_runes)} UTXOs com DOG")
    utxo_ages = collect_utxo_ages(dog_runes)
    write_holders_by_age(utxo_ages)
    write_utxos_by_address(utxo_ages)


if __name__ == "__main__":
    main()
