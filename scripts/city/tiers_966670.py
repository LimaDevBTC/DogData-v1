#!/usr/bin/env python3
"""Tier de TODAS as carteiras do snapshot 966.670 (regra do fundador, 28/09/2026).

A regra mora em `wiki-dogdata/dogcity/tiers.md` e está publicada em
`/dogcity/docs` §2. Este script é a única implementação dela: o gerador da
cidade e o jogo leem o arquivo que ele grava, e ninguém recalcula tier por
conta própria.

    base  = primeira aquisição da carteira; para quem recebeu o airdrop, o
            airdrop inteiro (o tier oficial do airdrop não muda)
    saldo = DOG no bloco 966.670
    cota  = 889.806 DOG

    saldo < base                  -> venda, por retenção (HODL Hero >= 90%,
                                     Steady >= 75, Profit Taker >= 50,
                                     Early Exit >= 25, Panic Seller >= 10,
                                     senão Paper Hands)
    saldo >= base e saldo < cota  -> $DOG Soldier
    saldo = base                  -> Diamond Paws
    saldo > base e base < 10.000  -> DOG Supporter
    saldo > base                  -> variação >= 1000% Satoshi Visionary,
                                     >= 500 BTC Maximalist, >= 200 Rune Master,
                                     >= 50 Ordinal Believer, senão DOG Supporter

Empresa (conhecida pelo rótulo ou pelo comportamento) sai da escada: tier
nulo, grupo "empresa", destino Satoshi Plaza.

Fontes da primeira aquisição, nesta ordem:
  1. Supabase `dog_genealogy.first_amount_dog` (mantida pelo vigia
     `scripts/dog_genealogy_updater.py`, que ficou parado de 27/08 a 28/09);
  2. reserva para quem não está na genealogia: a transação mais antiga que a
     carteira ainda guardava no snapshot (`dog_snapshot_966670_utxos.json`),
     somando as saídas dela para o endereço. Marcada `utxo_snapshot`.

Saída: data/snapshots/dog_966670_tiers.json (fora do git, como o snapshot).

Uso (precisa alcançar o Supabase; o sandbox dos agentes não alcança):
    python3 scripts/city/tiers_966670.py
"""
import json
import os
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
SNAP = BASE / 'data' / 'snapshots'
SAIDA = SNAP / 'dog_966670_tiers.json'

COTA = 889806.0
ENTRADA_MIN = 10000.0

for linha in (BASE / '.env.local').read_text().splitlines():
    if '=' in linha and not linha.strip().startswith('#'):
        k, _, v = linha.partition('=')
        os.environ.setdefault(k.strip(), v.strip())
URL = os.environ['SUPABASE_URL'].rstrip('/')
KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['SUPABASE_ANON_KEY']
HEAD = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}


def get(path):
    r = urllib.request.Request(URL + path, headers=HEAD)
    for tentativa in range(5):
        try:
            with urllib.request.urlopen(r, timeout=120) as resp:
                return json.loads(resp.read())
        except Exception as e:
            if tentativa == 4:
                raise
            time.sleep(2 * (tentativa + 1))
            print(f'  retry: {e}', flush=True)


def primeira_aquisicao_genealogia(enderecos):
    """wallet -> (first_block, first_txid, first_amount_dog), só das carteiras pedidas.
    Pagina por chave (wallet > última), porque o PostgREST corta a página em 1000."""
    achados, ultimo, lidas = {}, '', 0
    while True:
        q = ('/rest/v1/dog_genealogy?select=wallet,first_block,first_txid,first_amount_dog'
             '&order=wallet.asc&limit=1000')
        if ultimo:
            q += '&wallet=gt.' + urllib.parse.quote(ultimo, safe='')
        linhas = get(q)
        if not linhas:
            break
        for l in linhas:
            if l['wallet'] in enderecos and (l.get('first_amount_dog') or 0) > 0:
                achados[l['wallet']] = (l['first_block'], l['first_txid'], float(l['first_amount_dog']))
        lidas += len(linhas)
        ultimo = linhas[-1]['wallet']
        if lidas % 50000 < 1000:
            print(f'  genealogia: {lidas} linhas lidas', flush=True)
    return achados


def reserva_utxo(por_endereco, a):
    us = por_endereco.get(a) or []
    if not us:
        return None
    t0 = min(u['ts'] for u in us)
    tx0 = sorted({u['txid'] for u in us if u['ts'] == t0})[0]
    return (None, tx0, sum(u['dog'] for u in us if u['txid'] == tx0))


def empresas(holders):
    """endereço -> motivo. Rótulo (nome) ou comportamento (tag institucional)."""
    out = {}
    tag = json.load(open(SNAP / 'dog_966670_tag_institucional.json'))
    for l in tag['linhas']:
        out[l['address']] = 'tag institucional (nome ou comportamento)'
    pag = json.load(open(SNAP / 'dog_966670_pagadores_rotulados.json'))
    itens = pag if isinstance(pag, list) else next(v for v in pag.values() if isinstance(v, list))
    for i in itens:
        a = i.get('address')
        c = json.dumps(i).lower()
        if a in holders and a not in out and ('treasury' in c or 'desk' in c):
            out[a] = 'rótulo sem prova de custódia (treasury ou desk)'
    ver = json.load(open(BASE / 'public' / 'data' / 'verified_addresses.json'))['verified']
    for a, v in ver.items():
        if a in holders and a not in out:
            out[a] = f"rótulo oficial: {v.get('name')}"
    return out


TOL = 0.01  # DOG: base e saldo vêm de fontes diferentes (banco e snapshot) e a vírgula flutua


def classifica(base, saldo):
    if abs(saldo - base) <= TOL:
        saldo = base  # segurou exatamente a primeira aquisição
    if saldo < base:
        r = saldo / base * 100
        return ('hodl_hero' if r >= 90 else 'steady_holder' if r >= 75 else 'profit_taker' if r >= 50
                else 'early_exit' if r >= 25 else 'panic_seller' if r >= 10 else 'paper_hands')
    if saldo < COTA:
        return 'dog_soldier'
    if saldo == base:
        return 'diamond_paws'
    if base < ENTRADA_MIN:
        return 'dog_legend'
    v = (saldo - base) / base * 100
    return ('satoshi_visionary' if v >= 1000 else 'btc_maximalist' if v >= 500 else 'rune_master' if v >= 200
            else 'ordinal_believer' if v >= 50 else 'dog_legend')


def main():
    holders = {w['address']: w for w in json.load(open(SNAP / 'dog_snapshot_966670.json'))['holders']}
    posicao = {w['address']: w.get('posicao') for w in json.load(open(SNAP / 'dog_snapshot_966670_ordem.json'))['ordem']}
    emp = empresas(holders)
    mercado = {a for a, w in holders.items() if not w.get('airdrop_amount')}
    print(f'{len(holders)} carteiras; {len(emp)} empresas; {len(mercado)} sem airdrop', flush=True)
    gen = primeira_aquisicao_genealogia(mercado)
    faltam = [a for a in mercado if a not in gen]
    por_endereco = json.load(open(SNAP / 'dog_snapshot_966670_utxos.json'))['por_endereco'] if faltam else {}
    print(f'genealogia cobre {len(gen)} de {len(mercado)}; reserva por UTXO para {len(faltam)}', flush=True)

    carteiras, cont, fontes = [], Counter(), Counter()
    for a, w in holders.items():
        saldo = float(w['dog'])
        reg = {'address': a, 'dog': saldo, 'posicao': posicao.get(a),
               'airdrop': bool(w.get('airdrop_amount')), 'runestone': bool(w.get('tem_runestone'))}
        if a in emp:
            reg.update(tier=None, grupo='empresa', motivo=emp[a], destino='satoshi_plaza')
            cont['empresa'] += 1
            carteiras.append(reg)
            continue
        if w.get('airdrop_amount'):
            base, fonte, tier = float(w['airdrop_amount']), 'airdrop', w['tier']
        else:
            if a in gen:
                _, _, base = gen[a]
                fonte = 'genealogia'
            else:
                r = reserva_utxo(por_endereco, a)
                base, fonte = (r[2], 'utxo_snapshot') if r else (None, 'sem_base')
            tier = classifica(base, saldo) if base else None
        reg.update(tier=tier, grupo='escada', base=base, fonte_base=fonte)
        cont[tier or 'sem_tier'] += 1
        fontes[fonte] += 1
        carteiras.append(reg)

    meta = {
        'gerado': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'regra': 'wiki-dogdata/dogcity/tiers.md (fundador, 28/09/2026); publicada em /dogcity/docs §2',
        'snapshot_block': 966670,
        'cota': COTA, 'entrada_min': ENTRADA_MIN,
        'contagem': dict(cont), 'fonte_base': dict(fontes),
        'nota': 'tier dog_legend = DOG Supporter (chave interna de lib/airdrop-tiers.ts); dog_soldier = $DOG Soldier',
    }
    json.dump({'meta': meta, 'carteiras': carteiras}, open(SAIDA, 'w'))
    print(json.dumps(meta, ensure_ascii=False, indent=1))
    print(f'gravado: {SAIDA}')


if __name__ == '__main__':
    main()
