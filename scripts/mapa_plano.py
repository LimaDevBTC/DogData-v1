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

R = foco[2] if foco else 7300.0
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
# ⚠️ O GIRO DEIXOU DE SER `setor * 7,5`. Ele agora é DO QUARTEIRÃO (na Cinta é a
# tangente local, diferente em cada bloco), então vem de cidade-malha.json pelo
# id S..-Q..-B.., que é o mesmo lot_id sem o -L...
import json
MALHA = json.load(open(os.path.join(RAIZ, 'public', 'city', 'cidade-malha.json')))
GIRO = {b['id']: math.radians(b['giro']) for b in MALHA['quarteiroes']}
n = 0
with open(CSV, newline='') as f:
    for row in csv.DictReader(f):
        x, z = float(row['x_m']), float(row['z_m'])
        if abs(x - CX) > R or abs(z - CZ) > R: continue
        fr, pf = float(row['frente_m']), float(row['prof_m'])
        ang = GIRO.get(row['lot_id'].rsplit('-L', 1)[0], 0.0)
        ca, sa = math.cos(ang), math.sin(ang)
        # cantos no referencial do setor, depois girados para o mundo
        pts = []
        for dx, dz in ((-fr/2, -pf/2), (fr/2, -pf/2), (fr/2, pf/2), (-fr/2, pf/2)):
            pts.append(tela(x + dx*ca - dz*sa, z + dx*sa + dz*ca))
        # ⚠️ O TOM SAI DO RAIO, NÃO DA BANDA. Com a teia as bandas viraram ANÉIS
        # (são 17), e `208 - banda*16` ficava negativo do 13º anel para fora:
        # a periferia inteira saía preta e parecia que não havia tecido lá.
        g = int(200 - 46 * min(1.0, max(0.0, (float(row['raio_m']) - 1450) / 4050)))
        dr.polygon(pts, fill=(g, g - 8, g - 20))
        n += 1

# ⚠️ SEM O PROGRAMA DESENHADO, A PLANTA MENTE. Os 786,8 ha das 51 peças e os 8
# parques aparecem como BURACO PRETO, e eu mesmo li a planta como "tecido
# esburacado" quando 96,5% dos quarteirões têm lote. Vazio sem nome lê como
# falha; vazio com desenho lê como praça, estádio e parque.
import json as _json
_pg = _json.load(open(os.path.join(RAIZ, 'data', 'dogcity_programa_congelado.json')))
for q in _pg:
    cx, cz, ea, eb = q['cx'], q['cz'], q['a'], q['b']
    g = math.radians(q['rot'])
    cg, sg = math.cos(g), math.sin(g)
    if q['forma'] == 'retangulo':
        cantos = [(-ea, -eb), (ea, -eb), (ea, eb), (-ea, eb)]
    else:
        cantos = [(math.cos(2*math.pi*i/40)*ea, math.sin(2*math.pi*i/40)*eb) for i in range(40)]
    pts = [tela(cx + lx*cg - lz*sg, cz + lx*sg + lz*cg) for lx, lz in cantos]
    dr.polygon(pts, fill=(58, 62, 66))
for pq in MALHA.get('parques', []):
    g = math.radians(pq['rot']); cg, sg = math.cos(g), math.sin(g)
    pts = [tela(pq['x'] + math.cos(2*math.pi*i/44)*pq['a']*cg - math.sin(2*math.pi*i/44)*pq['b']*sg,
                pq['z'] + math.cos(2*math.pi*i/44)*pq['a']*sg + math.sin(2*math.pi*i/44)*pq['b']*cg)
           for i in range(44)]
    dr.polygon(pts, fill=(52, 74, 52))
# ⚠️ A ÁGUA VEM ANTES DO CONTORNO E DEPOIS DO TECIDO: ela é o que dá a leitura
# da cidade de canais, e sem desenhá-la a planta só mostra as valas vazias.
_cn = MALHA.get('canais') or {}
for _a in _cn.get('aneis', []):
    pts = [tela(x, z) for x, z in _a['contorno']]
    dr.line(pts + [pts[0]], fill=(38, 84, 116), width=max(2, int(_a['lamina'] * esc)))
for _r in _cn.get('radiais', []):
    g = math.radians(_r['rumo'])
    x0, z0 = math.sin(g) * _r['rInicio'], -math.cos(g) * _r['rInicio']
    # o fim do radial: onde phi vale o do anel externo, naquele rumo
    _lo, _hi = 500.0, 14000.0
    dr.line([tela(x0, z0), tela(math.sin(g) * 5000, -math.cos(g) * 5000)],
            fill=(38, 84, 116), width=max(3, int(_r['lamina'] * esc)))
# o contorno da cidade, que agora e curva de nivel de phi e nao circulo
if MALHA.get('contorno'):
    dr.line([tela(x, z) for x, z in MALHA['contorno']] + [tela(*MALHA['contorno'][0])],
            fill=(96, 96, 104), width=2)
dr.ellipse([tela(-R, -R)[0], tela(-R, -R)[1], tela(R, R)[0], tela(R, R)[1]], outline=(40, 40, 46))
im.save(saida)
print(f'{n:,} lotes desenhados em {saida} ({PX}x{PX}, {2*R:.0f} m de lado)')
