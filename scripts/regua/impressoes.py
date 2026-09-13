#!/usr/bin/env python3
"""Impressoes digitais pessoa-vs-servico para a regua de acumulacao do snapshot 966.670.
Uso: python3 scripts/regua/impressoes.py [--nodo]
Sem --nodo roda so as metricas A (janela de sono) e B (maior UTXO); com --nodo
busca as tx de credito por JSON-RPC em lote e roda C (patrocinador), D (empurrao), E (compra-mkt).
"""
import json, sys, math, random, base64, http.client, os, statistics
from collections import Counter, defaultdict

BASE='data/snapshots/'
AIR=889806.0                     # alocacao do airdrop em DOG
ANCORA='bc1pqdtrwkjwdutzs5z8f75gc5srhcwewx4u77pdnumc0fh7l47aanqqa8n4da'
MKT={'bc1pjywvrxfrsr25dkl9gmtuy8w7w8a7mg7vz0j89v3g6d0x8suvgg6qdchqul',
     'bc1pacdg0ayufh9qlyx52w73eejpka8srsgnuwraaeu2t8mlf3h70tkq0keg74',
     'bc1pud2j5tpy5s3c5u6y7e2lqn8tp5208q0mmxjtjqncmzp9wyj5gssswnz8nk'}

H={x['address']:x for x in json.load(open(BASE+'dog_snapshot_966670.json'))['holders']}
O={x['address']:x for x in json.load(open(BASE+'dog_snapshot_966670_ordem.json'))['ordem']}
PE=json.load(open(BASE+'dog_snapshot_966670_utxos.json'))['por_endereco']

# ---- A: janela de sono. vale6 = menor fatia de depositos em qualquer janela
#      circular de 6 h UTC. Pessoa dorme -> ~0. Servico 24/7 -> ~0,25 (uniforme).
def vale6(addr):
    u=PE.get(addr,[])
    n=len(u)
    if n==0: return None,0
    h=[0]*24
    for x in u: h[int((x['ts']%86400)//3600)]+=1
    return min(sum(h[(i+j)%24] for j in range(6)) for i in range(24))/n, n
def regra_A(addr):
    v,n=vale6(addr)
    return (n>=40 and v>=0.10)   # so tem poder a partir de n=25; uso 40 por seguranca

# ---- B: maior UTXO unico em multiplos da alocacao do airdrop.
def maior_utxo(addr):
    return max((x['dog'] for x in PE.get(addr,[])), default=0.0)/AIR
def regra_B(addr):
    return maior_utxo(addr)>=90.0     # 26 carteiras em 85.818 (0,030%)

# ---- C/D/E precisam do no
def _rpc(txids):
    cook=open(os.path.expanduser('~/.bitcoin/.cookie')).read().strip()
    auth='Basic '+base64.b64encode(cook.encode()).decode()
    out={}
    for i in range(0,len(txids),200):
        body=json.dumps([{"jsonrpc":"1.0","id":t,"method":"getrawtransaction","params":[t,2]}
                         for t in txids[i:i+200]])
        c=http.client.HTTPConnection('127.0.0.1',8332,timeout=300)
        c.request('POST','/',body,{'Authorization':auth,'Content-Type':'application/json'})
        for e in json.loads(c.getresponse().read()):
            if e.get('result'): out[e['id']]=e['result']
        c.close()
    return out
def _endr(t):
    s=set()
    for v in t['vin']:
        a=((v.get('prevout') or {}).get('scriptPubKey') or {}).get('address')
        if a: s.add(a)
    for v in t['vout']:
        a=(v['scriptPubKey'] or {}).get('address')
        if a: s.add(a)
    return s
def medir_nodo(addr, k=12, seed=11):
    random.seed(seed)
    u=PE.get(addr,[]); sam=u if len(u)<=k else random.sample(u,k)
    got=_rpc(sorted({x['txid'] for x in sam}))
    am=anc=n12=hit=0; pad=Counter()
    for x in sam:
        t=got.get(x['txid'])
        if not t: continue
        am+=1; AD=_endr(t)
        if ANCORA in AD: anc+=1                                   # C motor de lote
        if len(t['vin'])==1 and len(t['vout'])==2: n12+=1          # D empurrao
        if AD&MKT: hit+=1                                          # E compra em mkt
        try: pad[int(round(t['vout'][x['vout']]['value']*1e8))]+=1
        except Exception: pass
    if am==0: return None
    return {'amostra':am,'ancora':anc/am,'empurrao':n12/am,'compra_mkt':hit/am,
            'pad330':(pad.get(330,0)+pad.get(331,0))/am}

if __name__=='__main__':
    nodo='--nodo' in sys.argv
    alvos=[x['address'] for x in sorted(O.values(), key=lambda z:z['posicao'])[:40]]
    print(f"{'pos':>6s} {'nutxo':>6s} {'vale6':>6s} {'maiorUTXO':>10s} {'A':>2s} {'B':>2s}"
          + (f" {'ancora':>6s} {'empurr':>6s} {'mkt':>5s} {'pad330':>6s}" if nodo else ''))
    for a in alvos:
        v,n=vale6(a)
        lin=f"{O[a]['posicao']:6d} {n:6d} {v:6.3f} {maior_utxo(a):9.1f}x " \
            f"{'X' if regra_A(a) else '.':>2s} {'X' if regra_B(a) else '.':>2s}"
        if nodo:
            m=medir_nodo(a)
            if m: lin+=f" {m['ancora']*100:5.0f}% {m['empurrao']*100:5.0f}% {m['compra_mkt']*100:4.0f}% {m['pad330']*100:5.0f}%"
        print(lin)
