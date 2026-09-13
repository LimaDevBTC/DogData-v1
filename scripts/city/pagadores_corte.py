#!/usr/bin/env python3
"""Le o indice de pagadores do top 500 e mostra O QUE MUDA a cada limiar possivel.
E o material de decisao: o fundador escolhe o corte olhando quem sai e quem entra.
"""
import json, io, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SNAP = os.path.join(RAIZ, 'data', 'snapshots')

d = json.load(io.open(os.path.join(SNAP, 'dog_966670_pagadores_top500.json'), encoding='utf-8'))
linhas = {l['posicao']: l for l in d['linhas']}
rotf = os.path.join(SNAP, 'dog_966670_pagadores_rotulados.json')
rot = {}
gab = []
if os.path.exists(rotf):
    for l in json.load(io.open(rotf, encoding='utf-8'))['linhas']:
        if l.get('no_snapshot'):
            rot[l['address']] = l['rotulo']; gab.append(l)

ordem = json.load(io.open(os.path.join(SNAP, 'dog_snapshot_966670_ordem.json'),
                          encoding='utf-8'))['ordem']
emb = {x['address']: x.get('emblema') for x in ordem}

print('=' * 96)
print('  GABARITO: onde caem os enderecos de rotulo conhecido')
print('=' * 96)
if gab:
    print(f"  {'indice':>8} {'pag':>7} {'ev':>7} {'pos':>8}  rotulo")
    for l in sorted(gab, key=lambda l: -l['indice']):
        print(f"  {l['indice']:>8,} {l['pagadores']:>7,} {l['eventos']:>7,} {l['posicao']:>8,}  {l['rotulo']}")
else:
    print('  (ainda nao medido)')

print()
print('=' * 96)
print('  TOP 50 DA ORDEM ATUAL, com o indice')
print('=' * 96)
print(f"  {'pos':>4} {'DOG':>15} {'utxo':>6} {'assin':>6} {'ev':>6} {'pag':>6} {'indice':>7}  {'emblema':<13} rotulo")
for p in range(1, 51):
    l = linhas.get(p)
    if not l: continue
    print(f"  {p:>4} {l['dog']:>15,.0f} {l['utxo_count']:>6,} {l['assinou']:>6,} "
          f"{l['eventos']:>6,} {l['pagadores']:>6,} {l['indice']:>7,}  "
          f"{(emb.get(l['address']) or ''):<13} {rot.get(l['address'],'')}")

print()
print('=' * 96)
print('  EFEITO DE CADA LIMIAR no top 500')
print('=' * 96)
print(f"  {'limiar':>7} {'rebaixadas':>11} {'no top 50':>10} {'no top 100':>11} "
      f"{'no top 500':>11}  {'DOG rebaixado':>18}")
for t in (20, 30, 40, 50, 60, 75, 100, 150, 200, 300, 500):
    peg = [l for l in d['linhas'] if l['indice'] >= t]
    print(f"  {t:>7,} {len(peg):>11} {sum(1 for l in peg if l['posicao']<=50):>10} "
          f"{sum(1 for l in peg if l['posicao']<=100):>11} {len(peg):>11}  "
          f"{sum(l['dog'] for l in peg):>18,.0f}")

alvo = int(sys.argv[1]) if len(sys.argv) > 1 else None
if alvo:
    print()
    print('=' * 96)
    print(f'  CORTE EM {alvo}: quem sai do top 500')
    print('=' * 96)
    peg = sorted([l for l in d['linhas'] if l['indice'] >= alvo], key=lambda l: l['posicao'])
    for l in peg:
        print(f"  pos {l['posicao']:>4}  {l['dog']:>15,.0f} DOG  indice {l['indice']:>6,}  "
              f"({l['pagadores']:,} pag / {l['eventos']:,} ev)  assinou {l['assinou']:,}  "
              f"{rot.get(l['address'],'')}")
    print(f"\n  {len(peg)} rebaixadas, {sum(l['dog'] for l in peg):,.0f} DOG")
    print(f"  {len(peg)} carteiras sobem para a Orla Nobre no lugar delas")
    zero = [l for l in peg if l['assinou'] == 0]
    if zero:
        print(f"\n  ATENCAO: {len(zero)} das rebaixadas tem ZERO assinatura (nunca gastaram):")
        for l in zero:
            print(f"    pos {l['posicao']}  {l['dog']:,.0f} DOG  indice {l['indice']:,}  "
                  f"emblema {emb.get(l['address'])}")

sd = [l for l in d['linhas'] if l['tx_sem_dado']]
if sd:
    print(f"\n  {len(sd)} carteiras com transacao sem dado no no (indice e piso, nao exato)")
