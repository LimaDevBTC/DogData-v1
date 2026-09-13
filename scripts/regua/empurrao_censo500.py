# censo COMPLETO do top 500 (pos 1 amostrada em 200 por causa dos 20.008 utxos).
# cache proprio em jsonl, nao mexe no emp_cache.json
import json, os, base64, http.client, random, sys, time
D='/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad/'
BASE='data/snapshots/'
O={x['address']:x for x in json.load(open(BASE+'dog_snapshot_966670_ordem.json'))['ordem']}
PE=json.load(open(BASE+'dog_snapshot_966670_utxos.json'))['por_endereco']
BYPOS={x['posicao']:x['address'] for x in O.values()}
CJ=D+'censo500.jsonl'
cache={}
if os.path.exists(CJ):
    for ln in open(CJ):
        try: d=json.loads(ln); cache[d['t']]=d
        except Exception: pass
print('cache inicial', len(cache), flush=True)
cook=open(os.path.expanduser('~/.bitcoin/.cookie')).read().strip()
auth='Basic '+base64.b64encode(cook.encode()).decode()
alvos={}
for p in range(1,501):
    a=BYPOS[p]; u=PE.get(a,[])
    alvos[p]=(a, u if p!=1 else random.Random(11).sample(u,200))
need=sorted({x['txid'] for _,u in alvos.values() for x in u} - set(cache))
print('faltam', len(need), flush=True)
f=open(CJ,'a')
t0=time.time()
for i in range(0,len(need),200):
    lote=need[i:i+200]
    body=json.dumps([{"jsonrpc":"1.0","id":t,"method":"getrawtransaction","params":[t,2]} for t in lote])
    c=http.client.HTTPConnection('127.0.0.1',8332,timeout=900)
    c.request('POST','/',body,{'Authorization':auth,'Content-Type':'application/json'})
    for e in json.loads(c.getresponse().read()):
        if e.get('result'):
            t=e['result']
            d={'t':e['id'],'nvin':len(t['vin']),'nvout':len(t['vout']),
               'vin_addr':sorted({((v.get('prevout') or {}).get('scriptPubKey') or {}).get('address') for v in t['vin']}-{None}),
               'opret':sum(1 for v in t['vout'] if v['scriptPubKey'].get('type')=='nulldata')}
            cache[d['t']]=d; f.write(json.dumps(d)+'\n')
    c.close(); f.flush()
    if i % 2000 == 0: print(f'  {i+len(lote)}/{len(need)} {time.time()-t0:.0f}s', flush=True)
f.close()
out={}
for p,(a,u) in alvos.items():
    n=e12=0
    for x in u:
        t=cache.get(x['txid'])
        if not t: continue
        n+=1
        if t['nvin']==1 and t['nvout']==2 and a not in t['vin_addr']: e12+=1
    out[p]={'a':a,'n':n,'e12':e12,'emp':(e12/n if n else None)}
json.dump(out,open(D+'censo500.json','w'))
v=[x['emp'] for x in out.values() if x['emp'] is not None]
print('CENSO top500: n=',len(v),'>0:',sum(1 for x in v if x>0),'>=0.05:',sum(1 for x in v if x>=.05),
      '>=0.25:',sum(1 for x in v if x>=.25),'>=0.5:',sum(1 for x in v if x>=.5))
for p in sorted(out, key=lambda q: -(out[q]['emp'] or 0)):
    if (out[p]['emp'] or 0)>0: print(f"  pos {p:4d} emp={out[p]['emp']*100:6.2f}% ({out[p]['e12']}/{out[p]['n']})")
