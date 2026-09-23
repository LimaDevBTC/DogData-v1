#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prova, por dois caminhos independentes, que a avenida radial desaparece ao
cruzar a parte funda de The Bay (rumos 30/60/90), em vez de sair tracejada
como o comentario do carta.mjs promete. So leitura.

1) amostra a cor dos pixels do PNG publicado ao longo do raio geometrico de
   cada avenida (formula doRumo/mPx, identica a carta.mjs).
2) extrai do SVG fonte (public/city/carta.svg) todo path com
   stroke-dasharray="2.2 1.6" (a marca da 'ponte'), devolve para metros/rumo/r
   e mostra que so existem 8 trechos tracejados no mapa inteiro, nenhum deles
   cobrindo o vao de ~1.800 m que a agua realmente ocupa nesses tres rumos.
"""
import json, math, re, os
from PIL import Image

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
DEG = math.pi / 180
QUADRO = 7400.0
LADO = 1600

def P(*a):
    return os.path.join(RAIZ, *a)

def rumo_de(x, z):
    return (math.degrees(math.atan2(x, -z)) + 360) % 360

def do_rumo(r, rumo):
    a = rumo * DEG
    return r * math.sin(a), -r * math.cos(a)

# ═════════════════════════════════════════════════════════════════════════
# 1) pixel do PNG de 3200, ao longo do raio de cada avenida
# ═════════════════════════════════════════════════════════════════════════
ESC2 = (LADO / (2 * QUADRO)) * 2

def mpx(x, z):
    return (x + QUADRO) * ESC2, (z + QUADRO) * ESC2

im = Image.open(P('public/landing/citymap-3200-v3.png'))
px = im.load()
VIA_ALVO = (220, 210, 192)  # #E9DECB aproximado, com folga p/ blend/opacidade

def cobertura_avenida(rumo_graus, r0=1500, r1=7100, passo=3, faixa=6):
    a = rumo_graus * DEG
    baldes = {}
    for r in range(r0, r1, passo):
        x, z = r * math.sin(a), -r * math.cos(a)
        pxp, pyp = mpx(x, z)
        ix, iy = int(round(pxp)), int(round(pyp))
        achou = False
        nx, ny = math.cos(a), math.sin(a)
        for d in range(-faixa, faixa + 1):
            sx, sy = int(round(ix + d * nx)), int(round(iy + d * ny))
            if 0 <= sx < im.width and 0 <= sy < im.height:
                c = px[sx, sy]
                if all(abs(c[i] - VIA_ALVO[i]) < 32 for i in range(3)):
                    achou = True
                    break
        b = (r // 300) * 300
        n, k = baldes.get(b, (0, 0))
        baldes[b] = (n + 1, k + (1 if achou else 0))
    return baldes

print('=' * 78)
print('1) COBERTURA DE PIXEL DA COR DA VIA, ao longo do raio de cada avenida')
print('   (0 = nao ha nenhum pixel cor-de-via numa faixa de 6 px dos dois')
print('    lados do raio geometrico, nesse trecho de 300 m)')
print('=' * 78)
for rumo in [30, 60, 90, 120, 150, 180, 210]:
    baldes = cobertura_avenida(rumo)
    linha = '  '.join(f'{b}:{k}/{n}' for b, (n, k) in sorted(baldes.items()))
    vazios = [b for b, (n, k) in sorted(baldes.items()) if k == 0]
    print(f'rumo {rumo:3d}: {linha}')
    if vazios:
        print(f'   -> SEM NENHUM pixel de via nos trechos de r={vazios[0]} a r={vazios[-1]+300} m')

# ═════════════════════════════════════════════════════════════════════════
# 2) todo trecho 'ponte' (tracejado) que existe de fato no SVG fonte
# ═════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 78)
print('2) TODOS os trechos tracejados (stroke-dasharray="2.2 1.6") do SVG fonte')
print('=' * 78)
svg = open(P('public/city/carta.svg')).read()
ESC1 = LADO / (2 * QUADRO)

def m_of(px_):
    return px_ / ESC1 - QUADRO

total = 0
for m in re.finditer(r'<path d="([^"]*)"[^>]*stroke-dasharray="2\.2 1\.6"', svg):
    d = m.group(1)
    pts = re.findall(r'([\-\d.]+) ([\-\d.]+)', d)
    if len(pts) < 2:
        continue
    total += 1
    pts = [(float(a), float(b)) for a, b in pts]
    x0, z0 = m_of(pts[0][0]), m_of(pts[0][1])
    x1, z1 = m_of(pts[-1][0]), m_of(pts[-1][1])
    r0, r1 = math.hypot(x0, z0), math.hypot(x1, z1)
    print(f'  trecho {total}: {len(pts):4d} pontos  inicio r={r0:6.0f} rumo={rumo_de(x0,z0):6.1f}  '
          f'fim r={r1:6.0f} rumo={rumo_de(x1,z1):6.1f}')
print(f'\ntotal de trechos tracejados (pontes) em todo o SVG: {total}')
print('nenhum deles cobre r ~4.900 a ~6.650 nos rumos 30/60/90 (o vao real da')
print('agua funda de The Bay medido na superficie construida, ver abaixo).')

# ═════════════════════════════════════════════════════════════════════════
# 3) confirmacao independente: altura real do terreno ao longo do rumo 60,
#    pela mesma funcao que o gerador usa (bilinear sobre data/superficie.f32)
# ═════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 78)
print('3) ALTURA REAL (data/superficie.f32) ao longo do rumo 60, a cada 100 m')
print('=' * 78)
meta = json.load(open(P('data/superficie.json')))
import array
buf = array.array('f')
buf.frombytes(open(P('data/superficie.f32'), 'rb').read())
n, R = meta['n'], meta['raio']
cel = (2 * R) / (n - 1)

def altura(x, z):
    fi, fj = (x + R) / cel, (z + R) / cel
    i = int(max(0, min(n - 2, math.floor(fi))))
    j = int(max(0, min(n - 2, math.floor(fj))))
    u, v = fi - i, fj - j
    return (buf[j*n+i]*(1-u)*(1-v) + buf[j*n+i+1]*u*(1-v)
            + buf[(j+1)*n+i]*(1-u)*v + buf[(j+1)*n+i+1]*u*v)

a = 60 * DEG
for r in range(4200, 6900, 100):
    x, z = r * math.sin(a), -r * math.cos(a)
    h = altura(x, z)
    print(f'  r={r:5d}  altura={h:7.1f} m  {"AGUA" if h < -40 else "terra"}')
