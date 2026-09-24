#!/usr/bin/env python3
"""Prepara a base do EDITOR DE PLANO da DogCity (celular).

Gera, a partir do chão ASSADO da cena (nunca de réplica), três arquivos:
  terreno.webp   o relevo como a cena desenha: hillshade, tinta por altitude, água
                 abaixo da lâmina (−40 m) em petróleo, curvas de nível a cada 25 m
  cotas.png      a cota em cada pixel de uma grade de 1024², codificada em R e G
                 (v = round((h + 400)·40), R = v >> 8, G = v & 255), para o editor
                 mostrar a altitude embaixo do dedo
  camadas.json   referência vetorial travada: a estrutura do dodecágono (arteriais,
                 alça, 12 avenidas), a teia atual, as vias de orla e as peças do
                 programa, em metros no quadro da cidade (x para leste, z para o
                 sul, rumo = atan2(x, -z))

Uso: python3 scripts/city/editor/preparar_editor.py [--palco=DIR] [--saida=DIR] [--lado=2048]
"""
import json, math, os, struct, sys
from PIL import Image, ImageDraw

args = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
PALCO = args.get('palco', '/home/bitmax/Projects/bitcoin-fullstack/dogcity-palco')
SAIDA = args.get('saida', '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/'
                 '8c325219-1e13-44e6-9724-1b09f71f34c8/scratchpad/editor')
LADO = int(args.get('lado', 2048))
EXT = 9800.0                       # metros do centro até a borda da imagem
AGUA = -40.0
os.makedirs(SAIDA, exist_ok=True)

meta = json.load(open(os.path.join(PALCO, 'data/superficie.json')))
n, R = meta['n'], float(meta['raio'])
raw = open(os.path.join(PALCO, 'data/superficie.f32'), 'rb').read()
H = struct.unpack('<%df' % (n * n), raw[:n * n * 4])

def alt(x, z):
    fx = (x + R) / (2 * R) * (n - 1); fz = (z + R) / (2 * R) * (n - 1)
    i = min(n - 2, max(0, int(fx))); j = min(n - 2, max(0, int(fz)))
    tx, tz = fx - i, fz - j
    a, b = H[j * n + i], H[j * n + i + 1]
    c, d = H[(j + 1) * n + i], H[(j + 1) * n + i + 1]
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz

# ── terreno.webp ─────────────────────────────────────────────────────────────
px = 2 * EXT / LADO
hs = [0.0] * (LADO * LADO)
for py in range(LADO):
    z = -EXT + (py + 0.5) * px
    for qx in range(LADO):
        hs[py * LADO + qx] = alt(-EXT + (qx + 0.5) * px, z)

def mistura(c0, c1, t):
    return tuple(int(round(c0[k] + (c1[k] - c0[k]) * t)) for k in range(3))

TERRA = [(-40, (38, 32, 26)), (0, (58, 49, 39)), (150, (82, 70, 56)),
         (400, (108, 94, 76)), (1100, (150, 134, 112))]
def cor_terra(h):
    for (h0, c0), (h1, c1) in zip(TERRA, TERRA[1:]):
        if h <= h1: return mistura(c0, c1, max(0.0, (h - h0) / (h1 - h0)))
    return TERRA[-1][1]

img = Image.new('RGB', (LADO, LADO))
pix = img.load()
lz = (-1.0, -1.0, 1.4)             # luz de noroeste, 45° de altura
ln = math.sqrt(sum(v * v for v in lz)); lz = tuple(v / ln for v in lz)
for py in range(LADO):
    for qx in range(LADO):
        k = py * LADO + qx
        h = hs[k]
        if h < AGUA:
            prof = min(1.0, (AGUA - h) / 60.0)
            pix[qx, py] = mistura((34, 96, 118), (14, 52, 68), prof)
            continue
        hx = hs[k + 1] - hs[k - 1] if 0 < qx < LADO - 1 else 0.0
        hz = hs[k + LADO] - hs[k - LADO] if 0 < py < LADO - 1 else 0.0
        nx, nz, ny = -hx / (2 * px), -hz / (2 * px), 1.0
        nn = math.sqrt(nx * nx + nz * nz + ny * ny)
        luz = max(0.0, (nx * lz[0] + nz * lz[1] + ny * lz[2]) / nn)
        c = cor_terra(h)
        f = 0.55 + 0.6 * luz
        c = tuple(min(255, int(v * f)) for v in c)
        # curva de nível a cada 25 m, fina e clara
        if qx < LADO - 1 and py < LADO - 1 and (
                math.floor(h / 25) != math.floor(hs[k + 1] / 25)
                or math.floor(h / 25) != math.floor(hs[k + LADO] / 25)):
            c = mistura(c, (196, 180, 150), 0.22)
        pix[qx, py] = c
img.save(os.path.join(SAIDA, 'terreno.webp'), 'WEBP', quality=86, method=6)

# ── cotas.png ────────────────────────────────────────────────────────────────
G = 1024
cot = Image.new('RGB', (G, G))
cp = cot.load()
pg = 2 * EXT / G
for py in range(G):
    z = -EXT + (py + 0.5) * pg
    for qx in range(G):
        v = max(0, min(65535, int(round((alt(-EXT + (qx + 0.5) * pg, z) + 400.0) * 40))))
        cp[qx, py] = (v >> 8, v & 255, 0)
cot.save(os.path.join(SAIDA, 'cotas.png'), optimize=True)

# ── camadas.json ─────────────────────────────────────────────────────────────
vias = json.load(open(os.path.join(PALCO, 'public/city/mapa/vias.json')))
r1 = lambda v: round(v, 1)
estrutura, teia, orla = [], [], []
for v in vias:
    (x0, z0), (x1, z1) = v['pontos'][0], v['pontos'][-1]
    s = [r1(x0), r1(z0), r1(x1), r1(z1), v['larg']]
    if v['tipo'] == 'avenida' or (v['tipo'] == 'anel' and v['larg'] >= 20):
        classe = 'avenida' if v['tipo'] == 'avenida' else ('alca' if v['larg'] >= 44 else 'arterial')
        estrutura.append(s + [classe])
    elif v['tipo'] == 'orla':
        orla.append(s)
    else:
        teia.append(s)
cid = json.load(open(os.path.join(PALCO, 'public/city/cidade.json')))
pecas = []
for q in cid.get('programa', []):
    if q.get('poly'):
        pecas.append({'id': q.get('id'), 'nome': q.get('nome'), 'tipo': q.get('tipo'),
                      'p': [[r1(x), r1(z)] for x, z in q['poly']]})
json.dump({
    'versao': 1,
    'quadro': 'metros; x para leste, z para o sul (norte = -z); rumo = atan2(x, -z)',
    'imagem': {'arquivo': 'terreno.webp', 'lado': LADO, 'ext': EXT},
    'cotas': {'arquivo': 'cotas.png', 'lado': G, 'ext': EXT, 'codigo': 'h = (R*256 + G)/40 - 400'},
    'agua': AGUA,
    'estrutura': estrutura, 'teia': teia, 'orla': orla, 'pecas': pecas,
    'praca': {'centro': [0, 0], 'raio_lago': 921},
}, open(os.path.join(SAIDA, 'camadas.json'), 'w'), separators=(',', ':'))
print('terreno %s, cotas %s, camadas: %d estrutura, %d teia, %d orla, %d peças'
      % (LADO, G, len(estrutura), len(teia), len(orla), len(pecas)))
