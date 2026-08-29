#!/usr/bin/env python3
"""Planta da cidade em 2D, direto do CSV do gerador.

⚠️ ISTO EXISTE PARA ENCURTAR O LAÇO. Julgar tecido urbano pela cena 3D custa
minutos por tentativa (gerador + build + carregar + enquadrar + chapa) e o que
se julga é textura vista de 9 km, que é exatamente o que uma planta mostra
melhor. Aqui a volta é de segundos, e o desenho é o mesmo dado que vai para a
cena: `data/dogcity_lotes.csv`.

uso:  python3 scripts/mapa_plano.py saida.png [--px 2200] [--zoom x,z,raio]
"""
import csv, math, os, sys
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = os.path.join(RAIZ, 'data', 'dogcity_lotes.csv')

saida = sys.argv[1] if len(sys.argv) > 1 else 'mapa.png'
PX = 2200
foco = None
for i, a in enumerate(sys.argv):
    if a == '--px': PX = int(sys.argv[i+1])
    if a == '--zoom': foco = [float(v) for v in sys.argv[i+1].split(',')]

R = foco[2] if foco else 4700.0
CX, CZ = (foco[0], foco[1]) if foco else (0.0, 0.0)
esc = PX / (2 * R)

im = Image.new('RGB', (PX, PX), (16, 16, 18))
dr = ImageDraw.Draw(im)

def tela(x, z):
    return ((x - CX) * esc + PX / 2, (z - CZ) * esc + PX / 2)

# ⚠️ O LOTE É DESENHADO COM A ORIENTAÇÃO DELE, não como ponto. O ponto some na
# planta e some justamente a informação em disputa: a DIREÇÃO da fileira. Sem
# desenhar frente x profundidade não dá para ver a listra que faz a cidade
# parecer veludo cotelê.
GIRO_SETOR = 7.5
n = 0
with open(CSV, newline='') as f:
    for row in csv.DictReader(f):
        x, z = float(row['x_m']), float(row['z_m'])
        if abs(x - CX) > R or abs(z - CZ) > R: continue
        fr, pf = float(row['frente_m']), float(row['prof_m'])
        ang = math.radians((int(row['setor']) - 1) * GIRO_SETOR)
        ca, sa = math.cos(ang), math.sin(ang)
        # cantos no referencial do setor, depois girados para o mundo
        pts = []
        for dx, dz in ((-fr/2, -pf/2), (fr/2, -pf/2), (fr/2, pf/2), (-fr/2, pf/2)):
            pts.append(tela(x + dx*ca - dz*sa, z + dx*sa + dz*ca))
        s = int(row['setor'])
        # tom por setor, só para a costura entre setores aparecer
        g = 150 + (s * 7) % 70
        dr.polygon(pts, fill=(g, g - 8, g - 20))
        n += 1

dr.ellipse([tela(-R, -R)[0], tela(-R, -R)[1], tela(R, R)[0], tela(R, R)[1]], outline=(70, 70, 76))
im.save(saida)
print(f'{n:,} lotes desenhados em {saida} ({PX}x{PX}, {2*R:.0f} m de lado)')
