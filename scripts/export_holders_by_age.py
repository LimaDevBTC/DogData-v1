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

Lê o ord server por HTTP (ORD_HTTP_URL), sem abrir o índice: pode rodar a
qualquer hora, junto com o scanner e o update_holders_and_fees.py.

Uso:
    python3 export_holders_by_age.py
"""

import json
import subprocess
import time
from pathlib import Path

# Reutiliza helpers e a função de escrita do script de produção (fonte única do formato).
from ord_http import get_dog_balances, OrdHttpError
from update_holders_and_fees import (
    get_address_from_utxo,
    get_utxo_age_and_timestamp,
    write_holders_by_age,
    write_utxos_by_address,
)


def extract_dog_utxos():
    """UTXOs de DOG lidos do ord server (HTTP), no formato do antigo `ord balances`.

    Não para nem inicia o servidor e não abre o índice (ver ord_http.py)."""
    print("📊 Carregando balances do ord (HTTP)...")
    try:
        dog_runes = get_dog_balances()
    except OrdHttpError as e:
        raise SystemExit(f"❌ Erro ao ler o ord: {e}")
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
