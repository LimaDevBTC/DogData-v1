#!/usr/bin/env python3
"""A TEIA: o tecido como rede radial-concêntrica, desenhado em planta.

⚠️ ISTO SUBSTITUI A MALHA POR DISTRITO, E O MOTIVO É CONECTIVIDADE. A versão
anterior dava a cada distrito uma malha cartesiana OBLÍQUA ao anel (34 a 46° fora
da tangente). Aquilo matou a leitura de alvo, mas cobrou um preço pior, e o
fundador viu na chapa: a rua de um feixe do leque não encontra a rua do feixe
vizinho. Seis ilhas encostadas, não uma cidade.

Numa teia toda rua é contínua por construção:
  ANEL  = curva de nível de φ, dá a volta inteira na cidade
  RAIO  = vai do centro à borda, e quando o vão entre dois raios fica largo
          demais NASCE UM RAIO NOVO entre eles, que segue até a borda
Nenhum trecho morre, e é isso que o desenho do fundador mostra.

⚠️ E A TEIA NÃO É REDONDA. Os anéis são curvas de nível da superelipse, então são
retângulos arredondados encaixados, não círculos. É o que separa "teia de cidade"
de "alvo de tiro".

uso: python3 scripts/proto_teia.py saida.png [--px 1600]
"""
import math, sys
from PIL import Image, ImageDraw

saida = sys.argv[1] if len(sys.argv) > 1 else 'teia.png'
PX = int(sys.argv[sys.argv.index('--px')+1]) if '--px' in sys.argv else 1600

R_INI, PHI_BORDA = 1450.0, 4400.0
FORMA_N, FORMA_AX, FORMA_AZ = 3.0, 0.9923, 0.8931
FORMA_ROT, FORMA_HARM = math.radians(-18.0), 0.030

def phi(x, z):
    r = math.hypot(x, z)
    c, sn = math.cos(FORMA_ROT), math.sin(FORMA_ROT)
    lx, lz = x*c + z*sn, -x*sn + z*c
    q = (abs(lx/FORMA_AX)**FORMA_N + abs(lz/FORMA_AZ)**FORMA_N) ** (1.0/FORMA_N)
    q *= (1.0 - FORMA_HARM*math.cos(3*math.atan2(z, x) - 0.7))
    w = min(1.0, max(0.0, (r - R_INI) / (PHI_BORDA - R_INI)))
    return r*(1 - w*w*(3-2*w)) + q*(w*w*(3-2*w))

def raio_em(ang, alvo):
    lo, hi = 200.0, 14000.0
    for _ in range(40):
        m = (lo+hi)/2
        if phi(math.sin(ang)*m, -math.cos(ang)*m) < alvo: lo = m
        else: hi = m
    return (lo+hi)/2

def P(ang, p):
    r = raio_em(ang, p)
    return (math.sin(ang)*r, -math.cos(ang)*r)

# ── OS ANÉIS: o grão muda com o raio, e o passo sai da regra da rua ─────────
# Quarteirão = k faixas de 50 m + (k-1) travessas de 9 m. Só existem 109, 168,
# 227: é a família que mantém "toda fileira dá frente para rua".
def lado(k): return k*50.0 + (k-1)*9.0
BANDAS = [(R_INI, 2180.0, 2), (2180.0, 3010.0, 3), (3010.0, PHI_BORDA, 4)]
VIA, ANEL_LARGO, AV = 12.0, 26.0, 44.0

aneis = []                      # (phi0, phi1, k)
for p0, p1, k in BANDAS:
    passo = lado(k) + VIA
    p = p0
    while p + passo <= p1 + 1:
        aneis.append((p, p + passo, k)); p += passo
    if p1 - p > lado(2) * 0.6: aneis.append((p, p1, k))

# ── OS RAIOS: nascem entre os existentes e NUNCA morrem ────────────────────
# ⚠️ É AQUI QUE A TEIA SE FAZ. Um raio novo não substitui os vizinhos: entra
# ENTRE eles e segue até a borda. Assim o vão entre raios fica mais ou menos
# constante em toda a cidade (a testada do quarteirão não explode na periferia)
# e nenhum trecho de rua termina no nada.
N0 = 96                          # 3,75° cada: contém 0, 90, 180 e 270 exatos
FRENTE_ALVO = 150.0
def n_raios(p):
    # ⚠️ O LIMIAR ESTAVA FROUXO E NÃO DOBRAVA NUNCA: com 1,6x a testada só passava
    # de 240 m depois da borda, então o quarteirão ia de 95 m no miolo a 288 m na
    # periferia e a teia perdia a razão de existir. Com 1,25x ele dobra por volta
    # de r 2.900 e a testada fica entre 95 e 150 m na cidade inteira.
    n = N0
    while (2*math.pi*p)/n > FRENTE_ALVO * 1.25: n *= 2
    return n

# hierarquia: a via não pode ser toda igual, senão o mapa não tem leitura
PONTES = {0.0, 90.0, 180.0, 270.0}
COSTURAS = {60.0, 108.75, 187.5, 240.0, 307.5}
def larg_raio(ang_g):
    a = round(ang_g % 360, 2)
    if a in PONTES: return 34.0
    if a in COSTURAS: return AV
    if abs((a / 3.75) % 8) < 1e-6: return 20.0      # coletor a cada 8 raios
    return VIA

# ⚠️ SEM AS MÁSCARAS A TEIA LÊ COMO DIAGRAMA, e o fundador já disse duas vezes
# que quer cidade e não desenho. O que quebra a regularidade não é ruído: são as
# coisas que existem por motivo próprio e não pedem licença à malha. Parque,
# diagonal e as 51 peças do programa cortam a teia e é disso que sai a quadra em
# cunha, a esquina torta e o quarteirão pela metade que fazem mapa parecer real.
import json, os
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    _PG = json.load(open(os.path.join(RAIZ, 'data', 'dogcity_programa_congelado.json')))
except FileNotFoundError:
    _PG = []
PECAS = []
for q in _PG:
    rr = math.radians(q['rot'])
    PECAS.append((q['cx'], q['cz'], q['a'], q['b'], math.cos(rr), math.sin(rr),
                  q['forma'] != 'elipse', q['a']**2 + q['b']**2))
def em_peca(x, z):
    for cx, cz, a, b, ca, sa, ret, r2 in PECAS:
        dx, dz = x-cx, z-cz
        if dx*dx + dz*dz > r2: continue
        lx, lz = dx*ca + dz*sa, -dx*sa + dz*ca
        if ret:
            if abs(lx) <= a and abs(lz) <= b: return True
        elif (lx/a)**2 + (lz/b)**2 <= 1: return True
    return False

PARQUES = [(34.,2020.,300.,190.), (78.,3180.,210.,340.), (127.,2440.,260.,175.),
           (166.,3420.,175.,300.), (214.,1960.,240.,160.), (262.,3020.,330.,210.),
           (296.,2300.,190.,260.), (338.,3480.,260.,200.)]
_PQ = []
for ru, d, a, b in PARQUES:
    g = math.radians(ru); r = raio_em(g, d)
    _PQ.append((math.sin(g)*r, -math.cos(g)*r, a, b, math.cos(g), math.sin(g)))
def em_parque(x, z):
    for cx, cz, a, b, ca, sa in _PQ:
        dx, dz = x-cx, z-cz
        lx, lz = dx*ca + dz*sa, -dx*sa + dz*ca
        if (lx/a)**2 + (lz/b)**2 <= 1: return True
    return False

DIAGONAIS = [(24.0, 1750.0), (99.0, -2050.0), (158.0, 1500.0)]
def em_diagonal(x, z):
    for ru, off in DIAGONAIS:
        a = math.radians(ru)
        if abs(x*math.cos(a) + z*math.sin(a) - off) < 22.0: return True
    return False

def vivo(x, z):
    return not (em_peca(x, z) or em_parque(x, z) or em_diagonal(x, z))

esc = PX / (2 * PHI_BORDA * 1.16)
im = Image.new('RGB', (PX, PX), (14, 14, 16)); dr = ImageDraw.Draw(im)
tela = lambda x, z: (x*esc + PX/2, z*esc + PX/2)

quadras = 0
for ia, (p0, p1, k) in enumerate(aneis):
    pm = (p0 + p1) / 2
    n = n_raios(pm)
    largA = ANEL_LARGO if ia % 4 == 3 else VIA
    tom = 206 - k*18 - (ia % 3)*5
    for j in range(n):
        a0 = (j / n) * 2*math.pi
        a1 = ((j+1) / n) * 2*math.pi
        # recua metade da via de cada lado: a rua é o vão entre as quadras
        rm = raio_em((a0+a1)/2, pm)
        l0 = larg_raio(math.degrees(a0)) / 2 / rm
        l1 = larg_raio(math.degrees(a1)) / 2 / rm
        b0, b1 = a0 + l0, a1 - l1
        if b1 <= b0: continue
        q0, q1 = p0 + largA/2, p1 - VIA/2
        pts = []
        for aa in (b0, b1): pts.append(P(aa, q0))
        for aa in (b1, b0): pts.append(P(aa, q1))
        # ⚠️ A QUADRA ENTRA POR PEDAÇO: 9 sondas dizem quanto dela vive. Quadra
        # inteira ou nada devolveria buraco retangular onde devia haver meia
        # quadra encostando no parque.
        viva = 0
        for ta in (0.15, 0.5, 0.85):
            for tp in (0.15, 0.5, 0.85):
                aa = b0 + (b1-b0)*ta
                pp = q0 + (q1-q0)*tp
                if vivo(*P(aa, pp)): viva += 1
        if viva == 0: continue
        c = (tom, tom-6, tom-16) if viva == 9 else (tom-34, tom-36, tom-42)
        dr.polygon([tela(*p) for p in pts], fill=c, outline=(28,28,31))
        quadras += 1

for cx, cz, a, b, ca, sa in _PQ:
    dr.polygon([tela(cx + math.cos(2*math.pi*i/40)*a*ca - math.sin(2*math.pi*i/40)*b*sa,
                     cz + math.cos(2*math.pi*i/40)*a*sa + math.sin(2*math.pi*i/40)*b*ca)
                for i in range(40)], fill=(54, 76, 54))
for cx, cz, a, b, ca, sa, ret, _ in PECAS:
    cantos = [(-a,-b),(a,-b),(a,b),(-a,b)] if ret else \
             [(math.cos(2*math.pi*i/36)*a, math.sin(2*math.pi*i/36)*b) for i in range(36)]
    dr.polygon([tela(cx + lx*ca - lz*sa, cz + lx*sa + lz*ca) for lx, lz in cantos],
               fill=(58, 62, 66))
im.save(saida)
print(f'{quadras:,} quadras | {len(aneis)} aneis | raios {N0} a {n_raios(PHI_BORDA)} -> {saida}')
