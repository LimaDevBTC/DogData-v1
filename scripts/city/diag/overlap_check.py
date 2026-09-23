#!/usr/bin/env python3
"""
Independent re-check of the 'sobreposicao' (overlap) claim on data/dogcity_lotes.csv.
Written independently from scratch (cantos() COPIED verbatim from
scripts/city/conferir_lotes.py:135, not imported), per instructions:
this repo is READ-ONLY for this agent.

Usage:
  python3 overlap_check.py                 # full run, all lots, grid 100m
  python3 overlap_check.py --sanity        # just the sanity checks (fast)
  python3 overlap_check.py --pair ID1 ID2  # exact overlap of two specific lot_id
"""
import csv, math, sys, collections, time

CSV_PATH = 'data/dogcity_lotes.csv'
CELL = 100.0  # m, grid cell size

# ---- cantos(): copied verbatim from scripts/city/conferir_lotes.py line ~135 ----
def cantos(x, z, w, d, giro):
    ca, sa = math.cos(giro), math.sin(giro)
    return [(x + dx*ca - dz*sa, z + dx*sa + dz*ca)
            for dx, dz in ((-w/2, -d/2), (w/2, -d/2), (w/2, d/2), (-w/2, d/2))]

# ---- Sutherland-Hodgman clip of convex polygon `subject` by convex polygon `clip` ----
# Both cantos() outputs are CCW (verified below in sanity check), constant winding
# under proper rotation, so a single 'inside' test works for all edges.
def _inside(p, a, b):
    # is point p to the left of directed edge a->b (CCW polygon => left = inside)?
    return (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0]) >= 0

def _line_intersect(p1, p2, a, b):
    x1,y1=p1; x2,y2=p2; x3,y3=a; x4,y4=b
    den = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4)
    if abs(den) < 1e-12:
        return p2
    t = ((x1-x3)*(y3-y4) - (y1-y3)*(x3-x4)) / den
    return (x1 + t*(x2-x1), y1 + t*(y2-y1))

def clip_poly(subject, clip):
    output = subject
    for i in range(len(clip)):
        a, b = clip[i], clip[(i+1) % len(clip)]
        inp = output
        output = []
        if not inp:
            break
        for j in range(len(inp)):
            cur, prv = inp[j], inp[j-1]
            cur_in, prv_in = _inside(cur, a, b), _inside(prv, a, b)
            if cur_in:
                if not prv_in:
                    output.append(_line_intersect(prv, cur, a, b))
                output.append(cur)
            elif prv_in:
                output.append(_line_intersect(prv, cur, a, b))
    return output

def poly_area(poly):
    if len(poly) < 3:
        return 0.0
    s = 0.0
    for i in range(len(poly)):
        x1,y1 = poly[i]; x2,y2 = poly[(i+1) % len(poly)]
        s += x1*y2 - x2*y1
    return abs(s) / 2.0

def overlap_area(qa, qb):
    return poly_area(clip_poly(qa, qb))

# ---- load CSV ----
def load_rows(path=CSV_PATH):
    rows = []
    with open(path, newline='') as f:
        r = csv.DictReader(f)
        for row in r:
            rows.append(row)
    return rows

def lot_quad(row):
    x, z = float(row['x_m']), float(row['z_m'])
    w, d = float(row['frente_m']), float(row['prof_m'])
    giro = math.radians(float(row['giro_graus']))
    return cantos(x, z, max(1.0, w), max(1.0, d), giro)

def quarteirao_key(row):
    return (row['setor'], row['quarto'], row['quarteirao'])

# ================= SANITY CHECKS =================
def sanity(rows):
    print("=== 1) cantos() basic geometry sanity ===")
    # pick a small, unrotated-ish and a rotated lot
    import random
    random.seed(0)
    for idx in [1, 5000, 40000, 69999]:
        row = rows[idx]
        x,z = float(row['x_m']), float(row['z_m'])
        w,d = float(row['frente_m']), float(row['prof_m'])
        giro = float(row['giro_graus'])
        q = cantos(x,z,w,d, math.radians(giro))
        def dist(p,q): return math.hypot(p[0]-q[0], p[1]-q[1])
        e01 = dist(q[0], q[1])
        e12 = dist(q[1], q[2])
        e23 = dist(q[2], q[3])
        e30 = dist(q[3], q[0])
        area_shoelace = poly_area(q)
        print(f"  {row['lot_id']}: frente_m={w:.2f} prof_m={d:.2f} giro={giro:.2f} "
              f"| edge01={e01:.3f} edge12={e12:.3f} edge23={e23:.3f} edge30={e30:.3f} "
              f"| area_csv={row['area_m2']} area_shoelace={area_shoelace:.1f}")
        assert abs(e01 - w) < 0.01 and abs(e23 - w) < 0.01, "frente mismatch!"
        assert abs(e12 - d) < 0.01 and abs(e30 - d) < 0.01, "prof mismatch!"
    print("  OK: edge01/edge23 == frente_m, edge12/edge30 == prof_m, for giro=0 and giro!=0.")

    print()
    print("=== 2) winding order (CCW?) of cantos() output, at giro=0 and giro=90 ===")
    for giro_deg in [0, 37, 90, 180, 271]:
        q = cantos(0,0, 10, 4, math.radians(giro_deg))
        s = 0.0
        for i in range(4):
            x1,y1=q[i]; x2,y2=q[(i+1)%4]
            s += x1*y2 - x2*y1
        print(f"  giro={giro_deg:>3}: signed shoelace sum = {s:+.3f} ({'CCW' if s>0 else 'CW'})")

    print()
    print("=== 3) reproduce official test 4 (same-quarteirao SAT overlap) from the CSV ===")
    # Uses the SAME penetration test as conferir_lotes.py (SAT with 4 corners),
    # grouped by (setor,quarto,quarteirao), tolerance 0.02 m as in the script default.
    TOL = 0.02
    def penetracao(A, B):
        pior = 1e9
        for P, Q in ((A, B), (B, A)):
            for i in range(4):
                ex, ez = P[(i+1) % 4][0] - P[i][0], P[(i+1) % 4][1] - P[i][1]
                n = math.hypot(ex, ez)
                if n < 1e-9: continue
                nx, nz = -ez/n, ex/n
                pa = [p[0]*nx + p[1]*nz for p in P]; pb = [p[0]*nx + p[1]*nz for p in Q]
                sep = max(min(pb) - max(pa), min(pa) - max(pb))
                if sep > 0: return 0.0
                pior = min(pior, -sep)
        return pior
    by_q = collections.defaultdict(list)
    for row in rows:
        by_q[quarteirao_key(row)].append(row)
    pares = 0
    total_area = 0.0
    for key, items in by_q.items():
        quads = [lot_quad(r) for r in items]
        for a in range(len(items)):
            for b in range(a+1, len(items)):
                pen = penetracao(quads[a], quads[b])
                if pen > TOL:
                    pares += 1
                    total_area += overlap_area(quads[a], quads[b])
    print(f"  same-quarteirao pairs with penetration > {TOL} m: {pares}, exact overlap area sum = {total_area:.1f} m2")
    print("  (report claims: 12 pares / 14.8 m2 -- this should match closely)")

if __name__ == '__main__' and '--sanity' in sys.argv:
    rows = load_rows()
    sanity(rows)
    sys.exit(0)

# ================= FULL CROSS-QUARTEIRAO OVERLAP SCAN =================
def full_scan(rows, cell=CELL, out_pairs_csv=None):
    t0 = time.time()
    n = len(rows)
    xs = [0.0]*n; zs=[0.0]*n; quads=[None]*n; hd=[0.0]*n; qk=[None]*n
    for i, row in enumerate(rows):
        x, z = float(row['x_m']), float(row['z_m'])
        w, d = float(row['frente_m']), float(row['prof_m'])
        w = max(1.0, w); d = max(1.0, d)
        giro = math.radians(float(row['giro_graus']))
        xs[i] = x; zs[i] = z
        quads[i] = cantos(x, z, w, d, giro)
        hd[i] = 0.5*math.hypot(w, d)
        qk[i] = quarteirao_key(row)
    print(f"  loaded/prepped {n} lots in {time.time()-t0:.1f}s")

    # grid: insert lot i into every cell its (expanded by half-diag) bbox touches
    t1 = time.time()
    grid = collections.defaultdict(list)
    for i in range(n):
        x0 = int(math.floor((xs[i]-hd[i]) / cell)); x1 = int(math.floor((xs[i]+hd[i]) / cell))
        z0 = int(math.floor((zs[i]-hd[i]) / cell)); z1 = int(math.floor((zs[i]+hd[i]) / cell))
        for cx in range(x0, x1+1):
            for cz in range(z0, z1+1):
                grid[(cx, cz)].append(i)
    print(f"  grid built: {len(grid)} occupied cells in {time.time()-t1:.1f}s")

    # candidate pairs = any two lot indices sharing a cell (dedup via seen set)
    t2 = time.time()
    seen = set()
    candidates = []
    for cell_list in grid.values():
        m = len(cell_list)
        if m < 2:
            continue
        for a in range(m):
            ia = cell_list[a]
            for b in range(a+1, m):
                ib = cell_list[b]
                key = (ia, ib) if ia < ib else (ib, ia)
                if key in seen:
                    continue
                seen.add(key)
                # cheap circle-bound reject before exact clip
                dx = xs[ia]-xs[ib]; dz = zs[ia]-zs[ib]
                if dx*dx+dz*dz > (hd[ia]+hd[ib])**2:
                    continue
                candidates.append(key)
    print(f"  {len(candidates)} candidate pairs (after circle-bound reject) "
          f"from {len(seen)} unique bbox-sharing pairs, "
          f"in {time.time()-t2:.1f}s")

    # exact overlap on candidates
    t3 = time.time()
    THRESH = 1.0  # m2, per report's stated threshold
    overlaps = []  # (area, i, j)
    for (i, j) in candidates:
        a = overlap_area(quads[i], quads[j])
        if a > THRESH:
            overlaps.append((a, i, j))
    print(f"  exact overlap computed on {len(candidates)} candidates in {time.time()-t3:.1f}s")

    overlaps.sort(reverse=True)
    total_area = sum(a for a,_,_ in overlaps)
    lots_involved = set()
    for a,i,j in overlaps:
        lots_involved.add(i); lots_involved.add(j)

    same_q = [(a,i,j) for a,i,j in overlaps if qk[i]==qk[j]]
    diff_q = [(a,i,j) for a,i,j in overlaps if qk[i]!=qk[j]]

    print()
    print("=== FULL SCAN RESULTS ===")
    print(f"  total lots: {n}")
    print(f"  pairs with overlap area > {THRESH} m2: {len(overlaps)}")
    print(f"  total overlap area: {total_area:.1f} m2")
    total_lot_area = sum(float(r['area_m2']) for r in rows)
    print(f"  total lot area_m2 (sum of CSV column): {total_lot_area:.1f} m2")
    print(f"  overlap / total area: {100*total_area/total_lot_area:.2f} %")
    print(f"  distinct lots touched: {len(lots_involved)} ({100*len(lots_involved)/n:.2f}%)")
    print(f"  pairs WITHIN same quarteirao: {len(same_q)}, area {sum(a for a,_,_ in same_q):.1f} m2")
    print(f"  pairs BETWEEN different quarteiroes: {len(diff_q)}, area {sum(a for a,_,_ in diff_q):.1f} m2")

    # same setor+quarto but different quarteirao (B) vs different quarto entirely
    def sq(i): return (qk[i][0], qk[i][1])  # (setor, quarto)
    same_quarto_diffB = [(a,i,j) for a,i,j in diff_q if sq(i)==sq(j)]
    diff_quarto = [(a,i,j) for a,i,j in diff_q if sq(i)!=sq(j)]
    print(f"    of which same (setor,quarto), diff quarteirao B: {len(same_quarto_diffB)} pairs, "
          f"{sum(a for a,_,_ in same_quarto_diffB):.1f} m2")
    print(f"    of which different quarto too: {len(diff_quarto)} pairs, "
          f"{sum(a for a,_,_ in diff_quarto):.1f} m2")

    # by setor
    print()
    print("  by setor (of the pair's setor if same, else 'mixed'):")
    by_setor = collections.Counter(); by_setor_area = collections.Counter()
    mixed_setor = collections.Counter(); mixed_setor_area = collections.Counter()
    for a,i,j in overlaps:
        si, sj = qk[i][0], qk[j][0]
        if si == sj:
            by_setor[si]+=1; by_setor_area[si]+=a
        else:
            key=tuple(sorted([si,sj]))
            mixed_setor[key]+=1; mixed_setor_area[key]+=a
    for s in sorted(by_setor, key=lambda k:int(k)):
        print(f"    S{int(s):02d}: {by_setor[s]} pares / {by_setor_area[s]:.1f} m2")
    if mixed_setor:
        print("  cross-setor pairs (different setor entirely):")
        for k,v in mixed_setor.most_common():
            print(f"    S{int(k[0]):02d}-S{int(k[1]):02d}: {v} pares / {mixed_setor_area[k]:.1f} m2")

    # top quarto-seam adjacencies (setor, quartoA, quartoB) by area
    print()
    print("  top quarto-boundary seams by area (setor, quartoA-quartoB):")
    seam = collections.Counter(); seam_area = collections.Counter()
    for a,i,j in diff_quarto:
        s = qk[i][0]
        if qk[j][0] != s:  # only same-setor seams here
            continue
        qa, qb = sorted([int(qk[i][1]), int(qk[j][1])])
        key = (s, qa, qb)
        seam[key]+=1; seam_area[key]+=a
    for key, v in seam_area.most_common(15):
        print(f"    S{int(key[0]):02d} Q{key[1]:02d}-Q{key[2]:02d}: {seam[key]} pares / {v:.1f} m2")

    print()
    print("  top 10 overlaps by area:")
    for a,i,j in overlaps[:10]:
        ri, rj = rows[i], rows[j]
        print(f"    {a:9.1f} m2  {ri['lot_id']} (x={xs[i]:.2f},z={zs[i]:.2f}) x "
              f"{rj['lot_id']} (x={xs[j]:.2f},z={zs[j]:.2f})")

    if out_pairs_csv:
        with open(out_pairs_csv, 'w', newline='') as f:
            wtr = csv.writer(f)
            wtr.writerow(['area_m2','lot_id_a','lot_id_b','setor_a','quarto_a','quarteirao_a',
                          'setor_b','quarto_b','quarteirao_b'])
            for a,i,j in overlaps:
                ri, rj = rows[i], rows[j]
                wtr.writerow([f"{a:.2f}", ri['lot_id'], rj['lot_id'],
                              ri['setor'], ri['quarto'], ri['quarteirao'],
                              rj['setor'], rj['quarto'], rj['quarteirao']])
        print(f"\n  wrote {len(overlaps)} pairs to {out_pairs_csv}")

    return overlaps, rows

if __name__ == '__main__' and '--full' in sys.argv:
    rows = load_rows()
    out_csv = None
    for a in sys.argv:
        if a.startswith('--out='):
            out_csv = a.split('=',1)[1]
    full_scan(rows, out_pairs_csv=out_csv)

# ================= SPECIFIC PAIR CHECK =================
if __name__ == '__main__' and '--pair' in sys.argv:
    idx = sys.argv.index('--pair')
    id1, id2 = sys.argv[idx+1], sys.argv[idx+2]
    rows = load_rows()
    by_id = {r['lot_id']: r for r in rows}
    r1, r2 = by_id[id1], by_id[id2]
    q1, q2 = lot_quad(r1), lot_quad(r2)
    print(f"{id1}: x={r1['x_m']} z={r1['z_m']} frente={r1['frente_m']} prof={r1['prof_m']} giro={r1['giro_graus']}")
    print(f"  corners: {q1}")
    print(f"{id2}: x={r2['x_m']} z={r2['z_m']} frente={r2['frente_m']} prof={r2['prof_m']} giro={r2['giro_graus']}")
    print(f"  corners: {q2}")
    a = overlap_area(q1, q2)
    print(f"exact polygon-clip overlap area: {a:.2f} m2")

    # independent cross-check via fine-grid rasterization (Monte Carlo grid, not random)
    def point_in_quad(pt, quad):
        # same winding (CCW) as cantos(); point-in-convex-polygon via same 'inside' test
        return all(_inside(pt, quad[k], quad[(k+1) % 4]) for k in range(4))
    xs_ = [p[0] for p in q1+q2]; zs_ = [p[1] for p in q1+q2]
    x0,x1 = min(xs_), max(xs_); z0,z1 = min(zs_), max(zs_)
    step = 0.05
    nx = int((x1-x0)/step)+1; nz = int((z1-z0)/step)+1
    cnt = 0
    xr = x0
    total_pts = 0
    while xr <= x1:
        zr = z0
        while zr <= z1:
            total_pts += 1
            if point_in_quad((xr,zr), q1) and point_in_quad((xr,zr), q2):
                cnt += 1
            zr += step
        xr += step
    area_mc = cnt * step * step
    print(f"grid-rasterization ({step} m step, {total_pts} pts) overlap area: {area_mc:.2f} m2")
