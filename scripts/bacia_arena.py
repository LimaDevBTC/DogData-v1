#!/usr/bin/env python3
"""Bacia da ARENA COBERTA da DogCity, pela mesma linha de visada do estádio.

⚠️ ARENA NÃO É ESTÁDIO PEQUENO. O estádio tem campo FIFA de 105 x 68 e a plateia
longe; a arena tem pista de espetáculo e o público EM CIMA dela, e é isso que
define a experiência. Por isso a inclinação aqui é maior (o teto de 34 graus vira
regra, não folga) e a primeira fila encosta.

Programa: 12.000 lugares, 160 x 140 m de pegada, pé-direito 40 m
(`plano-diretor.md:363`).
"""
import math

# a pista: multiuso (quadra, gelo, palco), com zona livre em volta
# ⚠️ 48 x 28 E NÃO 60 x 40. A pista de 60 x 40 é de hóquei; arena poliesportiva
# tem quadra de 40 x 20 mais zona livre. Com a pista grande, 12.000 lugares NÃO
# CABEM nos 160 x 140 que o programa reserva: o solver não achou uma única
# combinação com inclinação dentro dos 34 graus.
PISTA_X, PISTA_Z = 48.0, 28.0
RECUO_1A = 6.0              # a arena aproxima: 6,0 m contra 8,0 do estádio
OLHO, C = 1.20, 0.090
RC = 18.0                   # canto mais fechado que o do estádio (38 m)
INCL_MAX = 34.0

# nível: (nome, fileiras, tread, largura do assento, recuo, tipo)
#
# ⚠️ OS 12.000 DO PROGRAMA ERAM PEQUENOS PARA A CASCA, e isso só apareceu quando
# a pele ficou pronta: o envelope de 165 x 145 m que o cume desenhou comporta
# 24.181 lugares, o dobro. Construir 12.000 dentro dele seria pagar fachada de
# arena grande para receber plateia de arena média, e o fundador pediu uma peça
# de SHOW. Subiu para 24.181.
#
# ⚠️ E NÃO BASTA ACRESCENTAR FILEIRA: a linha de visada faz a inclinação SUBIR a
# cada fila que recua, e aos 26 degraus do anel superior com passo de 0,80 ela
# passava de 34 graus, que é o teto de evacuação. Quem paga a conta é o TREAD:
# 0,98 no superior devolve 33,6 graus. Fileira a mais sem passo a mais é
# arquibancada fora de norma.
#
# Varredura completa em `arena.md`. Decisão do fundador em 06/09: **28.240**, que
# é o ponto mais alto que a varredura devolve com a inclinação ainda abaixo dos
# 34 graus. Última fila a 34,4 m e a 90 m do centro; o teto de visada da FIFA é
# 190 m, então sobra folga de sobra mesmo na pior poltrona.
NIVEIS = [
    ("inferior",  14, 0.85, 0.52, 0.0, "geral"),
    ("camarote",   2, 0.95, 0.60, 4.0, "camarote"),
    ("superior",  30, 1.04, 0.50, 4.0, "geral"),
]
CAMAROTES, POR_CAIXA, PERDAS = 36, 10, 0.17


def perim(dx, dz, r):
    return 2*(2*dx-2*r) + 2*(2*dz-2*r) + 2*math.pi*r


def bacia(niveis=NIVEIS):
    x0, z0 = PISTA_X/2+RECUO_1A, PISTA_Z/2+RECUO_1A
    rec, D, N, y = 0.0, z0 - PISTA_Z/2, 1.2 + OLHO, 1.2
    out = []
    for nome, n, T, La, salto, tipo in niveis:
        if salto:
            Dn = D + salto
            N = (Dn * (N + C)) / D
            D, rec, y = Dn, rec + salto, N - OLHO
        y0, sobe, ass, rs = y, 0.0, 0.0, []
        for i in range(n):
            ass += perim(x0+rec+i*T, z0+rec+i*T, RC) / La
            N1 = ((D+T)*(N+C))/D
            rs.append(N1-N); sobe += N1-N; N = N1; D += T
        rec += n*T
        y += sobe
        if tipo == "camarote":
            ass = CAMAROTES*POR_CAIXA
        out.append(dict(nome=nome, tipo=tipo, n=n, y0=y0, rec=rec-n*T, proj=n*T,
                        sobe=sobe, incl=math.degrees(math.atan((sum(rs)/len(rs))/T)),
                        ass=ass, y=y, T=T, La=La))
    return out, rec, y


def fileiras(niveis=NIVEIS):
    """A bacia como DADO, para o modelo do Blender consumir."""
    x0, z0 = PISTA_X/2+RECUO_1A, PISTA_Z/2+RECUO_1A
    rec, D, N, y = 0.0, z0 - PISTA_Z/2, 1.2 + OLHO, 1.2
    out = []
    for nome, n, T, La, salto, tipo in niveis:
        if salto:
            Dn = D + salto
            N = (Dn*(N+C))/D
            D, rec, y = Dn, rec + salto, N - OLHO
        for i in range(n):
            out.append((rec, y, T, La, tipo, nome))
            N1 = ((D+T)*(N+C))/D
            y += N1-N; N = N1; D += T; rec += T
    return out


def geometria():
    f = fileiras()
    proj = f[-1][0] + f[-1][2]
    return dict(x0=PISTA_X/2+RECUO_1A, z0=PISTA_Z/2+RECUO_1A, pista=(PISTA_X, PISTA_Z),
                raio_canto=RC, projecao=proj, altura=f[-1][1], fileiras=f)


if __name__ == "__main__":
    niv, proj, alt = bacia()
    print(f"{'nivel':11}{'tipo':10}{'fil':>4}{'piso a':>8}{'proj':>7}{'sobe':>7}{'incl':>7}{'assentos':>10}")
    for d in niv:
        alerta = "" if d['incl'] <= INCL_MAX else "  <-- passa de 34"
        print(f"{d['nome']:11}{d['tipo']:10}{d['n']:4d}{d['y0']:8.1f}{d['proj']:7.1f}{d['sobe']:7.1f}{d['incl']:6.1f}o{d['ass']:10,.0f}{alerta}")
    tot = {}
    for d in niv: tot[d['tipo']] = tot.get(d['tipo'], 0) + d['ass']
    g = tot.get('geral', 0)*(1-PERDAS); c = tot.get('camarote', 0)
    print(f"\nGERAL {g:,.0f}   CAMAROTE {c:,.0f} ({CAMAROTES} caixas)   TOTAL {g+c:,.0f}")
    x0 = PISTA_X/2+RECUO_1A
    env_x, env_z = (x0+proj+5)*2, (PISTA_Z/2+RECUO_1A+proj+5)*2
    print(f"projecao {proj:.1f} m/lado   ultima fila a {alt:.1f} m")
    print(f"ENVELOPE {env_x:.0f} x {env_z:.0f} m   (o programa pede 160 x 140)")
    print(f"distancia da ultima fila ao centro: {math.hypot(x0+proj, alt):.0f} m")
