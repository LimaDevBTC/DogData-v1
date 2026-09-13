import json,base64,http.client,os
B='data/snapshots/'; AIR=889806.0
H={x['address']:x for x in json.load(open(B+'dog_snapshot_966670.json'))['holders']}
ordem=json.load(open(B+'dog_snapshot_966670_ordem.json'))['ordem']
O={x['address']:x for x in ordem}
PE=json.load(open(B+'dog_snapshot_966670_utxos.json'))['por_endereco']
def top(a):
    return max(PE[a],key=lambda x:x['dog'])
alvos=[a for a in PE if max(x['dog'] for x in PE[a])/AIR>=90]
alvos+= [ordem[i]['address'] for i in range(4)]
alvos=list(dict.fromkeys(alvos))
txids=[top(a)['txid'] for a in alvos]
cook=open(os.path.expanduser('~/.bitcoin/.cookie')).read().strip()
auth='Basic '+base64.b64encode(cook.encode()).decode()
out={}
for i in range(0,len(txids),200):
    body=json.dumps([{"jsonrpc":"1.0","id":t,"method":"getrawtransaction","params":[t,2]} for t in txids[i:i+200]])
    c=http.client.HTTPConnection('127.0.0.1',8332,timeout=600)
    c.request('POST','/',body,{'Authorization':auth,'Content-Type':'application/json'})
    for e in json.loads(c.getresponse().read()):
        if e.get('result'): out[e['id']]=e['result']
    c.close()
print('tx buscadas:',len(out),'de',len(set(txids)))
LAB={'bc1qmscmeqqxqz7vkfscfs8pvl98gkdkcr8e0egkhm':'CoinEx/dep','bc1p4pkr90vrqspmfddplde05v55gelkvcjwhsu93c9m5zu9gwwvgz0qap0vkn':'distribB',
'bc1plzs2lltvv29k603w5m0aqma5e8w0n3pc77dt89l5w9hurmdfgd0swdhspn':'Kraken/hot','bc1pzsx4xvghxmc0prv4mys0xdly9dh9js3e88e4m24k5gxzkeskx30s4qzjud':'treasury'}
MKT={'bc1pjywvrxfrsr25dkl9gmtuy8w7w8a7mg7vz0j89v3g6d0x8suvgg6qdchqul','bc1pacdg0ayufh9qlyx52w73eejpka8srsgnuwraaeu2t8mlf3h70tkq0keg74','bc1pud2j5tpy5s3c5u6y7e2lqn8tp5208q0mmxjtjqncmzp9wyj5gssswnz8nk'}
print()
print(f"{'pos':>6} {'x':>8} {'nin':>4} {'nout':>5} {'eh_input':>8} {'insBTC':>7} {'mkt?':>5} rotulo / addr")
res=[]
for a in alvos:
    t=out.get(top(a)['txid'])
    if not t: print('FALTA',a); continue
    ins=set()
    for v in t['vin']:
        ad=((v.get('prevout') or {}).get('scriptPubKey') or {}).get('address')
        if ad: ins.add(ad)
    ehin = a in ins
    tocaMkt = bool(ins & MKT)
    v=max(x['dog'] for x in PE[a])/AIR
    res.append((O[a]['posicao'],v,len(t['vin']),len(t['vout']),ehin,len(ins),tocaMkt,LAB.get(a,''),a))
for r in sorted(res):
    print(f"{r[0]:6} {r[1]:8.1f} {r[2]:4} {r[3]:5} {'SIM' if r[4] else '.':>8} {r[5]:7} {'SIM' if r[6] else '.':>5} {r[7]} {r[8][:20]}")
p90=[r for r in res if r[1]>=90]
print()
print('dos %d que passam de 90x: o proprio endereco e INPUT da tx que criou o UTXO grande em %d (%.0f%%)'%(
  len(p90),sum(1 for r in p90 if r[4]),100*sum(1 for r in p90 if r[4])/len(p90)))
print('  no top500: %d de %d sao input'%(sum(1 for r in p90 if r[0]<=500 and r[4]),sum(1 for r in p90 if r[0]<=500)))
