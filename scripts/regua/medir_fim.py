import json,random
from fractions import Fraction
B='data/snapshots/'; AIR=889806.0; AIRB=88980600000
H={x['address']:x for x in json.load(open(B+'dog_snapshot_966670.json'))['holders']}
ordem=json.load(open(B+'dog_snapshot_966670_ordem.json'))['ordem']
O={x['address']:x for x in ordem}
PE=json.load(open(B+'dog_snapshot_966670_utxos.json'))['por_endereco']
def topu(a): return max(PE[a],key=lambda x:x['dog'])
def mx(a): return max(x['dog'] for x in PE[a])/AIR
def pacote(am): return Fraction(am,AIRB).limit_denominator(10000)==Fraction(am,AIRB)

print('=== SOBREPOSICAO DE FAIXAS ===')
ROT=[('Gate.io/hot','1G47mSr3oANXMafVrR8UC4pzV7FEAzo3r9'),
 ('distributor A','bc1p6vly9m3e7yh5hwwkz92l89w2qqhyj4htkqewml963g7kn9k79qase0ukl3'),
 ('distributor C (pos 16)','bc1pw56l62nnaneldkuyyqlr4jh2tptn779c4d06tdmkd0h7xfq59jtquvtxwl'),
 ('mkt 3','bc1pud2j5tpy5s3c5u6y7e2lqn8tp5208q0mmxjtjqncmzp9wyj5gssswnz8nk'),
 ('Bitget/hot','1FWQiwK27EnGXb6BiBMRLJvunJQZZPMcGd'),
 ('mkt 1','bc1pjywvrxfrsr25dkl9gmtuy8w7w8a7mg7vz0j89v3g6d0x8suvgg6qdchqul'),
 ('mkt 2','bc1pacdg0ayufh9qlyx52w73eejpka8srsgnuwraaeu2t8mlf3h70tkq0keg74'),
 ('distributor B','bc1p4pkr90vrqspmfddplde05v55gelkvcjwhsu93c9m5zu9gwwvgz0qap0vkn'),
 ('CoinEx/deposit','bc1qmscmeqqxqz7vkfscfs8pvl98gkdkcr8e0egkhm'),
 ('treasury/cold','bc1pzsx4xvghxmc0prv4mys0xdly9dh9js3e88e4m24k5gxzkeskx30s4qzjud'),
 ('Kraken/hot','bc1plzs2lltvv29k603w5m0aqma5e8w0n3pc77dt89l5w9hurmdfgd0swdhspn')]
vr=sorted((mx(a),n) for n,a in ROT)
print('11 rotulados de servico, ordenados:', ', '.join('%s %.1fx'%(n,v) for v,n in vr))
cand=sorted([r['address'] for r in ordem if r['posicao']>500 and r['dog']>=100000])
ctl=random.Random(966670).sample(cand,300)
cv=sorted(mx(a) for a in ctl)
print('controle 300 comuns: min %.3fx  max %.2fx'%(cv[0],cv[-1]))
dentro=[(v,n) for v,n in vr if v<=cv[-1]]
print('rotulados DENTRO da faixa ocupada por carteira comum (<= %.2fx): %d de 11 -> %s'%(
  cv[-1],len(dentro),', '.join('%s %.1fx'%(n,v) for v,n in dentro)))
print()
for t in (90,50,40,34,20,2,1):
    fn=[n for v,n in vr if v<t]; fp=sum(1 for v in cv if v>=t)
    print('corte %-4g : pega %2d/11 rotulados, %3d/300 do controle (%.1f%%)  perde: %s'%(
      t,11-len(fn),fp,100*fp/300,', '.join(fn)[:80]))

print()
print('=== OS 26 MARCADOS: o UTXO grande e PACOTE de 889.806? ===')
p90=sorted([(mx(a),a) for a in PE if mx(a)>=90],reverse=True)
npac=0
for v,a in p90:
    u=topu(a); pk=pacote(u['amount'])
    if pk: npac+=1
print('pacote: %d de 26'%npac)
print('no top500: %d de 14'%sum(1 for v,a in p90 if O[a]['posicao']<=500 and pacote(topu(a)['amount'])))
print('valor redondo em DOG inteiro terminando em 000.000: %d de 26'%sum(1 for v,a in p90 if topu(a)['amount']%100000000000==0))

print()
print('=== CUSTO: os 14 marcados dentro do top500 ===')
EVID={2:'138 inputs de 1 pagador (varredura)',4:'2-in, nao e input',5:'e INPUT (forma PSBT)',
 6:'ROTULADO CoinEx',11:'ROTULADO distributor B',12:'e INPUT (forma PSBT)',14:'2 pagadores',
 15:'e INPUT, pagador = ELE MESMO (consolidacao pura)',17:'recebeu de distribA x25 + distribC x21',
 21:'114 inputs de UM unico pagador (auto-migracao)',35:'e INPUT (forma PSBT)',
 45:'recebeu de pos1 x115 + distribA x28 + distribC x7',62:'2 pagadores',
 74:'19 inputs de UM unico pagador (auto-migracao)'}
for v,a in sorted(p90,key=lambda z:O[z[1]]['posicao']):
    p=O[a]['posicao']
    if p>500: continue
    print('pos %-4d %7.1fx utxo %5d assinou %5s lth %5.1f%% | %s'%(p,v,H[a]['utxo_count'],O[a]['assinou'],H[a]['lth_pct'],EVID.get(p,'?')))
