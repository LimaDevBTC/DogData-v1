#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lote contra PROGRAMA: cidade.json (a cidade selada, rodada 4) x mapa-v1.json
(o plano antigo). So leitura do repo DogData-v1. Python puro + indice de
grade de ~100 m (sem shapely).

Uso:
    python3 lote_x_programa.py [--repo=/caminho] [--tol=0.5] [--grid=100]

Saida: texto no stdout + um JSON completo em
    <este_diretorio>/resultado_lote_x_programa.json
"""
import csv, json, math, os, sys, collections

REPO = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--repo=')),
            '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1')
TOL = float(next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--tol=')), '0.5'))
GRID = float(next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--grid=')), '100'))
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

def p(*parts):
    return os.path.join(REPO, *parts)

# ═════════════════════════════════════════════════════════════════════════
# COPIADO de scripts/city/conferir_lotes.py linha 135 (nao importa o modulo,
# ele roda coisas no import). Convencao: mundo = centro + R(giro) * local,
# com (dx,dz) em ((-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)) e giro em
# RADIANOS. Confirmado contra scripts/gerar_cidade.py:2405 em_programa(),
# que testa retangulo/elipse em coordenada local com a rotacao INVERSA
# (R(-rot)) da mesma convencao: lx = dx*cos(rot)+dz*sin(rot),
# lz = -dx*sin(rot)+dz*cos(rot) -- exatamente o inverso de cantos().
# ═════════════════════════════════════════════════════════════════════════
def cantos(x, z, w, d, giro):
    ca, sa = math.cos(giro), math.sin(giro)
    return [(x + dx * ca - dz * sa, z + dx * sa + dz * ca)
            for dx, dz in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]

def elipse_poly(cx, cz, a, b, rot_graus, n=72):
    """Aproxima a elipse (semieixos a,b, giro em graus, mesma convencao de
    cantos()) por um poligono de n lados, para poder usar o mesmo teste de
    cruzamento generico dos retangulos e celulas."""
    rr = math.radians(rot_graus)
    ca, sa = math.cos(rr), math.sin(rr)
    pts = []
    for i in range(n):
        th = 2 * math.pi * i / n
        lx, lz = a * math.cos(th), b * math.sin(th)
        pts.append((cx + lx * ca - lz * sa, cz + lx * sa + lz * ca))
    return pts

# ── geometria generica de poligono (implementacao propria, nao usa shapely) ─
def bbox(poly):
    xs = [q[0] for q in poly]; zs = [q[1] for q in poly]
    return min(xs), min(zs), max(xs), max(zs)

def ponto_no_poligono(x, z, poly):
    n = len(poly); dentro = False; j = n - 1
    for i in range(n):
        xi, zi = poly[i]; xj, zj = poly[j]
        if (zi > z) != (zj > z):
            xc = xi + (z - zi) * (xj - xi) / (zj - zi)
            if x < xc: dentro = not dentro
        j = i
    return dentro

def dist_ponto_segmento(x, z, x1, z1, x2, z2):
    ex, ez = x2 - x1, z2 - z1
    l2 = ex * ex + ez * ez
    if l2 == 0: return math.hypot(x - x1, z - z1)
    t = max(0.0, min(1.0, ((x - x1) * ex + (z - z1) * ez) / l2))
    return math.hypot(x - (x1 + t * ex), z - (z1 + t * ez))

def dist_ponto_borda_poligono(x, z, poly):
    n = len(poly)
    return min(dist_ponto_segmento(x, z, poly[i][0], poly[i][1],
                                    poly[(i + 1) % n][0], poly[(i + 1) % n][1])
               for i in range(n))

def segmentos_cruzam(p1, p2, p3, p4):
    def cruz(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    d1, d2 = cruz(p3, p4, p1), cruz(p3, p4, p2)
    d3, d4 = cruz(p1, p2, p3), cruz(p1, p2, p4)
    return ((d1 > 0) != (d2 > 0)) and (d1 != 0 and d2 != 0) and \
           ((d3 > 0) != (d4 > 0)) and (d3 != 0 and d4 != 0)

def penetracao_poligonos(A, B):
    """Profundidade aproximada de cruzamento entre dois poligonos simples
    (convexos ou nao), em metros. 0 = nao cruzam. Definicao: a maior
    distancia de um vertice de A que caiu dentro de B (ou vice-versa) ate a
    borda do outro poligono. Isto NAO e o eixo separador (SAT) do
    conferir_lotes.py -- aquele exige convexidade nos dois lados, e a celula
    da teia e um trapezio levemente curvo (arco de anel) que pode nao ser
    estritamente convexo. Para o caso raro de dois poligonos que se cruzam
    SEM nenhum vertice de um dentro do outro (lamina fina atravessando),
    cai no teste de segmento-cruza-segmento e reporta uma profundidade
    minima simbolica de 0.01 m (fatia fina, sinalizada mas nao dimensionada)."""
    ax0, az0, ax1, az1 = bbox(A); bx0, bz0, bx1, bz1 = bbox(B)
    if ax1 < bx0 or bx1 < ax0 or az1 < bz0 or bz1 < az0:
        return 0.0
    prof = 0.0
    for (x, z) in A:
        if ponto_no_poligono(x, z, B):
            prof = max(prof, dist_ponto_borda_poligono(x, z, B))
    for (x, z) in B:
        if ponto_no_poligono(x, z, A):
            prof = max(prof, dist_ponto_borda_poligono(x, z, A))
    if prof > 0: return prof
    na, nb = len(A), len(B)
    for i in range(na):
        for j in range(nb):
            if segmentos_cruzam(A[i], A[(i + 1) % na], B[j], B[(j + 1) % nb]):
                return 0.01
    return 0.0

def dist_origem_min(poly):
    n = len(poly)
    m = min(math.hypot(x, z) for x, z in poly)
    for i in range(n):
        x1, z1 = poly[i]; x2, z2 = poly[(i + 1) % n]
        m = min(m, dist_ponto_segmento(0, 0, x1, z1, x2, z2))
    return m

def dist_origem_max(poly):
    return max(math.hypot(x, z) for x, z in poly)

# ═════════════════════════════════════════════════════════════════════════
# 1. LOTES: 70.709 linhas do CSV selado, poligono pelo cantos() acima.
# ═════════════════════════════════════════════════════════════════════════
print(f'lendo lotes de {p("data/dogcity_lotes.csv")}', file=sys.stderr)
lotes = []  # {'lot_id', 'poly', 'bbox'}
with open(p('data/dogcity_lotes.csv'), newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        x, z = float(r['x_m']), float(r['z_m'])
        w, d = float(r['frente_m']), float(r['prof_m'])
        giro = math.radians(float(r['giro_graus']))
        poly = cantos(x, z, max(0.1, w), max(0.1, d), giro)
        lotes.append({'lot_id': r['lot_id'], 'poly': poly, 'bbox': bbox(poly)})
N_LOTES = len(lotes)
print(f'{N_LOTES:,} lotes carregados', file=sys.stderr)

# indice de grade (~GRID m por celula), chave (cx,cz) -> lista de indices de lote
grade = collections.defaultdict(list)
for i, lt in enumerate(lotes):
    x0, z0, x1, z1 = lt['bbox']
    for cx in range(int(math.floor(x0 / GRID)), int(math.floor(x1 / GRID)) + 1):
        for cz in range(int(math.floor(z0 / GRID)), int(math.floor(z1 / GRID)) + 1):
            grade[(cx, cz)].append(i)

def candidatos_para_bbox(bb, margem=1.0):
    x0, z0, x1, z1 = bb
    x0 -= margem; z0 -= margem; x1 += margem; z1 += margem
    vistos = set()
    for cx in range(int(math.floor(x0 / GRID)), int(math.floor(x1 / GRID)) + 1):
        for cz in range(int(math.floor(z0 / GRID)), int(math.floor(z1 / GRID)) + 1):
            for i in grade.get((cx, cz), ()):
                vistos.add(i)
    return vistos

def lotes_cruzando_poligono(peca_poly, tol=TOL):
    bb = bbox(peca_poly)
    atingidos = []
    for i in candidatos_para_bbox(bb, margem=tol + 1.0):
        pen = penetracao_poligonos(lotes[i]['poly'], peca_poly)
        if pen > tol:
            atingidos.append((lotes[i]['lot_id'], round(pen, 2)))
    return atingidos

def lotes_cruzando_anel(r, larg, tol=TOL):
    """anel = coroa circular centrada na origem (0,0), como testado por
    num_anel() em scripts/gerar_cidade.py:2439 (r = hypot(x,z), sem phi)."""
    lo, hi = r - larg / 2, r + larg / 2
    atingidos = []
    for i, lt in enumerate(lotes):
        rmin = dist_origem_min(lt['poly'])
        rmax = dist_origem_max(lt['poly'])
        pen = min(rmax, hi) - max(rmin, lo)
        if pen > tol:
            atingidos.append((lt['lot_id'], round(pen, 2)))
    return atingidos

# ═════════════════════════════════════════════════════════════════════════
# 2. PARTE A: cidade.json (a cidade SELADA, rodada 4)
# ═════════════════════════════════════════════════════════════════════════
cidade = json.load(open(p('public/city/cidade.json'), encoding='utf-8'))

def pegada_programa_cidade(q):
    """monta o poligono de uma peca de public/city/cidade.json['programa'],
    replicando exatamente scripts/gerar_cidade.py:2405 em_programa():
      - forma 'celula' ou 'poligono': ja vem com 'poly' em coordenada de
        mundo -- usa direto.
      - forma 'retangulo': retangulo de meia-largura a, meia-profundidade b,
        centro (x,z), giro 'rot' em graus (mesma convencao de cantos()).
      - forma 'elipse': semieixos a,b, mesmo centro/giro, aproximada por
        poligono de 72 lados."""
    if q.get('poly'):
        return list(map(tuple, q['poly']))
    x, z, a, b, rot = q['x'], q['z'], q['a'], q['b'], q['rot']
    if q['forma'] == 'retangulo':
        return cantos(x, z, 2 * a, 2 * b, math.radians(rot))
    elif q['forma'] == 'elipse':
        return elipse_poly(x, z, a, b, rot)
    raise ValueError(f"forma desconhecida sem poly: {q}")

print('\n[A] cidade.json — 76 pecas de programa', file=sys.stderr)
resultA_programa = {}
todos_lotes_programa_cidade = set()
for q in cidade['programa']:
    poly = pegada_programa_cidade(q)
    hits = lotes_cruzando_poligono(poly)
    resultA_programa[q['id']] = {
        'nome': q['nome'], 'tipo': q['tipo'], 'forma': q['forma'],
        'ha': q.get('ha'), 'n_lotes': len(hits),
        'lotes': sorted(hits, key=lambda t: -t[1])[:8],
    }
    for lid, _ in hits:
        todos_lotes_programa_cidade.add(lid)
    print(f"  {q['id']:6s} {q['nome']:28s} {q['forma']:9s} {len(hits):5d} lotes", file=sys.stderr)

print('\n[A] cidade.json — 7 aneis', file=sys.stderr)
resultA_aneis = {}
todos_lotes_aneis_cidade = set()
for an in cidade['aneis']:
    hits = lotes_cruzando_anel(an['r'], an['larg'])
    resultA_aneis[an['id']] = {'nome': an['nome'], 'r': an['r'], 'larg': an['larg'],
                                'n_lotes': len(hits), 'lotes': sorted(hits, key=lambda t: -t[1])[:8]}
    for lid, _ in hits:
        todos_lotes_aneis_cidade.add(lid)
    print(f"  {an['id']:5s} {an['nome']:28s} r={an['r']:7.1f} larg={an['larg']:4.1f}  {len(hits):5d} lotes", file=sys.stderr)

total_cidade = todos_lotes_programa_cidade | todos_lotes_aneis_cidade

# ═════════════════════════════════════════════════════════════════════════
# 3. PARTE B: mapa-v1.json (o PLANO ANTIGO)
# ═════════════════════════════════════════════════════════════════════════
mapa1 = json.load(open(p('public/city/mapa-v1.json'), encoding='utf-8'))

print('\n[B] mapa-v1.json — 70 pecas de programa', file=sys.stderr)
resultB_programa = {}
todos_lotes_programa_mapa1 = set()
for q in mapa1['programa']:
    poly = list(map(tuple, q['poly']))
    hits = lotes_cruzando_poligono(poly)
    resultB_programa[q['id']] = {'nome': q['nome'], 'tipo': q['tipo'],
                                  'n_lotes': len(hits), 'lotes': sorted(hits, key=lambda t: -t[1])[:8]}
    for lid, _ in hits:
        todos_lotes_programa_mapa1.add(lid)

print('[B] mapa-v1.json — 7 ancoras', file=sys.stderr)
resultB_ancoras = {}
todos_lotes_ancoras_mapa1 = set()
for a in mapa1['ancoras']:
    poly = list(map(tuple, a['poly']))
    hits = lotes_cruzando_poligono(poly)
    resultB_ancoras[a['id']] = {'n_lotes': len(hits), 'lotes': sorted(hits, key=lambda t: -t[1])[:8]}
    for lid, _ in hits:
        todos_lotes_ancoras_mapa1.add(lid)

print('[B] mapa-v1.json — Founders Club (ilha, crescentes)', file=sys.stderr)
fc = mapa1['reservas']['foundersClub']
todos_lotes_fc = set()
resultB_fc = {}
for k, crescente in enumerate(fc['crescentes']):
    poly = list(map(tuple, crescente))
    hits = lotes_cruzando_poligono(poly)
    resultB_fc[f'FC01-crescente{k}'] = {'n_lotes': len(hits)}
    for lid, _ in hits:
        todos_lotes_fc.add(lid)

print('[B] mapa-v1.json — 7 aneisViarios (comparar com os aneis de cidade.json)', file=sys.stderr)
resultB_aneis = {}
todos_lotes_aneis_mapa1 = set()
for an in mapa1['aneisViarios']:
    hits = lotes_cruzando_anel(an['r'], an['larg'])
    resultB_aneis[an['id']] = {'nome': an['nome'], 'r': an['r'], 'larg': an['larg'], 'n_lotes': len(hits)}
    for lid, _ in hits:
        todos_lotes_aneis_mapa1.add(lid)
    r_cidade = next((x['r'] for x in cidade['aneis'] if x['id'] == an['id']), None)
    print(f"  {an['id']:5s} {an['nome']:28s} r_mapa1={an['r']:8.1f} r_cidade={r_cidade}  "
          f"delta={abs(an['r']-r_cidade):.1f} m  {len(hits):5d} lotes (vs {resultA_aneis[an['id']]['n_lotes']} em cidade.json)",
          file=sys.stderr)

total_mapa1 = todos_lotes_programa_mapa1 | todos_lotes_ancoras_mapa1 | todos_lotes_fc | todos_lotes_aneis_mapa1

# ═════════════════════════════════════════════════════════════════════════
# 4. PARTE C: classificar cada peca comum aos dois arquivos como IDENTICA,
#    MOVIDA ou EXCLUSIVA de um dos dois, e comparar a contagem de lotes na
#    posicao antiga (mapa-v1) contra a posicao atual (cidade.json).
# ═════════════════════════════════════════════════════════════════════════
cids_prog = {q['id']: q for q in cidade['programa']}
mids_prog = {q['id']: q for q in mapa1['programa']}
mids_anc = {a['id']: a for a in mapa1['ancoras']}
mids_all = {**mids_prog, **mids_anc}

so_cidade = sorted(set(cids_prog) - set(mids_all))
so_mapa1 = sorted(set(mids_all) - set(cids_prog))
comuns = sorted(set(cids_prog) & set(mids_all))

identicas, movidas = [], []
for pid in comuns:
    pc = cids_prog[pid]
    pm = mids_all[pid]
    poly_c = pegada_programa_cidade(pc)
    poly_m = list(map(tuple, pm['poly']))
    if poly_c == poly_m:
        identicas.append(pid)
    else:
        cx_c = sum(x for x, _ in poly_c) / len(poly_c); cz_c = sum(z for _, z in poly_c) / len(poly_c)
        cx_m = sum(x for x, _ in poly_m) / len(poly_m); cz_m = sum(z for _, z in poly_m) / len(poly_m)
        dist = math.hypot(cx_c - cx_m, cz_c - cz_m)
        n_old = lotes_cruzando_poligono(poly_m)
        n_new = resultA_programa.get(pid, {}).get('n_lotes', None)
        movidas.append({'id': pid, 'nome': pc['nome'], 'deslocamento_m': round(dist, 1),
                         'lotes_na_posicao_antiga': len(n_old), 'lotes_na_posicao_atual': n_new})

print('\n[C] pecas comuns aos dois arquivos:', len(comuns), file=sys.stderr)
print('    identicas (mesmo poligono):', len(identicas), identicas, file=sys.stderr)
print('    movidas (posicao diferente):', len(movidas), file=sys.stderr)
for mv in movidas:
    print(f"      {mv['id']:6s} {mv['nome']:26s} deslocou {mv['deslocamento_m']:8.1f} m  "
          f"antigo:{mv['lotes_na_posicao_antiga']:4d} lotes  atual:{mv['lotes_na_posicao_atual']}", file=sys.stderr)
print('    so em cidade.json (sem equivalente no plano antigo):', so_cidade, file=sys.stderr)
print('    so em mapa-v1.json (superadas, sem equivalente na cidade atual):', so_mapa1, file=sys.stderr)

# ═════════════════════════════════════════════════════════════════════════
# 5. PARTE D: enclaves -- olhando so a leitura do gerador (nao importa).
#    Confirmado em scripts/gerar_cidade.py linhas ~4193-4220 e 6099:
#    'enclave' = familia de carteiras (10 ou mais) que descem do MESMO
#    ancestral de profundidade 1 na genealogia do airdrop (dogcity_genealogia
#    .json). Nao tem NENHUMA relacao com lote ficar sem rua / conectividade
#    viaria -- e um agrupamento social/de origem de saldo, usado so para
#    aproximar parentes na alocacao (campo 'familia' no CSV/registro).
#    Confere abaixo contra a coluna 'familia' do CSV selado.
# ═════════════════════════════════════════════════════════════════════════
fam_ids = collections.Counter()
with open(p('data/dogcity_lotes.csv'), newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        fid = int(r['familia'])
        if fid: fam_ids[fid] += 1
n_familias_csv = len(fam_ids)
n_carteiras_csv = sum(fam_ids.values())
print(f'\n[D] coluna familia do CSV: {n_familias_csv} ids de familia distintos '
      f'(!=0), {n_carteiras_csv} lotes com familia != 0', file=sys.stderr)
print(f'    cidade.json diz enclaves={cidade["enclaves"]} carteirasEmEnclave={cidade["carteirasEmEnclave"]}',
      file=sys.stderr)

# ═════════════════════════════════════════════════════════════════════════
# saida
# ═════════════════════════════════════════════════════════════════════════
saida = {
    'tolerancia_m': TOL, 'grade_m': GRID, 'n_lotes': N_LOTES,
    'A_cidade_json': {
        'programa': resultA_programa,
        'aneis': resultA_aneis,
        'total_lotes_unicos_programa': len(todos_lotes_programa_cidade),
        'total_lotes_unicos_aneis': len(todos_lotes_aneis_cidade),
        'total_lotes_unicos_geral': len(total_cidade),
    },
    'B_mapa_v1_json': {
        'programa': resultB_programa,
        'ancoras': resultB_ancoras,
        'foundersClub': resultB_fc,
        'aneisViarios': resultB_aneis,
        'total_lotes_unicos_programa': len(todos_lotes_programa_mapa1),
        'total_lotes_unicos_ancoras': len(todos_lotes_ancoras_mapa1),
        'total_lotes_unicos_foundersClub': len(todos_lotes_fc),
        'total_lotes_unicos_aneis': len(todos_lotes_aneis_mapa1),
        'total_lotes_unicos_geral': len(total_mapa1),
    },
    'C_comparacao': {
        'pecas_comuns': len(comuns), 'pecas_identicas': identicas,
        'pecas_movidas': movidas,
        'so_em_cidade_json': so_cidade, 'so_em_mapa_v1_json': so_mapa1,
    },
    'D_enclaves': {
        'cidade_json_enclaves': cidade['enclaves'],
        'cidade_json_carteirasEmEnclave': cidade['carteirasEmEnclave'],
        'csv_familias_distintas': n_familias_csv,
        'csv_lotes_com_familia': n_carteiras_csv,
    },
}
out_path = os.path.join(OUT_DIR, 'resultado_lote_x_programa.json')
json.dump(saida, open(out_path, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
print(f'\nJSON completo em {out_path}', file=sys.stderr)

print('\n=== RESUMO ===', file=sys.stderr)
print(f"cidade.json: {len(todos_lotes_programa_cidade)} lotes cruzam programa, "
      f"{len(todos_lotes_aneis_cidade)} cruzam aneis, {len(total_cidade)} lotes unicos no total "
      f"({100*len(total_cidade)/N_LOTES:.2f}% de {N_LOTES})", file=sys.stderr)
print(f"mapa-v1.json: {len(todos_lotes_programa_mapa1)} lotes cruzam programa, "
      f"{len(todos_lotes_ancoras_mapa1)} cruzam ancoras, {len(todos_lotes_fc)} cruzam Founders Club, "
      f"{len(todos_lotes_aneis_mapa1)} cruzam aneisViarios, {len(total_mapa1)} lotes unicos no total "
      f"({100*len(total_mapa1)/N_LOTES:.2f}% de {N_LOTES})", file=sys.stderr)
print(f"em cidade.json mas NAO em mapa-v1.json: {len(total_cidade - total_mapa1)} lotes", file=sys.stderr)
print(f"em mapa-v1.json mas NAO em cidade.json: {len(total_mapa1 - total_cidade)} lotes", file=sys.stderr)
print(f"nos dois: {len(total_cidade & total_mapa1)} lotes", file=sys.stderr)
