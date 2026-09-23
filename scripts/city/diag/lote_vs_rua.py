#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ============================================================================
# LOTE CONTRA RUA DESENHADA
#
# Pergunta: dos 70.709 lotes de data/dogcity_lotes.csv (rodada 4, root
# 2178966f...), quantos tem o retangulo do lote cruzado pela faixa de uma rua
# de public/city/mapa/vias.json (o desenho que a cena 3D usa de verdade)?
#
# Metodo (sem shapely, so' Python + indice de grade):
#   1. Retangulo do lote: cantos(x,z,w,d,giro) -- COPIADA de
#      scripts/city/conferir_lotes.py:135 (nao importada: o modulo roda coisa
#      no import). giro ali e' RADIANOS; a coluna do CSV e' giro_graus.
#   2. Retangulo da rua: cada registro de vias.json JA' e' um segmento de dois
#      pontos (nenhum tem mais de 2 -- conferido antes de escrever isto). A
#      faixa e' o segmento engrossado por larg/2 para cada lado, SEM tampa
#      redonda nas pontas (pediu para ignorar).
#   3. Cruzamento: eixo separador (SAT) entre dois quadrilateros convexos,
#      generalizando a funcao penetracao() do mesmo conferir_lotes.py (que so'
#      compara dois lotes, ou seja dois retangulos com os MESMOS 4 eixos) para
#      dois retangulos com eixos independentes -- e' o caso aqui, o lote gira
#      por conta propria e a rua gira com o segmento.
#   4. Indice espacial: grade de CELULA=100 m. Cada lote entra nas celulas da
#      sua bbox; cada rua so' testa contra os lotes das celulas da bbox dela.
#      Isso evita 70.709 x 17.198 (1,2 bilhao) pares.
#   5. Tolerancia: so' conta "cruzado" se a penetracao SAT for > 0,5 m.
#
# Rodar de novo:
#   python3 /tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/8c325219-1e13-44e6-9724-1b09f71f34c8/scratchpad/diag/lote_vs_rua.py
#
# Saida: relatorio no stdout + JSON completo em lote_vs_rua_resultado.json
# (no mesmo diretorio deste script).
# ============================================================================
import csv, json, math, os, sys, time, statistics as st
from collections import defaultdict, Counter

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
CSV_PATH = os.path.join(RAIZ, 'data/dogcity_lotes.csv')
VIAS_PATH = os.path.join(RAIZ, 'public/city/mapa/vias.json')
OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_JSON = os.path.join(OUT_DIR, 'lote_vs_rua_resultado.json')

TOL = 0.5      # metros -- so' conta cruzado acima disto (pedido do usuario)
CELL = 100.0   # metros -- lado da celula do indice de grade


# ----------------------------------------------------------------------------
# COPIADO de scripts/city/conferir_lotes.py:135 (nao importar o modulo).
# giro em RADIANOS. Retangulo do lote no plano XZ: eixo local dx ao longo da
# frente (w), dz ao longo da profundidade (d), girado por 'giro' e transladado
# para (x,z). Sentido do giro: o mesmo math.cos/sin padrao (anti-horario visto
# de cima, com z crescendo "para frente" -- e' a mesma convencao usada em todo
# o gerador, nao redefinida aqui).
# ----------------------------------------------------------------------------
def cantos(x, z, w, d, giro):
    ca, sa = math.cos(giro), math.sin(giro)
    return [(x + dx * ca - dz * sa, z + dx * sa + dz * ca)
            for dx, dz in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]


def penetracao(A, B):
    """SAT entre dois quadrilateros convexos A e B (4 pontos cada, em ordem
    ao redor do perimetro). Retorna a profundidade de penetracao em metros;
    0.0 quer dizer que nao se cruzam. Generaliza a penetracao() de
    conferir_lotes.py:139 (aquela so' compara dois lotes, que tem so' dois
    eixos ao todo por serem retangulos--contra-retangulos do MESMO tipo; aqui
    testamos os eixos de A e os eixos de B em separado, 4 cada, porque lote e
    rua giram por conta propria)."""
    pior = 1e9
    for P, Q in ((A, B), (B, A)):
        n = len(P)
        for i in range(n):
            x1, z1 = P[i]
            x2, z2 = P[(i + 1) % n]
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


def bbox(pontos):
    xs = [p[0] for p in pontos]
    zs = [p[1] for p in pontos]
    return min(xs), max(xs), min(zs), max(zs)


def celulas(xmin, xmax, zmin, zmax):
    cx0, cx1 = int(math.floor(xmin / CELL)), int(math.floor(xmax / CELL))
    cz0, cz1 = int(math.floor(zmin / CELL)), int(math.floor(zmax / CELL))
    for cx in range(cx0, cx1 + 1):
        for cz in range(cz0, cz1 + 1):
            yield (cx, cz)


def pctl(vals_sorted, p):
    """percentil simples por interpolacao linear, 0<=p<=100."""
    if not vals_sorted:
        return None
    if len(vals_sorted) == 1:
        return vals_sorted[0]
    k = (len(vals_sorted) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return vals_sorted[int(k)]
    return vals_sorted[int(f)] + (vals_sorted[int(c)] - vals_sorted[int(f)]) * (k - f)


def main():
    t0 = time.time()

    # ---- 1. carrega lotes -------------------------------------------------
    linhas = list(csv.DictReader(open(CSV_PATH, encoding='utf-8')))
    N = len(linhas)
    lot_id = [None] * N
    setor = [0] * N
    bloco = [None] * N   # chave (setor, quarto, quarteirao)
    corners = [None] * N
    bboxes = [None] * N
    for i, r in enumerate(linhas):
        x, z = float(r['x_m']), float(r['z_m'])
        w, d = float(r['frente_m']), float(r['prof_m'])
        giro = math.radians(float(r['giro_graus']))
        c = cantos(x, z, max(1e-6, w), max(1e-6, d), giro)
        corners[i] = c
        bboxes[i] = bbox(c)
        lot_id[i] = r['lot_id']
        setor[i] = int(r['setor'])
        bloco[i] = (r['setor'], r['quarto'], r['quarteirao'])

    blocos_todos = sorted(set(bloco))
    blocos_tecido = sorted({b for b, s in zip(bloco, setor) if s < 7})  # setores 1-6
    blocos_especiais = sorted({b for b, s in zip(bloco, setor) if s >= 7})  # S07/S08/S09

    # ---- 2. carrega vias ----------------------------------------------------
    vias_raw = json.load(open(VIAS_PATH, encoding='utf-8'))
    assert all(len(v['pontos']) == 2 for v in vias_raw), \
        'via com mais de 2 pontos -- premissa do script quebrou, revisar'

    via_id = [None] * len(vias_raw)
    via_tipo = [None] * len(vias_raw)
    via_larg = [0.0] * len(vias_raw)
    via_corners = [None] * len(vias_raw)
    via_bboxes = [None] * len(vias_raw)
    via_len = [0.0] * len(vias_raw)
    degeneradas = 0
    for i, v in enumerate(vias_raw):
        (x0, z0), (x1, z1) = v['pontos']
        ex, ez = x1 - x0, z1 - z0
        comp = math.hypot(ex, ez)
        via_id[i] = v['id']
        via_tipo[i] = v['tipo']
        via_larg[i] = float(v['larg'])
        via_len[i] = comp
        if comp < 1e-6:
            degeneradas += 1
            # segmento de comprimento zero: trata como um quadrado larg x larg
            # centrado no ponto, so' para nao quebrar o teste (nao deveria
            # existir; contamos para avisar).
            half = via_larg[i] / 2.0
            c = [(x0 - half, z0 - half), (x0 + half, z0 - half),
                 (x0 + half, z0 + half), (x0 - half, z0 + half)]
        else:
            nx, nz = -ez / comp, ex / comp
            half = via_larg[i] / 2.0
            c = [(x0 + nx * half, z0 + nz * half),
                 (x1 + nx * half, z1 + nz * half),
                 (x1 - nx * half, z1 - nz * half),
                 (x0 - nx * half, z0 - nz * half)]
        via_corners[i] = c
        via_bboxes[i] = bbox(c)

    tipos_presentes = sorted(set(via_tipo))

    # ---- 3. indice de grade dos lotes --------------------------------------
    grade = defaultdict(list)
    for i in range(N):
        xmin, xmax, zmin, zmax = bboxes[i]
        for cel in celulas(xmin, xmax, zmin, zmax):
            grade[cel].append(i)

    t1 = time.time()
    print(f'[preparo] {N} lotes, {len(vias_raw)} vias, {len(grade)} celulas de {CELL:.0f} m '
          f'em {t1 - t0:.1f}s ({degeneradas} vias degeneradas)', file=sys.stderr)

    # ---- 4. teste lote x rua, via indice de grade --------------------------
    # cruz[lote] = lista de (via_idx, tipo, penetracao_m)
    cruz = defaultdict(list)
    pares_testados = 0
    for j in range(len(vias_raw)):
        xmin, xmax, zmin, zmax = via_bboxes[j]
        candidatos = set()
        for cel in celulas(xmin, xmax, zmin, zmax):
            if cel in grade:
                candidatos.update(grade[cel])
        Bc = via_corners[j]
        for i in candidatos:
            pares_testados += 1
            pen = penetracao(corners[i], Bc)
            if pen > TOL:
                cruz[i].append((j, via_tipo[j], pen))

    t2 = time.time()
    print(f'[teste] {pares_testados} pares lote-rua testados (pos-filtro de grade) '
          f'em {t2 - t1:.1f}s', file=sys.stderr)

    lotes_cruzados = sorted(cruz.keys())
    n_cruzados = len(lotes_cruzados)

    # ---- (1) por tipo de rua + total sem dupla contagem --------------------
    por_tipo_lotes = {}
    for tipo in tipos_presentes:
        s = {i for i, lst in cruz.items() if any(t == tipo for _, t, _ in lst)}
        por_tipo_lotes[tipo] = s

    # ---- (2) quarteiroes com >=1 lote cruzado, por tipo --------------------
    por_tipo_blocos = {}
    for tipo in tipos_presentes:
        s = {bloco[i] for i in por_tipo_lotes[tipo]}
        por_tipo_blocos[tipo] = s
    blocos_cruzados_qualquer = {bloco[i] for i in lotes_cruzados}
    blocos_tecido_cruzados = blocos_cruzados_qualquer & set(blocos_tecido)
    blocos_especiais_cruzados = blocos_cruzados_qualquer & set(blocos_especiais)

    # ---- (3) por setor -------------------------------------------------------
    lotes_por_setor = Counter(setor)
    cruzados_por_setor = Counter(setor[i] for i in lotes_cruzados)

    # ---- (4) profundidade (penetracao maxima por lote cruzado) --------------
    prof_por_lote = {i: max(p for _, _, p in lst) for i, lst in cruz.items()}
    profs = sorted(prof_por_lote.values())
    prof_p50 = pctl(profs, 50)
    prof_p90 = pctl(profs, 90)
    prof_max = profs[-1] if profs else None

    # profundidade so' do tipo 'anel' (para a secao 5)
    anel_prof = sorted(max(p for j, t, p in cruz[i] if t == 'anel')
                        for i in lotes_cruzados if any(t == 'anel' for _, t, _ in cruz[i]))

    # ---- (5) caso ANEL em separado -------------------------------------------
    anel_lotes = por_tipo_lotes.get('anel', set())
    anel_blocos_tecido = por_tipo_blocos.get('anel', set()) & set(blocos_tecido)
    anel_blocos_especiais = por_tipo_blocos.get('anel', set()) & set(blocos_especiais)
    anel_blocos_todos = por_tipo_blocos.get('anel', set())

    # ---- (6) 10 piores exemplos (maior penetracao, um por lote) --------------
    piores = sorted(prof_por_lote.items(), key=lambda kv: -kv[1])[:10]
    piores_detalhe = []
    for i, pen in piores:
        # a via que causou essa penetracao maxima nesse lote
        j, tipo, _ = max(cruz[i], key=lambda t: t[2])
        piores_detalhe.append({
            'lot_id': lot_id[i],
            'setor': setor[i],
            'x_m': float(linhas[i]['x_m']), 'z_m': float(linhas[i]['z_m']),
            'frente_m': float(linhas[i]['frente_m']), 'prof_m': float(linhas[i]['prof_m']),
            'giro_graus': float(linhas[i]['giro_graus']),
            'via_id': via_id[j], 'via_tipo': via_tipo[j], 'via_larg': via_larg[j],
            'penetracao_m': round(pen, 2),
            'todas_as_ruas_que_cruzam': [{'via_id': via_id[jj], 'tipo': tt, 'penetracao_m': round(pp, 2)}
                                          for jj, tt, pp in sorted(cruz[i], key=lambda t: -t[2])],
        })

    t3 = time.time()

    # ================= RELATORIO =================
    print('=' * 78)
    print('LOTE CONTRA RUA DESENHADA -- data/dogcity_lotes.csv x public/city/mapa/vias.json')
    print('=' * 78)
    print(f'{N} lotes, {len(vias_raw)} segmentos de via, tolerancia de penetracao {TOL} m')
    print()

    print('--- (1) lotes cruzados por FAIXA DE RUA, por tipo -----------------------')
    for tipo in ['anel', 'avenida', 'orla', 'radial', 'travessa']:
        if tipo not in por_tipo_lotes:
            continue
        s = por_tipo_lotes[tipo]
        print(f'  {tipo:10s} {len(s):6d} lotes cruzados  ({100.0*len(s)/N:5.2f}% de {N})')
    print(f'  {"TOTAL":10s} {n_cruzados:6d} lotes cruzados por >=1 rua, sem dupla contagem  '
          f'({100.0*n_cruzados/N:5.2f}% de {N})')
    print()

    print('--- (2) quarteiroes com >=1 lote cruzado, por tipo -----------------------')
    print(f'  chave de quarteirao usada: (setor, quarto, quarteirao) do proprio CSV')
    print(f'  {len(blocos_todos)} quarteiroes distintos nessa chave no total '
          f'({len(blocos_tecido)} nos setores 1-6 "tecido", {len(blocos_especiais)} nos '
          f'setores 7-9 "especiais" S07/S08/S09, onde quase todo lote tem quarteirao proprio)')
    print(f'  >>> ATENCAO: public/city/cidade.json diz quarteiroes=2071 e o masterplan.md '
          f'§36 fala em "2.071 quarteiroes"; essa chave do CSV NAO reproduz esse numero '
          f'(da 1933 so nos setores 1-6, ou 4527 somando os especiais). Nao encontrei no '
          f'proprio CSV um campo que bata com 2071, e nao inventei um para bater -- '
          f'reporto contra os denominadores que consigo provar (1933 e 4527).')
    for tipo in ['anel', 'avenida', 'orla', 'radial', 'travessa']:
        if tipo not in por_tipo_blocos:
            continue
        s = por_tipo_blocos[tipo]
        s_tec = s & set(blocos_tecido)
        s_esp = s & set(blocos_especiais)
        print(f'  {tipo:10s} {len(s):6d} quarteiroes cruzados no total  '
              f'(tecido: {len(s_tec)}/{len(blocos_tecido)} = {100.0*len(s_tec)/max(1,len(blocos_tecido)):5.2f}%;  '
              f'especiais: {len(s_esp)}/{len(blocos_especiais)} = {100.0*len(s_esp)/max(1,len(blocos_especiais)):5.2f}%)')
    print(f'  {"TOTAL":10s} {len(blocos_cruzados_qualquer):6d} quarteiroes cruzados por >=1 rua  '
          f'(tecido: {len(blocos_tecido_cruzados)}/{len(blocos_tecido)} = '
          f'{100.0*len(blocos_tecido_cruzados)/max(1,len(blocos_tecido)):5.2f}%;  '
          f'especiais: {len(blocos_especiais_cruzados)}/{len(blocos_especiais)} = '
          f'{100.0*len(blocos_especiais_cruzados)/max(1,len(blocos_especiais)):5.2f}%)')
    print()

    print('--- (3) por setor (1 a 9) -------------------------------------------------')
    for s in range(1, 10):
        tot = lotes_por_setor.get(s, 0)
        cr = cruzados_por_setor.get(s, 0)
        pct = 100.0 * cr / tot if tot else 0.0
        print(f'  setor {s}: {cr:6d} / {tot:6d} lotes cruzados  ({pct:5.2f}%)')
    print()

    print('--- (4) profundidade da faixa dentro do lote (so lotes cruzados, m) ------')
    print(f'  p50 = {prof_p50:.2f} m   p90 = {prof_p90:.2f} m   maximo = {prof_max:.2f} m   '
          f'(n={len(profs)}; penetracao maxima por lote entre todas as ruas que o cruzam)')
    print()

    print('--- (5) caso ANEL em separado (hipotese central do masterplan §36) -----')
    print(f'  lotes com face de anel passando por dentro: {len(anel_lotes)} de {N} '
          f'({100.0*len(anel_lotes)/N:5.2f}%)')
    print(f'  quarteiroes tecido (setor 1-6) com >=1 lote assim: {len(anel_blocos_tecido)} de '
          f'{len(blocos_tecido)} ({100.0*len(anel_blocos_tecido)/max(1,len(blocos_tecido)):5.2f}%)')
    print(f'  quarteiroes especiais (S07-S09) com >=1 lote assim: {len(anel_blocos_especiais)} de '
          f'{len(blocos_especiais)} ({100.0*len(anel_blocos_especiais)/max(1,len(blocos_especiais)):5.2f}%)')
    print(f'  quarteiroes total (qualquer chave) com >=1 lote assim: {len(anel_blocos_todos)} de '
          f'{len(blocos_todos)} ({100.0*len(anel_blocos_todos)/max(1,len(blocos_todos)):5.2f}%)')
    if anel_prof:
        print(f'  profundidade so do anel: p50={pctl(anel_prof,50):.2f} m  '
              f'p90={pctl(anel_prof,90):.2f} m  max={anel_prof[-1]:.2f} m')
    print(f'  masterplan.md §36 (medido em 22/09, outra metrica: divisa do quarteirao '
          f'contra o anel da teia, nao lote contra faixa desenhada): 85,7% dos 2.071 '
          f'quarteiroes, p50 45,8 m / p90 105,7 m / max 381,8 m de distancia divisa-anel.')
    print(f'  esta medicao (lote x faixa DESENHADA de vias.json) e independente e mais '
          f'direta; comparar o numero de quarteiroes tecido acima ({len(anel_blocos_tecido)}/'
          f'{len(blocos_tecido)}={100.0*len(anel_blocos_tecido)/max(1,len(blocos_tecido)):.1f}%) '
          f'com os 85,7% do §36 -- proximo, nao identico, porque a chave de quarteirao e a '
          f'metrica de profundidade sao diferentes (ver "limites").')
    print()

    print('--- (6) os 10 piores exemplos (maior penetracao por lote) -----------------')
    for k, d in enumerate(piores_detalhe, 1):
        print(f'  {k:2d}. {d["lot_id"]}  setor {d["setor"]}  x={d["x_m"]:.1f} z={d["z_m"]:.1f}  '
              f'frente={d["frente_m"]:.1f}m prof={d["prof_m"]:.1f}m giro={d["giro_graus"]:.1f}°  '
              f'-> {d["via_tipo"]} {d["via_id"]} (larg {d["via_larg"]:.0f}m)  '
              f'penetracao {d["penetracao_m"]:.2f} m'
              + (f'  [+{len(d["todas_as_ruas_que_cruzam"])-1} outra(s) rua(s)]'
                 if len(d['todas_as_ruas_que_cruzam']) > 1 else ''))
    print()
    print(f'[tempo total] {t3 - t0:.1f}s', file=sys.stderr)

    # ---- salva JSON completo -------------------------------------------------
    resultado = {
        'parametros': {'tolerancia_m': TOL, 'celula_grade_m': CELL, 'n_lotes': N,
                       'n_vias': len(vias_raw)},
        'blocos': {'total_csv_key': len(blocos_todos), 'tecido_setor1a6': len(blocos_tecido),
                   'especiais_setor7a9': len(blocos_especiais),
                   'aviso_2071': 'cidade.json e masterplan.md §36 citam quarteiroes=2071; '
                                  'essa chave do CSV (setor,quarto,quarteirao) nao reproduz esse '
                                  'numero (1933 so setor 1-6, 4527 total). Nao reconciliado.'},
        'por_tipo_lotes': {t: {'n': len(s), 'pct': 100.0 * len(s) / N} for t, s in por_tipo_lotes.items()},
        'total_lotes_cruzados': {'n': n_cruzados, 'pct': 100.0 * n_cruzados / N},
        'por_tipo_blocos': {
            t: {'n_total': len(s), 'n_tecido': len(s & set(blocos_tecido)),
                'n_especiais': len(s & set(blocos_especiais))}
            for t, s in por_tipo_blocos.items()},
        'total_blocos_cruzados': {'total': len(blocos_cruzados_qualquer),
                                   'tecido': len(blocos_tecido_cruzados),
                                   'especiais': len(blocos_especiais_cruzados)},
        'por_setor': {s: {'total': lotes_por_setor.get(s, 0), 'cruzados': cruzados_por_setor.get(s, 0)}
                      for s in range(1, 10)},
        'profundidade_m': {'p50': prof_p50, 'p90': prof_p90, 'max': prof_max, 'n': len(profs)},
        'anel': {
            'lotes_n': len(anel_lotes), 'lotes_pct': 100.0 * len(anel_lotes) / N,
            'blocos_tecido_n': len(anel_blocos_tecido), 'blocos_tecido_total': len(blocos_tecido),
            'blocos_tecido_pct': 100.0 * len(anel_blocos_tecido) / max(1, len(blocos_tecido)),
            'blocos_especiais_n': len(anel_blocos_especiais),
            'blocos_todos_n': len(anel_blocos_todos), 'blocos_todos_total': len(blocos_todos),
            'profundidade_p50': pctl(anel_prof, 50) if anel_prof else None,
            'profundidade_p90': pctl(anel_prof, 90) if anel_prof else None,
            'profundidade_max': anel_prof[-1] if anel_prof else None,
            'masterplan_36_referencia': {'pct_quarteiroes': 85.7, 'p50_m': 45.8, 'p90_m': 105.7,
                                          'max_m': 381.8, 'metrica': 'divisa do quarteirao x anel '
                                          'da teia (nao lote x faixa desenhada)'},
        },
        'dez_piores': piores_detalhe,
        'degeneradas_vias': degeneradas,
    }
    json.dump(resultado, open(OUT_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'[json] salvo em {OUT_JSON}', file=sys.stderr)


if __name__ == '__main__':
    main()
