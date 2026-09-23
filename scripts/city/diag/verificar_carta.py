#!/usr/bin/env python3
"""
Contra-checagem INDEPENDENTE do relatorio do medidor "carta".
Le so os 4 arquivos selados + a malha (nao importa conferir_lotes.py, so
copia a funcao cantos() dele, linha 135, conferida a mao contra o comentario
do esquema em cidade-malha.json e contra scripts/city/carta.mjs:373-377,
que sao byte-a-byte a mesma formula).

Uso:
  python3 verificar_carta.py            # roda tudo
  python3 verificar_carta.py --amostra  # so imprime exemplos p/ conferencia manual
"""
import csv, json, math, sys, collections, os

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'

def cantos(x, z, w, d, giro_rad):
    """COPIA EXATA de scripts/city/conferir_lotes.py:135-138.
    giro_rad é RADIANOS. w = frente (eixo local x = 'testada'),
    d = profundidade (eixo local z). Mesma formula de carta.mjs:373-377
    (retangulo) e do esquema documentado em cidade-malha.json."""
    ca, sa = math.cos(giro_rad), math.sin(giro_rad)
    return [(x + dx*ca - dz*sa, z + dx*sa + dz*ca)
            for dx, dz in ((-w/2, -d/2), (w/2, -d/2), (w/2, d/2), (-w/2, d/2))]

def poligono_area(pts):
    a = 0.0
    n = len(pts)
    for i in range(n):
        x1, z1 = pts[i]; x2, z2 = pts[(i+1) % n]
        a += x1*z2 - x2*z1
    return abs(a) / 2.0

def dentro_de(P, Q, tol=1e-6):
    """P (lista de 4 cantos) esta inteiramente dentro de Q (lista de 4 cantos,
    retangulo convexo)? Testa via eixos separadores de Q (SAT contra retangulo
    convexo = suficiente pra 'contido')."""
    for i in range(4):
        ex, ez = Q[(i+1) % 4][0] - Q[i][0], Q[(i+1) % 4][1] - Q[i][1]
        n = math.hypot(ex, ez)
        if n < 1e-9: continue
        nx, nz = -ez/n, ex/n
        qs = [q[0]*nx + q[1]*nz for q in Q]
        qmin, qmax = min(qs), max(qs)
        for p in P:
            v = p[0]*nx + p[1]*nz
            if v < qmin - tol or v > qmax + tol:
                return False
    return True

def penetracao(A, B):
    """Mesma funcao de conferir_lotes.py:139-152: quanto A entra em B (metros).
    0 ou menos = nao se tocam."""
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

def carrega_csv():
    linhas = []
    with open(os.path.join(RAIZ, 'data/dogcity_lotes.csv'), newline='', encoding='utf-8') as f:
        r = csv.DictReader(f)
        for row in r:
            # NAO filtra __projeto: o teste de "cabe no retangulo do quarteirao"
            # e sobre TODO lote desenhado, dono ou nao (68.115 = 1-6 inteiro).
            linhas.append(row)
    return linhas

def carrega_malha():
    with open(os.path.join(RAIZ, 'public/city/cidade-malha.json'), encoding='utf-8') as f:
        return json.load(f)

def qid(lot_id):
    return '-'.join(lot_id.split('-')[:3])

# ─────────────────────────────────────────────────────────────────────────
# GRADE ESPACIAL (celulas de 100 m) para achar vizinhos sem 70k x 17k
# ─────────────────────────────────────────────────────────────────────────
CEL = 100.0
def cel_de(x, z):
    return (int(x // CEL), int(z // CEL))

def celulas_ocupadas(cx, cz, raio_cel=1):
    for dx in range(-raio_cel, raio_cel + 1):
        for dz in range(-raio_cel, raio_cel + 1):
            yield (cx + dx, cz + dz)


TOL_CONTENCAO = float(os.environ.get('TOL_CONTENCAO', '0.05'))

def main():
    modo_amostra = '--amostra' in sys.argv
    print(f'[cfg] TOL_CONTENCAO = {TOL_CONTENCAO} m')

    linhas = carrega_csv()
    malha = carrega_malha()
    print(f'[1] CSV: {len(linhas)} lotes lidos (esperado 70709; __projeto excluido se houver)')

    qblocos = {b['id']: b for b in malha['quarteiroes']}
    print(f'[2] malha: {len(qblocos)} quarteiroes (esperado 2071)')

    # ---------------------------------------------------------------
    # TESTE A: cada lote (setores 1-6) cabe dentro do retangulo do
    # PROPRIO quarteirao da malha (cidade-malha.json), usando cantos()
    # com a MESMA formula da camada 2 do carta.mjs.
    # ---------------------------------------------------------------
    testados = 0
    violacoes = []
    por_quarteirao_1a6 = collections.defaultdict(list)
    for r in linhas:
        setor = int(r['setor'])
        if setor > 6:
            continue
        q = qid(r['lot_id'])
        por_quarteirao_1a6[q].append(r)

    for q, lotes_q in por_quarteirao_1a6.items():
        b = qblocos.get(q)
        if b is None:
            for r in lotes_q:
                violacoes.append((r['lot_id'], 'quarteirao nao existe na malha'))
            continue
        Q = cantos(b['x'], b['z'], b['lado'], b['prof'], math.radians(b['giro']))
        for r in lotes_q:
            testados += 1
            x, z = float(r['x_m']), float(r['z_m'])
            w, d = float(r['frente_m']), float(r['prof_m'])
            giro_graus = float(r['giro_graus'])
            P = cantos(x, z, w, d, math.radians(giro_graus))
            if not dentro_de(P, Q, tol=TOL_CONTENCAO):
                # calcula o pior extravasamento em metros pra nao contar ruido de arredondamento
                pior = 0.0
                for i in range(4):
                    ex, ez = Q[(i+1) % 4][0] - Q[i][0], Q[(i+1) % 4][1] - Q[i][1]
                    n = math.hypot(ex, ez)
                    nx, nz = -ez/n, ex/n
                    qs = [pp[0]*nx + pp[1]*nz for pp in Q]
                    qmin, qmax = min(qs), max(qs)
                    for p in P:
                        v = p[0]*nx + p[1]*nz
                        pior = max(pior, qmin - v, v - qmax)
                violacoes.append((r['lot_id'], round(pior, 3)))

    print(f'[A] lotes testados contra retangulo do proprio quarteirao (setores 1-6): {testados}')
    print(f'[A] violacoes (fora por mais de {TOL_CONTENCAO} m): {len(violacoes)}')
    if violacoes:
        piores = sorted(violacoes, key=lambda t: -t[1] if isinstance(t[1], (int, float)) else 0)[:10]
        print('    10 piores:', piores)

    # ---------------------------------------------------------------
    # TESTE B: quarteiroes com 2+ fileiras ocupadas (a "travessa interna
    # nunca desenhada" so importa quando ha mais de 1 fileira com lote).
    # ---------------------------------------------------------------
    com_2mais_fileiras = 0
    pior_caso = None
    for b in malha['quarteiroes']:
        lpf = b.get('lotesPorFileira', [])
        ocupadas = sum(1 for n in lpf if n > 0)
        if ocupadas >= 2:
            com_2mais_fileiras += 1
        if pior_caso is None or b.get('lotes', 0) > pior_caso.get('lotes', 0):
            if ocupadas >= 2:
                pior_caso = b
    print(f'[B] quarteiroes com 2+ fileiras ocupadas: {com_2mais_fileiras} de {len(malha["quarteiroes"])}')
    if pior_caso:
        print(f'    maior (por lotes, entre os com 2+ fileiras): {pior_caso["id"]}: '
              f'{pior_caso["lotes"]} lotes, fileirasComLote={pior_caso.get("fileirasComLote")}, '
              f'lado={pior_caso["lado"]} prof={pior_caso["prof"]}')
    # maior estritamente por numero de lotes entre TODOS
    maior_lotes = max(malha['quarteiroes'], key=lambda b: b.get('lotes', 0))
    print(f'    maior por lotes (geral): {maior_lotes["id"]}: {maior_lotes["lotes"]} lotes, '
          f'lado={maior_lotes["lado"]} prof={maior_lotes["prof"]}, '
          f'lotesPorFileira={maior_lotes.get("lotesPorFileira")}')

    # ---------------------------------------------------------------
    # TESTE C: retangulos de quarteiroes vizinhos que se sobrepoem
    # (grade de 100 m pra achar vizinhos sem N^2)
    # ---------------------------------------------------------------
    grade = collections.defaultdict(list)
    retangulos = {}
    for b in malha['quarteiroes']:
        Q = cantos(b['x'], b['z'], b['lado'], b['prof'], math.radians(b['giro']))
        retangulos[b['id']] = (b, Q)
        raio_bloco = math.hypot(b['lado'], b['prof']) / 2.0
        r_cel = int(raio_bloco // CEL) + 1
        cx, cz = cel_de(b['x'], b['z'])
        for c in celulas_ocupadas(cx, cz, r_cel):
            grade[c].append(b['id'])

    pares_vistos = set()
    pares_sobrepostos = []
    TOL = 0.5
    ids = list(retangulos.keys())
    for bid, (b, Q) in retangulos.items():
        cx, cz = cel_de(b['x'], b['z'])
        raio_bloco = math.hypot(b['lado'], b['prof']) / 2.0
        r_cel = int(raio_bloco // CEL) + 1
        vizinhos = set()
        for c in celulas_ocupadas(cx, cz, r_cel):
            vizinhos.update(grade.get(c, []))
        for vid in vizinhos:
            if vid == bid: continue
            par = tuple(sorted((bid, vid)))
            if par in pares_vistos: continue
            pares_vistos.add(par)
            b2, Q2 = retangulos[vid]
            pen = penetracao(Q, Q2)
            if pen > TOL:
                pares_sobrepostos.append((par, pen))

    pares_sobrepostos.sort(key=lambda t: -t[1])
    print(f'[C] pares de retangulos de quarteirao vizinhos que se sobrepoem (>{TOL} m): {len(pares_sobrepostos)}')
    if pares_sobrepostos[:5]:
        print('    top 5:', [(p, round(v, 1)) for p, v in pares_sobrepostos[:5]])

    # por setor (usa o setor do PRIMEIRO id do par; os pares sao quase sempre no mesmo setor)
    por_setor = collections.Counter()
    pares_intersetor = 0
    for (a_id, b_id), pen in pares_sobrepostos:
        sa = qblocos[a_id]['setor']; sb = qblocos[b_id]['setor']
        if sa != sb:
            pares_intersetor += 1
        por_setor[sa] += 1
    print(f'    por setor (do primeiro id do par): {dict(sorted(por_setor.items()))}')
    print(f'    pares com setores diferentes nos dois lados: {pares_intersetor}')

    # ---------------------------------------------------------------
    # TESTE D: desses pares com retangulo sobreposto, os LOTES REAIS
    # (CSV) tambem se invadem?
    # ---------------------------------------------------------------
    lotes_por_q = collections.defaultdict(list)
    for r in linhas:
        lotes_por_q[qid(r['lot_id'])].append(r)

    testaveis = 0
    tambem_invadem = 0
    pior_real = (0.0, '', '')
    for (a_id, b_id), pen_ret in pares_sobrepostos:
        la = lotes_por_q.get(a_id, [])
        lb = lotes_por_q.get(b_id, [])
        if not la or not lb:
            continue
        testaveis += 1
        Pa = []
        for r in la:
            x, z = float(r['x_m']), float(r['z_m'])
            w, d = float(r['frente_m']), float(r['prof_m'])
            Pa.append((r['lot_id'], cantos(x, z, w, d, math.radians(float(r['giro_graus'])))))
        Pb = []
        for r in lb:
            x, z = float(r['x_m']), float(r['z_m'])
            w, d = float(r['frente_m']), float(r['prof_m'])
            Pb.append((r['lot_id'], cantos(x, z, w, d, math.radians(float(r['giro_graus'])))))
        achou = False
        pior_par = 0.0
        pior_ids = ('', '')
        for ida, A in Pa:
            for idb, B in Pb:
                p = penetracao(A, B)
                if p > TOL:
                    achou = True
                    if p > pior_par:
                        pior_par = p; pior_ids = (ida, idb)
        if achou:
            tambem_invadem += 1
            if pior_par > pior_real[0]:
                pior_real = (pior_par, pior_ids[0], pior_ids[1])
    print(f'[D] pares (de C) testaveis (ambos os quarteiroes tem lote no CSV): {testaveis}')
    print(f'[D] desses, pares onde os LOTES REAIS tambem se invadem (>{TOL} m): {tambem_invadem}')
    print(f'    pior invasao real lote-a-lote: {pior_real[0]:.1f} m em {pior_real[1]} x {pior_real[2]}')

    if modo_amostra:
        print('\n[amostra] 3 lotes quaisquer, cantos calculados:')
        for r in linhas[:3]:
            x, z = float(r['x_m']), float(r['z_m'])
            w, d = float(r['frente_m']), float(r['prof_m'])
            g = float(r['giro_graus'])
            P = cantos(x, z, w, d, math.radians(g))
            print(f"  {r['lot_id']}: x={x} z={z} frente={w} prof={d} giro={g}")
            for p in P:
                print(f'    canto: ({p[0]:.2f}, {p[1]:.2f})')
            # confere que dist entre canto0-canto1 == frente e canto1-canto2 == prof
            d01 = math.hypot(P[1][0]-P[0][0], P[1][1]-P[0][1])
            d12 = math.hypot(P[2][0]-P[1][0], P[2][1]-P[1][1])
            print(f'    |canto0-canto1|={d01:.3f} (deve ser frente={w}); |canto1-canto2|={d12:.3f} (deve ser prof={d})')

if __name__ == '__main__':
    main()
