#!/usr/bin/env python3
"""A história viva do DOG: mantém dog_genealogy atualizada a cada bloco.

O fundador decretou: o mapa completo é a história viva da DOG sendo contada,
nunca mais podemos perder esses dados. Este vigia poll a tabela
dog_transactions (a fonte primária, alimentada pelo scanner a cada bloco) e
acrescenta na genealogia TODO nó e aresta novos que surgirem:

  - carteira que recebe DOG pela primeira vez vira NÓ novo, com pai =
    remetente dominante da transação (a mesma regra do backfill), depth =
    depth do pai + 1;
  - a chegada acende o nó (is_holder true, balance aproximado pelo
    recebido); o saldo EXATO é reconciliado pelo build_dog_genealogy.py
    (rodar 1x/dia via cron, depois do export do holders_by_age);
  - os agregados de subárvore dos ANCESTRAIS sobem +1 carteira/+1 holder
    pela corrente de pais (em memória, flush em lote).

⚠️ A aresta é IMUTÁVEL por construção: a primeira chegada de uma carteira
nunca muda. Por isso o vivo é puro APPEND + incrementos, e qualquer drift é
corrigível a qualquer momento re-rodando o reconciliador completo, porque a
fonte de verdade é dog_transactions (buraco 0,00% medido pós-replay).

Uso:
    python3 scripts/dog_genealogy_updater.py --poll 30
Estado (cursor por id de dog_transactions):
    ~/.local/share/dogdata/genealogy-updater-state.json
"""
import argparse
import json
import os
import time
import urllib.request
from pathlib import Path

RAIZ = 'bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t'
BASE = Path(__file__).resolve().parent.parent
ESTADO = Path.home() / '.local/share/dogdata/genealogy-updater-state.json'

for linha in (BASE / '.env.local').read_text().splitlines():
    if '=' in linha and not linha.strip().startswith('#'):
        k, _, v = linha.partition('=')
        os.environ.setdefault(k.strip(), v.strip())

URL = os.environ['SUPABASE_URL'].rstrip('/')
KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['SUPABASE_ANON_KEY']
HEAD = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'}


def req(method, path, body=None, extra=None):
    h = dict(HEAD)
    if extra:
        h.update(extra)
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f'{URL}{path}', data=data, headers=h, method=method)
    for tentativa in range(4):
        try:
            with urllib.request.urlopen(r, timeout=60) as resp:
                return resp.read()
        except Exception as e:
            if tentativa == 3:
                raise
            time.sleep(2 * (tentativa + 1))


def desembrulha(campo):
    # o jsonb chega como string JSON escapada em parte das linhas
    if isinstance(campo, str):
        return json.loads(campo)
    return campo or []


def carrega_cursor():
    if ESTADO.exists():
        return json.loads(ESTADO.read_text()).get('ultimo_id', 0)
    # sem estado: começa do fim atual (o backfill já cobriu o passado)
    raw = req('GET', '/rest/v1/dog_transactions?select=id&order=id.desc&limit=1')
    linhas = json.loads(raw)
    return linhas[0]['id'] if linhas else 0


def salva_cursor(i):
    ESTADO.parent.mkdir(parents=True, exist_ok=True)
    tmp = ESTADO.with_suffix('.tmp')
    tmp.write_text(json.dumps({'ultimo_id': i, 'quando': time.strftime('%Y-%m-%dT%H:%M:%S')}))
    tmp.replace(ESTADO)


def busca_no(wallet):
    raw = req('GET', f'/rest/v1/dog_genealogy?select=wallet,parent,depth&wallet=eq.{wallet}&limit=1')
    linhas = json.loads(raw)
    return linhas[0] if linhas else None


def ciclo(cursor, pais_cache, depth_cache):
    raw = req('GET', f'/rest/v1/dog_transactions?select=id,txid,block_height,senders,receivers&id=gt.{cursor}&order=id.asc&limit=500')
    txs = json.loads(raw)
    if not txs:
        return cursor, 0
    novos = []
    deltas = {}  # ancestral -> [d_wallets, d_holders, d_dog]
    for t in txs:
        try:
            receivers = desembrulha(t['receivers'])
            senders = desembrulha(t['senders'])
        except Exception:
            continue
        # remetente dominante: o mesmo criterio do backfill
        dom = None
        maior = -1.0
        for s in senders:
            a = s.get('address')
            if not a:
                continue
            amt = float(s.get('amount_dog') or 0)
            if amt > maior:
                maior = amt
                dom = a
        for r in receivers:
            w = r.get('address')
            if not w or not r.get('has_dog') or w == dom or dom is None:
                continue
            if w in depth_cache or any(n['wallet'] == w for n in novos):
                continue
            no_existente = busca_no(w)
            if no_existente:
                depth_cache[w] = no_existente['depth'] or 0
                pais_cache[w] = no_existente['parent']
                continue
            # profundidade do pai: cache -> banco -> raiz como degradação
            if dom not in depth_cache:
                p = busca_no(dom)
                if p:
                    depth_cache[dom] = p['depth'] or 0
                    pais_cache[dom] = p['parent']
                else:
                    depth_cache[dom] = 0
                    pais_cache[dom] = None
            amt_dog = float(r.get('amount_dog') or 0)
            d = depth_cache[dom] + 1
            novos.append({
                'wallet': w, 'parent': dom, 'first_block': t['block_height'],
                'first_txid': t['txid'], 'first_amount_dog': amt_dog,
                'depth': d, 'balance_dog': round(amt_dog, 4), 'is_holder': True,
                'children_count': 0, 'subtree_wallets': 1, 'subtree_holders': 1,
                'subtree_balance_dog': round(amt_dog, 2),
            })
            depth_cache[w] = d
            pais_cache[w] = dom
            # propaga +1 carteira/+1 holder pela corrente de ancestrais
            anc = dom
            passos = 0
            while anc is not None and passos < 2000:
                dd = deltas.setdefault(anc, [0, 0, 0.0])
                dd[0] += 1
                dd[1] += 1
                dd[2] += amt_dog
                anc = pais_cache.get(anc)
                if anc is not None and anc not in pais_cache and anc not in deltas:
                    p = busca_no(anc)
                    if p:
                        pais_cache[anc] = p['parent']
                        depth_cache[anc] = p['depth'] or 0
                    else:
                        break
                passos += 1
        cursor = t['id']
    if novos:
        req('POST', '/rest/v1/dog_genealogy?on_conflict=wallet', novos,
            {'Prefer': 'resolution=ignore-duplicates,return=minimal'})
        # children_count do pai de cada novo
        for n in novos:
            p = n['parent']
            raw2 = req('GET', f'/rest/v1/dog_genealogy?select=children_count&wallet=eq.{p}&limit=1')
            l2 = json.loads(raw2)
            if l2:
                req('PATCH', f'/rest/v1/dog_genealogy?wallet=eq.{p}',
                    {'children_count': (l2[0]['children_count'] or 0) + 1},
                    {'Prefer': 'return=minimal'})
        # agregados de subarvore dos ancestrais (le-modifica-escreve por no)
        for anc, (dw, dh, ddog) in deltas.items():
            raw3 = req('GET', f'/rest/v1/dog_genealogy?select=subtree_wallets,subtree_holders,subtree_balance_dog&wallet=eq.{anc}&limit=1')
            l3 = json.loads(raw3)
            if l3:
                req('PATCH', f'/rest/v1/dog_genealogy?wallet=eq.{anc}', {
                    'subtree_wallets': (l3[0]['subtree_wallets'] or 0) + dw,
                    'subtree_holders': (l3[0]['subtree_holders'] or 0) + dh,
                    'subtree_balance_dog': round(float(l3[0]['subtree_balance_dog'] or 0) + ddog, 2),
                }, {'Prefer': 'return=minimal'})
    salva_cursor(cursor)
    return cursor, len(novos)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--poll', type=int, default=30)
    args = ap.parse_args()
    cursor = carrega_cursor()
    print(f'[genealogia] vigia no ar, cursor id={cursor}', flush=True)
    pais_cache = {RAIZ: None}
    depth_cache = {RAIZ: 0}
    while True:
        try:
            cursor, n = ciclo(cursor, pais_cache, depth_cache)
            if n:
                print(f'[genealogia] {time.strftime("%H:%M:%S")} +{n} carteiras novas, cursor {cursor}', flush=True)
        except Exception as e:
            print(f'[genealogia] erro no ciclo: {e}', flush=True)
        time.sleep(args.poll)


if __name__ == '__main__':
    main()
