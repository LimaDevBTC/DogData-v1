#!/usr/bin/env python3
"""
OS BAIRROS DA DOGCITY: Voronoi de ângulo áureo, e cada célula com a sua própria
arquitetura interna.

O fundador não quis uma forma para a cidade inteira. Ele quis um CATÁLOGO: cinco
pétalas, dez pétalas, árvore de Natal, fractal de gelo, cada bairro com o seu
desenho, e todos encaixados numa moldura genérica.

A moldura é Voronoi sobre sementes plantadas no ângulo áureo:
  · as sementes herdam a propriedade do girassol, então a idade vira distância da
    praça sem nunca formar anel nem raio;
  · as células de Voronoi ladrilham o plano SEM sobra e SEM vão, que é o encaixe
    que ele pediu;
  · as células saem todas diferentes e orgânicas, porque as sementes não estão
    numa grade;
  · e as FRONTEIRAS entre células são onde o verde e a circulação passam, o que
    resolve "tudo harmonicamente interligado por jardins e parques" de graça.

Dentro de cada célula, um dos oito padrões do catálogo.

Entrada:  data/holders_by_age.csv + public/lunar/btc-core-heightmap.f32
Saída:    public/city/bairros.json  (as células, com padrão, área e lotes)
          public/city/bairros-lotes.bin (int16 x, int16 z, uint16 bairro, uint8 coorte)
"""
import csv, json, math, struct, sys, os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def p(*a): return os.path.join(RAIZ, *a)

PHI = math.pi * (3 - math.sqrt(5))
CORTE_DOG = 20_000
R_INTERNO, R_SITIO = 960, 3500
DECLIVE_MAX = 3.0
PLATO_R, PLATO_FUNDE = 960, 1300
PARQUE_RUMO, PARQUE_DIST, PARQUE_DISCO = 43.0, 5200.0, 3600.0
SPACEPORT = (-140.0, 3090.0, 845.0, 599.0)
GUERRA = (-2120.0, 2120.0, 760.0, 364.0)

# ⚠️ 150 bairros não é chute: a superquadra de Barcelona tem 400 por 400 m, ou
# 0,16 km², e a terra livre do sítio é 23,5 km². Dá 147. Fica 150.
N_BAIRROS = 150
# ⚠️ A FRONTEIRA É O PARQUE. Cada célula recua 26 m da sua divisa, e essa faixa
# vira o corredor verde contínuo que liga a cidade inteira. Não é sobra: é o
# sistema de parques desenhado ao mesmo tempo que o loteamento.
RECUO_VERDE = 26.0

# ── relevo (mesmo método da prancha 1: gradiente na resolução do dado) ──────
meta = json.load(open(p('public/lunar/btc-core-heightmap.json')))
n, cell = meta['cols'], meta['cellSizeM']
half = (n - 1) / 2
with open(p('public/lunar/btc-core-heightmap.f32'), 'rb') as f:
    alt = list(struct.unpack(f'<{n*n}f', f.read(n*n*4)))
H = lambda i, j: alt[min(n-1, max(0, j))*n + min(n-1, max(0, i))]

def crua(x, z):
    fi = min(n-1.001, max(0, x/cell+half)); fj = min(n-1.001, max(0, z/cell+half))
    i, j = int(fi), int(fj); u, v = fi-i, fj-j
    return H(i,j)*(1-u)*(1-v) + H(i+1,j)*u*(1-v) + H(i,j+1)*(1-u)*v + H(i+1,j+1)*u*v

def altura(x, z):
    b = crua(x, z); r = math.hypot(x, z)
    if r >= PLATO_FUNDE: return b
    if r <= PLATO_R: return 0.0
    t = (r-PLATO_R)/(PLATO_FUNDE-PLATO_R)
    return b*(t*t*(3-2*t))

grade = [0.0]*(n*n)
for j in range(n):
    for i in range(n):
        x, z = (i-half)*cell, (j-half)*cell
        hx = (altura(x+cell,z)-altura(x-cell,z))/(2*cell)
        hz = (altura(x,z+cell)-altura(x,z-cell))/(2*cell)
        grade[j*n+i] = math.degrees(math.atan(math.hypot(hx,hz)))

def declive(x, z):
    fi = min(n-1.001, max(0, x/cell+half)); fj = min(n-1.001, max(0, z/cell+half))
    i, j = int(fi), int(fj); u, v = fi-i, fj-j
    G = lambda a,b: grade[min(n-1,b)*n+min(n-1,a)]
    return G(i,j)*(1-u)*(1-v)+G(i+1,j)*u*(1-v)+G(i,j+1)*(1-u)*v+G(i+1,j+1)*u*v

prad = math.radians(PARQUE_RUMO)
PCX, PCZ = math.sin(prad)*PARQUE_DIST, -math.cos(prad)*PARQUE_DIST

def livre(x, z):
    r = math.hypot(x, z)
    if r < R_INTERNO or r > R_SITIO: return False
    if math.hypot(x-PCX, z-PCZ) < PARQUE_DISCO: return False
    for cx, cz, w, d in (SPACEPORT, GUERRA):
        if abs(x-cx) < w/2 and abs(z-cz) < d/2: return False
    return declive(x, z) <= DECLIVE_MAX

# ── as sementes dos bairros, no ângulo áureo ───────────────────────────────
sementes, k = [], 0
while len(sementes) < N_BAIRROS and k < N_BAIRROS*60:
    k += 1
    r = math.sqrt(R_INTERNO**2 + k * (23.5e6/N_BAIRROS) / math.pi)
    if r > R_SITIO - 60: break
    ang = k*PHI
    x, z = math.sin(ang)*r, -math.cos(ang)*r
    if livre(x, z): sementes.append((x, z))
NB = len(sementes)
print(f'bairros plantados: {NB}', file=sys.stderr)

def bairro_de(x, z):
    melhor, dmin = -1, 1e18
    for i, (sx, sz) in enumerate(sementes):
        d = (x-sx)*(x-sx) + (z-sz)*(z-sz)
        if d < dmin: dmin, melhor = d, i
    return melhor, math.sqrt(dmin)

def na_borda(x, z, i, d):
    """True se o ponto está a menos de RECUO_VERDE da divisa com o vizinho."""
    sx, sz = sementes[i]
    for j, (ox, oz) in enumerate(sementes):
        if j == i: continue
        dj = math.hypot(x-ox, z-oz)
        if dj - d < RECUO_VERDE*2: return True
    return False

# ── área de cada célula, amostrando ────────────────────────────────────────
PASSO = 16
area = [0]*NB
verde = 0
xx = -R_SITIO
while xx < R_SITIO:
    zz = -R_SITIO
    while zz < R_SITIO:
        if livre(xx, zz):
            i, d = bairro_de(xx, zz)
            if na_borda(xx, zz, i, d): verde += 1
            else: area[i] += 1
        zz += PASSO
    xx += PASSO
a_cel = PASSO*PASSO
area_km = [a*a_cel/1e6 for a in area]
print(f'área loteável {sum(area_km):.3f} km² | corredor verde {verde*a_cel/1e6:.3f} km²', file=sys.stderr)

# ── as carteiras ───────────────────────────────────────────────────────────
carteiras = []
with open(p('data/holders_by_age.csv'), newline='') as f:
    for row in csv.DictReader(f):
        try: dog, idade = float(row['total_dog']), float(row['oldest_age_days'])
        except (ValueError, KeyError): continue
        if dog >= CORTE_DOG: carteiras.append((idade, row['address']))
carteiras.sort(key=lambda c: (-c[0], c[1]))
N = len(carteiras)
print(f'carteiras: {N:,}', file=sys.stderr)

# quantos lotes cada bairro comporta, proporcional à área
total_area = sum(area_km) or 1
lotes_de = [max(0, round(N * a / total_area)) for a in area_km]
# ajuste fino para fechar exatamente em N
while sum(lotes_de) > N: lotes_de[lotes_de.index(max(lotes_de))] -= 1
while sum(lotes_de) < N: lotes_de[lotes_de.index(min(lotes_de))] += 1

# ── o catálogo de arquiteturas ─────────────────────────────────────────────
# Cada bairro recebe um padrão. A ordem é embaralhada pelo ângulo áureo para que
# vizinhos quase nunca repitam o mesmo desenho.
PADROES = ['girassol', 'petala5', 'petala8', 'petala10', 'concha', 'gelo', 'pinheiro', 'grelha']

def pontos_do_padrao(nome, cx, cz, quantos, raio_max, rumo, esc=1.0):
    """
    Candidatos no sistema local do bairro, do centro para fora.
    `esc` aperta o desenho: 1,0 é a densidade nominal, 0,8 é 20% mais denso. O
    laço de plantio aumenta a densidade até a célula encher, porque rejeição por
    cratera, por divisa e pelo recuo verde come uma fatia que varia muito de um
    bairro para outro.
    """
    out = []
    a = math.pi * raio_max * raio_max / max(1, quantos) * esc   # área por lote
    passo = math.sqrt(a)
    TETO = quantos * 9
    if nome in ('girassol', 'petala5', 'petala8', 'petala10'):
        L = {'girassol': 0, 'petala5': 5, 'petala8': 8, 'petala10': 10}[nome]
        for t in range(1, TETO):
            ang = t * PHI
            r = math.sqrt(t * a / math.pi)
            if L:
                m = 1 + 0.26 * math.sin(L * ang)
                r *= m / math.sqrt(1 + 0.26 * 0.26 / 2)
            if r > raio_max * 1.75: break
            A = ang + rumo
            out.append((cx + math.sin(A) * r, cz - math.cos(A) * r))
    elif nome == 'concha':
        # o náutilo: cinco braços de espiral logarítmica, cada um com fileiras
        # transversais. É o crescimento gnomônico, a proporção que não muda de
        # forma conforme cresce.
        BRACOS = 5
        for b in range(BRACOS):
            fase = b * 2 * math.pi / BRACOS
            t = 0.0
            while t < 34:
                r = passo * 1.2 * math.exp(0.108 * t)
                if r > raio_max * 1.7: break
                for lado in range(-2, 3):
                    rr = r + lado * passo * 0.95
                    if rr < passo: continue
                    A = fase + t * 0.30 + rumo
                    out.append((cx + math.sin(A) * rr, cz - math.cos(A) * rr))
                t += 0.62
    elif nome == 'gelo':
        # o floco: seis eixos principais, ramos laterais em 60 graus, e ramos
        # dos ramos. Autossemelhança de verdade, que é o que "fractal" quer dizer.
        def ramo(x0, z0, dir_, comp, nivel):
            passos = max(2, int(comp / passo))
            for i in range(1, passos + 1):
                d = i * passo
                x, z = x0 + math.sin(dir_) * d, z0 - math.cos(dir_) * d
                out.append((x, z))
                if nivel < 2 and i % 3 == 0 and i > 2:
                    for lado in (-1, 1):
                        ramo(x, z, dir_ + lado * math.pi / 3, comp * 0.42, nivel + 1)
        for e in range(6):
            ramo(cx, cz, rumo + e * math.pi / 3, raio_max * 1.35, 0)
    elif nome == 'pinheiro':
        # a árvore de Natal: fileiras que alargam para a base, tronco embaixo
        alt_tot = raio_max * 2.0
        filas = max(3, int(alt_tot / (passo * 1.05)))
        for f in range(filas):
            frac = f / max(1, filas - 1)
            larg = frac * raio_max * 1.5
            quant = max(1, int(larg / passo))
            lz = -raio_max * 0.95 + f * (alt_tot / filas)
            for q in range(-quant, quant + 1):
                lx = q * passo
                if abs(lx) > larg / 2 + 1: continue
                r = math.hypot(lx, lz); A = math.atan2(lx, -lz) + rumo
                out.append((cx + math.sin(A) * r, cz - math.cos(A) * r))
    else:  # grelha: o contraponto clássico, Hipódamo e Vitrúvio
        lado = int(math.ceil(raio_max * 1.6 / passo))
        for iz in range(-lado, lado + 1):
            for ix in range(-lado, lado + 1):
                lx, lz = ix * passo, iz * passo
                r = math.hypot(lx, lz)
                if r > raio_max * 1.7: continue
                A = math.atan2(lx, -lz) + rumo
                out.append((cx + math.sin(A) * r, cz - math.cos(A) * r))
    return out[:TETO]

# ── planta cada bairro ─────────────────────────────────────────────────────
ordem = sorted(range(NB), key=lambda i: math.hypot(*sementes[i]))   # perto da praça primeiro
lotes, celulas, cursor = [], [], 0
for posto, i in enumerate(ordem):
    quantos = lotes_de[i]
    if quantos <= 0:
        celulas.append(None); continue
    sx, sz = sementes[i]
    padrao = PADROES[(posto*5) % len(PADROES)]
    raio_max = math.sqrt(area_km[i]*1e6/math.pi)
    rumo = (posto*PHI) % (2*math.pi)
    postos, usados = 0, set()
    for esc in (1.0, 0.82, 0.66, 0.52, 0.40, 0.30):
        if postos >= quantos: break
        for (x, z) in pontos_do_padrao(padrao, sx, sz, quantos, raio_max, rumo, esc):
            if postos >= quantos: break
            ch = (int(x / 7), int(z / 7))     # não empilha dois lotes no mesmo ponto
            if ch in usados: continue
            if not livre(x, z): continue
            j, d = bairro_de(x, z)
            if j != i: continue
            if na_borda(x, z, i, d): continue
            usados.add(ch); lotes.append((x, z, i)); postos += 1
    celulas.append({'id': i, 'x': round(sx,1), 'z': round(sz,1), 'padrao': padrao,
                    'area_km2': round(area_km[i],4), 'lotes_alvo': quantos,
                    'lotes_postos': postos, 'raio': round(math.hypot(sx,sz))})
    cursor += postos

print(f'lotes plantados: {cursor:,} de {N:,}  ({cursor/N*100:.1f}%)', file=sys.stderr)

# ── grava ──────────────────────────────────────────────────────────────────
buf = bytearray()
for idx, (x, z, b) in enumerate(lotes):
    coorte = min(7, idx*8//max(1, len(lotes)))
    buf += struct.pack('<hhHB', int(round(x)), int(round(z)), b, coorte)
open(p('public/city/bairros-lotes.bin'), 'wb').write(buf)
json.dump({
    'esquema': 'int16 x, int16 z, uint16 bairro, uint8 coorte',
    'bairros': NB, 'lotes': len(lotes), 'carteiras': N,
    'recuoVerde_m': RECUO_VERDE, 'declive_max': DECLIVE_MAX,
    'areaLoteavel_km2': round(sum(area_km),3),
    'areaVerde_km2': round(verde*a_cel/1e6,3),
    'padroes': PADROES,
    'celulas': [c for c in celulas if c],
}, open(p('public/city/bairros.json'), 'w'), indent=1)
print('gravado public/city/bairros.{json} + bairros-lotes.bin', file=sys.stderr)
