#!/usr/bin/env python3
"""
A FORMA DA DOGCITY: filotaxia de ângulo áureo sobre o relevo real da Lua.

Por que ângulo áureo e não anel: o fundador travou duas regras que brigam entre
si, "mais antigo, mais perto da praça" e "não pode virar anel concêntrico".
O ângulo áureo (137,50776°) é a única família de arranjos que satisfaz as duas ao
mesmo tempo, e é o mesmo empacotamento do girassol, da pinha e da concha. Cada
carteira n vai para o ângulo n × 137,50776° e para o raio proporcional a √n, o
que dá densidade constante: a idade vira distância sem nunca fechar um anel nem
alinhar um raio.

Entrada:  data/holders_by_age.csv  +  public/lunar/btc-core-heightmap.f32
Saída:    public/city/forma-filotaxia.bin  (int16 x, int16 z, uint8 coorte)
          public/city/forma-filotaxia.json (metadados)
"""
import csv, json, math, struct, sys, os

# ⚠️ OS LOBOS EXISTEM POR UM DEFEITO MEDIDO, e não por gosto. Com raio função
# pura do posto (LOBOS = 0), o empacotamento não faz anel nenhum, mas a IDADE
# faz: cada coorte ocupa uma coroa circular limpa. Como prédio comum tem padrão
# por bairro (regra 5 do fundador), a cidade subiria anelada, que é justamente
# o que a regra 3 proíbe. Modular o raio por uma função do ângulo resolve: a
# mesma idade passa a cair a distâncias diferentes conforme o rumo, e a coroa
# vira pétala. Números de lobos: 5 e 8 são de Fibonacci, que é o pedido estético
# do fundador (concha, pinha, fractal).
LOBOS = int(sys.argv[1]) if len(sys.argv) > 1 else 0
AMP = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
SUFIXO = '' if LOBOS == 0 else f'-{LOBOS}lobos'

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def p(*a): return os.path.join(RAIZ, *a)

PHI = math.pi * (3 - math.sqrt(5))          # ângulo áureo em radianos = 137,50776°
CORTE_DOG = 20_000
R_INTERNO = 960                              # o loteamento não começa antes disto
R_SITIO = 3500
DECLIVE_MAX = 3.0                            # premissa fechada com o fundador
PLATO_R, PLATO_FUNDE = 960, 1300
PARQUE_RUMO, PARQUE_DIST, PARQUE_DISCO = 43.0, 5200.0, 3600.0
SPACEPORT = (-140.0, 3090.0, 845.0, 599.0)   # x, z, largura, profundidade
GUERRA = (-2120.0, 2120.0, 760.0, 364.0)

# ── o relevo ───────────────────────────────────────────────────────────────
meta = json.load(open(p('public/lunar/btc-core-heightmap.json')))
n, cell = meta['cols'], meta['cellSizeM']
half = (n - 1) / 2
with open(p('public/lunar/btc-core-heightmap.f32'), 'rb') as f:
    alt = list(struct.unpack(f'<{n*n}f', f.read(n * n * 4)))

def H(i, j):
    return alt[min(n-1, max(0, j)) * n + min(n-1, max(0, i))]

def crua(x, z):
    fi = min(n - 1.001, max(0, x / cell + half))
    fj = min(n - 1.001, max(0, z / cell + half))
    i, j = int(fi), int(fj)
    u, v = fi - i, fj - j
    return (H(i,j)*(1-u)*(1-v) + H(i+1,j)*u*(1-v) + H(i,j+1)*(1-u)*v + H(i+1,j+1)*u*v)

def altura(x, z):
    # exagero 1 dentro da cidade (app/city/plaza/vex.ts) e o platô achatado
    bruto = crua(x, z)
    r = math.hypot(x, z)
    if r >= PLATO_FUNDE: return bruto
    if r <= PLATO_R: return 0.0
    t = (r - PLATO_R) / (PLATO_FUNDE - PLATO_R)
    return bruto * (t * t * (3 - 2 * t))

# campo de declive uma vez por célula, na resolução do dado, e depois interpolado.
# Medir mais fino que 59,2 m inventa detalhe que o dado da NASA não tem.
grade = [0.0] * (n * n)
for j in range(n):
    for i in range(n):
        x, z = (i - half) * cell, (j - half) * cell
        hx = (altura(x + cell, z) - altura(x - cell, z)) / (2 * cell)
        hz = (altura(x, z + cell) - altura(x, z - cell)) / (2 * cell)
        grade[j*n+i] = math.degrees(math.atan(math.hypot(hx, hz)))

def declive(x, z):
    fi = min(n - 1.001, max(0, x / cell + half))
    fj = min(n - 1.001, max(0, z / cell + half))
    i, j = int(fi), int(fj)
    u, v = fi - i, fj - j
    G = lambda a, b: grade[min(n-1, b) * n + min(n-1, a)]
    return (G(i,j)*(1-u)*(1-v) + G(i+1,j)*u*(1-v) + G(i,j+1)*(1-u)*v + G(i+1,j+1)*u*v)

# ── as exclusões ───────────────────────────────────────────────────────────
prad = math.radians(PARQUE_RUMO)
PCX, PCZ = math.sin(prad) * PARQUE_DIST, -math.cos(prad) * PARQUE_DIST

def livre(x, z):
    r = math.hypot(x, z)
    if r < R_INTERNO: return False
    if math.hypot(x - PCX, z - PCZ) < PARQUE_DISCO: return False
    for cx, cz, w, d in (SPACEPORT, GUERRA):
        if abs(x - cx) < w / 2 and abs(z - cz) < d / 2: return False
    return declive(x, z) <= DECLIVE_MAX

# ── as carteiras, do UTXO mais antigo para o mais novo ─────────────────────
carteiras = []
with open(p('data/holders_by_age.csv'), newline='') as f:
    for row in csv.DictReader(f):
        try:
            dog = float(row['total_dog']); idade = float(row['oldest_age_days'])
        except (ValueError, KeyError):
            continue
        if dog >= CORTE_DOG:
            carteiras.append((idade, row['address'], dog))
# desempate determinístico pelo endereço: sem isso duas rodadas do scanner dão
# cidades diferentes (defeito já apontado em scripts/foundation_generator.ts:125)
carteiras.sort(key=lambda c: (-c[0], c[1]))
N = len(carteiras)
print(f'carteiras com >= {CORTE_DOG:,} DOG: {N:,}', file=sys.stderr)

# ── a espiral ──────────────────────────────────────────────────────────────
# ⚠️ A FÓRMULA CERTA é r(k) = √(R₀² + k·a/π), e não um passo vezes √k. Ela dá
# densidade areal CONSTANTE a partir de um furo central de raio R₀: a área do
# anel entre duas sementes consecutivas é sempre `a`. Com o passo arbitrário que
# usei antes, a espiral apertava perto do centro, estourava o raio do sítio e
# só colocava 28.350 das 52.999.
#
# `a` é a área bruta por carteira: o lote MAIS a parte dela na via. Sai direto da
# regra 50/50: metade do sítio dividida pelo número de carteiras.
A_BRUTA = 19.242e6                    # a metade dos holders, com via
a_por_carteira = A_BRUTA / N
print(f'área bruta por carteira: {a_por_carteira:.1f} m²', file=sys.stderr)

# mede quanta terra o anel realmente oferece, amostrando de 8 em 8 metros
amostra, disp = 0, 0
passo_am = 8
b_ = -R_SITIO
while b_ < R_SITIO:
    c_ = -R_SITIO
    while c_ < R_SITIO:
        if math.hypot(b_, c_) <= R_SITIO:
            amostra += 1
            if livre(b_, c_): disp += 1
        c_ += passo_am
    b_ += passo_am
area_disp = disp * passo_am * passo_am / 1e6
print(f'terra disponível no anel (livre, <= {DECLIVE_MAX}°): {area_disp:.3f} km²', file=sys.stderr)
print(f'a metade dos holders precisa de: {A_BRUTA/1e6:.3f} km²', file=sys.stderr)

pts, k, rejeitadas = [], 0, 0
LIMITE = N * 40
while len(pts) < N and k < LIMITE:
    k += 1
    ang = k * PHI
    r = math.sqrt(R_INTERNO**2 + k * a_por_carteira / math.pi)
    if LOBOS:
        # normaliza pela média de m² para a área total não mudar com a amplitude
        m = 1 + AMP * math.sin(LOBOS * ang)
        r *= m / math.sqrt(1 + AMP * AMP / 2)
    x, z = math.sin(ang) * r, -math.cos(ang) * r
    if livre(x, z):
        pts.append((x, z))
    else:
        rejeitadas += 1

raio_final = math.hypot(*pts[-1]) if pts else 0
print(f'colocadas {len(pts):,} de {N:,} | rejeitadas {rejeitadas:,} | RAIO FINAL {raio_final:.0f} m', file=sys.stderr)
if raio_final > R_SITIO:
    print(f'  >>> o sítio precisa crescer de {R_SITIO} m para {math.ceil(raio_final/50)*50} m', file=sys.stderr)

# ── grava ──────────────────────────────────────────────────────────────────
COORTES = 8
buf = bytearray()
for idx, (x, z) in enumerate(pts):
    coorte = min(COORTES - 1, idx * COORTES // max(1, len(pts)))
    buf += struct.pack('<hhB', int(round(x)), int(round(z)), coorte)
open(p(f'public/city/forma-filotaxia{SUFIXO}.bin'), 'wb').write(buf)
idades = [c[0] for c in carteiras[:len(pts)]]
json.dump({
    'esquema': 'int16 x, int16 z, uint8 coorte',
    'anguloAureoGraus': math.degrees(PHI),
    'colocados': len(pts), 'candidatas': N, 'rejeitadas': rejeitadas,
    'raioInterno': R_INTERNO, 'raioFinal': round(math.hypot(*pts[-1])),
    'declive_max': DECLIVE_MAX, 'coortes': COORTES,
    'idadeMaisVelha': round(max(idades), 2), 'idadeMaisNova': round(min(idades), 2),
    'lobos': LOBOS, 'amplitude': AMP,
    'areaBrutaPorCarteira_m2': round(a_por_carteira, 1),
    'areaDisponivel_km2': round(area_disp, 3),
    'areaNecessaria_km2': round(A_BRUTA / 1e6, 3),
}, open(p(f'public/city/forma-filotaxia{SUFIXO}.json'), 'w'), indent=1)
print(f'gravado forma-filotaxia{SUFIXO}.{{bin,json}}', file=sys.stderr)
