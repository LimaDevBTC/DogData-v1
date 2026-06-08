#!/usr/bin/env python3
"""
Exporta o breakdown LTH/STH por carteira (Long Term Holders vs Short Term Holders).

Diferença para update_holders_and_fees.py:
  - Aquele script publica apenas o AGREGADO (sth_supply / lth_supply do supply total).
  - Este script preserva o endereço de cada UTXO e agrega por carteira, produzindo,
    para CADA holder, quanto do saldo é "moeda velha" (>=155 dias = LTH) e quanto é
    "moeda nova" (<155 dias = STH).

Definição (idêntica à métrica publicada):
  - STH: UTXO com idade  < 155 dias
  - LTH: UTXO com idade >= 155 dias
  A soma do breakdown de todas as carteiras reconcilia com o agregado publicado
  (mesmo threshold, mesmo conjunto de UTXOs com idade calculável).

Saídas (em data/):
  - holders_by_age.csv       -> lista completa, abre direto no Excel/Sheets
  - holders_by_age.json      -> mesma lista para agentes / API
  - holders_by_age_meta.json -> snapshot + totais + check de reconciliação

IMPORTANTE (lock do redb):
  Usa `ord balances`, que precisa de acesso exclusivo ao índice redb.
  NÃO rode enquanto dog_block_scanner, os extractors de airdrop ou
  update_holders_and_fees.py estiverem rodando.

Uso:
    python3 export_holders_by_age.py
"""

import csv
import json
import subprocess
import time
from collections import defaultdict
from pathlib import Path

# Reutiliza os helpers e constantes do script de produção (sem efeitos colaterais:
# main() é guardado por __name__ == "__main__").
from update_holders_and_fees import (
    ORD_BINARY,
    ORD_DATA_DIR,
    DATA_DIR,
    get_address_from_utxo,
    get_utxo_age_and_timestamp,
    utc_now_iso,
)

# Mesma definição da métrica publicada.
STH_LTH_THRESHOLD_DAYS = 155
# 1 DOG = 100.000 unidades base (consistente com update_holders_and_fees.py).
DOG_DIVISOR = 100000


def extract_dog_utxos():
    """Roda `ord balances` e retorna o dict de UTXOs de DOG.

    Replica a lógica de parada/retomada do ord server de update_holders_and_fees.py
    para respeitar o lock single-writer do redb.
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


def build_breakdown(dog_runes):
    """Agrega por endereço o breakdown LTH/STH a partir dos UTXOs de DOG."""
    # Acumuladores por endereço.
    agg = defaultdict(lambda: {
        'total_amount': 0,
        'lth_amount': 0,
        'sth_amount': 0,
        'utxo_count': 0,
        'lth_utxos': 0,
        'sth_utxos': 0,
        'age_amount_product': 0.0,  # sum(age_days * amount) -> idade média ponderada
        'oldest_age': None,
        'newest_age': None,
    })

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
        age_days = age_result[0]

        a = agg[address]
        a['total_amount'] += amount
        a['utxo_count'] += 1
        a['age_amount_product'] += age_days * amount
        if a['oldest_age'] is None or age_days > a['oldest_age']:
            a['oldest_age'] = age_days
        if a['newest_age'] is None or age_days < a['newest_age']:
            a['newest_age'] = age_days
        if age_days >= STH_LTH_THRESHOLD_DAYS:
            a['lth_amount'] += amount
            a['lth_utxos'] += 1
        else:
            a['sth_amount'] += amount
            a['sth_utxos'] += 1

        processed += 1
        if processed % 1000 == 0:
            print(f"⏳ {processed}/{total} (sem endereço: {no_address}, sem idade: {no_age})...")
        if processed % 100 == 0:
            time.sleep(0.01)  # não sobrecarregar o node

    print(f"✅ Processados {processed} UTXOs em {len(agg)} carteiras "
          f"(sem endereço: {no_address}, sem idade: {no_age})")

    # Montar lista final por carteira.
    holders = []
    for address, a in agg.items():
        total_amount = a['total_amount']
        total_dog = total_amount / DOG_DIVISOR
        lth_dog = a['lth_amount'] / DOG_DIVISOR
        sth_dog = a['sth_amount'] / DOG_DIVISOR
        holders.append({
            'address': address,
            'total_dog': round(total_dog, 5),
            'lth_dog': round(lth_dog, 5),
            'sth_dog': round(sth_dog, 5),
            'lth_pct': round(a['lth_amount'] / total_amount * 100, 4) if total_amount else 0,
            'sth_pct': round(a['sth_amount'] / total_amount * 100, 4) if total_amount else 0,
            'utxo_count': a['utxo_count'],
            'lth_utxos': a['lth_utxos'],
            'sth_utxos': a['sth_utxos'],
            'weighted_avg_age_days': round(a['age_amount_product'] / total_amount, 2) if total_amount else 0,
            'oldest_age_days': round(a['oldest_age'], 2) if a['oldest_age'] is not None else 0,
            'newest_age_days': round(a['newest_age'], 2) if a['newest_age'] is not None else 0,
        })

    holders.sort(key=lambda h: h['total_dog'], reverse=True)
    for rank, h in enumerate(holders, start=1):
        h['rank'] = rank

    stats = {
        'no_address': no_address,
        'no_age': no_age,
        'processed_utxos': processed,
    }
    return holders, stats


def write_outputs(holders, stats):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        'rank', 'address', 'total_dog', 'lth_dog', 'sth_dog',
        'lth_pct', 'sth_pct', 'utxo_count', 'lth_utxos', 'sth_utxos',
        'weighted_avg_age_days', 'oldest_age_days', 'newest_age_days',
    ]

    csv_path = DATA_DIR / 'holders_by_age.csv'
    with open(csv_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for h in holders:
            writer.writerow({k: h[k] for k in fieldnames})
    print(f"💾 CSV: {csv_path}")

    # Totais e reconciliação.
    total_dog = sum(h['total_dog'] for h in holders)
    lth_dog = sum(h['lth_dog'] for h in holders)
    sth_dog = sum(h['sth_dog'] for h in holders)

    meta = {
        'generated_at': utc_now_iso(),
        'threshold_days': STH_LTH_THRESHOLD_DAYS,
        'definition': 'STH: UTXO age < 155d | LTH: UTXO age >= 155d (mesmo critério da métrica publicada)',
        'total_holders': len(holders),
        'processed_utxos': stats['processed_utxos'],
        'utxos_without_address': stats['no_address'],
        'utxos_without_age': stats['no_age'],
        'total_dog': round(total_dog, 5),
        'lth_dog': round(lth_dog, 5),
        'sth_dog': round(sth_dog, 5),
        'lth_pct': round(lth_dog / total_dog * 100, 4) if total_dog else 0,
        'sth_pct': round(sth_dog / total_dog * 100, 4) if total_dog else 0,
        'reconciliation_note': 'Soma lth_dog + sth_dog por carteira == total_dog. '
                               'Compare lth_pct/sth_pct com utxo_age_stats do feed agregado.',
    }

    json_path = DATA_DIR / 'holders_by_age.json'
    with open(json_path, 'w') as f:
        json.dump({'meta': meta, 'holders': holders}, f, indent=2)
    print(f"💾 JSON: {json_path}")

    meta_path = DATA_DIR / 'holders_by_age_meta.json'
    with open(meta_path, 'w') as f:
        json.dump(meta, f, indent=2)
    print(f"💾 META: {meta_path}")

    print("\n" + "=" * 60)
    print("📊 RESUMO")
    print("=" * 60)
    print(f"Holders:        {meta['total_holders']:,}")
    print(f"Total DOG:      {meta['total_dog']:,.0f}")
    print(f"LTH (>=155d):   {meta['lth_pct']:.2f}%  ({meta['lth_dog']:,.0f} DOG)")
    print(f"STH (<155d):    {meta['sth_pct']:.2f}%  ({meta['sth_dog']:,.0f} DOG)")
    print("=" * 60)


def main():
    print("=" * 60)
    print("🐕 EXPORT LTH/STH POR CARTEIRA")
    print("=" * 60)
    dog_runes = extract_dog_utxos()
    print(f"📊 {len(dog_runes)} UTXOs com DOG")
    holders, stats = build_breakdown(dog_runes)
    write_outputs(holders, stats)


if __name__ == "__main__":
    main()
