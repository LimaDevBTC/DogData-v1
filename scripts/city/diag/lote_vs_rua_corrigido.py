#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ============================================================================
# CORRECAO do lote_vs_rua.py: a funcao penetracao() dele (copiada literal de
# scripts/city/conferir_lotes.py:139, penetracao() para dois lotes) usa
#   sep = max(min(pb) - max(pa), min(pa) - max(pb))
# que DETECTA separacao corretamente (sep>0 <=> nao cruza -- por isso a
# CONTAGEM de cruzamento do relatorio original esta correta), mas a MAGNITUDE
# -sep NAO e a profundidade real de sobreposicao quando um intervalo contem o
# outro no eixo testado (caso muito comum aqui: uma faixa de rua estreita
# atravessando um lote lote bem mais largo naquele eixo). Nesse caso o
# overlap real e min(max(pa),max(pb)) - max(min(pa),min(pb)) (intersecao dos
# dois intervalos 1D), que pode ser BEM menor que -sep.
#
# Prova por caso concreto (S05-Q21-B027-L001 x anel A13597, o "1o pior" do
# relatorio): eixo perpendicular ao anel da via -> pa (projecao da via, span
# 12 m) fica INTEIRO dentro de pb (projecao do lote, span ~260 m). Overlap
# real = 12.0 m (a largura da propria via). A formula -sep do relatorio da
# 122,58 m nesse eixo -- e o eixo que acaba "vencendo" como minimo depois do
# viés e outro (o eixo da frente do lote, real 53,29 m, inflado para
# 121,55 m), entao o relatorio imprime 121,55 m onde o real e 12,0 m.
#
# Este script reroda a MESMA pipeline (mesmo indice de grade, mesmo TOL=0.5m,
# mesmos dados) trocando SO a formula de profundidade por uma matematicamente
# correta (intersecao de intervalos). A CONTAGEM de lotes/quarteiroes cruzados
# nao deveria mudar (o sinal de sep e o mesmo em ambas as formulas); so os
# numeros de profundidade (p50/p90/max e os "piores exemplos") devem mudar.
#
# Rodar:
#   python3 /tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/8c325219-1e13-44e6-9724-1b09f71f34c8/scratchpad/diag/lote_vs_rua_corrigido.py
# ============================================================================
import csv, json, math, os, sys, time
from collections import defaultdict, Counter

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
CSV_PATH = os.path.join(RAIZ, 'data/dogcity_lotes.csv')
VIAS_PATH = os.path.join(RAIZ, 'public/city/mapa/vias.json')
OUT_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lote_vs_rua_corrigido_resultado.json')

TOL = 0.5
CELL = 100.0


def cantos(x, z, w, d, giro):
    ca, sa = math.cos(giro), math.sin(giro)
    return [(x + dx * ca - dz * sa, z + dx * sa + dz * ca)
            for dx, dz in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]


def penetracao_original(A, B):
    """EXATAMENTE a funcao do relatorio (para comparar lado a lado)."""
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


def penetracao_correta(A, B):
    """SAT correto: overlap = intersecao dos dois intervalos projetados,
    nao a formula de 'separacao'. sep>0 ainda decide nao-cruzamento (mesmo
    sinal da versao original -- a contagem nao muda)."""
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
            minA, maxA = min(pa), max(pa)
            minB, maxB = min(pb), max(pb)
            overlap = min(maxA, maxB) - max(minA, minB)
            if overlap <= 0:
                return 0.0
            pior = min(pior, overlap)
    return pior


def bbox(pontos):
    xs = [p[0] for p in pontos]; zs = [p[1] for p in pontos]
    return min(xs), max(xs), min(zs), max(zs)


def celulas(xmin, xmax, zmin, zmax):
    cx0, cx1 = int(math.floor(xmin / CELL)), int(math.floor(xmax / CELL))
    cz0, cz1 = int(math.floor(zmin / CELL)), int(math.floor(zmax / CELL))
    for cx in range(cx0, cx1 + 1):
        for cz in range(cz0, cz1 + 1):
            yield (cx, cz)


def pctl(vals_sorted, p):
    if not vals_sorted:
        return None
    if len(vals_sorted) == 1:
        return vals_sorted[0]
    k = (len(vals_sorted) - 1) * (p / 100.0)
    f, c = math.floor(k), math.ceil(k)
    if f == c:
        return vals_sorted[int(k)]
    return vals_sorted[int(f)] + (vals_sorted[int(c)] - vals_sorted[int(f)]) * (k - f)


def main():
    linhas = list(csv.DictReader(open(CSV_PATH, encoding='utf-8')))
    N = len(linhas)
    lot_id = [None] * N; setor = [0] * N; bloco = [None] * N
    corners = [None] * N; bboxes = [None] * N
    for i, r in enumerate(linhas):
        x, z = float(r['x_m']), float(r['z_m'])
        w, d = float(r['frente_m']), float(r['prof_m'])
        giro = math.radians(float(r['giro_graus']))
        c = cantos(x, z, max(1e-6, w), max(1e-6, d), giro)
        corners[i] = c; bboxes[i] = bbox(c)
        lot_id[i] = r['lot_id']; setor[i] = int(r['setor'])
        bloco[i] = (r['setor'], r['quarto'], r['quarteirao'])

    blocos_tecido = sorted({b for b, s in zip(bloco, setor) if s < 7})
    blocos_especiais = sorted({b for b, s in zip(bloco, setor) if s >= 7})

    vias_raw = json.load(open(VIAS_PATH, encoding='utf-8'))
    via_id = [None] * len(vias_raw); via_tipo = [None] * len(vias_raw)
    via_larg = [0.0] * len(vias_raw); via_corners = [None] * len(vias_raw)
    via_bboxes = [None] * len(vias_raw)
    for i, v in enumerate(vias_raw):
        (x0, z0), (x1, z1) = v['pontos']
        ex, ez = x1 - x0, z1 - z0
        comp = math.hypot(ex, ez)
        via_id[i] = v['id']; via_tipo[i] = v['tipo']; via_larg[i] = float(v['larg'])
        half = via_larg[i] / 2.0
        if comp < 1e-6:
            c = [(x0 - half, z0 - half), (x0 + half, z0 - half),
                 (x0 + half, z0 + half), (x0 - half, z0 + half)]
        else:
            nx, nz = -ez / comp, ex / comp
            c = [(x0 + nx * half, z0 + nz * half), (x1 + nx * half, z1 + nz * half),
                 (x1 - nx * half, z1 - nz * half), (x0 - nx * half, z0 - nz * half)]
        via_corners[i] = c; via_bboxes[i] = bbox(c)

    tipos_presentes = sorted(set(via_tipo))

    grade = defaultdict(list)
    for i in range(N):
        xmin, xmax, zmin, zmax = bboxes[i]
        for cel in celulas(xmin, xmax, zmin, zmax):
            grade[cel].append(i)

    # duas passadas: original (para conferir que a CONTAGEM bate) e corrigida
    cruz_orig = defaultdict(list)
    cruz_corr = defaultdict(list)
    for j in range(len(vias_raw)):
        xmin, xmax, zmin, zmax = via_bboxes[j]
        candidatos = set()
        for cel in celulas(xmin, xmax, zmin, zmax):
            if cel in grade:
                candidatos.update(grade[cel])
        Bc = via_corners[j]
        for i in candidatos:
            pen_o = penetracao_original(corners[i], Bc)
            if pen_o > TOL:
                cruz_orig[i].append((j, via_tipo[j], pen_o))
            pen_c = penetracao_correta(corners[i], Bc)
            if pen_c > TOL:
                cruz_corr[i].append((j, via_tipo[j], pen_c))

    def resumo(cruz, nome):
        lotes_cruzados = sorted(cruz.keys())
        n = len(lotes_cruzados)
        por_tipo = {}
        for tipo in tipos_presentes:
            por_tipo[tipo] = {i for i, lst in cruz.items() if any(t == tipo for _, t, _ in lst)}
        prof_por_lote = {i: max(p for _, _, p in lst) for i, lst in cruz.items()}
        profs = sorted(prof_por_lote.values())
        print(f'--- {nome} ---')
        print(f'  total cruzados: {n} ({100.0*n/N:.2f}%)')
        for tipo in ['anel', 'avenida', 'orla', 'radial', 'travessa']:
            s = por_tipo.get(tipo, set())
            print(f'    {tipo:10s} {len(s):6d} ({100.0*len(s)/N:5.2f}%)')
        if profs:
            print(f'  profundidade: p50={pctl(profs,50):.2f}  p90={pctl(profs,90):.2f}  max={profs[-1]:.2f}  n={len(profs)}')
        return lotes_cruzados, por_tipo, prof_por_lote, profs

    print('=' * 78)
    lc_o, pt_o, ppl_o, profs_o = resumo(cruz_orig, 'FORMULA ORIGINAL DO RELATORIO (sep-based, com o bug)')
    print()
    lc_c, pt_c, ppl_c, profs_c = resumo(cruz_corr, 'FORMULA CORRIGIDA (intersecao real dos intervalos)')
    print()
    print(f'Mesma CONTAGEM de lotes cruzados (original vs corrigida)? {set(lc_o) == set(lc_c)}  '
          f'({len(lc_o)} vs {len(lc_c)})')
    for tipo in ['anel', 'avenida', 'orla', 'radial', 'travessa']:
        print(f'  {tipo}: contagem igual? {pt_o.get(tipo,set()) == pt_c.get(tipo,set())} '
              f'({len(pt_o.get(tipo,set()))} vs {len(pt_c.get(tipo,set()))})')
    print()

    # 10 piores pela versao CORRIGIDA
    piores_corr = sorted(ppl_c.items(), key=lambda kv: -kv[1])[:10]
    print('--- 10 piores pela penetracao CORRIGIDA ---')
    for i, pen in piores_corr:
        pen_orig_deste = ppl_o.get(i)
        j, tipo, _ = max(cruz_corr[i], key=lambda t: t[2])
        print(f'  {lot_id[i]}  setor {setor[i]}  corrigida={pen:.2f}m  original_relatada={pen_orig_deste}  via={via_id[j]}({tipo},{via_larg[j]:.0f}m)')

    # quanto da MASSA de "piores" do relatorio original sobrevive
    print()
    print('--- os 10 piores do RELATORIO ORIGINAL, com a penetracao corrigida ao lado ---')
    piores_orig = sorted(ppl_o.items(), key=lambda kv: -kv[1])[:10]
    for i, pen in piores_orig:
        pen_corr_deste = ppl_c.get(i, 0.0)
        print(f'  {lot_id[i]}  setor {setor[i]}  original_relatada={pen:.2f}m  corrigida={pen_corr_deste:.2f}m  '
              f'razao={pen_corr_deste/pen*100:.1f}%')

    resultado = {
        'original_bug': {
            'total_cruzados': len(lc_o),
            'por_tipo': {t: len(s) for t, s in pt_o.items()},
            'profundidade': {'p50': pctl(profs_o, 50), 'p90': pctl(profs_o, 90), 'max': profs_o[-1] if profs_o else None},
        },
        'corrigido': {
            'total_cruzados': len(lc_c),
            'por_tipo': {t: len(s) for t, s in pt_c.items()},
            'profundidade': {'p50': pctl(profs_c, 50), 'p90': pctl(profs_c, 90), 'max': profs_c[-1] if profs_c else None},
        },
        'contagem_identica': set(lc_o) == set(lc_c),
    }
    json.dump(resultado, open(OUT_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'\n[json] {OUT_JSON}')


if __name__ == '__main__':
    main()
