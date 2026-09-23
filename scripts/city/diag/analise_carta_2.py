#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Parte 2: aneis dodecagonos x quarteiroes, borda real x casca circular,
cunha de giro por setor/distrito, Orla da Baia em tiras. So leitura."""
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

def do_rumo(r, rumo_graus):
    a = rumo_graus * DEG
    return r * math.sin(a), -r * math.cos(a)

with open(P('data/dogcity_lotes.csv'), newline='') as f:
    linhas = list(csv.DictReader(f))
malha = json.load(open(P('public/city/cidade-malha.json')))
cidade = json.load(open(P('public/city/cidade.json')))
mapa = json.load(open(P('public/city/mapa-v1.json')))
vias = json.load(open(P('public/city/mapa/vias.json')))
R_CASCA = mapa['reservas']['limite']['r']

# ═════════════════════════════════════════════════════════════════════════
# 5. localizar exatamente (rumo/posicao na folha) os pares de quarteiroes
#    que se sobrepoem, achados na parte 1 (retangulos escuros)
# ═════════════════════════════════════════════════════════════════════════
print('='*78)
print('5) ONDE NA FOLHA ficam os quarteiroes que se sobrepoem entre si')
print('='*78)
by_id = {b['id']: b for b in malha['quarteiroes']}

def bbox_bloco(b):
    return cantos(b['x'], b['z'], b['lado'], b['prof'], math.radians(b['giro']))

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

CEL = 100.0
grade = defaultdict(list)
blocos = malha['quarteiroes']
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

vistos = set()
sobreposicoes = []
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
                sobreposicoes.append((pen, i, j))

pares_quarto = Counter()
por_setor = Counter()
rumos_conflito = []
for pen, i, j in sobreposicoes:
    bi, bj = blocos[i], blocos[j]
    pares_quarto[tuple(sorted((bi['quarto'], bj['quarto'])))] += 1
    por_setor[bi['setor']] += 1
    mx, mz = (bi['x']+bj['x'])/2, (bi['z']+bj['z'])/2
    rumos_conflito.append(rumo_de(mx, mz))

print(f'total de pares sobrepostos: {len(sobreposicoes)}')
print('por setor (onde a sobreposicao acontece):', dict(por_setor))
print('top pares de (quarto,quarto) em conflito:', pares_quarto.most_common(8))
rumos_conflito.sort()
print(f'faixa de rumo (graus, 0=N,90=E,180=S,270=O) dos conflitos: '
      f'{rumos_conflito[0]:.1f} a {rumos_conflito[-1]:.1f}; mediana {rumos_conflito[len(rumos_conflito)//2]:.1f}')
r_medio = sum(math.hypot(blocos[i]['x'], blocos[i]['z']) for pen,i,j in sobreposicoes)/len(sobreposicoes)
print(f'raio medio (do centro da cidade) onde a sobreposicao ocorre: {r_medio:.0f} m')
# tipo de banda dos dois lados
tipos = Counter((blocos[i]['tipo'], blocos[j]['tipo']) for pen,i,j in sobreposicoes)
print('tipos de banda em conflito (tipoA,tipoB):', tipos.most_common(6))

# ═════════════════════════════════════════════════════════════════════════
# 6. ANEIS DODECAGONOS x QUARTEIROES: quantos blocos sao cortados por um
#    segmento de anel estrutural (26/30/34 m) que vias.json de fato desenha?
# ═════════════════════════════════════════════════════════════════════════
print('\n' + '='*78)
print('6) ANEIS (dodecagonos, vias.json) atravessando o RETANGULO do quarteirao')
print('='*78)
aneis_estrut = [v for v in vias if v['tipo'] == 'anel' and v['larg'] >= 20]
print(f'segmentos de anel estrutural (larg>=20) em vias.json: {len(aneis_estrut)}')
lgrp = Counter(v['larg'] for v in aneis_estrut)
print('por largura:', dict(lgrp))

# indice de grade para os segmentos de anel
grade_anel = defaultdict(list)
for k, v in enumerate(aneis_estrut):
    (x0, z0), (x1, z1) = v['pontos']
    i0, i1 = sorted((int(x0//CEL), int(x1//CEL)))
    j0, j1 = sorted((int(z0//CEL), int(z1//CEL)))
    for ci in range(i0-1, i1+2):
        for cj in range(j0-1, j1+2):
            grade_anel[(ci, cj)].append(k)

def seg_intersecta_retangulo(p0, p1, cs):
    # segmento de reta p0-p1 cruza alguma aresta do retangulo cs (4 pontos)?
    def cruza_seg(a, b, c, d):
        def orient(p, q, r):
            v = (q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])
            return (v > 1e-9) - (v < -1e-9)
        o1, o2 = orient(a, b, c), orient(a, b, d)
        o3, o4 = orient(c, d, a), orient(c, d, b)
        return o1 != o2 and o3 != o4
    for k in range(4):
        if cruza_seg(p0, p1, cs[k], cs[(k+1) % 4]):
            return True
    return False

blocos_cortados = []
for i, b in enumerate(blocos):
    cs = info[i][4]
    x0b, x1b, z0b, z1b = info[i][0], info[i][1], info[i][2], info[i][3]
    i0, i1 = int(x0b//CEL), int(x1b//CEL)
    j0, j1 = int(z0b//CEL), int(z1b//CEL)
    candidatos = set()
    for ci in range(i0, i1+1):
        for cj in range(j0, j1+1):
            candidatos.update(grade_anel.get((ci, cj), []))
    for k in candidatos:
        v = aneis_estrut[k]
        p0, p1 = v['pontos']
        if seg_intersecta_retangulo(tuple(p0), tuple(p1), cs):
            blocos_cortados.append((b['id'], v['larg'], rumo_de(b['x'], b['z']), math.hypot(b['x'], b['z'])))
            break

print(f'quarteiroes cujo retangulo E CORTADO por um segmento de anel estrutural: '
      f'{len(blocos_cortados)} de {len(blocos)} ({100*len(blocos_cortados)/len(blocos):.1f}%)')
larg_c = Counter(l for _, l, _, _ in blocos_cortados)
print('por largura do anel que corta:', dict(larg_c))
for bid, larg, rm, r in sorted(blocos_cortados, key=lambda t: t[3])[:6]:
    print(f'  {bid:16s} anel {larg:2.0f} m, rumo {rm:5.1f}, r {r:.0f}')

# sanidade geometrica: sagita do dodecagono (vertice - face) nos raios dos
# aneis estruturais publicados em cidade.json, comparada ao lado do quarteirao
# na banda correspondente
print('\nsagita (vertice menos face) do dodecagono, por anel publicado em cidade.json:')
for a in cidade['aneis']:
    sag = a['r'] * (1 - math.cos(15*DEG))
    print(f"  {a['id']:4s} r(vertice) {a['r']:6.0f}  face {a['r']*math.cos(15*DEG):6.0f}  "
          f"sagita {sag:5.1f} m")

# ═════════════════════════════════════════════════════════════════════════
# 7. BORDA REAL (contorno, mapa-v1) x CASCA CIRCULAR (R_CASCA) que a agua/
#    relevo da camada 1 usa como recorte -> bloco saindo da borda
# ═════════════════════════════════════════════════════════════════════════
print('\n' + '='*78)
print('7) CONTORNO REAL DO SITIO (mapa-v1.contorno) x CASCA CIRCULAR (camada 1)')
print('='*78)
contorno = mapa['contorno']
pontos_fora = [(rumo_de(x, z), math.hypot(x, z)) for x, z in contorno if math.hypot(x, z) > R_CASCA]
print(f'R_CASCA (raio do disco de agua/relevo, camada 1) = {R_CASCA} m')
print(f'pontos do contorno real ALEM da casca circular: {len(pontos_fora)} de {len(contorno)}')
for rm, r in sorted(pontos_fora):
    print(f'  rumo {rm:6.1f}  r {r:.0f}  (+{r-R_CASCA:.0f} m alem da casca)')

# quarteiroes cujo canto mais distante ultrapassa a casca
piores_borda = []
for b in blocos:
    cs = bbox_bloco(b)
    rmax = max(math.hypot(x, z) for x, z in cs)
    if rmax > R_CASCA:
        piores_borda.append((rmax - R_CASCA, b['id'], rumo_de(b['x'], b['z']), rmax))
piores_borda.sort(reverse=True)
print(f'\nquarteiroes com algum canto ALEM da casca circular (R_CASCA={R_CASCA}): {len(piores_borda)}')
for exc, bid, rm, rmax in piores_borda[:12]:
    print(f'  {bid:16s} rumo {rm:6.1f}  r_max_canto {rmax:.0f}  excesso {exc:.0f} m')

# mesma pergunta para os LOTES reais do CSV (nao so a malha)
piores_lote = []
for r in linhas:
    x, z = float(r['x_m']), float(r['z_m'])
    w, d, g = float(r['frente_m']), float(r['prof_m']), math.radians(float(r['giro_graus']))
    cs = cantos(x, z, w, d, g)
    rmax = max(math.hypot(cx, cz) for cx, cz in cs)
    if rmax > R_CASCA:
        piores_lote.append((rmax - R_CASCA, r['lot_id'], rumo_de(x, z), rmax))
piores_lote.sort(reverse=True)
print(f'\nlotes reais (CSV) com algum canto ALEM da casca circular: {len(piores_lote)} de {len(linhas)}')
for exc, lid, rm, rmax in piores_lote[:12]:
    print(f'  {lid:20s} rumo {rm:6.1f}  r_max_canto {rmax:.0f}  excesso {exc:.0f} m')

print('\nFIM 2/3 (ver analise_carta_3.py para giro por distrito e Orla da Baia)')
