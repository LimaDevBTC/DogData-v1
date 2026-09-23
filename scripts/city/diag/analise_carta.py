#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diagnostico da CARTA da DogCity, camada por camada, contra dados reais.
Roda: python3 analise_carta.py
So leitura. Nao depende de shapely (numpy puro + indice de grade 100 m).

Fontes lidas (todas dentro do repo DogData-v1, caminhos relativos a RAIZ):
  data/dogcity_lotes.csv            registro selado de lotes (70.709 linhas)
  public/city/cidade-malha.json     malha de quarteiroes (2.071), o "PLANO" que
                                     a carta usa na camada 2
  public/city/cidade.json           programa, aneis, raioBorda/raioSitio
  public/city/mapa-v1.json          plano antigo: contorno real do sitio,
                                     reservas.limite (raio da casca = 9050)
  public/city/mapa/vias.json        rede viaria desenhada de fato (17.198 trechos)

A funcao cantos() abaixo e uma COPIA literal de scripts/city/conferir_lotes.py
linha 135 (nao importa o modulo, que roda codigo no import).
"""
import csv, json, math, os
from collections import defaultdict, Counter

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
DEG = math.pi / 180

def P(*a):
    return os.path.join(RAIZ, *a)

# ── copia literal de conferir_lotes.py:135 ──────────────────────────────────
def cantos(x, z, w, d, giro):
    ca, sa = math.cos(giro), math.sin(giro)
    return [(x + dx*ca - dz*sa, z + dx*sa + dz*ca)
            for dx, dz in ((-w/2, -d/2), (w/2, -d/2), (w/2, d/2), (-w/2, d/2))]

def rumo_de(x, z):
    return (math.degrees(math.atan2(x, -z)) + 360) % 360

# ═════════════════════════════════════════════════════════════════════════
# CARGA
# ═════════════════════════════════════════════════════════════════════════
print('carregando CSV selado...')
with open(P('data/dogcity_lotes.csv'), newline='') as f:
    linhas = list(csv.DictReader(f))
print(f'  {len(linhas)} lotes')

malha = json.load(open(P('public/city/cidade-malha.json')))
cidade = json.load(open(P('public/city/cidade.json')))
mapa = json.load(open(P('public/city/mapa-v1.json')))
vias = json.load(open(P('public/city/mapa/vias.json')))

R_CASCA = mapa['reservas']['limite']['r']
print(f'R_CASCA (raio da casca, mapa-v1.reservas.limite.r) = {R_CASCA}')
print(f'cidade.json raioBorda={cidade["raioBorda"]} raioSitio={cidade["raioSitio"]}')

# ═════════════════════════════════════════════════════════════════════════
# 1. CAMADA 2 — o quarteirao e retangulo da malha, nao uniao de lotes: por
#    quanto ele erra contra os lotes reais do CSV?
# ═════════════════════════════════════════════════════════════════════════
print('\n' + '='*78)
print('1) QUARTEIRAO: retangulo de cidade-malha.json vs lotes reais do CSV')
print('='*78)

malha_por_id = {b['id']: b for b in malha['quarteiroes']}

por_bloco = defaultdict(list)
for r in linhas:
    bloco_id = '-'.join(r['lot_id'].split('-')[:3])
    por_bloco[bloco_id].append(r)

sem_malha = [k for k in por_bloco if k not in malha_por_id]
print(f'blocos no CSV: {len(por_bloco)}; blocos na malha: {len(malha_por_id)}; '
      f'blocos do CSV SEM entrada na malha: {len(sem_malha)} (ex.: {sem_malha[:5]})')

TOL = 0.5  # m de folga no teste de contencao
lotes_fora = 0
lotes_testados = 0
blocos_com_lote_fora = 0
piores = []  # (invasao_m, bloco_id, lot_id)
for bid, lts in por_bloco.items():
    b = malha_por_id.get(bid)
    if not b:
        continue
    g = math.radians(b['giro'])
    ca, sa = math.cos(-g), math.sin(-g)
    meiaLado, meiaProf = b['lado']/2 + TOL, b['prof']/2 + TOL
    algum_fora = False
    for r in lts:
        x, z = float(r['x_m']), float(r['z_m'])
        w, d, giro = float(r['frente_m']), float(r['prof_m']), math.radians(float(r['giro_graus']))
        cs = cantos(x, z, w, d, giro)
        pior_invasao = 0.0
        for (cx, cz) in cs:
            dx, dz = cx - b['x'], cz - b['z']
            lx = dx*ca - dz*sa
            lz = dx*sa + dz*ca
            invasao = max(abs(lx) - meiaLado, abs(lz) - meiaProf)
            pior_invasao = max(pior_invasao, invasao)
        lotes_testados += 1
        if pior_invasao > 0:
            lotes_fora += 1
            algum_fora = True
            piores.append((pior_invasao, bid, r['lot_id']))
    if algum_fora:
        blocos_com_lote_fora += 1

piores.sort(reverse=True)
print(f'lotes testados contra o retangulo do proprio quarteirao: {lotes_testados}')
print(f'lotes com algum canto FORA do retangulo (tol {TOL} m): {lotes_fora} '
      f'({100*lotes_fora/lotes_testados:.2f}%)')
print(f'quarteiroes com pelo menos 1 lote fora: {blocos_com_lote_fora} de {len(por_bloco)} '
      f'({100*blocos_com_lote_fora/len(por_bloco):.2f}%)')
print('10 piores (metros de invasao para fora do retangulo, bloco, lot_id):')
for inv, bid, lid in piores[:10]:
    print(f'  {inv:7.1f} m  {bid:16s} {lid}')

# ═════════════════════════════════════════════════════════════════════════
# 2. fileiras dentro do MESMO quarteirao: quantos quarteiroes tem mais de
#    uma fileira com lote (ou seja, tem travessa interna que a carta nunca
#    desenha porque pinta o quarteirao inteiro como 1 retangulo solido)?
# ═════════════════════════════════════════════════════════════════════════
print('\n' + '='*78)
print('2) FILEIRAS internas por quarteirao (a "rua em negativo" so existe ENTRE')
print('   quarteiroes; dentro de um quarteirao o retangulo e solido)')
print('='*78)
multi_fileira = [b for b in malha['quarteiroes'] if b.get('fileirasComLote', 0) > 1]
print(f'quarteiroes com >=2 fileiras ocupadas (tem travessa 9 m entre elas, nunca desenhada): '
      f'{len(multi_fileira)} de {len(malha["quarteiroes"])} '
      f'({100*len(multi_fileira)/len(malha["quarteiroes"]):.1f}%)')
dist_fileiras = Counter(b.get('fileirasComLote', 0) for b in malha['quarteiroes'])
print('distribuicao de fileirasComLote:', dict(sorted(dist_fileiras.items())))
ex = sorted(multi_fileira, key=lambda b: -b.get('lotes', 0))[:5]
for b in ex:
    print(f'  {b["id"]}: {b["lotes"]} lotes em {b["fileirasComLote"]} fileiras '
          f'({b["lotesPorFileira"]}), lado {b["lado"]} x prof {b["prof"]} m')

# ═════════════════════════════════════════════════════════════════════════
# 3. superquadra invadindo o quarteirao seguinte (pode aparecer como
#    retangulo/tom estranho sobre fileira do vizinho)
# ═════════════════════════════════════════════════════════════════════════
print('\n' + '='*78)
print('3) SUPERQUADRAS (retangulos maiores plantados por cima da malha comum)')
print('='*78)
superq = [b for b in malha['quarteiroes'] if b.get('superquadra')]
print(f'quarteiroes marcados superquadra=true: {len(superq)}')
for b in superq[:10]:
    print(f'  {b["id"]}: lado {b["lado"]} superquadraProf {b.get("superquadraProf")} '
          f'(prof normal do quarteirao seria {b["prof"]})')

# ═════════════════════════════════════════════════════════════════════════
# 4. retangulos da malha se sobrepondo entre si (indice de grade 100 m)
# ═════════════════════════════════════════════════════════════════════════
print('\n' + '='*78)
print('4) RETANGULOS DE QUARTEIRAO SE SOBREPONDO (indice de grade 100 m,')
print('   eixo separador entre pares vizinhos)')
print('='*78)
CEL = 100.0
grade = defaultdict(list)
blocos = malha['quarteiroes']
def bbox_bloco(b):
    cs = cantos(b['x'], b['z'], b['lado'], b['prof'], math.radians(b['giro']))
    xs = [c[0] for c in cs]; zs = [c[1] for c in cs]
    return min(xs), max(xs), min(zs), max(zs), cs

info = [bbox_bloco(b) for b in blocos]
for i, (x0, x1, z0, z1, cs) in enumerate(info):
    i0, i1 = int(x0//CEL), int(x1//CEL)
    j0, j1 = int(z0//CEL), int(z1//CEL)
    for ci in range(i0, i1+1):
        for cj in range(j0, j1+1):
            grade[(ci, cj)].append(i)

def eixos_separadores(P_, Q_):
    for A, B in ((P_, Q_), (Q_, P_)):
        for i in range(4):
            ex, ez = A[(i+1) % 4][0]-A[i][0], A[(i+1) % 4][1]-A[i][1]
            n = math.hypot(ex, ez)
            if n < 1e-9:
                continue
            nx, nz = -ez/n, ex/n
            pa = [p[0]*nx+p[1]*nz for p in A]; pb = [p[0]*nx+p[1]*nz for p in B]
            if min(pb) > max(pa) or max(pb) < min(pa):
                return 0.0
    # nao separou: mede a menor penetracao
    pior = 1e18
    for A, B in ((P_, Q_), (Q_, P_)):
        for i in range(4):
            ex, ez = A[(i+1) % 4][0]-A[i][0], A[(i+1) % 4][1]-A[i][1]
            n = math.hypot(ex, ez)
            if n < 1e-9:
                continue
            nx, nz = -ez/n, ex/n
            pa = [p[0]*nx+p[1]*nz for p in A]; pb = [p[0]*nx+p[1]*nz for p in B]
            sep = max(min(pb)-max(pa), min(pa)-max(pb))
            pior = min(pior, -sep)
    return pior

vistos = set()
sobreposicoes = []
for cel, idxs in grade.items():
    idxs = sorted(set(idxs))
    for a in range(len(idxs)):
        for b in range(a+1, len(idxs)):
            i, j = idxs[a], idxs[b]
            if blocos[i]['id'] == blocos[j]['id']:
                continue
            key = (i, j) if i < j else (j, i)
            if key in vistos:
                continue
            vistos.add(key)
            pen = eixos_separadores(info[i][4], info[j][4])
            if pen > 0.5:
                sobreposicoes.append((pen, blocos[i]['id'], blocos[j]['id']))

sobreposicoes.sort(reverse=True)
print(f'pares de quarteiroes cujos retangulos se sobrepoem (>0.5 m de penetracao): {len(sobreposicoes)}')
for pen, a, b in sobreposicoes[:15]:
    print(f'  {pen:6.1f} m  {a:16s} x {b}')

print('\nFIM 1/2 (ver analise_carta_2.py para aneis/borda/giro/orla)')
