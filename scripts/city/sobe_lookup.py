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
# ⚠️ O PISO DA CURVA NAO E O PISO DA CIDADE, e confundir os dois publicava
# promessa falsa para 15.802 carteiras. A curva do snapshot tem piso de 1 m2,
# que e geometrico; o MENOR LOTE que a cidade constroi tem 24 m2, porque abaixo
# disso o dono nao cabe em pe no proprio terreno (masterplan §17). Quem nao
# alcanca o menor lote recebe LAPIDE no cemiterio, nao lote, e a consulta da
# landing precisa dizer isso em vez de mostrar "YOUR LOT: 10 m2".
#
# O corte e derivado, nunca escolhido: e o saldo que paga 24 m2 na curva
# publicada, (24 / 0,986443)^2 = 591,9411 DOG. A copy publica ele ARREDONDADO
# PARA CIMA (591,95), porque 591,94 pagam 23,999978 m2 e quem obedecesse a
# instrucao continuaria com lapide.
K, PISO_CURVA, TETO = 0.986443, 1.0, 40000.0
PISO_LOTE = 24.0
CORTE_DOG = (PISO_LOTE / K) ** 2

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
    _cem = d < CORTE_DOG
    linhas.append({'address':h['address'],'dog':round(d,5),
        # ⚠️ area 0 para quem tem lapide: a consulta le este campo e nao pode
        # anunciar metro quadrado para quem nao recebeu terra
        'area_m2': 0.0 if _cem else round(max(PISO_LOTE,min(TETO,K*math.sqrt(max(d,0)))),2),
        'destino': 'lapide' if _cem else 'lote',
        'genesis':float(h.get('airdrop_amount') or 0)>0,
        'runestones':int(h.get('runestones') or 0),
        'utxo_count':int(h.get('utxo_count') or 0)})
print(f'{len(linhas):,} carteiras, {sum(1 for l in linhas if l["genesis"]):,} com Genesis Badge, '
      f'{sum(1 for l in linhas if l["destino"]=="lapide"):,} com lapide (abaixo de {CORTE_DOG:.2f} DOG)',flush=True)

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
