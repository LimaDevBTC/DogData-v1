import csv, json, math, sys, collections
sys.path.insert(0, '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/8c325219-1e13-44e6-9724-1b09f71f34c8/scratchpad/diag')
from geom import (cantos, sat_overlap, is_convex, general_overlap_depth,
                   anel_overlap, poly_min_max_radius)

# NOTA (achado ao refazer os exemplos a mao): a "penetracao" de peca que o
# relatorio usa NAO e a distancia minima de separacao (MTD/SAT) que eu tinha
# assumido -- e o VERTEX-BASED: a maior distancia, entre os 4 cantos do lote
# que caem dentro da peca (ou os cantos da peca que caem dentro do lote), ate
# a borda mais proxima do outro poligono. Confirmado batendo byte a byte com
# os 3 exemplos "pior caso" do relatorio (IN08 138.56m, B03 142.56m, E02
# 293.1m) so depois de trocar de sat_overlap() para general_overlap_depth()
# em TODAS as pecas (nao so nas nao-convexas). Por isso os testes de peca
# abaixo usam general_overlap_depth() mesmo quando a peca e convexa.

REPO = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
TOL = 0.5

# ---------------- carrega CSV ----------------
lotes = []
with open(f'{REPO}/data/dogcity_lotes.csv') as f:
    for r in csv.DictReader(f):
        x, z = float(r['x_m']), float(r['z_m'])
        w, d = float(r['frente_m']), float(r['prof_m'])
        giro = math.radians(float(r['giro_graus']))
        poly = cantos(x, z, w, d, giro)
        lotes.append({'id': r['lot_id'], 'x': x, 'z': z, 'w': w, 'd': d,
                      'poly': poly, 'raio': float(r['raio_m']),
                      'familia': r['familia']})
print(f"lotes carregados: {len(lotes)}")

cidade = json.load(open(f'{REPO}/public/city/cidade.json'))
mapav1 = json.load(open(f'{REPO}/public/city/mapa-v1.json'))

# ---------------- constroi poligonos das pecas ----------------
def piece_poly_cidade(p):
    """Retorna lista de poligonos convexos representando a peça (>=1),
    e uma flag se é aproximação (retangulo/elipse sem poly no arquivo)."""
    if p.get('poly'):
        return [[tuple(pt) for pt in p['poly']]], False
    forma = p['forma']
    cx, cz, a, b, rot = p['x'], p['z'], p['a'], p['b'], p['rot']
    if forma == 'retangulo':
        return [cantos(cx, cz, 2*a, 2*b, math.radians(rot))], False
    if forma == 'elipse':
        # aproxima a elipse por poligono de 64 lados (erro desprezivel p/ deteccao de cruzamento)
        pts = []
        for k in range(64):
            th = 2*math.pi*k/64
            lx, lz = a*math.cos(th), b*math.sin(th)
            ca, sa = math.cos(math.radians(rot)), math.sin(math.radians(rot))
            wx = cx + lx*ca - lz*sa
            wz = cz + lx*sa + lz*ca
            pts.append((wx, wz))
        return [pts], False
    raise ValueError(forma)


def bbox(poly):
    xs = [p[0] for p in poly]; zs = [p[1] for p in poly]
    return min(xs), max(xs), min(zs), max(zs)


def bounding_radius(poly, cx, cz):
    return max(math.hypot(p[0]-cx, p[1]-cz) for p in poly)


def lot_candidates(lotes, cx, cz, raio_peca, folga=50.0):
    """pre-filtro por distancia: um lote so pode cruzar a peça se a distancia
    entre os centros for menor que raio_peca + raio_do_lote(aprox) + folga.
    Como os lotes tem raio_m (distancia do lote ao centro da cidade) mas nao
    um 'raio proprio', uso a metade da diagonal do retangulo do lote."""
    out = []
    for L in lotes:
        diag = math.hypot(L['w'], L['d']) / 2.0
        dist = math.hypot(L['x']-cx, L['z']-cz)
        if dist <= raio_peca + diag + folga:
            out.append(L)
    return out


def check_pieces(lotes, pecas_polys, tol, label):
    """pecas_polys: lista de (piece_id, [poligonos convexos], nao_convexo_flag)
    -> mas tratamos non-convex fallback via general_overlap_depth por poligono."""
    hits = {}  # lot_id -> (piece_id, penetracao)
    per_piece_count = collections.Counter()
    for piece_id, polys, cx, cz in pecas_polys:
        raio_peca = max(bounding_radius(poly, cx, cz) for poly in polys)
        cands = lot_candidates(lotes, cx, cz, raio_peca)
        for L in cands:
            best = None
            for poly in polys:
                ov = general_overlap_depth(L['poly'], poly)
                if ov is not None and (best is None or ov > best):
                    best = ov
            if best is not None and best > tol:
                per_piece_count[piece_id] += 1
                if L['id'] not in hits or best > hits[L['id']][1]:
                    hits[L['id']] = (piece_id, best)
    print(f"[{label}] lotes cruzando (>{tol}m): {len(hits)}  (pecas com >=1 lote: {sum(1 for v in per_piece_count.values() if v>0)})")
    return hits, per_piece_count


# ============ 1) cidade.json: 76 pecas de programa ============
pecas_cidade = []
for p in cidade['programa']:
    polys, _ = piece_poly_cidade(p)
    cx, cz = p['x'], p['z']
    pecas_cidade.append((p['id'], polys, cx, cz))
print(f"pecas cidade.json (programa): {len(pecas_cidade)}")
hits_cidade_prog, count_cidade_prog = check_pieces(lotes, pecas_cidade, TOL, 'cidade.json programa')

# ============ 2) cidade.json: 7 aneis ============
def check_aneis(lotes, aneis, tol, label):
    hits = {}
    per_anel = collections.Counter()
    for a in aneis:
        r, larg = a['r'], a['larg']
        for L in lotes:
            ov = anel_overlap(L['poly'], r, larg)
            if ov is not None and ov > tol:
                per_anel[a['id']] += 1
                if L['id'] not in hits or ov > hits[L['id']][1]:
                    hits[L['id']] = (a['id'], ov)
    print(f"[{label}] lotes cruzando aneis (>{tol}m): {len(hits)}")
    return hits, per_anel

hits_cidade_anel, count_cidade_anel = check_aneis(lotes, cidade['aneis'], TOL, 'cidade.json aneis')
print("  por anel:", dict(count_cidade_anel))
for lid, (aid, ov) in hits_cidade_anel.items():
    print("   ", lid, aid, f"penetracao={ov:.2f}m")

uniao_cidade = set(hits_cidade_prog) | set(hits_cidade_anel)
print(f"cidade.json: uniao programa+aneis = {len(uniao_cidade)} lotes ({100*len(uniao_cidade)/len(lotes):.4f}%)")

# ============ 3) mapa-v1.json: 70 programa + 7 ancoras + founders club ============
pecas_mapav1 = []
for p in mapav1['programa']:
    poly = [tuple(pt) for pt in p['poly']]
    pecas_mapav1.append((p['id'], [poly], p['cx'], p['cz']))
for a in mapav1['ancoras']:
    poly = [tuple(pt) for pt in a['poly']]
    pecas_mapav1.append((a['id'], [poly], a['cx'], a['cz']))
print(f"pecas mapa-v1.json (programa+ancoras): {len(pecas_mapav1)}")
hits_v1_prog, count_v1_prog = check_pieces(lotes, pecas_mapav1, TOL, 'mapa-v1 programa+ancoras')

# founders club: 2 crescentes (não convexos) - trato como peça própria, não-convexa
fc = mapav1['reservas']['foundersClub']
fc_polys = [[tuple(pt) for pt in cr] for cr in fc['crescentes']]
cxfc, czfc = fc['centro'][0], fc['centro'][1]
hits_fc = {}
raio_fc = max(bounding_radius(poly, cxfc, czfc) for poly in fc_polys)
cands_fc = lot_candidates(lotes, cxfc, czfc, raio_fc)
print(f"  founders club: candidatos por raio = {len(cands_fc)}")
for L in cands_fc:
    best = None
    for poly in fc_polys:
        ov = general_overlap_depth(L['poly'], poly)
        if ov is not None and (best is None or ov > best):
            best = ov
    if best is not None and best > TOL:
        hits_fc[L['id']] = ('FC01', best)
print(f"  founders club: lotes cruzando (>{TOL}m) = {len(hits_fc)}")

hits_v1_all = dict(hits_v1_prog)
hits_v1_all.update(hits_fc)
print(f"mapa-v1: programa+ancoras+FC = {len(hits_v1_all)} lotes")

# ============ 4) mapa-v1.json: 7 aneisViarios ============
hits_v1_anel, count_v1_anel = check_aneis(lotes, mapav1['aneisViarios'], TOL, 'mapa-v1 aneisViarios')

uniao_v1 = set(hits_v1_all) | set(hits_v1_anel)
print(f"mapa-v1.json: uniao total = {len(uniao_v1)} lotes ({100*len(uniao_v1)/len(lotes):.4f}%)")

# ============ 5) comparacoes ============
so_v1 = uniao_v1 - uniao_cidade
so_cidade = uniao_cidade - uniao_v1
print(f"cruzam mapa-v1 mas NAO cidade.json: {len(so_v1)}")
print(f"cruzam cidade.json mas NAO mapa-v1.json: {len(so_cidade)}")

# ============ 6) pecas comuns / deslocamento ============
ids_cidade = set(p['id'] for p in cidade['programa'])
ids_v1 = set(p['id'] for p in mapav1['programa']) | set(a['id'] for a in mapav1['ancoras'])
comuns = ids_cidade & ids_v1
so_em_cidade = ids_cidade - ids_v1
so_em_v1 = ids_v1 - ids_cidade
print(f"ids comuns aos dois: {len(comuns)}")
print(f"so em cidade.json: {sorted(so_em_cidade)}")
print(f"so em mapa-v1.json: {sorted(so_em_v1)}")

centro_cidade = {p['id']: (p['x'], p['z']) for p in cidade['programa']}
centro_v1 = {}
for p in mapav1['programa']:
    centro_v1[p['id']] = (p['cx'], p['cz'])
for a in mapav1['ancoras']:
    centro_v1[a['id']] = (a['cx'], a['cz'])

deslocs = []
identicos = []
for pid in sorted(comuns):
    cx1, cz1 = centro_cidade[pid]
    cx2, cz2 = centro_v1[pid]
    dist = math.hypot(cx1-cx2, cz1-cz2)
    deslocs.append((pid, dist))
    if dist < 0.01:
        identicos.append(pid)
deslocs.sort(key=lambda t: t[1])
print(f"pecas com centro IDENTICO (<1cm): {len(identicos)} -> {identicos}")
print("menor deslocamento (nao identico):", [d for d in deslocs if d[1] >= 0.01][:3])
print("maior deslocamento:", deslocs[-3:])

# ============ 7) enclaves / familia ============
familias = collections.Counter(l['familia'] for l in lotes if l['familia'] not in ('0', ''))
print(f"familia != 0: {len(familias)} ids distintos, {sum(familias.values())} lotes")
print(f"cidade.json enclaves = {cidade.get('enclaves')}, carteirasEmEnclave = {cidade.get('carteirasEmEnclave')}")

print("\nDONE")
