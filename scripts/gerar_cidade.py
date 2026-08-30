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
# ⚠️ A CIDADE FOI DE 4.500 PARA 7.000 (fundador, 30/08: "não existe limitação
# espacial, a gente pode crescer a cidade o que for preciso"). Eu tinha tratado o
# mapa de altura como teto e ele NÃO É teto: é um arquivo, gerado por
# `scripts/lunar/fetch_terrain.ts` a partir do `siteRadiusM` de sites.ts. Ele foi
# regerado com dado real do SLDEM2015 para 11.000 m (429x429, relevo −182 a +230),
# que cobre a cidade E o Parque Runestone na posição nova.
# ⚠️ O RAIO DO TERRENO E O DA CIDADE SE SEPARARAM: eram os dois 4.500 por
# coincidência. Terreno 11.000 (sites.ts), cidade 7.000 (aqui).
R_SITIO      = float(os.environ.get('R', 7000))
# ⚠️ 1.450 E NÃO 1.300, E O MOTIVO É O LAGO. O primeiro lote parava em 1.300 e a
# praça acaba em 1.024: sobravam 276 m de anel, e o Lago da Praça ficava espremido
# em 193 m de lâmina. Empurrando o começo da cidade 150 m para fora o lago vai
# para 333 m de lâmina e 259 ha, que é o lago gigante que o fundador pediu.
# O preço está medido no replante: ver loteamento.md.
R_INICIO     = 1450      # nada começa antes do fim da rampa do platô
SETORES      = 12        # ⚠️ SÓ SOBREVIVE PARA AS PEÇAS CONGELADAS, que foram
GIRO_SETOR   = 7.5       # desenhadas neste reticulado. O TECIDO não usa mais.

# ── OS DISTRITOS SUBSTITUEM OS 12 SETORES ───────────────────────────────────
#
# ⚠️ DOZE SETORES A 7,5° NÃO ERAM DOZE BAIRROS, ERAM UMA MALHA COM RUÍDO, e foi
# essa a queixa do fundador ("parece que pegamos uma grade e colocamos em cima do
# terreno à força"). Manhattan tem duas orientações de malha, Barcelona tem três.
# São seis distritos de abertura DESIGUAL, porque fatia igual devolve mandala, e
# mandala é tão carimbada quanto a grade.
#
# ⚠️ E A MALHA DE CADA UM É OBLÍQUA AO ANEL, não tangente. Com malha tangente,
# TODA rua ou aponta para a praça ou a contorna, e a leitura concêntrica vence
# tudo: o mapa vira alvo de tiro. Oblíqua a 34-46°, as ruas cruzam os anéis em
# diagonal e os anéis passam a se ler como elemento próprio. É o Eixample
# correndo a 45° da costa em vez de acompanhá-la.
# ⚠️ OS RUMOS SÃO MÚLTIPLOS DO PASSO DO RAIO (5,625° = 360/64), E ISSO NÃO É
# DETALHE. Eles eram 0/62/108/186/240/308, números redondos que NÃO são raio da
# teia: 62 dá 11,02 passos, 108 dá 19,20, 240 dá 42,67. Uma avenida num rumo
# desses corta célula em ângulo, exatamente como as diagonais que já foram
# removidas por isso. Encostados no passo, as aberturas mudam um pouco e
# continuam desiguais, que é o que interessa.
DISTRITOS = [   # (rumo inicial, abertura, giro FORA da tangente)
    (  0.000, 61.875,  38.0),
    ( 61.875, 45.000, -41.0),   # o que olha para o Parque Runestone (rumo 43)
    (106.875, 78.750,  35.0),
    (185.625, 56.250, -46.0),
    (241.875, 67.500,  40.0),
    (309.375, 50.625, -34.0),
]
# ⚠️ GUARDA: toda avenida tem de cair em raio da teia, senão ela corta célula.
for _d0, _ab, _ in DISTRITOS:
    assert abs(_d0 / (360.0 / 64) - round(_d0 / (360.0 / 64))) < 1e-9, \
        f'costura de distrito no rumo {_d0} não é raio da teia'
    assert abs(_ab / (360.0 / 64) - round(_ab / (360.0 / 64))) < 1e-9, \
        f'abertura de distrito de {_ab} não é múltiplo do passo do raio'
N_DIST = len(DISTRITOS)
assert abs(sum(d[1] for d in DISTRITOS) - 360.0) < 1e-9

# ⚠️ AS QUATRO PONTES CONTINUAM CAINDO EM VIA, e isso NÃO é mais a costura de
# setor. Elas desembocam nos rumos 0/90/180/270 e as costuras de distrito estão
# em 0/62/108/186/240/308: só o rumo 0 coincide. Por isso os eixos das pontes
# viram AVENIDAS RADIAIS próprias, independentes da divisa de distrito. Avenida
# não precisa ser divisa; precisa ser via.
AVENIDAS_RADIAIS = [0.0, 90.0, 180.0, 270.0]

# ── AS BANDAS: O GRÃO MUDA COM O RAIO ───────────────────────────────────────
#
# ⚠️ O GRÃO ÚNICO ERA O DEFEITO DE VERDADE. Quarteirão de 168 m e fileira de 25 m
# de r 1.450 a 4.500, sem exceção, em 53 mil lotes. Uma textura só lê como veludo
# cotelê. Barcelona tem 113 m, Manhattan 80x274; o que faz esses mapas lerem como
# projeto é o CONTRASTE de grão entre bairros.
#
# ⚠️ E OS TAMANHOS NÃO SÃO ESCOLHIDOS A DEDO: saem da regra da rua do fundador
# (toda fileira dá frente para via). Quarteirão = k faixas de 50 m separadas por
# travessas de 9 m, então só existem 109, 168, 227... Escolher 150 quebraria a
# regra; escolher da família a mantém por construção.
TRAVESSA     = 9.0       # a via de serviço entre faixas (plano-diretor cap. 8)
VIA_CONTORNO = 12.0
def _lado(k): return k * FAIXA + (k - 1) * TRAVESSA
BANDAS = [   # (phi inicial, phi final, nome, k faixas)
    (1450.0, 2180.0, 'Nucleo', 2),      # 109 m: o núcleo antigo é miúdo
    (2180.0, 3010.0, 'Meio',   3),      # 168 m: o quarteirão de hoje
    (3010.0, 4300.0, 'Bairro', 4),      # 227 m
]
# ⚠️ O LOTE PARA EM 4.300 E ISSO É CONSERTO DE ERRO MEU. Eu cresci a cidade para
# 6.900 para levantar a mediana, e a mediana subiu (113 -> 293), mas a conta que eu
# não fiz foi a de OCUPAÇÃO: sobraram 161.172 vagas para 85.838 carteiras, ou seja
# o dobro do tecido necessário. Medido no resultado: quarteirão com 42% da
# capacidade em média e 1.118 de 2.057 abaixo de 40%. Tecido meio vazio não lê como
# cidade, lê como ruína, e foi isso que o fundador viu ao dar zoom.
# A cidade continua grande: o que encolhe é a FAIXA DE LOTE. De 4.300 a 6.900 é
# cinturão produtivo, que é programa e não vazio.

# ⚠️ O LOTE PARA EM 5.500 E O RESTO NÃO É SOBRA. Com a cidade a 6.900 o tecido
# oferecia 264.888 vagas para 85.838 carteiras: 32% de ocupação e mediana de
# 476 m². Isso não é cidade, é subúrbio, e a terra nova viraria quintal em vez de
# programa. De 5.500 a 6.900 fica o CINTURÃO PRODUTIVO, que é o que o fundador
# descreveu: fazendas de proteína, lagos de pesca e a infraestrutura que alimenta
# a cidade sob a abóbada.
PHI_PRODUTIVO = 4300.0
# ⚠️ A CINTA POLAR DEIXOU DE EXISTIR E ISSO NÃO É PERDA. Ela era a faixa externa
# em quadra tangencial, criada para consertar a borda serrilhada que a malha
# CARTESIANA deixava ao ser recortada numa forma. Na teia o tecido INTEIRO já é
# tangencial, então a borda fecha sozinha e uma cinta separada não teria o que
# consertar. As constantes ficam declaradas só porque `cidade-malha.json` ainda
# as publica para a cena.
# ⚠️ E A ÚLTIMA BANDA TEM DE IR ATÉ A BORDA. Ela parava em 4.040, que era onde a
# Cinta começava: sem a Cinta, os últimos 360 m de cidade ficavam SEM TECIDO, e
# foi isso que derrubou a capacidade de 94.003 para 67.720 vagas.
PHI_CINTA = 4300.0
CINTA_FAIXAS = []

LOTE_W, LOTE_D = 12.0, 25.0       # 300 m² nominais; a testada vira variável ao plantar
CELULA       = 180.0     # ⚠️ LEGADO: só as peças congeladas nasceram nesta célula
QUARTEIRAO   = 168.0     # ⚠️ LEGADO: idem, e a peça já não depende mais disto
QUARTO       = 3
BULEVAR      = 34.0      # largura do bulevar radial sobre cada costura
FAIXA        = 50.0      # profundidade da faixa: duas fileiras costas com costas
DECLIVE_MAX  = 4.0       # correção do júri: o tecido não cabe em 3 graus

PLATO_R, PLATO_FUNDE = 960, 1300
# ⚠️ O PARQUE TEVE DE SAIR. Com a cidade a 6.900 (R_ABOBADA) ele ficaria DENTRO
# dela em 5.200, e ele é parque nacional: fica fora da abóbada, alcançado de
# veículo pressurizado. 9.800 deixa a chegada dele (o Portão, a 2,75 km do
# Monarca pelo lado da cidade) a 7.050, ou seja 150 m depois da borda urbana.
PARQUE_RUMO, PARQUE_DIST, PARQUE_DISCO = 43.0, 9800.0, 3600.0
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

# ── A CIDADE DEIXA DE SER REDONDA, E A REGRA 1 NÃO SE MEXE ──────────────────
#
# ⚠️ A REDONDEZA ERA ESCOLHA MINHA, NÃO LEI. A regra 1 diz que a IDADE decide
# ONDE, coorte velha por dentro. Isso exige uma família de curvas ENCAIXADAS,
# para a ordem existir; NÃO exige que sejam círculos. Trocando o raio por um
# campo φ cujas curvas de nível são superelipses, a cidade vira retângulo
# arredondado e a ordem por idade continua EXATA. Medido: 106.560 amostras em
# 360 rumos, ZERO quebras de ordem.
#
# ⚠️ E ISTO NÃO É O LOBO DE 5 PÉTALAS QUE JÁ REPROVOU. Lá a alocação continuava
# circular e a BORDA era recortada, e recortar depois joga terra fora: custou
# 6,46 km² de lote e 91 m² de mediana. Aqui a alocação em si tem a forma. Os
# meio-eixos abaixo estão CALIBRADOS para a área dentro da borda dar exatamente
# a do disco de 4.400 m (60,821 km², medido +0,00%).
# ⚠️ MEXER EM FORMA_N OU FORMA_AZ EXIGE RECALIBRAR FORMA_AX, senão a forma
# cobra terra caladamente. A conta está em scripts/proto_tecido.py.
FORMA_N    = 3.0
FORMA_AX   = 0.9923
FORMA_AZ   = 0.8931      # 0,90 x escala
FORMA_ROT  = math.radians(-18.0)
FORMA_HARM = 0.030       # sem isto a superelipse tem 2 eixos de simetria e o olho acha os dois
PHI_BORDA  = R_ABOBADA   # φ vale isto exatamente na borda da cidade

def phi(x, z):
    """A coordenada que substitui o raio. Cresce do centro para fora.

    ⚠️ A FORMA ENTRA AOS POUCOS, e isso é conserto e não enfeite. Com a
    superelipse valendo desde o começo, a primeira banda saía do lago (que é um
    CÍRCULO em r 1.450) já deformada e abria um vazio de centenas de metros
    entre a água e o primeiro quarteirão. Agora φ é o raio junto do lago e vira
    superelipse indo para a borda: o núcleo antigo abraça a água, redondo, e a
    cidade só ganha forma quando cresce, que é como cidade de beira d'água se
    forma. A ordem sobrevive porque r e a superelipse crescem os dois ao longo
    de qualquer raio, logo a mistura também cresce.
    """
    r = math.hypot(x, z)
    c, sn = math.cos(FORMA_ROT), math.sin(FORMA_ROT)
    lx, lz = x*c + z*sn, -x*sn + z*c
    q = (abs(lx/FORMA_AX)**FORMA_N + abs(lz/FORMA_AZ)**FORMA_N) ** (1.0/FORMA_N)
    q *= (1.0 - FORMA_HARM*math.cos(3*math.atan2(z, x) - 0.7))
    w = min(1.0, max(0.0, (r - R_INICIO) / (PHI_BORDA - R_INICIO)))
    return r*(1 - w*w*(3 - 2*w)) + q*(w*w*(3 - 2*w))

# ── PARQUES ESCOLHIDOS, NÃO SORTEADOS POR MALHA ─────────────────────────────
# ⚠️ O tecido antigo esvaziava a célula do meio de cada quarto 3x3: um buraco a
# cada 540 m em fileira perfeita. Na planta isso vira POÁ, e poá é o sinal mais
# forte de carimbo num mapa. Parque de cidade é POUCO, GRANDE e fica onde há
# motivo. Nenhum destes tem par simétrico e nenhum está no centro de um distrito.
# ⚠️ OS RUMOS DOS PARQUES SÃO ENCOSTADOS EM RAIO logo abaixo, em `_pq_geo()`.
PARQUES = [   # (rumo desejado, φ do centro, meio-eixo maior, menor)
    ( 34.0, 2020.0, 300.0, 190.0), ( 78.0, 3180.0, 210.0, 340.0),
    (127.0, 2440.0, 260.0, 175.0), (166.0, 3420.0, 175.0, 300.0),
    (214.0, 1960.0, 240.0, 160.0), (262.0, 3020.0, 330.0, 210.0),
    (296.0, 2300.0, 190.0, 260.0), (338.0, 3480.0, 260.0, 200.0),
]
def _pq_geo():
    out = []
    for ru, d, a, b in PARQUES:
        g = math.radians(ru)
        # o centro é dado em φ, então acha o raio onde φ vale isso naquele rumo
        lo, hi = 300.0, 12000.0
        for _ in range(40):
            m = (lo + hi) / 2
            if phi(math.sin(g)*m, -math.cos(g)*m) < d: lo = m
            else: hi = m
        rr = (lo + hi) / 2
        out.append((math.sin(g)*rr, -math.cos(g)*rr, a, b, g))
    return out
PARQUES_GEO = _pq_geo()
# ⚠️ `em_parque` FOI REMOVIDA. O parque virou peça da teia e quem o mascara é
# `em_programa`, como toda peça. Duas máscaras para a mesma coisa era o caminho
# curto para as duas divergirem.

# ── AS DIAGONAIS ────────────────────────────────────────────────────────────
# Broadway em Nova York, a Diagonal em Barcelona. Uma via que IGNORA a malha e
# atravessa a cidade inteira é o elemento mais barato que existe para tirar mapa
# de grade do genérico: ela produz esquina em cunha em toda quadra que toca.
# ── OS CANAIS ───────────────────────────────────────────────────────────────
#
# ⚠️ O VALOR DELES NÃO É PAISAGEM, É TESTADA DE ÁGUA. O pedido do fundador foi
# explícito: canais para criar MILHARES de lotes com saída para o lago principal,
# tudo interligado, e "não podem ser canais pequenos". Então a rede é medida pelo
# que ela produz: 8.635 lotes de frente para a água, contra 9,6% do tecido.
#
# As duas escalas vêm de cidade que existe, não de gosto:
#   RADIAL  60 m de lâmina, seção 96 m   escala do Canal Grande de Veneza (30-70 m)
#   ANEL    28 m de lâmina, seção 56 m   escala das grachten de Amsterdam (27 m
#                                        médios; a Keizersgracht, a maior, 28,31)
# A seção inclui cais e pista nas duas margens, que é o que faz o canal ser
# endereço e não vala: em Amsterdam a casa dá para o cais, o cais para a pista e
# a pista para a água.
#
# ⚠️ A REDE É CONECTADA E DESAGUA NO LAGO. Os oito radiais saem da orla do lago
# (r 1.450) e vão até o anel externo; os quatro anéis cruzam todos eles. Quem tem
# frente de canal tem barco até a praça. Quatro dos oito radiais (rumos 0, 90,
# 180, 270) caem sobre bulevar que já existe, onde a água ocupa o canteiro
# central: ali o canal não custa lote NENHUM, e as quatro pontes do lago já são
# as primeiras pontes dele.
# ⚠️ OS RUMOS TÊM DE SER RAIO DA TEIA, e estes são: o passo do raio é
# 360/N_RAIOS0 = 5,625°, e 22,5 são 4 passos exatos.
#
# ⚠️ E ELES NÃO PODEM SER AVENIDA. A primeira versão pôs os canais em 0/45/90/...,
# ou seja EM CIMA dos eixos das pontes: lâmina de 60 m sobre avenida de 34, com a
# água cobrindo a via inteira. Quatro das nove avenidas radiais afogadas, e
# justamente as quatro que recebem as pontes. O fundador desconfiou olhando a
# chapa e a conferência confirmou por construção.
# Deslocados meio passo de 45°, os canais correm ENTRE as avenidas: a cidade fica
# com raio de água e raio de asfalto alternados, que é o que Amsterdam faz.
CANAL_RADIAIS = [22.5 + i * 45.0 for i in range(8)]
CANAL_RAD_SEC = 96.0
# ⚠️ UM QUINTO ANEL DE CANAL entrou junto com o crescimento: sem ele os 2.000 m
# novos de cidade ficariam sem água, e a rede tem de chegar na borda nova.
# ⚠️ ESTES SÃO OS φ DESEJADOS, NÃO OS FINAIS. Logo abaixo de `_aneis()` cada um é
# encostado na linha de anel mais próxima: sem isso o canal passava no meio de uma
# fileira de lotes, e o fundador chamaria de aleatório com razão.
CANAL_ANEIS_ALVO = [1850.0, 2500.0, 3150.0, 3900.0, 4700.0]
CANAL_ANEIS      = list(CANAL_ANEIS_ALVO)
CANAL_ANEL_SEC = 56.0
# ⚠️ GUARDA DURA: canal e avenida NÃO podem partilhar rumo. Sem isto o erro volta
# em silêncio, porque água desenhada por cima de via não gera erro nenhum: a
# cidade só fica sem as avenidas que recebem as pontes.
for _cr in CANAL_RADIAIS:
    for _av in list(AVENIDAS_RADIAIS) + [d[0] for d in DISTRITOS]:
        _dd = abs(((_cr - _av + 180) % 360) - 180)
        assert _dd > 3.0, (f'canal no rumo {_cr} coincide com avenida no rumo {_av}: '
                           f'a lâmina de {CANAL_RAD_SEC:.0f} m afogaria a via')

def em_canal(x, z, margem=0.0):
    r = math.hypot(x, z)
    if r < R_INICIO: return False
    ph = phi(x, z)
    for an in CANAL_ANEIS:
        if abs(ph - an) < CANAL_ANEL_SEC/2 + margem: return True
    ru = rumo_de(x, z)
    for a in CANAL_RADIAIS:
        dang = abs(((ru - a + 180) % 360) - 180)
        if math.radians(dang) * r < CANAL_RAD_SEC/2 + margem: return True
    return False

# ── AS AUTOPISTAS: DIAGONAIS QUE VOLTARAM, MAS POR BAIXO ────────────────────
#
# ⚠️ ELAS FORAM REMOVIDAS DA SUPERFÍCIE E VOLTAM COMO TÚNEL (fundador, 30/08:
# "as autopistas diagonais podem ser túneis"). É a solução que dissolve o
# conflito inteiro: na superfície uma diagonal corta célula em ângulo e por isso
# era o elemento mais arbitrário do plano; ENTERRADA ela não toca o tecido, não
# consome um lote sequer e não precisa respeitar a teia, porque passa por baixo
# dela. Vira camada de transporte, que é o que autopista é.
#
# ⚠️ O QUE PRECISA ENCAIXAR SÃO AS BOCAS. O túnel é invisível; a rampa e o pátio
# são superfície e passam pelo alocador como qualquer peça, em célula inteira.
#
# ⚠️ RESERVA DE VOLUME, NÃO OBRA, igual à Caverna dos Runestones.
AUTOPISTAS = [   # (rumo do eixo, afastamento do centro em m, largura da caixa)
    ( 24.0,  1750.0, 26.0),
    ( 99.0, -2050.0, 26.0),
    (158.0,  1500.0, 26.0),
]
AUTO_COTA = -42.0     # abaixo de qualquer fundação de lote

# ── O METRÔ ─────────────────────────────────────────────────────────────────
#
# ⚠️ DUAS CAMADAS ENTERRADAS, EM COTAS DIFERENTES, E A ORDEM NÃO É ARBITRÁRIA. O
# metrô serve a cidade quarteirão a quarteirão e precisa de MUITA estação, então
# fica raso (−26 m), perto da superfície onde a escada é curta. A autopista
# atravessa a cidade sem parar e fica funda (−42 m), embaixo do metrô: assim as
# duas se cruzam sem conflito e o cruzamento não precisa ser resolvido.
#
# ⚠️ E O TRAÇADO SEGUE A TEIA, mesmo enterrado. Linha radial sobre avenida, linha
# circular sobre anel: é o desenho de Moscou, Paris e Londres, e aqui ele sai de
# graça porque a teia já é radial-concêntrica. Metrô que ignora a malha da
# superfície entrega estação no meio de quarteirão, onde ninguém consegue sair.
#
# ⚠️ ESTAÇÃO NÃO CUSTA LOTE. Ela fica no CRUZAMENTO de avenida com rua de anel,
# que já é espaço público: é onde estação de metrô fica em cidade de verdade, e
# aqui isso significa zero terra tirada de carteira nenhuma.
METRO_COTA = -26.0
METRO_RADIAIS = [0.0, 90.0, 180.0, 270.0]      # sobre as avenidas das pontes
METRO_ANEIS_ALVO = [2180.0, 3400.0]            # duas circulares; encostam em anel abaixo

# ⚠️ AS DIAGONAIS SAÍRAM (fundador, 30/08: "nada aleatório, teia perfeita"). Elas
# eram o antídoto contra a monotonia de uma malha CARTESIANA: uma via que ignora
# a grade e produz esquina em cunha. Numa teia esse trabalho já é dos raios, que
# convergem e por isso nunca deixam o tecido virar xadrez. O que sobrava eram três
# cordas em rumos inventados por mim (24° a 1.750 do centro, 99° a −2.050, 158° a
# 1.500), sem relação com anel nem com raio: o elemento MAIS arbitrário que restava
# no plano, justamente no lugar onde se pedia rigor.
DIAGONAIS: list[tuple[float, float]] = []
DIAG_LARG = 44.0
def em_diagonal(x, z, margem=0.0):
    for ru, off in DIAGONAIS:
        a = math.radians(ru)
        if abs(x*math.cos(a) + z*math.sin(a) - off) < DIAG_LARG/2 + margem: return True
    return False

# ── a curva da área (masterplan §9, decisão 1 de 28/08) ────────────────────
# Área proporcional à RAIZ do saldo, com gradiente centro-periferia. Medido:
# a média é 308 m² por carteira e não tem como fugir disso, então premium só
# existe tirando de alguém. A raiz dá razão de 805x entre o maior e o menor;
# o proporcional puro daria 648.082x e faria cem latifundiários.
EXPOENTE = 0.5
GRADIENTE = 1.0        # borda com 2,7x a área por DOG do centro
TECIDO_ALVO = 16.33e6  # m² da metade do holder
LOTE_MIN_FRENTE = 5.0  # nenhum lote fica mais estreito que isto
LIMITE_MINT = 20000    # ⚠️ NÃO É MAIS FILTRO DE ENTRADA: é o saldo que
                       # destrava CONSTRUIR. Abaixo dele o lote existe,
                       # é do dono e aparece vazio.
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

# ── AS PEÇAS SÃO CONGELADAS EM COORDENADA ABSOLUTA ──────────────────────────
#
# ⚠️ ELAS ESTAVAM AMARRADAS AO RETICULADO E ISSO ERA UMA BOMBA-RELÓGIO. Cada peça
# de `PROGRAMA_MALHA` é `(setor, ix, iz, w, h)`, ou seja um retângulo de CÉLULAS
# no referencial girado do setor. Enquanto SETORES=12, GIRO_SETOR=7,5 e
# CELULA=180 nunca mudassem, tudo bem. Mas as 38 peças TÊM MÓDULO 3D PRÓPRIO em
# `app/city/plaza/pecas/`, desenhado nas medidas delas e posicionado pelo id: se
# o reticulado muda, o Estádio Olímpico anda 300 m e o módulo dele vai junto,
# calado. Foi exatamente esse acoplamento que fez a peça virar retângulo de
# células em 29/08, e agora ele cobra a conta.
#
# Congelar resolve de vez: o mundo (cx, cz, a, b, rot) é gravado uma vez e passa
# a ser a verdade. O reticulado pode mudar quantas vezes quiser que as peças
# ficam onde o desenho as pôs. `DUMP_PROGRAMA=1 python3 scripts/gerar_cidade.py`
# regrava o arquivo a partir do reticulado ANTIGO; sem a variável, o gerador LÊ.
_CONG = p('data/dogcity_programa_congelado.json')
if os.environ.get('DUMP_PROGRAMA') == '1':
    json.dump([{k: v for k, v in q.items() if k not in ('c', 's')} for q in PROGRAMA_GEO],
              open(_CONG, 'w'), indent=1)
    print(f'programa congelado: {len(PROGRAMA_GEO)} peças -> {_CONG}', file=sys.stderr)
    sys.exit(0)
if os.path.exists(_CONG):
    PROGRAMA_GEO = json.load(open(_CONG))
    for q in PROGRAMA_GEO:
        rr = math.radians(q['rot'])
        q['c'], q['s'] = math.cos(rr), math.sin(rr)
    print(f'programa lido do congelado: {len(PROGRAMA_GEO)} peças', file=sys.stderr)

def em_programa(x, z, margem=2.0):
    """MUNDO = R(rot) · LOCAL, então LOCAL = R(-rot) · MUNDO.

    ⚠️ A PEÇA DE CÉLULA NÃO SE TESTA COMO RETÂNGULO. Ela é um trapézio da teia, e
    o teste dela é em COORDENADA DE TEIA: φ entre os dois anéis e rumo entre os
    dois raios. Testar o retângulo inscrito deixaria lote nascer nos cantos do
    trapézio, que é justamente onde a peça e a quadra brigavam.
    """
    for q in PROGRAMA_GEO:
        c = q.get('cel')
        if c:
            ph = phi(x, z)
            if not (c['phi0'] - margem <= ph <= c['phi1'] + margem): continue
            ru = rumo_de(x, z)
            a0, a1 = c['a0'], c['a1']
            d = (ru - a0) % 360.0
            if d <= (a1 - a0) % 360.0 or (a1 - a0) % 360.0 == 0: return q
            continue
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

ARCO_BANDA   = 26.0      # a rua em arco na divisa de banda
AVENIDA_DIST = 44.0      # a avenida na costura de distrito

def raio_em_phi(ang, alvo):
    """o raio, naquele rumo, onde φ vale `alvo`. φ é monótono, então bisseção basta."""
    lo, hi = 200.0, 14000.0
    for _ in range(42):
        m = (lo + hi) / 2
        if phi(math.sin(ang)*m, -math.cos(ang)*m) < alvo: lo = m
        else: hi = m
    return (lo + hi) / 2

# ⚠️ O ALCANCE DO PARQUE RUNESTONE É ANISOTRÓPICO, E ESTA CÓPIA TEM DE BATER COM
# `parkReach` em app/city/plaza/park-site.ts. O disco de 3.600 m a 5.200 m do
# centro alcançava r 1.600 da cidade e proibia o nordeste inteiro: 11,72 km², ou
# 21,6% do sítio, mais que toda a área de lote alocada. Encolher por igual
# quebraria o Portão do parque, que fica a 2,8 km do Monarca do lado da praça.
# Então encurta só no rumo da cidade e a borda vira a ENTRADA do parque.
PARQUE_FRENTE = 2750.0
def parque_alcance(x, z):
    lx, lz = x - PCX, z - PCZ
    nl = math.hypot(lx, lz)
    if nl < 1e-6: return PARQUE_FRENTE
    nd = math.hypot(PCX, PCZ) or 1.0
    cos = (lx*(-PCX) + lz*(-PCZ)) / (nl * nd)
    C1, C0 = math.cos(math.radians(42)), math.cos(math.radians(78))
    t = min(1.0, max(0.0, (cos - C0) / (C1 - C0)))
    k = t*t*(3 - 2*t)
    return PARQUE_DISCO + (PARQUE_FRENTE - PARQUE_DISCO) * k

def livre(x, z):
    r = math.hypot(x, z)
    if r < R_INICIO: return False
    if phi(x, z) > PHI_BORDA: return False
    # ⚠️ MARGEM DE 2 m NAS MÁSCARAS. O arquivo grava x e z como int16 em metros
    # inteiros, então um lote a 40 cm de fora da elipse do Coliseu arredondava
    # para dentro. Eram 3 lotes em 52.991, mas um deles bastava para furar a
    # promessa de guardar o espaço do Coliseu vazio.
    if math.hypot(x-PCX, z-PCZ) < parque_alcance(x, z) + 2: return False
    if dentro_do_coliseu(x, z, 2.0): return False
    if em_programa(x, z) is not None: return False
    if num_anel(x, z) is not None: return False
    if em_diagonal(x, z, 2.0): return False
    if em_canal(x, z, 2.0): return False
    # ⚠️ AS QUATRO PONTES DESEMBOCAM AQUI. Antes eram as costuras de setor; agora
    # as costuras de distrito estão em 0/62/108/186/240/308 e só o rumo 0
    # coincide, então os eixos das pontes viram avenida própria. Avenida não
    # precisa ser divisa de bairro; precisa ser via.
    ru = rumo_de(x, z)
    for a in AVENIDAS_RADIAIS:
        dang = abs(((ru - a + 180) % 360) - 180)
        if math.radians(dang) * r < BULEVAR/2: return False
    for a, _, _ in DISTRITOS:
        dang = abs(((ru - a + 180) % 360) - 180)
        if math.radians(dang) * r < AVENIDA_DIST/2: return False
    # a rua em arco de cada divisa de banda: é o que faz o tecido admitir que a
    # cidade é radial, e é o que apara o quarteirão no arco em vez de deixar a
    # sobra serrilhada que o tecido antigo deixava contra os anéis
    ph = phi(x, z)
    for b0, b1, _, _ in BANDAS:
        if abs(ph - b0) < ARCO_BANDA/2 or abs(ph - b1) < ARCO_BANDA/2: return False
    return declive(x, z) <= DECLIVE_MAX

def distrito_de(x, z):
    ru = rumo_de(x, z)
    for i, (a, ab, _) in enumerate(DISTRITOS):
        if a <= ru < a + ab: return i
    return N_DIST - 1
setor_de = distrito_de      # ⚠️ apelido: o resto do arquivo ainda diz "setor"

# ── AS 16 PEÇAS DE BORDA SEGUEM O CONTORNO, E POR ISSO NÃO SÃO CONGELADAS ───
#
# ⚠️ A DIFERENÇA ENTRE ELAS E AS OUTRAS 35 É DE PROPÓSITO. As 33 de malha e as 2
# da casca ocupam lugar ESCOLHIDO no miolo e têm de ficar exatamente onde o
# desenho as pôs, senão o módulo 3D delas anda junto. As de borda existem para
# REMATAR O CONTORNO: foram postas entre 4.550 e 5.114 m quando o contorno era um
# círculo de 4.400, e com a forma nova chegando a 3.861 m em alguns rumos elas
# ficaram BOIANDO FORA DA CIDADE. Cada uma guarda o afastamento que tinha da
# borda antiga e é recolocada contra a borda nova, no mesmo rumo.
# ⚠️ Isto TEM de rodar antes de `tecido()`, porque `livre()` consulta
# `em_programa()` e a máscara precisa estar no lugar certo.
# ⚠️ SETE PEÇAS DE BORDA ESTAVAM DO LADO ERRADO DA CASCA, e o fundador viu antes
# de mim. A regra é simples e é física, não estética: quem precisa de ATMOSFERA
# fica dentro. Horta tem planta, campo de treino tem gente, reservatório tem água
# líquida, mirante tem gente. Painel solar, radiador térmico, depósito de regolito
# e pátio de manobra não precisam de ar, e o radiador em particular tem de estar
# FORA para radiar direto para o espaço.
_PRECISA_AR = ('Hortas', 'Campo de Treino', 'Reservatório', 'Mirante')
_trouxe = 0
for _q in PROGRAMA_GEO:
    if not _q.get('borda'): continue
    if not any(k in _q['nome'] for k in _PRECISA_AR): continue
    _q['borda'] = False
    _q['produtivo'] = True          # passa a morar no cinturão, dentro da abóbada
    _ang = math.atan2(_q['cx'], -_q['cz'])
    _r = raio_em_phi(_ang, (PHI_PRODUTIVO + R_ABOBADA) / 2)
    _q['cx'], _q['cz'] = math.sin(_ang) * _r, -math.cos(_ang) * _r
    _q['rot'] = math.degrees(_ang) % 360
    _q['c'], _q['s'] = math.cos(_ang), math.sin(_ang)
    _trouxe += 1
print(f'peças trazidas para dentro da abóbada (precisam de ar): {_trouxe}', file=sys.stderr)

_realoc, _dmax = 0, 0.0
for _q in PROGRAMA_GEO:
    if not _q.get('borda'): continue
    _a = math.radians(_q['rot'])
    _fora = math.hypot(_q['cx'], _q['cz']) - 4400.0
    _nr = raio_em_phi(_a, PHI_BORDA) + _fora
    _nx, _nz = math.sin(_a) * _nr, -math.cos(_a) * _nr
    _dmax = max(_dmax, math.hypot(_nx - _q['cx'], _nz - _q['cz']))
    _q['cx'], _q['cz'] = _nx, _nz
    _realoc += 1
if _realoc:
    print(f'peças de borda recolocadas contra o contorno novo: {_realoc} '
          f'(maior deslocamento {_dmax:.0f} m)', file=sys.stderr)

# ── AS PEÇAS SEGUEM O FLUXO DA TEIA ─────────────────────────────────────────
#
# ⚠️ ELAS ESTAVAM JOGADAS POR CIMA, e o fundador viu isso na chapa. As 33 peças de
# malha guardam `rot = setor * 7,5°`, um ângulo herdado do reticulado de 12
# setores que NÃO EXISTE MAIS: contra a teia ele é um número aleatório, e o
# estádio aparece torto sobre um tecido que corre em anel. As 16 de borda e os 8
# parques já nascem tangentes, por isso só estas 33 destoavam.
#
# É a MESMA lição de 29/08, quando a peça deixou de ser elipse solta e virou
# retângulo de células: peça sem relação com o tecido não tem divisa nem portão,
# e todo desenho dentro dela herda essa arbitrariedade. Só que agora o tecido é
# outro, então a relação tem de ser refeita contra ele.
#
# Duas correções, e nenhuma mexe nas MEDIDAS da peça (os módulos 3D em
# `app/city/plaza/pecas/` foram desenhados para o `a` e o `b` que ela tem):
#   1. o giro passa a ser a TANGENTE no rumo do centro dela, igual ao dos
#      quarteirões vizinhos, então a peça corre junto com o anel;
#   2. o centro é empurrado em φ para a peça ocupar um número INTEIRO de anéis,
#      então as duas bordas radiais dela caem em rua e não no meio de um lote.
# (o encaixe das peças na teia roda mais abaixo, depois de `n_raios` existir)


# ── O PORTÃO DO PARQUE: a cidade encontra o Runestone numa entrada, não num vazio
#
# ⚠️ ISTO EXISTE PORQUE A BORDA VIROU FRENTE. Enquanto a cova do parque alcançava
# r 1.600, o nordeste era terra proibida e não havia o que desenhar ali. Com o
# alcance anisotrópico a cidade avança até 2.750 m do Monarca, que é exatamente
# onde a chegada do parque começa (estrada, Portão, Longshadow Plaza, a 2,8 km).
# Sem uma peça aqui a cidade simplesmente PARA no rumo 43 e o parque começa 50 m
# depois, sem transição: dois desenhos encostados, que é o defeito que o fundador
# vem apontando a noite toda.
# A peça é tangente como todas as outras da teia e olha para o parque.
_PORTAO_RUMO = PARQUE_RUMO                      # 43°, o eixo do parque
_pa = math.radians(_PORTAO_RUMO)
_r_lim = PARQUE_DIST - PARQUE_FRENTE            # onde a cidade para nesse rumo
_pr = _r_lim - 150                              # o pátio encosta na borda, por dentro
PROGRAMA_GEO.append({
    'id': 'G01', 'nome': 'Portão do Parque Runestone', 'tipo': 'civico',
    'forma': 'retangulo',
    'cx': math.sin(_pa) * _pr, 'cz': -math.cos(_pa) * _pr,
    'a': 430.0, 'b': 145.0, 'rot': _PORTAO_RUMO,
    'c': math.cos(_pa), 's': math.sin(_pa),
    'area': 4 * 430.0 * 145.0, 'portao': True,
})
print(f'Portão do Parque em r {_pr:.0f} (rumo {_PORTAO_RUMO}), '
      f'{4*430*145/1e4:.1f} ha', file=sys.stderr)

# ── o tecido: quartos, quarteirões, lotes, por setor ───────────────────────
def _z_das_filas(k):
    """As 2k fileiras do quarteirão, cada uma com a sua frente.

    ⚠️ REGRA DO FUNDADOR: TODA FILEIRA DÁ FRENTE PARA VIA. O quarteirão é k
    faixas de 50 m separadas por travessas de 9 m, e cada faixa são DUAS fileiras
    de 25 m costas com costas. Na teia este eixo é o RADIAL: a fileira corre
    paralela ao anel e abre para o anel ou para a travessa.
    """
    lado = _lado(k)
    out = []
    for i in range(k):
        zc = -lado/2 + i*(FAIXA + TRAVESSA) + FAIXA/2
        out.append((zc - LOTE_D/2, zc - FAIXA/2, +1))
        out.append((zc + LOTE_D/2, zc + FAIXA/2, -1))
    return out

# ═══════════════════════════════════════════════════════════════════════════
# A TEIA
#
# ⚠️ ISTO SUBSTITUI A MALHA CARTESIANA POR DISTRITO, E O MOTIVO É CONECTIVIDADE.
# A versão de 30/08 dava a cada distrito uma malha OBLÍQUA ao anel (34 a 46° fora
# da tangente). Aquilo matou a leitura de alvo, mas cobrou um preço pior e o
# fundador viu na chapa antes de eu medir: a rua de um feixe do leque não
# encontrava a rua do feixe vizinho. Eram seis ilhas encostadas, não uma cidade.
#
# Numa teia toda rua é contínua POR CONSTRUÇÃO:
#   ANEL = curva de nível de φ, dá a volta inteira na cidade
#   RAIO = do centro à borda; quando o vão entre dois raios fica largo demais
#          NASCE UM RAIO NOVO entre eles, e o novo também vai até a borda
# Nenhum trecho morre no nada, que era o defeito.
#
# ⚠️ E A TEIA NÃO É REDONDA. Os anéis são curvas de nível da superelipse, ou seja
# retângulos arredondados encaixados. É o que separa teia de cidade de alvo de
# tiro, e o fundador foi explícito duas vezes: cidade, não desenho.
# ═══════════════════════════════════════════════════════════════════════════
# ⚠️ A TESTADA É O QUE PAGA A RUA. Com 96 raios e alvo de 150 m a teia devolveu
# 64.291 vagas contra 94.003 da malha antiga, e a mediana caiu de 164 para 103 m².
# A conta: o vão de rua entre dois raios custa VIA/(testada+VIA) da terra, ou seja
# 11,2% com testada de 95 m e 5,7% com 200 m. Rede conectada cobra mais rua que
# malha desconectada, e é a testada que decide quanto.
# 64 raios são 5,625° cada, e ainda contêm 0, 90, 180 e 270 exatos.
N_RAIOS0 = 64
FRENTE_ALVO = 200.0      # testada de quarteirão que a subdivisão persegue

def n_raios(p):
    """⚠️ O LIMIAR JÁ ESTEVE FROUXO E NÃO DOBRAVA NUNCA: a testada ia de 95 m no
    miolo a 288 m na periferia e a teia perdia a razão de existir. Com 1,25x ele
    dobra por volta de φ 2.900 e a testada fica entre 95 e 150 m em toda a cidade."""
    n = N_RAIOS0
    while (2*math.pi*p)/n > FRENTE_ALVO*1.25: n *= 2
    return n

# ⚠️ NENHUM RUMO É INVENTADO A PARTIR DAQUI. `rumo_de_raio()` devolve o rumo do
# raio da teia mais próximo, e TODA peça extra (fazenda, lago, planta, campo de
# extração, parque) nasce num deles. Antes eu escolhia 15°, 30°, 190°+18i a dedo:
# números redondos não são a mesma coisa que números do desenho, e é exatamente
# essa diferença que o fundador vinha chamando de aleatório.
def rumo_de_raio(ru, phi_ref=3000.0):
    passo = 360.0 / n_raios(phi_ref)
    return round(ru / passo) * passo % 360.0

def _aneis():
    """Os anéis, com o passo saindo do grão da banda.

    ⚠️ O CORTE DO PROGRAMA FOI TESTADO AQUI E REPROVOU. Inserir as bordas radiais
    das 34 peças como cortes de anel fazia o tecido se acomodar ao programa, que é
    o que o fundador pediu, mas o corte é GLOBAL: uma peça no rumo 43 fatiava o
    anel na volta inteira, inclusive do outro lado da cidade, onde não há peça
    nenhuma. Medido: capacidade 75.559 -> 54.256 e mediana 113 -> 67 m². Adaptar
    localmente (o anel desviar só no vão da peça) é possível e é trabalho de outra
    rodada; o que está aqui é o meio-termo que entrega o mesmo resultado visível
    sem o custo: o anel fica regular e é a PEÇA que anda até encostar nele.
    """
    out = []
    for p0, p1, nome, k in BANDAS:
        passo = _lado(k) + VIA_CONTORNO
        p = p0
        while p + passo <= p1 + 1:
            out.append((p, p + passo, nome, k)); p += passo
        if p1 - p > _lado(2) * 0.6:
            out.append((p, p1, nome, k))
    return out

_ANEIS_PHI = sorted({a[0] for a in _aneis()} | {a[1] for a in _aneis()})

# ⚠️ O CANAL VIRA ANEL DA TEIA, não uma vala por cima dela. Cada φ desejado é
# trocado pela linha de anel mais próxima, e duas linhas nunca recebem dois
# canais. Assim a margem do canal É a rua do quarteirão, e o lote da margem tem
# testada de água pelo mesmo motivo que os outros têm testada de rua.
_usadas = set()
CANAL_ANEIS = []
for _alvo in CANAL_ANEIS_ALVO:
    _cand = [v for v in _ANEIS_PHI if v not in _usadas and R_INICIO + 100 < v < PHI_PRODUTIVO - 100]
    if not _cand: continue
    _v = min(_cand, key=lambda v: abs(v - _alvo))
    _usadas.add(_v); CANAL_ANEIS.append(_v)
print('canais encostados no anel: ' + ', '.join(f'{a:.0f}->{b:.0f}'
      for a, b in zip(CANAL_ANEIS_ALVO, CANAL_ANEIS)), file=sys.stderr)

def _encosta_em_anel(ph, b):
    """Empurra o centro da peça até a borda dela cair na linha de anel mais perto.

    ⚠️ ANDA, NÃO REDIMENSIONA. A versão anterior esticava a peça até 70% para ela
    cobrir anéis inteiros, e isso deformava o desenho que os 34 módulos 3D
    receberam. Aqui a medida é intocada: escolhe-se a linha de anel que exige o
    MENOR deslocamento, e o resto da diferença vira recuo em volta da peça, que é
    o que uma praça de frente faz de qualquer jeito.
    """
    if not _ANEIS_PHI: return ph
    cand = []
    for v in _ANEIS_PHI:
        cand.append((abs(v + b - ph), v + b))      # encostar a borda de dentro
        cand.append((abs(v - b - ph), v - b))      # ou a de fora
    d, novo = min(cand)
    return novo if d < b else ph                   # não anda mais que a própria peça

# ── AS LINHAS E AS ESTAÇÕES DO METRÔ ────────────────────────────────────────
# As circulares encostam em linha de anel, como os canais: metrô fora do anel
# entregaria estação em fundo de quarteirão.
METRO_ANEIS = []
for _alvo in METRO_ANEIS_ALVO:
    _c = [v for v in _ANEIS_PHI if R_INICIO + 200 < v < PHI_PRODUTIVO - 200]
    if _c: METRO_ANEIS.append(min(_c, key=lambda v: abs(v - _alvo)))
METRO_ESTACOES = []
for _ru in METRO_RADIAIS:
    _a = math.radians(_ru)
    for _ph in _ANEIS_PHI:
        if _ph < R_INICIO + 150 or _ph > PHI_PRODUTIVO - 100: continue
        # estação em toda rua de anel sobre a radial, e transferência nas circulares
        _r = raio_em_phi(_a, _ph)
        METRO_ESTACOES.append({
            'id': f'E{len(METRO_ESTACOES)+1:03d}',
            'rumo': _ru, 'phi': round(_ph, 1),
            'x': round(math.sin(_a)*_r, 1), 'z': round(-math.cos(_a)*_r, 1),
            'transferencia': any(abs(_ph - v) < 1 for v in METRO_ANEIS),
        })
print(f'metrô: {len(METRO_RADIAIS)} radiais + {len(METRO_ANEIS)} circulares, '
      f'{len(METRO_ESTACOES)} estações ({sum(1 for e in METRO_ESTACOES if e["transferencia"])} de baldeação)',
      file=sys.stderr)

# ── AS BOCAS DAS AUTOPISTAS ─────────────────────────────────────────────────
# Duas por túnel, onde o eixo cruza a borda do tecido. São superfície, então
# passam pelo alocador e ocupam célula inteira como qualquer peça.
for _i, (_ru, _off, _lg) in enumerate(AUTOPISTAS):
    _a = math.radians(_ru)
    _nx, _nz = math.cos(_a), math.sin(_a)
    _dx, _dz = -_nz, _nx
    _t2 = PHI_PRODUTIVO*PHI_PRODUTIVO - _off*_off
    if _t2 <= 0: continue
    _t = math.sqrt(_t2)
    for _k, _sg in enumerate((-1, 1)):
        _bx = _nx*_off + _dx*_t*_sg
        _bz = _nz*_off + _dz*_t*_sg
        PROGRAMA_GEO.append({
            'id': f'AU{_i+1}{"AB"[_k]}',
            'nome': f'Boca da Autopista {_i+1}', 'tipo': 'transporte',
            'forma': 'retangulo', 'boca': True, 'autopista': _i,
            'cx': _bx, 'cz': _bz, 'a': 190.0, 'b': 120.0,
            'rot': math.degrees(math.atan2(_bx, -_bz)) % 360,
            'c': 1.0, 's': 0.0, 'area': 4*190.0*120.0,
        })

# ── OS PARQUES ENTRAM NA TEIA COMO PEÇA ─────────────────────────────────────
# ⚠️ ELES ERAM ELIPSES SOLTAS e o fundador viu: "os círculos verdes também
# precisam fazer parte da teia". Elipse não tem divisa, não tem portão e não tem
# relação com anel nem com raio, que é exatamente a crítica que já matou a peça
# de malha duas vezes nesta cidade. Agora eles passam pelo MESMO alocador: ocupam
# células inteiras, ganham o trapézio da teia e são mascarados por `em_programa`
# como qualquer outra peça. `em_parque` deixa de existir.
for _i, (_ru, _ph, _pa, _pb) in enumerate(PARQUES):
    _ang = math.radians(_ru)
    _r = raio_em_phi(_ang, _ph)
    PROGRAMA_GEO.append({
        'id': f'PQ{_i+1:02d}', 'nome': f'Parque {_i+1}', 'tipo': 'verde',
        'forma': 'retangulo', 'parque': True,
        'cx': math.sin(_ang)*_r, 'cz': -math.cos(_ang)*_r,
        'a': _pa, 'b': _pb, 'rot': _ru,
        'c': math.cos(_ang), 's': math.sin(_ang), 'area': 4*_pa*_pb,
    })

# ── O ALOCADOR DE PEÇAS: TODA PEÇA OCUPA QUARTEIRÃO INTEIRO DA TEIA ─────────
#
# ⚠️ TRÊS TENTATIVAS ANTES DESTA REPROVARAM, e vale registrar porque cada uma
# parecia suficiente:
#   1. só girar para a tangente: a peça continuava atravessando anel e raio no
#      meio do vão, com lasca dos dois lados;
#   2. girar e ANDAR até encostar num anel: consertava o raio e deixava o arco
#      solto, então a lateral continuava cortando quarteirão;
#   3. inserir as bordas das peças como corte de anel: o corte é GLOBAL, uma peça
#      no rumo 43 fatiava o anel na volta inteira e a capacidade caiu de 75.559
#      para 54.256.
#
# O que o fundador mandou fazer, e que é o certo: "se for grande demais pra caber
# entre os canais, jogue pra borda, gire, ajuste, posicione dentro do quarteirão,
# um ou mais, mas seguindo o desenho da teia". Ou seja a peça é LIVRE para mudar
# de lugar e de medida, e é OBRIGADA a ocupar um bloco retangular de células da
# teia. Assim a divisa dela é rua por construção, sempre, sem exceção e sem lasca.
#
# ⚠️ AS FRONTEIRAS ANGULARES USAM O RAIO BASE (N_RAIOS0), nunca o raio dobrado.
# Como 128 é múltiplo de 64, todo raio do conjunto base existe em qualquer anel;
# usar o dobrado faria a borda da peça cair num raio que não existe no anel de
# dentro, e ela voltaria a cortar quarteirão.
_ANEIS_LISTA = _aneis()
_PHI_B = [a[0] for a in _ANEIS_LISTA] + [_ANEIS_LISTA[-1][1]]

def _cell_arco(i, j):
    """centro e meia-largura da célula (anel i, raio-base j), em mundo."""
    p0, p1 = _PHI_B[i], _PHI_B[i + 1]
    a0 = (j / N_RAIOS0) * 2*math.pi
    a1 = ((j + 1) / N_RAIOS0) * 2*math.pi
    am = (a0 + a1) / 2
    rm = raio_em_phi(am, (p0 + p1) / 2)
    return am, rm, (a1 - a0) * rm / 2, (p1 - p0) / 2

_ocupado = set()
_alocadas, _movidas = 0, 0
_relato = []
# as maiores primeiro: quem precisa de mais células escolhe antes
_fila = [q for q in PROGRAMA_GEO
         if not q.get('borda') and not q.get('produtivo') and q['forma'] == 'retangulo']
_fila.sort(key=lambda q: -q['a'] * q['b'])
for _q in _fila:
    _a0, _b0 = _q['a'], _q['b']
    _ru0 = math.degrees(math.atan2(_q['cx'], -_q['cz'])) % 360
    _ph0 = phi(_q['cx'], _q['cz'])
    _j0 = int(round(_ru0 / 360.0 * N_RAIOS0)) % N_RAIOS0
    _melhor = None
    for _i in range(len(_PHI_B) - 1):
        for _nr in (1, 2, 3, 4):
            if _i + _nr >= len(_PHI_B): break
            _prof = (_PHI_B[_i + _nr] - _PHI_B[_i]) / 2 - VIA_CONTORNO / 2
            if _prof < _b0 * 0.45 or _prof > _b0 * 2.4: continue
            _am, _rm, _mw, _ = _cell_arco(_i, _j0)
            _cel = (2*math.pi*_rm) / N_RAIOS0
            _ns = max(1, int(round((2 * _a0) / _cel)))
            _larg = (_ns * _cel) / 2 - VIA_CONTORNO / 2
            if _larg < _a0 * 0.45: continue
            # varre o rumo a partir do original, para os dois lados
            for _d in range(0, N_RAIOS0):
                for _sg in ((0,) if _d == 0 else (-1, 1)):
                    _jj = (_j0 + _sg * _d) % N_RAIOS0
                    _cells = {(_i + _r, (_jj + _c) % N_RAIOS0)
                              for _r in range(_nr) for _c in range(_ns)}
                    if _cells & _ocupado: continue
                    _amm, _rmm, _, _ = _cell_arco(_i, _jj)
                    _amc = ((_jj + _ns / 2) / N_RAIOS0) * 2*math.pi
                    _phc = (_PHI_B[_i] + _PHI_B[_i + _nr]) / 2
                    # custo: deformação nos dois eixos + quanto a peça viajou
                    _c1 = abs(_prof / _b0 - 1) + abs(_larg / _a0 - 1)
                    _c2 = abs(math.degrees(_amc) - _ru0) / 180.0 + abs(_phc - _ph0) / 3000.0
                    _cst = _c1 + _c2 * 0.8
                    if _melhor is None or _cst < _melhor[0]:
                        _melhor = (_cst, _i, _nr, _jj, _ns, _prof, _larg, _amc, _phc, _cells)
                    break
                if _melhor and _melhor[0] < 0.12: break
            if _melhor and _melhor[0] < 0.12: break
    if _melhor is None:
        _relato.append(f"{_q['id']} {_q['nome'][:26]}: NÃO COUBE, ficou onde estava")
        continue
    _cst, _i, _nr, _jj, _ns, _prof, _larg, _amc, _phc, _cells = _melhor
    _ocupado |= _cells
    _r = raio_em_phi(_amc, _phc)
    _dx = math.hypot(math.sin(_amc)*_r - _q['cx'], -math.cos(_amc)*_r - _q['cz'])
    _q['cx'], _q['cz'] = math.sin(_amc) * _r, -math.cos(_amc) * _r
    _q['a'], _q['b'] = _larg, _prof
    _q['rot'] = math.degrees(_amc) % 360
    _q['c'], _q['s'] = math.cos(_amc), math.sin(_amc)
    _q['area'] = 4 * _larg * _prof
    # ⚠️ A PEÇA DEIXA DE SER RETÂNGULO E PASSA A TER A FORMA DA CÉLULA. O fundador
    # pediu "em formato de teia", e é literal: a célula da teia é um TRAPÉZIO
    # (dois arcos e dois raios que convergem), então um retângulo de lados retos
    # nunca encaixa nela por mais que eu gire. Os cantos não alcançam e as bordas
    # cruzam o arco. Agora a peça guarda os índices da célula e o polígono do
    # trapézio, e é ele que vale para a máscara e para o desenho.
    # `a` e `b` continuam gravados porque os 34 módulos 3D compõem dentro deles:
    # eles passam a ser o RETÂNGULO INSCRITO no trapézio.
    _q['celulas'] = [_nr, _ns]
    _q['forma'] = 'celula'
    _q['cel'] = {'i': _i, 'nr': _nr, 'j': _jj, 'ns': _ns,
                 'phi0': _PHI_B[_i], 'phi1': _PHI_B[_i + _nr],
                 'a0': (_jj / N_RAIOS0) * 360.0, 'a1': ((_jj + _ns) / N_RAIOS0) * 360.0}
    _pol = []
    _p0v, _p1v = _PHI_B[_i] + VIA_CONTORNO / 2, _PHI_B[_i + _nr] - VIA_CONTORNO / 2
    _passos = max(2, int(_ns * 3))
    for _t in range(_passos + 1):
        _aa = ((_jj + _ns * _t / _passos) / N_RAIOS0) * 2 * math.pi
        _rr = raio_em_phi(_aa, _p0v)
        _pol.append([round(math.sin(_aa) * _rr, 1), round(-math.cos(_aa) * _rr, 1)])
    for _t in range(_passos, -1, -1):
        _aa = ((_jj + _ns * _t / _passos) / N_RAIOS0) * 2 * math.pi
        _rr = raio_em_phi(_aa, _p1v)
        _pol.append([round(math.sin(_aa) * _rr, 1), round(-math.cos(_aa) * _rr, 1)])
    _q['poly'] = _pol
    _alocadas += 1
    if _dx > 120: _movidas += 1
print(f'peças alocadas na teia: {_alocadas} de {len(_fila)} '
      f'({_movidas} tiveram de mudar de lugar)', file=sys.stderr)
for _w in _relato:
    print(f'  {_w}', file=sys.stderr)

# ── O CINTURÃO PRODUTIVO ────────────────────────────────────────────────────
#
# ⚠️ ELE EXISTE PORQUE A CIDADE CRESCEU E O LOTE NÃO DEVIA CRESCER JUNTO. Com o
# tecido indo até 6.900 a mediana ia a 476 m² e a ocupação a 32%: a terra nova
# viraria quintal. De 5.500 a 6.900 fica o que o fundador descreveu quando falou
# do mundo jogável: fazenda de proteína, lago de pesca, a infra que alimenta quem
# mora sob a abóbada. É programa, não sobra.
# ⚠️ E FICA DENTRO DA ABÓBADA: fazenda e lago dependem de atmosfera. O que fica
# FORA é o Parque Runestone (9.800) e o spaceport, alcançados de veículo
# pressurizado pela eclusa G01.
_PROD = []
for _i in range(12):
    _PROD.append(('FZ', f'Fazenda de Proteína {_i+1}', 'producao',
                  rumo_de_raio(15.0 + _i * 30.0), 5900.0, 620.0, 380.0))
# ⚠️ O CAMPO DE GOLFE (fundador, 30/08). 18 buracos pedem 50 a 70 ha, e o
# cinturão produtivo é onde isso cabe sem tirar lote: ele tem 2.600 m de faixa e
# estava ralo demais para ler como cinturão, que é o defeito que eu mesmo apontei
# na última chapa. Golfe é verde, é grande e é lazer: ocupa bem e dá conteúdo.
_PROD.append(('GF', 'Campo de Golfe', 'lazer', rumo_de_raio(300.0), 5700.0, 620.0, 340.0))
for _i in range(6):
    _PROD.append(('LP', f'Lago de Pesca {_i+1}', 'agua',
                  rumo_de_raio(30.0 + _i * 60.0), 6550.0, 460.0, 260.0))
_np = 0
for _pre, _nome, _tipo, _ru, _ph, _a, _b in _PROD:
    _ang = math.radians(_ru)
    _r = raio_em_phi(_ang, _ph)
    if _r <= 0: continue
    PROGRAMA_GEO.append({
        'id': f'{_pre}{_np+1:02d}', 'nome': _nome, 'tipo': _tipo,
        'forma': 'elipse' if _pre == 'LP' else 'retangulo',
        'cx': math.sin(_ang) * _r, 'cz': -math.cos(_ang) * _r,
        'a': _a, 'b': _b, 'rot': _ru,
        'c': math.cos(_ang), 's': math.sin(_ang),
        'area': (math.pi if _pre == 'LP' else 4) * _a * _b, 'produtivo': True,
    })
    _np += 1
print(f'cinturão produtivo: {_np} peças entre φ {PHI_PRODUTIVO:.0f} e {R_ABOBADA:.0f} '
      f'({sum(q["area"] for q in PROGRAMA_GEO if q.get("produtivo"))/1e4:.0f} ha)', file=sys.stderr)

# ── A CADEIA DE SUPRIMENTO ──────────────────────────────────────────────────
#
# ⚠️ O HÉLIO-3 NÃO É O MOTOR, E O NÚMERO É QUE DIZ ISSO. Concentração de 4 a 20
# ppb no regolito comum e 20 a 50 ppb em mare de alto titânio; a 30 ppb, UM GRAMA
# de He-3 está espalhado em 33.000 toneladas de solo, e uma tonelada exige
# processar 100 a 200 MILHÕES de toneladas. Pior: não existe reator que queime
# D-He3. Minerar montanha para vender produto sem comprador não sustenta colônia.
#
# ⚠️ O QUE PAGA A CONTA É O OXIGÊNIO. O regolito é 40 a 45% oxigênio em massa, e
# oxigênio é a maior parte da massa de qualquer propelente. A primeira indústria
# lunar existe para ABASTECER FOGUETE E RESPIRAR.
#
# ⚠️ E O SÍTIO FECHA A HISTÓRIA: Mare Tranquillitatis é mare de ALTO TITÂNIO (a
# Apollo 11 pousou aqui e trouxe basalto de alto Ti), ou seja rico em ILMENITA
# (FeTiO3). Ilmenita é ao mesmo tempo o melhor hospedeiro de He-3 E a matéria
# prima da redução com hidrogênio que dá oxigênio, ferro e titânio. Então o He-3
# entra honesto, como SUBPRODUTO do mesmo forno que já ia ser aceso.
#
# A cadeia, em peças: mineração (fora da abóbada) -> beneficiamento -> redução ->
# eletrólise -> fundição e célula solar -> sinterização -> agricultura.
_IND = [
    ('Beneficiamento de Ilmenita', 'industria',  75.0, 5900.0, 520.0, 330.0),
    ('Redução com Hidrogênio',     'industria', 105.0, 5900.0, 520.0, 330.0),
    ('Eletrólise de Regolito',     'industria', 195.0, 5900.0, 520.0, 330.0),
    ('Planta de Voláteis (He-3, H2, C, N2)', 'industria', 225.0, 5900.0, 460.0, 300.0),
    ('Fundição e Laminação',       'industria', 285.0, 5900.0, 520.0, 330.0),
    ('Fábrica de Célula Solar',    'industria', 315.0, 5900.0, 460.0, 300.0),
    ('Sinterização de Blocos',     'industria', 345.0, 5900.0, 460.0, 300.0),
    ('Tanques de Oxigênio',        'infra',      45.0, 6550.0, 380.0, 240.0),
]
_ni = 0
for _nome, _tipo, _ru, _ph, _a, _b in _IND:
    _ru = rumo_de_raio(_ru)
    _ang = math.radians(_ru)
    _r = raio_em_phi(_ang, _ph)
    PROGRAMA_GEO.append({
        'id': f'IN{_ni+1:02d}', 'nome': _nome, 'tipo': _tipo, 'forma': 'retangulo',
        'cx': math.sin(_ang)*_r, 'cz': -math.cos(_ang)*_r, 'a': _a, 'b': _b, 'rot': _ru,
        'c': math.cos(_ang), 's': math.sin(_ang), 'area': 4*_a*_b, 'produtivo': True,
    })
    _ni += 1

# ── OS CAMPOS DE EXTRAÇÃO, FORA DA ABÓBADA ──────────────────────────────────
#
# ⚠️ RESERVA DE ESPAÇO, NÃO OBRA, e é exatamente o que o fundador pediu: "espaço é
# algo que vale a pena criar agora e permitir a expansão das atividades de
# exploração depois". Mineração a céu aberto não cabe sob abóbada: ela mora no
# vácuo, entre a borda urbana (6.900) e o Parque Runestone (9.800), e é servida
# por veículo pressurizado pela mesma eclusa do parque.
# São setores nomeados e vazios. O detalhe vem depois; o que não pode vir depois
# é o LUGAR, porque depois já estará ocupado.
# ── AS ECLUSAS: NENHUMA ENTRADA DE VEÍCULO ABRE DIRETO ─────────────────────
#
# ⚠️ ISTO É FÍSICA, NÃO DETALHE (fundador, 30/08): "não tem como abrir uma câmara
# pressurizada de uma vez só". Abrir a abóbada direto para o vácuo despressuriza
# a cidade inteira; e mesmo uma câmara única do tamanho de um veículo teria de
# despejar todo o ar dela a cada ciclo. Por isso toda entrada de veículo é uma
# CADEIA de câmaras, cada uma menor que a anterior: o ar é transferido de uma
# para a seguinte em vez de perdido, e nenhuma porta jamais separa pressão plena
# do vácuo. É a mesma lógica de eclusa de canal, com ar no lugar de água.
#
# Três câmaras por entrada: a de fora recebe do vácuo, a do meio equaliza, a de
# dentro abre para a cidade. Raios decrescentes porque volume menor é ar menos
# bombeado a cada ciclo.
ECLUSA_CAMARAS = [(1.00, 260.0), (0.62, 170.0), (0.38, 110.0)]   # (fração do vão, raio)

def _eclusa(nome, rumo, r_borda, para_fora=True):
    """A cadeia de câmaras num rumo, da borda da abóbada para fora."""
    a = math.radians(rumo)
    out = []
    for i, (frac, raio) in enumerate(ECLUSA_CAMARAS):
        d = r_borda + (raio * 1.6) * (i + 1) * (1 if para_fora else -1)
        out.append({'ordem': i + 1, 'raio': raio,
                    'x': round(math.sin(a) * d, 1), 'z': round(-math.cos(a) * d, 1),
                    'papel': ('externa', 'equalizacao', 'interna')[i]})
    return {'id': f'EC{nome}', 'nome': f'Eclusa {nome}', 'rumo': rumo,
            'camaras': out,
            'nota': 'tres camaras em serie: o ar passa de uma para a seguinte, '
                    'nunca do interior direto para o vacuo'}

# ── O VALE DO PONENTE FOI DISSOLVIDO (fundador, 30/08) ──────────────────────
#
# ⚠️ ELE EXISTIU POR UMA MONTANHA QUE DEIXOU DE EXISTIR. O vale nasceu para
# abrigar a pista de esqui sobre o relevo real do sudoeste; com a montanha
# cancelada, sobravam lago, floresta e uma estação, e esses três cabem no
# CINTURÃO PRODUTIVO, que já está dentro da abóbada principal e que eu mesmo
# apontei como ralo demais.
#
# ⚠️ E A CONTA FECHOU A DECISÃO. Duas cascas somam 167,6 km² e 99,1 km³ de ar; um
# domo único englobando cidade e vale daria 505,0 km² e 303,9 km³, sendo 337 km²
# de regolito VAZIO pressurizado à toa. E a alternativa de ligar as duas por
# corredor traz DUAS juntas de casca sob pressão, que é problema mais difícil que
# o remate no solo, não mais fácil. Dissolver resolve os três de uma vez: uma
# casca, um remate, zero junta.
#
# O que sumiu junto, e some sozinho na cena porque tudo lê o mesmo campo
# publicado: a segunda abóbada, o corredor, a Eclusa do Vale, o monte esculpido
# em terrain.ts e o modelo `nevada`.
for _nome, _tipo, _ru, _ph, _a, _b in [
    ('Lago do Poente',            'agua',     rumo_de_raio(196.0), 6100.0, 620.0, 400.0),
    ('Floresta de Extrativismo',  'floresta', rumo_de_raio(208.0), 5900.0, 640.0, 420.0),
    ('Estação do Poente',         'infra',    rumo_de_raio(186.0), 6500.0, 200.0, 130.0),
]:
    _ang = math.radians(_ru)
    _r = raio_em_phi(_ang, _ph)
    PROGRAMA_GEO.append({
        'id': f'VP{len([q for q in PROGRAMA_GEO if q.get("poente")])+1:02d}',
        'nome': _nome, 'tipo': _tipo, 'poente': True, 'produtivo': True,
        'forma': 'elipse' if _tipo == 'agua' else 'retangulo',
        'cx': math.sin(_ang) * _r, 'cz': -math.cos(_ang) * _r,
        'a': _a, 'b': _b, 'rot': _ru,
        'c': math.cos(_ang), 's': math.sin(_ang),
        'area': (math.pi if _tipo == 'agua' else 4) * _a * _b,
    })
print('Vale do Poente dissolvido: lago, floresta e estação foram para o cinturão',
      file=sys.stderr)

# ── NENHUMA PEÇA PODE ATRAVESSAR A CASCA ────────────────────────────────────
#
# ⚠️ NOVE ATRAVESSAVAM, e uma delas é impossível e não só feia: os SEIS Lagos de
# Pesca estavam metade dentro e metade fora da abóbada. Água metade no vácuo
# ferve. Junto com eles, Tanques de Oxigênio, Depósito de Regolito e Pátio de
# Manobra. Na chapa isso aparece como o rasgo na borda que o fundador chamou de
# buraco enorme: não é falta de acabamento, é peça cortada pela casca.
#
# ⚠️ E A REGRA DE PARA QUE LADO EMPURRAR JÁ EXISTIA, é a mesma das peças de borda:
# quem precisa de ATMOSFERA vai para dentro, quem não precisa vai para fora. Lago
# e tanque de oxigênio precisam; depósito de regolito e pátio de manobra não.
# Empurrar todo mundo para dentro seria mais simples e estaria errado.
_PRECISA_AR_TIPOS = ('agua', 'floresta', 'lazer', 'verde', 'producao')
_ajust = 0
for _q in PROGRAMA_GEO:
    if _q.get('vale'): continue                       # o vale tem casca própria
    _a = math.atan2(_q['cz'], _q['cx'])
    _r = math.hypot(_q['cx'], _q['cz'])
    _ang = math.atan2(_q['cx'], -_q['cz'])
    _b = raio_em_phi(_ang, PHI_BORDA)
    _meio = max(_q['a'], _q['b'])
    if abs(_r - _b) >= _meio: continue                # não atravessa
    _dentro = _q.get('tipo') in _PRECISA_AR_TIPOS or _q.get('produtivo') and _q.get('tipo') != 'infra'
    _novo = (_b - _meio - 60) if _dentro else (_b + _meio + 60)
    _q['cx'], _q['cz'] = math.sin(_ang) * _novo, -math.cos(_ang) * _novo
    _q['borda'] = not _dentro
    _ajust += 1
print(f'peças que atravessavam a casca, empurradas para um lado só: {_ajust}', file=sys.stderr)

EXTRACAO = []
for _i in range(8):
    _ru = rumo_de_raio(190.0 + _i * 18.0)       # o arco oposto ao parque (rumo 43)
    if abs(((_ru - PARQUE_RUMO + 180) % 360) - 180) < 40: continue
    for _j, _rr in enumerate([7600.0, 8600.0]):
        _ang = math.radians(_ru)
        EXTRACAO.append({
            'id': f'EX{len(EXTRACAO)+1:02d}',
            'nome': f'Campo de Extração {len(EXTRACAO)+1}',
            'rumo': _ru, 'raio': _rr, 'a': 620.0, 'b': 420.0,
            'x': round(math.sin(_ang)*_rr, 1), 'z': round(-math.cos(_ang)*_rr, 1),
            'ha': round(4*620*420/1e4, 1),
        })
print(f'cadeia de suprimento: {_ni} plantas no cinturão + {len(EXTRACAO)} campos de '
      f'extração fora da abóbada ({sum(e["ha"] for e in EXTRACAO):.0f} ha)', file=sys.stderr)

def _bloco(wx, wz, giro, k, frente, d, banda, nome):
    """Monta um quarteirão da teia e sonda quais lotes dele sobrevivem.

    ⚠️ O QUARTEIRÃO DA TEIA NÃO É QUADRADO: a TESTADA é o arco (tangencial,
    variável, 95 a 150 m) e a PROFUNDIDADE é o vão entre anéis (radial, 109/168/
    227 conforme a banda). Publicar um `lado` só faria a cena desenhar contorno
    quadrado sobre trapézio.
    """
    prof = _lado(k)
    ca, sa = math.cos(giro), math.sin(giro)
    cols = max(1, int(frente // LOTE_W))
    lotes = []
    for zlote, _b, _s in _z_das_filas(k):
        for rx in range(cols):
            ox = (rx - (cols-1)/2) * LOTE_W
            fx = wx + ox*ca - zlote*sa
            fz = wz + ox*sa + zlote*ca
            if not livre(fx, fz): continue
            lotes.append((fx, fz))
    if len(lotes) < 8: return None
    return {'x': wx, 'z': wz, 'r': phi(wx, wz), 'raio': math.hypot(wx, wz),
            'giro': giro, 'k': k, 'lado': frente, 'prof': prof, 'cols': cols,
            'lotes': lotes, 'cap': cols * 2 * k, 'banda': banda, 'tipo': nome}

def tecido():
    """Por distrito, os anéis, e em cada anel os quarteirões com os seus lotes."""
    por_dist = [[] for _ in range(N_DIST)]
    baldes = [{} for _ in range(N_DIST)]        # anel -> lista de blocos
    for ia, (p0, p1, nome, k) in enumerate(_aneis()):
        pm = (p0 + p1) / 2
        n = n_raios(pm)
        for j in range(n):
            # ⚠️ A CÉLULA OCUPADA POR PEÇA NÃO GERA QUARTEIRÃO, E ISTO É A CORREÇÃO
            # QUE FALTAVA. O alocador já rodava ANTES do tecido, mas o tecido não o
            # consultava: ele montava o quarteirão inteiro e só depois cada lote era
            # recusado por `em_programa`. Quarteirão meio comido cai abaixo do
            # mínimo de 8 lotes e é DESCARTADO INTEIRO, então o buraco ficava maior
            # que a peça e a peça parecia jogada por cima. Como o fundador disse: o
            # problema é colocar os elementos depois da cidade toda ser gerada.
            # Agora a peça É o quarteirão, e a soma fecha.
            if (ia, (j * N_RAIOS0) // n) in _ocupado: continue
            am = ((j + 0.5) / n) * 2*math.pi
            rm = raio_em_phi(am, pm)
            cx, cz = math.sin(am)*rm, -math.cos(am)*rm
            d = distrito_de(cx, cz)
            frente = (2*math.pi*rm)/n - VIA_CONTORNO
            if frente < 3 * LOTE_W: continue
            # ⚠️ O GIRO É A TANGENTE, e a conta certa é `giro = am`. A versão da
            # Cinta usava `atan2(cos am, sin am)`, que não é tangente nem radial:
            # é o espelho, e girava a faixa externa inteira errado em silêncio.
            b = _bloco(cx, cz, am, k, frente, d, ia + 1, nome)
            if b: baldes[d].setdefault(ia + 1, []).append(b)
    for d in range(N_DIST):
        for banda in sorted(baldes[d]):
            bl = baldes[d][banda]
            por_dist[d].append({'banda': banda, 'nome': bl[0]['tipo'],
                                'r': sum(b['r'] for b in bl)/len(bl),
                                'quarteiroes': bl})
    return por_dist

print('medindo o tecido...', file=sys.stderr)
T = tecido()
cap = [sum(len(b['lotes']) for q in T[s] for b in q['quarteiroes']) for s in range(N_DIST)]
for s in range(N_DIST):
    print(f'  distrito {s+1} (rumo {DISTRITOS[s][0]:5.1f}+{DISTRITOS[s][1]:4.1f}, giro '
          f'{DISTRITOS[s][2]:+5.1f}): {len(T[s]):2d} bandas, '
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
        # ⚠️ O CORTE DE 20.000 DOG MUDOU DE SENTIDO (fundador, 29/08). Ele decidia
        # QUEM EXISTE no mapa e passa a decidir QUEM PODE CONSTRUIR. Toda carteira
        # com DOG recebe chão posicionado pela idade; abaixo de 20k o lote fica
        # DEMARCADO E VAZIO, com endereço e dono, e cruzar o limite acende o lote e
        # destrava o mint.
        # O que decidiu foi a medida: são 32.863 carteiras abaixo de 20k e elas
        # somam 96,1M DOG, ou 0,10% do supply. Como a área sai da RAIZ do saldo,
        # incluir todas custa 2,7% da área de cada um. O corte antigo excluía 38%
        # das carteiras para proteger 2,7% da terra, que é um péssimo negócio.
        # E resolve de graça o buraco do tecido: 52.979 carteiras para 94.003
        # vagas deixavam a cidade esburacada na planta.
        if dog > 0: elig[row['address']] = dog
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
    """Por distrito, as prateleiras em ordem de chegada: mais perto da praça primeiro.

    ⚠️ MUDOU DE VAGA PARA METRO DE TESTADA em 28/08. Antes o quarteirão era 84
    caixas de 12 x 25 m e cada carteira pegava uma. Com área variável isso não
    serve: dar 300 m² a um lote de 50 desperdiça 250. Agora cada quarteirão
    oferece 2k prateleiras de 25 m de profundidade e a carteira consome TESTADA
    conforme a área que lhe cabe. Frente variável ao longo da rua é exatamente o
    que cidade velha parece.

    ⚠️ E AGORA O QUARTEIRÃO TEM TAMANHO PRÓPRIO. Era 168 m em toda a cidade;
    passou a 109 no Núcleo, 168 no Meio, 227 no Bairro e o que a Cinta pedir,
    porque grão único em 53 mil lotes lê como veludo cotelê. Então `lado`,
    `giro` e o número de fileiras saem do BLOCO e não mais de constante global.
    """
    out = []
    for q in sorted(T[s], key=lambda q: q['r']):
        for ib, b in enumerate(sorted(q['quarteiroes'], key=lambda b: b['r'])):
            # o quarteirão de borda entra com a testada proporcional ao que
            # sobrou dele depois da máscara (relevo, avenida, parque, borda)
            frac = len(b['lotes']) / max(1, b['cap'])
            util = b['lado'] * frac
            ca, sa = math.cos(b['giro']), math.sin(b['giro'])
            for _zl, borda_z, sentido in _z_das_filas(b['k']):
                # ⚠️ O ENDEREÇO NASCE AQUI. Sem carregar banda e quarteirão pela
                # prateleira não há como compor S{distrito}-Q{banda}-B{quarteirão}
                # -L{lote} na hora de plantar, e sem endereço o lote não é de
                # ninguém: até 28/08 o vínculo lote-carteira só existia na
                # memória da rodada e era jogado fora ao gravar.
                out.append({'bx': b['x'], 'bz': b['z'],
                            'borda': borda_z, 'sentido': sentido, 'ca': ca, 'sa': sa,
                            'x0': -util / 2, 'livre': util, 'util0': util, 'r': b['r'],
                            'q': b['banda'], 'b': ib + 1,
                            # ⚠️ O QUARTEIRÃO NÃO TEM MAIS TAMANHO ÚNICO, então a
                            # superquadra não pode mais contar 6 prateleiras fixas
                            # nem supor lado 168: cada prateleira carrega o lado e
                            # o número de fileiras do bloco de onde ela saiu.
                            'lado': b['lado'], 'prof': b['prof'], 'nf': 2 * b['k']})
    return out
PASSO = [prateleiras_de(s) for s in range(N_DIST)]

# ── a área de cada carteira (masterplan §9, decisões 1 e 3) ────────────────
# area = k · saldo^EXPOENTE · (r/R_INICIO)^GRADIENTE, com k calibrado para a
# soma dar exatamente o tecido alvo. O raio entra depois, quando a carteira já
# tem lugar; aqui vale o raio médio, e a calibração se refaz no fim.
soma_raiz = sum(elig[a] ** EXPOENTE for _, _, _, a in carteiras)
# ⚠️ SEM PISO, A CURVA DA RAIZ PRODUZ RISCO E NÃO LOTE. Com todas as 85.841
# carteiras dentro, a bisseção teve de baixar k para 0,203 e aí uma carteira de
# 100 DOG recebia 2 m². Medido na rodada sem piso: 2.176 lotes com área ZERO, p1
# em 0 m², p5 em 1 m², p25 em 18 m². Frente mínima de 5 m era respeitada e a
# PROFUNDIDADE ia a centímetros: 5,00 x 0,04 m não é lote, é uma linha no chão.
# Piso de 24 m² (5 x 4,8 m) é a banca da tipologia Galeria, e custa 0,384 km²,
# ou 2,0% da área, para virar 23.323 riscos em parcela de verdade.
PISO_LOTE = 24.0
def area_de(dog, r):
    return max(PISO_LOTE, K_AREA * (dog ** EXPOENTE) * ((r / R_INICIO) ** GRADIENTE))
def _mg():
    sm = w = 0.0
    for i in range(2000):
        r = R_INICIO + (R_ABOBADA - R_INICIO) * (i + 0.5) / 2000
        sm += (r / R_INICIO) ** GRADIENTE * r; w += r
    return sm / w
K_AREA = 0.0   # calibrado adiante, contra o tecido que sobrou depois dos lobos

# ── capacidade agora é ÁREA, não contagem ──────────────────────────────────
cap_area = [sum(pr['livre'] for pr in PASSO[s]) * PROF for s in range(N_DIST)]
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
for s in range(N_DIST):
    print(f'  setor {s+1:2d} (rumo {s*30:3d}): {len(T[s]):3d} quartos, '
          f'{sum(len(q["quarteiroes"]) for q in T[s]):4d} quarteirões, '
          f'{cap_area[s]/1e4:8,.1f} ha', file=sys.stderr)

# ── o condomínio do DSC: as prateleiras mais internas do setor do rumo 68,7 ─
S_DSC = int(DSC_RUMO // (360/SETORES))

# ── cota por setor: por ÁREA pedida, não por cabeça ────────────────────────
# ⚠️ A cota mudou de contagem para área junto com a curva. Duas carteiras não
# pesam mais igual: uma de 4 ha ocupa o mesmo que 800 do portão.
r_medio = [ (sum(pr['r'] for pr in PASSO[s]) / max(1, len(PASSO[s]))) for s in range(N_DIST) ]

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
              for s in range(N_DIST)]
def area_nominal(dog, s):
    return max(PISO_LOTE,
               K_AREA * (dog ** EXPOENTE) * ((max(r_medio[s], R_INICIO) / R_INICIO) ** GRADIENTE))

gerais = [c for c in carteiras if c[3] not in dsc]
capg = list(cap_area)
usado = [0.0]*N_DIST
destino = []
for c in gerais:
    melhor, mfolga = -1, -1e18
    for s in range(N_DIST):
        pedido = area_nominal(elig[c[3]], s)
        if usado[s] + pedido > capg[s]: continue
        folga = (capg[s] - usado[s]) / capg[s] * peso_setor[s]
        if folga > mfolga: mfolga, melhor = folga, s
    if melhor < 0:
        melhor = max(range(N_DIST), key=lambda s: capg[s] - usado[s])
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
cursor = [0]*N_DIST
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
    _lado_ref = PASSO[s][cursor[s]]['lado'] if cursor[s] < len(PASSO[s]) else _lado(3)
    if area > PROF_MAX * _lado_ref:
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
        alvo, nf_alvo = -1, 0
        j = cursor[s]
        while j < n:
            pj = PASSO[s][j]
            comeca = j == 0 or (PASSO[s][j-1]['q'], PASSO[s][j-1]['b']) != (pj['q'], pj['b'])
            if comeca:
                nf = pj['nf']
                if j + nf <= n:
                    bloco = PASSO[s][j:j+nf]
                    mesmo = all((x['q'], x['b']) == (pj['q'], pj['b']) for x in bloco)
                    virgem = all(x['livre'] >= x['util0'] - 0.01 for x in bloco)
                    if mesmo and virgem:
                        alvo, nf_alvo = j, nf
                        break
            j += 1
        if alvo >= 0:
            pq = PASSO[s][alvo]
            # ⚠️ NA TEIA A SUPERQUADRA OCUPA O BLOCO, ENTÃO A PROFUNDIDADE DELA É
            # A DO BLOCO. Antes ela vinha de `area / testada`, e como a testada da
            # teia é o ARCO (125 a 250 m) essa conta devolvia profundidade ABAIXO
            # dos 50 m de PROF_MAX: a superquadra deixava de ser reconhecida rio
            # abaixo, entrava na reconstrução de fileira como lote normal e o
            # guarda de meio metro pegou 26,02 m de erro.
            lado_q = pq['lado']
            prof_g = pq['prof']
            # centro do quarteirão: com a superquadra ocupando tudo, ox e oz são 0
            _cx, _cz = pq['bx'], pq['bz']
            if livre(_cx, _cz):
                for k in range(alvo, alvo + nf_alvo):
                    PASSO[s][k]['x0'] += PASSO[s][k]['livre']
                    PASSO[s][k]['livre'] = 0.0
                return (_cx, _cz, min(lado_q, area / prof_g), prof_g, pq['q'], pq['b'])
            # quarteirão em terra proibida: queima e tenta o próximo
            for k in range(alvo, alvo + nf_alvo):
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
    PASSO = [prateleiras_de(s) for s in range(N_DIST)]
    cursor = [0]*N_DIST
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
            alt = max(range(N_DIST), key=lambda t: sum(pr['livre'] for pr in PASSO[t][cursor[t]:]))
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
            for t in (s, max(range(N_DIST), key=lambda t: sum(pr['livre'] for pr in PASSO[t][cursor[t]:]))):
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
        for t in range(N_DIST):
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
# ⚠️ O REGISTRO PASSOU DE 11 PARA 13 BYTES, E O MOTIVO É O GIRO. Até aqui a cena
# reconstruía a orientação do lote como `setor * 7,5°`, porque havia um giro por
# setor e ele cabia no byte do setor. Agora o giro é DO QUARTEIRÃO: muda por
# distrito e, na Cinta, muda em CADA bloco, porque lá ele é a tangente local.
# Derivar do setor giraria a Cinta inteira errado e não haveria como perceber
# olhando o número. Vai um uint16 em centésimos de grau (0 a 36.000): 0,01° em
# 227 m de quarteirão dá 4 cm, folgado.
_GIRO_DE = {}
for _s in range(N_DIST):
    for _q in T[_s]:
        for _ib, _b in enumerate(sorted(_q['quarteiroes'], key=lambda b: b['r'])):
            _GIRO_DE[(_s, _q['banda'], _ib + 1)] = math.degrees(_b['giro']) % 360.0
buf = bytearray()
for x, z, s, a, w, d, _q, _b, _n in saida:
    coorte = min(7, posto[a]*8//N)
    fam = familia_de.get(a, 0)
    fl = (1 if a in dsc else 0) | (forma_de(UTX.get(a, 1)) << 1)
    giro_c = int(round(_GIRO_DE.get((s, _q, _b), 0.0) * 100)) % 36000
    buf += struct.pack('<hhBBHBBBH', int(round(x)), int(round(z)), s, coorte,
                       min(65535, fam), fl,
                       max(1, min(255, int(round(w)))), max(1, min(255, int(round(d)))),
                       giro_c)
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
    'distritos': N_DIST, 'setoresLegado': SETORES, 'bulevar_m': BULEVAR,
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
                  # ⚠️ `setor/ix/iz/w/h` SÃO LEGADO do reticulado de 12 setores e não
                  # querem dizer mais nada: a peça agora mora na teia. Ficam porque
                  # a cena antiga ainda os lê, mas quem manda é `celulas`.
                  'setor': q.get('setor'), 'ix': q.get('ix'), 'iz': q.get('iz'),
                  'w': q.get('w'), 'h': q.get('h'),
                  # ⚠️ `celulas` = [anéis, células de raio] que a peça ocupa. Sem
                  # este campo a cena recebe a peça como um retângulo solto e não
                  # tem como saber que a divisa dela É rua da teia: o alocador
                  # gravava no objeto e o publicador o descartava, então saíam 0 de
                  # 77. Conferir com `celulas` presente em toda peça de malha.
                  'celulas': q.get('celulas'), 'cel': q.get('cel'),
                  # ⚠️ `poly` é o CONTORNO REAL da peça: o trapézio da teia, com o
                  # arco subdividido. Quem desenhar `a`/`b` como retângulo volta a
                  # pôr um retângulo reto sobre tecido curvo.
                  'poly': q.get('poly'),
                  'produtivo': True if q.get('produtivo') else None,
                  'borda': True if q.get('borda') else None,
                  'ha': round(q['area']/1e4, 2)} for q in PROGRAMA_GEO],
    'aneis': [{'id': a, 'nome': n, 'r': r, 'larg': w} for a, n, r, w in ANEIS],
    'aneisHa': round(sum(2*math.pi*r*w for _, _, r, w in ANEIS)/1e4, 1),
    'programaHa': round(sum(q['area'] for q in PROGRAMA_GEO)/1e4, 1),
    'quartos': sum(len(T[s]) for s in range(N_DIST)),
    'quarteiroes': sum(len(q['quarteiroes']) for s in range(N_DIST) for q in T[s]),
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
# ⚠️ AS FILEIRAS DEIXARAM DE SER SEIS FIXAS. Elas eram uma tabela literal com o
# quarteirão de 168 m embutido (_MEIO = 84). Com o quarteirão variando por banda
# (109, 168, 227 e o que a Cinta pedir), a tabela vira FUNÇÃO de k, e é a mesma
# `_z_das_filas` que o tecido usa para gerar: uma fonte só, senão as duas versões
# divergem sem avisar.
def _fileiras_de(k):
    out = []
    for i, (_zl, borda, sentido) in enumerate(_z_das_filas(k)):
        abre = 'contorno' if i == 0 or i == 2*k - 1 else f'travessa{(i+1)//2}'
        out.append({'fila': i, 'borda': borda, 'sentido': sentido, 'abre': abre})
    return out
_FILEIRAS = _fileiras_de(3)      # a tabela do quarteirão de 168 m, publicada por compatibilidade

def _fila_do_lote(ox, oz, prof, k=3):
    """Reconstrói a fileira a partir do centro local e da profundidade.
    ⚠️ Reconstrução, não registro: coloca() não devolve a fileira e mudar a
    tupla de `saida` mexeria em nove desempacotamentos. Como oz = borda +
    sentido·prof/2 é exato em float (o mesmo cálculo de coloca()), a fileira
    cujo oz previsto bate com o gravado é única, exceto o caso prof = 50 nas
    duas fileiras do meio, que dão oz = 0 as duas; aí o empate fica com a
    primeira e não altera a contagem (as duas abrem para a mesma travessa)."""
    melhor, erro = 0, 1e18
    for f in _fileiras_de(k):
        e = abs(oz - (f['borda'] + f['sentido'] * prof / 2))
        if e < erro: erro, melhor = e, f['fila']
    return melhor, erro

malha_q, malha_b = [], []
# ⚠️ O NÚMERO DE FILEIRAS DEIXOU DE SER 6 PARA TODO MUNDO. Núcleo tem 4, Meio 6,
# Bairro 8, e a Cinta o que couber, porque o quarteirão passou a ter tamanho por
# banda. Contar 6 aqui daria fileira fantasma no Núcleo e truncaria o Bairro.
_NFILAS = {}
for _s in range(N_DIST):
    for _q in T[_s]:
        for _ib, _b in enumerate(sorted(_q['quarteiroes'], key=lambda b: b['r'])):
            _NFILAS[(_s, _q['banda'], _ib + 1)] = 2 * _b['k']
ocup = {}                        # (s, q, b) -> [lotes por fileira]
sup = {}                         # (s, q, b) -> profundidade da superquadra
erro_fila_max = 0.0
for x, z, s, a, fr, pf, q_, b_, n_ in saida:
    ch = (s, q_, b_)
    ocup.setdefault(ch, [0]*_NFILAS.get((s, q_, b_), 8))
    if pf > PROF_MAX:
        # o ramo gigante de coloca(): frente = o lado do quarteirão, todas as
        # prateleiras dele consumidas
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

# ⚠️ DUAS COISAS QUEBRARAM AQUI E AS DUAS ERAM A MESMA SUPOSIÇÃO: UM GIRO SÓ POR
# SETOR. (1) a chave usava `iq+1`, a POSIÇÃO da banda na lista ordenada por raio,
# enquanto a prateleira grava `b['banda']`, o NÚMERO da banda: com a Cinta
# entrando como bandas 4, 5 e 6 os dois deixaram de coincidir. (2) `ca, sa` vinha
# de `s * GIRO_SETOR`, mas o giro agora é DO BLOCO, e na Cinta ele é a tangente
# local, diferente em cada quarteirão. O guarda de meio metro pegou: 47,85 m.
for s in range(N_DIST):
    centros = {}
    for q in T[s]:
        for ib, b in enumerate(sorted(q['quarteiroes'], key=lambda b: b['r'])):
            centros[(s, q['banda'], ib+1)] = (b['x'], b['z'],
                                              math.cos(b['giro']), math.sin(b['giro']), b['k'])
    for x, z, ss, a, fr, pf, q_, b_, n_ in saida:
        if ss != s or pf > PROF_MAX: continue
        if (s, q_, b_) not in centros: continue
        bx, bz, ca, sa, kk = centros[(s, q_, b_)]
        dx, dz = x - bx, z - bz
        ox = dx*ca + dz*sa
        oz = -dx*sa + dz*ca
        fila, e = _fila_do_lote(ox, oz, pf, kk)
        if e > erro_fila_max:
            _pior = (s, q_, b_, kk, round(ox,2), round(oz,2), round(pf,2), round(e,2))
        erro_fila_max = max(erro_fila_max, e)
        ocup[(s, q_, b_)][fila] += 1
# ⚠️ CONFERÊNCIA: se a reconstrução da fileira errar por mais de meio metro é
# porque o quadro local mudou em coloca() e este bloco ficou para trás.
if erro_fila_max > 0.5:
    print(f'ERRO: fileira reconstruída com erro de {erro_fila_max:.2f} m; malha não gravada',
          file=sys.stderr)
    print(f'  pior caso (s,q,b,k,ox,oz,pf,erro) = {_pior}', file=sys.stderr)
    print(f'  fileiras previstas para k={_pior[3]}: '
          f'{[(round(f["borda"],1), f["sentido"]) for f in _fileiras_de(_pior[3])]}', file=sys.stderr)
    sys.exit(1)

# ⚠️ A PRAÇA DE QUARTO MORREU AQUI, E DE PROPÓSITO. `_sonda_praca` media quanto
# da célula central de cada quarto 3x3 estava livre, porque essa célula nunca
# recebia lote e virava praça. Era exatamente o poá que o fundador viu de cima:
# um buraco a cada 540 m em fileira perfeita. Agora o verde é `PARQUES`, poucos e
# escolhidos, publicado abaixo em `parques`. `app/city/plaza/pracas.ts` consumia
# `pracaFracLivre` e precisa ser refeito para ler `parques`.

for s in range(N_DIST):
    for q in sorted(T[s], key=lambda q: q['r']):
        qid = f'S{s+1:02d}-Q{q["banda"]:02d}'
        blocos = []
        for ib, b in enumerate(sorted(q['quarteiroes'], key=lambda b: b['r'])):
            bid = f'{qid}-B{ib+1:03d}'
            ch = (s, q['banda'], ib+1)
            por_fila = ocup.get(ch, [0] * (2*b['k']))
            malha_b.append({
                'id': bid, 'setor': s+1, 'quarto': q['banda'], 'quarteirao': ib+1,
                'x': round(b['x'], 1), 'z': round(b['z'], 1), 'r': round(b['raio']),
                'phi': round(b['r']),
                # ⚠️ O GIRO É DO BLOCO. No miolo ele é o do distrito; na Cinta é a
                # TANGENTE local, diferente em cada quarteirão. Publicar um giro
                # por setor faria a cena desenhar a Cinta torta.
                'giro': round(math.degrees(b['giro']), 3),
                # ⚠️ TESTADA E PROFUNDIDADE SÃO DIFERENTES NA TEIA: `lado` é o arco
                # (tangencial, 125 a 250 m) e `prof` é o vão entre anéis (radial,
                # 109/168/227). Publicar só `lado` faz a cena desenhar contorno
                # QUADRADO sobre quarteirão trapezoidal.
                'lado': round(b['lado'], 1), 'prof': b['prof'],
                'k': b['k'], 'fileiras': 2*b['k'], 'tipo': b['tipo'],
                'sondasLivres': len(b['lotes']), 'capacidade': b['cap'],
                'lotes': sum(por_fila) + (1 if ch in sup else 0),
                'lotesPorFileira': por_fila,
                'fileirasComLote': sum(1 for v in por_fila if v),
                'superquadra': ch in sup,
                'superquadraProf': round(sup[ch], 1) if ch in sup else 0,
            })
            blocos.append(bid)
        malha_q.append({
            'id': qid, 'setor': s+1, 'quarto': q['banda'], 'nome': q['nome'],
            'phi': round(q['r']), 'quarteiroes': blocos,
        })

# ⚠️ OS PARQUES SÃO PUBLICADOS A PARTIR DAS PEÇAS ALOCADAS, não mais da tabela
# de elipses: é o alocador que decidiu onde eles couberam, e o `poly` é o
# trapézio da teia. `pracas.ts` desenha DENTRO desse polígono.
parques_pub = [{'id': q['id'], 'nome': q['nome'],
                'x': round(q['cx'], 1), 'z': round(q['cz'], 1),
                'a': round(q['a'], 1), 'b': round(q['b'], 1),
                'rot': round(q['rot'], 2), 'celulas': q.get('celulas'),
                'poly': q.get('poly'),
                'ha': round(q['area']/1e4, 2)}
               for q in PROGRAMA_GEO if q.get('parque')]

diagonais_pub = [{'id': f'DG{i+1}', 'rumo': ru, 'afastamento': off, 'largura': DIAG_LARG}
                 for i, (ru, off) in enumerate(DIAGONAIS)]
# ⚠️ O CANAL PRECISA SER PUBLICADO EM GEOMETRIA, não só existir como máscara:
# sem isto o gerador abre a vala e a cena não desenha água nenhuma dentro dela.
canais_pub = {
    'radiais': [{'id': f'CR{i+1:02d}', 'rumo': ru, 'secao': CANAL_RAD_SEC,
                 'lamina': 60.0, 'rInicio': R_INICIO, 'phiFim': CANAL_ANEIS[-1],
                 'sobreBulevar': ru in AVENIDAS_RADIAIS}
                for i, ru in enumerate(CANAL_RADIAIS)],
    'aneis': [{'id': f'CA{i+1:02d}', 'phi': an, 'secao': CANAL_ANEL_SEC, 'lamina': 28.0,
               'contorno': [[round(math.sin(math.radians(g))*raio_em_phi(math.radians(g), an), 1),
                             round(-math.cos(math.radians(g))*raio_em_phi(math.radians(g), an), 1)]
                            for g in range(0, 360, 3)]}
              for i, an in enumerate(CANAL_ANEIS)],
    'nota': 'radial em escala do Canal Grande de Veneza, anel em escala das grachten de Amsterda',
}
# ⚠️ A BORDA NÃO É MAIS UM RAIO: é a curva de nível de φ. A cena precisa dela em
# pontos, senão não tem como desenhar o contorno da cidade nem a abóbada.
contorno_pub = []
for gg in range(0, 360, 2):
    aa = math.radians(gg)
    rr = raio_em_phi(aa, PHI_BORDA)
    contorno_pub.append([round(math.sin(aa)*rr, 1), round(-math.cos(aa)*rr, 1)])

bulevares = []
# ⚠️ O BULEVAR VAI ATÉ A AVENIDA DO CINTURÃO, E NÃO ATÉ 4.400. Ele parava na
# borda do tecido, o que deixava a Avenida do Cinturão (AN4, r 4.450) sendo um
# anel fechado ligado a NADA: uma via para a qual não existe entrada. Estender os
# 50 m que faltam custa zero (o Cinturão nunca teve lote) e é o que transforma a
# borda de corte em remate: doze braços chegam nela e viram doze rotatórias.
R_BUL_FIM = 4450.0
# ⚠️ O BULEVAR COMEÇA NA ORLA DO LAGO, E NÃO NO PRIMEIRO LOTE. Ele nascia em
# R_INICIO (1.450) e o Anel da Orla mora em 1.440: sobravam 10 m de vão e o
# sistema não fechava. Os 30 m a mais custam zero (não há lote antes de 1.450) e
# é o que liga as quatro pontes aos doze raios.
R_BUL_INI = 1420.0
# ⚠️ OS RAIOS DEIXARAM DE SER DOZE COSTURAS IGUAIS. Agora são de dois tipos e
# publicados como tal: as quatro AVENIDAS DAS PONTES (rumos 0/90/180/270, 34 m,
# que é onde as pontes desembocam) e as seis COSTURAS DE DISTRITO (44 m, nas
# divisas desiguais). O rumo 0 é os dois ao mesmo tempo e entra uma vez só, com
# a largura maior.
_radiais = {}
for rumo in AVENIDAS_RADIAIS:
    _radiais[round(rumo % 360, 3)] = ('ponte', BULEVAR)
for a, _, _ in DISTRITOS:
    k = round(a % 360, 3)
    _radiais[k] = ('distrito', max(AVENIDA_DIST, _radiais.get(k, ('', 0))[1]))
for i, rumo in enumerate(sorted(_radiais)):
    papel, larg = _radiais[rumo]
    x0, z0 = _peca_xy(rumo, R_BUL_INI)
    x1, z1 = _peca_xy(rumo, R_BUL_FIM)
    bulevares.append({
        'id': f'BUL{i+1:02d}', 'rumo': rumo, 'largura': larg, 'papel': papel,
        'rInicio': R_BUL_INI, 'rFim': R_BUL_FIM,
        # o + 0.0 apaga o "-0.0" que sin/cos deixam nos rumos 0, 90, 180 e 270
        'x0': round(x0, 1) + 0.0, 'z0': round(z0, 1) + 0.0,
        'x1': round(x1, 1) + 0.0, 'z1': round(z1, 1) + 0.0,
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
                  'quarto = BANDA do distrito (1..3 miolo, 4..6 Cinta), nao mais celula 3x3. '
                  'A praca de quarto DEIXOU DE EXISTIR: o verde agora e "parques".',
        'bulevar': 'eixo radial: papel "ponte" (rumos 0/90/180/270, 34 m) ou "distrito" (44 m).',
        'parques': 'as elipses de verde, poucas e escolhidas, no lugar do poa de pracas de quarto.',
        'contorno': 'a borda da cidade em pontos: ela nao e mais um raio, e a curva de nivel de phi.',
        'ids': 'os mesmos S..-Q..-B.. de data/dogcity_lotes.csv (lot_id sem o -L...).',
    }, ensure_ascii=False, separators=(',', ':')) + ',\n')
    f.write('"constantes":' + json.dumps({
        'distritos': N_DIST, 'setoresLegado': SETORES,
        # ⚠️ NÃO EXISTE MAIS UM QUARTEIRÃO SÓ. Publica a família inteira, que é o
        # que a cena precisa para saber o lado de cada bloco pela banda dele.
        'bandas': [{'de': b0, 'ate': b1, 'nome': nm, 'k': k, 'lado': _lado(k)}
                   for b0, b1, nm, k in BANDAS],
        'cinta': {'de': PHI_CINTA, 'faixas': CINTA_FAIXAS,
                  'lados': [_lado(k) for k in CINTA_FAIXAS]},
        'distritosDef': [{'rumo': a, 'abertura': ab, 'giro': g} for a, ab, g in DISTRITOS],
        'forma': {'n': FORMA_N, 'ax': FORMA_AX, 'az': FORMA_AZ,
                  'rot': round(math.degrees(FORMA_ROT), 2), 'harm': FORMA_HARM,
                  'phiBorda': PHI_BORDA, 'rInicio': R_INICIO},
        'celulaLegado': CELULA, 'quarteiraoLegado': QUARTEIRAO,
        'viaContorno': VIA_CONTORNO, 'faixa': FAIXA, 'travessa': TRAVESSA,
        'arcoBanda': ARCO_BANDA, 'avenidaDistrito': AVENIDA_DIST, 'diagLargura': DIAG_LARG,
        # ⚠️ ONDE ESTÃO AS RUAS DE ANEL. Sem esta lista a cena não tem como saber
        # onde uma via cruza um canal, e sem isso não há ponte: cinco anéis de
        # água sem travessia partem a cidade em seis ilhas concêntricas.
        'aneisPhi': [round(a[0], 1) for a in _aneis()] + [round(_aneis()[-1][1], 1)],
        'bulevar': BULEVAR, 'filaProf': FILA_PROF, 'profMax': PROF_MAX,
        'plato': {'r': R_INICIO, 'rampaDe': PLATO_R},
        'cinturao': {'rInicio': R_ABOBADA, 'rFim': R_SITIO},
        'raioSitio': R_SITIO,
        'fileiras': _FILEIRAS,
        # as travessas dependem do lado, então vão por k
        'travessasPorK': {str(k): [{'z0': -_lado(k)/2 + i*(FAIXA+TRAVESSA) + FAIXA,
                                    'z1': -_lado(k)/2 + i*(FAIXA+TRAVESSA) + FAIXA + TRAVESSA}
                                   for i in range(k-1)] for k in (2, 3, 4)},
        'fileirasPorK': {str(k): _fileiras_de(k) for k in (2, 3, 4)},
    }, ensure_ascii=False, separators=(',', ':')) + ',\n')
    f.write('"resumo":' + json.dumps({
        'quartos': len(malha_q), 'quartosComLote': sum(1 for q in malha_q if any(
            b['lotes'] for b in malha_b if b['id'].startswith(q['id'] + '-'))),
        'quarteiroes': len(malha_b), 'quarteiroesComLote': sum(1 for b in malha_b if b['lotes']),
        'superquadras': sum(1 for b in malha_b if b['superquadra']),
        'lotes': sum(b['lotes'] for b in malha_b),
    }, separators=(',', ':')) + ',\n')
    f.write('"bulevares":' + _linhas(bulevares) + ',\n')
    f.write('"parques":' + _linhas(parques_pub) + ',\n')
    f.write('"diagonais":' + _linhas(diagonais_pub) + ',\n')
    f.write('"canais":' + json.dumps(canais_pub, ensure_ascii=False, separators=(',', ':')) + ',\n')
    f.write('"autopistas":' + json.dumps([
        {'id': f'AU{i+1}', 'rumo': ru, 'afastamento': off, 'largura': lg, 'cota': AUTO_COTA,
         'bocas': [{'id': q['id'], 'x': round(q['cx'], 1), 'z': round(q['cz'], 1),
                    'poly': q.get('poly'), 'celulas': q.get('celulas')}
                   for q in PROGRAMA_GEO if q.get('autopista') == i]}
        for i, (ru, off, lg) in enumerate(AUTOPISTAS)],
        ensure_ascii=False, separators=(',', ':')) + ',\n')
    f.write('"metro":' + json.dumps({
        'cota': METRO_COTA, 'autopistaCota': AUTO_COTA,
        'radiais': METRO_RADIAIS, 'circulares': [round(v, 1) for v in METRO_ANEIS],
        'estacoes': METRO_ESTACOES,
        'nota': 'radial sobre avenida e circular sobre anel; estacao no cruzamento, '
                'que ja e espaco publico e nao custa lote',
    }, ensure_ascii=False, separators=(',', ':')) + ',\n')
    f.write('"extracao":' + _linhas(EXTRACAO) + ',\n')
    f.write('"eclusas":' + json.dumps([
        _eclusa('Parque', PARQUE_RUMO, raio_em_phi(math.radians(PARQUE_RUMO), PHI_BORDA)),
        _eclusa('Extracao', 214.0, raio_em_phi(math.radians(214.0), PHI_BORDA)),
        _eclusa('Spaceport', 0.0, raio_em_phi(0.0, PHI_BORDA)),
    ], ensure_ascii=False, separators=(',', ':')) + ',\n')
    f.write('"contorno":' + json.dumps(contorno_pub, separators=(',', ':')) + ',\n')
    f.write('"quartos":' + _linhas(malha_q) + ',\n')
    f.write('"quarteiroes":' + _linhas(malha_b) + '\n}\n')
print(f'gravado public/city/cidade-malha.json: {len(malha_q)} quartos, {len(malha_b)} quarteirões, '
      f'{len(bulevares)} bulevares', file=sys.stderr)
