#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ============================================================================
# CETICISMO INDEPENDENTE sobre o relatorio de scripts/city/conferir_lotes.py:135
# (cantos) aplicado em lote_vs_rua.py.
#
# Este script NAO importa nem reusa lote_vs_rua.py. Reimplementa do zero, com
# estrutura de codigo diferente (sem numpy -- nao esta instalado no sistema e
# nao vou instalar; Python puro com listas de tuplas), para servir de segunda
# opiniao sobre a mesma geometria.
#
# Rodar:
#   python3 /tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/8c325219-1e13-44e6-9724-1b09f71f34c8/scratchpad/diag/ceticismo_independente.py
# ============================================================================
import math

def cantos_lote_np(x, z, w, d, giro_graus):
    """Reimplementacao independente: mesma formula matematica (rotacao 2D +
    translacao) mas escrita do zero, em Python puro, canto a canto."""
    th = math.radians(giro_graus)
    ct, st = math.cos(th), math.sin(th)
    locais = [(-w/2, -d/2), (w/2, -d/2), (w/2, d/2), (-w/2, d/2)]
    return [(x + dx*ct - dz*st, z + dx*st + dz*ct) for dx, dz in locais]

def faixa_via_np(p0, p1, larg):
    (x0, z0), (x1, z1) = p0, p1
    ex, ez = x1 - x0, z1 - z0
    L = math.hypot(ex, ez)
    nx, nz = -ez / L, ex / L
    half = larg / 2.0
    return [(x0 + nx*half, z0 + nz*half), (x1 + nx*half, z1 + nz*half),
            (x1 - nx*half, z1 - nz*half), (x0 - nx*half, z0 - nz*half)]

def sat_penetracao(P, Q):
    """SAT padrao independente: testa os 4 eixos normais de P e os 4 de Q."""
    pior = math.inf
    for poly in (P, Q):
        n = len(poly)
        for i in range(n):
            ax, az = poly[i]
            bx, bz = poly[(i+1) % n]
            ex, ez = bx - ax, bz - az
            norm = math.hypot(ex, ez)
            axis_x, axis_z = -ez / norm, ex / norm
            pa = [px*axis_x + pz*axis_z for px, pz in P]
            pb = [qx*axis_x + qz*axis_z for qx, qz in Q]
            overlap = min(max(pa), max(pb)) - max(min(pa), min(pb))
            if overlap <= 0:
                return 0.0
            pior = min(pior, overlap)
    return pior

def area_shoelace(poly):
    n = len(poly)
    s = 0.0
    for i in range(n):
        x1, z1 = poly[i]
        x2, z2 = poly[(i+1) % n]
        s += x1*z2 - x2*z1
    return abs(s) / 2.0

print("=== TESTE 0: sanidade geometrica de cantos_lote_np ===")
# giro=0: retangulo alinhado aos eixos, largura w em x, profundidade d em z
c = cantos_lote_np(0, 0, 10, 4, 0)
xs = [p[0] for p in c]; zs = [p[1] for p in c]
print("giro=0, w=10, d=4 -> x range:", min(xs), max(xs), " z range:", min(zs), max(zs))
assert abs((max(xs)-min(xs)) - 10) < 1e-9
assert abs((max(zs)-min(zs)) - 4) < 1e-9
print("OK: com giro=0 a largura em x = frente(w) e a extensao em z = prof(d).")
print()
print("giro=90: deveria girar 90 graus (trocar praticamente x<->z em magnitude)")
c90 = cantos_lote_np(0, 0, 10, 4, 90)
xs90 = [p[0] for p in c90]; zs90 = [p[1] for p in c90]
print(" x range:", min(xs90), max(xs90), " z range:", min(zs90), max(zs90))
print()

print("=== TESTE 1: area de cada lote-exemplo bate com frente_m * prof_m? ===")
exemplos = [
    ("S05-Q21-B027-L001", -5327.41, 299.18, 53.29, 255.0, 266.79),
    ("S05-Q21-B021-L001", -5263.47, 692.95, 51.61, 255.0, 262.50),
    ("S06-Q23-B002-L001", -2924.79, -4853.95, 40.11, 255.0, 328.93),
    ("S04-Q13-B001-L003", -2643.06, 2281.02, 227.80, 25.0, 229.29),
    ("S08-Q01-B001-L001", 482.69, -866.65, 890.85, 126.0, 29.12),
]
for nome, x, z, w, d, giro in exemplos:
    poly = cantos_lote_np(x, z, w, d, giro)
    area = area_shoelace(poly)
    esperado = w * d
    print(f"  {nome}: area_shoelace={area:.1f}  w*d={esperado:.1f}  diff={abs(area-esperado):.4f}")
    assert abs(area - esperado) < 1e-3
print("OK: em todos, a area do quadrilatero = frente_m * prof_m (retangulo correto).")
print()

print("=== TESTE 2: reproduzir 5 penetracoes do relatorio, com SAT reimplementado ===")
casos = [
    ("S05-Q21-B027-L001", -5327.41, 299.18, 53.29, 255.0, 266.79,
     "A13597", [[-5316.6, 392.4], [-5366.7, 205.3]], 12, 121.55),
    ("S05-Q21-B021-L001", -5263.47, 692.95, 51.61, 255.0, 262.50,
     "A13595", None, 12, 109.30),  # via_id do relatorio; pontos buscados abaixo
    ("S06-Q23-B002-L001", -2924.79, -4853.95, 40.11, 255.0, 328.93,
     "A13738", None, 12, 99.96),
    ("S04-Q13-B001-L003", -2643.06, 2281.02, 227.80, 25.0, 229.29,
     "T15402", None, 9, 89.18),
]
import json
vias = json.load(open('/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/public/city/mapa/vias.json'))
vias_by_id = {v['id']: v for v in vias}

for nome, x, z, w, d, giro, via_id, pontos, larg_esp, pen_relatada in casos:
    v = vias_by_id[via_id]
    assert v['larg'] == larg_esp, f"largura de {via_id} diferente do relatado"
    p0, p1 = v['pontos']
    lote_poly = cantos_lote_np(x, z, w, d, giro)
    via_poly = faixa_via_np(p0, p1, v['larg'])
    pen = sat_penetracao(lote_poly, via_poly)
    print(f"  {nome} x {via_id} (larg {v['larg']}m): penetracao independente = {pen:.2f} m"
          f"   (relatado: {pen_relatada:.2f} m)   diff={abs(pen-pen_relatada):.3f}")

print()
print("=== TESTE 3: caso ORLA (megalote S08) -- confirmar que so ele e atingido ===")
nome, x, z, w, d, giro = ("S08-Q01-B001-L001", 482.69, -866.65, 890.85, 126.0, 29.12)
lote_poly = cantos_lote_np(x, z, w, d, giro)
orlas = [v for v in vias if v['tipo'] == 'orla']
atingidas = []
for v in orlas:
    p0, p1 = v['pontos']
    via_poly = faixa_via_np(p0, p1, v['larg'])
    pen = sat_penetracao(lote_poly, via_poly)
    if pen > 0.5:
        atingidas.append((v['id'], round(pen, 2)))
print(f"  orlas testadas: {len(orlas)}; orlas que cruzam o megalote (pen>0.5m): {len(atingidas)}")
print(f"  exemplos: {atingidas[:5]} ... total {len(atingidas)}")
