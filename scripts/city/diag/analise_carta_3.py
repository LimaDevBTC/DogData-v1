#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Parte 3: overlap real de LOTES entre blocos vizinhos, raioBorda/raioSitio,
cunha de giro por distrito, Orla da Baia em tiras, avenida x baia. So leitura."""
import csv, json, math, os
from collections import defaultdict, Counter

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
DEG = math.pi / 180

def P(*a):
    return os.path.join(RAIZ, *a)

def cantos(x, z, w, d, giro):
    ca, sa = math.cos(giro), math.sin(giro)
    return [(x + dx*ca - dz*sa, z + dx*sa + dz*ca)
            for dx, dz in ((-w/2, -d/2), (w/2, -d/2), (w/2, d/2), (-w/2, d/2))]

def rumo_de(x, z):
    return (math.degrees(math.atan2(x, -z)) + 360) % 360

def penetracao(A, B):
    pior = 1e9
    for P_, Q_ in ((A, B), (B, A)):
        for i in range(4):
            ex, ez = P_[(i+1) % 4][0]-P_[i][0], P_[(i+1) % 4][1]-P_[i][1]
            n = math.hypot(ex, ez)
            if n < 1e-9:
                continue
            nx, nz = -ez/n, ex/n
            pa = [p[0]*nx+p[1]*nz for p in P_]; pb = [p[0]*nx+p[1]*nz for p in Q_]
            sep = max(min(pb)-max(pa), min(pa)-max(pb))
            if sep > 0:
                return 0.0
            pior = min(pior, -sep)
    return pior

with open(P('data/dogcity_lotes.csv'), newline='') as f:
    linhas = list(csv.DictReader(f))
malha = json.load(open(P('public/city/cidade-malha.json')))
cidade = json.load(open(P('public/city/cidade.json')))
mapa = json.load(open(P('public/city/mapa-v1.json')))

por_bloco = defaultdict(list)
for r in linhas:
    bid = '-'.join(r['lot_id'].split('-')[:3])
    por_bloco[bid].append(r)

by_id = {b['id']: b for b in malha['quarteiroes']}

def cantos_lote(r):
    x, z = float(r['x_m']), float(r['z_m'])
    w, d, g = float(r['frente_m']), float(r['prof_m']), math.radians(float(r['giro_graus']))
    return cantos(x, z, w, d, g)

# ═════════════════════════════════════════════════════════════════════════
# 8. dos pares de BLOCOS que se sobrepoem (achado na parte 2), os LOTES REAIS
#    de um bloco tambem invadem os lotes reais do outro? (nao so o retangulo
#    abstrato da malha)
# ═════════════════════════════════════════════════════════════════════════
print('='*78)
print('8) Pares de blocos com retangulo sobreposto: os LOTES REAIS tambem se')
print('   tocam, ou o generator deixou a faixa de sobreposicao vazia?')
print('='*78)
CEL = 100.0
blocos = malha['quarteiroes']
def bbox_bloco(b):
    return cantos(b['x'], b['z'], b['lado'], b['prof'], math.radians(b['giro']))
grade = defaultdict(list)
info = {}
for i, b in enumerate(blocos):
    cs = bbox_bloco(b)
    xs = [c[0] for c in cs]; zs = [c[1] for c in cs]
    info[i] = (min(xs), max(xs), min(zs), max(zs), cs)
    i0, i1 = int(info[i][0]//CEL), int(info[i][1]//CEL)
    j0, j1 = int(info[i][2]//CEL), int(info[i][3]//CEL)
    for ci in range(i0, i1+1):
        for cj in range(j0, j1+1):
            grade[(ci, cj)].append(i)

def eixos_separadores(A, B):
    for P_, Q_ in ((A, B), (B, A)):
        for i in range(4):
            ex, ez = P_[(i+1) % 4][0]-P_[i][0], P_[(i+1) % 4][1]-P_[i][1]
            n = math.hypot(ex, ez)
            if n < 1e-9:
                continue
            nx, nz = -ez/n, ex/n
            pa = [p[0]*nx+p[1]*nz for p in P_]; pb = [p[0]*nx+p[1]*nz for p in Q_]
            if min(pb) > max(pa) or max(pb) < min(pa):
                return 0.0
    pior = 1e18
    for P_, Q_ in ((A, B), (B, A)):
        for i in range(4):
            ex, ez = P_[(i+1) % 4][0]-P_[i][0], P_[(i+1) % 4][1]-P_[i][1]
            n = math.hypot(ex, ez)
            if n < 1e-9:
                continue
            nx, nz = -ez/n, ex/n
            pa = [p[0]*nx+p[1]*nz for p in P_]; pb = [p[0]*nx+p[1]*nz for p in Q_]
            sep = max(min(pb)-max(pa), min(pa)-max(pb))
            pior = min(pior, -sep)
    return pior

vistos = set()
pares = []
for cel, idxs in grade.items():
    idxs = sorted(set(idxs))
    for a in range(len(idxs)):
        for c in range(a+1, len(idxs)):
            i, j = idxs[a], idxs[c]
            if blocos[i]['id'] == blocos[j]['id']:
                continue
            key = (i, j) if i < j else (j, i)
            if key in vistos:
                continue
            vistos.add(key)
            pen = eixos_separadores(info[i][4], info[j][4])
            if pen > 0.5:
                pares.append((pen, i, j))

n_pares_com_lote_sobreposto = 0
n_pares_testados = 0
pior_lote_lote = []
for pen, i, j in pares:
    bid_a, bid_b = blocos[i]['id'], blocos[j]['id']
    lotes_a, lotes_b = por_bloco.get(bid_a, []), por_bloco.get(bid_b, [])
    if not lotes_a or not lotes_b:
        continue
    n_pares_testados += 1
    cantos_a = [(r['lot_id'], cantos_lote(r)) for r in lotes_a]
    cantos_b = [(r['lot_id'], cantos_lote(r)) for r in lotes_b]
    achou = False
    pior = 0.0
    for lida, ca in cantos_a:
        for lidb, cb in cantos_b:
            p = penetracao(ca, cb)
            if p > 0:
                achou = True
                if p > pior:
                    pior = p
                    pior_par = (lida, lidb)
    if achou:
        n_pares_com_lote_sobreposto += 1
        pior_lote_lote.append((pior, bid_a, bid_b, pior_par))

pior_lote_lote.sort(reverse=True)
print(f'pares de blocos com retangulo-malha sobreposto E lotes dos dois lados: {n_pares_testados}')
print(f'desses, pares onde os LOTES REAIS TAMBEM se invadem: {n_pares_com_lote_sobreposto} '
      f'({100*n_pares_com_lote_sobreposto/max(1,n_pares_testados):.1f}%)')
print('10 piores (m de invasao real lote-a-lote):')
for pen, ba, bb, (la, lb) in pior_lote_lote[:10]:
    print(f'  {pen:6.1f} m  {ba} ({la})  x  {bb} ({lb})')

# ═════════════════════════════════════════════════════════════════════════
# 9. raioBorda/raioSitio (8900/9000) x posicao real dos quarteiroes e lotes
# ═════════════════════════════════════════════════════════════════════════
print('\n' + '='*78)
print('9) raioBorda=8900 / raioSitio=9000 (cidade.json) x quarteiroes e lotes')
print('='*78)
raioBorda, raioSitio = cidade['raioBorda'], cidade['raioSitio']
alem_borda = []
for b in blocos:
    r = math.hypot(b['x'], b['z'])
    if r > raioBorda:
        alem_borda.append((r, b['id'], rumo_de(b['x'], b['z'])))
alem_borda.sort(reverse=True)
print(f'quarteiroes com CENTRO alem de raioBorda ({raioBorda}): {len(alem_borda)} de {len(blocos)}')
for r, bid, rm in alem_borda[:10]:
    print(f'  {bid:16s} r {r:.0f}  rumo {rm:.1f}')

alem_borda_lote = []
for r in linhas:
    x, z = float(r['x_m']), float(r['z_m'])
    rr = math.hypot(x, z)
    if rr > raioBorda:
        alem_borda_lote.append((rr, r['lot_id'], rumo_de(x, z)))
alem_borda_lote.sort(reverse=True)
print(f'\nlotes com CENTRO alem de raioBorda ({raioBorda}): {len(alem_borda_lote)} de {len(linhas)}')
rumos_alem = sorted(rumo_de(float(r['x_m']), float(r['z_m'])) for r in linhas if math.hypot(float(r['x_m']), float(r['z_m'])) > raioBorda)
if rumos_alem:
    print(f'  faixa de rumo desses lotes: {rumos_alem[0]:.1f} a {rumos_alem[-1]:.1f}')
    c = Counter(int(rm//30)*30 for rm in rumos_alem)
    print('  por setor de 30 graus:', dict(sorted(c.items())))
for r, lid, rm in alem_borda_lote[:10]:
    print(f'  {lid:20s} r {r:.0f}  rumo {rm:.1f}')

# ═════════════════════════════════════════════════════════════════════════
# 10. A CUNHA: giro por distrito (setor 1..6), e o salto no seu limite SO
# ═════════════════════════════════════════════════════════════════════════
print('\n' + '='*78)
print('10) GIRO POR DISTRITO (setor 1..6) e a cunha inclinada no rumo SO')
print('='*78)
DEF = malha['constantes']['distritosDef']
for k, d in enumerate(DEF):
    print(f"  distrito {k+1} (setor {k+1}): rumo {d['rumo']:.1f} a {d['rumo']+d['abertura']:.1f}  "
          f"giro do distrito {d['giro']:+.0f} graus")
print('\n  giro efetivo medio dos quarteiroes de cada setor, e desvio-padrao (mostra que TODOS')
print('  os quarteiroes do setor giram junto, em bloco, pelo giro do distrito):')
import statistics
for s in range(1, 7):
    gs_rel = []
    for b in blocos:
        if b['setor'] != s:
            continue
        rm = rumo_de(b['x'], b['z'])
        # giro esperado se o quarteirao so olhasse para o centro (puramente radial)
        esperado = (rm) % 180
        rel = ((b['giro'] - esperado + 90) % 180) - 90
        gs_rel.append(rel)
    if gs_rel:
        print(f'  setor {s}: media do giro relativo ao radial puro = {statistics.mean(gs_rel):+.1f} '
              f'graus (desvio {statistics.pstdev(gs_rel):.1f}), n={len(gs_rel)}')

# ═════════════════════════════════════════════════════════════════════════
# 11. Orla da Baia (S09) em tiras: frente x prof reais
# ═════════════════════════════════════════════════════════════════════════
print('\n' + '='*78)
print('11) ORLA DA BAIA (setor 9) — frente x profundidade real dos lotes')
print('='*78)
for s in ['1', '3', '5', '7', '8', '9']:
    fs = [float(r['frente_m']) for r in linhas if r['setor'] == s]
    ds = [float(r['prof_m']) for r in linhas if r['setor'] == s]
    if not fs:
        continue
    razao = [f/d for f, d in zip(fs, ds) if d > 0]
    print(f'  setor {s}: n={len(fs)}  frente mediana {statistics.median(fs):.1f} m  '
          f'prof mediana {statistics.median(ds):.1f} m  razao frente/prof mediana {statistics.median(razao):.3f}')

print('\nFIM 3/3')
