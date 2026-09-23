#!/usr/bin/env python3
"""
Checagem independente da alegacao "quarteiroes cortados por um segmento de
anel estrutural: 525 de 2071 (25,4%)".

Metodo: para cada quarteirao (retangulo via cantos(), mesma formula de
scripts/city/conferir_lotes.py:135 e de carta.mjs:373-377), testa se algum
segmento de anel (tipo=='anel' e larg>=20 em public/city/mapa/vias.json)
cruza o INTERIOR do retangulo (nao so encosta na borda).

Uso: python3 verificar_aneis_cortam.py
"""
import json, math, collections, os

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'

def cantos(x, z, w, d, giro_rad):
    ca, sa = math.cos(giro_rad), math.sin(giro_rad)
    return [(x + dx*ca - dz*sa, z + dx*sa + dz*ca)
            for dx, dz in ((-w/2, -d/2), (w/2, -d/2), (w/2, d/2), (-w/2, d/2))]

def ponto_dentro(p, Q, tol=1e-6):
    for i in range(4):
        ex, ez = Q[(i+1) % 4][0] - Q[i][0], Q[(i+1) % 4][1] - Q[i][1]
        n = math.hypot(ex, ez)
        if n < 1e-9: continue
        nx, nz = -ez/n, ex/n
        qs = [q[0]*nx + q[1]*nz for q in Q]
        v = p[0]*nx + p[1]*nz
        if v < min(qs) - tol or v > max(qs) + tol:
            return False
    return True

def segs_cruzam(p1, p2, p3, p4):
    def cruz(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    d1 = cruz(p3, p4, p1); d2 = cruz(p3, p4, p2)
    d3 = cruz(p1, p2, p3); d4 = cruz(p1, p2, p4)
    if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
       ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)):
        return True
    return False

def segmento_corta_retangulo(s0, s1, Q):
    """True se o segmento (s0,s1) tem alguma parte estritamente dentro de Q,
    ou seja cruza pelo menos uma aresta de Q, ou uma ponta esta dentro."""
    if ponto_dentro(s0, Q) or ponto_dentro(s1, Q):
        return True
    for i in range(4):
        if segs_cruzam(s0, s1, Q[i], Q[(i+1) % 4]):
            return True
    return False

CEL = 100.0
def cel_de(x, z):
    return (int(x // CEL), int(z // CEL))

def main():
    malha = json.load(open(os.path.join(RAIZ, 'public/city/cidade-malha.json')))
    vias = json.load(open(os.path.join(RAIZ, 'public/city/mapa/vias.json')))

    aneis = [v for v in vias if v.get('tipo') == 'anel' and v.get('larg', 0) >= 20]
    print(f'segmentos de anel estrutural (tipo=anel, larg>=20): {len(aneis)} (relatorio: 8775)')

    # grade: indexa segmentos de anel pelas celulas que sua bbox toca
    grade = collections.defaultdict(list)
    for idx, v in enumerate(aneis):
        pts = v['pontos']
        xs = [p[0] for p in pts]; zs = [p[1] for p in pts]
        cx0, cx1 = cel_de(min(xs), 0)[0], cel_de(max(xs), 0)[0]
        cz0, cz1 = cel_de(0, min(zs))[1], cel_de(0, max(zs))[1]
        for cx in range(cx0, cx1 + 1):
            for cz in range(cz0, cz1 + 1):
                grade[(cx, cz)].append(idx)

    cortados = 0
    exemplos = []
    for b in malha['quarteiroes']:
        Q = cantos(b['x'], b['z'], b['lado'], b['prof'], math.radians(b['giro']))
        raio_bloco = math.hypot(b['lado'], b['prof']) / 2.0
        r_cel = int(raio_bloco // CEL) + 1
        cx, cz = cel_de(b['x'], b['z'])
        candidatos = set()
        for dx in range(-r_cel, r_cel + 1):
            for dz in range(-r_cel, r_cel + 1):
                candidatos.update(grade.get((cx + dx, cz + dz), []))
        cortado = False
        for idx in candidatos:
            pts = aneis[idx]['pontos']
            for k in range(len(pts) - 1):
                if segmento_corta_retangulo(tuple(pts[k]), tuple(pts[k+1]), Q):
                    cortado = True
                    break
            if cortado:
                break
        if cortado:
            cortados += 1
            if len(exemplos) < 5:
                exemplos.append(b['id'])

    print(f'quarteiroes cortados por >=1 segmento de anel estrutural: {cortados} de {len(malha["quarteiroes"])} '
          f'({100*cortados/len(malha["quarteiroes"]):.1f}%)  (relatorio: 525 de 2071, 25,4%)')
    print('exemplos:', exemplos)

if __name__ == '__main__':
    main()
