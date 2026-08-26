#!/usr/bin/env python3
"""Enriquece a árvore genealógica do DOG (dog_genealogy no Supabase).

As ARESTAS já nascem no banco (INSERT em fatias direto do dog_transactions:
pai = remetente dominante da PRIMEIRA chegada externa de DOG). Este script
faz a parte que o Postgres não fez em tempo hábil e a que só existe local:

  1. baixa (wallet, parent, first_block) inteiro por paginação PostgREST;
  2. computa DEPTH por passada topológica (pai sempre recebeu ANTES do
     filho, então ordenar por first_block é uma ordem topológica válida);
  3. junta o SALDO ATUAL de data/dog_utxos_by_address.json (o export do
     holders_by_age, recém-derivado do replay completo);
  4. computa children_count e os agregados de SUBÁRVORE (carteiras, holders,
     DOG) numa única passada reversa (filhos antes dos pais);
  5. devolve tudo por PATCH em lotes.

⚠️ Órfão (pai que nunca aparece como carteira) vira filho da raiz com
depth 1: acontece quando o remetente dominante de uma tx multi-entrada era
um endereço só-de-taxa; são raros e o tratamento honesto é degradá-los.

Uso:
    python3 scripts/build_dog_genealogy.py
"""
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

RAIZ = 'bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t'
BASE = Path(__file__).resolve().parent.parent

# .env.local na mão (o script roda fora do Next)
for linha in (BASE / '.env.local').read_text().splitlines():
    if '=' in linha and not linha.strip().startswith('#'):
        k, _, v = linha.partition('=')
        os.environ.setdefault(k.strip(), v.strip())

URL = os.environ['SUPABASE_URL'].rstrip('/')
KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['SUPABASE_ANON_KEY']
HEAD = {
    'apikey': KEY,
    'Authorization': f'Bearer {KEY}',
    'Content-Type': 'application/json',
}


def req(method: str, path: str, body=None, extra=None):
    h = dict(HEAD)
    if extra:
        h.update(extra)
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f'{URL}{path}', data=data, headers=h, method=method)
    for tentativa in range(5):
        try:
            with urllib.request.urlopen(r, timeout=120) as resp:
                return resp.read()
        except Exception as e:  # pooler solta 500 sob carga; recuo e repete
            if tentativa == 4:
                raise
            time.sleep(2 * (tentativa + 1))
            print(f'  retry {path}: {e}', flush=True)


def baixa_arestas():
    # ⚠️ o PostgREST corta a página em 1000 linhas (max-rows do servidor),
    # então o laço avança pelo TAMANHO REAL devolvido e só para na página
    # vazia; parar em "menos que o passo pedido" perdia 99% da tabela
    linhas = []
    ofs = 0
    while True:
        raw = req('GET', f'/rest/v1/dog_genealogy?select=wallet,parent,first_block&order=wallet.asc&limit=1000&offset={ofs}')
        lote = json.loads(raw)
        if not lote:
            return linhas
        linhas.extend(lote)
        ofs += len(lote)
        if ofs % 20000 < 1000:
            print(f'  baixadas {len(linhas)}', flush=True)


def main():
    print('1/5 baixando arestas...', flush=True)
    linhas = baixa_arestas()
    n = len(linhas)
    print(f'   {n} carteiras', flush=True)

    pai = {}
    bloco = {}
    for l in linhas:
        pai[l['wallet']] = l['parent']
        bloco[l['wallet']] = l['first_block']

    # órfãos: pai referenciado que não é carteira da tabela vira filho da raiz
    orfaos = 0
    for w, p in list(pai.items()):
        if p is not None and p not in pai:
            pai[w] = RAIZ
            orfaos += 1
    print(f'   {orfaos} órfãos degradados pra filhos da raiz', flush=True)

    print('2/5 profundidade (ordem topológica por first_block)...', flush=True)
    ordem = sorted(pai.keys(), key=lambda w: (bloco.get(w, 0), w))
    depth = {RAIZ: 0}
    pendentes = ordem
    rodada = 0
    while pendentes:
        resto = []
        for w in pendentes:
            if w in depth:
                continue
            p = pai[w]
            if p in depth:
                depth[w] = depth[p] + 1
            else:
                resto.append(w)
        if len(resto) == len(pendentes):
            # ciclo impossível por construção; se aparecer, degrada pra raiz
            for w in resto:
                depth[w] = 1
                pai[w] = RAIZ
            resto = []
        pendentes = resto
        rodada += 1
    print(f'   profundidade máxima {max(depth.values())} em {rodada} rodadas', flush=True)

    print('3/5 saldos do export...', flush=True)
    saldos_raw = json.loads((BASE / 'data' / 'dog_utxos_by_address.json').read_text())
    saldo = {}
    # formato: { address: [ {amount_dog ...}, ... ] } ou { address: {balance...} }
    for addr, v in saldos_raw.items():
        if isinstance(v, list):
            s = 0.0
            for u in v:
                s += float(u.get('amount_dog') or u.get('dog') or 0)
            saldo[addr] = s
        elif isinstance(v, dict):
            saldo[addr] = float(v.get('balance_dog') or v.get('total_dog') or v.get('dog') or 0)
    holders = {a for a, s in saldo.items() if s > 0}
    print(f'   {len(holders)} holders com saldo', flush=True)

    print('4/5 subárvores (passada reversa)...', flush=True)
    filhos_n = {}
    sub_w = {w: 1 for w in pai}
    sub_h = {w: (1 if w in holders else 0) for w in pai}
    sub_d = {w: saldo.get(w, 0.0) for w in pai}
    for w in sorted(pai.keys(), key=lambda x: depth[x], reverse=True):
        p = pai[w]
        if p is None:
            continue
        filhos_n[p] = filhos_n.get(p, 0) + 1
        sub_w[p] = sub_w.get(p, 1) + sub_w[w]
        sub_h[p] = sub_h.get(p, 0) + sub_h[w]
        sub_d[p] = sub_d.get(p, 0.0) + sub_d[w]

    print('5/5 subindo em lotes...', flush=True)
    todas = sorted(pai.keys())
    passo = 2000
    for i in range(0, len(todas), passo):
        lote = []
        for w in todas[i:i + passo]:
            lote.append({
                'wallet': w,
                'parent': pai[w],
                'first_block': bloco.get(w, 840001),
                'depth': depth[w],
                'balance_dog': round(saldo.get(w, 0.0), 4),
                'is_holder': w in holders,
                'children_count': filhos_n.get(w, 0),
                'subtree_wallets': sub_w[w],
                'subtree_holders': sub_h[w],
                'subtree_balance_dog': round(sub_d[w], 2),
            })
        req('POST', '/rest/v1/dog_genealogy?on_conflict=wallet', lote,
            {'Prefer': 'resolution=merge-duplicates,return=minimal'})
        print(f'   {min(i + passo, len(todas))}/{len(todas)}', flush=True)

    print('PRONTO.', flush=True)
    print(f'  carteiras {n} · holders {len(holders & set(pai))} · depth max {max(depth.values())}')


if __name__ == '__main__':
    main()
