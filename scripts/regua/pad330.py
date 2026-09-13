#!/usr/bin/env python3
"""Auditoria da impressao "padding de 330 satoshi no UTXO de rune".
Uso: python3 scripts/regua/pad330.py [--controle]
Mede pad330 em duas janelas (todos os creditos e so creditos de 2026), separa
credito externo de consolidacao interna, e tabula o padding por TIPO DE SCRIPT
do endereco que recebe (o limite de dust depende do tipo, logo 330 e impossivel
em P2PKH/P2SH).
"""
import json, sys, os, base64, http.client, random, collections, time

BASE='data/snapshots/'
CACHE='/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad/pad330_txcache.json'
DESDE=1767225600          # 2026-01-01 00:00 UTC
MKT={'bc1pjywvrxfrsr25dkl9gmtuy8w7w8a7mg7vz0j89v3g6d0x8suvgg6qdchqul',
     'bc1pacdg0ayufh9qlyx52w73eejpka8srsgnuwraaeu2t8mlf3h70tkq0keg74',
     'bc1pud2j5tpy5s3c5u6y7e2lqn8tp5208q0mmxjtjqncmzp9wyj5gssswnz8nk'}
# limite de dust do Bitcoin Core (dustRelayFee 3000 sat/kvB) por tipo de saida
DUST={'p2pkh':546,'p2sh':540,'p2wpkh':294,'p2wsh':330,'p2tr':330,'?':546}

H={x['address']:x for x in json.load(open(BASE+'dog_snapshot_966670.json'))['holders']}
O={x['address']:x for x in json.load(open(BASE+'dog_snapshot_966670_ordem.json'))['ordem']}
PE=json.load(open(BASE+'dog_snapshot_966670_utxos.json'))['por_endereco']
POS={v['posicao']:k for k,v in O.items()}

def tipo(a):
    if a.startswith('bc1p'): return 'p2tr'
    if a.startswith('bc1q'): return 'p2wpkh' if len(a)==42 else 'p2wsh'
    if a.startswith('3'): return 'p2sh'
    if a.startswith('1'): return 'p2pkh'
    return '?'

# ---------------- no ----------------
_cache={}
if os.path.exists(CACHE): _cache=json.load(open(CACHE))
def _auth():
    cook=open(os.path.expanduser('~/.bitcoin/.cookie')).read().strip()
    return 'Basic '+base64.b64encode(cook.encode()).decode()
def _trim(t):
    """guarda so o necessario: valor+tipo+endereco de cada vout e enderecos dos vin"""
    vin=[]
    for v in t['vin']:
        sp=(v.get('prevout') or {}).get('scriptPubKey') or {}
        vin.append(sp.get('address'))
    vout=[]
    for v in t['vout']:
        sp=v['scriptPubKey'] or {}
        vout.append([int(round(v['value']*1e8)), sp.get('type'), sp.get('address')])
    return {'vin':vin,'vout':vout,'nin':len(t['vin']),'nout':len(t['vout'])}
def buscar(txids):
    falta=sorted({t for t in txids if t not in _cache})
    if not falta: return
    auth=_auth(); t0=time.time()
    for i in range(0,len(falta),200):
        lote=falta[i:i+200]
        body=json.dumps([{"jsonrpc":"1.0","id":t,"method":"getrawtransaction","params":[t,2]} for t in lote])
        c=http.client.HTTPConnection('127.0.0.1',8332,timeout=900)
        c.request('POST','/',body,{'Authorization':auth,'Content-Type':'application/json'})
        for e in json.loads(c.getresponse().read()):
            if e.get('result'): _cache[e['id']]=_trim(e['result'])
        c.close()
    print('  [no] %d tx novas em %.0fs (cache=%d)'%(len(falta),time.time()-t0,len(_cache)),file=sys.stderr)
    json.dump(_cache,open(CACHE,'w'))

# ---------------- a medida ----------------
def amostra(rec,k,addr):
    rng=random.Random('pad330|'+addr)
    return rec if len(rec)<=k else rng.sample(rec,k)
def medir(addr,k=14,desde=0):
    rec=[x for x in PE.get(addr,[]) if x['ts']>=desde]
    sam=amostra(rec,k,addr)
    buscar([x['txid'] for x in sam])
    pads=[]; ext=[]; selfin=0; usados=0; mkt=0
    for x in sam:
        t=_cache.get(x['txid'])
        if not t: continue
        usados+=1
        v=t['vout'][x['vout']][0]
        pads.append(v)
        eu = addr in t['vin']
        if eu: selfin+=1
        else: ext.append(v)
        if set(a for a in t['vin'] if a)&MKT: mkt+=1
    def f330(l): return (sum(1 for v in l if v in (330,331))/len(l)) if l else None
    return {'nrec':len(rec),'am':usados,'ntx':len({x['txid'] for x in sam}),
            'pad330':f330(pads),'pad330_ext':f330(ext),'n_ext':len(ext),
            'self':selfin/usados if usados else None,'mkt':mkt/usados if usados else None,
            'dustmin':(sum(1 for v in pads if v==DUST[tipo(addr)])/len(pads)) if pads else None,
            'top':collections.Counter(pads).most_common(3),'tipo':tipo(addr)}

def linha(rot,addr):
    a=medir(addr,14,0); b=medir(addr,14,DESDE)
    def p(x): return '  -- ' if x is None else '%4.0f%%'%(100*x)
    print('%-22s pos %6s %-6s n=%-5d | TODOS am=%-2d %s ext=%s(%d) self=%s dust=%s %s | 2026 n=%-4d am=%-2d %s ext=%s(%d) %s'%(
        rot,O[addr]['posicao'],a['tipo'],len(PE.get(addr,[])),
        a['am'],p(a['pad330']),p(a['pad330_ext']),a['n_ext'],p(a['self']),p(a['dustmin']),a['top'],
        b['nrec'],b['am'],p(b['pad330']),p(b['pad330_ext']),b['n_ext'],b['top']))
    return addr,a,b

ROTULOS=[('CoinEx/deposit',6),('distributor A',10),('distributor B',11),('distributor C',16),
         ('Gate.io/hot',18743),('Kraken/hot',82761),('treasury/cold',82762),('desk',82764),
         ('marketplace 1',82789),('marketplace 2',83041),('marketplace 3',83064),('Bitget/hot',83960)]

if __name__=='__main__':
    res={}
    print('=== 13 rotulados (gabarito) ===')
    for rot,p in ROTULOS: res[rot]=linha(rot,POS[p])
    print()
    print('=== posicoes 1 a 20 ===')
    for p in range(1,21): res['pos%d'%p]=linha('pos %d'%p,POS[p])
    if '--controle' in sys.argv:
        print()
        cand=sorted(a for a in PE if H[a]['dog']>=100000 and O[a]['posicao']>500)
        ctrl=random.Random(966670).sample(cand,300)
        print('=== controle: 300 carteiras (dog>=100k, pos>500) de %d candidatas ==='%len(cand))
        out=[]
        for a in ctrl:
            x=medir(a,8,0); y=medir(a,14,DESDE); out.append((a,x,y))
        json.dump([[a,x,y] for a,x,y in out],open('/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad/pad330_controle.json','w'))
        print('controle salvo, %d carteiras'%len(out))
    # padding por tipo de script sobre TODAS as saidas pequenas das tx buscadas
    print()
    print('=== padding pequeno (<2000 sat) por tipo de saida, em %d tx do cache ==='%len(_cache))
    tab=collections.defaultdict(collections.Counter)
    for t in _cache.values():
        for v,ty,ad in t['vout']:
            if 0<v<2000: tab[ty][v]+=1
    for ty,c in sorted(tab.items(),key=lambda z:-sum(z[1].values())):
        n=sum(c.values())
        print('%-22s n=%-8d 330/331=%-7.3f%% %s'%(ty,n,100*(c[330]+c[331])/n,c.most_common(5)))
