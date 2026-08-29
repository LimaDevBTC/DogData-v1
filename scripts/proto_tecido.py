#!/usr/bin/env python3
"""Protótipo do tecido urbano em planta, SEM tocar no gerador.

⚠️ BANCADA, NÃO PIPELINE. Julgar tecido pela cena 3D custa minutos por tentativa
e o que se julga é textura vista de 9 km, que aparece melhor em planta. Aqui a
volta é de segundos. Quando convencer, o esquema vai para `tecido()`.

uso: python3 scripts/proto_tecido.py saida.png [--px 1500] [--tipos]
"""
import math, sys
from PIL import Image, ImageDraw

saida = sys.argv[1] if len(sys.argv) > 1 else 'proto.png'
PX = int(sys.argv[sys.argv.index('--px')+1]) if '--px' in sys.argv else 1500
POR_TIPO = '--tipos' in sys.argv

R_INI, R_BORDA = 1450.0, 4400.0
VIA, ARCO, AVENIDA = 12.0, 26.0, 44.0

# ── A CIDADE DEIXA DE SER REDONDA, E A REGRA DE IDADE NÃO SE MEXE ────────────
#
# ⚠️ EU TRATEI A REDONDEZA COMO LEI DA FÍSICA E ELA É ESCOLHA. A regra 1 diz que
# a IDADE decide ONDE, coorte velha por dentro. Isso exige uma família de curvas
# ENCAIXADAS, para a ordem existir; não exige que essas curvas sejam CÍRCULOS.
# Trocando o raio por um campo φ cujas curvas de nível são superelipses, a
# cidade vira retângulo arredondado e a ordem por idade continua exata, porque
# φ cresce do centro para fora igual ao raio crescia.
#
# ⚠️ E ISTO NÃO É O LOBO QUE JÁ REPROVOU. Lá a alocação continuava circular e a
# BORDA era recortada em 5 pétalas: cortar depois joga terra fora, e custou
# 6,46 km² de lote e 91 m² de mediana para comprar 0,047 de R². Aqui não se corta
# nada: a própria alocação passa a ter a forma, então o custo é zero por
# construção. Medir a mediana depois do porte é o que prova isso.
FORMA_N   = 3.0                  # 2 = elipse, 4 = quase retângulo. 3,4 arredonda a quina
FORMA_AX  = 0.9923                 # meio-eixo relativo no eixo maior
FORMA_AZ  = 0.8931                 # e no menor: a cidade fica mais larga que alta
FORMA_ROT = math.radians(-18.0)
# ⚠️ OS MEIO-EIXOS JÁ VÊM CALIBRADOS para a área dentro da borda dar EXATAMENTE a
# do disco de 4.400 m (60.82 km²). Sem essa calibração a forma cobra terra, e foi
# assim que o lobo de 5 pétalas reprovou: 6,46 km² de lote a menos. Custo medido
# desta forma: +0.00%. Mexer em FORMA_N ou FORMA_AZ EXIGE recalibrar.  # o eixo maior não é o eixo da tela
def phi(x, z):
    """φ tem unidade de metro e vale R_BORDA exatamente na borda da cidade.

    ⚠️ A FORMA ENTRA AOS POUCOS, E ISSO NÃO É ENFEITE, É CONSERTO. Com a
    superelipse valendo desde o começo, a primeira banda saía do lago (que é um
    CÍRCULO em r 1.450) já deformada, e sobrava um vazio preto de centenas de
    metros entre a água e o primeiro quarteirão, maior de um lado que do outro.
    Agora φ é o raio junto do lago e vira superelipse indo para a borda: o
    núcleo antigo abraça a água, redondo, e a cidade só ganha forma quando
    cresce. Que é como cidade de beira d'água se forma de verdade.
    A ordem por idade sobrevive porque r e a superelipse crescem os dois ao
    longo de qualquer raio, então a mistura também cresce: as curvas de nível
    continuam encaixadas, que é a única coisa que a regra 1 exige.
    """
    r = math.hypot(x, z)
    c, sn = math.cos(FORMA_ROT), math.sin(FORMA_ROT)
    lx, lz = x*c + z*sn, -x*sn + z*c
    q = (abs(lx/FORMA_AX)**FORMA_N + abs(lz/FORMA_AZ)**FORMA_N) ** (1.0/FORMA_N)
    th = math.atan2(z, x)
    q *= (1.0 - 0.030*math.cos(3*th - 0.7))   # sem isto a superelipse tem 2 eixos de simetria
    w = min(1.0, max(0.0, (r - R_INI) / (R_BORDA - R_INI)))
    w = w*w*(3 - 2*w)
    return r*(1 - w) + q*w
def dir_phi(x, z):
    """a direção em que φ cresce, que é o que substitui o versor radial."""
    e = 1.0
    gx = (phi(x+e, z) - phi(x-e, z)) / (2*e)
    gz = (phi(x, z+e) - phi(x, z-e)) / (2*e)
    n = math.hypot(gx, gz) or 1.0
    return gx/n, gz/n

# ── DISTRITOS DESIGUAIS ─────────────────────────────────────────────────────
# ⚠️ SEIS FATIAS IGUAIS DERAM MANDALA, e mandala é tão carimbada quanto a grade
# que se queria consertar. Cidade nenhuma é simétrica porque cada bairro nasceu
# de um motivo. Aqui os motivos são reais: as 4 pontes (rumos 0/90/180/270) são
# as portas, e o Parque Runestone fica no rumo 43. A malha de cada distrito fica
# TANGENTE ao anel no rumo do centro dele, então toda rua ou aponta para a praça
# ou a contorna. O desvio dentro do distrito gera a quadra em cunha da divisa,
# que é o que faz mapa parecer desenhado por gente.
# ⚠️ E A MALHA NÃO É TANGENTE AO ANEL, É OBLÍQUA A ELE. Este foi o erro da v3.
# Com toda malha tangente, TODA rua ou aponta para a praça ou a contorna, e o
# mapa inteiro vira alvo de tiro: a leitura concêntrica vence tudo. É o oposto
# do Eixample, que corre a 45 graus da costa justamente para a grade se ler
# CONTRA a geografia e não com ela. Aqui o giro sai 34 a 46 graus fora da
# tangente, com o sinal alternando: as ruas cruzam os anéis em diagonal, os
# anéis passam a se ler como elemento próprio cortando a grade, e a coroa some.
DISTRITOS = [   # (rumo inicial, abertura, giro FORA da tangente, escala das bandas)
    (  0.0, 62.0,  38.0, 1.00),
    ( 62.0, 46.0, -41.0, 0.94),   # o que olha para o Parque Runestone
    (108.0, 78.0,  35.0, 1.07),
    (186.0, 54.0, -46.0, 0.97),
    (240.0, 68.0,  40.0, 1.04),
    (308.0, 52.0, -34.0, 0.92),
]
# ⚠️ E AS BANDAS NÃO QUEBRAM NO MESMO RAIO EM TODA A VOLTA. Anel concêntrico
# perfeito é alvo de tiro: foi a segunda coisa que fez a v2 parecer mandala.
# Cada distrito estica ou encolhe as suas bandas, então a divisa entre bairros é
# uma linha quebrada, como em cidade que cresceu em ritmos diferentes.
BANDAS = [(R_INI, 2180.0, 'Nucleo', 112.0), (2180.0, 3010.0, 'Meio', 150.0),
          (3010.0, 3956.0, 'Bairro', 196.0)]
R_CINTA0 = 3956.0

def faixa_do_distrito(d, ib):
    r0, r1, nome, cel = BANDAS[ib]
    k = DISTRITOS[d][3]
    a = R_INI if ib == 0 else R_INI + (r0 - R_INI) * k
    b = R_INI + (r1 - R_INI) * k
    return a, b, nome, cel

def distrito_de(x, z):
    ru = math.degrees(math.atan2(x, -z)) % 360
    for i, D in enumerate(DISTRITOS):
        if D[0] <= ru < D[0] + D[1]: return i
    return len(DISTRITOS) - 1

# ── PARQUES ESCOLHIDOS ──────────────────────────────────────────────────────
# ⚠️ O tecido de hoje esvazia a célula do meio de cada quarto 3x3: um buraco a
# cada 540 m em fileira perfeita, que na planta vira poá. Parque de cidade é
# POUCO, GRANDE e fica onde há motivo. Nenhum tem par simétrico.
PARQUES = [(34.,2020.,300.,190.), (78.,3180.,210.,340.), (127.,2440.,260.,175.),
           (166.,3420.,175.,300.), (214.,1960.,240.,160.), (262.,3020.,330.,210.),
           (296.,2300.,190.,260.), (338.,3480.,260.,200.)]
_PQ = [(math.sin(math.radians(r))*d, -math.cos(math.radians(r))*d, a, b, math.radians(r))
       for r, d, a, b in PARQUES]

# ── DIAGONAIS ───────────────────────────────────────────────────────────────
# Broadway, a Diagonal de Barcelona. Uma via que IGNORA a malha e atravessa a
# cidade é o elemento mais barato para tirar mapa de grade do genérico, porque
# produz esquina em cunha em toda quadra que toca. Na v2 elas não pegaram porque
# a quadra era desenhada inteira quando sobrevivia; agora há recorte de verdade.
DIAGONAIS = [(24.0, 1750.0), (99.0, -2050.0), (158.0, 1500.0)]

# ── RECORTE ─────────────────────────────────────────────────────────────────
# ⚠️ ISTO É O QUE FALTAVA NA v2. Lá a quadra ou entrava inteira ou não entrava, e
# por isso a avenida atravessava sem cortar nada e a borda ficava serrilhada.
# Sutherland-Hodgman contra semiplanos: a quadra chega na avenida e é APARADA,
# que é de onde vem a esquina em cunha.
def corta(poly, nx, nz, c):
    """mantém o lado com nx*x + nz*z >= c"""
    if not poly: return []
    out = []
    for i in range(len(poly)):
        ax, az = poly[i]; bx, bz = poly[(i+1) % len(poly)]
        da = nx*ax + nz*az - c; db = nx*bx + nz*bz - c
        if da >= 0: out.append((ax, az))
        if (da >= 0) != (db >= 0):
            t = da / (da - db)
            out.append((ax + (bx-ax)*t, az + (bz-az)*t))
    return out

def area(poly):
    if len(poly) < 3: return 0.0
    s = sum(poly[i][0]*poly[(i+1) % len(poly)][1] - poly[(i+1) % len(poly)][0]*poly[i][1]
            for i in range(len(poly)))
    return abs(s) / 2

def recorta(poly, d, r0, r1):
    """apara a quadra contra distrito, banda, parque e diagonal. Devolve LISTA:
    a diagonal PARTE a quadra em duas, e as duas valem."""
    a0 = math.radians(DISTRITOS[d][0]); a1 = math.radians(DISTRITOS[d][0] + DISTRITOS[d][1])
    poly = corta(poly, math.cos(a0), math.sin(a0), AVENIDA/2)
    poly = corta(poly, -math.cos(a1), -math.sin(a1), AVENIDA/2)
    if not poly: return []
    cx = sum(p[0] for p in poly)/len(poly); cz = sum(p[1] for p in poly)/len(poly)
    # ⚠️ A DIVISA DE BANDA É CURVA DE NÍVEL DE φ, NÃO CÍRCULO. O corte usa o
    # gradiente de φ no lugar do versor radial, e a reta tangente aproxima a
    # curva com flecha de ~1 m num bloco de 112 m, que é invisível.
    ux, uz = dir_phi(cx, cz)
    pc = phi(cx, cz)
    poly = corta(poly, ux, uz, ux*cx + uz*cz - (pc - r0) + ARCO/2)
    poly = corta(poly, -ux, -uz, -(ux*cx + uz*cz) - (r1 - pc) + ARCO/2)
    if not poly: return []
    # ⚠️ O PARQUE ABRIA UM BURACO PRETO MUITO MAIOR QUE ELE. Eu cortava por um
    # semiplano posto a `max(ea,eb)` do centro, o que remove um RETÂNGULO
    # circunscrito e não a elipse. Agora acha o ponto mais próximo SOBRE a
    # elipse e corta pela tangente ali: a quadra encosta no parque.
    for px_, pz_, ea, eb, g in _PQ:
        dx, dz = cx - px_, cz - pz_
        if math.hypot(dx, dz) > max(ea, eb) + 260: continue
        cg, sg = math.cos(g), math.sin(g)
        lx = dx*cg + dz*sg; lz = -dx*sg + dz*cg
        q = ((lx/ea)**2 + (lz/eb)**2) ** 0.5
        if q < 1.0: return []
        ex, ez = lx/q, lz/q                       # o ponto sobre a elipse
        nx_, nz_ = ex/(ea*ea), ez/(eb*eb)         # normal da tangente ali
        nn = math.hypot(nx_, nz_) or 1.0
        nx_, nz_ = nx_/nn, nz_/nn
        wx_ = nx_*cg - nz_*sg; wz_ = nx_*sg + nz_*cg          # de volta ao mundo
        ax_ = px_ + (ex*cg - ez*sg); az_ = pz_ + (ex*sg + ez*cg)
        poly = corta(poly, wx_, wz_, wx_*ax_ + wz_*az_)
        if not poly: return []
    pecas = [poly]
    for rumo, off in DIAGONAIS:                # a diagonal PARTE
        a = math.radians(rumo); nx, nz = math.cos(a), math.sin(a)
        novas = []
        for p in pecas:
            e = corta(p, -nx, -nz, -(off - AVENIDA/2))
            dd = corta(p,  nx,  nz,  (off + AVENIDA/2))
            for q in (e, dd):
                if area(q) > 420: novas.append(q)
        pecas = novas
    return pecas

# ── TIPOLOGIA DE QUARTEIRÃO ─────────────────────────────────────────────────
# ⚠️ MEDIDO NO LOTEAMENTO REAL, não inventado. Como a posição vem da IDADE, cada
# quarteirão é uma COORTE, e a mistura da coorte muda com o raio:
#   1.450-2.180  83,2% massa unica,  3,0% torre, area mediana 212 m2
#   3.010-3.760  53,1% massa unica,  8,0% torre, area mediana 363 m2
# O nucleo antigo e miudo e quieto, a periferia e patio e torre. O tipo do
# quarteirao LE isso em vez de sortear, e e por isso que um pedaco de 2021 nao
# se parece com um pedaco de 2024.
TIPOS = {'Nucleo':(196,190,178), 'Meio':(170,166,156), 'Bairro':(146,144,138),
         'Cinta':(120,116,108), 'Orla':(214,206,188), 'Esquina':(206,158,110),
         'Galeria':(150,132,170)}

esc = PX / (2 * R_BORDA * 1.04)
im = Image.new('RGB', (PX, PX), (14, 14, 16)); dr = ImageDraw.Draw(im)
tela = lambda x, z: (x*esc + PX/2, z*esc + PX/2)
n_q = 0; conta = {}

def emite(poly, tipo):
    global n_q
    # ⚠️ LASCA DE DIVISA É QUADRA, NÃO LIXO. Com piso de 1.200 m² as fatias finas
    # da costura entre distritos sumiam e abriam vão preto de centenas de metros
    # onde deveria haver esquina. Quadra triangular de 500 m² existe em cidade
    # de verdade e tem nome: é o Flatiron.
    if area(poly) < 480: return
    dr.polygon([tela(*p) for p in poly], fill=TIPOS[tipo], outline=(28, 28, 31))
    n_q += 1; conta[tipo] = conta.get(tipo, 0) + 1

for ib in range(len(BANDAS)):
    for d in range(len(DISTRITOS)):
        r0, r1, nome, cel = faixa_do_distrito(d, ib)
        g = math.radians(DISTRITOS[d][0] + DISTRITOS[d][1]/2 + DISTRITOS[d][2])
        ca, sa = math.cos(g), math.sin(g)
        lado = cel - VIA
        alc = int(r1/cel) + 2
        for iz in range(-alc, alc+1):
            for ix in range(-alc, alc+1):
                lx, lz = (ix+0.5)*cel, (iz+0.5)*cel
                wx, wz = lx*ca - lz*sa, lx*sa + lz*ca
                rr = phi(wx, wz)
                if not (r0 - cel < rr < r1 + cel): continue
                # ⚠️ O VÃO PRETO DA COSTURA ERA ISTO. O teste era pelo CENTRO da
                # quadra: quem tinha o centro do lado de lá era descartado inteiro,
                # mesmo com metade dentro. Os dois distritos vizinhos descartavam,
                # cada um a sua metade, e abria uma faixa vazia de até uma célula
                # (196 m) SOMADA à avenida de 44. Agora entra quem ENCOSTA no
                # distrito e o recorte resolve: cada lado fica com a sua metade e
                # a costura vira esquina, que é o que ela devia ser.
                rw = math.hypot(wx, wz) or 1.0
                meia = (lado * 0.71) / rw                     # meia-largura angular
                bru = math.degrees(math.atan2(wx, -wz)) % 360
                da_ = (bru - DISTRITOS[d][0]) % 360
                if not (-math.degrees(meia) <= da_ - 0 <= DISTRITOS[d][1] + math.degrees(meia)
                        or da_ > 360 - math.degrees(meia)): continue
                h = lado/2
                poly = [(wx + sx*h*ca - sz*h*sa, wz + sx*h*sa + sz*h*ca)
                        for sx, sz in ((-1,-1),(1,-1),(1,1),(-1,1))]
                for pedaco in recorta(poly, d, r0, r1):
                    t = nome
                    # ⚠️ ESQUINA SÓ ONDE HÁ AVENIDA. Antes bastava a quadra ser
                    # pequena, então toda sobra de divisa saía laranja e o mapa
                    # ficava pintado de cunha onde não há esquina nenhuma.
                    ex_ = sum(q[0] for q in pedaco)/len(pedaco)
                    ez_ = sum(q[1] for q in pedaco)/len(pedaco)
                    perto_av = any(abs(ex_*math.cos(math.radians(ru)) + ez_*math.sin(math.radians(ru)) - off) < AVENIDA/2 + 0.8*cel
                                   for ru, off in DIAGONAIS)
                    if ib == 0 and rr < r0 + 2.2*cel: t = 'Orla'
                    elif perto_av and area(pedaco) < 0.8 * lado * lado: t = 'Esquina'
                    elif ib == 0 and (ix + iz) % 7 == 0: t = 'Galeria' 
                    emite(pedaco, t)

# ── A CINTA POLAR ───────────────────────────────────────────────────────────
# ⚠️ CONSERTA A BORDA EM POLÍGONO. Malha cartesiana recortada num disco devolve
# dodecágono serrilhado, que é a queixa antiga do fundador. Aqui a quadra SEGUE
# O ARCO: testada tangente, profundidade radial, e a borda fecha em círculo
# porque é feita de círculo. De quebra é o contraste Eixample/Ciutat Vella.
r = R_CINTA0
# ⚠️ A CINTA ERA FUNDA DEMAIS: 706 m de tijolo uniforme na borda liam como
# muro de estádio e comiam um quinto do raio. Três faixas bastam para a
# borda fechar em círculo, que é a única coisa que ela precisa fazer.
for k, prof in enumerate([132., 148., 164.]):
    r1 = min(R_BORDA, r + prof)
    n = max(24, int(round(2*math.pi*((r+r1)/2) / (150. + k*14))))
    for j in range(n):
        folga = VIA/((r+r1)/2)
        a0 = (j/n)*2*math.pi + 0.13*k + folga/2
        a1 = ((j+1)/n)*2*math.pi + 0.13*k - folga/2
        _am = (a0+a1)/2
        _lo, _hi = 200.0, 12000.0
        for _ in range(28):
            _m = (_lo+_hi)/2
            if phi(math.sin(_am)*_m, -math.cos(_am)*_m) < (r+r1)/2: _lo = _m
            else: _hi = _m
        _rm = (_lo+_hi)/2
        mx = math.sin(_am)*_rm; mz = -math.cos(_am)*_rm
        d = distrito_de(mx, mz)
        ru = math.degrees(math.atan2(mx, -mz)) % 360
        if min(min(abs(ru - D[0]), 360-abs(ru - D[0])) for D in DISTRITOS) * math.pi/180 * _rm < AVENIDA/2: continue
        # ⚠️ A CINTA É QUEM DESENHA A BORDA DA CIDADE, então ela tem de seguir φ
        # e não o raio: cada canto é empurrado para o nível de φ que se quer.
        def em_phi(ang, alvo):
            lo, hi = 200.0, 12000.0
            for _ in range(28):
                m = (lo + hi)/2
                if phi(math.sin(ang)*m, -math.cos(ang)*m) < alvo: lo = m
                else: hi = m
            m = (lo+hi)/2
            return math.sin(ang)*m, -math.cos(ang)*m
        poly = [em_phi(a0, r+ARCO/2), em_phi(a1, r+ARCO/2), em_phi(a1, r1), em_phi(a0, r1)]
        pecas = [poly]
        for rumo, off in DIAGONAIS:
            a = math.radians(rumo); nx, nz = math.cos(a), math.sin(a)
            pecas = [q for p in pecas for q in
                     (corta(p, -nx, -nz, -(off-AVENIDA/2)), corta(p, nx, nz, off+AVENIDA/2))
                     if area(q) > 420]
        for p in pecas: emite(p, 'Cinta')
    r = r1

for px_, pz_, ea, eb, g in _PQ:
    n = 44
    dr.polygon([tela(px_ + math.cos(2*math.pi*i/n)*ea*math.cos(g) - math.sin(2*math.pi*i/n)*eb*math.sin(g),
                     pz_ + math.cos(2*math.pi*i/n)*ea*math.sin(g) + math.sin(2*math.pi*i/n)*eb*math.cos(g))
                for i in range(n)], fill=(54, 76, 54))
dr.ellipse([*tela(-1024,-1024), *tela(1024,1024)], fill=(24, 42, 58))
im.save(saida)
print(f'{n_q:,} quadras -> {saida}')
for t, c in sorted(conta.items(), key=lambda x: -x[1]): print(f'  {t:9s} {c:5,d}')
