#!/usr/bin/env python3
"""Bacia do estadio da DogCity com os quatro niveis de acesso, pela linha de visada.

   N1 = ((D + T) * (N + C)) / D
D = distancia horizontal do olho ao ponto focal, N = altura do olho sobre o foco,
T = avanco horizontal, C = folga de visao sobre a cabeca de quem esta na frente.
C = 90 mm e padrao de elite. Ponto focal: a linha lateral, no nivel do gramado.

⚠️ A ARMADILHA QUE ESTA CONTA JA CAIU UMA VEZ: se cada anel novo recuar para tras
o quanto quiser, a formula devolve espelho pequeno (quem esta longe precisa subir
pouco para ver por cima da cabeca da frente) e a bacia vira um pires raso de 18
graus, com a ultima fila longe demais do campo. Estadio de verdade empilha o anel
de cima EM BALANCO sobre o de baixo: escolhe-se o RECUO, curto, e a ALTURA do
piso e que sai da visada. E depois se confere a inclinacao (teto 34 graus) e a
distancia ao centro do campo (teto FIFA 190 m).
"""
import math

CAMPO_X, CAMPO_Z = 105.0, 68.0
PISTA_X, PISTA_Z = 122.0, 80.0
RECUO_1A, OLHO, C = 8.0, 1.20, 0.090
RC = 38.0
INCL_MAX, DIST_MAX = 34.0, 190.0

# nivel: (nome, fileiras, tread, largura do assento, recuo alem do anel de baixo, tipo)
# Configuracao OTIMA, escolhida por varredura: bate a escala do snapshot com o
# menor envelope possivel, respeitando inclinacao <= 34 graus e distancia ao
# centro <= 190 m, com o club entre 10% e 16% do total.
NIVEIS = [
    ("inferior",  22, 0.80, 0.50, 0.0, "geral"),
    ("club",      10, 0.90, 0.56, 6.0, "vip"),
    ("camarotes",  2, 0.95, 0.60, 5.0, "camarote"),
    ("superior",  39, 0.80, 0.50, 6.0, "geral"),
]
CAMAROTES, POR_CAIXA, PERDAS = 144, 12, 0.17

def perim(dx, dz, r):
    return 2*(2*dx-2*r) + 2*(2*dz-2*r) + 2*math.pi*r

def bacia(niveis=NIVEIS):
    x0, z0 = PISTA_X/2+RECUO_1A, PISTA_Z/2+RECUO_1A
    rec = 0.0
    D = z0 - CAMPO_Z/2          # eixo curto: o mais exigente
    N = 1.5 + OLHO
    y = 1.5
    out = []
    for nome, n, T, La, salto, tipo in niveis:
        if salto:               # anel novo: recuo curto, ALTURA derivada da visada
            Dn = D + salto
            N = (Dn * (N + C)) / D
            D = Dn
            rec += salto
            y = N - OLHO
        y0, sobe, ass, rs = y, 0.0, 0.0, []
        for i in range(n):
            ass += perim(x0+rec+i*T, z0+rec+i*T, RC) / La
            N1 = ((D+T)*(N+C))/D
            rs.append(N1-N); sobe += N1-N; N = N1; D += T
        rec += n*T
        y += sobe
        if tipo == "camarote":
            ass = CAMAROTES*POR_CAIXA
        incl = math.degrees(math.atan((sum(rs)/len(rs))/T))
        out.append(dict(nome=nome, tipo=tipo, n=n, T=T, La=La, y0=y0, rec=rec-n*T,
                        proj=n*T, sobe=sobe, incl=incl, ass=ass, y=y,
                        dmax=math.hypot(x0+rec, y)))
    return out, rec, y


def fileiras(niveis=NIVEIS):
    """A bacia como DADO, para quem vai modelar: uma entrada por fileira.

    Devolve (rec, y, T, La, tipo, nivel): `rec` e o avanco horizontal da fileira
    em relacao a borda da area de jogo (o retangulo x0 por z0), `y` a cota do
    piso dela. O modelador desloca o contorno por `rec` e levanta por `y`.
    E a MESMA cadeia de visada que produz a tabela acima, entao modelo e
    documento nunca divergem.
    """
    x0, z0 = PISTA_X/2+RECUO_1A, PISTA_Z/2+RECUO_1A
    rec = 0.0
    D = z0 - CAMPO_Z/2
    N = 1.5 + OLHO
    y = 1.5
    out = []
    for nome, n, T, La, salto, tipo in niveis:
        if salto:
            Dn = D + salto
            N = (Dn*(N+C))/D
            D = Dn
            rec += salto
            y = N - OLHO
        for i in range(n):
            out.append((rec, y, T, La, tipo, nome))
            N1 = ((D+T)*(N+C))/D
            y += N1-N
            N = N1
            D += T
            rec += T
    return out


def geometria():
    """Medidas fechadas que o modelo do Blender consome."""
    f = fileiras()
    proj = f[-1][0] + f[-1][2]
    return dict(
        x0=PISTA_X/2+RECUO_1A, z0=PISTA_Z/2+RECUO_1A,
        campo=(CAMPO_X, CAMPO_Z), pista=(PISTA_X, PISTA_Z),
        raio_canto=RC, projecao=proj, altura=f[-1][1],
        env_x=(PISTA_X/2+RECUO_1A+proj+6)*2,
        env_z=(PISTA_Z/2+RECUO_1A+proj+6)*2,
        fileiras=f,
    )


if __name__ != "__main__":
    import sys as _s

niv, proj, alt = bacia()
print(f"{'nivel':11}{'tipo':9}{'fil':>4}{'tread':>7}{'assento':>8}{'piso a':>8}{'recuo':>7}{'proj':>6}{'sobe':>6}{'incl':>7}{'assentos':>11}")
alerta=[]
for d in niv:
    flag = "" if d['incl'] <= INCL_MAX else "  <-- passa de 34 graus"
    if flag: alerta.append(d['nome'])
    print(f"{d['nome']:11}{d['tipo']:9}{d['n']:4d}{d['T']:7.2f}{d['La']*1000:6.0f}mm{d['y0']:8.1f}{d['rec']:7.1f}{d['proj']:6.1f}{d['sobe']:6.1f}{d['incl']:6.1f}o{d['ass']:11,.0f}{flag}")

tot={}
for d in niv: tot[d['tipo']]=tot.get(d['tipo'],0)+d['ass']
g=tot.get('geral',0)*(1-PERDAS); v=tot.get('vip',0)*(1-PERDAS); c=tot.get('camarote',0)
liq=g+v+c
print(f"\n{'GERAL (arquibancada)':24}{g:10,.0f}   {g/liq:5.1%}")
print(f"{'VIP (club)':24}{v:10,.0f}   {v/liq:5.1%}")
print(f"{'CAMAROTE':24}{c:10,.0f}   {c/liq:5.1%}   ({CAMAROTES} caixas de {POR_CAIXA})")
print(f"{'TOTAL liquido':24}{liq:10,.0f}")

x0=PISTA_X/2+RECUO_1A
env_x=(x0+proj+6)*2; env_z=(PISTA_Z/2+RECUO_1A+proj+6)*2
d_centro=math.hypot(x0+proj, alt)
print(f"\nprojecao {proj:.1f} m/lado   ultima fila a {alt:.1f} m de altura")
print(f"distancia da ultima fila ao centro do campo: {d_centro:.0f} m  (teto FIFA {DIST_MAX:.0f} m) {'OK' if d_centro<=DIST_MAX else 'ESTOUROU'}")
print(f"ENVELOPE {env_x:.0f} x {env_z:.0f} m = {env_x*env_z/1e4:.2f} ha")
print(f"com esplanada 30,5 m: {env_x+61:.0f} x {env_z+61:.0f} m = {(env_x+61)*(env_z+61)/1e4:.2f} ha")
print(f"bloco 2x2 da teia no raio 2.756 = 348 x 400 m -> {'CABE' if env_x+61<=400 and env_z+61<=348 else 'NAO CABE'}")
print(f"\nescoamento Green Guide 8 min: {liq/(82*8):.1f} m de portao")
for frac,ocup in ((0.30,3.0),(0.15,3.0)):
    vg=liq*frac/ocup
    print(f"{frac:.0%} de carro, {ocup:.0f} por carro: {vg:,.0f} vagas = {vg*25/1e4:.1f} ha de chao, ou {vg*25/1e4/5:.1f} ha em silo de 5 pavimentos")
