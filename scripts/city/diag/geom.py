"""
Utilidades geometricas independentes, escritas do zero para conferir o
relatorio do medidor "programa". NAO importa nenhum modulo do repo (o
enunciado pede para copiar cantos() em vez de importar conferir_lotes.py,
que roda coisas no import). Python puro, sem shapely, sem numpy (nao precisei
de grade 100m aqui porque o produto lotes x pecas é 70709 x ~90 ~ 6.4M pares
no pior caso e cada teste é O(lados), o filtro por raio jah reduz isso a
poucas centenas de candidatos por peça -- a grade so seria obrigatoria para
lotes x vias (70709 x 17198), que este script nao faz).
"""
import math

# ---- copiada literalmente de scripts/city/conferir_lotes.py:135 ----
def cantos(x, z, w, d, giro):
    ca, sa = math.cos(giro), math.sin(giro)
    return [(x + dx*ca - dz*sa, z + dx*sa + dz*ca)
            for dx, dz in ((-w/2, -d/2), (w/2, -d/2), (w/2, d/2), (-w/2, d/2))]


def poly_edges_normals(poly):
    n = len(poly)
    out = []
    for i in range(n):
        x1, z1 = poly[i]
        x2, z2 = poly[(i + 1) % n]
        ex, ez = x2 - x1, z2 - z1
        L = math.hypot(ex, ez)
        if L < 1e-9:
            continue
        out.append((-ez / L, ex / L))
    return out


def sat_overlap(A, B):
    """SAT exato para dois poligonos CONVEXOS (qualquer numero de lados).
    Retorna profundidade de penetracao (>=0) se sobrepõem, ou None se separados."""
    axes = poly_edges_normals(A) + poly_edges_normals(B)
    if not axes:
        return None
    min_ov = 1e18
    for nx, nz in axes:
        pa = [p[0]*nx + p[1]*nz for p in A]
        pb = [p[0]*nx + p[1]*nz for p in B]
        amin, amax = min(pa), max(pa)
        bmin, bmax = min(pb), max(pb)
        sep = max(bmin - amax, amin - bmax)
        if sep > 0:
            return None
        ov = min(amax, bmax) - max(amin, bmin)
        if ov < min_ov:
            min_ov = ov
    return min_ov


def is_convex(poly):
    n = len(poly)
    if n < 3:
        return True
    signs = []
    for i in range(n):
        ax, az = poly[i]
        bx, bz = poly[(i+1) % n]
        cx, cz = poly[(i+2) % n]
        cross = (bx-ax)*(cz-az) - (bz-az)*(cx-ax)
        if abs(cross) > 1e-9:
            signs.append(cross > 0)
    return len(set(signs)) <= 1


def point_in_polygon(pt, poly):
    """ray casting, funciona para poligono simples convexo ou nao."""
    x, z = pt
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        xi, zi = poly[i]
        xj, zj = poly[j]
        if ((zi > z) != (zj > z)) and (x < (xj - xi) * (z - zi) / (zj - zi + 1e-30) + xi):
            inside = not inside
        j = i
    return inside


def dist_point_to_segment(pt, a, b):
    px, pz = pt
    ax, az = a
    bx, bz = b
    dx, dz = bx - ax, bz - az
    L2 = dx*dx + dz*dz
    if L2 < 1e-12:
        return math.hypot(px-ax, pz-az)
    t = max(0.0, min(1.0, ((px-ax)*dx + (pz-az)*dz) / L2))
    projx, projz = ax + t*dx, az + t*dz
    return math.hypot(px-projx, pz-projz)


def dist_point_to_polygon_boundary(pt, poly):
    n = len(poly)
    return min(dist_point_to_segment(pt, poly[i], poly[(i+1) % n]) for i in range(n))


def segments_intersect(a1, a2, b1, b2):
    def cross(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    d1 = cross(b1, b2, a1)
    d2 = cross(b1, b2, a2)
    d3 = cross(a1, a2, b1)
    d4 = cross(a1, a2, b2)
    if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
       ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)):
        return True
    return False


def general_overlap_depth(A, B):
    """Funciona para poligono simples QUALQUER (convexo ou nao, ex.: os
    crescentes do Founders Club). Profundidade aproximada = maior distancia
    de um vertice de A dentro de B (ou vice-versa) ate a borda mais proxima;
    se nenhum vertice esta dentro mas alguma aresta cruza (caso 'cruz'), conta
    como sobreposicao com profundidade pequena positiva (1e-6)."""
    best = None
    for p in A:
        if point_in_polygon(p, B):
            d = dist_point_to_polygon_boundary(p, B)
            if best is None or d > best:
                best = d
    for p in B:
        if point_in_polygon(p, A):
            d = dist_point_to_polygon_boundary(p, A)
            if best is None or d > best:
                best = d
    if best is not None:
        return best
    nA, nB = len(A), len(B)
    for i in range(nA):
        for j in range(nB):
            if segments_intersect(A[i], A[(i+1) % nA], B[j], B[(j+1) % nB]):
                return 1e-6
    return None


def poly_min_max_radius(poly):
    """menor e maior distancia da origem ao poligono CONVEXO (assume convexo)."""
    inside = point_in_polygon((0.0, 0.0), poly)
    if inside:
        mind = 0.0
    else:
        mind = dist_point_to_polygon_boundary((0.0, 0.0), poly)
    maxd = max(math.hypot(p[0], p[1]) for p in poly)
    return mind, maxd


def anel_overlap(poly, r, larg):
    """penetracao BRUTA (m) do poligono convexo do lote no anel [r-larg/2, r+larg/2].
    Quem chama compara esse valor bruto com o tol diretamente (> tol), em vez de
    encolher a faixa antes: encolher so bate com 'raw - tol' quando o lote atravessa
    o anel inteiro (mind<R_lo E maxd>R_hi); em penetracao parcial (soh um lado
    dentro) o encolhimento por clamp NAO equivale a subtrair tol do valor bruto,
    e da contagem errada perto da fronteira (achei isso comparando com AN4: dava
    550 em vez dos 546 do relatorio ate eu trocar para este calculo)."""
    mind, maxd = poly_min_max_radius(poly)
    r_lo, r_hi = r - larg/2, r + larg/2
    if maxd <= r_lo or mind >= r_hi:
        return None
    return min(maxd, r_hi) - max(mind, r_lo)
