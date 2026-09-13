import json, sys, statistics as st, collections
sys.path.insert(0, '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad/potecomum')
import auditoria_pote_comum_rpc as rpc2
M='/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad/potecomum/'
plano=json.load(open(M+'plano.json')); snap=set(json.load(open(M+'snapshot_addrs.json')))
POS1='bc1pk8g4rztfkxs2q9c40g6keeknjw6aadx3kzu4suzlll0remfw7xxs5x9ctv'

det={}; fin=collections.defaultdict(set); fanout=collections.defaultdict(list)
for a,p in plano.items():
    L=[]
    for t in p['tx']:
        d=rpc2.load(t)
        if not d: continue
        vin=[v for v in d['vin'] if v.get('v') is not None]
        if not vin: continue
        f=max(vin,key=lambda v:v['v'])['a']
        L.append({'f':f,'proprio':any(v['a']==a for v in d['vin']),'nout':len(d['vout']),
                  's546':a!=POS1 and any(o['a']==POS1 and abs((o['v'] or 0)-5.46e-6)<1e-9 for o in d['vout'])})
        if f and f!=a and a in snap:
            fin[f].add(a); fanout[f].append(len(d['vout']))
    det[a]=L
comp={f for f,s in fin.items() if len(s)>=2}
lote={f for f in comp if st.median(fanout[f])>=100}
print('tx lidas %d | financiadores %d | compartilhados %d | destes, pagadores de LOTE %d'%(
    sum(len(v) for v in det.values()), len(fin), len(comp), len(lote)))
print('maiores compartilhados:', [(len(fin[f]),f[:18]) for f in sorted(comp,key=lambda x:-len(fin[x]))[:7]])

def ind(a, universo, so_ext=False):
    L=[x for x in det[a] if (not so_ext or not x['proprio'])]
    if not L: return None,0
    return sum(1 for x in L if x['f'] in universo and x['f']!=a)/len(L), len(L)

R={}
for a,p in plano.items():
    i,n=ind(a,comp); ie,ne=ind(a,comp,True)
    j,_=ind(a,comp-lote); je,_=ind(a,comp-lote,True)
    R[a]={'rot':p['rotulo'],'pos':p['posicao'],'dog':p['dog'],'g':p['grupos'],
          'n':n,'ntot':p['n_tx_distintas'],'idx':i,'idx_ext':ie,'idx_sl':j,'idx_sl_ext':je,
          'f546':(sum(1 for x in det[a] if x['s546'])/len(det[a])) if det[a] else None,
          'proprio':(sum(1 for x in det[a] if x['proprio'])/len(det[a])) if det[a] else None}
json.dump(R,open(M+'final.json','w'))

def q(v,p): v=sorted(v); return v[min(len(v)-1,int(p*len(v)))]
print('\n== A: rotulados de servico (13 no snapshot) ==')
print('%-16s %-7s %-9s %6s %6s %6s %6s'%('rotulo','pos','amostra','idx','idxEx','idxSL','546'))
for a,r in sorted([x for x in R.items() if x[1]['rot']],key=lambda kv:kv[1]['rot']):
    if not r['n']: continue
    print('%-16s %-7s %4d/%-5d %5.1f%% %5.1f%% %5.1f%% %5.1f%%'%(r['rot'],r['pos'],r['n'],r['ntot'],
        100*r['idx'],100*(r['idx_ext'] or 0),100*r['idx_sl'],100*r['f546']))
print('\n== B: posicoes 1 a 20 ==')
print('%-5s %-9s %6s %6s %6s %6s %7s'%('pos','amostra','idx','idxEx','idxSL','546','proprio'))
for a,r in sorted([x for x in R.items() if x[1]['pos'] and x[1]['pos']<=20],key=lambda kv:kv[1]['pos']):
    print('%-5d %4d/%-5d %5.1f%% %5.1f%% %5.1f%% %5.1f%% %6.1f%%  %s'%(r['pos'],r['n'],r['ntot'],
        100*r['idx'],100*(r['idx_ext'] or 0),100*r['idx_sl'],100*r['f546'],100*r['proprio'],r['rot'] or ''))
print('\n== C: grupos ==')
for g in ('top500','controle','controle10'):
    L=[r for r in R.values() if g in r['g'] and r['n']]
    for campo in ('idx','idx_sl'):
        v=[r[campo] for r in L]
        print('%-11s %-7s n=%3d  mediana %5.1f%%  p75 %5.1f%%  p90 %5.1f%%  >=50%%: %3d (%4.1f%%)  =100%%: %3d'%(
          g,campo,len(L),100*st.median(v),100*q(v,.75),100*q(v,.90),sum(1 for x in v if x>=.5),
          100*sum(1 for x in v if x>=.5)/len(L),sum(1 for x in v if x==1)))
    v=[r['f546'] for r in L]
    print('%-11s %-7s n=%3d  >0: %d (%.1f%%)  >=50%%: %d (%.1f%%)'%(g,'546',len(L),
       sum(1 for x in v if x>0),100*sum(1 for x in v if x>0)/len(L),sum(1 for x in v if x>=.5),100*sum(1 for x in v if x>=.5)/len(L)))
print('\n== D: varredura de limiar (idx_sl = melhor variante, sem pagador de lote) ==')
rots=[r for r in R.values() if r['rot'] and r['n']]
ctr=[r for r in R.values() if ('controle' in r['g'] or 'controle10' in r['g']) and r['n']]
t5=[r for r in R.values() if 'top500' in r['g'] and r['n']]
print('limiar  servicos pegos/13   controles acima (FP)   top500 acima')
for lim in (0.01,0.1,0.25,0.5,0.66,0.8,0.9,1.0):
    fn=sum(1 for r in rots if r['idx_sl']<lim); fp=sum(1 for r in ctr if r['idx_sl']>=lim)
    n5=sum(1 for r in t5 if r['idx_sl']>=lim)
    print('%5.0f%%   %2d pegos, %2d perdidos    %3d/%d = %4.1f%%          %3d/500 = %4.1f%%'%(
      100*lim,len(rots)-fn,fn,fp,len(ctr),100*fp/len(ctr),n5,100*n5/500))
