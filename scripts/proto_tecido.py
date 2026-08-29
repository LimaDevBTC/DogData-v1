#!/usr/bin/env python3
"""Protótipo do tecido urbano, desenhado em planta, SEM tocar no gerador.

⚠️ ISTO É BANCADA, NÃO PIPELINE. Julgar tecido pela cena 3D custa minutos por
tentativa e o que se julga é textura vista de 9 km. Aqui se desenha só o
QUARTEIRÃO (o lote vem depois) e a volta é de segundos. Quando a planta
convencer, o esquema vai para `tecido()` em gerar_cidade.py.

uso: python3 scripts/proto_tecido.py saida.png [--px 1500]
"""
import math, sys
from PIL import Image, ImageDraw

saida = sys.argv[1] if len(sys.argv) > 1 else 'proto.png'
PX = int(sys.argv[sys.argv.index('--px')+1]) if '--px' in sys.argv else 1500

R_INI, R_BORDA = 1450.0, 4400.0
VIA, ARCO, AVENIDA = 12.0, 26.0, 44.0

# ── AS BANDAS: O GRÃO MUDA COM O RAIO ────────────────────────────────────────
# ⚠️ É AQUI QUE MORAVA O "GENÉRICO". O tecido de hoje usa quarteirão de 168 m e
# fileira de 25 m de r 1.450 a r 4.500 SEM EXCEÇÃO: 53 mil lotes com a mesma
# textura. Barcelona tem 113 m, Manhattan tem 80 x 274. O que faz esses mapas
# lerem como projeto não é a regularidade, é o CONTRASTE de grão entre bairros.
BANDAS = [
    (R_INI,  2180.0, 'Orla',   112.0),
    (2180.0, 3010.0, 'Meio',   150.0),
    (3010.0, 3760.0, 'Bairro', 196.0),
]
R_CINTA = 3760.0        # da Cinta para fora o tecido deixa de ser cartesiano

# ── OS DISTRITOS SÃO DESIGUAIS, E ISSO É O PONTO ────────────────────────────
# ⚠️ SEIS DISTRITOS IGUAIS DERAM UMA MANDALA. Foi a primeira tentativa e ela
# reprovou na chapa: fatia igual + parque simétrico + banda concêntrica leem como
# floco de neve, que é tão carimbado quanto a grade que se queria consertar.
# Cidade nenhuma é simétrica porque cada bairro nasceu de um motivo diferente.
# Aqui os motivos existem e são reais: as QUATRO PONTES (rumos 0, 90, 180, 270)
# são as portas da cidade, e o Parque Runestone fica a nordeste, no rumo 43.
# Então os distritos têm aberturas diferentes, e a malha de cada um fica tangente
# ao anel no rumo do seu centro: toda rua ou aponta para a praça ou a contorna.
# O desvio dentro do distrito gera a quadra em cunha da divisa, que é o que faz
# mapa parecer desenhado por gente e não estampado.
DISTRITOS = [          # (rumo inicial, abertura, jitter do giro em graus)
    (  0.0,  62.0,  0.0),
    ( 62.0,  46.0, -7.0),     # o que olha para o Parque Runestone (rumo 43)
    (108.0,  78.0,  4.0),
    (186.0,  54.0, -3.0),
    (240.0,  68.0,  6.0),
    (308.0,  52.0, -5.0),
]
assert abs(sum(d[1] for d in DISTRITOS) - 360.0) < 1e-6

def distrito_de(x, z):
    ru = math.degrees(math.atan2(x, -z)) % 360
    for i, (a, ab, _) in enumerate(DISTRITOS):
        if a <= ru < a + ab: return i
    return len(DISTRITOS) - 1

def giro_do_distrito(d):
    a, ab, j = DISTRITOS[d]
    return math.radians(a + ab / 2 + j)

def banda_de(r):
    for i, (a, b, _, _) in enumerate(BANDAS):
        if a <= r < b: return i
    return -1

# ── PARQUES ESCOLHIDOS, NÃO SORTEADOS POR MALHA ─────────────────────────────
# ⚠️ O TECIDO DE HOJE ESVAZIA A CÉLULA DO MEIO DE CADA QUARTO 3x3: um buraco a
# cada 540 m em fileira perfeita. Na planta vira poá, e poá é o sinal mais forte
# de carimbo no mapa. Parque de cidade é POUCO, GRANDE e fica onde há motivo.
# Nenhum deles está no centro de um distrito, e nenhum tem par simétrico.
PARQUES = [   # (rumo, raio do centro, meio-eixo maior, meio-eixo menor)
    ( 34.0, 2020.0, 300.0, 190.0),
    ( 78.0, 3180.0, 210.0, 340.0),
    (127.0, 2440.0, 260.0, 175.0),
    (166.0, 3420.0, 175.0, 300.0),
    (214.0, 1960.0, 240.0, 160.0),
    (262.0, 3020.0, 330.0, 210.0),
    (296.0, 2300.0, 190.0, 260.0),
    (338.0, 3480.0, 260.0, 200.0),
]
_PQ = []
for ru, r, a, b in PARQUES:
    g = math.radians(ru)
    _PQ.append((math.sin(g) * r, -math.cos(g) * r, a, b, g))

def em_parque(x, z):
    for px_, pz_, a, b, g in _PQ:
        dx, dz = x - px_, z - pz_
        lx = dx * math.cos(g) + dz * math.sin(g)
        lz = -dx * math.sin(g) + dz * math.cos(g)
        if (lx/a)**2 + (lz/b)**2 < 1: return True
    return False

# ── AS DIAGONAIS: O QUE FAZ GRADE VIRAR PLANO ───────────────────────────────
# Broadway em Nova York, a Diagonal em Barcelona. Uma via que ignora a malha e
# atravessa a cidade inteira é o elemento mais barato para tirar mapa de grade do
# genérico: ela produz esquina em cunha em toda quadra que toca. O afastamento do
# centro é grande de propósito, senão a diagonal morre dentro do lago.
DIAGONAIS = [(24.0, 1750.0), (99.0, -2050.0), (158.0, 1500.0)]
def em_diagonal(x, z):
    for rumo, off in DIAGONAIS:
        a = math.radians(rumo)
        if abs(x * math.cos(a) + z * math.sin(a) - off) < AVENIDA / 2: return True
    return False

def livre(x, z, checar_banda=True):
    r = math.hypot(x, z)
    if r < R_INI or r > R_BORDA: return False
    if checar_banda:
        if banda_de(r) < 0: return False
        for a, b, _, _ in BANDAS:
            if abs(r - a) < ARCO / 2 or abs(r - b) < ARCO / 2: return False
    ru = math.degrees(math.atan2(x, -z)) % 360
    for a, _, _ in DISTRITOS:                       # a avenida na divisa de distrito
        dd = min(abs(ru - a), 360 - abs(ru - a))
        if math.radians(dd) * r < AVENIDA / 2: return False
    return not (em_parque(x, z) or em_diagonal(x, z))

esc = PX / (2 * R_BORDA * 1.04)
im = Image.new('RGB', (PX, PX), (14, 14, 16)); dr = ImageDraw.Draw(im)
tela = lambda x, z: (x * esc + PX/2, z * esc + PX/2)
quadras = 0

def pinta(pts, tom):
    dr.polygon([tela(*p) for p in pts], fill=tom, outline=(30, 30, 33))

# ── 1. o miolo cartesiano, por distrito e por banda ──────────────────────────
for ib, (r0, r1, nome, cel) in enumerate(BANDAS):
    lado = cel - VIA
    for d in range(len(DISTRITOS)):
        g = giro_do_distrito(d); ca, sa = math.cos(g), math.sin(g)
        alc = int(r1 / cel) + 2
        for iz in range(-alc, alc + 1):
            for ix in range(-alc, alc + 1):
                lx, lz = (ix + 0.5) * cel, (iz + 0.5) * cel
                wx, wz = lx*ca - lz*sa, lx*sa + lz*ca
                if not (r0 - cel < math.hypot(wx, wz) < r1 + cel): continue
                if distrito_de(wx, wz) != d: continue
                # ⚠️ A QUADRA ENTRA POR PEDAÇO. 4x4 amostras dizem quanto dela
                # vive, e é isso que a APARA no arco e na avenida em vez de deixar
                # a sobra serrilhada que o tecido de hoje deixa.
                viva = 0
                for jz in range(4):
                    for jx in range(4):
                        ox = (jx - 1.5)/3 * lado; oz = (jz - 1.5)/3 * lado
                        fx = wx + ox*ca - oz*sa; fz = wz + ox*sa + oz*ca
                        if livre(fx, fz) and distrito_de(fx, fz) == d: viva += 1
                if viva < 7: continue
                h = lado / 2
                pts = [(wx + sx*h*ca - sz*h*sa, wz + sx*h*sa + sz*h*ca)
                       for sx, sz in ((-1,-1), (1,-1), (1,1), (-1,1))]
                t = 198 - ib * 26
                pinta(pts, (t, t-6, t-16) if viva == 16 else (t-30, t-32, t-38))
                quadras += 1

# ── 2. A CINTA: da última banda para fora o tecido vira POLAR ───────────────
# ⚠️ ISTO CONSERTA A BORDA EM POLÍGONO. Malha cartesiana recortada num disco
# devolve um dodecágono serrilhado, que foi exatamente o defeito da primeira
# tentativa e é a queixa antiga do fundador sobre a borda. Aqui a quadra da faixa
# externa SEGUE O ARCO: a testada é tangente, a profundidade é radial, e a borda
# da cidade fecha em círculo porque a quadra é feita de círculo. De quebra é o
# contraste de textura do Eixample encostando na Ciutat Vella: o miolo é grade, a
# cinta é anel, e a divisa entre os dois se lê de 9 km.
PROF_CINTA = [150.0, 168.0, 186.0, 202.0]
r = R_CINTA
for k, prof in enumerate(PROF_CINTA):
    r1 = min(R_BORDA, r + prof)
    # a testada acompanha o raio para a quadra não virar cunha: mais longe, mais
    # quadras no anel
    alvo = 150.0 + k * 14
    n = max(24, int(round(2 * math.pi * ((r + r1)/2) / alvo)))
    for j in range(n):
        a0 = (j / n) * 2*math.pi + 0.13 * k        # cada anel gira um pouco:
        a1 = ((j + 1) / n) * 2*math.pi + 0.13 * k  # junta alinhada lê como tijolo
        folga = VIA / ((r + r1)/2)
        a0 += folga/2; a1 -= folga/2
        mx = math.sin((a0+a1)/2) * ((r + r1)/2); mz = -math.cos((a0+a1)/2) * ((r + r1)/2)
        if not livre(mx, mz, checar_banda=False): continue
        pts = []
        for aa in (a0, a1): pts.append((math.sin(aa)*(r+ARCO/2), -math.cos(aa)*(r+ARCO/2)))
        for aa in (a1, a0): pts.append((math.sin(aa)*r1, -math.cos(aa)*r1))
        pinta(pts, (120, 116, 108))
        quadras += 1
    r = r1

for px_, pz_, a, b, g in _PQ:
    n = 40
    pts = [(px_ + math.cos(2*math.pi*i/n)*a*math.cos(g) - math.sin(2*math.pi*i/n)*b*math.sin(g),
            pz_ + math.cos(2*math.pi*i/n)*a*math.sin(g) + math.sin(2*math.pi*i/n)*b*math.cos(g))
           for i in range(n)]
    dr.polygon([tela(*p) for p in pts], fill=(54, 76, 54))
dr.ellipse([*tela(-R_INI, -R_INI), *tela(R_INI, R_INI)], fill=(24, 42, 58))
im.save(saida)
print(f'{quadras:,} quadras | {len(DISTRITOS)} distritos desiguais | '
      f'bandas {[int(b[3]) for b in BANDAS]} m + cinta polar -> {saida}')
