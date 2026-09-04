#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# O LAUDO DE UMA JANELA TOPOGRÁFICA.
#
# Lê o par .f32/.json que `topo-janela.mjs` extraiu da CENA e responde as
# perguntas que decidem refino de montanha, em número:
#
#   forma      quantos cumes tem, e com que proeminência (cone ou cordilheira)
#   agudez     inclinação por célula, percentis e área por faixa de talude
#   volume     área por faixa de cota, que é onde a neve e a mata deveriam morar
#   perfil     a queda do cume em 16 rumos, que é a forma que a silhueta mostra
#
# ⚠️ A INCLINAÇÃO SE MEDE NA CÉLULA DA GRADE, e o número muda com a célula: a
# 40 m um talude de 45 graus vira 30, porque a média achata. Por isso a janela
# fina existe. O laudo imprime a célula junto de todo ângulo, sempre.
#
# ⚠️ SEM NUMPY DE PROPÓSITO: esta máquina não tem, e 270 mil células em Python
# puro levam segundos. Dependência que não existe na máquina do dono não é
# dependência, é impedimento.
#
#   python3 scripts/city/analisa_topo.py ~/.local/share/dogcity/topo/inverno
# ═══════════════════════════════════════════════════════════════════════════
import json, math, struct, sys
from PIL import Image

base = sys.argv[1] if len(sys.argv) > 1 else '/home/bitmax/.local/share/dogcity/topo/inverno'
meta = json.load(open(base + '.json'))
n, cel = meta['n'], meta['celulaM']
cx, cz = meta['centro']
H = list(struct.unpack('<%df' % (n * n), open(base + '.f32', 'rb').read()))

def at(i, j):
    return H[j * n + i]

print('═' * 74)
print(f"JANELA {base.split('/')[-1]}: centro ({cx}, {cz}), {2*meta['meia']} m de lado, "
      f"{n}x{n}, celula {cel:.1f} m")
print('═' * 74)

# ── cota ────────────────────────────────────────────────────────────────────
ord_h = sorted(H)
def pct(p): return ord_h[min(len(ord_h) - 1, int(p / 100 * len(ord_h)))]
print(f"\nCOTA  min {ord_h[0]:8.1f}   p50 {pct(50):8.1f}   p90 {pct(90):8.1f}   "
      f"p99 {pct(99):8.1f}   max {ord_h[-1]:8.1f}")

area_cel = (cel * cel) / 1e6            # km2 por celula
faixas = [(-999, 0), (0, 100), (100, 200), (200, 300), (300, 400), (400, 600),
          (600, 800), (800, 1000), (1000, 9999)]
print('\nAREA POR FAIXA DE COTA')
for a, b in faixas:
    q = sum(1 for h in H if a <= h < b)
    if q:
        print(f"  {a:5.0f} a {b:5.0f} m   {q*area_cel:7.3f} km2   {100*q/len(H):5.2f}%")

# ── inclinação ──────────────────────────────────────────────────────────────
slopes = []
for j in range(1, n - 1):
    for i in range(1, n - 1):
        dx = (at(i + 1, j) - at(i - 1, j)) / (2 * cel)
        dz = (at(i, j + 1) - at(i, j - 1)) / (2 * cel)
        slopes.append(math.degrees(math.atan(math.hypot(dx, dz))))
slopes.sort()
def spct(p): return slopes[min(len(slopes) - 1, int(p / 100 * len(slopes)))]
print(f"\nINCLINACAO (celula {cel:.0f} m)  p50 {spct(50):5.1f}   p90 {spct(90):5.1f}   "
      f"p99 {spct(99):5.1f}   max {slopes[-1]:5.1f} graus")
for lim in (30, 35, 40, 45, 55, 70):
    q = sum(1 for s in slopes if s >= lim)
    print(f"  acima de {lim:2d} graus   {q*area_cel:7.3f} km2   {100*q/len(slopes):5.2f}%")

# ── cumes e proeminência ────────────────────────────────────────────────────
# maximo local numa janela de 15 celulas de raio, com queda minima de 40 m
R = 15
picos = []
for j in range(R, n - R, 3):
    for i in range(R, n - R, 3):
        h = at(i, j)
        if h < 200:
            continue
        alto = True
        menor = h
        for dj in range(-R, R + 1, 2):
            for di in range(-R, R + 1, 2):
                v = at(i + di, j + dj)
                if v > h:
                    alto = False
                    break
                if v < menor:
                    menor = v
            if not alto:
                break
        if alto and (h - menor) >= 40:
            picos.append((h, cx - meta['meia'] + i * cel, cz - meta['meia'] + j * cel, h - menor))
picos.sort(reverse=True)
# tira vizinhos a menos de 250 m
finais = []
for p in picos:
    if all(math.hypot(p[1] - q[1], p[2] - q[2]) > 250 for q in finais):
        finais.append(p)
print(f"\nCUMES (maximo local em raio de {R*cel:.0f} m, queda minima 40 m): {len(finais)}")
for h, x, z, prom in finais[:12]:
    print(f"  {h:7.1f} m em ({x:8.0f}, {z:8.0f})   proeminencia local {prom:6.1f} m")

# ── perfil radial do cume ───────────────────────────────────────────────────
if finais:
    h0, px, pz, _ = finais[0]
    print(f"\nPERFIL DO CUME PRINCIPAL ({h0:.1f} m) em 16 rumos, ate 2.000 m")
    print("  rumo   h@250  h@500  h@1000  h@2000   talude medio 0-500m")
    for k in range(16):
        a = k * 2 * math.pi / 16
        linha, tal = [], 0
        for d in (250, 500, 1000, 2000):
            x = px + math.cos(a) * d
            z = pz + math.sin(a) * d
            i = int(round((x - (cx - meta['meia'])) / cel))
            j = int(round((z - (cz - meta['meia'])) / cel))
            if 0 <= i < n and 0 <= j < n:
                linha.append(at(i, j))
            else:
                linha.append(float('nan'))
        if not math.isnan(linha[1]):
            tal = math.degrees(math.atan((h0 - linha[1]) / 500))
        print(f"  {math.degrees(a):5.0f}  " + '  '.join(f"{v:6.1f}" for v in linha)
              + f"   {tal:6.1f} graus")

# ── a chapa: relevo sombreado com faixas hipsometricas ──────────────────────
LADO = 900
img = Image.new('RGB', (LADO, LADO))
px_img = img.load()
lo, hi = ord_h[0], ord_h[-1]
# luz do noroeste, elevacao 35 graus
lz = math.radians(315)
le = math.radians(35)
Lx, Ly, Lz = math.cos(le) * math.sin(lz), math.sin(le), math.cos(le) * math.cos(lz)
def cor(h):
    t = (h - lo) / (hi - lo + 1e-9)
    if t < 0.18:   return (26, 42, 58)
    if t < 0.30:   return (58, 66, 52)
    if t < 0.45:   return (86, 92, 58)
    if t < 0.60:   return (120, 104, 72)
    if t < 0.75:   return (146, 120, 96)
    if t < 0.88:   return (176, 158, 142)
    return (232, 236, 240)
for py in range(LADO):
    j = int(py * n / LADO)
    for pxi in range(LADO):
        i = int(pxi * n / LADO)
        i1, j1 = min(i + 1, n - 1), min(j + 1, n - 1)
        i0, j0 = max(i - 1, 0), max(j - 1, 0)
        dx = (at(i1, j) - at(i0, j)) / ((i1 - i0) * cel)
        dz = (at(i, j1) - at(i, j0)) / ((j1 - j0) * cel)
        nl = math.sqrt(dx * dx + dz * dz + 1)
        lum = max(0.08, (-dx * Lx + Ly - dz * Lz) / nl)
        r, g, b = cor(at(i, j))
        px_img[pxi, py] = (min(255, int(r * lum * 1.35)), min(255, int(g * lum * 1.35)),
                           min(255, int(b * lum * 1.35)))
saida = base + '-laudo.png'
img.save(saida)
print(f"\nchapa do relevo: {saida}")
