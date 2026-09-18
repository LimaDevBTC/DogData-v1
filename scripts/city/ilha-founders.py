#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# THE FOUNDERS ATOLL: chapa de estudo da ilha dos Founders na baía.
#
# Uso:  python3 scripts/city/ilha-founders.py --mascara=/tmp/baia --saida=ilha.png
#
# ⚠️ A ÁGUA VEM DA MÁSCARA MEDIDA, não de um desenho meu. `baia-sonda.ts` exporta
# a lâmina já cortada por `terrain.ts` (pódio, lago, canais); desenhar a baía
# "de memória" foi o erro que produziu as chapas amadoras de agosto.
#
# ⚠️ DOIS QUADROS, E ISSO NÃO É ENFEITE. A primeira versão desta chapa tinha um
# quadro só, na escala da baía: a ilha virava um selo de 90 px e o projeto dela
# não se lia. Detalhe e implantação são duas perguntas e pedem duas escalas.
#
# ⚠️ CHAPA DE APRESENTAÇÃO, não de diagnóstico: sem heatmap, sem cor de dado.
# Escala, norte, legenda, título e número de folha. A fonte é a do sistema; peça
# de MARCA usa a fonte local embutida, esta é peça de projeto.
# ═══════════════════════════════════════════════════════════════════════════
import json, math, sys
from PIL import Image, ImageDraw, ImageFont

def arg(k, d):
    for a in sys.argv[1:]:
        if a.startswith(f'--{k}='):
            return a.split('=', 1)[1]
    return d

DIR = arg('mascara', '/tmp/baia')
SAIDA = arg('saida', 'ilha-founders.png')

meta = json.load(open(f'{DIR}/mascara.json'))
masc = open(f'{DIR}/mascara.bin', 'rb').read()
N, CEL, X0, Z0 = meta['n'], meta['cel'], meta['x0'], meta['z0']

# ── a ilha ──────────────────────────────────────────────────────────────────
# ⚠️ O EIXO É O DA ALÇA, e não o do "ponto mais fundo" da baía. A folga máxima
# está no rumo 42 (1.210 m), mas o meio da orla nobre está no 51,3. Um objeto
# lido por 510 lotes fora do eixo deles vira acidente: 260 m de folga a menos
# compram o alinhamento.
RUMO = 51.3            # o meio da alça de terra (346 a 116,5)
RAIO_CENTRO = 5600     # onde a folga no eixo é máxima: 950 m medidos
R_EXT = 450            # raio circunscrito do dodecágono de terra
R_INT = 330            # a bacia interna
R_CASA = 70            # a ilhota central, a Casa do Clube
BOCA = 90              # largura de cada boca, nas duas pontas do eixo
PONTE = 14             # as duas passarelas, perpendiculares ao eixo
N_PAV = 10             # pavilhões: 12 faces menos as 2 que viram boca
PAV_W, PAV_H = 96, 54

A = math.radians(RUMO)
CX, CZ = math.sin(A) * RAIO_CENTRO, -math.cos(A) * RAIO_CENTRO

def poly_reg(cx, cz, r, lados, giro=0.0):
    return [(cx + math.sin(giro + 2 * math.pi * i / lados) * r,
             cz - math.cos(giro + 2 * math.pi * i / lados) * r) for i in range(lados)]

def area_poly(p):
    s = 0
    for i in range(len(p)):
        x1, z1 = p[i]; x2, z2 = p[(i + 1) % len(p)]
        s += x1 * z2 - x2 * z1
    return abs(s) / 2

# ⚠️ A BOCA E UM CANAL DE PAREDE RETA, nao um setor angular. Com parede radial a
# largura abriria de 38 m na bacia para 52 m na borda externa, que e o desenho
# "quase certo" que denuncia projeto feito no olho. As duas paredes sao paralelas
# ao eixo, afastadas BOCA/2 dele.
#
# ⚠️ E A FACE FICA NO EIXO, NAO O VERTICE. Com vertice no eixo (a primeira
# versao) a boca cortava a quina e os dois pavilhoes vizinhos sobravam a 9 m da
# parede do canal. Girando o dodecagono meia face, a boca corta o MEIO de duas
# faces opostas e sobram 10 faces inteiras, 5 de cada lado, simetricas no eixo.
UX, UZ = math.sin(A), -math.cos(A)            # eixo, para a orla nobre
PX, PZ = math.cos(A), math.sin(A)             # perpendicular
GIRO = A + math.pi / 12                       # meia face: face no eixo

terra = poly_reg(CX, CZ, R_EXT, 12, GIRO)
bacia = poly_reg(CX, CZ, R_INT, 72)
casa = poly_reg(CX, CZ, R_CASA, 12, GIRO)

def dodeca_r(th):
    k = ((th - GIRO) % (math.pi / 6)) - math.pi / 12
    return R_EXT * math.cos(math.pi / 12) / math.cos(k)

def ang(p):
    return math.atan2(p[0] - CX, -(p[1] - CZ))

def ponto(th, r):
    return (CX + math.sin(th) * r, CZ - math.cos(th) * r)

def parede(lado, sentido):
    """onde a parede da boca encontra a bacia e onde encontra a borda externa"""
    off = lado * BOCA / 2
    t0 = math.sqrt(max(1.0, R_INT * R_INT - (BOCA / 2) ** 2))
    p_in = (CX + UX * sentido * t0 + PX * off, CZ + UZ * sentido * t0 + PZ * off)
    lo, hi = t0, R_EXT * 1.5
    for _ in range(50):
        mid = (lo + hi) / 2
        x = CX + UX * sentido * mid + PX * off
        z = CZ + UZ * sentido * mid + PZ * off
        if math.hypot(x - CX, z - CZ) < dodeca_r(math.atan2(x - CX, -(z - CZ))):
            lo = mid
        else:
            hi = mid
    return p_in, (CX + UX * sentido * lo + PX * off, CZ + UZ * sentido * lo + PZ * off)

def volta(de, ate, sentido):
    """quanto se anda de `de` ate `ate` girando no sentido dado"""
    v = (ate - de) * sentido
    while v < 0:
        v += 2 * math.pi
    return v

def crescente(lado):
    """a meia-lua de terra entre as duas bocas, pelo lado `lado`"""
    i1, o1 = parede(lado, 1)
    i2, o2 = parede(lado, -1)
    sentido = 1 if lado > 0 else -1
    sa = volta(ang(o1), ang(o2), sentido)
    sb = volta(ang(i1), ang(i2), sentido)
    ext = [ponto(ang(o1) + sentido * sa * k / 160, dodeca_r(ang(o1) + sentido * sa * k / 160))
           for k in range(161)]
    inte = [ponto(ang(i2) - sentido * sb * k / 160, R_INT) for k in range(161)]
    return ext + inte

CRESCENTES = [crescente(1), crescente(-1)]
area_anel = sum(area_poly(c) for c in CRESCENTES)
area_bacia = area_poly(bacia) - area_poly(casa)

# ── a chapa ─────────────────────────────────────────────────────────────────
W, H = 2400, 1560
FUNDO = (13, 14, 16)
AGUA = (21, 31, 43)
AGUA_ESCURA = (16, 24, 34)
TERRA = (36, 38, 43)
TERRA_CLARA = (52, 54, 60)
LINHA = (96, 100, 108)
FRACO = (78, 82, 90)
TEXTO = (150, 154, 162)
CREME = (245, 233, 214)
LARANJA = (232, 102, 13)
LARANJA_FRACO = (146, 68, 16)

img = Image.new('RGB', (W, H), FUNDO)
d = ImageDraw.Draw(img, 'RGBA')

def fonte(sz, bold=False):
    for p in ['/usr/share/fonts/truetype/noto/NotoSansMono-%s.ttf' % ('Bold' if bold else 'Regular'),
              '/usr/share/fonts/truetype/dejavu/DejaVuSansMono%s.ttf' % ('-Bold' if bold else '')]:
        try:
            return ImageFont.truetype(p, sz)
        except OSError:
            continue
    return ImageFont.load_default()

FT = fonte(50, True); FB = fonte(28, True); F = fonte(18); FP = fonte(16); FM = fonte(14)

# ─────────────────────────────────────────────────────────────── QUADRO A ───
# o detalhe da ilha
AX, AZ, AE = 1580, 800, 1.12     # centro do quadro e px por metro
def pa(x, z):
    return (AX + (x - CX) * AE, AZ + (z - CZ) * AE)

def poli(fn, p, cor, larg=2, fill=None, fechado=True):
    pts = [fn(x, z) for x, z in p]
    if fill:
        d.polygon(pts, fill=fill)
    if cor:
        d.line(pts + ([pts[0]] if fechado else []), fill=cor, width=larg, joint='curve')

# a agua como QUADRO: o disco gigante da primeira versao sangrava para fora da
# area do desenho e lia como uma peca a mais
d.rectangle([880, 60, 2340, 1500], fill=AGUA)
d.rectangle([880, 60, 2340, 1500], outline=(40, 44, 50), width=1)

# a terra: dois crescentes, com a boca como vao de verdade
for c in CRESCENTES:
    poli(pa, c, LARANJA, 3, fill=TERRA)

# os 12 pavilhões e seus píeres
rm = (R_EXT * math.cos(math.pi / 12) + R_INT) / 2
FACES = [GIRO + math.pi / 12 + 2 * math.pi * i / 12 for i in range(12)]
FACES = [t for t in FACES if abs(((t - A + math.pi) % math.pi) - math.pi / 2) > 0.02]
for t in FACES:
    px0, pz0 = CX + math.sin(t) * rm, CZ - math.cos(t) * rm
    c, s = math.cos(t), math.sin(t)
    pav = [(px0 + s * dx + c * dz, pz0 - c * dx + s * dz)
           for dx, dz in [(-PAV_W / 2, -PAV_H / 2), (PAV_W / 2, -PAV_H / 2),
                          (PAV_W / 2, PAV_H / 2), (-PAV_W / 2, PAV_H / 2)]]
    poli(pa, pav, LARANJA_FRACO, 2, fill=TERRA_CLARA)
    ix, iz = CX + math.sin(t) * (R_INT - 2), CZ - math.cos(t) * (R_INT - 2)
    jx, jz = CX + math.sin(t) * (R_INT - 86), CZ - math.cos(t) * (R_INT - 86)
    d.line([pa(ix, iz), pa(jx, jz)], fill=(126, 116, 100), width=3)
    # a cabeça do píer
    hx, hz = CX + math.sin(t) * (R_INT - 86), CZ - math.cos(t) * (R_INT - 86)
    d.line([pa(hx + c * 18, hz + s * 18), pa(hx - c * 18, hz - s * 18)], fill=(126, 116, 100), width=3)

# as duas passarelas, PERPENDICULARES ao eixo: o canal corre no eixo e passa dos
# dois lados da Casa, então nenhuma ponte cruza a rota do barco
for s in (1, -1):
    t = A + s * math.pi / 2
    d.line([pa(CX + math.sin(t) * R_CASA, CZ - math.cos(t) * R_CASA),
            pa(CX + math.sin(t) * R_INT, CZ - math.cos(t) * R_INT)],
           fill=(206, 196, 178), width=max(2, int(PONTE * AE * 0.5)))

poli(pa, casa, CREME, 3, fill=(58, 51, 42))
fx, fz = pa(CX, CZ)
d.ellipse([fx - 9, fz - 9, fx + 9, fz + 9], fill=LARANJA)
d.ellipse([fx - 20, fz - 20, fx + 20, fz + 20], outline=LARANJA_FRACO, width=2)

# cotas do quadro A
def cota(x1, z1, x2, z2, txt, dy=-10):
    p1, p2 = pa(x1, z1), pa(x2, z2)
    d.line([p1, p2], fill=FRACO, width=1)
    for p in (p1, p2):
        d.ellipse([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], fill=FRACO)
    mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
    d.text((mx + 8, my + dy), txt, font=FM, fill=TEXTO)

tq = A + math.pi / 2 + 0.9
cota(CX, CZ, CX + math.sin(tq) * R_EXT, CZ - math.cos(tq) * R_EXT, 'R 450 m')
tq2 = A - math.pi / 2 + 0.2
cota(CX + math.sin(tq2) * R_INT, CZ - math.cos(tq2) * R_INT,
     CX + math.sin(tq2) * R_EXT, CZ - math.cos(tq2) * R_EXT, 'faixa 120 m', 4)

# rótulos do quadro A
def rot(fn, x, z, txt, cor=CREME, dx=0, dy=0, f=FP):
    p = fn(x, z)
    d.text((p[0] + dx, p[1] + dy), txt, font=f, fill=cor)

rot(pa, CX, CZ, 'A CASA', CREME, -30, -R_CASA * AE - 52)
rot(pa, CX, CZ, 'farol do Fundador', TEXTO, -66, -R_CASA * AE - 30)
tp = GIRO + math.pi / 12 + 2 * math.pi * 3 / 12
rot(pa, CX + math.sin(tp) * (R_EXT + 30), CZ - math.cos(tp) * (R_EXT + 30), 'PAVILHAO  1 de 10', CREME, 10, -8)
rot(pa, CX + math.sin(A) * (R_EXT + 40), CZ - math.cos(A) * (R_EXT + 40), 'BOCA NORTE', CREME, -40, -26)
rot(pa, CX + math.sin(A) * (R_EXT + 40), CZ - math.cos(A) * (R_EXT + 40), 'para a orla nobre', TEXTO, -60, -6)
rot(pa, CX - math.sin(A) * (R_EXT + 40), CZ + math.cos(A) * (R_EXT + 40), 'BOCA DA CIDADE', CREME, -60, 6)
rot(pa, CX - math.sin(A) * (R_EXT + 40), CZ + math.cos(A) * (R_EXT + 40), 'chegada, ancoradouro', TEXTO, -80, 26)
tb = A + math.pi / 2
rot(pa, CX + math.sin(tb) * (R_INT + 30), CZ - math.cos(tb) * (R_INT + 30), 'passarela', TEXTO, -30, -34)
rot(pa, CX + math.sin(A + 2.5) * (R_INT - 120), CZ - math.cos(A + 2.5) * (R_INT - 120), 'BACIA PROTEGIDA', CREME, -70, 0)
rot(pa, CX + math.sin(A + 2.5) * (R_INT - 120), CZ - math.cos(A + 2.5) * (R_INT - 120), '32,7 ha de agua abrigada', TEXTO, -70, 20)

# escala do quadro A
ex, ey, L = AX - 560, AZ + 600, 200 * AE
d.line([(ex, ey), (ex + L, ey)], fill=CREME, width=3)
for i in range(5):
    xx = ex + L * i / 4
    d.line([(xx, ey - 6), (xx, ey + 6)], fill=CREME, width=2)
d.text((ex, ey + 12), '0', font=FM, fill=CREME)
d.text((ex + L - 40, ey + 12), '200 m', font=FM, fill=CREME)
d.text((AX - 560, AZ - 640), 'QUADRO A   planta da ilha   1:1.100 aprox', font=FP, fill=TEXTO)

# norte do quadro A
nx, ny = AX + 540, AZ - 600
d.line([(nx, ny + 40), (nx, ny - 40)], fill=CREME, width=3)
d.polygon([(nx, ny - 52), (nx - 10, ny - 26), (nx + 10, ny - 26)], fill=CREME)
d.text((nx - 7, ny + 48), 'N', font=FP, fill=CREME)

# ─────────────────────────────────────────────────────────────── QUADRO B ───
# a implantação: a baía medida, a orla nobre e a ilha
BX, BZ, BE = 420, 1155, 0.052
def pb(x, z):
    return (BX + (x - CX) * BE, BZ + (z - CZ) * BE)

d.rectangle([60, 830, 790, 1480], outline=(40, 42, 47), width=1)
for j in range(0, N, 2):
    z = Z0 + j * CEL
    i = 0
    while i < N:
        if masc[j * N + i]:
            i0 = i
            while i < N and masc[j * N + i]:
                i += 1
            x1, y1 = pb(X0 + i0 * CEL, z)
            x2, _ = pb(X0 + i * CEL, z)
            if 832 < y1 < 1478:
                d.rectangle([max(62, x1), y1, min(788, x2), y1 + 2], fill=AGUA)
        else:
            i += 1

def arco(fn, r, g0, g1, cor, larg=2, passo=0.5):
    pts = []
    g = g0
    while g <= g1:
        t = math.radians(g)
        pts.append(fn(math.sin(t) * r, -math.cos(t) * r))
        g += passo
    d.line(pts, fill=cor, width=larg, joint='curve')

arco(pb, 6950, 10, 100, LINHA, 2)
arco(pb, 6036, 10, 100, (58, 61, 68), 1)
p0 = pb(math.sin(A) * 3200, -math.cos(A) * 3200)
p1 = pb(math.sin(A) * 7050, -math.cos(A) * 7050)
d.line([p0, p1], fill=(64, 68, 76), width=1)
poli(pb, terra, LARANJA, 2, fill=TERRA)
bp = pb(CX, CZ)
d.ellipse([bp[0] - 34, bp[1] - 34, bp[0] + 34, bp[1] + 34], outline=LARANJA_FRACO, width=1)

rot(pb, math.sin(A) * 6950, -math.cos(A) * 6950, 'ORLA NOBRE  AN7', CREME, -150, -22, FM)
rot(pb, math.sin(A) * 6036, -math.cos(A) * 6036, 'borda do tecido', TEXTO, -150, 26, FM)
d.text((78, 846), 'QUADRO B   implantacao na baia', font=FP, fill=TEXTO)
ex, ey, L = 620, 1450, 1000 * BE
d.line([(ex, ey), (ex + L, ey)], fill=CREME, width=2)
d.text((ex, ey + 10), '0', font=FM, fill=CREME)
d.text((ex + L + 8, ey - 8), '1.000 m', font=FM, fill=CREME)

# ────────────────────────────────────────────────────────────────── TEXTO ───
x, y = 60, 62
d.text((x, y), 'D O G C I T Y', font=FB, fill=CREME)
d.text((x, y + 42), 'THE FOUNDERS ATOLL', font=FT, fill=LARANJA)
d.text((x, y + 110), 'a sede do Founders Club, na baia, em frente a orla nobre', font=F, fill=TEXTO)

linhas = [
    ('posicao', f'rumo {RUMO}, r {RAIO_CENTRO} m    ({CX:.0f}, {CZ:.0f})'),
    ('', 'no eixo do meio da orla nobre'),
    ('agua em volta', '950 m ate a margem mais proxima, medidos'),
    ('ate a orla nobre', f'{6950 - RAIO_CENTRO - R_EXT:.0f} m de lamina aberta'),
    ('', ''),
    ('anel de terra', f'{area_anel/1e4:.1f} ha    dodecagono r {R_EXT} m, faixa {R_EXT-R_INT} m'),
    ('bacia interna', f'{area_bacia/1e4:.1f} ha    agua protegida, r {R_INT} m'),
    ('a Casa', f'{area_poly(casa)/1e4:.1f} ha     ilhota central, r {R_CASA} m'),
    ('pavilhoes', f'{len(FACES)} de {PAV_W} x {PAV_H} m, um por face, 5 de cada lado'),
    ('bocas', f'2 de {BOCA} m, nas duas pontas do eixo'),
    ('promenade', f'{2*math.pi*(R_EXT+R_INT)/2/1000:.2f} km em volta do anel'),
    ('', ''),
    ('cota', 'lamina -40, conves -32, gabarito 2 pavimentos'),
    ('', 'o topo fica 23 m ABAIXO do datum da cidade,'),
    ('', 'entao a ilha nao encobre a skyline de ninguem'),
    ('', ''),
    ('acesso', 'so por agua. Nao ha ponte ate a ilha, e e proposital:'),
    ('', 'a travessia e parte do lugar'),
    ('terra', 'criada pelo projeto dentro da agua.'),
    ('', 'nao sai da cota de lote de ninguem'),
]
y = 250
for k, v in linhas:
    if k:
        d.text((x, y), k.ljust(17), font=FM, fill=(116, 120, 128))
        d.text((x + 150, y), v, font=FP, fill=CREME)
    elif v:
        d.text((x + 150, y), v, font=FP, fill=TEXTO)
    y += 26

d.text((W - 470, H - 74), 'DOGCITY  ·  FOLHA IF-01  ·  2026-09-18', font=FM, fill=(116, 120, 128))
d.text((W - 470, H - 52), 'agua medida em celula de 10 m sobre o relevo cortado', font=FM, fill=(88, 92, 100))

img.save(SAIDA)
print(f"""
{SAIDA}   {W}x{H}

centro          rumo {RUMO}, r {RAIO_CENTRO}  ->  ({CX:.0f}, {CZ:.0f})
anel de terra   {area_anel/1e4:.2f} ha
bacia interna   {area_bacia/1e4:.2f} ha
a Casa          {area_poly(casa)/1e4:.2f} ha
pavilhoes       {len(FACES)} de {PAV_W} x {PAV_H} m
promenade       {2*math.pi*(R_EXT+R_INT)/2/1000:.2f} km
lamina livre    {6950 - RAIO_CENTRO - R_EXT:.0f} m entre a ilha e a orla nobre
""")
