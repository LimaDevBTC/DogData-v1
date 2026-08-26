#!/usr/bin/env python3
"""Reconstrói dog_flows INTEIRA localmente, com gentileza com a produção.

⚠️ POR QUE LOCAL: o backfill por INSERT agregado direto no Postgres via canal
MCP disputava CPU com a produção (statement de minutos + conexões presas no
lock do livro-razão derrubavam até SELECT simples). Aqui o custo pesado roda
NESTA máquina: páginas de 1000 txs por PostgREST (range scan indexado,
milissegundos cada), agregação em dict, e no fim upsert SUBSTITUTIVO em
lotes: cada par (src,dst) é computado por completo antes de subir, então
merge-duplicates substituir (e não somar) é exatamente o correto e o
processo é idempotente por natureza: rodar de novo dá o mesmo resultado.

Critério idêntico ao da genealogia: fluxo da tx inteiro atribuído ao
remetente DOMINANTE (maior amount_dog); auto-transferência fora.

Uso:
    python3 scripts/build_dog_flows.py            # tudo desde o etch
    python3 scripts/build_dog_flows.py --so-agrega  # não sobe, só mede
"""
import argparse
import json
import os
import time
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
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
    for tentativa in range(6):
        try:
            with urllib.request.urlopen(r, timeout=120) as resp:
                return resp.read()
        except Exception as e:
            if tentativa == 5:
                raise
            time.sleep(3 * (tentativa + 1))
            print(f'  retry {e}', flush=True)


def desembrulha(campo):
    if isinstance(campo, str):
        return json.loads(campo)
    return campo or []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--so-agrega', action='store_true')
    args = ap.parse_args()

    fluxo = {}  # (src, dst) -> [total, txs, fb, lb]
    ultimo_id = 0
    vistos = 0
    t0 = time.time()
    while True:
        raw = req('GET', f'/rest/v1/dog_transactions?select=id,block_height,senders,receivers&id=gt.{ultimo_id}&order=id.asc&limit=1000')
        txs = json.loads(raw)
        if not txs:
            break
        for t in txs:
            ultimo_id = t['id']
            try:
                senders = desembrulha(t['senders'])
                receivers = desembrulha(t['receivers'])
            except Exception:
                continue
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
            if dom is None:
                continue
            b = t['block_height']
            for r in receivers:
                w = r.get('address')
                if not w or not r.get('has_dog') or w == dom:
                    continue
                amt = float(r.get('amount_dog') or 0)
                if amt <= 0:
                    continue
                k = (dom, w)
                f = fluxo.get(k)
                if f is None:
                    fluxo[k] = [amt, 1, b, b]
                else:
                    f[0] += amt
                    f[1] += 1
                    if b < f[2]:
                        f[2] = b
                    if b > f[3]:
                        f[3] = b
        vistos += len(txs)
        if vistos % 50000 < 1000:
            print(f'  {vistos} txs, {len(fluxo)} pares, {time.time() - t0:.0f}s', flush=True)
        time.sleep(0.05)  # respiro pra produção

    print(f'AGREGADO: {vistos} txs em {len(fluxo)} pares, cursor id={ultimo_id}', flush=True)
    if args.so_agrega:
        return

    pares = sorted(fluxo.keys())
    passo = 1500
    for i in range(0, len(pares), passo):
        lote = []
        for k in pares[i:i + passo]:
            f = fluxo[k]
            lote.append({
                'src': k[0], 'dst': k[1],
                'total_dog': round(f[0], 4), 'tx_count': f[1],
                'first_block': f[2], 'last_block': f[3],
            })
        req('POST', '/rest/v1/dog_flows?on_conflict=src,dst', lote,
            {'Prefer': 'resolution=merge-duplicates,return=minimal'})
        if i % 30000 < passo:
            print(f'  subidos {min(i + passo, len(pares))}/{len(pares)}', flush=True)
        time.sleep(0.05)
    # o cursor fica guardado pro vigia incremental assumir daqui
    estado = Path.home() / '.local/share/dogdata/flows-builder-state.json'
    estado.parent.mkdir(parents=True, exist_ok=True)
    estado.write_text(json.dumps({'ultimo_id': ultimo_id, 'pares': len(pares), 'quando': time.strftime('%Y-%m-%dT%H:%M:%S')}))
    print('PRONTO.', flush=True)


if __name__ == '__main__':
    main()
