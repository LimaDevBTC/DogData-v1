#!/usr/bin/env python3
# DOG MOTORS no site: as 18 fotos de estudio (assets_carros/pronto/conferencia/<slug>_frente34.png, 1000x560, opacas)
# viram recortes 16:10 do MESMO enquadramento, com o fundo do estudio igualado entre elas.
#
# 1. o fundo de cada linha e' a mediana das 40 colunas de cada borda (o carro fica no meio);
# 2. cada foto inteira leva o deslocamento da linha ate' o fundo MEDIO das 18, puxado para o void quente da marca
#    no alto. Deslocamento por LINHA e na foto INTEIRA (carro junto): uma mascara recortava a mancha de luz do
#    estudio atras do carro e deixava uma borda oval. Medido: o fundo das 18 difere no maximo 3 niveis, menos
#    c02/c41 (o alto 6 niveis mais escuro, ate' 12 no canto) e os quatro altos (ate' 9 no chao): o carro anda
#    no maximo isso, invisivel;
# 3. recorte 896x560 (16:10, a altura inteira) centrado no carro (onde o pixel foge do fundo da linha).
# Saida: PNG em <saida>/<slug>.png. Quem codifica AVIF e WebP e' scripts/motors/make-images.mjs.
#
# uso: python3 scripts/motors/prep_cars.py <pasta conferencia> <saida>
import sys, os, glob
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
files = sorted(f for f in glob.glob(os.path.join(src, '*_frente34.png')) if '_longe_' not in f)
assert len(files) == 18, f'esperava 18 fotos, achei {len(files)}'

CROP_W, CROP_H = 896, 560
VOID = np.array([21, 19, 15], dtype=np.float64)  # #15130F

def bg_rows(a):
    edge = np.concatenate([a[:, :40], a[:, -40:]], axis=1)
    return np.median(edge, axis=1)  # H x 3

data = []
for f in files:
    a = np.asarray(Image.open(f).convert('RGB')).astype(np.float64)
    data.append((f, a, bg_rows(a)))

mean_bg = np.mean([b for _, _, b in data], axis=0)  # H x 3
H = mean_bg.shape[0]
# o alto do quadro vai ao void da marca e desce suave ate' o chao medio (sem degrau)
t = np.clip(np.arange(H) / (H * 0.55), 0, 1)[:, None]
target = VOID[None, :] * (1 - t) + mean_bg * t
# o chao fica um pouco mais quente (a luz da casa e' 2700 K): R +2, B -2
target = target + np.array([1.5, 0.5, -1.5])[None, :] * t

for f, a, bg in data:
    d = np.abs(a - bg[:, None, :]).sum(axis=2)
    b = np.clip(a + (target - bg)[:, None, :], 0, 255)
    cols = np.where((d > 60).sum(axis=0) > 6)[0]
    cx = (cols.min() + cols.max()) / 2
    x0 = int(round(cx - CROP_W / 2))
    x0 = max(0, min(a.shape[1] - CROP_W, x0))
    img = Image.fromarray(b.astype(np.uint8)).crop((x0, 0, x0 + CROP_W, CROP_H))
    slug = os.path.basename(f).split('_')[0]
    img.save(os.path.join(out, f'{slug}.png'))
    print(slug, 'x0', x0, 'carro', int(cols.min()), int(cols.max()))
