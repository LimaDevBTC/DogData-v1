#!/usr/bin/env python3
"""Aprofundamento do pad330: populacao INTEIRA onde cabe, amostra grande no resto,
quem paga os 330, e estabilidade da amostra k=14.
Uso: python3 scripts/regua/pad330_fundo.py
"""
import json, sys, collections, random, statistics
sys.path.insert(0,'scripts/regua')
import importlib.util
spec=importlib.util.spec_from_file_location('p','scripts/regua/pad330.py'); P=importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
DESDE=P.DESDE

def pop(addr, desde=0, teto=700):
    """mede a POPULACAO inteira de creditos (ate teto), sem amostragem"""
    rec=[x for x in P.PE[addr] if x['ts']>=desde]
    if len(rec)>teto:
        rec=P.amostra(rec,teto,addr); nota='amostra %d'%teto
    else: nota='populacao'
    P.buscar([x['txid'] for x in rec])
    vals=[]; ext=[]; pag330=collections.Counter(); pagtodos=collections.Counter()
    for x in rec:
        t=P._cache.get(x['txid'])
        if not t: continue
        v=t['vout'][x['vout']][0]; vals.append(v)
        ins=set(a for a in t['vin'] if a and a!=addr)
        eu = addr in t['vin']
        if not eu: ext.append(v)
        for a in ins: pagtodos[a]+=1
        if v in (330,331):
            for a in ins: pag330[a]+=1
    f=lambda l:(sum(1 for v in l if v in (330,331))/len(l)) if l else None
    return {'n':len(vals),'nota':nota,'pad330':f(vals),'pad330_ext':f(ext),'n_ext':len(ext),
            'dist':collections.Counter(vals).most_common(4),'pag330':pag330.most_common(4),
            'npag':len(pagtodos)}

ALVOS=[('pos 1',1),('pos 2',2),('pos 3',3),('pos 4',4),('pos 18',18),('pos 20',20),
       ('pos 36',36),('pos 47',47),('pos 311',311),
       ('mkt 2',83041),('mkt 3',83064),('mkt 1',82789),('CoinEx',6),('Kraken',82761)]
print('=== populacao inteira / amostra grande, TODOS os creditos ===')
for rot,p in ALVOS:
    a=P.POS[p]; r=pop(a)
    print('%-8s %-6s n=%-4d %-12s pad330=%5.1f%% ext=%s(%d) pagadores=%-4d %s  330 vem de: %s'%(
        rot,P.tipo(a),r['n'],r['nota'],100*r['pad330'],
        '--' if r['pad330_ext'] is None else '%.0f%%'%(100*r['pad330_ext']),r['n_ext'],r['npag'],r['dist'],r['pag330']))
print()
print('=== populacao inteira, so creditos de 2026 ===')
for rot,p in ALVOS:
    a=P.POS[p]; r=pop(a,DESDE)
    if r['n']==0: print('%-8s sem credito em 2026'%rot); continue
    print('%-8s %-6s n=%-4d %-12s pad330=%5.1f%% ext=%s(%d) %s  330 vem de: %s'%(
        rot,P.tipo(a),r['n'],r['nota'],100*r['pad330'],
        '--' if r['pad330_ext'] is None else '%.0f%%'%(100*r['pad330_ext']),r['n_ext'],r['dist'],r['pag330']))
print()
print('=== estabilidade: 400 reamostragens k=14 (janela 2026) ===')
for rot,p in [('pos 18',18),('pos 311',311),('pos 36',36),('pos 1',1)]:
    a=P.POS[p]; rec=[x for x in P.PE[a] if x['ts']>=DESDE]
    if len(rec)<2: continue
    P.buscar([x['txid'] for x in rec[:700]])
    vals=[]
    for x in rec:
        t=P._cache.get(x['txid'])
        if t: vals.append(t['vout'][x['vout']][0])
    rng=random.Random(7); f=[]
    for _ in range(400):
        s=rng.sample(vals,min(14,len(vals)))
        f.append(sum(1 for v in s if v in (330,331))/len(s))
    f.sort()
    print('%-8s N=%-4d exato=%5.1f%%  k=14: min %.0f%% p05 %.0f%% mediana %.0f%% p95 %.0f%% max %.0f%%'%(
        rot,len(vals),100*sum(1 for v in vals if v in (330,331))/len(vals),
        100*f[0],100*f[20],100*f[200],100*f[380],100*f[-1]))
