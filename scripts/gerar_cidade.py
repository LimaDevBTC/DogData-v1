#!/usr/bin/env python3
"""
O GERADOR DA DOGCITY. Implementa o capítulo 6 do plano-diretor.md.

Estrutura, de fora para dentro:
  disco -> 12 setores de 30 graus, cada um com malha própria girada k x 7,5 graus
        -> quartos de 540 m (3 x 3 células de 180 m; a do meio é praça, 8 viram quarteirão)
        -> quarteirão de 168 x 168 m
        -> 84 lotes de 300 m² (14 colunas x 6 fileiras de 12 x 25 m)

Endereço: S{setor}-Q{quarto}-B{quarteirão}-L{lote}.

⚠️ A CHAVE DE ORDENAÇÃO. O plano diretor pede (altura de bloco, txindex, vout,
endereço) e diz que o CSV não tem os três primeiros. Medi e achei um substituto
que já está em casa: `(ts, txid, vout)` do UTXO mais antigo, de
data/dog_utxos_by_address.json, dá ZERO colisões em 52.996 carteiras.
Ele é melhor que desempate por endereço por segurança: endereço é grindável, dá
para gerar endereços até sair um que ordena cedo; txid e vout são escolhidos por
quem ENVIA, nunca por quem recebe.
Ressalva honesta: `ts` é o carimbo do bloco, e carimbo de bloco no Bitcoin NÃO é
estritamente crescente (a regra é ser maior que a mediana dos 11 anteriores).
Então um punhado de carteiras em blocos adjacentes pode sair fora da ordem real
da cadeia. Trocar `ts` por altura de bloco é refinamento posterior e mexe em
pouca posição.
"""
import csv, json, math, struct, sys, os, collections

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def p(*a): return os.path.join(RAIZ, *a)

# ── o tabuleiro (plano-diretor.md cap. 6.3) ────────────────────────────────
# ⚠️ O RAIO É UM NÚMERO SÓ, e ele tem teto de DADO, não de vontade: o heightmap
# em public/lunar/btc-core-heightmap.json tem 137 células de 59,2 m, ou seja
# meia-largura de 4.027 m. Acima disso o terreno acaba e é preciso regerar o
# recorte a partir do tile SLDEM2015. Override por ambiente para medir o preço
# de crescer sem editar o arquivo: R=4000 python3 scripts/gerar_cidade.py
R_SITIO      = float(os.environ.get('R', 4500))
R_INICIO     = 1300      # nada começa antes do fim da rampa do platô
SETORES      = 12
GIRO_SETOR   = 7.5       # graus por setor; 12 x 7,5 = 90, e a malha quadrada fecha
BULEVAR      = 34.0      # largura do bulevar radial sobre cada costura
CELULA       = 180.0     # passo da malha
QUARTEIRAO   = 168.0     # e 12 m de via entre quarteirões
QUARTO       = 3         # 3 x 3 células; a do meio é a praça do quarto
LOTE_COLS, LOTE_ROWS = 14, 6      # 84 lotes
LOTE_W, LOTE_D = 12.0, 25.0       # 300 m²
FAIXA        = 50.0      # profundidade da faixa: duas fileiras costas com costas
TRAVESSA     = 9.0       # a via de servico entre faixas (plano-diretor cap. 8)
DECLIVE_MAX  = 4.0       # correção do júri: o tecido não cabe em 3 graus

PLATO_R, PLATO_FUNDE = 960, 1300
PARQUE_RUMO, PARQUE_DIST, PARQUE_DISCO = 43.0, 5200.0, 3600.0
# ⚠️ O SPACEPORT SAIU DO SÍTIO em 28/08/2026 e por isso NÃO É MAIS MÁSCARA.
# Ele estava em (-140, 3090), raio 3.093 m, e foi para o raio 4.400 porque
# foguete não atravessa a abóbada (SPACEPORT_SHIFT em app/city/plaza/orbit-layer.ts).
# Isso DEVOLVE 845 x 599 m, meio quilômetro quadrado, para dentro do loteamento.
# Fica registrado aqui em vez de apagado, para ninguém "consertar" de volta.
SPACEPORT_APOSENTADO = (-140.0, 3090.0, 845.0, 599.0)

# O coliseu da batalha: elipse GIRADA, não retângulo. O plano diretor reservava
# 760 x 364 alinhado aos eixos, e a peça de verdade é um hipódromo de meio-eixos
# 372 x 217 girado 225 graus, igual ao campo (app/city/plaza/coliseu.ts). Aqui
# ele entra com 40 m de folga de acesso em volta: 412 x 257.
# ⚠️ O COLISEU NÃO ESTÁ CONSTRUÍDO, e a reserva existe justamente por isso: o
# fundador congelou a obra e mandou guardar o lugar. Lote plantado aqui teria de
# ser desfeito depois, e lote atribuído não se desfaz.
COLISEU_CX, COLISEU_CZ = -2120.0, 2120.0
COLISEU_A, COLISEU_B = 412.0, 257.0
COLISEU_ROT = 5 * math.pi / 4

# ⚠️ O LOTE PARA NA ABÓBADA, NÃO NA BORDA DO SÍTIO. A casca de colmeia fecha em
# 3.500 e a saia desce ali até o chão. Lote além disso ficaria FORA da cidade
# pressurizada. 3.480 deixa a
# calçada de serviço no pé da saia.
# ⚠️ O CINTURÃO: o lote para 100 m ANTES da casca, não 20. Medido, com 20 m de
# recuo havia lote gravado a 4.462 m, ou seja debaixo do pé da saia da abóbada,
# que desce em 4.500. Os 100 m entre 4.400 e 4.500 são verde de borda mais o pé
# da saia. Custa 0,78 km² de lote e 7 m² na mediana, e compra uma borda que
# existe fisicamente.
# ⚠️ NÃO MEXER em app/city/plaza/dome.ts:35: a casca continua com 4.500 m e o
# Cinturão é interno a ela.
R_ABOBADA = R_SITIO - 100

# ── O CONTORNO VOLTA A SER CÍRCULO, E ISSO FOI MEDIDO ─────────────────────
# ⚠️ O LOBO FOI TESTADO E REPROVOU. Ele existia para quebrar o anel de idade, e
# não quebrava: R² de coorte contra raio de 0,8004 COM lobo contra 0,8477 sem.
# Comprava 0,047 de R² e cobrava 6,46 km² de lote e 91 m² na mediana. Pior, a
# forma nem se lia: no Fourier do envelope o harmônico k=5 valia 183 m pico a
# pico contra os 1.075 pedidos, atrás de k=1, 2, 3 e 4. E a cunha verde entre
# pétalas, que eu afirmei aqui que "entra até perto da praça", só começava em
# 3.404,8 m contra R_INICIO de 1.300: o comentário errava por 2,1 km e nunca
# tinha sido medido.
# O que quebra o anel de verdade está no cotista, em RITMO_LOBOS: ele ataca a
# correlação idade-raio direto, sem cortar terra nenhuma.
LOBOS = 5
LOBO_AMP = 0.0
LOBO_FASE = math.radians(18)

def raio_borda(x, z):
    return R_ABOBADA * (1 - LOBO_AMP + LOBO_AMP * math.cos(LOBOS * (math.atan2(z, x) - LOBO_FASE)))

# ── a curva da área (masterplan §9, decisão 1 de 28/08) ────────────────────
# Área proporcional à RAIZ do saldo, com gradiente centro-periferia. Medido:
# a média é 308 m² por carteira e não tem como fugir disso, então premium só
# existe tirando de alguém. A raiz dá razão de 805x entre o maior e o menor;
# o proporcional puro daria 648.082x e faria cem latifundiários.
EXPOENTE = 0.5
GRADIENTE = 1.0        # borda com 2,7x a área por DOG do centro
TECIDO_ALVO = 16.33e6  # m² da metade do holder
LOTE_MIN_FRENTE = 5.0  # nenhum lote fica mais estreito que isto
FILA_PROF = 25.0       # profundidade padrão da fileira
DSC_RUMO  = 68.7

# ── relevo ─────────────────────────────────────────────────────────────────
meta = json.load(open(p('public/lunar/btc-core-heightmap.json')))
n, cell = meta['cols'], meta['cellSizeM']
half = (n - 1) / 2
with open(p('public/lunar/btc-core-heightmap.f32'), 'rb') as f:
    alt = list(struct.unpack(f'<{n*n}f', f.read(n*n*4)))
H = lambda i, j: alt[min(n-1, max(0, j))*n + min(n-1, max(0, i))]

def crua(x, z):
    fi = min(n-1.001, max(0, x/cell+half)); fj = min(n-1.001, max(0, z/cell+half))
    i, j = int(fi), int(fj); u, v = fi-i, fj-j
    return H(i,j)*(1-u)*(1-v) + H(i+1,j)*u*(1-v) + H(i,j+1)*(1-u)*v + H(i+1,j+1)*u*v

def altura(x, z):
    b = crua(x, z); r = math.hypot(x, z)
    if r >= PLATO_FUNDE: return b
    if r <= PLATO_R: return 0.0
    t = (r-PLATO_R)/(PLATO_FUNDE-PLATO_R)
    return b*(t*t*(3-2*t))

grade = [0.0]*(n*n)
for j in range(n):
    for i in range(n):
        x, z = (i-half)*cell, (j-half)*cell
        hx = (altura(x+cell,z)-altura(x-cell,z))/(2*cell)
        hz = (altura(x,z+cell)-altura(x,z-cell))/(2*cell)
        grade[j*n+i] = math.degrees(math.atan(math.hypot(hx,hz)))

def declive(x, z):
    fi = min(n-1.001, max(0, x/cell+half)); fj = min(n-1.001, max(0, z/cell+half))
    i, j = int(fi), int(fj); u, v = fi-i, fj-j
    G = lambda a,b: grade[min(n-1,b)*n+min(n-1,a)]
    return G(i,j)*(1-u)*(1-v)+G(i+1,j)*u*(1-v)+G(i,j+1)*(1-u)*v+G(i+1,j+1)*u*v

prad = math.radians(PARQUE_RUMO)
PCX, PCZ = math.sin(prad)*PARQUE_DIST, -math.cos(prad)*PARQUE_DIST

def rumo_de(x, z):
    return math.degrees(math.atan2(x, -z)) % 360

# ═══════════════════════════════════════════════════════════════════════════
# O PROGRAMA: tudo que é reservado ANTES do lote.
#
# ⚠️ REGRA DE OURO DO masterplan.md:268-269: equipamento vira zona reservada
# ANTES do lote, nunca depois. Até 28/08 isso NUNCA tinha sido cumprido: dos 39
# equipamentos do §5, ZERO era máscara. A cidade era plantada primeiro e o
# programa ficava sendo promessa em tabela de markdown.
#
# ⚠️ A LISTA DO §5 FOI ESCRITA PARA OUTRA CIDADE. Ela tem porto, navios grandes,
# marina, ponte estilo Golden Gate, farol na entrada do porto, estátua colossal
# recebendo navios, aeroporto e observatório no topo da montanha. Nada disso
# existe aqui: o sítio é mare plano sob abóbada pressurizada, sem costa, sem
# montanha e sem aviões. Traduzido, com o original citado:
#   porto e balsas multichain  -> Portão e Alfândega (a carga chega por nave)
#   aeroporto                  -> o Spaceport, que já existe fora da casca
#   farol da entrada do porto  -> Farol do Portão, na saia da abóbada
#   estátua recebendo navios   -> Colosso do Portão, mesma função cênica
#   observatório na montanha   -> Observatório do Cinturão, o terreno é plano
#   marina, ponte, roda-gigante-> orla do Lago Maior, que agora existe de verdade
# O lago artificial é decisão do fundador de 28/08 e resolve a órfandade dessas
# peças: sob abóbada dá para ter água.
#
# ⚠️ NADA AQUI É CONSTRUÍDO. Isto é DEMARCAÇÃO: reserva de terra com nome, para
# que nenhum lote nasça em cima. O 3D vem depois, e vem sem desfazer endereço.
#
# rumo em graus (0 = norte, cresce para leste), raio ao centro em m,
# a e b = meios-eixos em m, rot = giro da peça em graus.
# ⚠️ A PEÇA DEIXOU DE SER ELIPSE E VIROU RETÂNGULO DE CÉLULAS DA MALHA (29/08).
# Uma peça era (rumo, raio, semieixos, giro): uma elipse SOLTA, sem nenhuma
# relação com a malha. Por isso ela não conversava com a cidade: a rua passava
# por fora em ângulo qualquer, não existia divisa nem portão, e todo desenho
# feito dentro herdava a arbitrariedade do contorno. O fundador viu e disse o
# que era: "completamente genérico e aleatório".
# Agora a peça é (setor, ix, iz, w, h): um retângulo de células de 180 m no
# referencial girado do setor. Consequências, todas de graça:
#   - toda divisa de peça cai na via de contorno de 12 m que já existe
#   - o portão nasce onde a rua chega, sem precisar inventar
#   - os eixos internos podem prolongar os eixos da cidade
#   - a máscara vira teste de retângulo, exato, sem margem de arredondamento
#
# ⚠️ CONVENÇÃO ÚNICA DE GIRO, E ELA ESTAVA QUEBRADA. `rot` é o giro da peça e
# vale MUNDO = R(rot) · LOCAL, a mesma convenção do campo `giro` do
# cidade-malha.json. A versão de elipse usava o sinal INVERTIDO aqui e o certo em
# pecas.ts, então a reserva de terra e o desenho eram espelhados um do outro.
# Medido em 29/08 sobre cidade-lotes.bin: a máscara guardava 0 lote, e a elipse
# efetivamente desenhada caía em cima de 174 (Lago do Poente 33, Jardim das
# Coortes 25, Lago Maior 23). A reserva era honesta e o render mentia.

# (id, nome, tipo, setor, ix, iz, w, h) — w e h em CÉLULAS de 180 m
PROGRAMA_MALHA = [
  # ── agua ─────────────────────────────────────────────
  ('A04', 'Lago do Poente',                'agua',          8,   -6,   11, 2, 2),
  # ── civico ─────────────────────────────────────────────
  ('C01', 'DOG University',                'civico',        4,   12,    0, 2, 2),
  ('C02', 'Hospital Geral e Heliponto',    'civico',        4,    9,    3, 1, 2),
  ('C03', 'Teatro Municipal',              'civico',        5,    8,    4, 1, 1),
  ('C04', 'Museu da Runa',                 'civico',        6,    3,    9, 1, 1),
  ('C05', 'City Hall',                     'civico',        7,    2,    9, 2, 2),
  ('C06', 'Casa da Moeda',                 'civico',        6,    7,    8, 1, 1),
  ('C07', 'DOG DATA HQ',                   'civico',        5,    9,    6, 1, 2),
  ('C08', 'Memorial do DOG Perdido',       'civico',       10,  -14,    4, 1, 2),
  ('C09', 'Mercado Municipal',             'civico',       10,  -10,    3, 1, 2),
  ('C10', 'Observatório do Cinturão',      'civico',       11,  -24,   -2, 1, 1),
  ('C12', 'Colosso do Portão',             'civico',        5,   14,   14, 1, 1),
  # ── distribuicao ─────────────────────────────────────────────
  ('D02', 'Alfândega e Triagem',           'distribuicao',  5,   14,   16, 2, 2),
  ('D03', 'Pátio de Contêineres',          'distribuicao',  5,   16,   12, 2, 2),
  ('D04', 'Central de Distribuição 1',     'distribuicao',  0,    1,  -12, 1, 1),
  ('D05', 'Central de Distribuição 2',     'distribuicao',  1,    4,   -7, 1, 1),
  ('D06', 'Central de Distribuição 3',     'distribuicao',  2,   11,   -5, 1, 1),
  ('D07', 'Central de Distribuição 4',     'distribuicao',  3,   12,   -5, 1, 1),
  ('D08', 'Central de Distribuição 5',     'distribuicao',  4,   11,    3, 1, 1),
  ('D09', 'Central de Distribuição 6',     'distribuicao',  5,   10,    6, 1, 1),
  ('D10', 'Central de Distribuição 7',     'distribuicao',  6,    3,    7, 1, 1),
  ('D11', 'Central de Distribuição 8',     'distribuicao',  7,    0,   11, 1, 1),
  ('D12', 'Central de Distribuição 9',     'distribuicao',  8,   -3,   11, 1, 1),
  ('D13', 'Central de Distribuição 10',    'distribuicao',  9,   -7,   10, 1, 1),
  ('D14', 'Central de Distribuição 11',    'distribuicao', 10,  -11,    6, 1, 1),
  ('D15', 'Central de Distribuição 12',    'distribuicao', 11,  -12,    1, 1, 1),
  # ── esporte ─────────────────────────────────────────────
  ('E01', 'Parque Olímpico',               'esporte',       6,    4,   10, 6, 6),
  ('E02', 'Hipódromo',                     'esporte',       4,   13,    4, 6, 3),
  # ── financeiro ─────────────────────────────────────────────
  ('F01', 'Distrito Financeiro',           'financeiro',    7,   -1,   12, 6, 2),
  # ── jardim ─────────────────────────────────────────────
  ('A01', 'Parque Central e Lago Maior',   'jardim',        3,    9,   -4, 6, 5),
  ('A02', 'Jardim Botânico',               'jardim',        9,   -8,    6, 3, 3),
  ('A03', 'Jardim das Coortes',            'jardim',       11,  -15,    2, 3, 3),
  ('A05', 'Alameda dos Fundadores',        'jardim',        6,    3,    8, 4, 1),
]

# ⚠️ O PROGRAMA DE BORDA, E ELE EXISTE PARA A CIDADE PARAR DE SER UM CÍRCULO.
# Medido em 29/08: `raio_borda` é 4.400 constante em TODO rumo, então o contorno
# do tecido é um círculo por construção; e 99 quarteirões de borda têm menos de
# 20 lotes, ou seja a última fileira é uma meia quadra vazia que serrilha o
# perímetro. O fundador viu de cima e disse: "as bordas são todas serrilhadas,
# nada parece ter uma continuação planejada".
#
# ⚠️ ESTAS PEÇAS NÃO CUSTAM UM LOTE. Todas moram além de R_ABOBADA (4.400), onde
# `livre()` já recusava qualquer lote antes delas existirem. Por isso este bloco
# entra SEM replante: o CSV sai byte a byte igual.
#
# O quadro delas é RADIAL: rot = rumo, então o x local é tangente ao Cinturão e o
# z local é a profundidade para fora. É o que faz a peça de borda parecer
# construída CONTRA a borda, e não largada perto dela.
#
# E o alcance é DESIGUAL de propósito: uma reentrância de 4.480 ao lado de um
# braço de 4.950 é o que troca o círculo por uma engrenagem vista de cima. Peça
# de borda com profundidade constante só engrossaria o mesmo círculo.
# (id, nome, tipo, rumo, raio do centro, meia testada, meia profundidade)
PROGRAMA_BORDA = [
  ('B01', 'Campo Solar Leste',        'distribuicao', 100, 4700, 300, 260),
  ('B02', 'Reservatório do Cinturão', 'distribuicao', 118, 4520, 150, 110),
  ('B03', 'Pátio de Manobra Sudeste', 'distribuicao', 133, 4780, 250,  95),
  ('B04', 'Campo de Radiadores',      'distribuicao', 150, 4880, 340, 190),
  ('B05', 'Hortas do Cinturão',       'jardim',       163, 4510, 200, 100),
  ('B06', 'Campo Solar Sul',          'distribuicao', 199, 4720, 280, 250),
  ('B07', 'Depósito de Regolito',     'distribuicao', 214, 4500, 170,  90),
  ('B08', 'Campo de Treino Sul',      'esporte',      228, 4790, 260, 180),
  ('B09', 'Reservatório do Poente',   'distribuicao', 243, 4530, 150, 115),
  ('B10', 'Campo Solar Oeste',        'distribuicao', 258, 4830, 300, 285),
  ('B11', 'Pátio de Manobra Oeste',   'distribuicao', 275, 4490, 240,  85),
  ('B12', 'Hortas do Poente',         'jardim',       289, 4700, 210, 170),
  ('B13', 'Campo de Treino Norte',    'esporte',      303, 4520, 240, 110),
  ('B14', 'Campo Solar Norte',        'distribuicao', 318, 4810, 290, 270),
  ('B15', 'Mirante do Cinturão',      'civico',       333, 4480, 110,  70),
  ('B16', 'Depósito Norte',           'distribuicao', 346, 4640, 190, 155),
]

# ⚠️ DUAS PEÇAS FICAM NA CASCA E CONTINUAM ELIPSE LIVRE. O Portão da Abóbada e o
# Farol vivem além de R_ABOBADA, onde não há malha nenhuma para ancorar: ali o
# referencial é a casca, não o quarteirão.
# (id, nome, tipo, rumo, raio, a, b, rot)
PROGRAMA_CASCA = [
  ('D01', 'Portão da Abóbada', 'distribuicao', 177, 4450, 170, 70, 87),
  ('C11', 'Farol do Portão',   'civico',       183, 4380,  45, 45,  0),
]

# ⚠️ OS ANÉIS: a hierarquia viária que faltava, e ela é ESTRUTURAL. Com 12
# bulevares radiais e mais nada, ir do setor 4 ao setor 8 obrigava a passar pela
# praça: a cidade era uma roda de bicicleta sem aro. Numa chapa isso não aparece;
# numa volta de carro aparece na primeira curva.
# ⚠️ E ELE É CÍRCULO DE VERDADE, NÃO POLÍGONO DA MALHA. Eu cheguei a propor que o
# anel seguisse a malha para economizar terra, com a conta da flecha de 180 m
# (2,3 m a r 1.750). A conta estava errada em escala: uma fileira de células é
# uma RETA que atravessa os 30 graus do setor inteiro, e a 30 graus ela se afasta
# do círculo em 97 m, não em 2. Seguir a malha daria um dodecágono com barriga
# visível. O anel corta a malha em ângulo, sobra quarteirão em cunha, e é isso
# mesmo que dá esquina boa de dirigir (Haussmann fez de propósito em Paris).
ANEIS = [
  ('AN1', 'Anel Interior', 1750.0, 26.0),
  ('AN2', 'Anel Médio',    2750.0, 26.0),
  ('AN3', 'Anel Exterior', 3750.0, 26.0),
  # ⚠️ A AVENIDA DO CINTURÃO FECHA A CIDADE. Sem ela o tecido simplesmente PARA
  # em 4.400 e a última fileira de quarteirão fica sendo a borda, o que numa
  # aérea lê como corte e não como fim. Ela mora dentro do Cinturão, onde nunca
  # houve lote, então custa zero.
  ('AN4', 'Avenida do Cinturão', 4450.0, 30.0),
]

# medição: SEM_ANEIS=1 mede quanto do estrago é do anel e quanto é da peça
if os.environ.get('SEM_ANEIS'):
    ANEIS = []

def _peca_xy(rumo, raio):
    a = math.radians(rumo)
    return math.sin(a) * raio, -math.cos(a) * raio

PROGRAMA_GEO = []
for pid, nome, tipo, setor, ix, iz, w, h in PROGRAMA_MALHA:
    rot = setor * GIRO_SETOR
    rr = math.radians(rot)
    c, sn = math.cos(rr), math.sin(rr)
    lx, lz = (ix + w/2) * CELULA, (iz + h/2) * CELULA
    PROGRAMA_GEO.append({'id': pid, 'nome': nome, 'tipo': tipo, 'forma': 'retangulo',
                         'cx': lx*c - lz*sn, 'cz': lx*sn + lz*c,
                         'a': w*CELULA/2, 'b': h*CELULA/2, 'rot': rot,
                         'c': c, 's': sn, 'setor': setor, 'ix': ix, 'iz': iz, 'w': w, 'h': h,
                         'area': w*h*CELULA*CELULA})
for pid, nome, tipo, rumo, raio, ea, eb in PROGRAMA_BORDA:
    cx, cz = _peca_xy(rumo, raio)
    rr = math.radians(rumo)
    PROGRAMA_GEO.append({'id': pid, 'nome': nome, 'tipo': tipo, 'forma': 'retangulo',
                         'cx': cx, 'cz': cz, 'a': float(ea), 'b': float(eb), 'rot': float(rumo),
                         'c': math.cos(rr), 's': math.sin(rr),
                         'area': 4 * ea * eb, 'borda': True})
for pid, nome, tipo, rumo, raio, ea, eb, rot in PROGRAMA_CASCA:
    cx, cz = _peca_xy(rumo, raio)
    rr = math.radians(rot)
    PROGRAMA_GEO.append({'id': pid, 'nome': nome, 'tipo': tipo, 'forma': 'elipse',
                         'cx': cx, 'cz': cz, 'a': float(ea), 'b': float(eb), 'rot': rot,
                         'c': math.cos(rr), 's': math.sin(rr),
                         'area': math.pi * ea * eb})

def em_programa(x, z, margem=2.0):
    """MUNDO = R(rot) · LOCAL, então LOCAL = R(-rot) · MUNDO."""
    for q in PROGRAMA_GEO:
        dx, dz = x - q['cx'], z - q['cz']
        lx =  dx*q['c'] + dz*q['s']
        lz = -dx*q['s'] + dz*q['c']
        if q['forma'] == 'retangulo':
            if abs(lx) <= q['a'] + margem and abs(lz) <= q['b'] + margem:
                return q
        elif (lx/(q['a']+margem))**2 + (lz/(q['b']+margem))**2 <= 1.0:
            return q
    return None

def num_anel(x, z, margem=2.0):
    r = math.hypot(x, z)
    for aid, nome, ra, larg in ANEIS:
        if abs(r - ra) <= larg/2 + margem:
            return aid
    return None

def dentro_do_coliseu(x, z, margem=0.0):
    """A elipse do hipódromo, no quadro girado dele."""
    dx, dz = x - COLISEU_CX, z - COLISEU_CZ
    c, sn = math.cos(COLISEU_ROT), math.sin(COLISEU_ROT)
    lx = dx*c - dz*sn
    lz = dx*sn + dz*c
    return (lx/(COLISEU_A+margem))**2 + (lz/(COLISEU_B+margem))**2 <= 1.0

def livre(x, z):
    r = math.hypot(x, z)
    if r < R_INICIO or r > raio_borda(x, z): return False
    # ⚠️ MARGEM DE 2 m NAS MÁSCARAS. O arquivo grava x e z como int16 em metros
    # inteiros, então um lote a 40 cm de fora da elipse do Coliseu arredondava
    # para dentro. Eram 3 lotes em 52.991, mas um deles bastava para furar a
    # promessa de guardar o espaço do Coliseu vazio.
    if math.hypot(x-PCX, z-PCZ) < PARQUE_DISCO + 2: return False
    if dentro_do_coliseu(x, z, 2.0): return False
    if em_programa(x, z) is not None: return False
    if num_anel(x, z) is not None: return False
    # o bulevar de 34 m sobre cada costura de setor é via, não lote
    ru = rumo_de(x, z)
    for s in range(SETORES):
        costura = s * (360/SETORES)
        dang = abs(((ru - costura + 180) % 360) - 180)
        if math.radians(dang) * r < BULEVAR/2: return False
    return declive(x, z) <= DECLIVE_MAX

def setor_de(x, z):
    return int(rumo_de(x, z) // (360/SETORES))

# ── o tecido: quartos, quarteirões, lotes, por setor ───────────────────────
def tecido():
    """Devolve por setor a lista de quarteirões, cada um com os seus 84 lotes."""
    por_setor = [[] for _ in range(SETORES)]
    passo_q = CELULA * QUARTO                       # 540 m
    alcance = int(R_SITIO / passo_q) + 2
    for s in range(SETORES):
        ang = math.radians(s * GIRO_SETOR)
        ca, sa = math.cos(ang), math.sin(ang)
        vistos = set()
        for qz in range(-alcance, alcance+1):
            for qx in range(-alcance, alcance+1):
                # centro do quarto no referencial girado do setor
                lx, lz = (qx+0.5)*passo_q, (qz+0.5)*passo_q
                wx, wz = lx*ca - lz*sa, lx*sa + lz*ca
                if math.hypot(wx, wz) > R_SITIO + passo_q: continue
                quarteiroes = []
                for cz in range(QUARTO):
                    for cx in range(QUARTO):
                        if cx == 1 and cz == 1: continue      # a praça do quarto
                        blx = lx + (cx-1)*CELULA
                        blz = lz + (cz-1)*CELULA
                        bwx, bwz = blx*ca - blz*sa, blx*sa + blz*ca
                        if setor_de(bwx, bwz) != s: continue
                        lotes = []
                        for ry in range(LOTE_ROWS):
                            for rx in range(LOTE_COLS):
                                ox = (rx - (LOTE_COLS-1)/2) * LOTE_W
                                oz = (ry - (LOTE_ROWS-1)/2) * LOTE_D * 1.12
                                px_, pz_ = blx+ox, blz+oz
                                fx, fz = px_*ca - pz_*sa, px_*sa + pz_*ca
                                if not livre(fx, fz): continue
                                if setor_de(fx, fz) != s: continue
                                lotes.append((fx, fz))
                        if len(lotes) >= 20:      # quarteirão de borda vale, se sobrar meia quadra
                            quarteiroes.append({'x': bwx, 'z': bwz, 'lotes': lotes,
                                                'r': math.hypot(bwx, bwz)})
                if quarteiroes:
                    ch = (round(wx), round(wz))
                    if ch in vistos: continue
                    vistos.add(ch)
                    por_setor[s].append({'x': wx, 'z': wz, 'r': math.hypot(wx, wz),
                                         'quarteiroes': quarteiroes})
    return por_setor

print('medindo o tecido...', file=sys.stderr)
T = tecido()
cap = [sum(len(b['lotes']) for q in T[s] for b in q['quarteiroes']) for s in range(SETORES)]
for s in range(SETORES):
    print(f'  setor {s+1:2d} (rumo {s*30:3d}): {len(T[s]):3d} quartos, '
          f'{sum(len(q["quarteiroes"]) for q in T[s]):4d} quarteirões, {cap[s]:6,d} lotes',
          file=sys.stderr)
CAP = sum(cap)
print(f'CAPACIDADE TOTAL: {CAP:,} lotes', file=sys.stderr)

# ── as carteiras, na ordem de chegada de verdade ───────────────────────────
elig = {}
with open(p('data/holders_by_age.csv'), newline='') as f:
    for row in csv.DictReader(f):
        try: dog = float(row['total_dog'])
        except (ValueError, KeyError): continue
        if dog >= 20000: elig[row['address']] = dog
U = json.load(open(p('data/dog_utxos_by_address.json')))
carteiras = []
for a in elig:
    lst = U.get(a) or []
    if not lst: continue
    v = min(lst, key=lambda x: (x['ts'], x['txid'], x['vout']))
    carteiras.append((v['ts'], v['txid'], v['vout'], a))
carteiras.sort()
N = len(carteiras)
print(f'carteiras ordenadas: {N:,} | chaves distintas: {len({c[:3] for c in carteiras}):,}',
      file=sys.stderr)

# ── as camadas ─────────────────────────────────────────────────────────────
# ⚠️ OS DADOS MORAM NO REPO, NÃO NUM SCRATCHPAD. A primeira versão lia de $S
# com queda para /tmp, e os dois arquivos ficaram no scratchpad de uma sessão
# que morreu: rodar o gerador de novo deu "genealogia ausente" e a cidade saiu
# sem os 185 enclaves de família e sem o condomínio do DSC, calada. Reboot da
# máquina teria levado a genealogia inteira. O $S continua valendo como
# atalho de quem está iterando, mas o padrão é data/.
def entrada(nome, legado):
    aqui = p('data', nome)
    if os.path.exists(aqui): return aqui
    return os.path.join(os.environ.get('S', '/tmp'), legado)

SCR = os.environ.get('S', '/tmp')
familia_de, familias_grandes = {}, {}
try:
    g = json.load(open(entrada('dogcity_genealogia.json', 'genealogia_tudo.json')))
    pai = dict(zip(g['w'], g['p'])); prof = dict(zip(g['w'], g['d']))
    def anc1(x):
        cur, gd = x, 0
        while cur is not None and gd < 60:
            pr = prof.get(cur)
            if pr is None or pr < 1: return None
            if pr == 1: return cur
            cur = pai.get(cur); gd += 1
        return None
    bruto = {}
    for _, _, _, a in carteiras:
        an = anc1(a)
        if an: bruto.setdefault(an, []).append(a)
    # ⚠️ SÓ FAMÍLIA DE 10 OU MAIS VIRA ENCLAVE. Medido: 91,7% das 32.763 famílias
    # têm uma carteira só, então marcar todas seria marcar ninguém.
    fid = 0
    for an, membros in sorted(bruto.items(), key=lambda kv: -len(kv[1])):
        if len(membros) < 10: continue
        fid += 1
        familias_grandes[fid] = {'ancestral': an, 'membros': len(membros)}
        for m in membros: familia_de[m] = fid
    print(f'enclaves de família (10 ou mais): {fid} cobrindo {len(familia_de):,} carteiras',
          file=sys.stderr)
except FileNotFoundError:
    print('genealogia ausente, seguindo sem enclaves', file=sys.stderr)

dsc = set()
try:
    dd = json.load(open(entrada('dogcity_dsc_donos.json', 'dsc_donos.json')))
    dsc = {a for _, a in dd['pares'] if a and a in elig}
    print(f'carteiras DSC que passam no portão: {len(dsc)}', file=sys.stderr)
except FileNotFoundError:
    print('DSC ausente', file=sys.stderr)

# ── a ordem de passo: agora são PRATELEIRAS, não vagas ─────────────────────
# ⚠️ MUDOU DE VAGA PARA METRO DE TESTADA em 28/08. Antes o quarteirão era 84
# caixas de 12 x 25 m e cada carteira pegava uma. Com área variável isso não
# serve: dar uma vaga de 300 m² para um lote de 50 desperdiça 250, e são 2.051
# lotes abaixo de 60 m². Agora cada quarteirão oferece 6 prateleiras de 25 m de
# profundidade e a carteira consome TESTADA conforme a área que lhe cabe.
# Frente variável ao longo da rua é exatamente o que cidade velha parece.
PROF = FILA_PROF
def prateleiras_de(s):
    """Por setor, as prateleiras em ordem de chegada: mais perto da praça primeiro."""
    out = []
    for iq, q in enumerate(sorted(T[s], key=lambda q: q['r'])):
        for ib, b in enumerate(sorted(q['quarteiroes'], key=lambda b: b['r'])):
            # o quarteirão de borda entra com a testada proporcional ao que
            # sobrou dele depois da máscara (relevo, bulevar, coliseu, borda)
            frac = len(b['lotes']) / (LOTE_COLS * LOTE_ROWS)
            util = QUARTEIRAO * frac
            ang = math.radians(s * GIRO_SETOR)
            ca, sa = math.cos(ang), math.sin(ang)
            # ⚠️ TODA FILEIRA DÁ FRENTE PARA RUA, e a primeira versão não dava.
            # Ela punha as 6 fileiras igualmente espaçadas a 28 m, então as quatro
            # do meio davam frente para uma fresta de 3 m, que não é rua: eram
            # lotes encravados, e lote encravado não se vende nem se acessa.
            # O plano diretor manda 3 faixas de 50 m separadas por 2 travessas de
            # 9 m, ou seja fileiras COSTAS COM COSTAS: cada par divide o fundo e
            # cada lote abre para a via da frente. As de fora abrem para a via de
            # 12 m que contorna o quarteirão; as de dentro, para as travessas.
            # (borda da via, sentido em que o lote cresce)
            meio = QUARTEIRAO / 2                     # 84
            frentes = [
                (-meio, +1),                                  # abre para o contorno
                (-(meio - FAIXA), -1),                        # abre para a travessa 1
                (-(meio - FAIXA) + TRAVESSA, +1),             # abre para a travessa 1
                (+(meio - FAIXA) - TRAVESSA, -1),             # abre para a travessa 2
                (+(meio - FAIXA), +1),                        # abre para a travessa 2
                (+meio, -1),                                  # abre para o contorno
            ]
            for fila in range(LOTE_ROWS):
                borda_z, sentido = frentes[fila]
                # ⚠️ O ENDEREÇO NASCE AQUI. Sem carregar quarto e quarteirão pela
                # prateleira não há como compor S{setor}-Q{quarto}-B{quarteirão}
                # -L{lote} na hora de plantar, e sem endereço o lote não é de
                # ninguém: até 28/08 o vínculo lote-carteira só existia na
                # memória da rodada e era jogado fora ao gravar.
                out.append({'bx': b['x'], 'bz': b['z'],
                            'borda': borda_z, 'sentido': sentido, 'ca': ca, 'sa': sa,
                            'x0': -util / 2, 'livre': util, 'util0': util, 'r': b['r'],
                            'q': iq + 1, 'b': ib + 1})
    return out
PASSO = [prateleiras_de(s) for s in range(SETORES)]

# ── a área de cada carteira (masterplan §9, decisões 1 e 3) ────────────────
# area = k · saldo^EXPOENTE · (r/R_INICIO)^GRADIENTE, com k calibrado para a
# soma dar exatamente o tecido alvo. O raio entra depois, quando a carteira já
# tem lugar; aqui vale o raio médio, e a calibração se refaz no fim.
soma_raiz = sum(elig[a] ** EXPOENTE for _, _, _, a in carteiras)
def area_de(dog, r):
    return K_AREA * (dog ** EXPOENTE) * ((r / R_INICIO) ** GRADIENTE)
def _mg():
    sm = w = 0.0
    for i in range(2000):
        r = R_INICIO + (R_ABOBADA - R_INICIO) * (i + 0.5) / 2000
        sm += (r / R_INICIO) ** GRADIENTE * r; w += r
    return sm / w
K_AREA = 0.0   # calibrado adiante, contra o tecido que sobrou depois dos lobos

# ── capacidade agora é ÁREA, não contagem ──────────────────────────────────
cap_area = [sum(pr['livre'] for pr in PASSO[s]) * PROF for s in range(SETORES)]
CAP_AREA = sum(cap_area)
# ⚠️ A CURVA SE CALIBRA CONTRA O TECIDO QUE EXISTE, não contra um alvo escrito
# à mão. A primeira versão mirava os 16,33 km² do plano diretor e o contorno
# lobado só deixou 12,51: 9.613 carteiras ficaram sem lote, caladas. Agora o
# lobo é uma alavanca de gosto com preço medido, e o preço aparece no tamanho
# do lote de todo mundo, não numa carteira que some.
# O 0,97 é folga de empacotamento: a última carteira de cada prateleira raramente
# fecha a testada exata.
K_AREA = (CAP_AREA * 0.97) / (_mg() * soma_raiz)
print(f'tecido disponível: {CAP_AREA/1e6:.2f} km² | curva: expoente {EXPOENTE}, '
      f'gradiente {GRADIENTE}, k = {K_AREA:.6g}', file=sys.stderr)
for s in range(SETORES):
    print(f'  setor {s+1:2d} (rumo {s*30:3d}): {len(T[s]):3d} quartos, '
          f'{sum(len(q["quarteiroes"]) for q in T[s]):4d} quarteirões, '
          f'{cap_area[s]/1e4:8,.1f} ha', file=sys.stderr)

# ── o condomínio do DSC: as prateleiras mais internas do setor do rumo 68,7 ─
S_DSC = int(DSC_RUMO // (360/SETORES))

# ── cota por setor: por ÁREA pedida, não por cabeça ────────────────────────
# ⚠️ A cota mudou de contagem para área junto com a curva. Duas carteiras não
# pesam mais igual: uma de 4 ha ocupa o mesmo que 800 do portão.
r_medio = [ (sum(pr['r'] for pr in PASSO[s]) / max(1, len(PASSO[s]))) for s in range(SETORES) ]

# ⚠️ O RITMO POR SETOR É O ANTI-ANEL. Ele faz cada setor encher em velocidade
# diferente, então a frente de ocupação de um está mais longe da praça que a do
# vizinho e a MESMA coorte cai em raios diferentes conforme o rumo, que é a
# regra 3 do fundador. Medido contra o lobo, que fazia o mesmo serviço cortando
# terra: R² de coorte contra raio cai de 0,8477 para 0,6433, a sobreposição
# entre coortes vizinhas sobe de 59,9% para 70,4%, e o custo em terra é ZERO.
# Cinco lobos porque a leitura de cinco é a que o fundador pediu (Fibonacci);
# aqui ela vive no tecido em vez de viver no contorno.
RITMO_LOBOS, RITMO_AMP = 5, 0.45
peso_setor = [1 + RITMO_AMP * math.cos(RITMO_LOBOS * (math.radians(s * (360/SETORES)) - LOBO_FASE))
              for s in range(SETORES)]
def area_nominal(dog, s):
    return K_AREA * (dog ** EXPOENTE) * ((max(r_medio[s], R_INICIO) / R_INICIO) ** GRADIENTE)

gerais = [c for c in carteiras if c[3] not in dsc]
capg = list(cap_area)
usado = [0.0]*SETORES
destino = []
for c in gerais:
    melhor, mfolga = -1, -1e18
    for s in range(SETORES):
        pedido = area_nominal(elig[c[3]], s)
        if usado[s] + pedido > capg[s]: continue
        folga = (capg[s] - usado[s]) / capg[s] * peso_setor[s]
        if folga > mfolga: mfolga, melhor = folga, s
    if melhor < 0:
        melhor = max(range(SETORES), key=lambda s: capg[s] - usado[s])
    usado[melhor] += area_nominal(elig[c[3]], melhor)
    destino.append(melhor)

# ── planta: consome TESTADA das prateleiras ───────────────────────────────
# ⚠️ DUAS PASSADAS, e a segunda não é luxo. A primeira versão calibrava a curva
# contra a área disponível e a cidade saía com 78% dela ocupada: a mediana caiu
# para 150 m² quando a curva prometia 230. O que come a diferença é o
# empacotamento, e ele não tem fórmula fechada: a frente mínima de 5 m gasta
# 125 m² de prateleira num lote de 21, e a última carteira de cada fileira
# quase nunca fecha a testada exata. Então a passada 1 MEDE o desperdício e a
# passada 2 corrige o k por ele.
cursor = [0]*SETORES
saida = []
sem_lugar = []       # carteiras que não acharam lugar na passada corrente
aparadas = []        # carteiras que couberam só com corte de cabelo (addr, escala)
falhou_em = []       # diagnóstico: setor onde a carteira ficou sem lugar
no_bloco = {}        # (setor, quarto, quarteirão) -> quantos lotes já plantados
# ⚠️ O EMPACOTAMENTO PROCURA PRATELEIRA, NÃO ACEITA A PRIMEIRA. A versão de
# estreia pegava a primeira prateleira com qualquer sobra e espremia o lote nela:
# um lote de 1.600 m² caindo numa sobra de 6 m virava um corredor de 6 por 266 m,
# a profundidade batia no teto de 255 e o resto da área EVAPORAVA. Era isso que
# segurava o aproveitamento em 80% e fazia a bisseção parar cedo, com o lote de
# todo mundo menor do que a terra permitia.
# Agora: calcula a testada natural, varre uma JANELA de prateleiras à frente
# procurando uma que caiba inteira, e só se nenhuma couber usa a de maior sobra,
# com a profundidade compensando. A janela é curta de propósito: o lote tem de
# ficar perto do lugar que a idade lhe deu, senão a regra 1 vira enfeite.
JANELA = 24
PROF_MAX = FAIXA             # 50 m: além disso o lote atravessaria a travessa e comeria a rua

def coloca(s, dog, addr, escala=1.0):
    """Consome testada e devolve (x, z, frente, prof).

    `escala` encolhe a área pedida. Ver a nota do corte de cabelo em uma_passada()."""
    n = len(PASSO[s])
    while cursor[s] < n and PASSO[s][cursor[s]]['livre'] < LOTE_MIN_FRENTE:
        cursor[s] += 1
    if cursor[s] >= n: return None
    base = cursor[s]
    area = area_de(dog, max(PASSO[s][base]['r'], R_INICIO)) * escala
    frente_nat = max(area / PROF, LOTE_MIN_FRENTE)

    escolhida, folgada = -1, -1
    for k in range(base, min(n, base + JANELA)):
        sobra = PASSO[s][k]['livre']        # ⚠️ não chame isto de `livre`: sombreia a função da máscara
        if sobra + 1e-9 >= frente_nat:
            escolhida = k; break
        if sobra > folgada: folgada, escolhida_alt = sobra, k
    if escolhida < 0:
        # ninguém comporta a testada natural: usa a de maior sobra e afunda o lote
        escolhida = escolhida_alt if folgada >= LOTE_MIN_FRENTE else -1
        if escolhida < 0:
            for k in range(base, min(n, base + JANELA)): PASSO[s][k]['livre'] = 0.0
            cursor[s] = base
            return coloca(s, dog, addr, escala) if base + JANELA < n else None

    pr = PASSO[s][escolhida]

    # ⚠️ O GIGANTE PEGA PRATELEIRA INTEIRA. Sem este ramo o teto de profundidade
    # decapita o topo da curva: o maior lote caía de 30.244 para 12.600 m², que é
    # exatamente 168 x 75, e a área perdida ia parar no lote dos outros. São umas
    # poucas dezenas de carteiras, mas são justamente as que a regra da raiz
    # existe para tratar, então truncar aqui esvazia a regra.
    # ⚠️ QUEM PASSA DA FAIXA VIRA SUPERQUADRA, e isso não é exceção, é urbanismo:
    # um lote de 4 hectares não é lote de rua, é quarteirão inteiro, com frente
    # para as quatro vias de contorno e sem travessa por dentro. Sem esta regra o
    # lote fundo atravessava a travessa e comia a rua dos vizinhos, que é
    # justamente o que a regra do fundador proíbe.
    if area > PROF_MAX * QUARTEIRAO:
        # ⚠️ A SUPERQUADRA EXIGE UM QUARTEIRÃO INTEIRO E VIRGEM, e isso é conserto
        # de um defeito medido, não zelo. A versão anterior tomava 6 prateleiras a
        # partir da ESCOLHIDA, que pode ser a fileira 3: ela consumia as fileiras
        # 3..5 deste quarteirão e 0..2 do SEGUINTE, mas gravava o lote centrado no
        # quarteirão da escolhida, EM CIMA de lotes já plantados nas fileiras 0..2.
        # Medido em 29/08 contra data/dogcity_lotes.csv: 7 das 24 superquadras
        # cobriam 141 lotes normais (S06-Q19-B004 cobria 31, S07-Q09-B002 29,
        # S12-Q17-B005 31) e 17 quarteirões seguintes ficavam com as primeiras
        # fileiras vazias.
        # Agora ela varre para a frente até achar um quarteirão cujas seis
        # fileiras ainda estejam com a testada original, toma as seis e grava no
        # centro dele. Se não achar nenhum, cai no ramo normal e recebe um lote
        # limitado à faixa: perde área, mas não come o lote de ninguém.
        alvo = -1
        j = cursor[s]
        while j + LOTE_ROWS <= n:
            pj = PASSO[s][j]
            comeca_quarteirao = j == 0 or (PASSO[s][j-1]['q'], PASSO[s][j-1]['b']) != (pj['q'], pj['b'])
            if comeca_quarteirao:
                bloco = PASSO[s][j:j+LOTE_ROWS]
                mesmo = all((x['q'], x['b']) == (pj['q'], pj['b']) for x in bloco)
                virgem = all(x['livre'] >= x['util0'] - 0.01 for x in bloco)
                if mesmo and virgem:
                    alvo = j
                    break
            j += 1
        if alvo >= 0:
            pq = PASSO[s][alvo]
            prof_g = min(QUARTEIRAO, area / QUARTEIRAO)
            # centro do quarteirão: com a superquadra ocupando tudo, ox e oz são 0
            _cx, _cz = pq['bx'], pq['bz']
            if livre(_cx, _cz):
                for k in range(alvo, alvo + LOTE_ROWS):
                    PASSO[s][k]['x0'] += PASSO[s][k]['livre']
                    PASSO[s][k]['livre'] = 0.0
                return (_cx, _cz, QUARTEIRAO, prof_g, pq['q'], pq['b'])
            # quarteirão em terra proibida: queima e tenta o próximo
            for k in range(alvo, alvo + LOTE_ROWS):
                PASSO[s][k]['livre'] = 0.0
            return coloca(s, dog, addr)
        # sem quarteirão virgem à frente: segue no ramo normal, com o lote preso
        # à faixa. A bisseção enxerga a área menor e se ajusta.

    frente = min(frente_nat, pr['livre'])
    prof_real = area / frente
    if prof_real > PROF_MAX:
        # ainda fundo demais: alarga até o limite da sobra e aceita o que couber
        frente = pr['livre']
        prof_real = min(PROF_MAX, area / frente)
    # ⚠️ CONFIRA A MÁSCARA NO PONTO QUE VAI SER GRAVADO. A sondagem de tecido()
    # testa 84 pontos fixos por quarteirão; o lote de largura variável não cai em
    # cima deles, então a borda do quarteirão escorregava para dentro de máscara.
    # Resíduo medido depois de consertar a rotação dupla: 236 lotes no Parque,
    # 126 DENTRO do Coliseu congelado (que o fundador mandou guardar vazio), 123
    # fora do contorno lobado e 360 dentro do platô. Aqui o ponto é conferido um
    # a um e a testada ruim é queimada em vez de virar endereço.
    ox = pr['x0'] + frente / 2
    ok = False
    for _ in range(14):
        ozc = pr['borda'] + pr['sentido'] * prof_real / 2
        cx = pr['bx'] + ox*pr['ca'] - ozc*pr['sa']
        cz = pr['bz'] + ox*pr['sa'] + ozc*pr['ca']
        if livre(cx, cz): ok = True; break
        # ⚠️ ANDE UM PASSO DE SONDAGEM, NÃO A TESTADA INTEIRA. Queimar `frente` a
        # cada rejeição custou 53 m² no lote mediano (294 caiu para 241): a
        # prateleira inteira ia embora por causa de uma ponta ruim. O passo de
        # 12 m é a largura da vaga antiga, ou seja a resolução em que a máscara
        # foi sondada; abaixo disso não há informação nova.
        passo = min(frente, 12.0)
        pr['x0'] += passo; pr['livre'] -= passo
        if pr['livre'] < max(frente, LOTE_MIN_FRENTE): break
        ox = pr['x0'] + frente / 2
    if not ok:
        # ⚠️ NÃO GRAVE ENDEREÇO EM TERRA MASCARADA. O fundador congelou o Coliseu
        # e mandou guardar o espaço; lote plantado ali teria de ser desfeito, e
        # lote atribuído não se desfaz. Melhor perder a prateleira que a regra.
        # ⚠️ E ZERE SÓ ESTA PRATELEIRA. Empurrar o cursor para escolhida+1
        # descartava também todas as prateleiras entre a atual e ela, até 24 de
        # uma vez: custou 24 pontos de aproveitamento e 26 m² no lote mediano.
        pr['livre'] = 0.0
        return coloca(s, dog, addr)
    pr['x0'] += frente; pr['livre'] -= frente
    # ⚠️ ROTACIONE O DESLOCAMENTO, NUNCA O CENTRO DO QUARTEIRÃO. `bx/bz` já vêm
    # em MUNDO (saem de bwx/bwz dentro de tecido()); girar a soma dos dois girava
    # a cidade uma segunda vez. O estrago era invisível na contagem e enorme no
    # mapa: 49.021 lotes, 92,5% da cidade, com o setor gravado diferente do rumo
    # geométrico, 9.902 lotes caídos DENTRO do disco do Parque Runestone, 4.791
    # em declive acima de 4°, 1.263 em cima de bulevar, 253 dentro do Coliseu
    # congelado e 9 fora do sítio. As máscaras eram testadas no quadro certo
    # dentro de tecido() e o ponto era gravado a partir de outro quadro, então
    # nenhuma delas valia na saída. O contorno lobado também sumia por isso.
    # ⚠️ O LOTE CRESCE A PARTIR DA VIA, não em volta do eixo da fileira. Centrar
    # na fileira fazia o lote fundo invadir a travessa dos dois lados e comer a
    # rua que ele mesmo precisa.
    oz = pr['borda'] + pr['sentido'] * prof_real / 2
    wx = pr['bx'] + ox*pr['ca'] - oz*pr['sa']
    wz = pr['bz'] + ox*pr['sa'] + oz*pr['ca']
    return (wx, wz, frente, min(255.0, prof_real), pr['q'], pr['b'])

def uma_passada():
    global PASSO, cursor, saida
    PASSO = [prateleiras_de(s) for s in range(SETORES)]
    cursor = [0]*SETORES
    saida = []
    sem_lugar.clear()
    aparadas.clear()
    no_bloco.clear()
    # ⚠️ O DSC PLANTA PRIMEIRO, E ISSO CONSERTA DOIS DEFEITOS DE UMA VEZ.
    # (1) Ele plantava DEPOIS de todas as 52.953 gerais, quando o setor 3 já
    #     tinha acabado, e (2) o laço dele descartava calado: `if r:` sem else,
    #     exatamente o defeito que o comentário do laço geral avisa em voz alta.
    #     Medido em 29/08 com o programa novo: as 34 carteiras que a bisseção
    #     enxergava como "não cabe" eram as 34 do DSC, todas elas, e o preço era
    #     a mediana da cidade inteira cair de 264 para 212 m².
    # (3) E é o que a regra 4 do fundador manda: o condomínio do Dog Social Club
    #     ocupa os lotes MAIS INTERNOS do setor dele ignorando a idade. Plantando
    #     por último ele pegava a sobra da periferia, ou seja a regra estava
    #     escrita na documentação e desmentida pelo código.
    for a in sorted(dsc):
        r = coloca(S_DSC, elig[a], a)
        if r is None:
            sem_lugar.append(a); continue
        chave = (S_DSC, r[4], r[5])
        no_bloco[chave] = no_bloco.get(chave, 0) + 1
        saida.append((r[0], r[1], S_DSC, a, r[2], r[3], r[4], r[5], no_bloco[chave]))

    for c, s in zip(gerais, destino):
        r = coloca(s, elig[c[3]], c[3])
        if r is None:
            alt = max(range(SETORES), key=lambda t: sum(pr['livre'] for pr in PASSO[t][cursor[t]:]))
            r = coloca(alt, elig[c[3]], c[3])
            s = alt
        # ⚠️ CORTE DE CABELO EM VEZ DE REPROVAR A PASSADA, e isto conserta um
        # defeito medido do gerador: UMA carteira sem prateleira reprovava a
        # passada inteira, a bisseção baixava k, e os 52.987 lotes encolhiam
        # juntos. Medido em 29/08 com o programa novo: 34 carteiras de 52.987
        # (0,06%) não cabiam em k=0,198 e o preço disso era a mediana cair de
        # 262 para 212 m², ou seja 0,06% da cidade cobrava 19% de todo mundo.
        # Quem não cabe é a cauda do plantio, o fim da fila do setor, então
        # encolher ELAS é o oposto de privilégio: é a única carteira que paga o
        # próprio aperto. A escala mínima é 0,15; abaixo disso a passada reprova
        # de verdade, porque aí o problema é terra e não empacotamento.
        for esc in (0.6, 0.35, 0.15):
            if r is not None: break
            for t in (s, max(range(SETORES), key=lambda t: sum(pr['livre'] for pr in PASSO[t][cursor[t]:]))):
                r = coloca(t, elig[c[3]], c[3], esc)
                if r is not None:
                    s = t; aparadas.append((c[3], esc)); break
        if r is None and os.environ.get('DIAG'):
            falhou_em.append(s)
        if r is None:
            # ⚠️ NUNCA DESCARTE CALADO. Isto era `continue`, e a regra do fundador
            # é inegociável: todo elegível tem endereço. Sem esta contagem a
            # bisseção enxergava a passada como boa e o script gravava uma cidade
            # com carteira faltando, saindo com código 0.
            sem_lugar.append(c[3]); continue
        chave = (s, r[4], r[5])
        no_bloco[chave] = no_bloco.get(chave, 0) + 1
        saida.append((r[0], r[1], s, c[3], r[2], r[3], r[4], r[5], no_bloco[chave]))
    if os.environ.get('DIAG') and sem_lugar:
        import collections
        print('  DIAG %d sem lugar; por setor: %s' % (len(sem_lugar),
              dict(sorted(collections.Counter(falhou_em).items()))), file=sys.stderr)
        for t in range(SETORES):
            resto = sum(pr['livre'] for pr in PASSO[t][cursor[t]:])
            usadas = sum(1 for pr in PASSO[t] if pr['livre'] < 0.01)
            print('    S%02d cursor %4d/%4d  testada livre restante %8.0f m  prateleiras zeradas %4d'
                  % (t+1, cursor[t], len(PASSO[t]), resto, usadas), file=sys.stderr)
        falhou_em.clear()
    return sum(w*d for _,_,_,_,w,d,_,_,_ in saida)

# ⚠️ BISSEÇÃO, e a razão é que as duas coisas brigam: k maior dá lote maior e
# k grande demais deixa carteira sem lote. A regra é inegociável (todo elegível
# tem endereço), então a busca é pelo MAIOR k em que ainda cabe todo mundo, e o
# resultado guardado é sempre o de uma passada completa.
# ⚠️ A BISSEÇÃO PRECISA DE UM PISO PROVADO. Se a passada 1 já não coubesse, o
# laço saía na primeira volta com saida_boa em None e o script GRAVAVA a cidade
# incompleta, saindo com código 0. Aconteceu de verdade com a borda em 4.300:
# 52.988 de 52.991, sem um aviso. Agora o piso é provado antes de bisseccionar:
# k cai pela metade até caber, e se nem assim couber o script morre alto.
alvo = CAP_AREA * 0.97
k_bom, saida_boa = None, None
k_lo, k_hi = K_AREA, None
for tentativa in range(6):
    obtido = uma_passada()
    coube = len(saida) >= N
    med = sorted(w*d for _,_,_,_,w,d,_,_,_ in saida)[len(saida)//2] if saida else 0
    print(f'  passada {tentativa+1}: k={K_AREA:.5g}  {len(saida):,} plantadas, '
          f'{obtido/1e6:.2f} km² ({obtido/alvo*100:.0f}% do alvo), mediana {med:,.0f} m²'
          f'  {"cabe" if coube else "NAO CABE"}', file=sys.stderr)
    if coube:
        k_bom, saida_boa, k_lo = K_AREA, list(saida), K_AREA
        if k_hi is None:
            K_AREA /= max(0.55, obtido/alvo)      # primeiro salto: mira o desperdício medido
            continue
    else:
        k_hi = K_AREA
    if k_hi is None: break
    if (k_hi - k_lo) / k_lo < 0.02: break
    K_AREA = (k_lo + k_hi) / 2
if saida_boa is None:
    # nenhuma passada coube: desce k até provar um piso, e DEPOIS volta a subir.
    # ⚠️ Sem a segunda metade o piso fica onde o primeiro salto o deixou: medido
    # com a borda em 4.300, o piso caía de 0,2205 para 0,1323 e a mediana ia
    # para 148 m² quando 286 quase cabia. Achar o piso é meia solução.
    k_falha = K_AREA
    for _ in range(8):
        K_AREA *= 0.6
        uma_passada()
        print(f'  piso: k={K_AREA:.5g} -> {len(saida):,} plantadas', file=sys.stderr)
        if len(saida) >= N:
            saida_boa, k_bom = list(saida), K_AREA
            break
    if saida_boa is not None:
        lo, hi = k_bom, k_falha
        for _ in range(5):
            if (hi - lo) / lo < 0.02: break
            K_AREA = (lo + hi) / 2
            uma_passada()
            coube = len(saida) >= N
            med = sorted(w*d for _,_,_,_,w,d,_,_,_ in saida)[len(saida)//2] if saida else 0
            print(f'  sobe: k={K_AREA:.5g} -> {len(saida):,} plantadas, mediana {med:,.0f} m²'
                  f'  {"cabe" if coube else "NAO CABE"}', file=sys.stderr)
            if coube: saida_boa, k_bom, lo = list(saida), K_AREA, K_AREA
            else: hi = K_AREA
if saida_boa is not None:
    saida, K_AREA = saida_boa, k_bom

# ⚠️ GUARDA DURA: a regra do fundador é que todo elegível tem endereço. Se a
# cidade sair incompleta o script MORRE em vez de gravar, porque arquivo gravado
# vira prancha, prancha vira decisão e ninguém confere a contagem de novo.
# ⚠️ CONFERÊNCIA DA DEMARCAÇÃO. A regra de ouro é que o equipamento é reservado
# ANTES do lote; se um lote gravado cai dentro de peça, a reserva é decorativa.
invasores = [(a, q['nome']) for x, z, s, a, w, d, _q, _b, _n in saida
             if (q := em_programa(x, z, 0.0)) is not None]
if invasores:
    print(f'ERRO: {len(invasores)} lotes dentro de peça demarcada. Nada foi gravado.', file=sys.stderr)
    for a, nome in invasores[:5]: print(f'  {a} em {nome}', file=sys.stderr)
    sys.exit(1)

if len(saida) < N:
    print(f'ERRO: {N - len(saida):,} carteiras sem lote de {N:,}. Nada foi gravado.',
          file=sys.stderr)
    if sem_lugar[:5]:
        print(f'  exemplos: {sem_lugar[:5]}', file=sys.stderr)
    sys.exit(1)

print(f'plantadas {len(saida):,} de {N:,}', file=sys.stderr)
areas = sorted(w*d for _,_,_,_,w,d,_,_,_ in saida)
if areas:
    print(f'lote: menor {areas[0]:,.0f} m² | mediana {areas[len(areas)//2]:,.0f} | '
          f'p99 {areas[int(len(areas)*.99)]:,.0f} | maior {areas[-1]:,.0f}', file=sys.stderr)
    print(f'área somada dos lotes: {sum(areas)/1e6:.2f} km²', file=sys.stderr)

# ── grava ──────────────────────────────────────────────────────────────────
posto = {c[3]: i for i, c in enumerate(carteiras)}
UTX = {}
with open(p('data/holders_by_age.csv'), newline='') as f:
    for row in csv.DictReader(f):
        try: UTX[row['address']] = int(float(row.get('utxo_count') or 1))
        except (ValueError, KeyError): pass
def forma_de(u):
    if u <= 1: return 0        # massa única: casa no centro, fazenda na borda
    if u <= 3: return 1        # pátio, geminada
    if u <= 9: return 2        # condomínio baixo
    if u <= 99: return 3       # torre
    return 4                   # quarteirão com várias torres
buf = bytearray()
for x, z, s, a, w, d, _q, _b, _n in saida:
    coorte = min(7, posto[a]*8//N)
    fam = familia_de.get(a, 0)
    fl = (1 if a in dsc else 0) | (forma_de(UTX.get(a, 1)) << 1)
    buf += struct.pack('<hhBBHBBB', int(round(x)), int(round(z)), s, coorte,
                       min(65535, fam), fl,
                       max(1, min(255, int(round(w)))), max(1, min(255, int(round(d)))))
open(p('public/city/cidade-lotes.bin'), 'wb').write(buf)

# ═══════════════════════════════════════════════════════════════════════════
# O REGISTRO: quem é dono de qual lote.
#
# ⚠️ ISTO NÃO EXISTIA ATÉ 28/08 E É O QUE FAZ A CIDADE SER PRODUTO. O .bin
# guarda posição, coorte, família, forma e tamanho, e joga fora o DONO: o
# vínculo lote-carteira só vivia na memória da rodada. Ninguém conseguia
# responder "qual é o meu lote", a /profile não tinha o que mostrar e o mint
# não tinha o que inscrever.
#
# ⚠️ A ORDEM DAS LINHAS É A ORDEM DOS REGISTROS DO .bin, uma para uma. A prancha
# desenha pelo índice e o registro dá o nome; quebrar essa correspondência
# desalinha o mapa inteiro em silêncio.
#
# O lot_id é S{setor:02}-Q{quarto:02}-B{quarteirão:03}-L{lote:03} e é ESTÁVEL
# enquanto a semente (ordem de chegada) e a geometria não mudarem. Ele ainda NÃO
# é promessa pública: publicar a regra vem antes (plano-diretor, passo 4).
with open(p('data/dogcity_lotes.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['lot_id', 'address', 'ordem', 'setor', 'quarto', 'quarteirao', 'lote',
                'x_m', 'z_m', 'raio_m', 'frente_m', 'prof_m', 'area_m2',
                'dog', 'utxo_count', 'forma', 'coorte', 'familia', 'dsc'])
    for x, z, s, a, fr, pf, q_, b_, n_ in saida:
        u = UTX.get(a, 1)
        w.writerow([f'S{s+1:02d}-Q{q_:02d}-B{b_:03d}-L{n_:03d}', a, posto[a], s + 1, q_, b_, n_,
                    round(x), round(z), round(math.hypot(x, z)),
                    round(fr, 1), round(pf, 1), round(fr * pf),
                    round(elig[a]), u, forma_de(u), min(7, posto[a]*8//N),
                    familia_de.get(a, 0), 1 if a in dsc else 0])
print(f'gravado data/dogcity_lotes.csv com {len(saida):,} lotes', file=sys.stderr)
json.dump({
    'esquema': 'int16 x, int16 z, uint8 setor, uint8 coorte, uint16 familia, '
               'uint8 flags(bit0=DSC, bits1-3=forma por utxo_count), uint8 frente_m, uint8 prof_m',
    'chave': '(ts, txid, vout) do UTXO mais antigo; zero colisoes',
    'curva': {'expoente': EXPOENTE, 'gradiente': GRADIENTE, 'k': K_AREA,
              'lobos': LOBOS, 'loboAmp': LOBO_AMP,
              'ritmoLobos': RITMO_LOBOS, 'ritmoAmp': RITMO_AMP},
    'setores': SETORES, 'giroPorSetor': GIRO_SETOR, 'bulevar_m': BULEVAR,
    'celula_m': CELULA, 'quarteirao_m': QUARTEIRAO,
    'declive_max': DECLIVE_MAX, 'raioInicio': R_INICIO, 'raioSitio': R_SITIO,
    'raioBorda': R_ABOBADA,
    'tecidoDisponivel_km2': round(CAP_AREA/1e6, 3),
    'capacidadeHaPorSetor': [round(a/1e4, 1) for a in cap_area],
    'areaLotes_km2': round(sum(areas)/1e6, 3) if areas else 0,
    'loteMediana_m2': round(areas[len(areas)//2]) if areas else 0,
    'loteMenor_m2': round(areas[0]) if areas else 0,
    'loteMaior_m2': round(areas[-1]) if areas else 0,
    'carteiras': N, 'plantadas': len(saida),
    'enclaves': len(familias_grandes), 'carteirasEmEnclave': len(familia_de),
    'dsc': len(dsc), 'setorDSC': S_DSC+1,
    'programa': [{'id': q['id'], 'nome': q['nome'], 'tipo': q['tipo'],
                  'forma': q['forma'],
                  'x': round(q['cx']), 'z': round(q['cz']),
                  'a': q['a'], 'b': q['b'], 'rot': q['rot'],
                  'setor': q.get('setor'), 'ix': q.get('ix'), 'iz': q.get('iz'),
                  'w': q.get('w'), 'h': q.get('h'),
                  'ha': round(q['area']/1e4, 2)} for q in PROGRAMA_GEO],
    'aneis': [{'id': a, 'nome': n, 'r': r, 'larg': w} for a, n, r, w in ANEIS],
    'aneisHa': round(sum(2*math.pi*r*w for _, _, r, w in ANEIS)/1e4, 1),
    'programaHa': round(sum(q['area'] for q in PROGRAMA_GEO)/1e4, 1),
    'quartos': sum(len(T[s]) for s in range(SETORES)),
    'quarteiroes': sum(len(q['quarteiroes']) for s in range(SETORES) for q in T[s]),
}, open(p('public/city/cidade.json'), 'w'), indent=1)
print('gravado public/city/cidade.{json} + cidade-lotes.bin', file=sys.stderr)

# ═══════════════════════════════════════════════════════════════════════════
# A MALHA VIÁRIA: a geometria que a cena precisa para desenhar rua, e não só
# contar. Até 29/08 cidade.json publicava "quartos: 226, quarteiroes: 1182" e
# nada mais: a cena não tinha como traçar a via de contorno de um quarteirão, as
# duas travessas dele, a praça do quarto ou o bulevar, porque o centro e o giro
# de cada peça morriam dentro de tecido(). Aqui NADA é recalculado: é a mesma
# lista T que alimentou prateleiras_de(), na mesma ordem, com o mesmo id.
#
# ⚠️ O ID TEM DE SAIR DA MESMA ORDENAÇÃO DE prateleiras_de(). Lá o quarto é
# numerado por raio crescente dentro do setor, e o quarteirão por raio crescente
# dentro do quarto (sorted é estável, então empate mantém a ordem de tecido()).
# Numerar por qualquer outro critério faria S07-Q09-B002 apontar para um
# quarteirão diferente do que está gravado em data/dogcity_lotes.csv.
#
# ⚠️ QUADRO LOCAL E GIRO. Cada quarteirão vive num quadro girado por
# setor x 7,5 graus: mundo = centro + R(giro) · local, com
# wx = cx + lx·cos - lz·sin  e  wz = cz + lx·sin + lz·cos. O eixo x local corre
# ao longo da testada; o eixo z local é a profundidade. As travessas correm ao
# longo de x local, nas faixas de z local [-34, -25] e [25, 34]. Rotacione o
# DESLOCAMENTO e some ao centro; o centro já está em mundo (a memória do
# "rotacione o deslocamento, nunca o centro" em coloca() vale aqui igual).
_MEIO = QUARTEIRAO / 2
_FILEIRAS = [
    {'fila': 0, 'borda': -_MEIO,                    'sentido': +1, 'abre': 'contorno'},
    {'fila': 1, 'borda': -(_MEIO - FAIXA),          'sentido': -1, 'abre': 'travessa1'},
    {'fila': 2, 'borda': -(_MEIO - FAIXA) + TRAVESSA,'sentido': +1, 'abre': 'travessa1'},
    {'fila': 3, 'borda': +(_MEIO - FAIXA) - TRAVESSA,'sentido': -1, 'abre': 'travessa2'},
    {'fila': 4, 'borda': +(_MEIO - FAIXA),          'sentido': +1, 'abre': 'travessa2'},
    {'fila': 5, 'borda': +_MEIO,                    'sentido': -1, 'abre': 'contorno'},
]

def _fila_do_lote(ox, oz, prof):
    """Reconstrói a fileira a partir do centro local e da profundidade.
    ⚠️ Reconstrução, não registro: coloca() não devolve a fileira e mudar a
    tupla de `saida` mexeria em nove desempacotamentos. Como oz = borda +
    sentido·prof/2 é exato em float (o mesmo cálculo de coloca()), a fileira
    cujo oz previsto bate com o gravado é única, exceto o caso prof = 50 nas
    fileiras 2 e 3, que dão oz = 0 as duas; aí o empate fica com a 2 e não
    altera a contagem de fileiras ocupadas (as duas abrem para travessas)."""
    melhor, erro = 0, 1e18
    for f in _FILEIRAS:
        e = abs(oz - (f['borda'] + f['sentido'] * prof / 2))
        if e < erro: erro, melhor = e, f['fila']
    return melhor, erro

malha_q, malha_b = [], []
ocup = {}                        # (s, q, b) -> [lotes por fileira]
sup = {}                         # (s, q, b) -> profundidade da superquadra
erro_fila_max = 0.0
for x, z, s, a, fr, pf, q_, b_, n_ in saida:
    ch = (s, q_, b_)
    ocup.setdefault(ch, [0]*LOTE_ROWS)
    if pf > PROF_MAX:
        # o ramo gigante de coloca(): frente 168, seis prateleiras consumidas
        # ⚠️ A SUPERQUADRA NÃO COMEÇA NA FILA 0, E ISSO É DEFEITO MEDIDO, NÃO
        # REGRA. O ramo gigante toma 6 prateleiras a partir da ESCOLHIDA, e a
        # escolhida pode ser a fila 3 de um quarteirão: aí ele consome as filas
        # 3..5 deste e 0..2 do SEGUINTE (por raio), mas grava o lote centrado no
        # quarteirão da escolhida, em cima de lotes já plantados nas filas 0..2.
        # Medido em 29/08 contra data/dogcity_lotes.csv: 7 das 24 superquadras
        # se sobrepõem a 141 lotes normais do próprio quarteirão (S06-Q19-B004
        # cobre 31, S07-Q09-B002 cobre 29, S12-Q17-B005 cobre 31), e 17
        # quarteirões seguintes ficam com as primeiras fileiras vazias.
        # Consertar é mexer na alocação (coloca()), o que muda endereço de todo
        # mundo depois do primeiro gigante; fica registrado aqui e no JSON para
        # a cena não desenhar por cima sem saber. Não corrigir em silêncio.
        sup[ch] = max(sup.get(ch, 0.0), pf)

for s in range(SETORES):
    ang = math.radians(s * GIRO_SETOR)
    ca, sa = math.cos(ang), math.sin(ang)
    centros = {}
    for iq, q in enumerate(sorted(T[s], key=lambda q: q['r'])):
        for ib, b in enumerate(sorted(q['quarteiroes'], key=lambda b: b['r'])):
            centros[(s, iq+1, ib+1)] = (b['x'], b['z'], ca, sa)
    for x, z, ss, a, fr, pf, q_, b_, n_ in saida:
        if ss != s or pf > PROF_MAX: continue
        bx, bz, _, _ = centros[(s, q_, b_)]
        dx, dz = x - bx, z - bz
        ox = dx*ca + dz*sa
        oz = -dx*sa + dz*ca
        fila, e = _fila_do_lote(ox, oz, pf)
        erro_fila_max = max(erro_fila_max, e)
        ocup[(s, q_, b_)][fila] += 1
# ⚠️ CONFERÊNCIA: se a reconstrução da fileira errar por mais de meio metro é
# porque o quadro local mudou em coloca() e este bloco ficou para trás.
if erro_fila_max > 0.5:
    print(f'ERRO: fileira reconstruída com erro de {erro_fila_max:.2f} m; malha não gravada',
          file=sys.stderr)
    sys.exit(1)

def _sonda_praca(wx, wz, ca, sa, s):
    """25 sondas na célula central do quarto (a praça): fração livre E no setor.
    A célula é a mesma 168 m das outras; a via de 12 m em volta é a do quarto."""
    ok = tot = 0
    for j in range(5):
        for i in range(5):
            lx = (i - 2) * (QUARTEIRAO / 4)
            lz = (j - 2) * (QUARTEIRAO / 4)
            fx, fz = wx + lx*ca - lz*sa, wz + lx*sa + lz*ca
            tot += 1
            if setor_de(fx, fz) == s and livre(fx, fz): ok += 1
    return ok / tot

for s in range(SETORES):
    ang = math.radians(s * GIRO_SETOR)
    ca, sa = math.cos(ang), math.sin(ang)
    passo_q = CELULA * QUARTO
    for iq, q in enumerate(sorted(T[s], key=lambda q: q['r'])):
        qid = f'S{s+1:02d}-Q{iq+1:02d}'
        # índice de célula no quadro do setor (inverso de tecido(): lx=(qx+.5)·540)
        lx = q['x']*ca + q['z']*sa
        lz = -q['x']*sa + q['z']*ca
        qx, qz = int(round(lx/passo_q - 0.5)), int(round(lz/passo_q - 0.5))
        frac = _sonda_praca(q['x'], q['z'], ca, sa, s)
        blocos = []
        for ib, b in enumerate(sorted(q['quarteiroes'], key=lambda b: b['r'])):
            bid = f'{qid}-B{ib+1:03d}'
            # célula 0..2 dentro do quarto, no quadro do setor
            blx = b['x']*ca + b['z']*sa
            blz = -b['x']*sa + b['z']*ca
            cx = int(round((blx - lx)/CELULA)) + 1
            cz = int(round((blz - lz)/CELULA)) + 1
            ch = (s, iq+1, ib+1)
            por_fila = ocup.get(ch, [0]*LOTE_ROWS)
            malha_b.append({
                'id': bid, 'setor': s+1, 'quarto': iq+1, 'quarteirao': ib+1,
                'x': round(b['x'], 1), 'z': round(b['z'], 1), 'r': round(b['r']),
                'giro': s * GIRO_SETOR, 'lado': QUARTEIRAO,
                'celula': [cx, cz],
                'sondasLivres': len(b['lotes']),           # de 84 pontos da sondagem
                'lotes': sum(por_fila) + (1 if ch in sup else 0),
                'lotesPorFileira': por_fila,
                'fileirasComLote': sum(1 for v in por_fila if v),
                'superquadra': ch in sup,
                'superquadraProf': round(sup[ch], 1) if ch in sup else 0,
            })
            blocos.append(bid)
        malha_q.append({
            'id': qid, 'setor': s+1, 'quarto': iq+1,
            'x': round(q['x'], 1), 'z': round(q['z'], 1), 'r': round(q['r']),
            'giro': s * GIRO_SETOR, 'lado': CELULA * QUARTO,
            'celula': [qx, qz],
            'quarteiroes': blocos,
            'pracaFracLivre': round(frac, 2),
            'praca': frac >= 0.999,
        })

bulevares = []
# ⚠️ O BULEVAR VAI ATÉ A AVENIDA DO CINTURÃO, E NÃO ATÉ 4.400. Ele parava na
# borda do tecido, o que deixava a Avenida do Cinturão (AN4, r 4.450) sendo um
# anel fechado ligado a NADA: uma via para a qual não existe entrada. Estender os
# 50 m que faltam custa zero (o Cinturão nunca teve lote) e é o que transforma a
# borda de corte em remate: doze braços chegam nela e viram doze rotatórias.
R_BUL_FIM = 4450.0
for s in range(SETORES):
    rumo = s * (360 / SETORES)
    x0, z0 = _peca_xy(rumo, R_INICIO)
    x1, z1 = _peca_xy(rumo, R_BUL_FIM)
    bulevares.append({
        'id': f'BUL{s+1:02d}', 'rumo': rumo, 'largura': BULEVAR,
        'rInicio': R_INICIO, 'rFim': R_BUL_FIM,
        # o + 0.0 apaga o "-0.0" que sin/cos deixam nos rumos 0, 90, 180 e 270
        'x0': round(x0, 1) + 0.0, 'z0': round(z0, 1) + 0.0,
        'x1': round(x1, 1) + 0.0, 'z1': round(z1, 1) + 0.0,
        'setores': [s+1, (s+1) % SETORES + 1],   # os dois setores que a costura separa
    })

def _linhas(lst):
    return '[\n' + ',\n'.join(json.dumps(o, ensure_ascii=False, separators=(',', ':')) for o in lst) + '\n]'

with open(p('public/city/cidade-malha.json'), 'w') as f:
    f.write('{\n"esquema":' + json.dumps({
        'quadro': 'mundo = centro + R(giro)·local; wx = x + lx·cos(giro) - lz·sin(giro); '
                  'wz = z + lx·sin(giro) + lz·cos(giro). x local = testada, z local = profundidade. '
                  'giro em graus, positivo de +x para +z. rumo em graus, 0 = norte (-z), cresce para leste (+x).',
        'quarteirao': 'centro x/z em mundo, lado 168, via de contorno de 12 m em volta '
                      '(eixo da via a ±90 m do centro). Dentro, em z local: faixa [-84,-34], '
                      'travessa1 [-34,-25], faixa [-25,25], travessa2 [25,34], faixa [34,84]. '
                      'fileiras 0..5 em `fileiras`; lotesPorFileira segue essa ordem. '
                      'sondasLivres = pontos livres dos 84 sondados por tecido(); quarteirão '
                      'de borda entra com ≥ 20. superquadra = lote gigante de frente 168 centrado '
                      'no quarteirão, z local [-superquadraProf/2, +superquadraProf/2]. ⚠️ ele '
                      'consome 6 prateleiras a partir da escolhida, então pode invadir o quarteirão '
                      'seguinte e sobrepor lotes normais das primeiras fileiras deste (medido 29/08: '
                      '7 de 24 superquadras sobrepõem 141 lotes). setor é o do gerador em precisão '
                      'cheia: 5 quarteirões de S11 têm centro a 0,001° da costura 300 e o x/z '
                      'arredondado a 0,1 m cai do outro lado; não recalcule setor a partir de x/z.',
        'quarto': 'centro da célula central (a praça) em mundo, lado 540 = 3x3 células de 180. '
                  'celula = [qx, qz] no quadro do setor. praca = 25 sondas da célula central '
                  'todas livres e no setor; pracaFracLivre = fração.',
        'bulevar': 'eixo radial sobre a costura de setor, de rInicio a rFim, largura 34.',
        'ids': 'os mesmos S..-Q..-B.. de data/dogcity_lotes.csv (lot_id sem o -L...).',
    }, ensure_ascii=False, separators=(',', ':')) + ',\n')
    f.write('"constantes":' + json.dumps({
        'setores': SETORES, 'giroPorSetor': GIRO_SETOR,
        'celula': CELULA, 'quarto': CELULA * QUARTO, 'quarteirao': QUARTEIRAO,
        'viaContorno': CELULA - QUARTEIRAO, 'faixa': FAIXA, 'travessa': TRAVESSA,
        'bulevar': BULEVAR, 'filaProf': FILA_PROF, 'profMax': PROF_MAX,
        'plato': {'r': R_INICIO, 'rampaDe': PLATO_R},
        'cinturao': {'rInicio': R_ABOBADA, 'rFim': R_SITIO},
        'raioSitio': R_SITIO,
        'fileiras': _FILEIRAS,
        'travessas': [{'z0': -(_MEIO - FAIXA), 'z1': -(_MEIO - FAIXA) + TRAVESSA},
                      {'z0': +(_MEIO - FAIXA) - TRAVESSA, 'z1': +(_MEIO - FAIXA)}],
    }, ensure_ascii=False, separators=(',', ':')) + ',\n')
    f.write('"resumo":' + json.dumps({
        'quartos': len(malha_q), 'quartosComLote': sum(1 for q in malha_q if any(
            b['lotes'] for b in malha_b if b['id'].startswith(q['id'] + '-'))),
        'quartosComPraca': sum(1 for q in malha_q if q['praca']),
        'quarteiroes': len(malha_b), 'quarteiroesComLote': sum(1 for b in malha_b if b['lotes']),
        'superquadras': sum(1 for b in malha_b if b['superquadra']),
        'lotes': sum(b['lotes'] for b in malha_b),
    }, separators=(',', ':')) + ',\n')
    f.write('"bulevares":' + _linhas(bulevares) + ',\n')
    f.write('"quartos":' + _linhas(malha_q) + ',\n')
    f.write('"quarteiroes":' + _linhas(malha_b) + '\n}\n')
print(f'gravado public/city/cidade-malha.json: {len(malha_q)} quartos, {len(malha_b)} quarteirões, '
      f'{len(bulevares)} bulevares', file=sys.stderr)
