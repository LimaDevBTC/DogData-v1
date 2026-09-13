#!/usr/bin/env python3
"""Sobe o recorte PUBLICO do snapshot 966.670 para `dog_snapshot_lookup` no Supabase.

⚠️ POR QUE ESTA TABELA EXISTE: `data/snapshots/` esta no .gitignore, a Vercel builda do clone
do GitHub, entao a busca da landing NAO tem como ler arquivo. E `/api/plot` hoje le arquivo
local com `fs` e serve numero diferente do snapshot.

⚠️ SO ENTRA O QUE PODE SER PUBLICO. Posicao, bairro e tag institucional ficam de fora de
proposito. Area vem da curva publica e depende so do saldo.
"""
import json, io, os, math, time, urllib.request

RAIZ='/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
SNAP=os.path.join(RAIZ,'data','snapshots')
K, PISO, TETO = 0.986443, 1.0, 40000.0

env={}
for arq in ('.env.local','.env'):
    p=os.path.join(RAIZ,arq)
    if not os.path.exists(p): continue
    for l in io.open(p,encoding='utf-8',errors='ignore'):
        l=l.strip()
        if '=' in l and not l.startswith('#'):
            k,v=l.split('=',1); env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
URL=env['SUPABASE_URL'].rstrip('/'); KEY=env['SUPABASE_SERVICE_ROLE_KEY']

hold=json.load(io.open(os.path.join(SNAP,'dog_snapshot_966670.json'),encoding='utf-8'))['holders']
linhas=[]
for h in hold:
    d=float(h.get('dog') or 0)
    linhas.append({'address':h['address'],'dog':round(d,5),
        'area_m2':round(max(PISO,min(TETO,K*math.sqrt(max(d,0)))),2),
        'genesis':float(h.get('airdrop_amount') or 0)>0,
        'runestones':int(h.get('runestones') or 0),
        'utxo_count':int(h.get('utxo_count') or 0)})
print(f'{len(linhas):,} carteiras, {sum(1 for l in linhas if l["genesis"]):,} com Genesis Badge',flush=True)

LOTE=1000
for i in range(0,len(linhas),LOTE):
    corpo=json.dumps(linhas[i:i+LOTE]).encode()
    r=urllib.request.Request(URL+'/rest/v1/dog_snapshot_lookup', data=corpo, method='POST',
        headers={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json',
                 'Prefer':'resolution=merge-duplicates,return=minimal'})
    for t in range(4):
        try:
            urllib.request.urlopen(r,timeout=120); break
        except Exception as e:
            if t==3: raise
            time.sleep(3*(t+1))
    if (i//LOTE)%15==0: print(f'  {i+LOTE:,}/{len(linhas):,}',flush=True)
    time.sleep(0.08)
print('pronto',flush=True)
