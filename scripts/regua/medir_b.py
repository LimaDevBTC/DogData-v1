#!/usr/bin/env python3
"""Medicao independente da impressao 'maior UTXO unico em multiplos de 889.806 DOG'."""
import json, random, statistics
B='data/snapshots/'
AIR=889806.0
H={x['address']:x for x in json.load(open(B+'dog_snapshot_966670.json'))['holders']}
O={x['address']:x for x in json.load(open(B+'dog_snapshot_966670_ordem.json'))['ordem']}
PE=json.load(open(B+'dog_snapshot_966670_utxos.json'))['por_endereco']

def mx(a):
    u=PE.get(a,[])
    return (max(x['dog'] for x in u)/AIR) if u else 0.0

ROT=[('pos 6 CoinEx/deposit','bc1qmscmeqqxqz7vkfscfs8pvl98gkdkcr8e0egkhm'),
 ('pos 10 distributor A','bc1p6vly9m3e7yh5hwwkz92l89w2qqhyj4htkqewml963g7kn9k79qase0ukl3'),
 ('pos 11 distributor B','bc1p4pkr90vrqspmfddplde05v55gelkvcjwhsu93c9m5zu9gwwvgz0qap0vkn'),
 ('pos 18743 Gate.io/hot','1G47mSr3oANXMafVrR8UC4pzV7FEAzo3r9'),
 ('pos 82761 Kraken/hot','bc1plzs2lltvv29k603w5m0aqma5e8w0n3pc77dt89l5w9hurmdfgd0swdhspn'),
 ('pos 82762 treasury/cold','bc1pzsx4xvghxmc0prv4mys0xdly9dh9js3e88e4m24k5gxzkeskx30s4qzjud'),
 ('pos 83960 Bitget/hot','1FWQiwK27EnGXb6BiBMRLJvunJQZZPMcGd'),
 ('mkt 1','bc1pjywvrxfrsr25dkl9gmtuy8w7w8a7mg7vz0j89v3g6d0x8suvgg6qdchqul'),
 ('mkt 2','bc1pacdg0ayufh9qlyx52w73eejpka8srsgnuwraaeu2t8mlf3h70tkq0keg74'),
 ('mkt 3','bc1pud2j5tpy5s3c5u6y7e2lqn8tp5208q0mmxjtjqncmzp9wyj5gssswnz8nk')]

print('=== 1) GABARITO ROTULADO ===')
print(f"{'rotulo':26} {'pos':>7} {'maiorUTXO x':>12} {'maiorDOG':>18} {'saldo DOG':>18} {'utxo':>7} {'>=90':>5}")
for nm,a in ROT:
    if a not in PE: print(nm,'AUSENTE'); continue
    v=mx(a); h=H[a]; p=O.get(a,{}).get('posicao')
    print(f"{nm:26} {str(p):>7} {v:12.1f} {v*AIR:18,.0f} {h['dog']:18,.0f} {h['utxo_count']:7} {'SIM' if v>=90 else '.':>5}")

print()
print('=== 2) POSICOES 1 a 20 ===')
ordem=json.load(open(B+'dog_snapshot_966670_ordem.json'))['ordem']
print(f"{'pos':>4} {'maiorUTXO x':>12} {'maiorDOG':>18} {'saldo DOG':>18} {'utxo':>7} {'maior/saldo':>11} {'>=90':>5} addr")
for r in ordem[:20]:
    a=r['address']; v=mx(a)
    print(f"{r['posicao']:4} {v:12.1f} {v*AIR:18,.0f} {r['dog']:18,.0f} {r['utxo_count']:7} {v*AIR/r['dog']:11.3f} {'SIM' if v>=90 else '.':>5} {a}")

print()
print('=== 3) CONTROLE 300 sorteadas (dog>=100000, posicao>500) ===')
cand=sorted([r['address'] for r in ordem if r['posicao']>500 and r['dog']>=100000])
print('universo elegivel:',len(cand))
ctl=random.Random(966670).sample(cand,300)
vs=sorted(mx(a) for a in ctl)
def q(l,p): 
    i=(len(l)-1)*p; lo=int(i); hi=min(lo+1,len(l)-1); return l[lo]+(l[hi]-l[lo])*(i-lo)
print('n=300  min %.3f p50 %.3f p90 %.2f p95 %.2f p99 %.2f max %.2f'%(vs[0],q(vs,.5),q(vs,.9),q(vs,.95),q(vs,.99),vs[-1]))
for t in (90,50,30,20,10,5,2,1):
    print('  >=%-4g : %3d de 300 (%.1f%%)'%(t,sum(1 for v in vs if v>=t),100*sum(1 for v in vs if v>=t)/300))

print()
print('=== 4) CIDADE INTEIRA ===')
todos=sorted(mx(a) for a in PE)
print('n=%d  p50 %.4f p90 %.4f p99 %.4f p99.9 %.4f p99.99 %.4f max %.1f'%(
    len(todos),q(todos,.5),q(todos,.9),q(todos,.99),q(todos,.999),q(todos,.9999),todos[-1]))
for t in (500,200,90,50,30,20,10):
    n=sum(1 for v in todos if v>=t); print('  >=%-4g : %5d (%.4f%%)'%(t,n,100*n/len(todos)))

print()
print('=== 5) QUEM PASSA DE 90x ===')
pas=sorted([(mx(a),a) for a in PE if mx(a)>=90], reverse=True)
ROTSET={a for _,a in ROT}
LAB={a:nm for nm,a in ROT}
print(f"{'#':>3} {'x':>9} {'pos':>7} {'saldo DOG':>16} {'utxo':>7} {'maior/saldo':>11} {'assinou':>8} {'lth%':>6} rotulo/addr")
for i,(v,a) in enumerate(pas,1):
    o=O.get(a,{}); h=H[a]
    print(f"{i:3} {v:9.1f} {str(o.get('posicao')):>7} {h['dog']:16,.0f} {h['utxo_count']:7} {v*AIR/h['dog']:11.3f} {str(o.get('assinou')):>8} {h['lth_pct']:6.1f} {LAB.get(a,'')} {a[:22]}")
print('total >=90x:',len(pas),' dentro do top500:',sum(1 for v,a in pas if O.get(a,{}).get('posicao',10**9)<=500))
