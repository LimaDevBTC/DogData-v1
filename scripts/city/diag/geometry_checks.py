#!/usr/bin/env python3
import csv, math, collections
import sys
sys.path.insert(0, '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/8c325219-1e13-44e6-9724-1b09f71f34c8/scratchpad/diag')
from overlap_check import cantos, load_rows

rows = load_rows('data/dogcity_lotes.csv')
RAIO_BORDA = 8900.0
RAIO_SITIO = 9000.0

max_corner = 0.0
max_corner_lot = None
n_beyond_borda = 0
n_beyond_sitio = 0
corner_dists = []

giro_devs = []
worst_dev = (0.0, None)

for row in rows:
    x, z = float(row['x_m']), float(row['z_m'])
    w, d = float(row['frente_m']), float(row['prof_m'])
    giro = float(row['giro_graus'])
    quad = cantos(x, z, max(1.0,w), max(1.0,d), math.radians(giro))
    for (cx, cz) in quad:
        r = math.hypot(cx, cz)
        corner_dists.append(r)
        if r > max_corner:
            max_corner = r; max_corner_lot = row['lot_id']
        if r > RAIO_BORDA: n_beyond_borda += 1
        if r > RAIO_SITIO: n_beyond_sitio += 1
    # bearing (rumo) of the lot's own center, per convention rumo0=north=-z, grows toward +x (east)
    # candidate formula: rumo = atan2(x, -z)  [matches teste do dodecagono acima: math.atan2(_x,-_z)]
    rumo = math.degrees(math.atan2(x, -z)) % 360.0
    giro_n = giro % 360.0
    dev = abs(giro_n - rumo)
    dev = min(dev, 360-dev)
    giro_devs.append(dev)
    if dev > worst_dev[0]:
        worst_dev = (dev, row['lot_id'])

corner_dists.sort()
giro_devs.sort()
n = len(giro_devs)
print(f"total lots: {len(rows)}, total corners checked: {len(corner_dists)}")
print(f"max corner distance from origin: {max_corner:.1f} m  (lot {max_corner_lot})")
print(f"corners beyond raioBorda ({RAIO_BORDA}): {n_beyond_borda}")
print(f"corners beyond raioSitio ({RAIO_SITIO}): {n_beyond_sitio}")
print()
print(f"giro_graus vs rumo(atan2(x,-z)) deviation -- median: {giro_devs[n//2]:.3f} deg, "
      f"p99: {giro_devs[int(n*0.99)]:.3f} deg, max: {giro_devs[-1]:.3f} deg (lot {worst_dev[1]})")
n_over5 = sum(1 for d in giro_devs if d > 5)
print(f"lots with deviation > 5 deg: {n_over5} of {n} ({100*n_over5/n:.2f}%)")

# faixas de rumo de 5 graus: raio maximo do canto mais distante em cada faixa
print()
print("=== faixas de rumo (5 graus) x raio maximo de canto ===")
faixas = collections.defaultdict(float)
for row in rows:
    x, z = float(row['x_m']), float(row['z_m'])
    w, d = float(row['frente_m']), float(row['prof_m'])
    giro = float(row['giro_graus'])
    quad = cantos(x, z, max(1.0,w), max(1.0,d), math.radians(giro))
    for (cx, cz) in quad:
        r = math.hypot(cx, cz)
        rumo = math.degrees(math.atan2(cx, -cz)) % 360.0
        faixa = int(rumo // 5) * 5
        if r > faixas[faixa]:
            faixas[faixa] = r
vals = sorted(faixas.items())
maxs = [v for _,v in vals]
print(f"n faixas: {len(vals)}, min faixa_max: {min(maxs):.1f}, max faixa_max: {max(maxs):.1f}")
import statistics
med = statistics.median(maxs)
print(f"mediana das faixas: {med:.1f}")
flagged = []
for i,(f,v) in enumerate(vals):
    neigh = [vals[(i-1)%len(vals)][1], vals[(i+1)%len(vals)][1]]
    neigh_med = statistics.median(neigh)
    if v > neigh_med + 300:
        flagged.append((f, v, neigh_med, v-neigh_med))
print(f"faixas com raio maximo > mediana das vizinhas + 300m: {len(flagged)} de {len(vals)}")
for f,v,nm,delta in sorted(flagged, key=lambda t:-t[3]):
    print(f"  rumo {f:.0f}-{f+5:.0f}: max={v:.1f} vizinhas_med={nm:.1f} delta={delta:.1f}")
