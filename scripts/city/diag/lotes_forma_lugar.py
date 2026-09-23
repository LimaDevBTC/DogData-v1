#!/usr/bin/env python3
"""
Diagnostico SOMENTE LEITURA sobre data/dogcity_lotes.csv (rodada 4, DogCity).

(A) Sobreposicao lote x lote: indice de grade (celulas de 100 m) + filtro por
    circulo envolvente + interseccao exata de poligonos convexos por recorte
    de Sutherland-Hodgman, para medir a AREA de sobreposicao (nao so um
    booleano). Conta pares com area > 1 m2, soma area, agrupa por setor, por
    par de setor e por dentro/fora do mesmo quarteirao.

(B) Lote fora do lugar: (B1) algum canto alem de raioBorda (8900 m) ou
    raioSitio (9000 m); (B2) o "retangulo que sai da borda": faixas de rumo de
    5 graus, raio maximo por faixa contra a mediana das faixas vizinhas.

(C) Giro que nao bate com o rumo do proprio centro: desvio angular de
    giro_graus contra atan2(z, x) (mesma convencao do giro, documentada em
    scripts/gerar_cidade.py:6424: "giro em graus, positivo de +x para +z"),
    reduzido a "distancia ao multiplo de 90 mais proximo" (um lote radial
    pode estar alinhado ao raio OU perpendicular a ele). Conta desvios > 5
    graus, por setor, e verifica se formam cunha continua por rumo de
    bussola (rumo = atan2(x, -z), 0 = norte/-z, cresce para leste/+x, sul =
    +z -- convencao documentada em scripts/gerar_cidade.py:6424 e
    scripts/city/carta.mjs:80/84).

Rodar de novo:
    python3 /tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/8c325219-1e13-44e6-9724-1b09f71f34c8/scratchpad/diag/lotes_forma_lugar.py

So le arquivos do repo (nao escreve nada nele).
"""
import csv
import json
import math
import collections
import time

REPO = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
CSV_PATH = f'{REPO}/data/dogcity_lotes.csv'
CIDADE_JSON = f'{REPO}/public/city/cidade.json'

T0 = time.time()


def log(*a):
    print(f'[{time.time()-T0:7.1f}s]', *a)


# ---------------------------------------------------------------------------
# cantos() COPIADA de scripts/city/conferir_lotes.py:135 (nao importada: o
# modulo roda coisas no import). w = frente_m (testada), d = prof_m
# (profundidade), giro em RADIANOS. Comentario original do arquivo-fonte
# (scripts/city/gerar_cidade.py:6424) sobre a mesma convencao:
#   "wx = x + lx*cos(giro) - lz*sin(giro); wz = z + lx*sin(giro) + lz*cos(giro).
#    x local = testada, z local = profundidade. giro em graus, positivo de +x
#    para +z."
# ---------------------------------------------------------------------------
def cantos(x, z, w, d, giro):
    ca, sa = math.cos(giro), math.sin(giro)
    return [(x + dx * ca - dz * sa, z + dx * sa + dz * ca)
            for dx, dz in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]


# ---------------------------------------------------------------------------
# 1. carregar CSV + cidade.json
# ---------------------------------------------------------------------------
log('lendo CSV...')
rows = []
with open(CSV_PATH, newline='') as f:
    for r in csv.DictReader(f):
        rows.append(r)
N = len(rows)
log(f'{N} lotes lidos')

with open(CIDADE_JSON) as f:
    cidade = json.load(f)
RAIO_BORDA = float(cidade['raioBorda'])
RAIO_SITIO = float(cidade['raioSitio'])
log(f'raioBorda={RAIO_BORDA} raioSitio={RAIO_SITIO} (de {CIDADE_JSON})')

lot_id = [r['lot_id'] for r in rows]
setor = [int(r['setor']) for r in rows]
quarto = [int(r['quarto']) for r in rows]
quarteirao = [int(r['quarteirao']) for r in rows]
lote_num = [int(r['lote']) for r in rows]
x = [float(r['x_m']) for r in rows]
z = [float(r['z_m']) for r in rows]
raio_m = [float(r['raio_m']) for r in rows]
frente = [float(r['frente_m']) for r in rows]
prof = [float(r['prof_m']) for r in rows]
area_m2 = [float(r['area_m2']) for r in rows]
giro = [float(r['giro_graus']) for r in rows]
qkey = [(setor[i], quarto[i], quarteirao[i]) for i in range(N)]

# corners e raio de canto maximo, precomputados uma vez
CORNERS = [None] * N
CANTO_MAX = [0.0] * N
HALF_DIAG = [0.0] * N
for i in range(N):
    w = max(frente[i], 1.0)
    d = max(prof[i], 1.0)
    c = cantos(x[i], z[i], w, d, math.radians(giro[i]))
    CORNERS[i] = c
    CANTO_MAX[i] = max(math.hypot(px, pz) for px, pz in c)
    HALF_DIAG[i] = math.hypot(w, d) / 2.0
log('cantos calculados para todos os lotes')


# ===========================================================================
# (A) SOBREPOSICAO LOTE x LOTE, por indice de grade + Sutherland-Hodgman
# ===========================================================================
def signed_area(poly):
    s = 0.0
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return s / 2.0


def _line_intersect(p1, p2, a, b):
    x1, y1 = p1; x2, y2 = p2; x3, y3 = a; x4, y4 = b
    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(denom) < 1e-12:
        return p2
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))


def clip_sutherland_hodgman(subject, clip_poly):
    """Recorta `subject` (poligono convexo qualquer) pelo poligono convexo
    `clip_poly`. Ambos precisam estar em ordem CCW -- cantos() sempre produz
    CCW porque a rotacao e propria (determinante 1) e a ordem local
    (-w/2,-d/2)->(w/2,-d/2)->(w/2,d/2)->(-w/2,d/2) ja e CCW em giro=0."""
    output = subject
    cn = len(clip_poly)
    for i in range(cn):
        if not output:
            break
        A = clip_poly[i]
        B = clip_poly[(i + 1) % cn]
        ex, ez = B[0] - A[0], B[1] - A[1]
        inp = output
        output = []
        m = len(inp)
        for j in range(m):
            cur = inp[j]
            prev = inp[j - 1]
            cur_in = (ex * (cur[1] - A[1]) - ez * (cur[0] - A[0])) >= -1e-9
            prev_in = (ex * (prev[1] - A[1]) - ez * (prev[0] - A[0])) >= -1e-9
            if cur_in:
                if not prev_in:
                    output.append(_line_intersect(prev, cur, A, B))
                output.append(cur)
            elif prev_in:
                output.append(_line_intersect(prev, cur, A, B))
    return output


def overlap_area(i, j):
    inter = clip_sutherland_hodgman(CORNERS[i], CORNERS[j])
    if len(inter) < 3:
        return 0.0
    return abs(signed_area(inter))


log('(A) construindo indice de grade (celulas de 100 m)...')
CELL = 100.0
grid = collections.defaultdict(list)
for i in range(N):
    cx = int(math.floor(x[i] / CELL))
    cz = int(math.floor(z[i] / CELL))
    grid[(cx, cz)].append(i)
log(f'{len(grid)} celulas ocupadas, media {N/len(grid):.2f} lotes/celula')

# 5 deslocamentos "para frente" cobrem exatamente a vizinhanca 3x3 uma unica
# vez (celula consigo mesma + os 4 pares nao-redundantes de vizinhos), sem
# testar o mesmo par (i,j) duas vezes vindo de celulas diferentes.
OFFSETS = [(0, 0), (1, 0), (0, 1), (1, 1), (1, -1)]

pares_overlap = []  # (i, j, area)
candidatos = 0
seen = set()
for (cx, cz), idxs_a in grid.items():
    for dx, dz in OFFSETS:
        other = (cx + dx, cz + dz)
        idxs_b = grid.get(other)
        if idxs_b is None:
            continue
        if dx == 0 and dz == 0:
            # pares dentro da mesma celula
            m = len(idxs_a)
            for a in range(m):
                i = idxs_a[a]
                for b in range(a + 1, m):
                    j = idxs_a[b]
                    candidatos += 1
                    if (x[i]-x[j])**2 + (z[i]-z[j])**2 > (HALF_DIAG[i]+HALF_DIAG[j])**2:
                        continue
                    ar = overlap_area(i, j)
                    if ar > 1.0:
                        pares_overlap.append((i, j, ar))
        else:
            for i in idxs_a:
                for j in idxs_b:
                    candidatos += 1
                    if (x[i]-x[j])**2 + (z[i]-z[j])**2 > (HALF_DIAG[i]+HALF_DIAG[j])**2:
                        continue
                    ar = overlap_area(i, j)
                    if ar > 1.0:
                        pares_overlap.append((i, j, ar))

log(f'{candidatos} pares candidatos (grade+circulo), {len(pares_overlap)} com area de sobreposicao > 1 m2')

# ---------------------------------------------------------------------------
# PASSADA DE SEGURANCA: a celula de grade de ~100 m so garante achar um par
# se a soma dos meios-diagonais (HALF_DIAG) for <= 100 m -- prova: duas
# celulas a distancia de Chebyshev >= 2 nunca sao comparadas pelos 5
# deslocamentos acima, e a menor distancia possivel entre pontos em celulas
# assim e pouco mais de 100 m (CELL). A mediana do lote (~23x24 m) tem meio-
# diagonal ~17 m, mas ha lotes especiais (dedos, cunhas, a peca do
# Distrito Financeiro) com meio-diagonal ate 450 m -- pares envolvendo esses
# PODERIAM escapar da vizinhanca 3x3 se o parceiro cair 2+ celulas adiante.
# Para nao depender de sorte de alinhamento, todo lote com meio-diagonal
# > 40 m e reconferido por FORCA BRUTA contra todos os lotes do MESMO SETOR
# (setores nunca se misturam nos pares achados acima, e nenhum par cruzou
# setor) -- 1.774 lotes x poucos milhares cada, ainda barato.
log('(A, passada de seguranca) forca bruta para lotes com meio-diagonal > 40 m...')
LIMIAR_GRANDE = 40.0
grandes = [i for i in range(N) if HALF_DIAG[i] > LIMIAR_GRANDE]
por_setor_idx = collections.defaultdict(list)
for i in range(N):
    por_setor_idx[setor[i]].append(i)
ja_achado = set((min(i, j), max(i, j)) for i, j, _ in pares_overlap)
extras = []
for i in grandes:
    for j in por_setor_idx[setor[i]]:
        if j == i:
            continue
        key = (min(i, j), max(i, j))
        if key in ja_achado:
            continue
        if (x[i]-x[j])**2 + (z[i]-z[j])**2 > (HALF_DIAG[i]+HALF_DIAG[j])**2:
            continue
        ar = overlap_area(i, j)
        if ar > 1.0:
            extras.append(key + (ar,))
            ja_achado.add(key)
log(f'{len(grandes)} lotes grandes (meio-diagonal > {LIMIAR_GRANDE} m) reconferidos por forca bruta '
    f'dentro do proprio setor: {len(extras)} pares NOVOS encontrados (nao vistos pela grade)')
if extras:
    for i, j, ar in extras[:10]:
        log(f'  NOVO: {lot_id[i]} x {lot_id[j]} area={ar:.2f} m2')
    pares_overlap.extend(extras)

por_setor = collections.Counter()
area_por_setor = collections.defaultdict(float)
por_par_setor = collections.Counter()
area_por_par_setor = collections.defaultdict(float)
dentro_quarteirao = 0
entre_quarteiroes = 0
area_dentro = 0.0
area_entre = 0.0
# granularidade extra: dentro do mesmo "quarto" (so quarteirao muda) x entre
# "quartos" diferentes (setores 1-6 sao subdivididos em quartos angulares;
# um seam de quarto e uma costura MAIS provavel de descoordenacao entre duas
# malhas de fileira geradas de forma independente).
mesmo_quarto_dif_quarteirao = 0
quarto_diferente = 0
area_mesmo_quarto = 0.0
area_quarto_dif = 0.0
por_par_quarto = collections.Counter()
area_por_par_quarto = collections.defaultdict(float)
for i, j, ar in pares_overlap:
    sa, sb = setor[i], setor[j]
    por_setor[sa] += 1
    por_setor[sb] += 1
    area_por_setor[sa] += ar
    area_por_setor[sb] += ar
    par = tuple(sorted((sa, sb)))
    por_par_setor[par] += 1
    area_por_par_setor[par] += ar
    if qkey[i] == qkey[j]:
        dentro_quarteirao += 1
        area_dentro += ar
    else:
        entre_quarteiroes += 1
        area_entre += ar
        if setor[i] == setor[j] and quarto[i] == quarto[j]:
            mesmo_quarto_dif_quarteirao += 1
            area_mesmo_quarto += ar
        else:
            quarto_diferente += 1
            area_quarto_dif += ar
            pq = (setor[i], tuple(sorted((quarto[i], quarto[j]))))
            por_par_quarto[pq] += 1
            area_por_par_quarto[pq] += ar

pares_overlap.sort(key=lambda t: -t[2])
piores10 = pares_overlap[:10]

AREA_TOTAL_LOTES = sum(area_m2)
lotes_envolvidos = set()
for i, j, ar in pares_overlap:
    lotes_envolvidos.add(i)
    lotes_envolvidos.add(j)
soma_area = sum(a for _, _, a in pares_overlap)
log('=== (A) RESULTADO ===')
log(f'pares com sobreposicao > 1 m2: {len(pares_overlap)}; area total sobreposta: {soma_area:.1f} m2 '
    f'({100*soma_area/AREA_TOTAL_LOTES:.2f}% dos {AREA_TOTAL_LOTES:.0f} m2 de area_m2 somada de todos os lotes)')
log(f'lotes distintos com pelo menos uma sobreposicao > 1 m2: {len(lotes_envolvidos)} de {N} '
    f'({100*len(lotes_envolvidos)/N:.2f}%)')
log(f'dentro do mesmo quarteirao: {dentro_quarteirao} pares / {area_dentro:.1f} m2')
log(f'entre quarteiroes diferentes: {entre_quarteiroes} pares / {area_entre:.1f} m2')
log(f'  dos quais mesmo quarto (so B muda): {mesmo_quarto_dif_quarteirao} pares / {area_mesmo_quarto:.1f} m2')
log(f'  dos quais quarto diferente (Q muda tambem): {quarto_diferente} pares / {area_quarto_dif:.1f} m2')
log('top 10 costuras de quarto (setor, (quarto_a,quarto_b)) por area somada:')
for pq, ar in sorted(area_por_par_quarto.items(), key=lambda kv: -kv[1])[:10]:
    log(f'  setor={pq[0]} quartos={pq[1]}: {por_par_quarto[pq]} pares, {ar:.1f} m2')
log(f'por setor (contagem de participacoes): {dict(sorted(por_setor.items()))}')
log(f'por setor (area somada, m2, um par soma nos dois setores se for cruzado): '
    f'{ {k: round(v,1) for k,v in sorted(area_por_setor.items())} }')
log(f'por par de setor (contagem): {dict(sorted(por_par_setor.items()))}')
log(f'por par de setor (area somada, m2): '
    f'{ {k: round(v,1) for k,v in sorted(area_por_par_setor.items())} }')
log('10 piores pares:')
for i, j, ar in piores10:
    log(f'  {lot_id[i]} x {lot_id[j]}  area={ar:.2f} m2  '
        f'mesmo_quarteirao={qkey[i]==qkey[j]}  setores=({setor[i]},{setor[j]})')


# ===========================================================================
# (B1) CANTO ALEM DE raioBorda / raioSitio
# ===========================================================================
log('(B1) canto alem de raioBorda/raioSitio...')
alem_borda = [i for i in range(N) if CANTO_MAX[i] > RAIO_BORDA]
alem_sitio = [i for i in range(N) if CANTO_MAX[i] > RAIO_SITIO]
por_setor_borda = collections.Counter(setor[i] for i in alem_borda)
por_setor_sitio = collections.Counter(setor[i] for i in alem_sitio)
maior_canto = max(range(N), key=lambda i: CANTO_MAX[i])

log(f'lotes com canto > raioBorda ({RAIO_BORDA} m): {len(alem_borda)}; por setor: {dict(por_setor_borda)}')
log(f'lotes com canto > raioSitio ({RAIO_SITIO} m): {len(alem_sitio)}; por setor: {dict(por_setor_sitio)}')
log(f'maior canto de toda a cidade: {CANTO_MAX[maior_canto]:.1f} m em {lot_id[maior_canto]} '
    f'(raio_m do centro = {raio_m[maior_canto]:.1f})')
if alem_borda:
    ex = sorted(alem_borda, key=lambda i: -CANTO_MAX[i])[:10]
    for i in ex:
        log(f'  ex: {lot_id[i]} canto_max={CANTO_MAX[i]:.1f} x={x[i]} z={z[i]}')


# ===========================================================================
# (B2) "retangulo que sai da borda": faixas de rumo de 5 graus
# ===========================================================================
# rumo de bussola: 0 = norte (-z), cresce para leste (+x) -- convencao
# documentada em scripts/gerar_cidade.py:6424 e scripts/city/carta.mjs:80/84
# ("x cresce para leste e z para o sul"). Logo: SUL = +z, NORTE = -z,
# LESTE = +x, OESTE = -x. Sudoeste fica entre 180 (sul) e 270 (oeste), perto
# de rumo 225.
def rumo_bussola(px, pz):
    return math.degrees(math.atan2(px, -pz)) % 360.0


log('(B2) faixas de rumo de 5 graus...')
NFAIXAS = 72  # 360/5
faixa_max = [0.0] * NFAIXAS
faixa_dono = [None] * NFAIXAS  # lot_id que alcanca o maximo
faixa_n_lotes = [0] * NFAIXAS
for i in range(N):
    f = int(rumo_bussola(x[i], z[i]) // 5) % NFAIXAS
    faixa_n_lotes[f] += 1
    if CANTO_MAX[i] > faixa_max[f]:
        faixa_max[f] = CANTO_MAX[i]
        faixa_dono[f] = lot_id[i]

JANELA = 3  # +-3 faixas = +-15 graus de vizinhanca, excluindo a propria faixa
anomalas = []
for f in range(NFAIXAS):
    viz = [faixa_max[(f + d) % NFAIXAS] for d in range(-JANELA, JANELA + 1) if d != 0]
    viz_sorted = sorted(viz)
    mediana_viz = viz_sorted[len(viz_sorted) // 2] if len(viz_sorted) % 2 == 1 else \
        (viz_sorted[len(viz_sorted)//2 - 1] + viz_sorted[len(viz_sorted)//2]) / 2
    delta = faixa_max[f] - mediana_viz
    if delta > 300.0:
        anomalas.append((f, faixa_max[f], mediana_viz, delta, faixa_dono[f], faixa_n_lotes[f]))

log(f'faixa_max minimo/maximo entre as 72 faixas de 5 graus: '
    f'{min(faixa_max):.1f} .. {max(faixa_max):.1f} m')
log(f'faixas com raio maximo > mediana das vizinhas + 300 m: {len(anomalas)}')
for f, mx, med, delta, dono, nl in anomalas:
    rumo_ini = f * 5
    log(f'  faixa rumo [{rumo_ini}-{rumo_ini+5})°: max={mx:.1f} m, mediana_vizinhas={med:.1f} m, '
        f'delta={delta:.1f} m, dono={dono}, {nl} lotes na faixa')
if not anomalas:
    log('  nenhuma faixa de rumo se destaca por > 300 m da mediana das vizinhas: '
        'a geometria dos LOTES no CSV selado nao tem bloco retangular saindo da borda circular.')


# ===========================================================================
# (C) GIRO x RUMO DO PROPRIO CENTRO
# ===========================================================================
# Mesma convencao do proprio campo giro_graus (nao a de bussola): angulo
# matematico no plano x-z, positivo de +x para +z, ang = atan2(z, x) em graus
# (scripts/gerar_cidade.py:6424: "giro em graus, positivo de +x para +z").
# Um lote radial fica alinhado ao raio (giro == ang, mod 180, testada
# perpendicular ao raio ou testada ao longo do raio conforme o desenho) OU
# perpendicular a ele (giro == ang +/- 90). Reduzir a diferenca mod 90 e
# pegar a distancia ao multiplo de 90 mais proximo cobre as DUAS
# possibilidades ao mesmo tempo.
log('(C) giro_graus contra atan2(z, x)...')
desvios = [0.0] * N
for i in range(N):
    if x[i] == 0.0 and z[i] == 0.0:
        desvios[i] = 0.0
        continue
    ang = math.degrees(math.atan2(z[i], x[i])) % 360.0
    diff = (giro[i] - ang) % 90.0
    desvios[i] = min(diff, 90.0 - diff)

desvios_sorted = sorted(desvios)


def percentil(p):
    k = int(len(desvios_sorted) * p)
    k = min(k, len(desvios_sorted) - 1)
    return desvios_sorted[k]


log(f'distribuicao do desvio angular (graus): '
    f'mediana={percentil(0.50):.3f} p90={percentil(0.90):.3f} p99={percentil(0.99):.3f} '
    f'max={desvios_sorted[-1]:.3f}')

LIMIAR = 5.0
fora = [i for i in range(N) if desvios[i] > LIMIAR]
por_setor_giro = collections.Counter(setor[i] for i in fora)
log(f'lotes com desvio > {LIMIAR} graus: {len(fora)} de {N} ({100*len(fora)/N:.2f}%)')
log(f'por setor: {dict(sorted(por_setor_giro.items()))}')

# checar se os "fora" formam cunha continua por rumo de bussola (bins de 10 graus)
BINW = 10
nbins = 360 // BINW
bin_total = [0] * nbins
bin_fora = [0] * nbins
for i in range(N):
    b = int(rumo_bussola(x[i], z[i]) // BINW) % nbins
    bin_total[b] += 1
    if desvios[i] > LIMIAR:
        bin_fora[b] += 1

log('faixas de rumo de bussola (10 graus) com fracao de desvio > 5 graus acima de 20%:')
cunha = []
for b in range(nbins):
    if bin_total[b] == 0:
        continue
    frac = bin_fora[b] / bin_total[b]
    if frac > 0.20 and bin_fora[b] >= 5:
        cunha.append((b * BINW, frac, bin_fora[b], bin_total[b]))
for rumo_ini, frac, nf, nt in cunha:
    log(f'  rumo [{rumo_ini}-{rumo_ini+BINW})°: {nf}/{nt} lotes desviam > {LIMIAR}° ({100*frac:.1f}%)')
if not cunha:
    log('  nenhuma faixa de bussola de 10 graus passa de 20% de lotes desviantes.')

# maiores desvios, para exemplos concretos
piores_giro = sorted(range(N), key=lambda i: -desvios[i])[:10]
log('10 piores desvios giro x rumo:')
for i in piores_giro:
    log(f'  {lot_id[i]} setor={setor[i]} x={x[i]} z={z[i]} giro={giro[i]:.2f} '
        f'ang_centro={math.degrees(math.atan2(z[i], x[i]))%360:.2f} desvio={desvios[i]:.2f}')

log('FIM.')
