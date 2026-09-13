#!/usr/bin/env python3
"""Auditoria independente da impressao digital "compra em marketplace".

Regra auditada: para cada UTXO de credito, busco a tx que o criou e testo se
algum dos 3 enderecos de marketplace do gabarito aparece entre os inputs OU os
outputs. compra_mkt = acertos / amostra. Regra proposta: compra_mkt >= 0.20.

Uso (da raiz do DogData-v1):
  python3 scripts/regua/auditar_compra_mkt.py rotulados
  python3 scripts/regua/auditar_compra_mkt.py top20
  python3 scripts/regua/auditar_compra_mkt.py controle
  python3 scripts/regua/auditar_compra_mkt.py top500
  python3 scripts/regua/auditar_compra_mkt.py estabilidade
  python3 scripts/regua/auditar_compra_mkt.py hubs
As tx ficam em cache local, entao rodadas seguintes nao batem no no.
"""
import json, os, sys, random, base64, http.client
from collections import Counter, defaultdict

B   = 'data/snapshots/'
CACHE = os.environ.get('MKT_CACHE', '/tmp/audit_mkt_cache.json')
MKT = {'bc1pjywvrxfrsr25dkl9gmtuy8w7w8a7mg7vz0j89v3g6d0x8suvgg6qdchqul',
       'bc1pacdg0ayufh9qlyx52w73eejpka8srsgnuwraaeu2t8mlf3h70tkq0keg74',
       'bc1pud2j5tpy5s3c5u6y7e2lqn8tp5208q0mmxjtjqncmzp9wyj5gssswnz8nk'}
SEED = 966670

PE  = json.load(open(B+'dog_snapshot_966670_utxos.json'))['por_endereco']
ORD = {x['address']: x for x in json.load(open(B+'dog_snapshot_966670_ordem.json'))['ordem']}
HOL = {x['address']: x for x in json.load(open(B+'dog_snapshot_966670.json'))['holders']}
ROT = {x['address']: x['rotulo']
       for x in json.load(open(B+'dog_966670_pagadores_rotulados.json'))['linhas']}
TX  = json.load(open(CACHE)) if os.path.exists(CACHE) else {}

def buscar(txids):
    """getrawtransaction verbosity 2 em lote de 200 por conexao JSON-RPC."""
    falta = sorted({t for t in txids if t not in TX})
    if not falta: return
    cook = open(os.path.expanduser('~/.bitcoin/.cookie')).read().strip()
    auth = 'Basic ' + base64.b64encode(cook.encode()).decode()
    for i in range(0, len(falta), 200):
        lote = falta[i:i+200]
        body = json.dumps([{"jsonrpc":"1.0","id":t,"method":"getrawtransaction","params":[t,2]}
                           for t in lote])
        c = http.client.HTTPConnection('127.0.0.1', 8332, timeout=600)
        c.request('POST', '/', body, {'Authorization':auth,'Content-Type':'application/json'})
        for e in json.loads(c.getresponse().read()):
            r = e.get('result')
            if not r: continue
            TX[e['id']] = {
              'vin':  [((v.get('prevout') or {}).get('scriptPubKey') or {}).get('address') for v in r['vin']],
              'vout': [(v['scriptPubKey'] or {}).get('address') for v in r['vout']]}
        c.close()
        json.dump(TX, open(CACHE,'w'))

def amostra(addr, k):
    u = PE.get(addr, [])
    return list(u) if len(u) <= k else random.Random(SEED).sample(u, k)

def enderecos(t):
    return set(a for a in t['vin'] if a) | set(a for a in t['vout'] if a)

def medir(addr, k=12, sem_self=False):
    sam = amostra(addr, k)
    if not sam: return None
    buscar({x['txid'] for x in sam})
    n = hit = ext = hit_ext = 0
    for x in sam:
        t = TX.get(x['txid'])
        if not t: continue
        n += 1
        ad = enderecos(t)
        if sem_self: ad -= {addr}
        m = bool(ad & MKT)
        if m: hit += 1
        if addr not in t['vin']:            # credito externo, nao consolidacao propria
            ext += 1
            if m: hit_ext += 1
    if n == 0: return None
    return {'n':n,'hit':hit,'mkt':hit/n,'ext':ext,'hit_ext':hit_ext,
            'mkt_ext': hit_ext/ext if ext else None}

def pos(a): return ORD.get(a, {}).get('posicao', 0)

def controle():
    pool = sorted(a for a,o in ORD.items() if o['posicao'] > 500 and HOL[a]['dog'] >= 100000)
    return random.Random(966670).sample(pool, 300)

if __name__ == '__main__':
    modo = sys.argv[1] if len(sys.argv) > 1 else 'rotulados'
    if modo == 'rotulados':
        for a, r in sorted(ROT.items(), key=lambda z: pos(z[0]) or 9**9):
            m = medir(a, 12)
            if not m: print(f"{r:<20s} pos {pos(a) or '-':>7} fora do snapshot"); continue
            s = medir(a, 12, sem_self=True)
            print(f"{r:<20s} pos {pos(a):7d} nutxo {len(PE[a]):6d} "
                  f"mkt {m['hit']:3d}/{m['n']:<3d} {m['mkt']*100:4.0f}%  "
                  f"sem_self {s['hit']:3d}/{s['n']:<3d} {s['mkt']*100:4.0f}%")
    elif modo == 'top20':
        for a in [x['address'] for x in sorted(ORD.values(), key=lambda z:z['posicao'])[:20]]:
            m = medir(a, 12)
            print(f"pos {pos(a):4d} dog {HOL[a]['dog']:14.0f} nutxo {len(PE[a]):6d} "
                  f"{m['hit']:3d}/{m['n']:<3d} {m['mkt']*100:4.0f}% {ROT.get(a,'')}")
    elif modo in ('controle','top500'):
        k = 12 if modo == 'controle' else 8
        alvos = controle() if modo == 'controle' else \
                [x['address'] for x in sorted(ORD.values(), key=lambda z:z['posicao'])[:500]]
        R = {a:m for a in alvos if (m := medir(a, k))}
        c = Counter('certifica' if m['mkt'] >= 0.20 else 'reprova' for m in R.values())
        z = sum(1 for m in R.values() if m['mkt'] == 0)
        print(f"{modo}: {len(R)} medidos  certifica {c['certifica']} "
              f"({c['certifica']/len(R)*100:.1f}%)  zero absoluto {z} ({z/len(R)*100:.1f}%)")
        for a, m in sorted(R.items(), key=lambda z: -z[1]['mkt']):
            if m['mkt'] >= 0.20:
                print(f"  pos {pos(a):6d} dog {HOL[a]['dog']:12.0f} nutxo {len(PE[a]):5d} "
                      f"{m['hit']}/{m['n']} {m['mkt']*100:4.0f}%")
    elif modo == 'estabilidade':
        byp = {o['posicao']: a for a, o in ORD.items()}
        for p in [18, 30, 37, 72, 92, 93, 311]:
            a = byp[p]; u = PE[a]
            linha = f"pos {p:4d} N={len(u):4d} "
            for k in (8, 12, 26, 60):
                m = medir(a, k)
                linha += f" k{k}={m['mkt']*100:4.1f}%{'*' if m['mkt']>=0.2 else ' '}"
            buscar({x['txid'] for x in u}) if len(u) <= 60 else None
            if len(u) <= 60:
                h = sum(1 for x in u if enderecos(TX[x['txid']]) & MKT)
                linha += f"  real={h/len(u)*100:5.1f}%"
                passa = 0
                for s in range(40):
                    sam = random.Random(s).sample(u, min(12, len(u)))
                    hh = sum(1 for x in sam if enderecos(TX[x['txid']]) & MKT)
                    passa += hh/len(sam) >= 0.20
                linha += f"  passa em {passa}/40 sorteios k=12"
            print(linha)
    elif modo == 'hubs':
        hub = defaultdict(set)
        for a in controle():
            for x in amostra(a, 12):
                buscar({x['txid']})
                t = TX.get(x['txid'])
                if t:
                    for v in enderecos(t) - {a}: hub[v].add(a)
        for v, s in sorted(hub.items(), key=lambda z: -len(z[1]))[:8]:
            tag = '<<< MKT' if v in MKT else ROT.get(v, '')
            print(f"{len(s):4d}/300  {v}  {tag}")
