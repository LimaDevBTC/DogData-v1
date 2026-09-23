#!/usr/bin/env python3
import math
from PIL import Image

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
OUT = '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/8c325219-1e13-44e6-9724-1b09f71f34c8/scratchpad/diag'
DEG = math.pi / 180
QUADRO = 7400.0
LADO = 1600
ESC2 = (LADO / (2 * QUADRO)) * 2  # px por metro no PNG de 3200

def mpx(x, z):
    return (x + QUADRO) * ESC2, (z + QUADRO) * ESC2

def do_rumo(r, rumo):
    a = rumo * DEG
    return r * math.sin(a), -r * math.cos(a)

im = Image.open(f'{RAIZ}/public/landing/citymap-3200-v3.png')
W, H = im.size

def crop_rumo_r(nome, rumo0, rumo1, r0, r1, pad=60):
    pts = []
    for rm in range(int(rumo0), int(rumo1) + 1, 2):
        for r in (r0, r1):
            pts.append(do_rumo(r, rm))
    pxs = [mpx(x, z) for x, z in pts]
    x0 = min(p[0] for p in pxs) - pad
    x1 = max(p[0] for p in pxs) + pad
    y0 = min(p[1] for p in pxs) - pad
    y1 = max(p[1] for p in pxs) + pad
    x0, y0 = max(0, int(x0)), max(0, int(y0))
    x1, y1 = min(W, int(x1)), min(H, int(y1))
    im.crop((x0, y0, x1, y1)).save(f'{OUT}/crop_{nome}.png')
    print(f'{nome}: rumo {rumo0}-{rumo1} r {r0}-{r1}  ->  px box ({x0},{y0})-({x1},{y1})  {x1-x0}x{y1-y0}')

def crop_px(nome, x0, y0, x1, y1):
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(W, x1), min(H, y1)
    im.crop((x0, y0, x1, y1)).save(f'{OUT}/crop_{nome}.png')
    print(f'{nome}: px box ({x0},{y0})-({x1},{y1})  {x1-x0}x{y1-y0}')

# 1) visao geral, reduzida
im.resize((1100, 1100)).save(f'{OUT}/crop_overview.png')
print('overview salvo 1100x1100')

# 2) sul: rumo 140 a 200 (baixo da folha), da banda media ate a borda tecido
crop_rumo_r('sul', 140, 200, 900, 7300, pad=40)

# 3) sudoeste (7h ~ rumo 205-225), a cunha do distrito 4 (giro -46)
crop_rumo_r('sudoeste_cunha', 175, 245, 900, 7300, pad=40)

# 4) anel AN1 (r=1750) cortando fileiras curvas em S03 (rumo 130-183)
crop_rumo_r('anel_an1_s03', 120, 190, 1350, 2100, pad=30)

# 4b) mesmo fenomeno num anel mais externo (AN4, r~4450) pra comparar escala
crop_rumo_r('anel_an4', 60, 160, 4000, 4900, pad=30)

# 5) Orla da Baia (setor 9), rumo 0-100, r 3800-4800
crop_rumo_r('orla_da_baia', 0, 101, 3700, 4900, pad=40)

# 6) avenida cruzando a baia, rumo 30, r 4200-6700 (bulevar 'ponte')
crop_rumo_r('avenida_baia_rumo30', 20, 40, 4200, 6800, pad=40)

# 7) setor4 outer band (S04-Q10/Q11) proximo do sul, r 2500-3200, rumo 180-200
crop_rumo_r('s04_q10_q11', 175, 205, 2400, 3300, pad=40)

# 8) visao setor3/4 outer band mais distante (Q23/Q24), rumo 140-200, r 5000-6100
crop_rumo_r('s03_s04_q23_q24', 140, 200, 4900, 6200, pad=40)

# 9) canto inferior do quadro inteiro (bottom strip) pra pegar qualquer peca de
#    programa cortada pela borda do quadro
crop_px('rodape_quadro_full', 0, 2800, 3200, 3200)

print('done')
