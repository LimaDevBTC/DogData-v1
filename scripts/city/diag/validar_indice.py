#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Valida o indice de grade de lote_vs_rua.py: para uma amostra de vias
# (incluindo TODAS as radiais e orlas, que deram quase zero cruzamento, mais
# uma amostra aleatoria dos outros tipos), testa por FORCA BRUTA contra os
# 70.709 lotes (sem indice) e compara com o resultado do indice de grade.
# Roda: python3 validar_indice.py
import csv, json, math, os, random, sys, time

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
CSV_PATH = os.path.join(RAIZ, 'data/dogcity_lotes.csv')
VIAS_PATH = os.path.join(RAIZ, 'public/city/mapa/vias.json')
TOL = 0.5
CELL = 100.0


def cantos(x, z, w, d, giro):
    ca, sa = math.cos(giro), math.sin(giro)
    return [(x + dx * ca - dz * sa, z + dx * sa + dz * ca)
            for dx, dz in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]


def penetracao(A, B):
    pior = 1e9
    for P, Q in ((A, B), (B, A)):
        n = len(P)
        for i in range(n):
            x1, z1 = P[i]; x2, z2 = P[(i + 1) % n]
            ex, ez = x2 - x1, z2 - z1
            norm = math.hypot(ex, ez)
            if norm < 1e-9:
                continue
            nx, nz = -ez / norm, ex / norm
            pa = [p[0] * nx + p[1] * nz for p in P]
            pb = [q[0] * nx + q[1] * nz for q in Q]
            sep = max(min(pb) - max(pa), min(pa) - max(pb))
            if sep > 0:
                return 0.0
            pior = min(pior, -sep)
    return pior


def bbox(pts):
    xs = [p[0] for p in pts]; zs = [p[1] for p in pts]
    return min(xs), max(xs), min(zs), max(zs)


def celulas(xmin, xmax, zmin, zmax):
    cx0, cx1 = int(math.floor(xmin / CELL)), int(math.floor(xmax / CELL))
    cz0, cz1 = int(math.floor(zmin / CELL)), int(math.floor(zmax / CELL))
    for cx in range(cx0, cx1 + 1):
        for cz in range(cz0, cz1 + 1):
            yield (cx, cz)


linhas = list(csv.DictReader(open(CSV_PATH, encoding='utf-8')))
N = len(linhas)
corners = [None] * N
for i, r in enumerate(linhas):
    x, z = float(r['x_m']), float(r['z_m'])
    w, d = float(r['frente_m']), float(r['prof_m'])
    giro = math.radians(float(r['giro_graus']))
    corners[i] = cantos(x, z, max(1e-6, w), max(1e-6, d), giro)

vias_raw = json.load(open(VIAS_PATH, encoding='utf-8'))


def via_rect(v):
    (x0, z0), (x1, z1) = v['pontos']
    ex, ez = x1 - x0, z1 - z0
    comp = math.hypot(ex, ez)
    half = v['larg'] / 2.0
    if comp < 1e-6:
        return [(x0 - half, z0 - half), (x0 + half, z0 - half), (x0 + half, z0 + half), (x0 - half, z0 + half)]
    nx, nz = -ez / comp, ex / comp
    return [(x0 + nx * half, z0 + nz * half), (x1 + nx * half, z1 + nz * half),
            (x1 - nx * half, z1 - nz * half), (x0 - nx * half, z0 - nz * half)]


# indice de grade dos lotes (igual ao script principal)
grade = {}
for i in range(N):
    xmin, xmax, zmin, zmax = bbox(corners[i])
    for cel in celulas(xmin, xmax, zmin, zmax):
        grade.setdefault(cel, []).append(i)

random.seed(42)
radiais = [v for v in vias_raw if v['tipo'] == 'radial']
orlas = [v for v in vias_raw if v['tipo'] == 'orla']
outras = [v for v in vias_raw if v['tipo'] not in ('radial', 'orla')]
# amostra pequena por via de forca bruta (70.709 lotes por via testada e caro em
# Python puro); o objetivo aqui e' so' flagrar erro sistematico do indice de
# grade (perder candidato), nao reproduzir o total.
amostra = random.sample(radiais, 15) + random.sample(orlas, 15) + random.sample(outras, 30)
print(f'amostra: 15 radiais + 15 orlas + 30 outras (de {len(outras)}) = {len(amostra)} vias, '
      f'cada uma testada por forca bruta contra os {N} lotes', file=sys.stderr)

t0 = time.time()
divergencias = 0
total_forca_bruta = 0
total_indice = 0
for v in amostra:
    rect = via_rect(v)
    # forca bruta: TODOS os lotes
    fb = set()
    for i in range(N):
        if penetracao(corners[i], rect) > TOL:
            fb.add(i)
    # via indice de grade
    xmin, xmax, zmin, zmax = bbox(rect)
    cand = set()
    for cel in celulas(xmin, xmax, zmin, zmax):
        if cel in grade:
            cand.update(grade[cel])
    idx = {i for i in cand if penetracao(corners[i], rect) > TOL}
    total_forca_bruta += len(fb)
    total_indice += len(idx)
    if fb != idx:
        divergencias += 1
        print(f'DIVERGENCIA em via {v["id"]} ({v["tipo"]}): forca_bruta={sorted(fb)} indice={sorted(idx)}')

t1 = time.time()
print(f'{len(amostra)} vias testadas por forca bruta em {t1-t0:.1f}s')
print(f'total de lotes cruzados (forca bruta) somado: {total_forca_bruta}')
print(f'total de lotes cruzados (indice de grade) somado: {total_indice}')
print(f'divergencias entre forca bruta e indice: {divergencias}')
