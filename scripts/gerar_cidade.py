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

⚠️ ANTES DE MEXER AQUI, LEIA O QUE JÁ FOI PROMETIDO AO HOLDER. A cidade tem
contrato público, e ele manda neste arquivo:

  /dogcity/docs               a página pública, 960 linhas de afirmação
                              verificável: snapshot, área, régua de custódia,
                              Distrito Financeiro, escada de Founder
  DogData-v1/masterplan.md    a constituição do mint
  DogData-v1/tiersposition.md qual tier mora onde
  wiki-dogdata/dogcity/contrato-publico.md   o índice de tudo isso

Regra que custou uma sessão inteira em 20/09/2026: quando o código discorda de
um número que o holder já leu na tela, o errado é o CÓDIGO. Três vezes no mesmo
dia este arquivo estava implementando uma lei diferente da publicada: ordenava
pelo UTXO mais antigo enquanto a régua em vigor era DOG-tempo, usava outra curva
de área enquanto a landing publicava a dela, e mascarava a avenida da alça em
r 7.600 enquanto a cena desenha em 6.950.
"""
import csv, json, math, re, struct, sys, os, collections
import heapq

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def p(*a): return os.path.join(RAIZ, *a)

# ⚠️ ONDE A RODADA GRAVA. Por padrão é a árvore do repositório, e isso é o que o
# bot de auto-commit varre de hora em hora: uma rodada interrompida no meio
# publica cidade pela metade sozinha. `SAIDA_DIR=/algum/lugar` desvia as quatro
# saídas para fora do repositório, e aí a publicação vira uma cópia deliberada.
SAIDA_DIR = os.environ.get('SAIDA_DIR')
def ps(*a):
    if not SAIDA_DIR: return p(*a)
    destino = os.path.join(SAIDA_DIR, *a)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    return destino

def _ts_const(caminho, chave):
    """lê `chave: valor` ou `chave = valor` de um .ts, número ou par [a, b]."""
    txt = open(p_ts(caminho), encoding='utf-8').read()
    # ⚠️ O TIPO ENTRA NO MEIO. `export const ALCA_TERRA: [number, number] = [346,
    # 116.5]` tem anotação entre o nome e o valor, e um regex que exige `=` logo
    # depois do nome lê o tipo como se fosse o valor, ou não lê nada. O `[^=]*`
    # abaixo pula a anotação sem atravessar o sinal de igual.
    m = re.search(rf'\b{chave}\s*(?::[^=\n]*)?[:=]\s*\[\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)', txt)
    if m: return (float(m.group(1)), float(m.group(2)))
    m = re.search(rf'\b{chave}\s*(?::[^=\n]*)?[:=]\s*(?:[A-Za-z_][A-Za-z0-9_.]*\()?\s*(-?[0-9.]+)', txt)
    if m: return float(m.group(1))
    raise SystemExit(f'gerar_cidade: nao achei {chave} em {caminho}. '
                     'A cena mudou e o gerador tem de acompanhar, nunca adivinhar.')

p_ts = lambda nome: p('app/city/plaza', nome)

def _ts_lista(caminho, chave):
    """lê `chave ... = [a, b, c, ...]` de um .ts. O `_ts_const` acima só sabe
    ler par; os quatro rumos dos dedos da orla da baía precisam da lista toda,
    e ler só dois deles plantaria metade das penínsulas."""
    txt = open(p_ts(caminho), encoding='utf-8').read()
    m = re.search(rf'\b{chave}\s*(?::[^=\n]*)?[:=]\s*\[([^\]]*)\]', txt)
    if not m:
        raise SystemExit(f'gerar_cidade: nao achei a lista {chave} em {caminho}.')
    return [float(t) for t in re.findall(r'-?[0-9.]+', m.group(1))]

def _ts_ilhas(caminho, chave):
    """lê `ORLA_BAIA_ILHAS` como (x, z, giro, [raios]). A costa das ilhas da baía
    é MALHA À PARTE na cena e não entra em `heightAt`: sem esta tabela o
    gerador planta lote debaixo da Ilha do Fundador e ninguém vê."""
    txt = open(p_ts(caminho), encoding='utf-8').read()
    m = re.search(rf'\b{chave}\b[^=]*=\s*\[(.*?)\n\]', txt, re.S)
    if not m:
        raise SystemExit(f'gerar_cidade: nao achei {chave} em {caminho}.')
    out = []
    for lin in re.finditer(r"x:\s*(-?[0-9.]+)\s*,\s*z:\s*(-?[0-9.]+)\s*,\s*giro:\s*(-?[0-9.]+)\s*,\s*r:\s*\[([^\]]*)\]", m.group(1)):
        out.append((float(lin.group(1)), float(lin.group(2)), float(lin.group(3)),
                    [float(t) for t in lin.group(4).split(',')]))
    if not out:
        raise SystemExit(f'gerar_cidade: {chave} existe mas nenhuma ilha foi lida.')
    return out

def _ts_fileiras(caminho, chave):
    """lê `ORLA_BAIA_FILEIRAS` como (raio, sentido, tier). A seção da orla da
    baía é DESENHO, e desenho mora na cena: mudar a fileira lá tem de mudar o
    loteamento aqui sem ninguém copiar número."""
    txt = open(p_ts(caminho), encoding='utf-8').read()
    m = re.search(rf'\b{chave}\b[^=]*=\s*\[(.*?)\n\]', txt, re.S)
    if not m:
        raise SystemExit(f'gerar_cidade: nao achei {chave} em {caminho}.')
    out = []
    for lin in re.finditer(r'\{\s*r:\s*(-?[0-9.]+)\s*,\s*sentido:\s*([+-]?1)\s*,\s*tier:\s*([0-9]+)', m.group(1)):
        out.append((float(lin.group(1)), int(lin.group(2)), int(lin.group(3))))
    if not out:
        raise SystemExit(f'gerar_cidade: {chave} existe mas nenhuma fileira foi lida.')
    return out

_ALCA_TXT   = open(p_ts('teia.ts'), encoding='utf-8').read()
_m = re.search(r'AVENIDA_ALCA\s*=\s*\{(.*?)\}', _ALCA_TXT, re.S)
if not _m: raise SystemExit('gerar_cidade: AVENIDA_ALCA sumiu de teia.ts')
_bloco = _m.group(1)
ALCA_R    = float(re.search(r'\br\s*:\s*([0-9.]+)', _bloco).group(1))
ALCA_LARG = float(re.search(r'\blarg\s*:\s*([0-9.]+)', _bloco).group(1))
_arco = re.search(r'arco\s*:\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)', _bloco)
ALCA_ARCO = (float(_arco.group(1)), float(_arco.group(2)))
ALCA_TERRA_ARCO = _ts_const('teia.ts', 'ALCA_TERRA')
ALCA_R_BAIA = _ts_const('alca.ts', 'ALCA_R_BAIA')
ALCA_R_MAR  = _ts_const('alca.ts', 'ALCA_R_MAR')
ALCA_PRAIA  = _ts_const('alca.ts', 'ALCA_PRAIA_LARGURA')

# ── A TEIA DESENHADA ENTRA NO GERADOR, LIDA DE teia.ts, NUNCA COPIADA ───────
#
# ⚠️ ELA NUNCA ESTEVE AQUI, E ERA ESSE O DEFEITO ESTRUTURAL DO §25.1. O gerador
# montava o quarteirão numa grade PRÓPRIA (`_aneis()` em φ x `n_raios()` em
# 64/128/256) e `vias.ts` desenha a rua noutra (27 anéis em METROS x 84/168 de
# `N_RAD`). j/64 == i/168 exige i = 21j/8, inteiro só a cada 8 colunas, e dessas
# só as de índice par são radial ATIVO abaixo da dobra: quatro rumos coincidiam
# na cidade inteira, e eram 0°, 90°, 180° e 270°. Medido no registro selado de
# 22/09, nos 2.122 quarteirões de public/city/cidade-malha.json:
#   divisa angular até o radial ATIVO mais perto: mediana 63,2 m, p90 145,4,
#     máx 258,6; só 3,7% das 4.244 divisas caíam dentro dos 6 m da rua
#   68,9% das 9.996 pontas de travessa morriam cortadas em SOBRA_MAX = 90 m
#     (vias.ts) sem nunca achar radial, e 56,5% das travessas não tocavam a rede
#     em NENHUMA das duas pontas
#   98,7% dos quarteirões tinham rua da teia passando POR DENTRO deles
# E o orçamento fecha: o gerador RESERVAVA 15,63 km² de vão de rua
# (VIA_CONTORNO, 12 m entre anéis e entre células) e a teia DESENHAVA 15,36 km²
# noutro lugar. É o mesmo dinheiro gasto duas vezes: a cidade pagava a rua duas
# vezes e não ficava com nenhuma.
#
# ⚠️ ISTO SÓ LÊ. Quem CONSOME é `N_RAIOS0` (logo abaixo, que passou a ser o 84
# da teia), o assert de `DISTRITOS` e `_teia_n()` dentro de `tecido()`. Se um dia
# alguém tirar os consumidores, TIRE ISTO JUNTO: constante sem consumidor é peça
# órfã, e peça órfã só acrescenta ponto de falha por regex.
def _teia_num(_pat, _ond, _conv=float):
    _m = re.search(_pat, _ALCA_TXT)
    if not _m: raise SystemExit(f'gerar_cidade: {_ond} sumiu ou mudou de forma em teia.ts')
    return _conv(_m.group(1))
_TEIA_R0   = _teia_num(r'export const R_DENTRO\s*=\s*([0-9.]+)', 'R_DENTRO')
_TEIA_R1   = _teia_num(r'export const R_FORA\s*=\s*([0-9.]+)',   'R_FORA')
TEIA_N_RAD = _teia_num(r'export const N_RAD\s*=\s*([0-9]+)',     'N_RAD', int)
_vt = re.search(r'vaoDoAnel\(r: number\): number \{\s*return\s*(.+?)\n\}', _ALCA_TXT, re.S)
if not _vt: raise SystemExit('gerar_cidade: vaoDoAnel sumiu ou mudou de forma em teia.ts')
_VAO = [(float(_a), float(_b)) for _a, _b in
        re.findall(r'r\s*<\s*([0-9.]+)\s*\?\s*([0-9.]+)', _vt.group(1))]
# ⚠️ SEM ÂNCORA DE FIM DE LINHA NO RAMO `else`: com `$` um comentário depois do
# último ternário devolve lista vazia e estoura IndexError em vez da mensagem. O
# último `: NNN` da escada É o else, porque os outros dois-pontos vêm seguidos
# de `r <`.
_ELSE = re.findall(r':\s*([0-9.]+)', _vt.group(1))
if not _VAO or not _ELSE:
    raise SystemExit('gerar_cidade: vaoDoAnel deixou de ser escada de ternários')
_VAO_FIM = float(_ELSE[-1])
def _teia_vao(r):
    for _lim, _v in _VAO:
        if r < _lim: return _v
    return _VAO_FIM
TEIA_ANEIS = []
_rt = _TEIA_R0
while _rt <= _TEIA_R1:
    TEIA_ANEIS.append(_rt); _rt += _teia_vao(_rt)
_niv = re.search(r'NIVEIS[^=]*=\s*\[(.*?)\n\]', _ALCA_TXT, re.S)
if not _niv: raise SystemExit('gerar_cidade: NIVEIS sumiu de teia.ts')
_NIVEIS = [(int(_p), int(_i)) for _p, _i in
           re.findall(r'passo:\s*(\d+)\s*,\s*r0:\s*ANEIS\[\s*(\d+)\s*\]', _niv.group(1))]
if len(_NIVEIS) < 2 or _NIVEIS[-1][1] >= len(TEIA_ANEIS):
    raise SystemExit('gerar_cidade: NIVEIS mudou de forma ou aponta para anel que não existe')
TEIA_DOBRA_R = TEIA_ANEIS[_NIVEIS[-1][1]]      # o raio em que o nível fino nasce
# ⚠️ A GRADE DE CONFERÊNCIA É A DO NÍVEL GROSSO, NÃO A DE 168. Abaixo da dobra
# só os índices PARES de 168 existem, e os 84 são exatamente esses: um rumo
# múltiplo de 360/84 é radial ATIVO em QUALQUER raio, e é a única grade em que
# uma avenida cabe sem cortar célula em algum trecho.
TEIA_N_MEIO = TEIA_N_RAD // _NIVEIS[0][0]
# ⚠️ GUARDA DE TUPLA, E ELA NÃO É ZELO. `_NIVEIS[0][0]` só vale 2 se o regex
# acima gravar (passo, r0) nessa ordem. Gravando na ordem natural em português
# (raio, passo) daria `168 // 1450 == 0`, `_teia_n` devolveria 0 para metade dos
# anéis, `for j in range(0)` não levanta nada e as bandas Núcleo, Meio e Bairro
# sumiriam CALADAS. Um 84 derivado por divisão é caro demais para não ter guarda.
assert (TEIA_N_RAD, TEIA_N_MEIO) == (168, 84), \
    (f'teia.ts mudou: N_RAD={TEIA_N_RAD}, passo do nível 0 = {_NIVEIS[0][0]}; '
     'o tecido e o alocador de peças supõem 168/84')
PASSO_TEIA = 360.0 / TEIA_N_MEIO
print(f'teia lida da cena: {len(TEIA_ANEIS)} anéis de {TEIA_ANEIS[0]:.0f} a '
      f'{TEIA_ANEIS[-1]:.0f} m, {TEIA_N_RAD} radiais (dobra em {TEIA_DOBRA_R:.0f} m), '
      f'passo de conferência {PASSO_TEIA:.6f}°', file=sys.stderr)

print('alça lida da cena: via r %.0f larg %.0f, arco %.0f a %.0f, terra %.0f a %.0f, '
      'água de %.0f a %.0f, praia %.0f m'
      % (ALCA_R, ALCA_LARG, ALCA_ARCO[0], ALCA_ARCO[1], ALCA_TERRA_ARCO[0],
         ALCA_TERRA_ARCO[1], ALCA_R_BAIA, ALCA_R_MAR, ALCA_PRAIA), file=sys.stderr)

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
# ⚠️ 7.000 -> 9.000 em 02/09 (decisão do fundador: aumentar a abóbada para abrir
# margem d'água). O terreno NÃO precisou ser regerado: medido, o parque em 11.800
# tem extremo em |z| 12.230 m e a grade de 429x429 cobre 12.704, com 474 m de
# folga. E a célula de 59,23 m já é a resolução NATIVA do SLDEM2015 a 512 px por
# grau, então regerar não traria detalhe nenhum.
R_SITIO      = float(os.environ.get('R', 9000))
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
# ⚠️ OS RUMOS SÃO MÚLTIPLOS DO PASSO DO RADIAL DESENHADO (4,285714° = 360/84),
# E ISSO NÃO É DETALHE. Eles já foram 0/62/108/186/240/308 (números redondos),
# depois 0/61,875/106,875/185,625/241,875/309,375 (múltiplos de 360/64, que era
# a grade INTERNA do gerador e não a da rua). Medido contra 360/84, que é a
# grade em que `vias.ts` desenha o radial: cinco das seis costuras erravam de
# 11,7 a 81,8 m, ou seja a avenida de distrito cortava célula em ângulo
# exatamente como as diagonais que já foram removidas por isso.
# ⚠️ OS RUMOS ANDARAM ATÉ 1,875° (61,875 -> 60,000), ou 213 m em r 6.500, E ISSO
# MUDA DE SETOR QUEM MORA NA FAIXA DESLOCADA: o prefixo do lot_id (S01..S06) é o
# distrito. O custo é ZERO nesta rodada, porque a regeração já troca todos os
# endereços; DEPOIS dela vira caro e não pode mais ser feito.
# As aberturas continuam DESIGUAIS, que é o que o §desenho exige (fatia igual
# devolve mandala), e a soma continua fechando 360.
DISTRITOS = [   # (rumo inicial, abertura, giro FORA da tangente)
    (  0.000000, 60.000000,  38.0),   # 14 passos de 360/84
    ( 60.000000, 47.142857, -41.0),   # 11 · o que olha para o Parque Runestone (rumo 43)
    (107.142857, 77.142857,  35.0),   # 18
    (184.285714, 55.714286, -46.0),   # 13
    (240.000000, 68.571429,  40.0),   # 16
    (308.571429, 51.428571, -34.0),   # 12
]
# ⚠️ GUARDA: toda avenida tem de cair em RADIAL DA TEIA, senão ela corta célula.
# ⚠️ E ELA CONFERIA A GRADE ERRADA, EM SILÊNCIO, ATÉ 22/09. `360/64` era a grade
# interna do gerador; a rua corre em `360/N_RAD`, com o nível grosso em `360/84`.
# A guarda PASSAVA e a avenida cortava célula do mesmo jeito. É o padrão do
# §peça órfã em outra forma: guarda que confere outra coisa é pior que guarda
# nenhuma, porque cala.
# ⚠️ A TOLERÂNCIA É 1e-6 E NÃO 1e-9 DE PROPÓSITO: 360/84 é dízima (30/7) e os
# rumos acima estão escritos com seis casas, que é como eles são publicados. O
# resíduo medido é de 7e-8 passo, três ordens de grandeza dentro da folga.
for _d0, _ab, _ in DISTRITOS:
    assert abs(_d0 / PASSO_TEIA - round(_d0 / PASSO_TEIA)) < 1e-6, \
        f'costura de distrito no rumo {_d0} não é radial da teia'
    assert abs(_ab / PASSO_TEIA - round(_ab / PASSO_TEIA)) < 1e-6, \
        f'abertura de distrito de {_ab} não é múltiplo do passo do radial'
N_DIST = len(DISTRITOS)
assert abs(sum(d[1] for d in DISTRITOS) - 360.0) < 1e-6
# ⚠️ E A COSTURA SEGUINTE TEM DE SER A ANTERIOR MAIS A ABERTURA. A soma fechar
# 360 NÃO prova encadeamento: dois erros de digitação que se cancelam passam em
# silêncio e abrem um vão de distrito no meio da cidade.
_acc = 0.0
for _d0, _ab, _ in DISTRITOS:
    assert abs(_d0 - _acc) < 1e-6, f'costura {_d0} não encadeia: esperado {_acc}'
    _acc += _ab

# ⚠️ AS QUATRO PONTES CONTINUAM CAINDO EM VIA, e isso NÃO é mais a costura de
# setor. Elas desembocam nos rumos 0/90/180/270 e as costuras de distrito estão
# em 0/60/107,14/184,29/240/308,57: só o rumo 0 coincide. Por isso os eixos das
# pontes viram AVENIDAS RADIAIS próprias, independentes da divisa de distrito.
# Avenida não precisa ser divisa; precisa ser via.
# ⚠️ E OS QUATRO CARDEAIS SÃO RADIAL DA TEIA POR CONSTRUÇÃO: 90/(360/84) = 21
# passos exatos, 180 = 42, 270 = 63. Os nove rumos de `_BUL_RUMOS` caem todos na
# grade da rua, o que até 22/09 valia só para quatro deles.
AVENIDAS_RADIAIS = [0.0, 90.0, 180.0, 270.0]
# ⚠️ OS NOVE RUMOS RADIAIS DA CIDADE, num lugar só. São as quatro avenidas das
# pontes mais as seis costuras de distrito (o rumo 0 coincide, daí nove e não
# dez). O cinturão precisa deles para assentar peça com frente para bulevar, e
# `livre()` já os usava soltos em dois laços separados.
_BUL_RUMOS = sorted({*AVENIDAS_RADIAIS, *[d[0] for d in DISTRITOS]})

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
    # ⚠️ A BANDA DA BORDA VOLTOU (fundador, 30/08: "temos centenas de metros de
    # espaço sobrando debaixo da cúpula, ocupe o espaço que precisar"). O tecido
    # parava em 4.300 por causa do erro OPOSTO: com ele em 6.900 a ocupação caía
    # a 32% e a mediana ia a 476 m² — subúrbio, não cidade. Agora o erro inverteu
    # de sinal: com as máscaras corrigidas a mediana caiu a 58 m². O dado que
    # decide não é a área total, que sobra (os lotes somam 8,01 km² num tecido de
    # 23,99), é a TESTADA LOCAL: a bissecção parava porque 614 carteiras não
    # achavam frente no distrito delas. Uma banda a mais dá para onde elas irem.
    (4300.0, 5500.0, 'Borda',  5),      # 286 m: grão largo de periferia
]
# ⚠️ A BANDA DO HORIZONTE, E POR QUE A OBJEÇÃO DE 30/08 SE INVERTEU. O tecido
# parou em 5.500 porque com lote pequeno um tecido maior lia como ruína: 32% de
# ocupação, quarteirão pela metade. Agora a área por lote é PROMESSA PÚBLICA
# (§16.1: 46,30 km², e a landing já disse a cada holder o número dele), e ela
# não cabe nem no tecido inteiro de hoje, que tem 43,55 km². Com o lote 53%
# maior, esticar o tecido não esvazia a cidade: ela fica mais densa do que a que
# assustou, porque a ocupação sobe junto.
# `PHI_LOTE=6500` liga a banda. O padrão continua 5.500 até o fundador aprovar,
# porque isso COME O CINTURÃO PRODUTIVO, que é programa dele, não vazio.
PHI_LOTE = float(os.environ.get('PHI_LOTE', 6500))   # 🔒 20/09: é o que honra a promessa
# ── A RECEITA DO CADERNO NÃO É A RECEITA DO ARTEFATO SELADO ─────────────────
#
# ⚠️ ESTAS DUAS VARIÁVEIS VÊM DO AMBIENTE E O MASTERPLAN PUBLICA UMA RECEITA
# QUE NÃO É A DO REGISTRO. Ele escreve, em dois lugares, `PHI_LOTE=6900
# RESERVA_PCT=2`; o artefato selado de 22/09 foi feito com 6.500 e 1%. Medido
# no registro: no quadrante do cemitério nenhum lote de tecido passa de φ
# 6.452, e só 542 lotes da cidade inteira passam de 6.500, todos de distrito
# especial. Quem copiar a receita do caderno gera OUTRA cidade e o merkle root
# sela essa outra em silêncio.
# ⚠️ ISTO AVISA, NÃO IMPEDE: crescer a faixa loteável é decisão legítima do
# fundador, e travar aqui seria o gerador vetando projeto. O que não pode é
# acontecer calado. Três linhas matam a categoria inteira de "alguém copiou a
# receita errada do caderno".
_SELADO = {'PHI_LOTE': 6500.0, 'RESERVA_PCT': 1.0}
for _v, _sel in _SELADO.items():
    _at = float(os.environ.get(_v, _sel))
    if abs(_at - _sel) > 1e-9:
        print(f'\n*** ATENÇÃO: {_v}={_at:g} e o registro selado de 22/09 usou {_sel:g}. '
              f'Esta rodada NÃO reproduz o artefato selado. Se isso é intencional, siga; '
              f'se veio de receita copiada do masterplan, pare agora. ***\n', file=sys.stderr)
if PHI_LOTE > 5500.0:
    BANDAS.append((5500.0, PHI_LOTE, 'Horizonte', 6))   # 345 m: o grão mais largo
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
# ⚠️ ESTE NÚMERO TEM DE ACOMPANHAR A ÚLTIMA BANDA, sempre. Ele é o fim do tecido
# E o fim da mistura da superelipse em `phi()`: se ficar atrás da última banda, a
# forma é aplicada pela metade onde a cidade acaba e o tecido volta a sair
# circular sob uma abóbada que não é.
PHI_PRODUTIVO = PHI_LOTE   # acompanha a última banda, sempre
# ⚠️ A CINTA POLAR DEIXOU DE EXISTIR E ISSO NÃO É PERDA. Ela era a faixa externa
# em quadra tangencial, criada para consertar a borda serrilhada que a malha
# CARTESIANA deixava ao ser recortada numa forma. Na teia o tecido INTEIRO já é
# tangencial, então a borda fecha sozinha e uma cinta separada não teria o que
# consertar. As constantes ficam declaradas só porque `cidade-malha.json` ainda
# as publica para a cena.
# ⚠️ E A ÚLTIMA BANDA TEM DE IR ATÉ A BORDA. Ela parava em 4.040, que era onde a
# Cinta começava: sem a Cinta, os últimos 360 m de cidade ficavam SEM TECIDO, e
# foi isso que derrubou a capacidade de 94.003 para 67.720 vagas.
PHI_CINTA = PHI_LOTE
CINTA_FAIXAS = []

LOTE_W, LOTE_D = 12.0, 25.0       # 300 m² nominais; a testada vira variável ao plantar
CELULA       = 180.0     # ⚠️ LEGADO: só as peças congeladas nasceram nesta célula
QUARTEIRAO   = 168.0     # ⚠️ LEGADO: idem, e a peça já não depende mais disto
QUARTO       = 3
BULEVAR      = 34.0      # largura do bulevar radial sobre cada costura
FAIXA        = 50.0      # profundidade da faixa: duas fileiras costas com costas
# `DECL_LOTE=0.20` na linha de comando mede outro limiar sem editar o arquivo, e
# um valor alto (99) desliga a regra para comparar contra a cidade de antes.
DECL_LOTE_MAX = float(os.environ.get('DECL_LOTE', 0.12))

# ⚠️ A MÁSCARA GROSSA PASSOU A OBEDECER A LEI (20/09). Ela cortava em 4° (7%),
# herança de quando não existia teto por lote, e o fundador decidiu em 19/09 que
# lotável vai até 12% na escala do lote (masterplan §15). Os dois números não
# são intercambiáveis, porque medem escalas diferentes, mas a máscara grossa não
# pode ser MAIS DURA que a lei: ela recusava 11,03 km² brutos da faixa loteável
# em terreno que a lei permite, e isso é 9,5% da faixa. Quem garante o teto é o
# teste de pegada em `_cabe`, que mede os quatro cantos do lote de verdade.
DECLIVE_MAX  = math.degrees(math.atan(DECL_LOTE_MAX))   # 6,84° = 12%

# ⚠️ DOIS TETOS DE DECLIVIDADE, E ELES MEDEM COISAS DIFERENTES. `DECLIVE_MAX` é
# em GRAUS e sai da grade do heightmap, célula de 59,2 m: é a máscara grossa,
# que diz se aquele PEDAÇO DE MONTE é lotável. `DECL_LOTE_MAX` é a decisão do
# fundador de 19/09 (masterplan §15) e é medida na PEGADA DO LOTE, que tem 14 m
# na mediana: é o que o boneco de 1,70 m sobe andando. A grade de 59 m suaviza e
# deixa passar rampa curta; por isso os 2.513 lotes acima de 12% existiam mesmo
# com a máscara grossa ligada. Os dois valem juntos: o grosso decide o terreno,
# o fino decide o lote.


# ⚠️ 960/1.300 -> 1.470/1.830 (03/09) -> LIDO DE `terrain.ts` (22/09), E A LIÇÃO
# É QUE COPIAR NÚMERO DE CHÃO NUNCA FUNCIONOU NESTE PROJETO.
#
# A nota antiga aqui já dizia, com todas as letras, que o número "não é escolha
# desta frente: é o que `terrain.ts` desenha". E mesmo assim ele foi COPIADO, e
# mesmo assim divergiu de novo: a cena foi para 2.400/2.760 e o gerador ficou em
# 1.470/1.830, uma diferença de 930 m, por dezenove dias. O comentário até
# apontava "linha 307", que já não existe.
#
# ⚠️ O QUE ISSO CUSTOU, MEDIDO: 8.171 lotes (12,2% do tecido) com a cota gravada
# a mais de 1,5 m do chão que a cena desenha, 4.142 acima de 10 m, 1.644 acima de
# 30 m, pior caso 56,6 m. E `cota_cm` ENTRA NA FOLHA DO MERKLE
# (`scripts/city/merkle.py`), ou seja o root de 22/09 assinava esses números: não
# era defeito de desenho, era defeito de TÍTULO. O portão de 15 testes não viu
# porque ele compara a cota de cada lote com a MEDIANA DOS VIZINHOS, e erro que
# vale igual para o bairro inteiro passa.
#
# Agora o par é LIDO do arquivo da cena, como a alça e a orla já são. Se a cena
# mudar, o gerador acompanha ou morre com mensagem clara (`_ts_const` levanta
# SystemExit). Não há terceira opção, e é de propósito.
PLATO_R     = _ts_const('terrain.ts', 'PLATO_R')     # 2.400
PLATO_FUNDE = _ts_const('terrain.ts', 'PLATO_FIM')   # 2.760
# ⚠️ O PARQUE TEVE DE SAIR. Com a cidade a 6.900 (R_ABOBADA) ele ficaria DENTRO
# dela em 5.200, e ele é parque nacional: fica fora da abóbada, alcançado de
# veículo pressurizado. 9.800 deixa a chegada dele (o Portão, a 2,75 km do
# Monarca pelo lado da cidade) a 7.050, ou seja 150 m depois da borda urbana.
# ⚠️ 9.800 -> 11.800 em 02/09, junto com a cidade indo a 9.000. O parque tem de
# continuar FORA da casca, e a identidade que amarra os dois é
# `PARQUE_DIST - PARQUE_FRENTE == R_CASCA`: 11.800 - 2.750 = 9.050. Se você mexer
# num, mexa no outro. E ESTE NÚMERO TEM DE BATER COM `DIST` em
# app/city/plaza/park-site.ts, senão o gerador reserva o vazio num lugar e o
# parque nasce noutro, em cima de lote.
PARQUE_RUMO, PARQUE_DIST, PARQUE_DISCO = 43.0, 11800.0, 3600.0
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
    # ⚠️ A MISTURA TERMINA ONDE O TECIDO TERMINA, NÃO NA BORDA DA ABÓBADA. Isto
    # era `(r - R_INICIO) / (PHI_BORDA - R_INICIO)` com PHI_BORDA = 6.900, e o
    # lote para em 4.300: naquele ponto a fração valia 0,52, ou seja a forma
    # estava aplicada pela METADE onde a cidade acaba. A superelipse só ficava
    # ela mesma perto de 6.900, que é o cinturão vazio. Resultado visto de cima:
    # abóbada em superelipse e TECIDO EM CÍRCULO PERFEITO. A forma estava sendo
    # gasta na parte vazia. Resíduo de quando o lote ia até a borda.
    w = min(1.0, max(0.0, (r - R_INICIO) / (PHI_PRODUTIVO - R_INICIO)))
    return r*(1 - w*w*(3 - 2*w)) + q*(w*w*(3 - 2*w))

# ── PARQUES ESCOLHIDOS, NÃO SORTEADOS POR MALHA ─────────────────────────────
# ⚠️ O tecido antigo esvaziava a célula do meio de cada quarto 3x3: um buraco a
# cada 540 m em fileira perfeita. Na planta isso vira POÁ, e poá é o sinal mais
# forte de carimbo num mapa. Parque de cidade é POUCO, GRANDE e fica onde há
# motivo. Nenhum destes tem par simétrico e nenhum está no centro de um distrito.
# ⚠️ OS RUMOS DOS PARQUES SÃO ENCOSTADOS EM RAIO logo abaixo, em `_pq_geo()`.
# ⚠️ AS PEÇAS DE SÉRIE NUMERADA SAÍRAM (fundador, 30/08). Ele foi direto: "os
# elementos brancos foram colocados por nós mesmo pra ocupar espaço vazio... tire
# os elementos sem identificação". São 26 peças e 1.240 ha: 12 Fazendas de
# Proteína, 8 Parques e 6 Lagos de Pesca — a mesma laje branca repetida, que na
# chapa lê como confete e não como programa.
#
# ⚠️ O CRITÉRIO É IDENTIDADE, NÃO TIPO NEM TAMANHO. Fica tudo que tem NOME
# PRÓPRIO, mesmo ainda sem desenho 3D: DOG University, City Hall, Casa da Moeda,
# Museu da Runa, Distrito Financeiro, Parque Olímpico, DOG Derby, os sete elos da
# cadeia industrial, os jardins. Essas não são enchimento, são programa à espera
# de desenho. E ficam também as 6 Bocas de Autopista, que são numeradas mas têm
# FUNÇÃO: são as bocas dos túneis.
#
# ⚠️ E OS 6 LAGOS DE PESCA FICARAM REDUNDANTES POR CONTA PRÓPRIA. A cidade passou
# a ter 20,5 km² de água na baía; seis tanques de 37 ha ao lado disso são ruído.
# Ver a decisão da baía.
SERIE_NUMERADA = False

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
# ⚠️ ESTE COMENTÁRIO ESTAVA PODRE E O DEFEITO CONTINUA ABERTO. Ele dizia "os
# rumos têm de ser raio da teia, e estes são: 22,5 são 4 passos exatos", mas
# 22,5/67,5/112,5 foram trocados por 25/55/85 na mudança da janela da baía e
# NINGUÉM refez a conta. Medido: 25/(360/84) = 5,833 passos, 55 dá 12,833 e 85
# dá 19,833; contra a base antiga de 360/64 davam 4,444 / 9,778 / 15,111. Ou
# seja os três canais radiais não caem em NENHUMA das duas grades, e nenhum
# assert cobre os canais.
# ⚠️ NÃO CONSERTE AQUI. Mover canal move o desenho da cena (`canais.ts` e o
# talude de `terrain.ts`), que não é deste arquivo: é decisão de projeto, e está
# registrada para o fundador. São três lâminas de 60 m cruzando a malha em
# ângulo quebrado.
#
# ⚠️ E ELES NÃO PODEM SER AVENIDA. A primeira versão pôs os canais em 0/45/90/...,
# ou seja EM CIMA dos eixos das pontes: lâmina de 60 m sobre avenida de 34, com a
# água cobrindo a via inteira. Quatro das nove avenidas radiais afogadas, e
# justamente as quatro que recebem as pontes. O fundador desconfiou olhando a
# chapa e a conferência confirmou por construção.
# ═══════════════════════════════════════════════════════════════════════════
# FASE 1 — A INFRAESTRUTURA. Nada aqui depende de lote nem de peça.
#
# ⚠️ A ORDEM É LEI, NÃO COINCIDÊNCIA (fundador, 30/08: "mudar a ordem de
# planejamento e execução fode tudo"). A teia, os canais e as vias nascem
# PRIMEIRO, porque são a infraestrutura; depois as peças escolhem célula
# sabendo onde tudo passa; só então o lote é plantado no que sobrou. Este bloco
# estava 650 linhas abaixo, DEPOIS das peças de borda já terem consultado
# `livre()` — ou seja a máscara respondia com os φ ALVO do canal e não com os
# encostados, e eu tinha de invalidar a tabela na mão para consertar. Subindo o
# bloco o problema deixa de existir em vez de ser remendado.
#
# ⚠️ 64 -> 84, E É A BASE DA TEIA DESENHADA (teia.ts `N_RAD // NIVEIS[0].passo`),
# NÃO MAIS UM NÚMERO DA CASA. Enquanto a base era 64 e a rua corria em 84/168, a
# tradução `(j * N_RAIOS0) // n` de `tecido()` DEIXAVA DE SER EXATA: medido, 60
# de 84 células (71%) e 56 de 168 (33%) cruzavam uma divisa da base, contra 0 de
# 64/128/256. A célula que encavala a borda de ENTRADA de uma peça não era
# bloqueada e o quarteirão nascia por cima da peça; a que encavala a borda de
# saída era bloqueada de graça. Com 84 a divisão volta a ser exata (84/84 = 1,
# 168/84 = 2) e o comentário de `_cell_arco` ("todo raio do conjunto base existe
# em qualquer anel") volta a ser verdade.
# ⚠️ E ISTO CONSERTA `rumo_de_raio()` DE QUEBRA: com base 84, `n_raios(3000)`
# devolve 84 (2π·3000/84 = 224,4, abaixo do limiar de 250) e TODA peça extra
# (fazenda, lago, planta, campo de extração, parque) passa a nascer num rumo que
# é radial desenhado. Com base 64 ele devolvia 128, passo 2,8125°, e medido: 25
# dos 27 rumos das peças extras caíam fora da grade da rua.
N_RAIOS0 = TEIA_N_MEIO   # 84
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

def raio_em_phi(ang, alvo):
    """o raio, naquele rumo, onde φ vale `alvo`. φ é monótono, então bisseção basta."""
    lo, hi = 200.0, 14000.0
    for _ in range(42):
        m = (lo + hi) / 2
        if phi(math.sin(ang)*m, -math.cos(ang)*m) < alvo: lo = m
        else: hi = m
    return (lo + hi) / 2

# ⚠️ §36 DO masterplan.md: A DIVISA RADIAL NASCE DA FACE DO ANEL, NÃO DE φ.
# `anelRaio()` em app/city/plaza/teia.ts é a fórmula que DESENHA a rua: dado o
# raio do VÉRTICE `r`, a FACE do dodecágono no rumo `ang` está em
# `r·cos15° / cos(t)`, com `t` a distância angular ao vértice mais perto
# (vértices a cada 30°, faces centradas 15° adiante). Espelhada aqui porque o
# gerador não lê JS: se a cena mudar a fórmula, mude aqui também, do mesmo
# jeito que `anelRaio` é a única verdade da rua (comentário dela em teia.ts).
def _teia_face_raio(r_vertice, ang):
    PASSO = math.pi / 6
    rel = ((ang % PASSO) + PASSO) % PASSO - PASSO / 2
    return (r_vertice * math.cos(PASSO / 2)) / math.cos(rel)

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

# ⚠️ §36: CADA FRONTEIRA DE BANDA (φ) ESCOLHE UM ANEL DA TEIA (metros), E A
# ESCOLHA É MONOTÔNICA. As duas grades quase coincidem por desenho (BANDAS usa
# `_lado(k)+VIA_CONTORNO` = 121/180/239/298, `vaoDoAnel` da teia devolve
# 122/180/239/298: a mesma escada, com Núcleo 1 m mais estreita), então do
# Núcleo à Borda o casamento é 1 para 1 quase exato. Onde elas divergem (a
# banda Horizonte pede 357 m e a teia não tem anel mais largo que 298 além de
# 5.000 m) o ponteiro da teia avança mais devagar que o das bandas, e o
# quarteirão daquele trecho nasce mais raso que o nominal da classe, medido
# e registrado no relatório da rodada (`_ref['vao']` abaixo), nunca escondido.
# ⚠️ NUNCA RETROCEDE E NUNCA REPETE ANEL. Repetir colapsaria a divisa a zero
# (dois limites de banda na mesma face); retroceder cruzaria duas fronteiras
# na mesma face, ou seja um quarteirão comendo o vizinho. Como as duas listas
# são crescentes, o ponteiro só anda para frente.
def _casa_aneis_teia(fronteiras, aneis):
    out, j = {}, 0
    for p in fronteiras:
        while j + 1 < len(aneis) and abs(aneis[j+1] - p) <= abs(aneis[j] - p):
            j += 1
        out[p] = aneis[j]
        if j + 1 < len(aneis): j += 1
    return out
_FRONTEIRA_ANEL = _casa_aneis_teia(_ANEIS_PHI, TEIA_ANEIS)

# ── A DOBRA DA TEIA TRADUZIDA PARA φ, E POR QUE ELA É O MÁXIMO E NÃO A MÉDIA ──
#
# ⚠️ A TEIA DOBRA NUM RAIO EM METROS E O ANEL DO GERADOR É UMA FAIXA DE φ.
# Medido em 3.600 rumos, φ(r = 3.384 m) vai de 3.285,5 a 3.553,9: amplitude de
# 268, mais de um passo de anel. Um limiar pela MÉDIA poria divisa em radial
# ÍMPAR num rumo onde o ímpar ainda não nasceu. Então o limiar é o MÁXIMO,
# aplicado ao φ DE DENTRO do anel: quando o gerador usa 168, todo ponto daquele
# anel já passou da dobra em TODO rumo. Medido depois do conserto: o anel de 168
# mais interno começa 143,8 m ALÉM da dobra no pior dos 360 rumos.
# ⚠️ E O LADO SEGURO NÃO É DE GRAÇA, o número está aqui para não ser enterrado:
# 20,7% da área dos anéis que ficam em 84 está ALÉM de r 3.384, e lá o radial
# ÍMPAR de 168 É desenhado (seção de 9 m) atravessando o MEIO do quarteirão.
# Isso é bem menos grave que divisa em radial inexistente, que é o defeito que
# estamos consertando, mas não é zero. Zerar exige mover o corte da banda
# Bairro para que uma divisa de anel caia em φ 3.553,9: outra rodada de medição.
TEIA_PHI_DOBRA = max(phi(math.sin(math.radians(_a/10.0))*TEIA_DOBRA_R,
                        -math.cos(math.radians(_a/10.0))*TEIA_DOBRA_R)
                     for _a in range(3600))
def _teia_n(p0):
    """quantas células angulares o anel do gerador tem: 84 ou 168, nunca outra.

    ⚠️ SUBSTITUI `n_raios()` DENTRO DE `tecido()`, e só lá. `n_raios` continua
    existindo porque o alocador de peças e `rumo_de_raio` raciocinam na BASE
    (que agora também é 84); quem decide DIVISA DE QUARTEIRÃO passa a ser esta,
    porque é a grade em que a rua é desenhada.
    """
    return TEIA_N_RAD if p0 >= TEIA_PHI_DOBRA else TEIA_N_MEIO
print(f'dobra da teia: r {TEIA_DOBRA_R:.0f} m = φ {TEIA_PHI_DOBRA:.0f} (máximo em 3.600 '
      f'rumos); {sum(1 for _a in _aneis() if _teia_n(_a[0]) == TEIA_N_RAD)} de '
      f'{len(_aneis())} anéis em {TEIA_N_RAD} células, o resto em {TEIA_N_MEIO}',
      file=sys.stderr)

# Deslocados meio passo de 45°, os canais correm ENTRE as avenidas: a cidade fica
# com raio de água e raio de asfalto alternados, que é o que Amsterdam faz.
# ⚠️ TRÊS RADIAIS, NÃO OITO (fundador, 30/08: "ajuste o desenho da cidade à
# geografia"). Medido na cota −40: só CR01 (22,5°), CR02 (67,5°) e CR03 (112,5°)
# ALCANÇAM o lago — os outros cinco terminariam em trincheira cega, com corte de
# até 123 m para cavar vala sem saída. Escavação: 22,8 Mm³ contra 112 se os oito
# ficassem, e 945 se os anéis também ficassem.
# Os cinco rumos que saíram continuam existindo como BULEVAR, que já corria neles.
# ⚠️ OS TRÊS CANAIS FORAM MOVIDOS PARA A JANELA DA BAÍA (fundador, 31/08: "os
# canais não estão escavados até a baía"). Medido: a baía de 20,5 km² só é
# alcançável a partir do anel interior nos rumos 355° a 105° — ela ocupa o
# quadrante nordeste e mais nada. Os rumos antigos (22,5 · 67,5 · 112,5) tinham um
# acerto, um estouro e um FURO: o de 112,5° corria 5,4 km e não encontrava água
# nenhuma, porque naquele rumo não há baía. Canal que não chega na água não é
# canal, é vala.
#
# 25 · 55 · 85 ficam espaçados de 30° dentro da janela, e a baía os encontra em
# r 4.850, 3.730 e 5.810. Eles radiam do porto para dentro da cidade, que é como
# via de água funciona: ela nasce no ancoradouro.
# ⚠️ §40 (23/09/2026): NO RADIAL DA TEIA, 0,714° ADIANTE. 25, 55 e 85 caíam entre
# radiais (múltiplos de 360/84 = 4,286°) e o corredor de 140 m (lâmina 60 + talude 40
# de cada lado) cortava célula pelo meio. Em j = 6, 13 e 20 de 84 ele vira a divisa
# lateral das células vizinhas, e a baía continua encontrando os três.
CANAL_RADIAIS = [j * 360.0 / 84 for j in (6, 13, 20)]
# ⚠️ 96 -> 60 (fundador, 30/08: "60 m já resolve"). 96 m de lâmina entre
# quarteirões de 109 a 227 m de fundo era canal mais largo que a quadra do
# Núcleo. 60 m ainda é mais largo que qualquer canal de Amsterdam e cabe entre
# as células com folga para o cais dos dois lados.
CANAL_RAD_SEC = 60.0
# ⚠️ UM QUINTO ANEL DE CANAL entrou junto com o crescimento: sem ele os 2.000 m
# novos de cidade ficariam sem água, e a rede tem de chegar na borda nova.
# ⚠️ ESTES SÃO OS φ DESEJADOS, NÃO OS FINAIS. Logo abaixo de `_aneis()` cada um é
# encostado na linha de anel mais próxima: sem isso o canal passava no meio de uma
# fileira de lotes, e o fundador chamaria de aleatório com razão.
# ⚠️ DUAS PEÇAS FICAM NA CASCA E CONTINUAM ELIPSE LIVRE. O Portão da Abóbada e o
# Farol vivem além de R_ABOBADA, onde não há malha nenhuma para ancorar: ali o
# referencial é a casca, não o quarteirão.
# (id, nome, tipo, rumo, raio, a, b, rot)
PROGRAMA_CASCA = [
  ('D01', 'Portão da Abóbada', 'distribuicao', 177, 4450, 170, 70, 87),
  ('C11', 'Farol do Portão',   'civico',       183, 4380,  45, 45,  0),
]

# ⚠️ UM SEXTO ANEL entrou com a banda da Borda: sem ele os 1.200 m novos de
# cidade ficariam secos e a rede de água pararia antes da última banda.
CANAL_ANEL_SEC = 60.0
# ⚠️ O TALUDE É PARTE DO CORREDOR E PRECISA SER RESERVADO. `terrain.ts` cava uma
# rampa de terra de `CANAL_TALUDE` metros de cada lado, além da lâmina. A máscara
# antiga reservava só a lâmina, então o lote da margem nascia EM CIMA da rampa:
# medido, 2.190 lotes com a pegada no talude. Reservar aqui é o que faz a margem
# virar cais em vez de barranco.
# ⚠️ 40 m, NÃO 12, E OS TRÊS LADOS TÊM DE CONCORDAR (30/08). Com a água da cidade
# na cota única de −40, o cais do canal fica a −37,8 e a cidade em volta a −28:
# são 10 m de desnível para vencer. Em 12 m isso é rampa de 83%, e o desenho do
# canal (que precisa de 40 m para fazer um talude de 25%) passava POR CIMA da
# escavação em parte do trecho e POR BAIXO no resto — o regolito furava a margem
# em pedaços e a leitura virava "canal caótico", com a fita d'água reta aparecendo
# só nos vãos. Quem cava (terrain.ts), quem desenha (canais.ts) e quem reserva a
# terra (`em_canal` aqui) têm de usar o MESMO número, e ele é publicado.
CANAL_TALUDE = 40.0

# ⚠️ E O ÚLTIMO É A DOCA (fundador, 30/08: "criamos mais um anel de canais no fim
# da cidade, onde todos os canais terminam"). Sem ele os oito radiais morriam num
# anel intermediário e os 300 m finais de cidade ficavam secos: canal que acaba
# no meio do quarteirão não é canal, é vala. Com a doca a rede fecha — do lago
# central pelos radiais até um cais perimetral, que é o Singelgracht de Amsterdam.
# ⚠️ OS SETE ANÉIS DE CANAL SAÍRAM, e o motivo é o mesmo que matou a colmeia da
# cúpula: eram círculos geométricos jogados sobre um relevo que não é circular.
# Medido: o CA07 passava 20,5 dos seus 34,4 km DENTRO de cratera, 60% do traçado,
# e nivelá-los custaria 945 Mm³ — quatro Canais do Panamá e meio. A água da
# cidade passa a ser o LAGO natural, que é o que a geografia oferece de graça.
CANAL_ANEIS_ALVO = []
_usadas = set()
CANAL_ANEIS = []
for _alvo in CANAL_ANEIS_ALVO:
    # ⚠️ O TETO É PHI_PRODUTIVO − 5, NÃO − 100. Com −100 a linha de anel de 5.492
    # ficava de fora e a doca não tinha onde encostar.
    _cand = [v for v in _ANEIS_PHI if v not in _usadas and R_INICIO + 100 < v < PHI_PRODUTIVO - 5]
    if not _cand: continue
    _v = min(_cand, key=lambda v: abs(v - _alvo))
    _usadas.add(_v); CANAL_ANEIS.append(_v)
# ── OS VÃOS: O CANAL PARA ANTES DE BATER E RECOMEÇA DEPOIS ─────────────────
#
# ⚠️ IDEIA DO FUNDADOR, 30/08: "não podemos parar o canal antes dele colidir com
# o outro elemento? Afinal é um canal, começamos e terminamos ele onde
# quisermos". É a saída certa e a alternativa era pior: mover o Farol do Portão
# para longe do canal move ele para longe do PORTÃO, que é a razão de ele
# existir. Um farol que não está no portão não é o farol do portão.
#
# ⚠️ E ISTO RODA NA FASE 1, junto com o canal, não depois. As peças da casca são
# a PORTA da abóbada: posição fixada pela casca, não pelo quarteirão, portanto
# infraestrutura como o canal. Quem cede é o canal, porque a porta não pode
# andar. Peça de quarteirão nunca abre vão — essa se resolve no alocador.
_VAO_MARG = CANAL_ANEL_SEC/2 + CANAL_TALUDE + 20.0
CANAL_VAOS = []
for _an in CANAL_ANEIS:
    _v = []
    for _pid, _nome, _tp, _ru, _ra, _ea, _eb, _rot in PROGRAMA_CASCA:
        _s = max(_ea, _eb)
        # o anel passa pela faixa de raio da peça?
        _rr = raio_em_phi(math.radians(_ru), _an)
        if abs(_rr - _ra) > _s + _VAO_MARG: continue
        _dg = math.degrees((_s + _VAO_MARG) / max(1.0, _ra))
        _v.append((_ru - _dg, _ru + _dg))
    # funde os vãos que se tocam, senão sobra ilha de água de 3 m entre dois
    _v.sort()
    _f = []
    for _a0, _a1 in _v:
        if _f and _a0 <= _f[-1][1] + 1.0: _f[-1] = (_f[-1][0], max(_f[-1][1], _a1))
        else: _f.append((_a0, _a1))
    CANAL_VAOS.append([[round(_a0 % 360.0, 2), round(_a1 % 360.0, 2)] for _a0, _a1 in _f])
_nv = sum(len(v) for v in CANAL_VAOS)
if _nv:
    print(f'vãos abertos nos canais de anel: {_nv} '
          + ', '.join(f'CA{i+1:02d} {a0:.1f}->{a1:.1f}°'
                      for i, v in enumerate(CANAL_VAOS) for a0, a1 in v), file=sys.stderr)

def livre_de_canal(ru, ph, meio):
    """(rumo, raio) de uma peça do cinturão que não é cortada por canal nenhum.

    ⚠️ AS PEÇAS DO CINTURÃO NÃO PASSAM PELO ALOCADOR — são postas por rumo e φ —
    então a checagem de canal tem de vir na mão, e é a mesma regra das outras:
    quem cede é a peça, porque o canal é infraestrutura da fase 1. Duas correções
    na mesma função: EMPURRA em raio para sair do cais do anel, e GIRA de raio da
    teia em raio da teia para sair do canal radial. Girar é o que resolve o
    radial: ele é uma reta e acompanha quem só se afasta do centro.
    """
    ang = math.radians(ru)
    r = raio_em_phi(ang, ph)
    rc = max((raio_em_phi(ang, an) for k, an in enumerate(CANAL_ANEIS)
              if not em_vao(k, ru)), default=0.0)
    rmin = rc + CANAL_ANEL_SEC/2 + CANAL_TALUDE + meio
    mexeu = r < rmin
    r = max(r, rmin)
    passo = 360.0 / N_RAIOS0
    cand = ru
    for t in range(N_RAIOS0):
        achou = False
        for sg in ((0,) if t == 0 else (-1, 1)):
            cand = (ru + sg * t * passo) % 360.0
            dg = math.degrees((meio + CANAL_RAD_SEC/2 + CANAL_TALUDE) / max(1.0, r))
            if not any(abs(((cr - cand + 180) % 360) - 180) < dg for cr in CANAL_RADIAIS):
                achou = True; break
        if achou: break
    if abs(((cand - ru + 180) % 360) - 180) > 0.01:
        ru = cand; ang = math.radians(ru)
        r = max(raio_em_phi(ang, ph), rmin); mexeu = True
    return ru, r, mexeu

# ⚠️ TODA PEÇA DO CINTURÃO COM FRENTE PARA RUA, igual às da teia (fundador,
# 30/08: "eles não podem ficar com esse aspecto de terem sido jogados aí").
# A peça da teia tem rua na divisa POR CONSTRUÇÃO, porque ocupa célula inteira.
# A do cinturão era posta por rumo e φ livres e não tinha nada: 46 de 48 a mais
# de 200 m de qualquer via. Aqui ela ganha duas frentes de uma vez — encosta num
# ANEL VIÁRIO por um lado e num BULEVAR pelo outro. É a mesma regra, aplicada
# onde não há teia para dar a rua de graça.
# ⚠️ QUEM PRECISA DE AR MORA DENTRO DA CASCA (fundador, 30/08: "se o elemento
# coerentemente precisar de atmosfera, mova ele pra dentro da abóbada, num dos
# pontos que ele vai ter acesso à rua e a canais de água. Não vamos mais mexer em
# abóbada nem fazer abóbadas novas").
#
# ⚠️ JÁ EXISTIA UMA REGRA DESSAS E ELA ERA CEGA PARA METADE DOS CASOS: o bloco
# "nenhuma peça pode atravessar a casca" só olhava quem CRUZAVA a borda, então
# peça inteiramente do lado de fora passava batido. Medido: oito peças que
# dependem de atmosfera estavam FORA — dois Lagos de Pesca (água ferve no vácuo),
# duas Fazendas de Proteína e quatro plantas industriais, que são guarnecidas.
#
# ⚠️ E O RAIO DA CASCA É 7.050, NÃO `R_ABOBADA`. R_ABOBADA (6.900) é um φ, e φ não
# é raio: no rumo errado os dois diferem centenas de metros. `DOME_R` em
# app/city/plaza/dome.ts é a verdade, e os dois TÊM de bater.
# ⚠️ ANDA COM `PARQUE_DIST`: a casca fecha exatamente na testada do parque, ou
# seja R_CASCA == PARQUE_DIST - PARQUE_FRENTE. 7.050 -> 9.050 em 02/09. Não é
# derivado em código porque PARQUE_FRENTE só nasce lá embaixo, na linha 1359.
# ⚠️ E TEM DE BATER COM `DOME_R` em app/city/plaza/dome.ts.
R_CASCA = 9050.0
# ⚠️ O NOME É `_TIPOS_COM_AR` E NÃO `_PRECISA_AR` porque a linha ~1150 já usa
# `_PRECISA_AR` para outra coisa: uma tupla de NOMES de peça de borda. Chamei o
# meu de igual e ele foi silenciosamente sobrescrito antes de o cinturão rodar —
# `'agua' in ('Hortas', 'Campo de Treino', ...)` é sempre falso, então oito peças
# que dependem de atmosfera continuaram do lado de fora sem um erro sequer.
_TIPOS_COM_AR = {'agua', 'floresta', 'verde', 'producao', 'lazer', 'jardim',
                 'esporte', 'civico', 'financeiro', 'transporte', 'industria'}

def _janela_pega_guerra(_i, _nr, _jj, _ns):
    """a janela de células cobre a Cratera da Guerra (com folga)?"""
    gphi = phi(GUERRA_CX, GUERRA_CZ)
    p0, p1 = _PHI_B[_i], _PHI_B[_i + _nr]
    if not (p0 - GUERRA_R <= gphi <= p1 + GUERRA_R): return False
    _, rm, _, _ = _cell_arco(_i, _jj)
    dg = math.degrees(GUERRA_R / max(1.0, rm))
    g0 = (_jj / N_RAIOS0) * 360.0 - dg
    g1 = ((_jj + _ns) / N_RAIOS0) * 360.0 + dg
    return ((GUERRA_RUMO - g0) % 360.0) <= ((g1 - g0) % 360.0 or 360.0)

def _janela_no_lago(_i, _nr, _jj, _ns):
    """a janela de células tem água dentro?

    ⚠️ TERCEIRA MÁSCARA QUE O ALOCADOR NÃO TINHA. Ele já pergunta pelo canal
    (`_janela`) e pela Cratera da Guerra (`_janela_pega_guerra`) e não perguntava
    pelo LAGO, que é a maior reserva do sítio: 23,3 km² dentro da casca. Medido
    na chapa de 30/08 e confirmado contra `cidade.json`: 11 de 96 peças com pelo
    menos um canto na água, 6 delas Fazendas de Proteína de 94 ha e uma (FZ01)
    com os cinco pontos submersos.

    ⚠️ E A AMOSTRAGEM É EM GRADE, NÃO NAS QUINAS. A célula da teia é um trapézio
    de até 4 anéis por 4 setores e o lago entra por dentro dela sem tocar canto
    nenhum: testar só as quinas aprovava janela com água no meio.
    """
    p0, p1 = _PHI_B[_i], _PHI_B[_i + _nr]
    for _kp in range(5):
        _ph = p0 + (p1 - p0) * _kp / 4.0
        for _kg in range(5):
            _g = ((_jj + _ns * _kg / 4.0) / N_RAIOS0) * 2*math.pi
            _r = raio_em_phi(_g, _ph)
            if em_lago(math.sin(_g)*_r, -math.cos(_g)*_r, 40.0): return True
    return False

def _pega_lago(rumo, r, meia_a, meia_b, margem=40.0):
    """a peça do cinturão (rumo, r, meia_a × meia_b) encosta na água?

    Mesma grade da janela da teia, pelo mesmo motivo: 94 ha de fazenda cabem
    inteiros dentro de um braço do lago sem que uma quina o toque.
    """
    _da = math.degrees(meia_a / max(1.0, r))
    for _u in (-1.0, -0.5, 0.0, 0.5, 1.0):
        _a = math.radians(rumo + _u * _da)
        for _v in (-1.0, -0.5, 0.0, 0.5, 1.0):
            _rr = r + _v * meia_b
            if em_lago(math.sin(_a)*_rr, -math.cos(_a)*_rr, margem): return True
    return False

_CINT_POSTAS = []          # (x, z, raio ocupado) do que já foi assentado

def assenta_no_cinturao(ru, ph, meia_a, meia_b, precisa_ar=False):
    """(rumo, raio) com a peça encostada num anel viário E num bulevar.

    A peça da teia tem rua na divisa POR CONSTRUÇÃO, porque ocupa célula inteira.
    A do cinturão era posta por rumo e φ livres e não tinha nada: 46 de 48 a mais
    de 200 m de qualquer via, com distâncias de até 3.142 m. Aqui ela ganha duas
    frentes — encosta num ANEL VIÁRIO por um lado e num BULEVAR pelo outro — e,
    se precisa de ar, fica dentro da casca.

    ⚠️ E REGISTRA O QUE JÁ FOI POSTO. A primeira versão não tinha ocupação e
    EMPILHOU peça: FZ01 e FZ03 saíram no mesmo ponto, LP17 e LP18 também. As
    vagas do cinturão são poucas (7 anéis × 2 lados × 9 bulevares × 2 lados), e
    sem registro duas peças escolhem a mesma por construção.
    """
    ang0 = math.radians(ru)
    r0 = raio_em_phi(ang0, ph)
    raios = []
    for _aid, _an, _ar, _al in ANEIS:
        if _ar < 4400: continue                      # os de dentro são do tecido
        for _sg in (1, -1):
            _r = _ar + _sg * (_al / 2 + meia_b + 25.0)
            if precisa_ar and _r + max(meia_a, meia_b) > R_CASCA - 100.0: continue
            raios.append((abs(_r - r0), _r))
    raios.sort()
    if not raios: raios = [(0.0, r0)]
    cands = []
    for _cr_, r in raios:
        meia_ang = math.degrees((meia_a + BULEVAR / 2 + 25.0) / max(1.0, r))
        dg = math.degrees((meia_a + CANAL_RAD_SEC / 2 + CANAL_TALUDE) / max(1.0, r))
        for _b in _BUL_RUMOS:
            for _sg in (1, -1):
                _c = (_b + _sg * meia_ang) % 360.0
                if any(abs(((_x - _c + 180) % 360) - 180) < dg for _x in CANAL_RADIAIS):
                    continue                         # canal radial cortaria a peça
                if _pega_lago(_c, r, meia_a, meia_b): continue
                _viagem = abs(((_c - ru + 180) % 360) - 180)
                # ⚠️ ACESSO À ÁGUA entra como desempate para quem precisa de ar.
                # No cinturão a via de carga é o canal: 94 ha de fazenda escoam
                # por barcaça, não por caminhão. Quem não precisa de ar (painel
                # solar, pátio de manobra) não paga essa penalidade.
                _dm = math.radians(min(abs(((_x - _c + 180) % 360) - 180)
                                       for _x in CANAL_RADIAIS)) * r - meia_a
                _pen = 0.0 if (not precisa_ar or _dm < 800.0) else 35.0
                cands.append((_cr_ / 40.0 + _viagem + _pen, _c, r))
    cands.sort()
    # ⚠️ A OCUPAÇÃO USA A DIAGONAL, NÃO O MAIOR LADO. Com `max(a, b)` o círculo
    # de uma peça 620×380 tinha raio 620 quando a diagonal é 727: subestimava em
    # 17% e deixava passar 14 sobreposições que o teste SAT depois acusava.
    meia = math.hypot(meia_a, meia_b)
    for _cst, _c, _r in cands:
        _a = math.radians(_c)
        _x, _z = math.sin(_a) * _r, -math.cos(_a) * _r
        if any(math.hypot(_x - px, _z - pz) < meia + pm + 40.0 for px, pz, pm in _CINT_POSTAS):
            continue
        _CINT_POSTAS.append((_x, _z, meia))
        return _c, _r
    # ⚠️ RESERVA: A VOLTA INTEIRA DO ANEL. Só as laterais de bulevar dão 2 vagas
    # por bulevar por anel, e com 48 peças no cinturão a oferta acaba antes da
    # demanda — 13 peças caíam de volta na posição original e se sobrepunham. Aqui
    # a peça anda pelo anel de meio em meio comprimento até achar espaço. Ela
    # perde a testada de bulevar, mas continua com a do ANEL VIÁRIO, que é a via
    # de carga, e é infinitamente melhor que nascer em cima de outra peça.
    for _cr_, r in raios:
        _passo_ = math.degrees((meia_a + 60.0) / max(1.0, r))
        _dg = math.degrees((meia_a + CANAL_RAD_SEC / 2 + CANAL_TALUDE) / max(1.0, r))
        _n = max(8, int(360.0 / max(0.5, _passo_)))
        for _k in range(_n):
            _c = (ru + _k * _passo_) % 360.0
            if any(abs(((_x - _c + 180) % 360) - 180) < _dg for _x in CANAL_RADIAIS):
                continue
            if _pega_lago(_c, r, meia_a, meia_b): continue
            _a = math.radians(_c)
            _x, _z = math.sin(_a) * r, -math.cos(_a) * r
            if any(math.hypot(_x - px, _z - pz) < meia + pm + 40.0 for px, pz, pm in _CINT_POSTAS):
                continue
            _CINT_POSTAS.append((_x, _z, meia))
            return _c, r
    # ⚠️ ÚLTIMA VARREDURA, E ELA EXISTE POR CAUSA DA ÁGUA. Antes do lago, cair de
    # volta na posição original era só perder testada; com 23,3 km² de água no
    # sítio, virou nascer submerso. Aqui a peça aceita qualquer ponto SECO de
    # qualquer anel do cinturão, de meio em meio grau, antes de desistir.
    for _cr_, r in raios:
        for _k in range(720):
            _c = (ru + _k * 0.5) % 360.0
            if _pega_lago(_c, r, meia_a, meia_b): continue
            _a = math.radians(_c)
            _x, _z = math.sin(_a) * r, -math.cos(_a) * r
            if any(math.hypot(_x - px, _z - pz) < meia + pm + 40.0 for px, pz, pm in _CINT_POSTAS):
                continue
            _CINT_POSTAS.append((_x, _z, meia))
            return _c, r
    # nem assim: fica onde estava, e o relato de acesso vai acusar
    _a = math.radians(ru)
    _CINT_POSTAS.append((math.sin(_a) * r0, -math.cos(_a) * r0, meia))
    return ru, r0

# ── A CRATERA DA GUERRA ────────────────────────────────────────────────────
#
# ⚠️ ELA NUNCA FOI MÁSCARA E SOBREVIVIA POR SORTE. A batalha de preços (o book de
# DOG/USD como campo, `app/city/war/battlefield.ts`) mora em (−2120, 2120) — r
# 2.998, rumo 225°, 287 m de diâmetro — e é um LUGAR do mundo, com enquadramento
# de câmera próprio. `livre()` mascarava canal, peça, anel, avenida, parque e
# Coliseu, e não ela: nenhum lote tinha caído lá porque nenhuma peça tinha caído
# lá, e só. Quando eu consertei o alocador em 30/08, o Parque Olímpico finalmente
# achou vaga — e a vaga era em cima da cratera, 294 m do centro com 1.051 m de
# largura. O fundador perguntou "a batalha foi parar aonde?" e era isso.
GUERRA_CX, GUERRA_CZ = -2120.0, 2120.0
GUERRA_PHI = None                  # calculado sob demanda: phi() já existe aqui
GUERRA_RUMO = 225.0
# 143,5 m é a cratera; o resto é o pátio de quem assiste, medido no enquadramento
# da câmera de guerra (ela fecha a 333 m do centro).
GUERRA_R = 340.0

def em_guerra(x, z, margem=0.0):
    return math.hypot(x - GUERRA_CX, z - GUERRA_CZ) < GUERRA_R + margem

def em_vao(ianel, rumo):
    """o canal `ianel` está interrompido naquele rumo?"""
    for a0, a1 in CANAL_VAOS[ianel]:
        if ((rumo - a0) % 360.0) <= ((a1 - a0) % 360.0): return True
    return False

def vao_cobre(ianel, g0, g1):
    """o vão cobre o ARCO INTEIRO [g0, g1], e não só o meio dele?

    ⚠️ JULGAR PELO PONTO MÉDIO NÃO BASTA. A Boca da Autopista 3 ocupava a célula
    de rumo 174,375 a 180,0 e o vão do CA05 vai de 174,0 a 180,0: o meio caía
    dentro, então o alocador dava o canal por morto ali e recuava só os 6 m da
    rua comum — mas a PONTA da peça, em 180,0, é justamente onde o vão acaba e o
    canal recomeça. Sobrava 4,60 m de vala na quina. Um canal só está morto para
    a peça se o vão cobre ela inteira, com a folga do corredor nas duas pontas.
    """
    for a0, a1 in CANAL_VAOS[ianel]:
        w = (a1 - a0) % 360.0
        d0, d1 = (g0 - a0) % 360.0, (g1 - a0) % 360.0
        if d0 <= w and d1 <= w and d1 >= d0: return True
    return False

print('canais encostados no anel: ' + ', '.join(f'{a:.0f}->{b:.0f}'
      for a, b in zip(CANAL_ANEIS_ALVO, CANAL_ANEIS)), file=sys.stderr)
# ⚠️ GUARDA DURA: canal e avenida NÃO podem partilhar rumo. Sem isto o erro volta
# em silêncio, porque água desenhada por cima de via não gera erro nenhum: a
# cidade só fica sem as avenidas que recebem as pontes.
for _cr in CANAL_RADIAIS:
    for _av in list(AVENIDAS_RADIAIS) + [d[0] for d in DISTRITOS]:
        _dd = abs(((_cr - _av + 180) % 360) - 180)
        assert _dd > 3.0, (f'canal no rumo {_cr} coincide com avenida no rumo {_av}: '
                           f'a lâmina de {CANAL_RAD_SEC:.0f} m afogaria a via')

# ⚠️ O ANEL DE CANAL SE MEDE EM RAIO, NÃO EM φ. Esta função comparava
# `abs(phi(x,z) - an)` com uma largura em METROS, e φ é um potencial: dφ/dr vai
# de 0,75 a 1,26 pelo sítio, então a máscara de 56 m valia de 44,4 a 75,1 m de
# raio real. Onde ela encolhia, o lote nascia DENTRO da lâmina — 3.560 lotes com
# o centro na água, medidos no binário publicado. `terrain.ts` cava por raio
# contra o contorno publicado, então medir por raio aqui é o que faz as duas
# pontas concordarem por construção, em vez de por coincidência.
_CANAL_NB = 720
_CANAL_TAB = None
def _canal_tabela():
    """raio de cada anel de canal, por rumo. Construída uma vez."""
    global _CANAL_TAB
    if _CANAL_TAB is None:
        _CANAL_TAB = [[raio_em_phi((k / _CANAL_NB) * 2*math.pi, an) for k in range(_CANAL_NB)]
                      for an in CANAL_ANEIS]
    return _CANAL_TAB

def em_canal(x, z, margem=0.0):
    r = math.hypot(x, z)
    if r < R_INICIO: return False
    ang = math.atan2(x, -z) % (2*math.pi)          # mesmo quadro de rumo_de
    t = (ang / (2*math.pi)) * _CANAL_NB
    i = int(t) % _CANAL_NB; f = t - int(t); j = (i + 1) % _CANAL_NB
    for k, tab in enumerate(_canal_tabela()):
        rn = tab[i] * (1 - f) + tab[j] * f
        if abs(r - rn) < CANAL_ANEL_SEC/2 + margem and not em_vao(k, math.degrees(ang)):
            return True
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
# ⚠️ COTA ABSOLUTA É ERRADA PARA TÚNEL, e isto foi medido em 30/08. O sítio
# ondula de −90 a +160 m; com o túnel numa cota fixa de −42, o chão passa POR
# BAIXO dele onde o terreno afunda e o túnel aflora. Medido nas três autopistas:
# AU1 com 34 de 161 amostras com menos de 10 m de cobertura (chão a −48), AU2 com
# 46 de 161 (chão a −51). Túnel de verdade se mede ABAIXO DA SUPERFÍCIE, e é isso
# que `AUTO_PROF` publica: a cena assenta o teto em `superficieAt(x,z) − prof`.
# `AUTO_COTA` fica como referência do datum, para quem ainda lê o campo antigo.
AUTO_COTA = -42.0     # ⚠️ LEGADO: use AUTO_PROF
AUTO_PROF = 35.0      # metros de cobertura sob a superfície, em qualquer ponto

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
# ⚠️ O GRADIENTE BRIGA COM O NÚMERO QUE A LANDING JÁ PUBLICOU. Ele dá à borda
# 2,7x a área por DOG do centro, e a curva do snapshot (`area = 0,986·√DOG`, que
# a consulta por carteira mostra desde a Dobra 1) não tem gradiente nenhum.
# Medido em 20/09 com gradiente 1,0: a mediana entrega 1,08x o prometido, mas o
# p10 entrega 0,58 e o p90 entrega 2,43, ou seja quem está no centro recebe
# METADE do que leu na tela e quem está na borda recebe o dobro.
# `GRAD=0` iguala a forma da curva à publicada: aí a diferença vira UM fator
# único para todo mundo, que é o que dá para explicar e para corrigir com terra.
GRADIENTE = float(os.environ.get('GRAD', 0.0))   # 🔒 20/09: a régua é a da landing
TECIDO_ALVO = 16.33e6  # m² da metade do holder
LOTE_MIN_FRENTE = 5.0  # nenhum lote fica mais estreito que isto
# ⚠️ O PISO É O MENOR LOTE DA CIDADE, e desde 20/09 ele decide QUEM TEM LOTE:
# quem não alcança o piso na curva publicada vai para o columbário (§17). Por
# isso ele mora aqui em cima, junto dos parâmetros, e não lá embaixo junto da
# curva: a fila é montada antes da curva existir. Sem piso a raiz produz risco e
# não lote: medido na rodada sem piso, 2.176 lotes com área ZERO e p25 em 18 m².
# 24 m² é 5 x 4,8, a banca da tipologia Galeria.
PISO_LOTE = 24.0
# ⚠️ o teto do muro de divisa: acima disto a fileira quebra em bancada (§15)
SOCALCO_TETO = 3.0
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

# ═══════════════════════════════════════════════════════════════════════════
# O EXAGERO VERTICAL, E POR QUE ELE PRECISOU VIR PARA CÁ (03/09/2026)
#
# ⚠️ A CENA NÃO DESENHA O HEIGHTMAP CRU. `app/city/plaza/vex.ts` aplica um
# exagero vertical RADIAL: 1 dentro de r 4.500 (a cidade é plana como o mare de
# verdade) subindo por smoothstep até 2 em r 7.000 (o horizonte é dramatizado).
# Este gerador não aplicava nenhum, e por isso plantava lote num terreno até
# DUAS VEZES mais raso do que o que a câmera mostra.
#
# ⚠️ E ISTO É A SEGUNDA VEZ QUE A MESMA DERIVA ACONTECE. O cabeçalho do próprio
# `vex.ts` registra a primeira: a prancha de fundação (`app/city/plan`) tinha um
# `const VEX = 2` cravado e "continuou medindo um terreno duas vezes mais íngreme
# do que o que a cidade desenha, e ninguém percebeu porque os dois números eram
# plausíveis". Foi exatamente o que aconteceu aqui, do outro lado.
#
# O que a divergência custava, medido em 03/09 contra a superfície como
# construída (extraída da cena por `scripts/city/topo.mjs`, grade 1.400²):
#
#   em r 6.200          o cru diz −54 m e a cena desenha −94 m
#   lotes afogados      484 com o centro sob a lâmina de −40; 411 deles (85%)
#                       só afundam por causa do exagero
#   quarteirões         44 com o centro a mais de 2 m sob a lâmina, agrupados
#                       no leste em r 5.500 a 5.860
#   declive             o limite aqui é 4°, e na superfície da cena 12,5% dos
#                       lotes ficavam acima disso, o pior em 23,5°
#   água no tecido      a cena desenha 24,36 km², este gerador media 22,11
#
# ⚠️ PYTHON NÃO IMPORTA TypeScript, então estes quatro números são CÓPIA, que é
# a mesma doença que causou o problema. O antídoto é medição, não disciplina:
# `scripts/city/conferir_terreno.py` compara `altura()` daqui com a superfície
# que a cena publica e reprova se elas divergirem. Rode-o sempre que mexer em
# `vex.ts`, em `terrain.ts` ou aqui.
VEX_CIDADE, VEX_HORIZONTE = 1.0, 2.0
VEX_R_CIDADE, VEX_R_HORIZONTE = 4500.0, 7000.0

def exagero_em(r):
    """o mesmo `exageroEm(r)` de app/city/plaza/vex.ts"""
    if r <= VEX_R_CIDADE: return VEX_CIDADE
    if r >= VEX_R_HORIZONTE: return VEX_HORIZONTE
    t = (r - VEX_R_CIDADE) / (VEX_R_HORIZONTE - VEX_R_CIDADE)
    return VEX_CIDADE + (VEX_HORIZONTE - VEX_CIDADE) * (t*t*(3-2*t))

def crua(x, z):
    # ⚠️ O EXAGERO ENTRA DEPOIS DA INTERPOLAÇÃO, e a ordem é a mesma de `rawAt`
    # em terrain.ts, pelo motivo que está anotado lá: interpolar alturas já
    # exageradas com fatores diferentes nos quatro cantos criaria degrau na borda
    # de célula. Interpola o relevo cru, depois escala pelo raio.
    fi = min(n-1.001, max(0, x/cell+half)); fj = min(n-1.001, max(0, z/cell+half))
    i, j = int(fi), int(fj); u, v = fi-i, fj-j
    b = H(i,j)*(1-u)*(1-v) + H(i+1,j)*u*(1-v) + H(i,j+1)*(1-u)*v + H(i+1,j+1)*u*v
    return b * exagero_em(math.hypot(x, z))

# ── O PÓDIO DA ABÓBADA, que este gerador também não conhecia ────────────────
#
# ⚠️ ACHADO MEDINDO O CONSERTO DO EXAGERO, e é o segundo terreno que a cena tem
# e o gerador não. A borda da casca assenta numa cota só, então `terrain.ts`
# NIVELA o chão num pódio de `PODIO_Y` = 13 m entre r 6.150 e 8.300 (plano de
# 6.950 a 7.150, rampa nas duas pontas). O tecido acaba em 6.900, ou seja os
# últimos 750 m de cidade ficam EM CIMA dessa rampa.
#
# ⚠️ E OS DOIS ERROS SE CANCELAVAM, QUE É POR QUE NINGUÉM VIU. Sem exagero o
# gerador media o chão mais RASO; sem pódio, media mais BAIXO. Na faixa de 6.150
# a 6.900 os dois se anulavam parcialmente e o número saía plausível. Corrigir só
# o exagero descobriu o outro: a primeira rodada com exagero e sem pódio achou
# 74,7 km² de água (contra 24,4 antes e ~24 que a cena desenha) e um "lago" de
# 71,7 km², porque afogou a coroa inteira que o pódio levanta.
#
# Medido por faixa de raio, |cena − gerador| na mediana, antes do pódio entrar:
#   1.500–6.150   0,11 a 0,19 m   (o exagero já tinha fechado esta parte)
#   6.150–6.900        36,23 m    (água: 21,2% na cena contra 42,1% aqui)
#   6.900–7.150       124,84 m    (água: 0,0% na cena contra 43,2% aqui)
#
# Os números vêm de `PODIO_*` em app/city/plaza/dome.ts e da mistura angular de
# `podioR3Em` em terrain.ts. São CÓPIA, como o exagero: quem confere é
# `scripts/city/conferir_terreno.py`.
PODIO_Y = 13.0
PODIO_R0, PODIO_R1, PODIO_R2 = 6150.0, 6950.0, 7150.0
PODIO_R3, PODIO_R3_PARQUE = 8300.0, 7550.0

# ⚠️ O CENTRO DO PARQUE SOBE PARA CÁ porque `_podio_r3` precisa dele, e o pódio
# é lido por `altura()`, que `_acha_lagos` chama no nível do módulo. Ficava 160
# linhas abaixo e daria NameError no import.
prad = math.radians(PARQUE_RUMO)
PCX, PCZ = math.sin(prad)*PARQUE_DIST, -math.cos(prad)*PARQUE_DIST

def _podio_r3(x, z):
    """o fade externo encurta no rumo do parque: ali começa a cova do Runestone"""
    nl = math.hypot(x, z)
    if nl < 1e-6: return PODIO_R3
    cos = (x*PCX + z*PCZ) / (nl * math.hypot(PCX, PCZ))
    C1, C0 = math.cos(math.radians(42)), math.cos(math.radians(78))
    t = min(1.0, max(0.0, (cos - C0) / (C1 - C0)))
    return PODIO_R3 + (PODIO_R3_PARQUE - PODIO_R3) * (t*t*(3-2*t))

def podio_peso(x, z):
    r = math.hypot(x, z)
    if r <= PODIO_R0: return 0.0
    R3 = _podio_r3(x, z)
    if r >= R3: return 0.0
    if PODIO_R1 <= r <= PODIO_R2: return 1.0
    t = (r-PODIO_R0)/(PODIO_R1-PODIO_R0) if r < PODIO_R1 else (R3-r)/(R3-PODIO_R2)
    return t*t*(3-2*t)

# ═══════════════════════════════════════════════════════════════════════════
# O ESCULPIDO DA ALÇA, REPLICADO AQUI PORQUE O GERADOR PRECISA VER O MESMO CHÃO
#
# ⚠️ DEFEITO MEDIDO EM 21/09, E ELE É DE 43 METROS. A cena esculpe a alça numa
# plataforma plana em -30 m (`alcaAlturaAt` em `alca.ts`), e o `altura()` daqui
# só aplicava platô e pódio: os 511 lotes da Orla Nobre saíram gravados com
# cota 13 m, que é a do pódio, contra os -30 que a cena desenha. É a mesma
# classe do erro de 42 m que o spaceport já teve, e no endereço mais valioso
# da cidade.
#
# A doutrina da casa manda LER a cena em vez de copiar, e as constantes são
# lidas mesmo (ALCA_R_BAIA, ALCA_R_MAR, ALCA_PRAIA, o arco). O que não dá para
# ler é a FORMA da função, então ela é replicada aqui com o mesmo desenho:
# plataforma no meio, praia 1:8 de cada lado, rampa espelhada na escavação e
# franja nas duas pontas do arco, medida em metros de arco e não em graus.
ALCA_PLATAFORMA_Y = _ts_const('alca.ts', 'ALCA_PLATAFORMA_Y')
ALCA_AGUA_Y       = _ts_const('alca.ts', 'ALCA_AGUA')
ALCA_LEITO_Y      = ALCA_AGUA_Y - 4        # `ALCA_LEITO_Y = ALCA_AGUA - 4` em alca.ts
ALCA_FRANJA       = _ts_const('alca.ts', 'ALCA_FRANJA_PONTAS')
_ALCA_GATE_DENTRO, _ALCA_GATE_FORA = 5700.0, 7900.0
_ALCA_LARGURA_ARCO = ((ALCA_TERRA_ARCO[1] - ALCA_TERRA_ARCO[0]) + 360) % 360

def _alca_dist_borda(ang_graus):
    g = ((ang_graus % 360) + 360) % 360
    pos = ((g - ALCA_TERRA_ARCO[0]) + 360) % 360
    if pos <= _ALCA_LARGURA_ARCO: return min(pos, _ALCA_LARGURA_ARCO - pos)
    return -min(pos - _ALCA_LARGURA_ARCO, 360 - pos)

def alca_altura(x, z, natural):
    r = math.hypot(x, z)
    if r <= _ALCA_GATE_DENTRO or r >= _ALCA_GATE_FORA: return natural
    ang = math.degrees(math.atan2(x, -z)) % 360
    if _alca_dist_borda(ang) < 0: return natural
    dist = min(r - ALCA_R_BAIA, ALCA_R_MAR - r)
    if dist >= ALCA_PRAIA:
        alvo = ALCA_PLATAFORMA_Y
    elif dist >= 0:
        alvo = ALCA_AGUA_Y + (ALCA_PLATAFORMA_Y - ALCA_AGUA_Y) * (dist / ALCA_PRAIA)
    elif dist >= -ALCA_PRAIA:
        alvo = ALCA_AGUA_Y + (ALCA_LEITO_Y - ALCA_AGUA_Y) * (-dist / ALCA_PRAIA)
    else:
        alvo = ALCA_LEITO_Y
    _m = _alca_dist_borda(ang) * (math.pi / 180) * r
    k = 1.0 if _m >= ALCA_FRANJA else (lambda t: t*t*(3-2*t))(_m / ALCA_FRANJA)
    return natural * (1 - k) + alvo * k


# ═══════════════════════════════════════════════════════════════════════════
# A ORLA DA BAÍA, REPLICADA AQUI PELO MESMO MOTIVO QUE A ALÇA
#
# ⚠️ A LIÇÃO DO §21 DO masterplan É EXATAMENTE ESTA: em 21/09 a Orla Nobre saiu
# com cota errada por 43 m porque o gerador não sabia que a cena esculpia a
# alça. O conferidor não pegou porque amostrava só onde já havia lote, e ali
# não havia. Então a orla da baía nasce com o espelho no mesmo commit em que
# nasce o chão — nunca depois.
#
# Tudo o que é NÚMERO é lido de `orla-baia.ts`. O que não dá para ler é a FORMA
# da função, e ela é replicada abaixo zona por zona, na mesma ordem: linha
# d'água (com a enseada), união com os dedos por máximo da distância assinada,
# perfil radial (plataforma, praia, rampa espelhada, saia), canais cavando a
# plataforma, saia para dentro e franja das pontas do arco.
OB_ARCO      = _ts_const('orla-baia.ts', 'ORLA_BAIA_ARCO')
OB_ENSEADA   = _ts_const('orla-baia.ts', 'ORLA_BAIA_ENSEADA')
OB_R_AGUA    = _ts_const('orla-baia.ts', 'ORLA_BAIA_R_AGUA')
OB_R_ENSEADA = _ts_const('orla-baia.ts', 'ORLA_BAIA_R_ENSEADA')
OB_PRAIA     = _ts_const('orla-baia.ts', 'ORLA_BAIA_PRAIA')
OB_R_FRENTE  = OB_R_AGUA - OB_PRAIA
OB_R_FUNDO   = _ts_const('orla-baia.ts', 'ORLA_BAIA_R_FUNDO')
OB_PROF      = _ts_const('orla-baia.ts', 'ORLA_BAIA_FILEIRA_PROF')
OB_DEDO_LARG = _ts_const('orla-baia.ts', 'ORLA_BAIA_DEDO_LARGURA')
OB_DEDO_PONTA= _ts_const('orla-baia.ts', 'ORLA_BAIA_DEDO_PONTA')
OB_DEDO_CAIS = _ts_const('orla-baia.ts', 'ORLA_BAIA_DEDO_CAIS')
OB_CAIS_TALUDE = _ts_const('orla-baia.ts', 'ORLA_BAIA_CAIS_TALUDE')
OB_TESTADA_MIN = _ts_const('orla-baia.ts', 'ORLA_BAIA_TESTADA_MIN')
OB_RECUO     = _ts_const('orla-baia.ts', 'ORLA_BAIA_RECUO_FUNDO')
OB_CANAL_FUNDO = _ts_const('orla-baia.ts', 'ORLA_BAIA_CANAL_FUNDO')
OB_CANAL_TALUDE= _ts_const('orla-baia.ts', 'ORLA_BAIA_CANAL_TALUDE')
OB_FRANJA    = _ts_const('orla-baia.ts', 'ORLA_BAIA_FRANJA')
OB_SAIA      = _ts_const('orla-baia.ts', 'ORLA_BAIA_SAIA')
OB_DEDOS     = _ts_lista('orla-baia.ts', 'ORLA_BAIA_DEDO_RUMOS')
OB_CANAIS    = _ts_lista('orla-baia.ts', 'ORLA_BAIA_CANAL_EIXOS')
OB_FILEIRAS  = _ts_fileiras('orla-baia.ts', 'ORLA_BAIA_FILEIRAS')
OB_ILHAS     = _ts_ilhas('orla-baia.ts', 'ORLA_BAIA_ILHAS')
OB_PLATAFORMA_Y = ALCA_PLATAFORMA_Y     # `= ALCA_PLATAFORMA_Y` em orla-baia.ts
OB_AGUA_Y       = ALCA_AGUA_Y           # `= ALCA_AGUA` em orla-baia.ts
OB_LEITO_Y      = ALCA_AGUA_Y - 4       # `= ALCA_AGUA - 4` em orla-baia.ts
_OB_GATE_DENTRO, _OB_GATE_FORA = 3400.0, 6600.0

def ob_linha_dagua(ang):
    e0, e1 = OB_ENSEADA
    if ang <= e0 or ang >= e1: return OB_R_AGUA
    t = (ang - e0) / (e1 - e0)
    return OB_R_AGUA - (OB_R_AGUA - OB_R_ENSEADA) * math.sin(math.pi * t)

def ob_dist_costa(r, ang):
    return ob_linha_dagua(ang) - r

def ob_dist_dedo(r, ang):
    d = -1e9
    for rumo in OB_DEDOS:
        g = ang - rumo
        if g > 180: g -= 360
        if g < -180: g += 360
        if abs(g) > 20: continue
        perp = abs(math.sin(math.radians(g))) * r
        d = max(d, min(OB_DEDO_LARG / 2 - perp, OB_DEDO_PONTA - r))
    return d

def _ob_perfil_beira(d, L):
    if d >= L: return OB_PLATAFORMA_Y
    if d >= 0: return OB_AGUA_Y + (OB_PLATAFORMA_Y - OB_AGUA_Y) * (d / L)
    if d >= -L: return OB_AGUA_Y + (OB_LEITO_Y - OB_AGUA_Y) * (-d / L)
    return OB_LEITO_Y

def na_ilha_da_baia(x, z):
    """está dentro (ou na margem de 60 m) de uma das ilhas declaradas da baía?"""
    for ix, iz, giro, tab in OB_ILHAS:
        dx, dz = x - ix, z - iz
        d2 = dx*dx + dz*dz
        if d2 > 1600*1600: continue
        g = math.radians(giro)
        cg, sg = math.cos(g), math.sin(g)
        sx, sz = dx*cg + dz*sg, -dx*sg + dz*cg
        th = math.atan2(sz, sx) % (2*math.pi)
        b = min(len(tab) - 1, int(th / (2*math.pi) * len(tab)))
        if math.sqrt(d2) <= tab[b]: return True
    return False

def _ob_canal_cota(r):
    meia_agua = OB_CANAL_FUNDO / 2
    meia_tudo = meia_agua + OB_CANAL_TALUDE
    for eixo in OB_CANAIS:
        dd = abs(r - eixo)
        if dd >= meia_tudo: continue
        if dd <= meia_agua: return OB_LEITO_Y
        return OB_LEITO_Y + (OB_PLATAFORMA_Y - OB_LEITO_Y) * ((dd - meia_agua) / OB_CANAL_TALUDE)
    return None

def orla_baia_altura(x, z, natural):
    r = math.hypot(x, z)
    if r <= _OB_GATE_DENTRO or r >= _OB_GATE_FORA: return natural
    ang = math.degrees(math.atan2(x, -z)) % 360
    a0, a1 = OB_ARCO
    graus_franja = (OB_FRANJA * 180) / (math.pi * r)
    if ang < a0 - graus_franja or ang > a1 + graus_franja: return natural
    d_costa = ob_dist_costa(r, ang)
    d_dedo = ob_dist_dedo(r, ang)
    dist = max(d_costa, d_dedo)
    alvo = max(_ob_perfil_beira(d_costa, OB_PRAIA),
               _ob_perfil_beira(d_dedo, OB_CAIS_TALUDE))
    if dist >= OB_PRAIA:
        canal = _ob_canal_cota(r)
        if canal is not None: alvo = min(alvo, canal)
    elif dist < -OB_PRAIA:
        alvo = min(natural, OB_LEITO_Y)
    r_interno = min(OB_R_FUNDO, ob_linha_dagua(ang) - OB_PRAIA)
    if r < r_interno:
        k = (lambda t: t*t*(3-2*t))(min(1.0, (r_interno - r) / OB_SAIA))
        alvo = alvo * (1 - k) + natural * k
    m = min(ang - a0, a1 - ang) * (math.pi / 180) * r
    k = 1.0 if m >= OB_FRANJA else (lambda t: t*t*(3-2*t))(max(0.0, m) / OB_FRANJA)
    return natural * (1 - k) + alvo * k


# ── A BACIA DO LAGO DA PRAÇA E A SUBIDA DA CIDADE ──────────────────────────
#
# ⚠️ ISTO FALTAVA INTEIRO NO GERADOR, e é o irmão do defeito do platô, achado na
# mesma varredura. A cena monta o chão como `baseAt − bacia + monte`
# (`terrain.ts`, `bbAt`); o gerador fazia só platô, pódio, alça e orla. A bacia
# cava 35 m na praça, 47,5 m no fundo do lago, e a cidade só volta a ficar seca e
# plana em `R_CIDADE_SECA`, a 2.344 m do centro. Sem ela, todo lote do miolo
# nascia com a cota do relevo cru num lugar onde a cena desenha rampa.
#
# ⚠️ TODA CONSTANTE DAQUI É LIDA DE `terrain.ts`. Nenhuma é copiada, pela mesma
# razão do platô logo acima: a cópia diverge, e a divergência é silenciosa porque
# o número continua plausível. `R_AGUA_OUT` e `R_CIDADE_SECA` são derivadas na
# cena por soma (`LAGO_R1 + 40` e `R_AGUA_OUT + 950`) e por isso se derivam aqui
# do mesmo jeito, a partir do valor lido.
PRACA_Y_CENA  = _ts_const('terrain.ts', 'PRACA_Y')          # −35
R_PRACA_BORDA = _ts_const('terrain.ts', 'R_PRACA_BORDA')    # 1.024
R_AGUA_IN     = _ts_const('terrain.ts', 'R_AGUA_IN')        # 1.144
LAGO_R0       = _ts_const('terrain.ts', 'LAGO_R0')          # 1.184
LAGO_R1       = _ts_const('terrain.ts', 'LAGO_R1')          # 1.354
LAGO_FUNDO    = _ts_const('terrain.ts', 'LAGO_FUNDO')       # 47,5
R_AGUA_OUT    = LAGO_R1 + 40.0                              # simétrico ao mergulho interno
R_CIDADE_SECA = R_AGUA_OUT + 950.0                          # a subida da cidade, 40 m a 4,14%


def _reta(d, d0, h0, d1, h1):
    """reta grampeada, a mesma de `terrain.ts`: inclinação CONSTANTE e trava fora
    do intervalo. Reta e não curva de propósito: o smoothstep acelerava no meio e
    escondia a linha d'água em cima do trecho mais íngreme."""
    t = (d - d0) / (d1 - d0)
    if t <= 0: return h0
    if t >= 1: return h1
    return h0 + (h1 - h0) * t


def bacia_praca(r):
    """quanto o chão DESCE neste raio por causa da bacia da praça. Espelho exato
    de `bacia()` em `terrain.ts`, na mesma ordem de faixas."""
    if r <= R_PRACA_BORDA: return -PRACA_Y_CENA                                   # a praça inteira, plana
    if r <= R_AGUA_IN:     return _reta(r, R_PRACA_BORDA, -PRACA_Y_CENA, R_AGUA_IN, 40.0)
    if r <= LAGO_R0:       return _reta(r, R_AGUA_IN, 40.0, LAGO_R0, LAGO_FUNDO)  # o mergulho
    if r <= LAGO_R1:       return LAGO_FUNDO                                      # fundo plano
    if r <= R_AGUA_OUT:    return _reta(r, LAGO_R1, LAGO_FUNDO, R_AGUA_OUT, 40.0)
    if r <= R_CIDADE_SECA: return _reta(r, R_AGUA_OUT, 40.0, R_CIDADE_SECA, 0.0)  # a subida da cidade
    return 0.0


def _altura_analitica(x, z):
    b = crua(x, z); r = math.hypot(x, z)
    if r < PLATO_FUNDE:
        if r <= PLATO_R: b = 0.0
        else:
            t = (r-PLATO_R)/(PLATO_FUNDE-PLATO_R)
            b = b*(t*t*(3-2*t))
    # ⚠️ A BACIA ENTRA AQUI, DEPOIS DO PLATÔ E ANTES DO PÓDIO, porque é essa a
    # ordem da cena: `bbAt = baseAt − bacia + monte`, e `baseAt` já traz o platô
    # dentro. Trocar a ordem com o pódio mudaria a cota de todo o anel do platô.
    b -= bacia_praca(r)
    # ⚠️ O PÓDIO ENTRA POR MISTURA, não por soma: `terrain.ts` interpola o chão
    # ATÉ a cota do pódio pelo peso (`b0*(1-w) + PODIO_Y*w`), então no platô o
    # chão É 13 m, não "13 m acima do que havia". Somar deixaria o relevo cru
    # embaixo e a coroa continuaria ondulando 232 m.
    w = podio_peso(x, z)
    # ⚠️ A ORLA DA BAÍA POR FORA DA ALÇA, na MESMA ordem de `terrain.ts`: a
    # alça cava o leito a -44 em todo o arco dela, que contém o da orla, e
    # rodando primeiro apagaria as pontas dos dedos.
    return orla_baia_altura(x, z, alca_altura(x, z, b*(1.0-w) + PODIO_Y*w))


# ═══════════════════════════════════════════════════════════════════════════
# A SUPERFÍCIE COMO CONSTRUÍDA: O GERADOR PERGUNTA À CENA EM VEZ DE ADIVINHAR
#
# ⚠️ ESTA É A CORREÇÃO DE 22/09/2026, E ELA É ESTRUTURAL, NÃO UM NÚMERO.
#
# `_altura_analitica` logo acima é uma RÉPLICA em Python do `heightAt` da cena, e
# réplica de chão neste projeto SEMPRE divergiu. O histórico está escrito nos
# próprios comentários deste arquivo: o exagero vertical do `vex.ts` (03/09), o
# pódio da abóbada (03/09), e agora o platô (930 m de diferença por dezenove
# dias), a bacia do Lago da Praça e a vala dos canais radiais, que nunca
# existiram deste lado.
#
# ⚠️ O QUE A DIVERGÊNCIA CUSTAVA, MEDIDO PONTO A PONTO CONTRA A CENA em 22/09,
# sobre os 70.720 lotes do registro selado:
#
#     |erro| mediana ......  0,63 m
#     acima de 1,5 m ......  15.834 lotes (22,4%)
#     acima de  10 m ......   4.474
#     acima de  30 m ......   1.647
#     pior caso ...........  56,72 m (S04-Q05-B004-L001: a escritura afirmava
#                            +42,21 m onde a cidade desenha −14,51 m)
#     chão da cena abaixo
#     da lâmina d'água ....  73 lotes
#
# E `cota_cm` ENTRA NA FOLHA DO MERKLE. Ou seja isto nunca foi defeito de
# desenho: era defeito de TÍTULO, assinado pelo root.
#
# ⚠️ E A TENTAÇÃO ERRADA ERA PORTAR A FÓRMULA DE NOVO. Seria a quarta cópia
# (cena, aqui, `conferir_terreno.py`, e a nova), e as três primeiras divergiram.
# `superficieAt` é a MESMA função que assenta lote, rua, praia e peça na cena: é
# a única fonte que não diverge do que a câmera mostra. `scripts/city/
# assar_superficie.mjs` extrai ela pela sonda `__plazaPerfil` e grava aqui.
#
# ⚠️ E O ARQUIVO NÃO PODE ENVELHECER EM SILÊNCIO, que é como o platô divergiu.
# A assadura grava o sha256 de todo módulo que entra em `heightAt`; este leitor
# recalcula e ABORTA se divergir. Não existe modo "continua assim mesmo": selar
# uma cidade contra um chão que mudou é exatamente o defeito que isto conserta.
_SUP = None

def _carrega_superficie():
    """a grade assada da cena, ou None se não houver (e aí o gerador aborta)."""
    global _SUP
    import hashlib
    # ⚠️ §42: `SUPERFICIE_DIR` lê o chão assado no PALCO da rodada (fora do git);
    # sem ele, o de sempre em data/.
    _sd = os.environ.get('SUPERFICIE_DIR')
    meta_p = os.path.join(_sd, 'superficie.json') if _sd else p('data/superficie.json')
    f32_p = os.path.join(_sd, 'superficie.f32') if _sd else p('data/superficie.f32')
    if not (os.path.exists(meta_p) and os.path.exists(f32_p)):
        return None
    meta = json.load(open(meta_p, encoding='utf-8'))
    h = hashlib.sha256()
    for m in meta.get('modulos', []):
        try: txt = open(p_ts(m), encoding='utf-8').read()
        except FileNotFoundError: txt = '(ausente)'
        h.update(m.encode()); h.update(b'\0'); h.update(txt.encode()); h.update(b'\0')
    agora = h.hexdigest()
    if agora != meta.get('digitalDoChao'):
        raise SystemExit(
            'gerar_cidade: a superfície assada está VELHA.\n'
            f'  assada com  {meta.get("digitalDoChao", "?")[:16]}...\n'
            f'  o chão hoje {agora[:16]}...\n'
            '  Um dos módulos de chão mudou depois da assadura. Reasse antes de gerar:\n'
            '      node scripts/city/assar_superficie.mjs\n'
            '  (dev server no ar em localhost:3000). NÃO existe modo de seguir assim:\n'
            '  foi assim que 15.834 lotes nasceram com a cota errada em 22/09.')
    import array
    a = array.array('f'); a.fromfile(open(f32_p, 'rb'), meta['n'] * meta['n'])
    _SUP = (meta['n'], float(meta['raio']), float(meta['celulaM']), a)
    return _SUP


def altura(x, z):
    """a cota do chão neste ponto. A CENA MANDA: se a superfície assada existe,
    ela é a resposta; a réplica analítica só serve de socorro explícito."""
    if _SUP is not None:
        sn, sraio, sc, sa = _SUP
        fi = (x + sraio) / sc; fj = (z + sraio) / sc
        if 0 <= fi <= sn - 1.001 and 0 <= fj <= sn - 1.001:
            i, j = int(fi), int(fj); u, v = fi - i, fj - j
            G = lambda a_, b_: sa[b_ * sn + a_]
            return (G(i, j)*(1-u)*(1-v) + G(i+1, j)*u*(1-v)
                    + G(i, j+1)*(1-u)*v + G(i+1, j+1)*u*v)
    return _altura_analitica(x, z)


# ⚠️ CARREGA AGORA, ANTES DA GRADE DE DECLIVE, porque é ela a primeira
# consumidora. E aborta aqui, no começo, em vez de deixar a cidade inteira nascer
# sobre o chão errado e só descobrir no portão.
# ⚠️ E ELE TEM DE PODER SER DESLIGADO POR QUEM SÓ QUER A ESCULTURA.
# `scripts/city/conferir_terreno.py` não importa este arquivo: ele lê o FONTE e
# executa a fatia que vai até `def altura(x, z):`, justamente para não ter uma
# terceira cópia das fórmulas. Se o aborto abaixo disparar dentro dele, o
# conferidor morre sem conferir nada, que é trocar um silêncio por outro.
# `SUPERFICIE_OPCIONAL=1` diz "eu só quero as funções, não vou plantar cidade".
if os.environ.get('SUPERFICIE_OPCIONAL') == '1':
    try: _carrega_superficie()
    except SystemExit: _SUP = None
elif os.environ.get('SEM_SUPERFICIE') == '1':
    print('⚠️  SEM_SUPERFICIE=1: plantando sobre a RÉPLICA analítica, não sobre a cena.\n'
          '    Isto serve para experimento, NUNCA para a rodada que vai ser selada.')
elif _carrega_superficie() is None:
    raise SystemExit(
        'gerar_cidade: falta a superfície assada da cena (data/superficie.f32).\n'
        '  O gerador não replica mais o chão: ele pergunta à cena, porque a\n'
        '  réplica divergiu em 22,4% dos lotes, até 56,7 m, e a cota entra na\n'
        '  folha do merkle. Asse antes de gerar, com o dev server no ar:\n'
        '      node scripts/city/assar_superficie.mjs\n'
        '  Para experimentar sem ela (e NUNCA para selar): SEM_SUPERFICIE=1.')
else:
    print(f'superfície da cena: grade {_SUP[0]}² sobre ±{_SUP[1]:.0f} m, célula {_SUP[2]:.2f} m')

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

# ── OS LAGOS DE CRATERA ────────────────────────────────────────────────────
#
# ⚠️ IDEIA DO FUNDADOR, 30/08: "já que temos que usar o terreno real, é só
# transformar as crateras em lagos. Quero encher os lagos e mover o que ficar
# submerso, simples assim." Ele está certo e as duas alternativas que eu tinha
# medido eram piores: nivelar o corredor dos canais custava 276 Mm³ (o Canal do
# Panamá inteiro moveu 205), e deixar a água acompanhar o chão é o defeito que
# ele apontou — água que sobe e desce não existe.
#
# ⚠️ E EU ERREI DUAS VEZES ANTES DE ACHAR AS CRATERAS. Registro porque as duas
# são erros de medição, não de terreno:
#   1. Enchi cada bacia até a COTA DO CANAL em vez da soleira dela. Como a cota
#      estava acima de várias soleiras, elas derramavam umas nas outras e o
#      cálculo somava um lago de 75 km², 74% da cúpula. Isso não media se a
#      cratera é local: media se o canal estava alto demais.
#   2. Achei as bacias certas e ordenei por ÁREA, imprimindo as maiores — que são
#      as rasas e largas da periferia, de 0 a 6 m. As crateras fundas são
#      PEQUENAS e ficaram no fim da lista. Conclui "nenhuma cratera fecha" com a
#      lista certa na mão, lida pelo lado errado.
# Ordenadas por PROFUNDIDADE aparecem 16 bacias de mais de 25 m, somando 23,9 km².
#
# O algoritmo é o hidrológico: a partir do fundo, enche tirando sempre a célula
# de borda mais baixa (fila de prioridade). O nível é o máximo já tirado; quando
# a água escaparia do domo, aquela é a soleira e a bacia acaba ali.
# ⚠️ NÍVEL ÚNICO (fundador, 30/08: "toda água da cidade precisa ter exatamente o
# mesmo nível, já que está tudo interligado"). Ele está certo e é hidráulica
# básica: água conectada acha um nível só. A escolha da cota deixou de ser
# estética e virou medida — ver a tabela abaixo.
#
# −40 m porque é onde o custo desaba: afoga 163 lotes (0,2%) e não pede parede de
# contenção, porque abaixo dessa cota o terreno já é bacia. Em −20 seriam 14.958
# lotes; em −10, 24.280.
LAGO_COTA = -40.0

def _acha_lagos():
    """Tudo que está abaixo de LAGO_COTA dentro da casca é água.

    ⚠️ E ISSO NÃO DÁ ANEL, DÁ UM LAGO. Medido: 40 corpos somando 24,4 km², mas
    UM deles tem 21,3 km² — 87% de toda a água — no quadrante nordeste, com
    caixa de 7,8 por 9,4 km. O sítio é uma RAMPA, com o terreno baixo a nordeste;
    nível único em terreno inclinado põe água de um lado só. Não existe bacia
    concêntrica aqui, existe encosta.
    """
    from collections import deque
    dentro=[[False]*n for _ in range(n)]
    for j in range(n):
        for i in range(n):
            x, z = (i-half)*cell, (j-half)*cell
            # ⚠️ `altura()`, NÃO `H(i,j)`. Esta linha lia o heightmap CRU: sem o
            # exagero ela não via 2,25 km² de água que a cena desenha, e sem o
            # achatamento do platô ela podia inventar lago dentro da praça, onde
            # o chão da cena é a cota 0 lisa.
            if math.hypot(x, z) < R_CASCA - 60 and altura(x, z) < LAGO_COTA:
                dentro[j][i] = True
    vis=[[False]*n for _ in range(n)]; out=[]
    for j in range(n):
        for i in range(n):
            if not dentro[j][i] or vis[j][i]: continue
            q=deque([(i,j)]); vis[j][i]=True; cel=set()
            while q:
                a,b=q.popleft(); cel.add((a,b))
                for da,db in ((1,0),(-1,0),(0,1),(0,-1)):
                    u,v=a+da,b+db
                    if 0<=u<n and 0<=v<n and dentro[v][u] and not vis[v][u]:
                        vis[v][u]=True; q.append((u,v))
            if len(cel)*cell*cell < 3e4: continue
            cx=sum((a-half)*cell for a,b in cel)/len(cel)
            cz=sum((b-half)*cell for a,b in cel)/len(cel)
            out.append({'lamina': LAGO_COTA, 'area': round(len(cel)*cell*cell,1),
                        'x': round(cx,1), 'z': round(cz,1), 'celulas': cel})
    out.sort(key=lambda L: -L['area'])
    return out

LAGOS = _acha_lagos()
_LAGO_MASC = set()
for _L in LAGOS: _LAGO_MASC |= _L['celulas']
# ⚠️ A BAÍA É O MAIOR CORPO, E ELA TEM RESERVA MAIOR QUE AS OUTRAS. Decisão do
# fundador em 30/08 ("eu gostei da baía, vamos organizar a cidade em torno
# disso"): o maior corpo deixa de ser acidente do relevo e vira a frente da
# cidade, com cais, passeio e faixa de rolamento. Essa orla ocupa 52 m de terra
# a partir da linha d'água (26 de passeio + 14 de pista + 12 de talude), então a
# reserva ali é 60, não 30 — senão nasce lote DEBAIXO do cais. As outras 19
# crateras continuam com margem natural de praia, e 30 basta.
# ⚠️ A BAÍA NÃO É O MAIOR CORPO D'ÁGUA, E ISSO ESTAVA ERRADO DESDE SEMPRE.
# `LAGOS` vem ordenado por área e o primeiro é uma FAIXA colada no corte da
# casca, entre r 7.300 e 8.990, com 34,3 km²: ela nasce do exagero vertical de
# 2x além de r 7.000 sem correção de pódio além de 8.300, ou seja é artefato de
# relevo, não paisagem. A baía de verdade tem 20,7 km² e centro em r 4.791,
# rumo 48°, e bate com os 20,5 km² que o projeto já tinha medido.
#
# O preço do engano: a reserva de orla de 60 m, que existe para guardar a
# frente d'água mais valiosa da cidade, estava sendo aplicada na faixa externa,
# e a baía ficava só com a margem genérica de lago, de 30 m.
#
# A escolha agora é por CENTRO DENTRO DA CIDADE, não por tamanho: água de
# artefato mora na borda, baía mora no tecido.
def _acha_baia():
    # ⚠️ O CENTRO NÃO SEPARA OS DOIS, O RAIO DAS CÉLULAS SEPARA. A faixa da
    # casca envolve a cidade, então o centro dela cai no meio do mapa e passa
    # por baía se o teste for por centroide. O que ela não consegue fingir é
    # onde a água dela ESTÁ: mediana de raio 7.800 contra 4.800 da baía.
    def _raio_mediano(L):
        rs = sorted(math.hypot((i - half) * cell, (j - half) * cell) for i, j in L['celulas'])
        return rs[len(rs) // 2] if rs else 1e9
    dentro = [L for L in LAGOS if _raio_mediano(L) < 6500]
    if not dentro: return LAGOS[0] if LAGOS else None
    return max(dentro, key=lambda L: L['area'])

_BAIA = _acha_baia()
if _BAIA is not None and LAGOS:
    print('baía: %.2f km² em r %.0f rumo %.0f° (o maior corpo, %.2f km², é a faixa da casca)'
          % (_BAIA['area'] / 1e6, math.hypot(_BAIA['x'], _BAIA['z']),
             math.degrees(math.atan2(_BAIA['x'], -_BAIA['z'])) % 360,
             LAGOS[0]['area'] / 1e6), file=sys.stderr)
_BAIA_MASC = set(_BAIA['celulas']) if _BAIA else set()
ORLA_RESERVA = 60.0

# ⚠️ A DILATAÇÃO SE PRÉ-CALCULA, senão a máscara custa o alocador inteiro. A
# versão que varria a vizinhança a cada chamada fazia (2d+1)² buscas por ponto e
# 25 pontos por janela candidata — 225 buscas por janela, num alocador que testa
# dezenas de milhares. Aqui a dilatação roda UMA vez por raio e a consulta vira
# uma busca em conjunto. Só d=1 e d=2 existem: as margens usadas são 30, 40 e 60,
# e a célula tem 59,2 m.
def _dilata(base, d):
    out = set()
    for (i, j) in base:
        for dj in range(-d, d+1):
            for di in range(-d, d+1):
                out.add((i+di, j+dj))
    return out

# ⚠️ OS CANAIS DA ORLA DA BAÍA SÃO NAVEGÁVEIS? Isto se MEDE, e se mede aqui,
# com a mesma máquina que acha os corpos d'água da cidade — não com uma
# inundação escrita à parte, que foi o primeiro instrumento que eu usei e que
# mentiu por causa de um chão sintético.
#
# A pergunta é direta: as células da lâmina dos dois anéis de canal pertencem ao
# MESMO corpo que a baía? Se sim, dá para ir de barco do canal até a alça. Se
# não, o canal é uma vala fechada, por bonito que fique na chapa.
def _ob_navegavel():
    out = []
    for eixo in OB_CANAIS:
        dentro = fora = 0
        g = OB_ARCO[0]
        while g <= OB_ARCO[1]:
            a_ = math.radians(g)
            x_, z_ = math.sin(a_) * eixo, -math.cos(a_) * eixo
            if altura(x_, z_) < LAGO_COTA:
                cel = (int(round(x_/cell + half)), int(round(z_/cell + half)))
                if cel in _BAIA_MASC: dentro += 1
                else: fora += 1
            g += 0.25
        tot = dentro + fora
        out.append((eixo, tot, dentro, 100.0 * dentro / tot if tot else 0.0))
    return out

# ⚠️ E A PRAIA IMPOSTA DEIXOU BANCO DE AREIA NA FRENTE? A saia da orla devolve o
# leito escavado ao terreno natural em 250 m. Se o natural ali já estivesse
# acima da lâmina, a água nova acabaria num barranco e sobraria uma barra de
# terra entre a praia nova e a margem natural da baía — praia de frente para um
# banco de areia, que é o contrário do que o desenho promete.
#
# Mede caminhando para fora a partir da linha d'água em cada rumo: em que raio a
# superfície volta a subir acima da lâmina, e quanto de terra aparece antes da
# baía de verdade.
def _ob_banco():
    piores = []
    g = OB_ARCO[0]
    while g <= OB_ARCO[1]:
        a_ = math.radians(g)
        r_ = ob_linha_dagua(g) + 10.0
        # pula os dedos, que são terra de propósito
        if ob_dist_dedo(r_, g) > -OB_PRAIA:
            g += 0.5; continue
        barra = 0.0
        while r_ < 6600:
            if altura(math.sin(a_) * r_, -math.cos(a_) * r_) >= LAGO_COTA:
                barra += 10.0
            r_ += 10.0
        piores.append((g, barra))
        g += 0.5
    piores.sort(key=lambda t: -t[1])
    return piores

if _BAIA is not None:
    _bc = _ob_banco()
    _com = [t for t in _bc if t[1] > 0]
    print('  banco de areia na frente da praia nova: %d de %d rumos têm terra entre a '
          'linha d\'água e a baía; pior %.0f m no rumo %.1f°, mediana dos que têm %.0f m'
          % (len(_com), len(_bc), _bc[0][1] if _bc else 0, _bc[0][0] if _bc else 0,
             sorted(t[1] for t in _com)[len(_com)//2] if _com else 0), file=sys.stderr)

if _BAIA is not None:
    for _eixo, _tot, _dentro, _pct in _ob_navegavel():
        print('  canal da orla em r %.0f: %d amostras de lâmina, %d ligadas à baía (%.0f%%)'
              % (_eixo, _tot, _dentro, _pct), file=sys.stderr)

_LAGO_D = {d: _dilata(_LAGO_MASC, d) for d in (1, 2)}
_BAIA_D = {d: _dilata(_BAIA_MASC, d) for d in (1, 2)}
print(f'lagos na cota {LAGO_COTA:.0f}: {len(LAGOS)} corpos, '
      f'{sum(L["area"] for L in LAGOS)/1e6:.1f} km2 de agua '
      f'(o maior com {LAGOS[0]["area"]/1e6:.1f} km2)', file=sys.stderr)

def em_lago(x, z, margem=0.0):
    """⚠️ A MARGEM É EM METROS E VIRA CÉLULAS DA GRADE. A grade tem 59,2 m, então
    um lote encostado na margem cai na célula de fora e passaria batido."""
    d = min(2, max(1, int(math.ceil(margem / cell))))
    return (int(round(x/cell + half)), int(round(z/cell + half))) in _LAGO_D[d]

def em_baia(x, z, margem=0.0):
    """só o maior corpo, que é o que ganha orla construída."""
    d = min(2, max(1, int(math.ceil(margem / cell))))
    return (int(round(x/cell + half)), int(round(z/cell + half))) in _BAIA_D[d]

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
  # ⚠️ O NOME MUDOU EM 08/09/2026 E O ID NÃO PODE MUDAR. O fundador travou "DOG
  # Derby": a prova é de galgo, não de cavalo, e "hipódromo" carrega cavalo em
  # português. O id `E02` fica porque ele é a CHAVE que `app/city/plaza/pecas/
  # index.ts` usa para achar o desenho da peça, e o cabeçalho de lá avisa que
  # trocar o id faz o módulo parar de ser chamado EM SILÊNCIO. Plano em derby.md.
  # ⚠️ E O NOME TAMBÉM VIVE EM data/dogcity_programa_congelado.json, que é o que
  # este gerador LÊ quando o arquivo existe. Mudar só aqui não muda nada.
  ('E02', 'DOG Derby',                     'esporte',       4,   13,    4, 6, 3),
  # ⚠️ A RESERVA DO ESTADIO, 05/09/2026. Ela entra ANTES do lote porque depois
  # do snapshot aumentar pegada colide com lote de holder e so encolher e seguro
  # (masterplan.md:268). 540 x 360 m contra um envelope de 364 x 322 com
  # esplanada: a sobra e proposital, e o desenho fino encolhe dentro dela.
  # Sitio escolhido por varredura do relevo real: desnivel 8,8 m em 540 m, sem
  # colisao com nenhuma das 121 pecas, a 20 m do Parque Central e Lago Maior.
  # Plano em estadio.md; bacia em scripts/bacia_estadio.py.
  ('E03', '$DOG ARENA',                     'esporte',      38,   -6,   14, 3, 2),
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
  # ⚠️ O CAMPO SOLAR ANDOU 9°, E FOI A ORLA DA BAÍA QUE O MOVEU (21/09). Em
  # rumo 100 ele ocupava de 96,3° a 103,7° entre r 4.440 e 4.960, ou seja caía
  # DENTRO do distrito da orla (arco 1,3 a 101,3, r 4.100 a 4.720). Mover um
  # campo solar é mais barato que aparar o arco: aparar para 92° custaria 838 m
  # de praia e levaria a testada do tier 4 para 23,3 m. Em 109 ele fica entre
  # B01 e o Reservatório do Cinturão (118, que ocupa 116,1 a 119,9), sem tocar
  # nem num nem no outro.
  ('B01', 'Campo Solar Leste',        'distribuicao', 109, 4700, 300, 260),
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
  # ⚠️ DOIS ANÉIS NOVOS, E ELES SÃO CONSERTO DE UM BURACO GRANDE (fundador,
  # 30/08: "eles precisam se integrar à cidade, se são fazenda são terra
  # produtiva, precisa de vias de escoamento da produção").
  #
  # Medido antes: a malha viária parava em 4.450 e o cinturão produtivo começa em
  # 5.300 — 2.450 m de cidade SEM UMA RUA. 46 das 48 peças do cinturão estavam a
  # mais de 200 m de qualquer via, com distâncias de 233 m a 3.142 m: as doze
  # Fazendas de Proteína, as sete plantas industriais, os quatro Campos Solares,
  # os seis Lagos de Pesca, o Golfe, a Floresta. Todas encostadas em CANAL (11 a
  # 14 m) e nenhuma em estrada. Fazenda de 94 ha que só escoa por barcaça não é
  # fazenda, é ilha.
  #
  # A Avenida da Doca corre junto ao cais terminal (CA07, φ 5.492) e é a divisa
  # entre o tecido e o cinturão. A Avenida de Escoamento corta o meio do
  # cinturão, onde as fazendas e a indústria estão, e é por ela que a produção
  # sai. Largura 34 m, de avenida: caminhão de carga não passa em rua de 26.
  ('AN5', 'Avenida da Doca',       5620.0, 34.0),
  ('AN6', 'Avenida de Escoamento', 6300.0, 34.0),
  # ⚠️ E UMA PISTA FORA DA ABÓBADA. Sete peças moram além da casca (r 7.050) e
  # não podiam ser servidas por avenida nenhuma: os quatro Campos Solares, dois
  # Pátios de Manobra, o Depósito de Regolito e os Tanques de Oxigênio. Elas não
  # precisam de ar — painel solar e pátio de manobra funcionam no vácuo — mas
  # precisam de ACESSO, e hoje estavam a até 3.142 m de qualquer via. Esta é
  # pista de serviço não pressurizada, e ela também é o caminho dos 16 Campos de
  # Extração (r 7.600 e 8.600): sai pela eclusa e serve o lado de fora inteiro.
  ('AN7', 'Pista de Serviço', 7600.0, 30.0),
]

# ═══════════════════════════════════════════════════════════════════════════
# A CENA É A FONTE DA ALÇA, E O GERADOR PASSA A LER EM VEZ DE COPIAR
#
# ⚠️ AS DUAS PONTAS DISCORDAVAM SOBRE UMA AVENIDA DE 44 m. A tabela acima diz
# que a AN7 é pista de serviço em r 7.600 com 30 m de largura; a cena substitui
# esse registro em tempo de execução pela AVENIDA DA ALÇA, círculo puro em
# r 6.950 com 44 m (`AVENIDA_ALCA` em teia.ts). O gerador então mascarava terra
# em 7.600 e deixava livre a faixa de 6.950, que é por onde passa a via. Dentro
# do tecido antigo, que parava em 5.500, isso não aparecia; com o tecido em
# 6.900 a divergência encosta na borda, e é justamente ali que mora a Orla
# Nobre, o endereço mais valioso da cidade.
#
# A regra da casa para isto já existe e está no cabeçalho do
# `scripts/city/conferir_terreno.py`: constante copiada diverge em silêncio, e
# o remédio não é disciplina, é medição. Aqui vai além: o gerador não copia, ele
# LÊ o arquivo da cena.

# a tabela acima fica com o registro certo, para a máscara e para `cidade-malha.json`
ANEIS = [(i, ('Avenida da Alça' if i == 'AN7' else n),
          (ALCA_R if i == 'AN7' else r), (ALCA_LARG if i == 'AN7' else w))
         for i, n, r, w in ANEIS]
# ⚠️ §40 (23/09/2026): O ARTERIAL MORA NA FACE DA TEIA, CENTRADO, OU A CÉLULA NÃO
# EXISTE. A cena desenha AN1 a AN6 como dodecágono com `r` no VÉRTICE (face em
# r·cos 15°) e só encaixa na face da teia quem está a 25 m dela (`TOL_DIVISA`).
# AN3, AN5 e AN6 ficavam a 58, 106 e 46 m: avenida de 26 a 34 m correndo pelo meio
# do quarteirão, e nenhum lote pode ser fração de célula com rua por dentro. A regra
# que `teia.ts` já escreveu é mover a arterial, nunca a teia. A tabela diz em que
# face (`TEIA_ANEIS`, apótema) cada uma mora: AN3 vai para 3.803 e não para 3.564
# porque 3.564 é a borda externa do bloco das 7 peças ancoradas; AN5 cruza as bocas
# de autopista AU1B e AU3A, que existem para encontrar a via. O comentário acima
# ("círculo de verdade, não polígono da malha") é de antes de 06/09 e está revogado.
_COS15 = math.cos(math.pi / 12)
_FACE_DO_ARTERIAL = {'AN1': 2, 'AN2': 9, 'AN3': 15, 'AN4': 17, 'AN5': 22, 'AN6': 24}
ANEIS = [(i, n, (TEIA_ANEIS[_FACE_DO_ARTERIAL[i]] / _COS15 if i in _FACE_DO_ARTERIAL else r), w)
         for i, n, r, w in ANEIS]

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
# ⚠️ AS DE BORDA TAMBÉM SE ASSENTAM NUMA VIA. Elas seguem o contorno e por isso
# não são congeladas, mas isso nunca lhes deu rua: nove estavam a mais de 200 m
# de qualquer via, entre elas os quatro Campos Solares e os Tanques de Oxigênio.
for pid, nome, tipo, rumo, raio, ea, eb in PROGRAMA_BORDA:
    _ar = tipo in _TIPOS_COM_AR or any(k in nome for k in ('Hortas', 'Campo de Treino', 'Reservatório', 'Mirante'))
    rumo, raio = assenta_no_cinturao(rumo, raio, float(ea), float(eb), _ar)
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

# ── AS TRÊS MÁSCARAS QUE GUARDAVAM LUGAR NENHUM ───────────────────────────
#
# ⚠️ MÁSCARA NO LUGAR ERRADO É PIOR QUE MÁSCARA NENHUMA: ela reserva chão vazio
# E deixa o prédio descoberto, cobrando a terra duas vezes. Medido em 22/09, com
# a âncora de `mapa-v1.json` como referência:
#
#   E02  "DOG Derby"           congelada em (1.999, 2.297); o Derby que a cena
#                              constrói está em (2.240, 2.415), a 268 m dali.
#   E03  "$DOG ARENA"          congelada em (2.398, 1.481); o estádio está em
#                              (3.182, 853), a 1.004 m dali.
#   F01  "Distrito Financeiro" congelada em (−1.637, 1.710), r 2.368, do lado
#                              OPOSTO da cidade ao Distrito Financeiro de
#                              verdade, que mora em r 985 desde 13/09 (§3.12.5).
#                              A cidade reservava terra para um distrito que não
#                              mora ali, e o módulo 3D desenhava um segundo
#                              distrito financeiro no lado errado.
#
# As duas primeiras ficaram redundantes no instante em que as parcelas ancoradas
# passaram a entrar (logo abaixo): a obra de verdade agora tem máscara própria,
# no polígono que ela ocupa. A terceira é revogação de decisão.
#
# ⚠️ A RETIRADA É AQUI, EM CÓDIGO COM MOTIVO, E NÃO UMA EDIÇÃO NO JSON CONGELADO.
# O congelado é o registro histórico do que o reticulado antigo decidiu; apagar
# linha dele deixaria a remoção sem explicação e sem revisor. Quem quiser a peça
# de volta tira o id daqui e sabe exatamente o que está desfazendo.
_PECAS_RETIRADAS = {
    'E02': 'duplicata do DERBY ancorado, 268 m fora do lugar',
    'E03': 'duplicata do ESTADIO ancorado, 1.004 m fora do lugar',
    'F01': 'Distrito Financeiro revogado em 13/09; o de verdade mora em r 985',
}
_antes = len(PROGRAMA_GEO)
_livre = 0.0
for _q in PROGRAMA_GEO:
    if _q['id'] in _PECAS_RETIRADAS:
        _livre += (2*_q.get('a', 0.0)) * (2*_q.get('b', 0.0))
PROGRAMA_GEO = [_q for _q in PROGRAMA_GEO if _q['id'] not in _PECAS_RETIRADAS]
if _antes != len(PROGRAMA_GEO):
    print(f'peças retiradas: {_antes - len(PROGRAMA_GEO)} '
          f'({", ".join(sorted(_PECAS_RETIRADAS))}), {_livre/1e4:.1f} ha devolvidos ao tecido',
          file=sys.stderr)

# ── AS PARCELAS ANCORADAS: A OBRA QUE A CENA JÁ CONSTRÓI ───────────────────
#
# ⚠️ 845 LOTES DE CARTEIRA ESTAVAM GRAVADOS EM CIMA DE PRÉDIO, e o portão de 15
# testes deu APROVADO em cima disso porque não existia teste de lote contra peça.
# Medido no registro selado de 22/09: 845 lotes, 830 endereços, 72,18 ha, sobre o
# campus esportivo, o $DOG ARENA, a THE GEODE, o atletismo, o centro aquático, o
# DOG Derby e a Sphere. São sete parcelas que `app/city/plaza/` constrói com
# módulo 3D próprio e que este gerador nunca soube que existiam.
#
# ⚠️ E AS DUAS MÁSCARAS DE ESPORTE QUE EXISTIAM ESTAVAM NO LUGAR ERRADO, o que é
# pior que não existir: o $DOG ARENA era reservado a 1.125 m de onde a cena o
# constrói, e o Derby a 250 m. Máscara no lugar errado reserva chão vazio E
# deixa o prédio descoberto, cobrando duas vezes.
#
# ⚠️ ELAS ENTRAM AQUI, DEPOIS DO CONGELAMENTO, E NÃO EM `PROGRAMA_MALHA`. O
# congelado SUBSTITUI `PROGRAMA_GEO` inteiro (logo acima), então peça escrita
# lá em cima é letra morta desde que o arquivo passou a existir. Quem não souber
# disso "conserta" o programa e vê o conserto sumir sem erro nenhum.
#
# ⚠️ E A FONTE É `public/city/mapa-v1.json`, NÃO UMA CÓPIA. É o mesmo arquivo de
# onde a cena tira a âncora de cada peça, com o polígono em coordenada de mundo.
# Copiar os números para cá criaria a mesma deriva que a cota acabou de custar.
_ANCORAS = p('public/city/mapa-v1.json')
if os.path.exists(_ANCORAS):
    _mapa = json.load(open(_ANCORAS, encoding='utf-8'))
    _novas = 0
    for _a in _mapa.get('ancoras', []):
        _poly = [[float(q[0]), float(q[1])] for q in (_a.get('poly') or [])]
        if len(_poly) < 3: continue
        # ⚠️ `area` NÃO É OPCIONAL, E A FALTA DELA MATOU UMA RODADA INTEIRA. O
        # publicador de public/city/cidade.json faz `q['area']` direto, sem
        # `.get`, e `programaHa` soma o campo: sem ele o gerador planta a cidade
        # toda, grava o CSV e as lápides, e só então estoura `KeyError: 'area'`,
        # depois de dezenas de minutos e com metade das saídas no disco.
        # Medido em 22/09 numa rodada de conferência: as 7 parcelas ancoradas
        # nasciam sem o campo e a rodada morreu na gravação do manifesto.
        # A área é a do POLÍGONO (fórmula do cadarço), porque ele é o contorno
        # real; `area_m2` do mapa entra quando existe, que é a mesma fonte que a
        # linha de log abaixo já usava.
        _sh = abs(sum(_poly[_i][0]*_poly[_i-1][1] - _poly[_i-1][0]*_poly[_i][1]
                      for _i in range(len(_poly)))) / 2.0
        PROGRAMA_GEO.append({
            'id': _a['id'], 'nome': _a.get('nome', _a['id']), 'tipo': 'ancorada',
            'forma': 'poligono', 'poly': _poly,
            'cx': float(_a['cx']), 'cz': float(_a['cz']), 'a': 0.0, 'b': 0.0,
            'rot': 0.0, 'c': 1.0, 's': 0.0,
            'area': float(_a.get('area_m2') or 0.0) or _sh,
        })
        _novas += 1
    _ha = sum(float(_a.get('area_m2', 0)) for _a in _mapa.get('ancoras', [])) / 1e4
    print(f'parcelas ancoradas: {_novas} peças, {_ha:.1f} ha (mapa-v1.json)', file=sys.stderr)
else:
    raise SystemExit(
        'gerar_cidade: falta public/city/mapa-v1.json, que é a fonte das parcelas\n'
        '  ancoradas (Estádio, Geode, Sphere, Campus, Atletismo, Aquatics, Derby).\n'
        '  Sem ele o gerador planta lote em cima de prédio: foram 845 em 22/09.')

def _no_poligono(x, z, poly, margem=0.0):
    """ponto dentro do polígono, com margem. Cruzamento de raio para o dentro,
    mais distância ao segmento para a margem.

    ⚠️ A MARGEM NÃO É DECORAÇÃO, e o número dela tem história: `gerar_cidade`
    grava x e z como int16 em METROS INTEIROS, então um lote a 40 cm de fora da
    elipse do Coliseu arredondava para DENTRO dela. Eram 3 lotes em 52.991. Todo
    teste de pegada deste arquivo carrega a mesma margem de 2 m pelo mesmo
    motivo, e o polígono não é exceção."""
    n_ = len(poly)
    dentro = False
    j = n_ - 1
    for i in range(n_):
        xi, zi = poly[i]; xj, zj = poly[j]
        if (zi > z) != (zj > z):
            xc = xi + (z - zi) * (xj - xi) / (zj - zi)
            if x < xc: dentro = not dentro
        j = i
    if dentro or margem <= 0: return dentro
    for i in range(n_):
        xi, zi = poly[i]; xj, zj = poly[(i + 1) % n_]
        ex, ez = xj - xi, zj - zi
        L2 = ex*ex + ez*ez
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - xi)*ex + (z - zi)*ez) / L2))
        if math.hypot(x - (xi + t*ex), z - (zi + t*ez)) <= margem: return True
    return False


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
        if q['forma'] == 'poligono':
            # ⚠️ O POLÍGONO É TESTADO EM MUNDO, NÃO EM LOCAL: ele já vem com os
            # vértices em coordenada de mundo (`mapa-v1.json`), porque foi o
            # módulo 3D que o desenhou lá. Girar de novo o poria em outro lugar.
            if _no_poligono(x, z, q['poly'], margem): return q
            continue
        if q['forma'] == 'retangulo':
            if abs(lx) <= q['a'] + margem and abs(lz) <= q['b'] + margem:
                return q
        elif (lx/(q['a']+margem))**2 + (lz/(q['b']+margem))**2 <= 1.0:
            return q
    return None

def num_anel(x, z, margem=2.0):
    # ⚠️ §40: DODECÁGONO, COMO A CENA DESENHA. A versão anterior testava o CÍRCULO
    # de raio `ra`, que é o VÉRTICE: no meio da face o asfalto passa 3,4% para
    # dentro (128 m no AN3) e a máscara deixava lote nascer em cima dele. A
    # distância que conta é a apótema do ponto, r·cos(rel); só a alça é círculo.
    r = math.hypot(x, z)
    _P = math.pi / 6
    _a = math.atan2(x, -z)
    ap = r * math.cos(((_a % _P) + _P) % _P - _P / 2)
    for aid, nome, ra, larg in ANEIS:
        if aid == 'AN7':
            if abs(r - ra) <= larg/2 + margem: return aid
        elif abs(ap - ra * _COS15) <= larg/2 + margem:
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

def _na_orla_nobre(x, z):
    """a faixa das duas fileiras da alça, com a avenida no meio."""
    r = math.hypot(x, z)
    if not (ALCA_R - ALCA_LARG/2 - 214.0 - 5 <= r <= ALCA_R + ALCA_LARG/2 + 246.0 + 5):
        return False
    a0, a1 = ALCA_TERRA_ARCO
    ang = rumo_de(x, z)
    return ((ang - a0) % 360.0) <= ((a1 - a0) % 360.0)


def _na_orla_baia(x, z):
    """o distrito da orla da baía, MAIS os quatro dedos.

    ⚠️ A MÁSCARA É EM METROS, NUNCA EM φ. O tecido é cortado por φ (a
    superelipse) e o distrito é desenhado por RAIO, que é o que a cena esculpe.
    Misturar as duas réguas aqui deslocaria a borda do distrito até 259 m
    conforme o rumo, que é o mesmo erro que o anel dodecágono já custou.

    A faixa vai da borda interna (4.100) até 120 m além da ponta do dedo: o
    miolo é quase todo lâmina d'água hoje, e mascarar tudo é o que impede lote
    de tecido de nascer numa península que vai existir.
    """
    r = math.hypot(x, z)
    if not (OB_R_FUNDO - 20.0 <= r <= OB_DEDO_PONTA + 120.0): return False
    ang = rumo_de(x, z)
    return OB_ARCO[0] <= ang <= OB_ARCO[1]


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
    if em_canal(x, z, CANAL_TALUDE + 2.0): return False
    if em_guerra(x, z, 2.0): return False
    if em_baia(x, z, ORLA_RESERVA): return False
    # ⚠️ A ORLA NOBRE É TERRA RESERVADA PARA O TECIDO COMUM. As duas fileiras
    # da alça ocupam de 6.714 a 7.218 no arco de 346 a 116,5, e o tecido agora
    # vai até φ 6.900: sem esta máscara o lote comum nasce em cima do lote de
    # tier 1, que é o pior defeito possível no endereço mais valioso da cidade.
    if _na_orla_nobre(x, z): return False
    if _na_orla_baia(x, z): return False
    if em_lago(x, z, 30.0): return False
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

# ⚠️ O LOTE SE CONFERE PELA PEGADA, NÃO PELO CENTRO (fundador, 30/08: "assim é
# impossível nascer um lote dentro de uma área proibida"). A conferência testava
# `livre(cx, cz)` no CENTRO do lote, e o lote tem até 255 m de testada: um centro
# a 30 m da margem do canal ainda põe 100 m de terreno dentro d'água. Medido no
# binário publicado: 3.560 lotes com o CENTRO na lâmina, mas 6.810 com a PEGADA
# nela. A diferença, 3.250 lotes, é exatamente o que testar um ponto só deixa
# passar.
#
# Testa o centro e os quatro cantos. Cinco pontos bastam porque toda máscara
# desta cidade é convexa OU muito maior que o lote: canal, avenida, anel viário
# e divisa de banda são faixas, e peça e Coliseu são convexos. Faixa mais
# estreita que o lote não existe — a menor é a rua de contorno, 12 m, e ela não
# é máscara de `livre()`.
#
# ⚠️ E O QUINTO PONTO É O TETO DE 12% (masterplan §15). A máscara grossa mede a
# célula de 59,2 m do heightmap e não enxerga a rampa que cabe dentro de um lote
# de 14 m. Aqui a declividade sai dos QUATRO CANTOS do lote que está sendo
# gravado, que é a mesma escala em que o holder vai andar. O teste vem por
# último de propósito: ele custa quatro consultas de altura e só vale a pena
# depois que as máscaras baratas já aprovaram.
REJ = {'mascara': 0, 'agua': 0, 'declive': 0, 'ok': 0}
# ⚠️ O ORÇAMENTO DE TESTADA. A cidade entrega 67% do tecido que tem, e "67%" não
# diz onde os outros 33% foram. Três destinos possíveis e excludentes: testada
# USADA por lote, testada QUEIMADA (prateleira zerada porque a pegada caiu em
# máscara) e testada que SOBRA na frente do cursor quando a fila acaba. Sem
# separar os três, otimizar empacotamento é chute.
ORC = {'queimada': 0.0, 'queimada_n': 0, 'vao_usado': 0.0, 'vao_n': 0,
       'q_estreita': 0.0, 'q_mascara': 0.0, 'q_par': 0.0,
       'espremido': 0, 'desviado': 0, 'desviado_area': 0}

# ⚠️ O VÃO: A MAIOR PERDA DO EMPACOTAMENTO, E ELA ERA INVISÍVEL. A sondagem anda
# 12 m quando a pegada cai em máscara e ABANDONA aquele pedaço de testada para
# sempre, porque o cursor só anda para a frente. Medido em 20/09 na cidade do
# snapshot: 317 km de testada andados sem virar lote, ou 7,9 km² de tecido, que
# é mais do que a banda inteira do Horizonte rende (7,05 km²).
#
# O pedaço abandonado não é necessariamente ruim: ele foi reprovado para AQUELE
# lote, com AQUELA largura. Um lote de 5 m de testada cabe em muito canto onde
# um de 40 m não cabe, e 37% da cidade tem menos de 125 m². Então o vão vai para
# uma lista e os lotes seguintes tentam nele antes de ir para o cursor.
VAOS = [collections.defaultdict(list) for _ in range(N_DIST)]
# ⚠️ A JANELA É CUSTO, NÃO GOSTO. Cada candidato custa uma pegada de cinco
# pontos com quatro consultas de altura, e a fila tem 85.797 lotes vezes até 12
# passadas: com janela de 400 a primeira passada não terminou em 20 minutos.
# Com 40 vãos e teto de 8 pegadas por lote o custo volta para a ordem do laço
# normal, e o vão bom quase sempre é recente, porque o cursor acabou de passar
# por ele.
# ⚠️ ÍNDICE POR TAMANHO, NÃO JANELA POR TEMPO. A janela dos vãos recentes
# reciclava só 6,5% do que queimava, e o motivo é a ordem da fila: ela vem do
# lote maior para o menor, então o lote pequeno que caberia numa sobra antiga
# chega milhares de posições depois, quando a janela já passou. Medido em
# 21/09: dos 263 km de testada queimada, 257 km (98%) são "sobra estreita para
# o lote da vez", ou seja ENCAIXE DE TAMANHO, não terreno.
#
# O vão agora entra num balde por comprimento e a busca começa no menor balde
# que serve, subindo: isso é melhor encaixe, custa uma pegada por candidato e
# não perde vão nenhum por idade.
VAO_BALDE = 5.0         # metros por balde
VAOD = collections.Counter()   # diagnóstico da busca de vão: onde ela desiste
VAO_TENTA = 10          # pegadas no máximo por lote
VAO_TETO_FRENTE = 80.0
# ⚠️ E A BUSCA É POR MELHOR ENCAIXE, não pela primeira que serve. Pegar um vão de
# 200 m para um lote de 6 m gasta a única sobra grande da vizinhança com o lote
# que caberia em qualquer canto. Ordena os candidatos pelo desperdício.

def declive_lote(bx, bz, ca, sa, ox, oz, frente, prof):
    """declividade na pegada do lote, em fração (0,12 = 12%), pelos 4 cantos."""
    h = []
    for dx, dz in ((-frente/2, -prof/2), (frente/2, -prof/2),
                   (frente/2, prof/2), (-frente/2, prof/2)):
        lx, lz = ox + dx, oz + dz
        h.append(altura(bx + lx*ca - lz*sa, bz + lx*sa + lz*ca))
    gx = ((h[1] + h[2]) - (h[0] + h[3])) / (2 * max(1e-6, frente))
    gz = ((h[2] + h[3]) - (h[0] + h[1])) / (2 * max(1e-6, prof))
    return math.hypot(gx, gz)


# ⚠️ AUDITAR UMA CIDADE JÁ GRAVADA, sem replantar: `AUDITA_BIN=caminho.bin`.
# Existe porque comparar a cidade nova com a publicada exige medir as duas com a
# MESMA função de altura; reimplementar a medição fora daqui é a doença que o
# `conferir_terreno.py` foi escrito para pegar. O giro vem do próprio registro.
_AB = os.environ.get('AUDITA_BIN')
if _AB:
    _by = open(_AB if os.path.isabs(_AB) else p(_AB), 'rb').read()
    _reg = struct.calcsize('<hhBBHBHHH')
    _v = []
    for _i in range(len(_by) // _reg):
        _x4, _z4, _s, _c, _f, _fl, _w10, _d10, _g = struct.unpack_from('<hhBBHBHHH', _by, _i*_reg)
        _x, _z = _x4 / 4.0, _z4 / 4.0
        _w, _d = _w10 / 10.0, _d10 / 10.0
        _gg = math.radians(_g / 100.0)
        _v.append((declive_lote(_x, _z, math.cos(_gg), math.sin(_gg), 0.0, 0.0, _w, _d),
                   _s, math.hypot(_x, _z), rumo_de(_x, _z), _w, _d))
    # ⚠️ QUEM ESTOURA O TETO PRECISA TER NOME, não só contagem. "12 lotes acima
    # de 12%" não diz onde consertar; setor e rumo dizem.
    _acima = sorted((q for q in _v if q[0] > DECL_LOTE_MAX), key=lambda q: -q[0])
    if _acima:
        print('  acima do teto de %.0f%%: %d lotes' % (DECL_LOTE_MAX*100, len(_acima)),
              file=sys.stderr)
        import collections as _c
        for _st, _qt in _c.Counter(q[1] for q in _acima).most_common():
            print('    setor %d: %d' % (_st + 1, _qt), file=sys.stderr)
        for q in _acima[:8]:
            print('    %.1f%%  setor %d  r %.0f  rumo %.1f  %.1f x %.1f m'
                  % (q[0]*100, q[1]+1, q[2], q[3], q[4], q[5]), file=sys.stderr)
    _v = [q[0] for q in _v]
    _v.sort(); _n = len(_v) or 1
    print('AUDITA %s: %d lotes | mediana %.1f%% | p90 %.1f%% | p99 %.1f%% | máx %.1f%%'
          % (_AB, len(_v), _v[_n//2]*100, _v[int(_n*0.9)]*100, _v[int(_n*0.99)]*100, _v[-1]*100),
          file=sys.stderr)
    print('  acima de 8%%: %d | de 12%%: %d | de 20%%: %d'
          % (sum(1 for q in _v if q > 0.08), sum(1 for q in _v if q > 0.12),
             sum(1 for q in _v if q > 0.20)), file=sys.stderr)
    sys.exit(0)


# ═══════════════════════════════════════════════════════════════════════════
# O ALCANCE: A PRATELEIRA MAIS INTERNA QUE AINDA COMPORTA O LOTE
#
# ⚠️ A PERDA DE EMPACOTAMENTO ERA DE ALCANCE, NÃO DE ORDEM, e isso foi medido
# em 21/09 por simulação e por censo da cidade gravada:
#
#   oferta 2.482 km de testada | usada por lote 1.677 km (67,6%) | VAZIA 724 km
#   dos 724 km vazios, 506 km (70%) são FILEIRAS INTEIRAS que nunca receberam
#   um lote, em 6.047 prateleiras
#   simulação 1-D: janela 24 dá 88,1%, distrito inteiro dá 92,6%, primeira que
#   cabe sem janela dá 96,6%; reordenar a fila NÃO muda nada (as três políticas
#   de ordem empatam, e ordenar por tamanho PIORA para 92,6%)
#
# E o que travava a área não era o empacotamento global: era um distrito SECAR
# antes de a fila acabar, com 506 km parados em outro. O `k` da bisseção só
# sobe se todo mundo couber, então 2.400 carteiras sem lugar seguravam a cidade
# inteira num degrau abaixo.
#
# A árvore abaixo responde em tempo logarítmico "qual a primeira prateleira,
# do centro para fora, que ainda tem testada suficiente". Isso é melhor que
# alargar a janela por dois motivos: acha SEMPRE (não em 24 tentativas) e
# preserva a lei de posição, porque a primeira prateleira é a mais interna e
# centro para fora é justamente a lei.
class ArvoreLivre:
    """máximo de testada livre por faixa de prateleiras, para busca do menor índice."""

    def __init__(self, livres):
        self.n = 1
        while self.n < max(1, len(livres)): self.n *= 2
        self.t = [0.0] * (2 * self.n)
        for i, v in enumerate(livres): self.t[self.n + i] = v
        for i in range(self.n - 1, 0, -1): self.t[i] = max(self.t[2*i], self.t[2*i+1])

    def poe(self, i, v):
        i += self.n
        self.t[i] = v
        i //= 2
        while i:
            novo = max(self.t[2*i], self.t[2*i+1])
            if self.t[i] == novo: break
            self.t[i] = novo; i //= 2

    def primeiro(self, precisa, de=0):
        """menor índice >= `de` cuja testada livre comporta `precisa`, ou -1."""
        if self.t[1] + 1e-9 < precisa: return -1
        i, ini, fim = 1, 0, self.n - 1
        pilha = [(1, 0, self.n - 1)]
        while pilha:
            i, ini, fim = pilha.pop()
            if fim < de or self.t[i] + 1e-9 < precisa: continue
            if ini == fim: return ini
            meio = (ini + fim) // 2
            pilha.append((2*i + 1, meio + 1, fim))   # direita depois
            pilha.append((2*i, ini, meio))           # esquerda primeiro
        return -1


ARV = []          # uma árvore por distrito, reconstruída a cada passada


def _arv_atualiza(s, k):
    if ARV and ARV[s] is not None: ARV[s].poe(k, PASSO[s][k]['livre'])


def _guarda_vao(s, pr, x_ini, comp):
    if comp >= LOTE_MIN_FRENTE:
        VAOS[s][int(comp // VAO_BALDE)].append((pr, x_ini, comp))


def _busca_vao(s, frente, prof_real):
    """o MENOR vão que cabe o lote, do balde certo para cima."""
    baldes = VAOS[s]
    VAOD['chamada'] += 1
    if not baldes:
        VAOD['sem_balde'] += 1
        return None
    b0 = int(frente // VAO_BALDE)
    _tentou = 0
    _maior = max(baldes.keys()) if baldes else b0
    for b in range(b0, _maior + 1):
        lista = baldes.get(b)
        if not lista: continue
        for _i in range(len(lista) - 1, -1, -1):
            _pv, _vx, _vl = lista[_i]
            if _vl < frente: continue
            if _tentou >= VAO_TENTA:
                VAOD['esgotou'] += 1
                return None
            _tentou += 1
            _ozv = _pv['borda'] + _pv['sentido'] * prof_real / 2
            if not _vago(_pv, _vx, frente):
                VAOD['ocupado'] += 1; continue
            if not _par_vago(_pv, _vx, frente, prof_real):
                VAOD['par'] += 1; continue
            if not _cabe(_pv, _vx + frente / 2, _ozv, frente, prof_real):
                VAOD['mascara'] += 1; continue
            lista.pop(_i)
            resto = _vl - frente
            if resto >= LOTE_MIN_FRENTE:
                _guarda_vao(s, _pv, _vx + frente, resto)
            VAOD['achou'] += 1
            return (_pv, _vx, _ozv)
    VAOD['nao_serve'] += 1
    return None


def _vago(pr, x_ini, frente):
    """o trecho [x_ini, x_ini+frente) está livre: sem lote plantado e sem reserva."""
    _f = x_ini + frente
    for _b0, _b1 in pr['bloq']:
        if x_ini < _b1 - 1e-6 and _f > _b0 + 1e-6: return False
    for _o0, _o1 in pr['ocup']:
        if x_ini < _o1 - 1e-6 and _f > _o0 + 1e-6: return False
    return True


def _ocupa(pr, x_ini, frente):
    pr['ocup'].append((x_ini, x_ini + frente))


def _par_vago(pr, x_ini, frente, prof):
    """o lote fundo atravessa a faixa: a fileira de trás precisa estar VAZIA ali.

    ⚠️ RESERVAR PARA O FUTURO NÃO BASTA. `_reserva_no_par` protege quem vier
    depois, e o lote raso da fileira de trás pode já estar plantado: medido em
    20/09, o pior par da cidade tinha o raso na ordem 165 e o fundo na 1.316,
    com 24,96 m de invasão. Aqui a conta é a do passado: o que ficou atrás do
    cursor do par já tem dono."""
    if prof <= FILA_PROF + 1e-6: return True
    _par = pr.get('par')
    if _par is None: return True
    return _vago(_par, x_ini, frente)


def _reserva_no_par(pr, x_ini, frente, prof):
    """lote mais fundo que a fileira come a de trás: marca lá o mesmo trecho."""
    if prof <= FILA_PROF + 1e-6: return
    _par = pr.get('par')
    if _par is None: return
    _par['bloq'].append((x_ini, x_ini + frente))
    # se o trecho está na frente do cursor do par, o cursor pula por cima dele
    if x_ini <= _par['x0'] + 1e-6 and _par['x0'] < x_ini + frente:
        _avanco = min(_par['livre'], x_ini + frente - _par['x0'])
        _par['x0'] += _avanco; _par['livre'] -= _avanco
        if 'i' in _par:
            for _s2 in range(len(ARV)):
                if ARV[_s2] is not None and _par['i'] < len(PASSO[_s2]) and PASSO[_s2][_par['i']] is _par:
                    ARV[_s2].poe(_par['i'], _par['livre']); break


def _cabe(pr, ox, oz, frente, prof):
    ca, sa = pr['ca'], pr['sa']
    hs = []
    for dx, dz in ((0.0, 0.0), (-frente/2, -prof/2), (frente/2, -prof/2),
                   (frente/2, prof/2), (-frente/2, prof/2)):
        lx, lz = ox + dx, oz + dz
        wx, wz = pr['bx'] + lx*ca - lz*sa, pr['bz'] + lx*sa + lz*ca
        if not livre(wx, wz):
            REJ['mascara'] += 1
            return False
        hs.append(altura(wx, wz))
    # ⚠️ NENHUM PONTO DA PEGADA PODE ESTAR ABAIXO DA LÂMINA D'ÁGUA, e esta regra
    # faltava inteira. Medido no registro selado de 22/09, contra a superfície da
    # própria cena: 73 lotes de carteira tinham o chão ABAIXO de −40 m, ou seja
    # escritura de terra seca debaixo d'água. O portão de 15 testes não pegava
    # porque o teste de cota só conferia se ela cai entre −200 e 300.
    #
    # ⚠️ E O GUARDA VAI NA PEGADA, NÃO NA MÁSCARA DE LAGO. A máscara joga fora
    # qualquer poça com menos de 3 ha (`_acha_lagos`), então água pequena não
    # existe para ela; e testar um ponto só deixaria o canto do lote molhado. Em
    # `_cabe` o teste custa ZERO chamadas novas de `altura()`, porque as cinco
    # cotas já foram calculadas duas linhas acima para o declive.
    if min(hs) < LAGO_COTA:
        REJ['agua'] += 1
        return False
    # hs[1..4] são os cantos na ordem (-,-), (+,-), (+,+), (-,+)
    gx = ((hs[2] + hs[3]) - (hs[1] + hs[4])) / (2 * max(1e-6, frente))
    gz = ((hs[3] + hs[4]) - (hs[1] + hs[2])) / (2 * max(1e-6, prof))
    if math.hypot(gx, gz) > DECL_LOTE_MAX:
        REJ['declive'] += 1
        return False
    REJ['ok'] += 1
    return True


# ⚠️ A COTA DO LOTE É A DA TESTADA, NÃO A DO CENTRO (lei 3 do DOGGAMEMODE, e a
# regra 2 do masterplan §15: a cidade entrega o lote plano e o desnível com o
# vizinho vira muro de arrimo na divisa, sem tirar área de ninguém). O centro
# mente justamente onde importa: num lote de 40 m de fundo em rampa de 10%, o
# centro está 2 m acima da rua que o serve.
def cota_testada(pr, ox):
    lx, lz = ox, pr['borda']
    return altura(pr['bx'] + lx*pr['ca'] - lz*pr['sa'],
                  pr['bz'] + lx*pr['sa'] + lz*pr['ca'])

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
# ⚠️ ESTE BLOCO MOVIA PEÇA DEPOIS DE ASSENTADA, e era a última fonte de
# sobreposição no cinturão: TODAS as 14 duplas envolviam uma peça de borda, e
# eram justamente estas quatro famílias (Hortas, Campo de Treino, Reservatório,
# Mirante). Ele empurrava cada uma para o meio do cinturão sem consultar o
# registro de ocupação, e caía em cima de fazenda e de indústria.
#
# ⚠️ E ELE FICOU REDUNDANTE. `assenta_no_cinturao(..., precisa_ar=True)` já
# resolve o mesmo problema na origem, e melhor: mantém a peça dentro da casca E
# com frente para rua E fora de canal, tudo antes de ela existir. O que sobrou é
# só marcar o Reservatório como peça de ar, porque o tipo dele é 'distribuicao'
# mas o conteúdo é ÁGUA, e água ferve no vácuo.
_NOMES_COM_AR = ('Hortas', 'Campo de Treino', 'Reservatório', 'Mirante')
_trouxe = 0
for _q in PROGRAMA_GEO:
    if not _q.get('borda'): continue
    if not any(k in _q['nome'] for k in _NOMES_COM_AR): continue
    _q['borda'] = False
    _q['produtivo'] = True          # passa a morar no cinturão, dentro da abóbada
    _trouxe += 1
print(f'peças de borda que passam a morar no cinturão: {_trouxe} '
      f'(a posição já veio de assenta_no_cinturao)', file=sys.stderr)

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
def _z_das_filas(k, lado=None):
    """As 2k fileiras do quarteirão, cada uma com a sua frente.

    ⚠️ REGRA DO FUNDADOR: TODA FILEIRA DÁ FRENTE PARA VIA. O quarteirão é k
    faixas de 50 m separadas por travessas de 9 m, e cada faixa são DUAS fileiras
    de 25 m costas com costas. Na teia este eixo é o RADIAL: a fileira corre
    paralela ao anel e abre para o anel ou para a travessa.

    ⚠️ §36: `lado` deixou de ser sempre o nominal da classe (109/168/227...).
    A divisa radial agora nasce na FACE do anel da teia, e o vão real entre
    duas faces respira com o rumo (o dodecágono encolhe até 3,5% do vértice ao
    meio da face). Quem chama para um quarteirão de verdade passa o vão MEDIDO
    daquele quarteirão; as fileiras escalam por ele, senão a última passaria da
    face em alguns rumos, que é o defeito exato que o §36 fecha. `lado=None`
    mantém o nominal, para quem só quer a tabela genérica por classe.
    """
    lado_nom = _lado(k)
    esc = (lado / lado_nom) if lado is not None else 1.0
    out = []
    for i in range(k):
        zc = (-lado_nom/2 + i*(FAIXA + TRAVESSA) + FAIXA/2) * esc
        out.append((zc - (LOTE_D*esc)/2, zc - (FAIXA*esc)/2, +1))
        out.append((zc + (LOTE_D*esc)/2, zc + (FAIXA*esc)/2, -1))
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
for _i, (_ru, _ph, _pa, _pb) in enumerate(PARQUES if SERIE_NUMERADA else []):
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
# ⚠️ AS FRONTEIRAS ANGULARES USAM O RADIAL BASE (N_RAIOS0 = 84, o da teia
# desenhada), nunca o dobrado. Como 168 é múltiplo de 84, todo radial do conjunto
# base existe em qualquer anel; usar o dobrado faria a borda da peça cair num
# radial que não existe no anel de dentro, e ela voltaria a cortar quarteirão.
# ⚠️ E A BASE PRECISA SER A DA RUA, NÃO UMA DA CASA. Enquanto ela era 64 e o
# tecido corria em 84/168, a tradução `(j * N_RAIOS0) // n` deixava de ser exata
# e a célula que encavalava a borda de entrada da peça NÃO era bloqueada: o
# quarteirão nascia por cima da peça. Ver a nota de `N_RAIOS0`.
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

# ⚠️ CANAL NA DIVISA É MARGEM; CANAL NO MEIO É TALHO. A primeira versão desta
# checagem reprovava os dois, e com isso NENHUMA janela da banda Borda passava:
# os canais de anel caem a exatamente dois passos de anel um do outro (4.598 e
# 5.194, passo 298), então toda janela tem canal numa das pontas. O Parque
# Olímpico não achava lugar em raio nenhum.
#
# A distinção é a do próprio desenho: "a margem do canal É a rua do quarteirão".
# Canal ATRAVESSANDO a peça reprova; canal ENCOSTADO nela é margem, e a peça
# recua o corredor inteiro (42 m) em vez dos 6 m da rua comum. Assim a borda da
# peça vira cais, que é o que se queria desde o começo.
# ⚠️ E O RECUO SE MEDE EM METROS DE RAIO, NÃO EM φ. A primeira versão recuava 42
# em φ, que é o corredor em metros — mas dφ/dr vai de 1,06 a 1,4 nestes rumos, e
# 42 de φ viravam de 30 a 40 m de raio. Faltavam de 5 a 12 m e a peça encostava
# no leito: onze peças ainda saíam com 4,60 m de vala, todas com o canal na
# DIVISA e nenhuma com ele dentro. O mesmo erro de unidade que já tinha posto
# lote dentro d'água em `em_canal`, agora na peça. Aqui o recuo sai do RAIO do
# anel de canal naquele rumo, que é o que `terrain.ts` cava.
_CANAL_REC = CANAL_ANEL_SEC/2 + CANAL_TALUDE
def _borda_r(ang, ph, canal, interna):
    """raio da borda da peça naquele rumo: recua o corredor se a divisa tem canal.

    ⚠️ O SINAL DEPENDE DE QUAL DIVISA É. A primeira versão somava o recuo nos
    DOIS lados, então a borda externa era empurrada 42 m PARA DENTRO do canal em
    vez de recuar dele: as peças cortadas subiram de 11 para 18. Divisa interna
    cresce em raio, divisa externa encolhe — sempre para dentro da peça.
    """
    r = raio_em_phi(ang, ph)
    rec = _CANAL_REC if canal else VIA_CONTORNO / 2
    return r + rec if interna else r - rec

def _janela(_i, _nr, _jj, _ns):
    """(prof, larg, c0, c1, dg0, dg1) da janela, ou None se um canal a atravessa."""
    p0, p1 = _PHI_B[_i], _PHI_B[_i + _nr]
    # ⚠️ CANAL COM VÃO NAQUELE SETOR NÃO CONTA — mas só se o vão cobre a peça
    # INTEIRA. Ver `vao_cobre`: julgar pelo ponto médio deixava a quina da peça
    # do lado de fora do vão, onde o canal recomeça.
    _, _rm0, _, _ = _cell_arco(_i, _jj)
    _mv = math.degrees((CANAL_ANEL_SEC/2 + CANAL_TALUDE) / max(1.0, _rm0))
    _g0v = (_jj / N_RAIOS0) * 360.0 - _mv
    _g1v = ((_jj + _ns) / N_RAIOS0) * 360.0 + _mv
    _vivo = [an for k, an in enumerate(CANAL_ANEIS) if not vao_cobre(k, _g0v, _g1v)]
    if any(p0 + 1.0 < an < p1 - 1.0 for an in _vivo): return None
    c0 = any(abs(an - p0) <= 1.0 for an in _vivo)
    c1 = any(abs(an - p1) <= 1.0 for an in _vivo)
    _, rm, _, _ = _cell_arco(_i, _jj)
    mid = ((_jj + _ns / 2) / N_RAIOS0) * 2*math.pi
    r0m = _borda_r(mid, p0, c0, True)
    r1m = _borda_r(mid, p1, c1, False)
    prof = (r1m - r0m) / 2
    if prof < 40: return None
    g0 = (_jj / N_RAIOS0) * 360.0
    g1 = ((_jj + _ns) / N_RAIOS0) * 360.0
    # ⚠️ O RECUO ANGULAR SAI DO RAIO INTERNO, não do médio. O canal radial é uma
    # RETA e o recuo é um ângulo: no raio de dentro o mesmo ângulo vale menos
    # arco, e o canto interno da peça entrava no corredor. Medido com o raio
    # médio: sete peças ainda com o leito inteiro por cima, todas com o radial na
    # divisa. Pelo raio interno o recuo vale 42 m em toda a altura da peça.
    rec_ang = math.degrees((CANAL_RAD_SEC/2 + CANAL_TALUDE) / max(1.0, r0m))
    d0 = d1 = 0.0
    for cr in CANAL_RADIAIS:
        d = ((cr - g0) % 360.0)
        larg_ang = (g1 - g0) % 360.0 or 360.0
        if 1e-6 < d < larg_ang - 1e-6: return None       # radial no meio: talho
        if d <= 1e-6 or d >= 360.0 - 1e-6: d0 = rec_ang
        if abs(d - larg_ang) <= 1e-6: d1 = rec_ang
    cel = (2*math.pi*rm) / N_RAIOS0
    larg = (_ns * cel - (d0 + d1) * math.pi/180.0 * rm) / 2
    if larg < 40: return None
    return prof, larg, c0, c1, d0, d1

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
            # pré-filtro barato: o recuo do canal só DIMINUI a profundidade, então
            # se ela já é curta sem recuo não adianta seguir. O teto se confere
            # depois, com o valor real que `_janela` devolve.
            _prof = (_PHI_B[_i + _nr] - _PHI_B[_i]) / 2 - VIA_CONTORNO / 2
            if _prof < _b0 * 0.45: continue
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
                    # ⚠️ E A CRATERA DA GUERRA TAMBÉM REPROVA A JANELA. Ela é
                    # infraestrutura da fase 1 como o canal: lugar do mundo, com
                    # câmera e HUD próprios. Sem isto o Parque Olímpico volta a
                    # cair em cima dela.
                    if _janela_pega_guerra(_i, _nr, _jj, _ns): continue
                    if _janela_no_lago(_i, _nr, _jj, _ns): continue
                    _jan = _janela(_i, _nr, _jj, _ns)
                    if _jan is None: continue
                    _prof, _larg, _c0_, _c1_, _dg0_, _dg1_ = _jan
                    if _prof < _b0 * 0.45 or _prof > _b0 * 2.4: continue
                    if _larg < _a0 * 0.45: continue
                    _amm, _rmm, _, _ = _cell_arco(_i, _jj)
                    _amc = ((_jj + _ns / 2) / N_RAIOS0) * 2*math.pi
                    _phc = (_PHI_B[_i] + _PHI_B[_i + _nr]) / 2
                    # custo: deformação nos dois eixos + quanto a peça viajou
                    _c1 = abs(_prof / _b0 - 1) + abs(_larg / _a0 - 1)
                    _c2 = abs(math.degrees(_amc) - _ru0) / 180.0 + abs(_phc - _ph0) / 3000.0
                    _cst = _c1 + _c2 * 0.8
                    if _melhor is None or _cst < _melhor[0]:
                        _melhor = (_cst, _i, _nr, _jj, _ns, _prof, _larg, _amc, _phc, _cells,
                                   _c0_, _c1_, _dg0_, _dg1_)
                    break
                if _melhor and _melhor[0] < 0.12: break
            if _melhor and _melhor[0] < 0.12: break
    if _melhor is None:
        _relato.append(f"{_q['id']} {_q['nome'][:26]}: NÃO COUBE, ficou onde estava")
        continue
    _cst, _i, _nr, _jj, _ns, _prof, _larg, _amc, _phc, _cells, _c0, _c1, _dg0, _dg1 = _melhor
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
    # ⚠️ O POLÍGONO USA O RECUO DE `_janela`, não os 6 m da rua comum. Onde a
    # divisa carrega canal o recuo é o corredor inteiro: é isso que faz a borda
    # da peça virar cais em vez de barranco dentro d'água.
    _pol = []
    _ga0 = (_jj / N_RAIOS0) * 360.0 + _dg0
    _ga1 = ((_jj + _ns) / N_RAIOS0) * 360.0 - _dg1
    _passos = max(2, int(_ns * 3))
    for _t in range(_passos + 1):
        _aa = math.radians(_ga0 + (_ga1 - _ga0) * _t / _passos)
        _rr = _borda_r(_aa, _PHI_B[_i], _c0, True)
        _pol.append([round(math.sin(_aa) * _rr, 1), round(-math.cos(_aa) * _rr, 1)])
    for _t in range(_passos, -1, -1):
        _aa = math.radians(_ga0 + (_ga1 - _ga0) * _t / _passos)
        _rr = _borda_r(_aa, _PHI_B[_i + _nr], _c1, False)
        _pol.append([round(math.sin(_aa) * _rr, 1), round(-math.cos(_aa) * _rr, 1)])
    _q['poly'] = _pol
    _alocadas += 1
    if _dx > 120: _movidas += 1
# ── SEGUNDA PASSADA: A PEÇA QUE NÃO COUBE MUDA DE PROPORÇÃO ────────────────
#
# ⚠️ FICAR ONDE ESTAVA É O PIOR DESFECHO. Quem não achou bloco livre de canal
# ficava na coordenada congelada, que é justamente onde o canal passa por cima:
# o Parque Olímpico saía com 4,60 m de vala atravessando ele. Melhor mudar de
# forma do que ficar debaixo d'água — e é o que o fundador mandou fazer desde o
# começo: "se for grande demais pra caber entre os canais, jogue pra borda,
# gire, ajuste, posicione dentro do quarteirão".
#
# ⚠️ E A ÁREA É O QUE SE PRESERVA, NÃO O FORMATO. O Parque Olímpico tem 1.080 m
# de lado e 116,6 ha; os anéis de canal ficam a cada ~600 m de φ, então NENHUMA
# janela livre de canal tem 1.080 m de fundo, em raio nenhum. Larga e rasa ele
# cabe: na borda o arco é longo e os radiais estão a 45°, ou seja 3.900 m de vão
# em r 5.000. A busca vai da BORDA para dentro porque é lá que há arco sobrando.
_segunda = [q for q in _fila if q.get('forma') != 'celula']
for _q in _segunda:
    _a0, _b0 = _q['a'], _q['b']
    _area0 = 4 * _a0 * _b0
    _achou = None
    for _i in range(len(_PHI_B) - 2, -1, -1):          # de fora para dentro
        for _nr in (1, 2, 3):
            if _i + _nr >= len(_PHI_B): break
            for _jj in range(N_RAIOS0):
                _, _rmm, _, _ = _cell_arco(_i, _jj)
                _cel = (2*math.pi*_rmm) / N_RAIOS0
                _pf0 = (_PHI_B[_i + _nr] - _PHI_B[_i]) / 2 - VIA_CONTORNO / 2
                if _pf0 < 40: continue
                # largura que devolve a ÁREA original nesta profundidade
                _ns = max(1, int(round((_area0 / (2 * _pf0)) / _cel)))
                if _ns > N_RAIOS0 // 6: continue     # 60°: mais que isso sempre cruza um radial
                _cells = {(_i + _r, (_jj + _c) % N_RAIOS0)
                          for _r in range(_nr) for _c in range(_ns)}
                if _cells & _ocupado: continue
                _jan = _janela(_i, _nr, _jj, _ns)
                if _jan is None: continue
                _achou = (_i, _nr, _jj, _ns) + _jan
                break
            if _achou: break
        if _achou: break
    if not _achou:
        _relato.append(f"{_q['id']} {_q['nome'][:26]}: nem na segunda passada")
        continue
    _i, _nr, _jj, _ns, _prof, _larg, _c0, _c1, _dg0, _dg1 = _achou
    _ocupado |= {(_i + _r, (_jj + _c) % N_RAIOS0) for _r in range(_nr) for _c in range(_ns)}
    _amc = ((_jj + _ns / 2) / N_RAIOS0) * 2*math.pi
    _phc = (_PHI_B[_i] + _PHI_B[_i + _nr]) / 2
    _r = raio_em_phi(_amc, _phc)
    _q['cx'], _q['cz'] = math.sin(_amc) * _r, -math.cos(_amc) * _r
    _q['a'], _q['b'] = _larg, _prof
    _q['rot'] = math.degrees(_amc) % 360
    _q['c'], _q['s'] = math.cos(_amc), math.sin(_amc)
    _q['area'] = 4 * _larg * _prof
    _q['celulas'] = [_nr, _ns]
    _q['forma'] = 'celula'
    _q['cel'] = {'i': _i, 'nr': _nr, 'j': _jj, 'ns': _ns,
                 'phi0': _PHI_B[_i], 'phi1': _PHI_B[_i + _nr],
                 'a0': (_jj / N_RAIOS0) * 360.0, 'a1': ((_jj + _ns) / N_RAIOS0) * 360.0}
    _pol = []
    _ga0 = (_jj / N_RAIOS0) * 360.0 + _dg0
    _ga1 = ((_jj + _ns) / N_RAIOS0) * 360.0 - _dg1
    _passos = max(2, int(_ns * 3))
    for _t in range(_passos + 1):
        _aa = math.radians(_ga0 + (_ga1 - _ga0) * _t / _passos)
        _rr = _borda_r(_aa, _PHI_B[_i], _c0, True)
        _pol.append([round(math.sin(_aa) * _rr, 1), round(-math.cos(_aa) * _rr, 1)])
    for _t in range(_passos, -1, -1):
        _aa = math.radians(_ga0 + (_ga1 - _ga0) * _t / _passos)
        _rr = _borda_r(_aa, _PHI_B[_i + _nr], _c1, False)
        _pol.append([round(math.sin(_aa) * _rr, 1), round(-math.cos(_aa) * _rr, 1)])
    _q['poly'] = _pol
    _alocadas += 1
    print(f"  2a passada: {_q['id']} {_q['nome'][:24]} -> r {_r:.0f}, "
          f"{2*_larg:.0f} x {2*_prof:.0f} m ({_q['area']/1e4:.0f} ha, era {_area0/1e4:.0f})",
          file=sys.stderr)

print(f'peças alocadas na teia: {_alocadas} de {len(_fila)} '
      f'({_movidas} tiveram de mudar de lugar)', file=sys.stderr)
for _w in _relato:
    print(f'  {_w}', file=sys.stderr)

# ── O CEMITÉRIO GANHA CHÃO (masterplan §17.1, decidido em 20/09) ────────────
#
# ⚠️ DECISÃO TRAVADA QUE NUNCA VIROU CÓDIGO. O §17.1 manda o cemitério entrar no
# PROGRAMA "como as outras 52", e até 22/09 ele existia só como
# data/dogcity_cemiterio.csv: 15.802 lápides sem um metro quadrado reservado.
# Desenhar depois do snapshot poria 9,6 ha de lápide em cima de lote já
# prometido, que é a regra de ouro do §5 ao contrário.
#
# ⚠️ ELE ENTRA POR APPEND, DEPOIS DO CONGELAMENTO, E ESCREVER EM `PROGRAMA_MALHA`
# NÃO FUNCIONA. O gerador lê data/dogcity_programa_congelado.json e SUBSTITUI
# `PROGRAMA_GEO` inteiro: peça escrita na tabela some sem erro nenhum. É o mesmo
# caminho das 7 parcelas ancoradas (`_ANCORAS`).
#
# ⚠️ E ELE ENTRA DEPOIS DO ENCAIXE NA TEIA, NÃO ANTES, E ISSO É O CONSERTO. O
# `_fila` acima pega TODA peça `forma == 'retangulo'` sem `borda` e sem
# `produtivo` e REESCREVE cx, cz, a, b, rot e area com a célula da teia. A prova
# é o G01: nasce com a=430, b=145 e rumo 43 e saiu no registro selado como
# `forma: 'celula'`, a=338,1, b=148,9, rumo 98,4. Andou 55° e perdeu 4,8 ha,
# calado. E as bandas `_PHI_B` terminam em φ 6.500, então um cemitério appendado
# antes do encaixe seria PUXADO PARA DENTRO do tecido.
#
# ⚠️ O LUGAR: PLATÔ DO PÓDIO, e ele custa ZERO lote de holder. O tecido para em
# φ 6.500 e o platô vai de r 6.950 a 7.150 (PODIO_R1/PODIO_R2), com declive
# 0,00° em 360 rumos. Medido no registro selado: no rumo 288 o lote mais externo
# está em r 5.770, e em TODA a cidade só 366 lotes passam de 6.950, nenhum deles
# neste quadrante. A frente de rua já existe: a AN7, círculo de 44 m em r 6.950.
#
# ⚠️ O RUMO 231,25 FOI MEDIDO E REPROVOU, apesar de ser o que o levantamento
# recomendava. Teste do eixo separador com os quatro cantos contra as 71 peças
# publicadas: um retângulo de 540 x 178 m ali BATE na VP02 Floresta de
# Extrativismo (r 6.762, rumo 236,1, 1.280 x 840 m), e o canto externo dele cai
# em 7.155,1 m, cinco metros ALÉM de PODIO_R2. O rumo 288 passa nos dois: zero
# peça, canto externo 7.150,0 exatos.
# 🔓 O RUMO É DO FUNDADOR (masterplan.md §17.1 ainda diz "o lugar ainda não está
# escolhido"). 288,0 é um valor MEDIDO como livre, não uma decisão tomada aqui.
#
# ⚠️ O RETÂNGULO É INSCRITO NA COROA, NÃO CENTRADO NELA. Aresta reta em anel põe
# o CANTO para fora: com a=270 e b=89 em r 7.061 os cantos chegam a 7.155. Com
# a=278, b=86,3 e r 7.058,3 a borda interna fica em 6.972,0 (fora dos 22 m
# externos da AN7) e o canto em 7.150,0 exatos.
# 15.802 sepulturas de 1,5 x 3,0 m = 7,11 ha, mais 35% de alameda e bosque =
# 9,60 ha. Aqui: 556 m de testada por 172,6 m de fundo = 9,60 ha.
CEM_RUMO, CEM_R = 288.0, 7058.3       # 🔓 rumo pendente do fundador (§17.1)
CEM_A, CEM_B = 278.0, 86.3            # meias-medidas: tangencial e radial
_cr = math.radians(CEM_RUMO)
PROGRAMA_GEO.append({
    'id': 'K01', 'nome': 'Campo do Columbário', 'tipo': 'civico',
    'forma': 'retangulo',
    'cx': math.sin(_cr) * CEM_R, 'cz': -math.cos(_cr) * CEM_R,
    'a': CEM_A, 'b': CEM_B, 'rot': CEM_RUMO,
    'c': math.cos(_cr), 's': math.sin(_cr),
    'area': 4 * CEM_A * CEM_B, 'cemiterio': True,
})
print('Campo do Columbário em r %.0f (rumo %.2f), %.0f x %.0f m, %.2f ha, '
      'entre PODIO_R1 %.0f e PODIO_R2 %.0f'
      % (CEM_R, CEM_RUMO, 2*CEM_A, 2*CEM_B, 4*CEM_A*CEM_B/1e4, PODIO_R1, PODIO_R2),
      file=sys.stderr)
# ⚠️ GUARDA DURA: o canto do retângulo não pode furar o platô. Ela roda agora,
# em três milissegundos, e não depois de dezenas de minutos de rodada.
_kc = max(math.hypot(math.sin(_cr)*CEM_R + _sx*CEM_A*math.cos(_cr) - _sz*CEM_B*math.sin(_cr),
                    -math.cos(_cr)*CEM_R + _sx*CEM_A*math.sin(_cr) + _sz*CEM_B*math.cos(_cr))
          for _sx in (-1, 1) for _sz in (-1, 1))
assert CEM_R - CEM_B >= PODIO_R1 + 20.0 and _kc <= PODIO_R2 + 0.5, \
    f'o Campo do Columbário fura o platô: borda {CEM_R - CEM_B:.1f}, canto {_kc:.1f}'

# ⚠️ A CADEIA VEM ANTES DAS FAZENDAS, e isso é ordem de projeto e não capricho.
# Ela é a peça mais RESTRITA do cinturão: as sete plantas têm de ficar contíguas
# e em sequência, senão o minério atravessa a cidade entre uma etapa e outra. As
# fazendas, ao contrário, são doze peças iguais que cabem em qualquer vaga. Com
# as fazendas primeiro, a fila não achava sequência livre e se espalhava por
# 183°, 192°, 200°, 134°, 142°, 76° e 9° — pior do que antes de eu mexer. O mais
# restrito escolhe primeiro; o resto acomoda em volta.
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
# ⚠️ A MESMA GUARDA DO CINTURÃO, pelo mesmo motivo: com a doca em 5.492 os oito
# radiais passaram a chegar aqui, e Beneficiamento, Eletrólise, Célula Solar e a
# Floresta de Extrativismo ficaram com 4,60 m de vala por dentro.
# ⚠️ A CADEIA VIRA UM DISTRITO, NÃO SETE ILHAS (fundador, 30/08: "pode colocar
# onde ficar melhor"). Elas estavam em 76°, 104°, 194°, 225°, 284°, 315° e 346°:
# o minério saía do Beneficiamento e ATRAVESSAVA A CIDADE INTEIRA para chegar à
# Redução, e da Redução voltava para a Eletrólise. Cadeia de suprimento não se
# espalha, se enfileira — é o que faz um distrito industrial ler como distrito.
#
# O setor escolhido é o SUDOESTE, e não por gosto: é onde a Boca da Autopista 3
# desemboca (rumo 174–180), ou seja o único trecho do cinturão que já tem TÚNEL
# para escoar sem cruzar a cidade. As sete plantas correm em sequência ao longo
# da Avenida de Escoamento, na ordem do processo, com a mineração (fora da
# abóbada, rumo 191–315) do lado de fora e a fundição na ponta de dentro.
_AN_ESC = next((a for a in ANEIS if a[1] == 'Avenida de Escoamento'), None)
# ⚠️ PELO LADO DE DENTRO DA AVENIDA. Pelo lado de fora a fila ficava com a borda
# em r 7.192, atravessando a casca (7.050): quatro das sete plantas ficariam no
# vácuo, e indústria é guarnecida. Do lado de dentro a borda fica em 6.448.
_r_ind = _AN_ESC[2] - _AN_ESC[3] / 2 - 330.0 - 25.0 if _AN_ESC else 6300.0
_ru_ind = min(_BUL_RUMOS, key=lambda b: abs(((b - 180.0 + 180) % 360) - 180))
_ind_mex = 0
_ant_a = 0.0                      # meia-largura da planta anterior, para o passo
for _nome, _tipo, _ru0, _ph, _a, _b in _IND:
    # ⚠️ O PASSO É CUMULATIVO E USA AS DUAS LARGURAS. A versão anterior andava
    # `2a + 90` da peça ATUAL, então uma planta estreita depois de uma larga
    # caía em cima da vizinha: sete sobreposições, todas dentro da própria fila.
    # Numa fila, o vão entre dois vizinhos é meia largura de cada um mais a via.
    _vao = math.degrees((_ant_a + _a + 90.0) / _r_ind)
    _ru = (_ru_ind + _vao) % 360.0
    _dg = math.degrees((_a + CANAL_RAD_SEC / 2 + CANAL_TALUDE) / _r_ind)
    _mi = math.hypot(_a, _b)
    _extra = math.degrees((_a + 60.0) / _r_ind)
    for _ in range(N_RAIOS0 * 2):
        _xx = math.sin(math.radians(_ru)) * _r_ind
        _zz = -math.cos(math.radians(_ru)) * _r_ind
        # ⚠️ E O LAGO ENTRA AQUI TAMBÉM. A fila industrial não passa por
        # `assenta_no_cinturao`: ela tem laço próprio, que só media canal e
        # ocupação. Medido em 30/08, foi a última peça na água depois de as duas
        # outras máscaras entrarem — a Fundição, com 9,1% dela sobre 39,8 m de
        # lago. Avançar o rumo preserva a ORDEM DO PROCESSO, que é o que faz a
        # cadeia ler como distrito.
        _bate = any(abs(((_cr - _ru + 180) % 360) - 180) < _dg for _cr in CANAL_RADIAIS) \
             or _pega_lago(_ru, _r_ind, _a, _b) \
             or any(math.hypot(_xx - px, _zz - pz) < _mi + pm + 40.0 for px, pz, pm in _CINT_POSTAS)
        if not _bate: break
        _ru = (_ru + _extra) % 360.0
    _CINT_POSTAS.append((math.sin(math.radians(_ru)) * _r_ind,
                         -math.cos(math.radians(_ru)) * _r_ind, _mi))
    _ru_ind, _ant_a = _ru, _a
    _r = _r_ind
    _ang = math.radians(_ru)
    _ind_mex += 1
    PROGRAMA_GEO.append({
        'id': f'IN{_ni+1:02d}', 'nome': _nome, 'tipo': _tipo, 'forma': 'retangulo',
        'cx': math.sin(_ang)*_r, 'cz': -math.cos(_ang)*_r, 'a': _a, 'b': _b, 'rot': _ru,
        'c': math.cos(_ang), 's': math.sin(_ang), 'area': 4*_a*_b, 'produtivo': True,
    })
    _ni += 1


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
for _i in range(12 if SERIE_NUMERADA else 0):
    _PROD.append(('FZ', f'Fazenda de Proteína {_i+1}', 'producao',
                  rumo_de_raio(15.0 + _i * 30.0), 5900.0, 620.0, 380.0))
# ⚠️ O CAMPO DE GOLFE (fundador, 30/08). 18 buracos pedem 50 a 70 ha, e o
# cinturão produtivo é onde isso cabe sem tirar lote: ele tem 2.600 m de faixa e
# estava ralo demais para ler como cinturão, que é o defeito que eu mesmo apontei
# na última chapa. Golfe é verde, é grande e é lazer: ocupa bem e dá conteúdo.
#
# ⚠️ MUDOU DE TAMANHO E DE LUGAR EM 08/09/2026, e as duas coisas são medição.
# Plano em golfe.md. O fundador travou a escala em 18 buracos CURTOS (par 3
# lunar), e é a física que dá o tamanho: em 1/6 g o alcance vai a 6,035x, então
# o buraco médio tem 480 m e o corredor de jogo 100 m de largura, contra 361 e
# 60 na Terra. São 8,64 km de jogo em 18 corredores, 86,4 ha só de corredor, e
# 160 ha com green, rough, bunker e clubhouse. Os 84,32 ha de antes eram a área
# de um campo TERRESTRE, onde um único drive voa 1.509 m e atravessa quatro
# buracos.
#
# ⚠️ E O SÍTIO ANTIGO ERA NO DISTRITO INDUSTRIAL. Medido: rumo 315° punha a
# Fábrica de Célula Solar a 1.377 m e a Fundição a 2.306 m do centro do campo.
# O rumo novo é o único trecho do cinturão que junta as cinco coisas que golfe
# pede, varrido em 21 rumos x 3 raios com a pegada nova sondada a cada 25 m:
# seco (0,0% abaixo da lâmina), declive mediano de 2,72° com p90 de 8,06° (o
# fairway acompanha o chão e só os greens são escavados), 2.081 m de folga até o
# lote mais externo, o Lago do Poente a 783 m de borda, e a indústria a mais de
# 3,6 km. Dentro da casca, logo com ar.
#
# ⚠️ O φ AQUI É PONTO DE PARTIDA, NÃO ENDEREÇO. Quem decide é
# `assenta_no_cinturao`: ele encosta a peça num anel viário por um lado e num
# bulevar pelo outro. Com meia_b 400 a vaga escolhida é AN6 + (34/2 + 400 + 25)
# = r 6.742, e φ 7.650 é o número que põe r0 exatamente ali, para o custo de
# raio ser zero. No rumo, a vaga é o Bulevar 180° menos o meio-arco de 8,855°,
# ou seja 171,145°: o campo encosta no bulevar e o clubhouse nasce nessa ponta.
# Mexer em meia_a ou meia_b MOVE A PEÇA, porque as duas entram na conta da vaga.
_PROD.append(('GF', 'Campo de Golfe', 'lazer', rumo_de_raio(171.0), 7650.0, 1000.0, 400.0))
for _i in range(6 if SERIE_NUMERADA else 0):
    _PROD.append(('LP', f'Lago de Pesca {_i+1}', 'agua',
                  rumo_de_raio(30.0 + _i * 60.0), 6550.0, 460.0, 260.0))
_np = 0
# ⚠️ O CINTURÃO COMEÇA DEPOIS DO CAIS DA DOCA. A doca (CA07) é a última linha de
# anel do tecido, e o cinturão produtivo mora logo além dela: sem esta guarda a
# doca nascia por cima de dez Fazendas de Proteína, do Campo de Golfe e de três
# plantas industriais, com 4,60 m de vala. Estas peças não passam pelo alocador
# — são postas por rumo e φ — então a checagem tem de vir aqui, e a regra é a
# mesma das outras: quem cede é a peça, porque o canal é infraestrutura da fase 1.
_empurradas = 0
for _pre, _nome, _tipo, _ru, _ph, _a, _b in _PROD:
    _ang = math.radians(_ru)
    _r = raio_em_phi(_ang, _ph)
    if _r <= 0: continue
    _ru, _r = assenta_no_cinturao(_ru, _ph, _a, _b, _tipo in _TIPOS_COM_AR)
    _ang = math.radians(_ru)
    _empurradas += 1
    PROGRAMA_GEO.append({
        'id': f'{_pre}{_np+1:02d}', 'nome': _nome, 'tipo': _tipo,
        'forma': 'elipse' if _pre == 'LP' else 'retangulo',
        'cx': math.sin(_ang) * _r, 'cz': -math.cos(_ang) * _r,
        'a': _a, 'b': _b, 'rot': _ru,
        'c': math.cos(_ang), 's': math.sin(_ang),
        'area': (math.pi if _pre == 'LP' else 4) * _a * _b, 'produtivo': True,
    })
    _np += 1
print(f'cinturão produtivo: {_np} peças ({_empurradas} empurradas para fora do cais da doca) entre φ {PHI_PRODUTIVO:.0f} e {R_ABOBADA:.0f} '
      f'({sum(q["area"] for q in PROGRAMA_GEO if q.get("produtivo"))/1e4:.0f} ha)', file=sys.stderr)

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

# ── A ECLUSA É UM TÚNEL, NÃO UMA PORTA NA CASCA ────────────────────────────
#
# ⚠️ MUDANÇA DE 30/08, do fundador: "faz sentido a entrada e saída da abóbada ser
# por uma sequência de túneis, com estágios e divisões? Fazer uma porta e várias
# camadas de proteção na abóbada creio ser mais trabalho. O foguete aterrissa, as
# dog embarcam no veículo, entram no túnel e já saem lá dentro."
#
# Ele está certo, e por três razões que se medem:
#   1. ABERTURA EM CASCA DE PRESSÃO é o ponto mais caro de toda a estrutura. A
#      abóbada é uma membrana: o esforço corre por ela e toda abertura obriga a
#      rotear esse esforço em volta, com anel de borda dimensionado à parte. O
#      túnel passa POR BAIXO e não toca a casca — ela segue contínua, que é o que
#      o fundador exigiu quando pediu um domo só, sem junta.
#   2. VOLUME BOMBEADO. Câmara que engole veículo tem dezenas de milhares de m³
#      para pressurizar a cada ciclo; um túnel de 26 m é uma fração disso.
#   3. A CAMADA JÁ EXISTE. As três autopistas correm em AUTO_COTA (−42 m) e o
#      metrô em −26. O túnel de entrada não inventa nível novo: entra na mesma
#      laje, e a fundação da saia da abóbada (embutida 8 m) passa 47 m acima.
#
# ⚠️ E A VERSÃO ANTERIOR TINHA AS CÂMARAS FORA DE ORDEM. A distância de cada uma
# saía de `r_borda + raio*1,6*(i+1)`, ou seja do raio DELA MESMA, e como os raios
# decresciam (260, 170, 110) a terceira câmara caía em r 7.568, ANTES da segunda
# em 7.584. Agora a posição é acumulada ao longo do eixo, que é como fila funciona.
ECLUSA_TUNEL_LARG = 26.0        # mesma caixa das autopistas
ECLUSA_PASSO = 300.0            # entre câmaras, ao longo do eixo

def _eclusa(nome, rumo, r_externo, r_interno):
    """O túnel de entrada: portal externo, três câmaras em série sob a casca,
    portal interno. Tudo em AUTO_COTA; só os portais sobem à superfície."""
    a = math.radians(rumo)
    pos = lambda r: (round(math.sin(a) * r, 1), round(-math.cos(a) * r, 1))
    # as três câmaras straddleiam a casca: uma fora, uma sob ela, uma dentro
    cam = []
    for i, papel in enumerate(('externa', 'equalizacao', 'interna')):
        r = R_CASCA + ECLUSA_PASSO * (1 - i)
        x, z = pos(r)
        cam.append({'ordem': i + 1, 'papel': papel, 'raio': 110.0,
                    'x': x, 'z': z, 'r': round(r, 1), 'profundidade': AUTO_PROF})
    px, pz = pos(r_externo)
    ix, iz = pos(r_interno)
    return {'id': f'EC{nome}', 'nome': f'Eclusa {nome}', 'rumo': rumo,
            'cota': AUTO_COTA, 'profundidade': AUTO_PROF, 'largura': ECLUSA_TUNEL_LARG,
            'comprimento': round(abs(r_externo - r_interno), 1),
            'portalExterno': {'x': px, 'z': pz, 'r': round(r_externo, 1)},
            'portalInterno': {'x': ix, 'z': iz, 'r': round(r_interno, 1)},
            'camaras': cam,
            'nota': 'tunel sob a casca, 35 m abaixo da superficie: o veiculo entra pelo portal '
                    'externo, passa tres camaras em serie e sobe dentro da cidade. '
                    'A casca nao e perfurada.'}

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
    # ⚠️ A MESMA GUARDA DO CINTURÃO. Estas três também são postas por rumo e φ,
    # sem passar pelo alocador, e a Floresta de Extrativismo era a última peça da
    # cidade ainda com ÁGUA DE CANAL por cima.
    _ru, _r = assenta_no_cinturao(_ru, _ph, _a, _b, _tipo in _TIPOS_COM_AR)
    _ang = math.radians(_ru)
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
    # ⚠️ E ESTE BLOCO RODA DEPOIS DO ASSENTAMENTO, sem consultar nada. É o padrão
    # de falha que já mordeu três vezes nesta cidade: alguém move a peça DEPOIS e
    # desfaz a decisão de quem mediu. Medido em 30/08: `assenta_no_cinturao` tirou
    # 10 das 11 peças da água e este empurrão pôs a Fundição de volta, 9,1% dela
    # sobre 39,8 m de lago. Agora, se o destino é molhado, ela anda pelo anel até
    # achar terra seca — o raio é o que a casca exige, o rumo é negociável.
    _ru_ = math.degrees(_ang) % 360.0
    if _pega_lago(_ru_, _novo, _q['a'], _q['b']):
        for _k in range(720):
            for _sg in (1, -1):
                _c = (_ru_ + _sg * _k * 0.5) % 360.0
                if not _pega_lago(_c, _novo, _q['a'], _q['b']):
                    _ang = math.radians(_c); _ru_ = _c
                    break
            else: continue
            break
    _q['cx'], _q['cz'] = math.sin(_ang) * _novo, -math.cos(_ang) * _novo
    _q['rot'] = _ru_
    _q['c'], _q['s'] = math.cos(_ang), math.sin(_ang)
    _q['borda'] = not _dentro
    _ajust += 1
print(f'peças que atravessavam a casca, empurradas para um lado só: {_ajust}', file=sys.stderr)

EXTRACAO = []
for _i in range(8):
    _ru = rumo_de_raio(190.0 + _i * 18.0)       # o arco oposto ao parque (rumo 43)
    if abs(((_ru - PARQUE_RUMO + 180) % 360) - 180) < 40: continue
    # ⚠️ +2.000 EM 02/09, JUNTO COM A CASCA. A extração é industrial e mora FORA
    # do vidro, no arco oposto ao parque. Com a casca indo de 7.050 para 9.050, os
    # anéis de 7.600 e 8.600 passariam a ficar DENTRO da cidade.
    for _j, _rr in enumerate([9600.0, 10600.0]):
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

def _bloco(wx, wz, giro, k, frente, d, banda, nome, prof):
    """Monta um quarteirão da teia e sonda quais lotes dele sobrevivem.

    ⚠️ O QUARTEIRÃO DA TEIA NÃO É QUADRADO: a TESTADA é o arco (tangencial,
    variável, 95 a 150 m) e a PROFUNDIDADE é o vão entre anéis (radial, 109/168/
    227 conforme a banda). Publicar um `lado` só faria a cena desenhar contorno
    quadrado sobre trapézio.

    ⚠️ §36: `prof` DEIXOU DE SER `_lado(k)` E PASSOU A SER PARÂMETRO. Ele
    chega já medido por `tecido()` como o vão real entre as duas FACES de anel
    da teia que fecham este quarteirão específico, no rumo `giro`. Calcular
    `_lado(k)` aqui de novo (o valor nominal da classe) ignoraria o rumo e
    voltaria a publicar um quarteirão que pode ser maior que o vão, cruzando a
    rua da teia.
    """
    ca, sa = math.cos(giro), math.sin(giro)
    cols = max(1, int(frente // LOTE_W))
    lotes = []
    for zlote, _b, _s in _z_das_filas(k, prof):
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
    # ⚠️ LAÇO SEM CONTADOR É CEGO, e este laço decide a cidade inteira. Cada
    # motivo de rejeição tem conserto diferente: célula tomada por peça, testada
    # abaixo do piso, quarteirão abaixo do mínimo de 8 lotes.
    _ref = collections.Counter()
    for ia, (p0, p1, nome, k) in enumerate(_aneis()):
        # ⚠️ §36: R0/R1 SÃO OS DOIS ANEIS DA TEIA QUE FECHAM ESTE QUARTEIRÃO,
        # não mais o meio de φ. `_FRONTEIRA_ANEL` casa cada fronteira de banda
        # com um anel da teia (ver o comentário da função), e como p0/p1 são
        # compartilhados entre quarteirões vizinhos (a banda seguinte começa
        # onde esta termina), o anel escolhido também é: nenhuma costura nasce
        # entre dois quarteirões da mesma sequência radial.
        R0, R1 = _FRONTEIRA_ANEL[p0], _FRONTEIRA_ANEL[p1]
        # ⚠️ A DIVISA NASCE NO RADIAL DA TEIA, E ESTE É O CONSERTO ESTRUTURAL DO
        # §25.1. Com `n_raios(pm)` (64/128/256) a divisa caía a 63,2 m de mediana
        # do radial ATIVO mais próximo e 68,9% das pontas de travessa morriam
        # cortadas em 90 m sem achar radial nenhum. Com `_teia_n(p0)` a divisa É
        # o radial: j/84 são os índices PARES de 168 e j/168 são todos, ou seja
        # radial ATIVO por construção, em todo anel e em todo rumo.
        # Simulado sobre a grade selada antes de gastar a rodada: células
        # 3.072 -> 2.856 (-7,0%), capacidade geométrica 333.572 -> 327.146
        # vagas (-1,9%) contra 69.995 lotes de carteira, ou seja 4,7x a demanda;
        # testada mínima 105,8 -> 97,0 m, ainda 8 colunas contra o piso de 3;
        # NENHUMA célula reprovada pelo piso em nenhuma das duas versões.
        # ⚠️ É `p0` E NÃO `pm`. Com o ponto médio, o anel 13 (pm 3.607) viraria
        # 168 enquanto a borda de dentro dele ainda está aquém da dobra em parte
        # dos rumos, que é exatamente o erro que `TEIA_PHI_DOBRA` evita.
        n = _teia_n(p0)
        # ⚠️ A TRADUÇÃO PARA A BASE TEM DE SER EXATA, senão a máscara de peça
        # mente. Com N_RAIOS0 = 84 ela é: 84/84 = 1 e 168/84 = 2.
        assert n % N_RAIOS0 == 0, f'grade do tecido ({n}) não é múltipla da base ({N_RAIOS0})'
        for j in range(n):
            # ⚠️ A CÉLULA OCUPADA POR PEÇA NÃO GERA QUARTEIRÃO, E ISTO É A CORREÇÃO
            # QUE FALTAVA. O alocador já rodava ANTES do tecido, mas o tecido não o
            # consultava: ele montava o quarteirão inteiro e só depois cada lote era
            # recusado por `em_programa`. Quarteirão meio comido cai abaixo do
            # mínimo de 8 lotes e é DESCARTADO INTEIRO, então o buraco ficava maior
            # que a peça e a peça parecia jogada por cima. Como o fundador disse: o
            # problema é colocar os elementos depois da cidade toda ser gerada.
            # Agora a peça É o quarteirão, e a soma fecha.
            if (ia, (j * N_RAIOS0) // n) in _ocupado:
                _ref['peça'] += 1; continue
            am = ((j + 0.5) / n) * 2*math.pi
            # ⚠️ §36: A FACE DO ANEL FECHA O QUARTEIRÃO, NÃO A CURVA DE NÍVEL
            # DE φ. `_teia_face_raio(R, am)` é o raio do dodecágono de vértice R
            # no rumo `am` (fórmula de `anelRaio` em teia.ts); o vão da rua
            # (VIA_CONTORNO) fica centrado exatamente nessa face, dos dois
            # lados. Antes disto o quarteirão nascia entre duas curvas de φ
            # (redondas, ou superelipse fora do núcleo) e a rua desenhada, que
            # é dodecágono desde o primeiro anel, cortava por dentro em 85,7%
            # dos 2.071 quarteirões medidos em 22/09.
            r_in = _teia_face_raio(R0, am) + VIA_CONTORNO / 2
            r_out = _teia_face_raio(R1, am) - VIA_CONTORNO / 2
            prof = r_out - r_in
            # ⚠️ VÃO MENOR QUE O QUARTEIRÃO MAIS RASO NÃO VIRA TECIDO. Isto só
            # dispara onde as duas grades divergem mais (nota de `_casa_aneis_
            # teia`, banda Horizonte) ou numa extrapolação fora do alcance da
            # teia; contado à parte para nunca ficar invisível dentro de
            # 'testada' ou 'poucos'.
            if prof < _lado(2) * 0.6:
                _ref['vão'] += 1; continue
            rm = (r_in + r_out) / 2
            cx, cz = math.sin(am)*rm, -math.cos(am)*rm
            d = distrito_de(cx, cz)
            # ⚠️ A TESTADA É A CORDA NA BORDA DE DENTRO, NÃO O ARCO NO MEIO, e
            # este é um segundo defeito, independente da grade. A fileira de lote
            # é uma RETA que vai até a borda INTERNA do quarteirão, onde o vão
            # angular vale menos metros; medir pelo arco do raio MÉDIO fazia o
            # canto do lote mais externo invadir o vão de 12 m que ele mesmo
            # reservou para a rua. Medido na grade selada: o canto chegava a
            # 1,96 m do eixo do radial, dentro da pista de 7 m, com mediana de
            # 3,40 m. Com a corda na borda de dentro o mínimo é 6,00 m e nenhum
            # canto entra na seção.
            # ⚠️ §36: `r_in` JÁ É A BORDA DE DENTRO MEDIDA (a face do anel R0
            # menos meia rua), então entra direto onde antes entrava
            # `rm - _lado(k)/2`, que era a mesma borda só que aproximada por φ.
            frente = 2*(r_in * math.tan(math.pi/n) - VIA_CONTORNO/2)
            if frente < 3 * LOTE_W:
                _ref['testada'] += 1; continue
            # ⚠️ O GIRO É A TANGENTE, e a conta certa é `giro = am`. A versão da
            # Cinta usava `atan2(cos am, sin am)`, que não é tangente nem radial:
            # é o espelho, e girava a faixa externa inteira errado em silêncio.
            b = _bloco(cx, cz, am, k, frente, d, ia + 1, nome, prof)
            if b: baldes[d].setdefault(ia + 1, []).append(b)
            else: _ref['poucos'] += 1
    print('tecido: %d células varridas, %d viraram quarteirão; rejeitadas %d por peça, '
          '%d por testada abaixo de 3 lotes, %d por menos de 8 lotes vivos, %d por vão '
          'menor que o anel da teia permite'
          % (sum(_ref.values()) + sum(len(v) for b in baldes for v in b.values()),
             sum(len(v) for b in baldes for v in b.values()),
             _ref['peça'], _ref['testada'], _ref['poucos'], _ref['vão']), file=sys.stderr)
    for d in range(N_DIST):
        for banda in sorted(baldes[d]):
            bl = baldes[d][banda]
            por_dist[d].append({'banda': banda, 'nome': bl[0]['tipo'],
                                'r': sum(b['r'] for b in bl)/len(bl),
                                'quarteiroes': bl})
    return por_dist

print('medindo o tecido...', file=sys.stderr)
# ⚠️ O ORÇAMENTO DE MÁSCARA DA FAIXA LOTEÁVEL: `AUDITA_AGUA=1`. Ele responde a
# pergunta que decide terraplanagem, e que até 20/09 ninguém tinha medido: do
# terreno que está dentro da faixa de lote, quanto cada máscara come. Amostra em
# grade de 20 m, classifica na ordem em que `livre()` decide, e sai.
# ⚠️ A CONTA DA ÁGUA, BACIA POR BACIA: `AUDITA_LAGOS=1`. A água é a maior
# reserva de terra da faixa loteável (18,92 km²) e a única máscara que só se
# mexe com decisão de paisagem. Então a decisão não pode ser "drenar" ou "não
# drenar" no atacado: cada bacia vale um tanto de lote, e o fundador escolhe
# quais ficam sabendo o preço de cada uma.
if os.environ.get('AUDITA_LAGOS'):
    _pa = 20.0
    _lim = int(PHI_LOTE / _pa) + 2
    _por_lago = collections.Counter(); _cent = {}
    _DE_QUEM = {}
    for _k, _lg in enumerate(LAGOS):
        for _c0 in _lg['celulas']: _DE_QUEM[tuple(_c0)] = _k
    for _i in range(-_lim, _lim + 1):
        _x = _i * _pa
        for _j in range(-_lim, _lim + 1):
            _z = _j * _pa
            if math.hypot(_x, _z) < R_INICIO: continue
            if phi(_x, _z) > PHI_BORDA: continue
            _cel = (int(round(_x/cell + half)), int(round(_z/cell + half)))
            _k = _DE_QUEM.get(_cel)
            if _k is not None:
                _por_lago[_k] += 1
                _c = _cent.setdefault(_k, [0.0, 0.0, 0])
                _c[0] += _x; _c[1] += _z; _c[2] += 1
    # o fator bruto->lote entregue, medido: 42,84 km² entregues sobre 65,34 livres
    _FATOR = 0.6557
    print('ÁGUA DENTRO DA FAIXA LOTEÁVEL, bacia por bacia (φ %.0f)' % PHI_LOTE, file=sys.stderr)
    print('  %3s %10s %10s %8s %8s' % ('id', 'na faixa', 'vira lote', 'raio', 'rumo'), file=sys.stderr)
    _som = 0.0
    for _k, _n in _por_lago.most_common():
        _a = _n * _pa * _pa / 1e6
        _c = _cent[_k]; _cx, _cz = _c[0]/_c[2], _c[1]/_c[2]
        _som += _a * _FATOR
        print('  %3d %7.2f km² %7.2f km² %7.0f m %7.0f°'
              % (_k, _a, _a * _FATOR, math.hypot(_cx, _cz), rumo_de(_cx, _cz)), file=sys.stderr)
    print('  TOTAL: %.2f km² de água na faixa, que valem %.2f km² de lote entregue'
          % (sum(_por_lago.values()) * _pa * _pa / 1e6, _som), file=sys.stderr)
    sys.exit(0)

if os.environ.get('AUDITA_AGUA'):
    _pa = 20.0
    _conta = collections.Counter(); _tot = 0
    _lim = int(PHI_LOTE / _pa) + 2
    for _i in range(-_lim, _lim + 1):
        _x = _i * _pa
        for _j in range(-_lim, _lim + 1):
            _z = _j * _pa
            _r = math.hypot(_x, _z)
            if _r < R_INICIO: continue
            if phi(_x, _z) > PHI_BORDA: continue
            _tot += 1
            if em_lago(_x, _z, 30.0): _conta['lago'] += 1; continue
            if em_baia(_x, _z, ORLA_RESERVA): _conta['baía'] += 1; continue
            if em_canal(_x, _z, CANAL_TALUDE + 2.0): _conta['canal'] += 1; continue
            if math.hypot(_x-PCX, _z-PCZ) < parque_alcance(_x, _z) + 2: _conta['parque'] += 1; continue
            if dentro_do_coliseu(_x, _z, 2.0): _conta['coliseu'] += 1; continue
            if em_guerra(_x, _z, 2.0): _conta['cratera da guerra'] += 1; continue
            if em_programa(_x, _z) is not None: _conta['programa'] += 1; continue
            if num_anel(_x, _z) is not None: _conta['anel viário'] += 1; continue
            if em_diagonal(_x, _z, 2.0): _conta['diagonal'] += 1; continue
            _dg = declive(_x, _z)
            if _dg > DECLIVE_MAX:
                # ⚠️ SEPARA O QUE A LEI JÁ PERMITE DO QUE PRECISA DE OBRA. A
                # máscara grossa corta em 4° (7%), mas o fundador decidiu que
                # lotável vai até 12% (6,84°) na escala do lote, masterplan §15.
                # A faixa entre os dois é terra que a lei permite e o código
                # recusa; acima de 6,84° é terra que só volta com terraplanagem.
                _conta['declive 4° a 6,84° (a lei já permite)' if _dg <= 6.84
                       else ('declive 6,84° a 12° (obra leve)' if _dg <= 12.0
                             else 'declive acima de 12° (obra pesada)')] += 1
                continue
            _conta['livre'] += 1
    _km2 = lambda n: n * _pa * _pa / 1e6
    print('ORÇAMENTO DA FAIXA LOTEÁVEL (φ %.0f a %.0f): %.2f km² brutos' % (R_INICIO, PHI_LOTE, _km2(_tot)),
          file=sys.stderr)
    for _k, _v in _conta.most_common():
        print('  %-18s %7.2f km²  %5.1f%%' % (_k, _km2(_v), 100.0*_v/max(1,_tot)), file=sys.stderr)
    sys.exit(0)

# ══════════════════════════════════════════════════════════════════════════
# §37/§40 (23/09/2026): O TECIDO É A GRADE DE CÉLULAS DA TEIA DESENHADA
#
# Fundador: "Os lotes devem ter o formato de células que se encaixem, não serem
# forçados a entrar numa grade num formato diferente". Até aqui o quarteirão nascia
# em anel de φ (círculo) e o lote era retângulo com giro por bloco; a rua é
# dodecágono. Medido na cidade selada (§39): 95% dos quarteirões com rua por dentro
# e 10.465 pares de lotes sobrepostos na emenda entre quartos.
#
# Agora a célula é o trapézio entre duas faces de anel da teia (APÓTEMA `ANEIS[i]`,
# como `vias.ts` desenha) e dois radiais ativos (84 até o anel da dobra, 168 dali
# para fora, como a cena), com meia rua de cada lado; o lote é fração dela (ver
# `scripts/city/celula.py`). `tecido()` e as prateleiras de retângulo ficaram acima
# só como histórico: nada as chama.
#
# ⚠️ A MÁSCARA DO TECIDO É A REDE DESENHADA E MAIS NADA DE RUA. `livre()` ainda
# reserva o círculo dos arteriais, as 9 costuras de distrito e as bordas das bandas
# de φ, e a cena não desenha nenhuma delas; as 12 avenidas, que ela desenha, não
# estavam lá. Aqui a rua é a borda da célula; a máscara cuida só de água, peça,
# canal, orlas especiais, guerra e declive.
# ══════════════════════════════════════════════════════════════════════════
sys.path.insert(0, p('scripts/city'))
import celula as CEL
_avt = open(p_ts('teia.ts'), encoding='utf-8').read()
_mav = re.search(r'AVENIDAS[^=]*=\s*Array\.from\(\{\s*length:\s*(\d+)\s*\},\s*\(_, i\)\s*=>\s*\(\{\s*'
                 r'rumo:\s*i\s*\*\s*(\d+),\s*largura:\s*i\s*%\s*(\d+)\s*===\s*0\s*\?\s*(\d+)\s*:\s*(\d+)', _avt)
if not _mav: raise SystemExit('gerar_cidade: AVENIDAS mudou de forma em teia.ts; leia de novo')
_n_av, _p_av, _m_av, _l1, _l2 = map(int, _mav.groups())
_mhr = re.search(r'export const HR\s*=\s*([0-9.]+)', _avt)
if not _mhr: raise SystemExit('gerar_cidade: HR sumiu de teia.ts')
TEIA_HR = float(_mhr.group(1))
_J_POR_GRAU = TEIA_N_RAD / 360.0
_AV_MEIA = {}
for _k in range(_n_av):
    _j = _k * _p_av * _J_POR_GRAU
    if abs(_j - round(_j)) > 1e-9: raise SystemExit('gerar_cidade: avenida fora de radial da teia')
    _AV_MEIA[int(round(_j)) % TEIA_N_RAD] = (_l1 if _k % _m_av == 0 else _l2) / 2.0
_ART_MEIA = {_FACE_DO_ARTERIAL[_i]: _w / 2.0 for _i, _n, _r, _w in ANEIS if _i in _FACE_DO_ARTERIAL}
_CANAIS_CEL = []
for _ru in CANAL_RADIAIS:
    _j = _ru * _J_POR_GRAU
    if abs(_j - round(_j)) > 1e-6: raise SystemExit(f'gerar_cidade: canal em {_ru}° fora de radial')
    _CANAIS_CEL.append((int(round(_j)) % TEIA_N_RAD, CANAL_RAD_SEC / 2 + CANAL_TALUDE + 2.0,
                        R_INICIO, R_ABOBADA))
TEIA_CEL = CEL.Teia(TEIA_ANEIS, _NIVEIS[-1][1], TEIA_N_RAD, TEIA_HR, TRAVESSA / 2.0,
                    _AV_MEIA, _ART_MEIA, _CANAIS_CEL)

def livre_tecido(x, z):
    """`livre()` sem as ruas que a cena não desenha (ver a nota acima)."""
    r = math.hypot(x, z)
    if r < R_INICIO: return False
    if phi(x, z) > PHI_BORDA: return False
    if math.hypot(x-PCX, z-PCZ) < parque_alcance(x, z) + 2: return False
    if dentro_do_coliseu(x, z, 2.0): return False
    if em_programa(x, z) is not None: return False
    if em_canal(x, z, CANAL_TALUDE + 2.0): return False
    if em_guerra(x, z, 2.0): return False
    if em_baia(x, z, ORLA_RESERVA): return False
    if _na_orla_nobre(x, z): return False
    if _na_orla_baia(x, z): return False
    if em_lago(x, z, 30.0): return False
    if altura(x, z) < LAGO_COTA + 0.5: return False
    return declive(x, z) <= DECLIVE_MAX

print('grade de células da teia: amostrando a máscara ao longo das fileiras...', file=sys.stderr)
CELS = []
_REJ_CEL = collections.Counter()
for _i in range(len(TEIA_ANEIS) - 1):
    _passo = TEIA_CEL.passo(_i)
    for _j0 in range(0, TEIA_N_RAD, _passo):
        _c = CEL.Celula(TEIA_CEL, _i, _j0, _j0 + _passo)
        if not _c.ok: _REJ_CEL['estreita'] += 1; continue
        _wm = (_c.wL + _c.wR) / 2
        _cx, _cz = CEL.ponto((_c.d_in + _c.d_out) / 2, _wm, _c.fi)
        # ⚠️ O φ DO TECIDO SELADO CONTINUA SENDO O LIMITE, MAS PELO CENTRO DA CÉLULA:
        # a borda do tecido anda de célula inteira, nunca corta uma pela metade.
        if phi(_cx, _cz) > PHI_LOTE: _REJ_CEL['além do tecido'] += 1; continue
        _s = distrito_de(_cx, _cz)
        if _s is None: _REJ_CEL['sem distrito'] += 1; continue
        _tem = False
        for _f in CEL.fileiras_da_celula(_c):
            _f['livre0'] = CEL.intervalos_livres(_f, _c.wL, _c.wR, livre_tecido)
            _f['r'] = math.hypot(*CEL.ponto((_f['df'] + _f['db']) / 2, _wm, _c.fi))
            _tem = _tem or bool(_f['livre0'])
        if not _tem: _REJ_CEL['toda mascarada'] += 1; continue
        _c.setor = _s
        CELS.append(_c)
DIST = []
for _s in range(N_DIST):
    _a0 = math.radians(DISTRITOS[_s][0])
    _ang = lambda c: (TEIA_CEL.theta(c.j0) - _a0) % (2 * math.pi)
    _cs = sorted((c for c in CELS if c.setor == _s), key=lambda c: (c.i, _ang(c)))
    _nb = collections.Counter()
    for _c in _cs:
        _c.q = _c.i + 1
        _nb[_c.q] += 1
        _c.b = _nb[_c.q]
    # ⚠️ A ORDEM DE CHEGADA É DE DENTRO PARA FORA POR FILEIRA, NÃO POR CÉLULA: a
    # carteira mais antiga pega a fileira mais interna do distrito inteiro, que é a
    # regra 1 (idade → onde) na resolução da fileira.
    _fs = sorted((f for c in _cs for f in c.fileiras),
                 key=lambda f: (f['cel'].i, f['faixa'], f['lado'], _ang(f['cel'])))
    DIST.append(CEL.Distrito(_fs))
    print(f'  distrito {_s+1} (rumo {DISTRITOS[_s][0]:5.1f}+{DISTRITOS[_s][1]:5.1f}): '
          f'{len(_cs):4d} células, {len(_fs):5d} fileiras, '
          f'{DIST[-1].capacidade_total()/1e4:8,.1f} ha loteáveis', file=sys.stderr)
print(f'  células: {len(CELS):,} com fileira livre | fora: {dict(_REJ_CEL)}', file=sys.stderr)

# ══════════════════════════════════════════════════════════════════════════
# A FONTE DA FILA: O SNAPSHOT DO BLOCO 966.670
#
# ⚠️ ATÉ 19/09 O GERADOR ORDENAVA PELA REGRA VELHA, e isso não era detalhe de
# dado: era outra LEI. Ele lia `holders_by_age.csv` (que o cron move todo dia) e
# ordenava pelo UTXO mais antigo (masterplan §9, regra 1). A régua em vigor é o
# DOG-tempo do §12, e ela já está RESOLVIDA dentro do snapshot: cada carteira
# tem `posicao_residencial`, e não há nada a recalcular aqui. Recalcular seria,
# aliás, a terceira implementação da mesma regra, que é como esta casa já errou
# antes (ver o cabeçalho do `conferir_terreno.py`).
#
# ⚠️ E A FONTE VIVA NÃO SERVE MAIS, por construção: o snapshot é um bloco, o CSV
# é hoje. Medido em 19/09: 231 carteiras existem só no snapshot e 369 só no CSV.
# Plantar pelo CSV seria dar lote a quem comprou depois do bloco e tirar de quem
# estava lá na hora combinada.
#
# As 21 institucionais já saíram da fila: `ordem_residencial` é a lista de
# 85.797 (85.818 menos 21), e elas vão para o Distrito Financeiro por outro
# caminho (`dog_966670_tag_institucional.json`).
#
# `FONTE=vivo` volta ao comportamento antigo, e existe só para comparar as duas
# cidades lado a lado. O padrão é o snapshot, que é a lei.
FONTE = os.environ.get('FONTE', 'snapshot')
SNAP_ORDEM = p('data/snapshots/dog_966670_ordem_residencial.json')

# ⚠️ O COLUMBÁRIO (fundador, 20/09/2026). Quem não alcança o MENOR LOTE DA
# CIDADE não recebe terra: recebe um nicho com o endereço gravado, e o nicho é
# bilhete de reivindicação, não lápide. Se a carteira voltar a ter saldo e o
# dono comprar a licença E MINTAR O DEED, ela troca o nicho por lote NOVO, no
# anel de expansão do §14, nunca no Anel 1, que congelou no bloco 966.670. O
# nicho é direito de mintar, não lote adormecido: sem licença e sem mint ele
# continua sendo só o registro de que aquele endereço existiu no bloco.
#
# O corte não é um número escolhido a dedo: é o saldo que paga o piso de 24 m²
# na curva publicada, `area = 0,986443·√DOG`. Medido: 15.802 carteiras (18,4%
# da cidade) segurando 0,0019% do supply, e a área prometida da cidade cai só
# de 46,30 para 46,17 km². Em troca libera 79 km de testada mínima, que é o
# desperdício que mais pesava no empacotamento: lote de 3 m² gastava 5 m de
# frente de rua igual a um de 120 m².
#
# ⚠️ ELES NÃO SAEM DO REGISTRO. Some do mapa, não some da prova: o columbário é
# gravado e entra no merkle root com estado próprio. Apagar 15.802 endereços em
# silêncio quebraria a auditoria pública, que é o que faz o mapa valer.
K_PUBLICADA = 0.986443       # a curva que a landing publica (masterplan §16.2)
DOG_MIN_LOTE = (PISO_LOTE / K_PUBLICADA) ** 2     # 591,9 DOG
COLUMBARIO = []

elig, carteiras, UTX_SNAP = {}, [], {}
if FONTE == 'snapshot':
    _o = json.load(open(SNAP_ORDEM))
    # ⚠️ `PESO_TIER` É VÁLVULA, NÃO PADRÃO (masterplan §19, 21/09). O caderno de
    # tiers manda o tier decidir o ANEL; o §12, travado DOIS DIAS DEPOIS, manda
    # o tier virar emblema e o DOG-tempo decidir a posição. A medição deu razão
    # ao §12: a banda do tier 6 não comporta o tier 6 (faltam 4,35 km² no melhor
    # caso), o começo em r 960 é terra que não existe, e aplicar banda moveria
    # 47% do tecido para entregar ao holder nada que ele consiga medir.
    #
    # Com peso 0 a fila é a do §12, que é a lei. Com peso 1 a fila vira a do
    # caderno, por bloco de emblema. Existe para a decisão ser escrita e
    # reproduzível, não para ser usada no escuro.
    PESO_TIER = float(os.environ.get('PESO_TIER', '0'))
    _linhas = sorted(_o['ordem'], key=lambda r: r['posicao_residencial'])
    if PESO_TIER > 0:
        _ORDEM_BLOCO = {'satoshi_visionary': 0, 'btc_maximalist': 1, 'rune_master': 2,
                        'ordinal_believer': 3, 'dog_legend': 4, 'diamond_paws': 5}
        def _bloco_de(_r):
            _t = TIER_DE.get(_r['address']) if 'TIER_DE' in dir() else None
            if _t in _ORDEM_BLOCO: return _ORDEM_BLOCO[_t]
            _d = _r.get('dog') or 0
            return 6 if _d >= 20000 else (7 if _d >= 10000 else 8)
        _n = len(_linhas)
        _por_bloco = sorted(range(_n), key=lambda i: (_bloco_de(_linhas[i]), i))
        _posto_bloco = {id(_linhas[i]): k for k, i in enumerate(_por_bloco)}
        _linhas.sort(key=lambda r: (1 - PESO_TIER) * r['posicao_residencial']
                                   + PESO_TIER * _posto_bloco[id(r)])
        print('  ⚠️ PESO_TIER=%.2f: a fila deixou de ser a do §12 e virou a do caderno'
              % PESO_TIER, file=sys.stderr)
    # ⚠️ A FILA RESIDENCIAL TEM DE EXCLUIR A TAG INSTITUCIONAL, E ISSO FALTAVA.
    # O arquivo de ordem foi gerado em 13/09 já sem as 21 institucionais daquele
    # dia ("as institucionais saem para o Distrito Financeiro e não ocupam fila
    # aqui", diz a nota dele), então ninguém precisava filtrar. Em 22/09 a tag
    # ganhou 6 carteiras de custódia rotulada (a quente da Kraken entre elas), e
    # o arquivo de ordem continuou sendo o de 13/09: as seis foram plantadas no
    # Distrito Financeiro E na fila, ou seja receberam DOIS lotes cada.
    # ⚠️ MEDIDO ANTES DO CONSERTO: `plantadas 70.721 linhas, 70.001 carteiras de
    # 69.995`, seis a mais que o total, que é o próprio defeito imprimindo a
    # assinatura dele. O teste "cada carteira tem um destino" do portão pega, mas
    # só depois de uma hora de rodada.
    # A tag é a fonte, não o arquivo de ordem: quem entra nela sai daqui.
    _INST = set()
    _ct = p('data/snapshots/dog_966670_tag_institucional.json')
    if os.path.exists(_ct):
        _tj = json.load(open(_ct, encoding='utf-8'))
        _INST = {l['address'] for l in (_tj.get('linhas') or [])}
    _fora = 0
    for _r in _linhas:
        _a = _r['address']
        if _a in _INST:
            _fora += 1; continue
        if _r['dog'] <= 0: continue
        if _r['dog'] < DOG_MIN_LOTE:
            COLUMBARIO.append(_r); continue
        elig[_a] = _r['dog']
        UTX_SNAP[_a] = int(_r.get('utxo_count') or 1)
        # a tupla imita a da fonte viva (a ordem já está resolvida, então o que
        # entra na chave é a posição, e ela é única por construção)
        carteiras.append((_r['posicao_residencial'], '', 0, _a))
    N = len(carteiras)
    print('fila do snapshot %s: %d carteiras, posição por DOG-tempo (masterplan §12)'
          % (os.path.basename(SNAP_ORDEM), N), file=sys.stderr)
    if _fora:
        print('  %d carteiras saíram da fila por estarem na tag institucional '
              '(vão para o Distrito Financeiro)' % _fora, file=sys.stderr)
    print('  columbário: %d carteiras abaixo de %.0f DOG (o saldo que paga o piso de %.0f m²), '
          'com %.0f DOG somados' % (len(COLUMBARIO), DOG_MIN_LOTE, PISO_LOTE,
                                    sum(_r['dog'] for _r in COLUMBARIO)), file=sys.stderr)
    _nel = sum(1 for _r in _linhas if not _r.get('elegivel'))
    print('  ⚠️ %d delas estão marcadas `elegivel: false` (filtro de custódia do §12.1) '
          'e MESMO ASSIM recebem lote: a marca não é despejo.' % _nel, file=sys.stderr)

# ── as carteiras, na ordem de chegada de verdade (FONTE=vivo, legado) ──────
if FONTE == 'vivo':
  with open(p('data/holders_by_age.csv'), newline='') as f:
    for row in csv.DictReader(f):
        try: dog = float(row['total_dog'])
        except (ValueError, KeyError): continue
        # (bloco legado: só roda com FONTE=vivo)
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
  for a in elig:
    lst = U.get(a) or []
    if not lst: continue
    v = min(lst, key=lambda x: (x['ts'], x['txid'], x['vout']))
    carteiras.append((v['ts'], v['txid'], v['vout'], a))
  carteiras.sort()
  N = len(carteiras)
  print(f'carteiras ordenadas pela fonte VIVA: {N:,} | chaves distintas: '
        f'{len({c[:3] for c in carteiras}):,}', file=sys.stderr)

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
            # ⚠️ §36: `b['prof']` ENTRA JUNTO, senão a prateleira reconstrói as
            # fileiras pelo vão NOMINAL da classe enquanto `_bloco()` as
            # plantou pelo vão MEDIDO daquele quarteirão, e as duas se
            # descolam (a checagem de `erro_fila_max`, mais abaixo, é quem
            # pegaria isso e abortaria a rodada em vez de publicar calado).
            for _zl, borda_z, sentido in _z_das_filas(b['k'], b['prof']):
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
                            'lado': b['lado'], 'prof': b['prof'], 'nf': 2 * b['k'],
                            # ⚠️ TRECHO BLOQUEADO PELO LOTE FUNDO DA FILEIRA DE
                            # TRÁS. A faixa tem duas fileiras costas com costas;
                            # lote mais fundo que a fileira invade a de trás, e
                            # sem este registro os dois donos recebem o mesmo
                            # chão (medido: 80 pares idênticos).
                            'bloq': [],
                            # ⚠️ O CURSOR NÃO DIZ O QUE ESTÁ OCUPADO. Com vão
                            # reaproveitado e prateleira queimada, `x0` deixa de
                            # ser a fronteira entre cheio e vazio, e inferir
                            # ocupação dele deixou passar 265 pares de lotes
                            # sobrepostos. Aqui fica o que foi REALMENTE plantado.
                            'ocup': []})
    # ⚠️ O PAR É O VIZINHO IMEDIATO. `_z_das_filas` emite as duas fileiras de
    # cada faixa em sequência, uma de frente para cada rua.
    for _i in range(0, len(out) - 1, 2):
        if (out[_i]['bx'] == out[_i+1]['bx'] and out[_i]['bz'] == out[_i+1]['bz']
                and out[_i]['sentido'] == -out[_i+1]['sentido']):
            out[_i]['par'] = out[_i+1]; out[_i+1]['par'] = out[_i]
    return out
# ⚠️ §40: AS PRATELEIRAS SÃO AS FILEIRAS DAS CÉLULAS. `socalca()` e o relatório
# leem `PASSO[s][i]` com 'i' e 'par', que as fileiras de `celula.py` carregam.
PASSO = [D.F for D in DIST]

# ⚠️ PRATELEIRA DUPLICADA É LOTE EM CIMA DE LOTE. Se duas entradas de `PASSO`
# descrevem a MESMA fileira física, as duas se enchem do mesmo x0 e dois donos
# recebem o mesmo chão, cada um achando que tem o seu. `AUDITA_PRAT=1` conta.
if os.environ.get('AUDITA_PRAT'):
    for _s in range(N_DIST):
        _ch = collections.Counter()
        for _pr in PASSO[_s]:
            _ch[(round(_pr['bx'], 2), round(_pr['bz'], 2), round(_pr['borda'], 2),
                 _pr['sentido'], round(_pr['ca'], 4))] += 1
        _dup = sum(v - 1 for v in _ch.values() if v > 1)
        _sem = sum(1 for _pr in PASSO[_s] if 'par' not in _pr)
        print('    sem par: %d de %d' % (_sem, len(PASSO[_s])), file=sys.stderr)
        _pior = _ch.most_common(1)[0] if _ch else None
        print('  setor %d: %d prateleiras, %d chaves, %d duplicadas (pior repete %dx)'
              % (_s + 1, len(PASSO[_s]), len(_ch), _dup, _pior[1] if _pior else 0),
              file=sys.stderr)
    sys.exit(0)

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
# ⚠️ O TETO PUBLICADO VALE PARA O LOTE ENTREGUE, NÃO SÓ PARA O PROMETIDO. A
# página publica 40.000 m² como teto residencial, `area_prometida()` aplica o
# teto, e `area_de()` NÃO aplicava: para 99,99% da cidade tanto faz, mas um cofre
# de 3,1B DOG recebia 46.479 m² contra um teto publicado de 40.000, e o lookup
# se recusava a subir por isso (medido em 22/09, rodada 3). O Distrito
# Financeiro tem teto próprio (FIN_TETO) e não passa por aqui.
TETO_RESIDENCIAL = 40000.0
def area_de(dog, r):
    return max(PISO_LOTE, min(TETO_RESIDENCIAL,
               K_AREA * (dog ** EXPOENTE) * ((r / R_INICIO) ** GRADIENTE)))
def _mg():
    sm = w = 0.0
    for i in range(2000):
        r = R_INICIO + (R_ABOBADA - R_INICIO) * (i + 0.5) / 2000
        sm += (r / R_INICIO) ** GRADIENTE * r; w += r
    return sm / w
K_AREA = 0.0   # calibrado adiante, contra o tecido que sobrou depois dos lobos

# ── capacidade agora é ÁREA, não contagem ──────────────────────────────────
cap_area = [D.capacidade_total() for D in DIST]
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
    print(f'  setor {s+1:2d} (rumo {s*30:3d}): '
          f'{len({id(f["cel"]) for f in PASSO[s]}):4d} células, '
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

# ═══════════════════════════════════════════════════════════════════════════
# A ORLA NOBRE: OS TIERS 1 A 3 NA ALÇA DA BAÍA
#
# Especificação em `tiersposition.md` §3.1 e §3.2, geometria lida da cena
# (`AVENIDA_ALCA` em teia.ts). Duas fileiras com testada na avenida circular de
# r 6.950: a da frente cresce para DENTRO, rumo à praia da baía, a de trás
# cresce para fora, rumo à praia dos fundos. As duas olham para dentro, decisão
# do fundador: "a face externa não olha mar aberto".
#
# ⚠️ O PISO DE FUNDO CAIU, E A AUTORIZAÇÃO É DE 22/09, MAS NÃO É A QUE ESTAVA
# CITADA AQUI. O §18.1 (20/09) grava o piso de 60 m como decisão do fundador, e
# derrubá-lo exigia decisão nova. Ela existe: em 22/09, perguntado sobre a
# contradição entre a curva publicada e o que a Orla Nobre entrega, o fundador
# escolheu "consertar a cauda E devolver o excesso da Orla Nobre", sabendo que
# isso troca privilégio de 446 carteiras por área para as outras 69.549. Um
# agente tinha atribuído isso ao §16.2, que trata de gradiente e não autoriza
# nada aqui. Havia um piso
# de 60 m de fundo aqui, e ele fazia a Orla Nobre entregar 1,44x a curva: medido
# no registro selado, 388.212 m² a mais do que a landing promete às 446
# carteiras, razão mediana 1,4423 contra 0,9629 do resto da cidade. A página
# pública jura DUAS VEZES que o Genesis Badge não muda o tamanho do lote, e o
# piso desmentia as duas. Agora a testada continua fixa (é ela que dá ritmo à
# fileira) e o fundo é a curva, ponto. Medido antes de aplicar: sem o piso
# nenhum lote vira fatia rasa, o fundo mínimo é 32,8 m na frente e 33,9 m atrás,
# e os 446 entregam razão 1,000.
# ⚠️ E OS 388.212 m² **NÃO** VOLTAM AO TECIDO SOZINHOS. Este comentário afirmava
# o contrário, e a primeira rodada com o conserto mediu o oposto: a razão da
# cidade CAIU em vez de subir. A causa é a máscara, não o lote.
#
# A Orla Nobre mora no anel da alça, e a terra que ela tira do tecido é uma
# FAIXA FIXA (`ORLA_FUNDO_MAX_FRENTE/TRAS`, 214 e 246 m) que não encolhe quando
# o lote encolhe. Tirar o piso fez o fundo real cair para 176,7 m na frente e
# 128,9 atrás, mas o tecido continuou vendo os 214 e 246: o lote devolveu a
# área e a máscara ficou com a terra.
#
# O que o conserto ENTREGOU, e era o que o fundador pediu: os 446 lotes passam
# de razão mediana 1,4423 para 1,0000, e a frase da página pública sobre o
# Genesis Badge volta a ser verdadeira. O que ele NÃO entregou é terra para o
# resto da cidade. Apertar `_na_orla_nobre` é o caminho para que entregue, e é
# decisão de projeto com risco próprio: a faixa larga existe para caber mansão
# funda, e lote plantado ali dentro fecha essa porta.
def elig_area(addr):
    """a área que a LANDING promete a esta carteira: clamp(0,986443·√DOG, 1, 40.000)."""
    return max(1.0, min(40000.0, K_PUBLICADA * math.sqrt(max(0.0, elig.get(addr, 0.0)))))

# ⚠️ ISTO NÃO É MAIS PISO DE LOTE DE CARTEIRA. Sobrou como duas coisas, e as
# duas são legítimas: o fundo dos lotes DO PROJETO (que não têm curva a honrar,
# são land bank) e a pegada representativa com que o bloqueio de peça de
# programa é testado.
ORLA_FUNDO_PROJETO = 60.0
# ⚠️ BLOCO DE 3, E ISSO É DECISÃO DO FUNDADOR DE 19/09, NÃO ESCOLHA DE DESENHO.
# Palavras dele: *"5 acho que pode criar um bloco muito grande"*. O caderno grava
# em `tiersposition.md` §3.1 item 4, com a medição que justifica: na frente, 4
# blocos de 5 põem um destino público a cada 3,88 km andando pela orla, e 6
# blocos de 3 põem a cada 2,58 km.
#
# ⚠️ E ISSO JÁ FOI REVERTIDO UMA VEZ POR ENGANO, EM 22/09. Um agente leu o §3.2
# do caderno (10/09), que de fato manda 20/45 em blocos de 5, e não viu que o
# §3.1 item 4 (19/09), NOVE DIAS MAIS NOVO e no MESMO arquivo, derruba aquilo.
# Ele reverteu exatamente o que o fundador tinha rejeitado com uma frase. Quem
# mexer aqui de novo: a seção com a data MAIS NOVA manda, e neste arquivo ela
# não é a de número maior.
ORLA_PROJETO_FRENTE, ORLA_PROJETO_TRAS = 18, 47   # land bank do §6, ritmo do §3.1 item 4
ORLA_PROJETO_BLOCO = 3
ORLA_FUNDO_MAX_FRENTE, ORLA_FUNDO_MAX_TRAS = 214.0, 246.0

def _tier_de():
    """tier, change_pct, DOG e utxo_count por endereço, do snapshot.

    ⚠️ ELE DEVOLVE DOG E UTXO TAMBÉM, E ISSO CONSERTA UMA MENTIRA NO REGISTRO.
    `elig` e `UTX_SNAP` só conhecem quem está na FILA RESIDENCIAL, e as 21
    carteiras institucionais não estão nela (saíram no próprio snapshot: é por
    isso que a fila tem 85.797 e não 85.818). A gravação tratava "sem fila" como
    "sem dono" e escrevia `dog=0, utxo_count=0, forma=0` nas 21.
    ⚠️ O QUE ISSO AFIRMAVA, medido no registro selado de 22/09: a Gate.io tem
    3.030.049.556 DOG e 20.008 UTXOs no snapshot, e o registro dizia que ela tem
    zero e forma 0, que é "massa única, casa no centro". Eram os 21 lotes mais
    visíveis da cidade, o Distrito Financeiro inteiro, e o portão de 15 testes
    não via porque ele não lê nenhuma dessas quatro colunas."""
    try:
        _sn = json.load(open(p('data/snapshots/dog_snapshot_966670.json')))['holders']
    except FileNotFoundError:
        return {}, {}, {}, {}
    return ({r['address']: r.get('tier') for r in _sn},
            {r['address']: (r.get('change_pct') if r.get('change_pct') is not None else -1e9)
             for r in _sn},
            {r['address']: float(r.get('dog') or 0.0) for r in _sn},
            {r['address']: int(r.get('utxo_count') or 1) for r in _sn})

TIER_DE, CHANGE_DE, DOG_SNAP, UTX_SNAP_TODOS = _tier_de()
ORLA_LOTES = []          # (x, z, frente, prof, giro_graus, addr ou None)
S_ORLA = 6                # setor 7 no endereço (S07-Q01-B{lote}-L001)
_GIRO_ORLA = {}           # o giro de cada lote da orla, tangente ao círculo

# ⚠️ RETÂNGULO TANGENTE NUM ANEL NÃO CABE EM `testada / raio`, E ISSO CUSTOU
# 210 PARES DE LOTES SOBREPOSTOS (medido em 22/09 pelo teste novo do portão:
# 202 na Orla Nobre, mediana 0,87 m, e 8 no Distrito Financeiro, o pior com
# 13,98 m). Nenhum teste olhava para eles porque cada um grava UM QUARTEIRÃO POR
# LOTE, e o teste de sobreposição agrupava por quarteirão: com um lote em cada
# balde, ele nunca comparava dois.
#
# A conta errada é a ingênua: dividir o comprimento do arco pelo número de lotes
# e usar isso como largura. O lote é um RETÂNGULO, e o canto dele fica no raio
# INTERNO, onde o mesmo ângulo vale menos metros. Dois retângulos vizinhos, cada
# um girado do outro, se atravessam pelos cantos.
#
# A conta certa: o lote ocupa 2·atan((w/2) / r_interno) de ângulo, e isso tem de
# caber no passo. Invertendo, w <= 2 · r_interno · tan(passo/2). O raio interno é
# a testada menos o fundo quando a fileira cresce para dentro, e a própria
# testada quando cresce para fora.
def _testada_no_anel(nominal, total, span_graus, r_borda, sentido, fundo_max, donos):
    """a maior testada que NÃO faz o canto do lote invadir o vizinho."""
    passo = math.radians(span_graus) / max(1, total)
    t = nominal
    for _ in range(8):
        if sentido < 0:
            # ⚠️ É O LOTE MAIS FUNDO QUE MANDA, porque é o canto dele que invade
            # o vizinho. O piso de fundo saiu do dimensionamento do lote, mas
            # aqui ele continua como piso da CONTA: um arco em que todo mundo
            # fosse raso não pode devolver r_in maior que o do desenho.
            fundo = max((max(ORLA_FUNDO_PROJETO, min(fundo_max, elig_area(a) / t))
                         for a in donos), default=ORLA_FUNDO_PROJETO)
            r_in = r_borda - fundo
        else:
            r_in = r_borda
        w_max = 2.0 * max(1.0, r_in) * math.tan(passo / 2)
        novo = min(nominal, w_max)
        if abs(novo - t) < 0.005: return novo
        t = novo
    return t


def planta_orla_nobre():
    """devolve a lista de lotes da alça, já com dono, na ordem do caderno."""
    if not TIER_DE: return []
    a0, a1 = ALCA_TERRA_ARCO                      # 346 -> 116,5, passando por 0
    span = (a1 - a0) % 360.0
    centro = (a0 + span / 2) % 360.0              # 51,25°, o centro do arco
    L = math.radians(span) * ALCA_R

    def fila(tiers, n_projeto, fundo_max, sentido):
        """uma fileira da alça: quem entra, em que ordem e com que tamanho.

        `sentido` +1 cresce para fora (praia dos fundos), -1 cresce para dentro
        (praia da baía). As duas fileiras têm testada na avenida circular.
        """
        # ⚠️ A CONTAGEM POR TIER SAI DAQUI E NÃO DE UMA CONSTANTE. O trecho dos
        # Satoshi Visionary precisa saber QUANTOS são para nascer contínuo, e o
        # número certo é o que entrou na fila (nem todo tier 1 do snapshot está
        # em `elig`: os institucionais saíram dela).
        donos, n_por_tier = [], []
        for t in tiers:
            g = [x for x in elig if TIER_DE.get(x) == t]
            g.sort(key=lambda x: -CHANGE_DE.get(x, -1e9))     # melhor comportamento primeiro
            n_por_tier.append(len(g)); donos += g

        def _abre_do_meio(total_):
            """a ordem em que as vagas são ocupadas: do centro do arco para as
            duas pontas, alternando. É o §3.2 sem lista de exceção: o Satoshi
            Visionary fica no centro e o BTC Maximalist abre nos dois flancos."""
            _o, _v, _m, _i = [], set(), total_ // 2, 0
            while len(_o) < total_ and _i < 4 * total_ + 8:
                _k = _m + (_i + 1) // 2 * (1 if _i % 2 else -1)
                if 0 <= _k < total_ and _k not in _v:
                    _v.add(_k); _o.append(_k)
                _i += 1
            return _o

        def _slot_livre(slot, total_, testada_):
            """a vaga está livre de peça de programa E dentro do teto de declive?

            O Portão do Parque Runestone sai no rumo 43° e ATRAVESSA a alça: ali
            a fileira abre passagem pública em vez de plantar lote privado.

            ⚠️ E O TETO DE DECLIVE ENTROU EM 22/09, DEPOIS DE 12 LOTES PASSAREM.
            A Orla Nobre nunca testou declividade: a auditoria da cidade gravada
            achou 12 lotes dela acima do teto de 12% do §15, com pior de 25,5%,
            TODOS nos rumos 346,9 a 347,4 e 115,1 a 115,9. São as duas pontas do
            arco da alça, onde a terraplanagem volta ao terreno natural numa
            franja de 250 m: a fileira plantava em cima da rampa de transição.
            O tecido comum sempre testou isso (`_cabe`); esta fileira, não.
            """
            ang_ = math.radians((a0 + span * (slot + 0.5) / total_) % 360.0)
            r_b = ALCA_R + sentido * ALCA_LARG / 2
            # a peça de programa continua sendo testada na pegada do lote PISO,
            # que é o que 388 dos 446 lotes de fato ocupam
            for _t in (0.15, 0.5, 0.85):
                r_ = r_b + sentido * ORLA_FUNDO_PROJETO * _t
                for _d in (-testada_ / 2.2, 0.0, testada_ / 2.2):
                    _a2 = ang_ + _d / max(1.0, r_)
                    if em_programa(math.sin(_a2) * r_, -math.cos(_a2) * r_) is not None:
                        return False
            # o declive é testado na faixa INTEIRA que a fileira pode ocupar,
            # porque o lote fundo é justamente o que alcança a rampa da franja
            for _t in (0.0, 0.25, 0.5, 0.75, 1.0):
                r_ = r_b + sentido * fundo_max * _t
                for _d in (-testada_ / 2.2, 0.0, testada_ / 2.2):
                    _a2 = ang_ + _d / max(1.0, r_)
                    if declive(math.sin(_a2) * r_, -math.cos(_a2) * r_) > DECLIVE_MAX:
                        return False
            return True

        # ⚠️ RECALCULE, NÃO ACUMULE. `total += bloqueados` a cada volta soma o
        # mesmo trecho várias vezes: a testada da frente caía de 74 para 61,4 m.
        # O certo é total = base + bloqueados DESTA volta, que converge para
        # testada = comprimento útil dividido pelos lotes que existem.
        total = len(donos) + n_projeto
        base_total, bloq, testada = total, [], L / total
        for _tent in range(8):
            testada = _testada_no_anel(L / total, total, span,
                                       ALCA_R + sentido * ALCA_LARG / 2, sentido,
                                       fundo_max, donos)
            bloq = [k for k in range(total) if not _slot_livre(k, total, testada)]
            novo_total = base_total + len(bloq)
            if novo_total == total: break
            total = novo_total
        if bloq:
            print('  a fileira pula %d vagas ocupadas por peça de programa '
                  '(acesso público), testada final %.1f m' % (len(bloq), testada),
                  file=sys.stderr)

        ordem_slots = [k for k in _abre_do_meio(total) if k not in set(bloq)]

        # ⚠️ O PROJETO SE ESCOLHE DEPOIS DO BLOQUEIO. Escolhendo antes, as vagas
        # do projeto que caem na passagem do parque somem junto e a reserva
        # nasce com 62 de 65 lotes, calada.
        #
        # ⚠️ OS BLOCOS DO PROJETO PARTIAM O TRECHO DOS 88, E ERA ESSE O DEFEITO.
        # O caderno §3.2 e o masterplan §10 travaram que os Satoshi Visionary
        # formam UM trecho CONTÍNUO de 54,5° na Orla Nobre. Medido no registro
        # selado de 22/09: os blocos do projeto eram de 3 e caíam de 34 em 34
        # vagas, e dois deles (rumos 38,26 e 58,34) caíam DENTRO do trecho: os
        # 86 SV saíram partidos em 24 + 31 + 31, e nenhum bloco ficava nas
        # pontas da fileira. O fundador descreveu o objetivo quando decidiu:
        # "de longe lê como aquele trecho ali são os 88, sem legenda". Cortado
        # em três ele não lê como nada.
        #
        # Agora os blocos são de 5 e têm LUGAR, não passo: na fileira da frente
        # são quatro, DOIS NAS PONTAS e DOIS NAS JUNÇÕES do trecho SV com o
        # BTC Maximalist, o que deixa os 88 inteiros por construção; na de trás,
        # que tem um tier só e portanto não tem junção, são nove, um em cada
        # ponta e sete espaçados por igual. O §3.2 continua proibindo bloco
        # único, e nove blocos de 5 não são bloco único.
        # Medido na simulação, para o orquestrador conferir depois da rodada: o
        # trecho SV ocupa 86 de 206 vagas num arco de 130,5°, ou seja 54,5°,
        # exatamente o número que o caderno trava.
        _validos = [k for k in range(total) if k not in set(bloq)]
        _V, _B = len(_validos), ORLA_PROJETO_BLOCO
        _nb = max(1, -(-n_projeto // _B))
        if len(n_por_tier) > 1 and n_por_tier[0] > 0:
            # a fileira da frente: o centro do arco é dos SV, e os dois blocos
            # de junção nascem colados nas duas pontas do trecho deles
            _pc = min(range(_V), key=lambda p: abs(_validos[p] - total // 2))
            _nsv = n_por_tier[0]
            # ⚠️ GUARDA: sem folga para as quatro faixas de 5 o trecho contínuo
            # não cabe, e é melhor morrer aqui do que entregar SV picado de novo.
            assert _V >= _nsv + 4 * _B, \
                f'a Orla Nobre não comporta o trecho contínuo: {_V} vagas para {_nsv} SV'
            _sv0 = min(max(2 * _B, _pc - _nsv // 2), _V - 2 * _B - _nsv)
            _ini = [0, _sv0 - _B, _sv0 + _nsv, _V - _B]
        else:
            # a fileira de trás: um bloco em cada ponta, o resto espaçado igual
            _ini = [0, _V - _B]
            _meio = max(0, _nb - 2)
            for _t in range(_meio):
                _ini.append(int(round(_B + (_V - 3 * _B) * (_t + 1) / (_meio + 1))))
        do_projeto = set()
        for _p0 in sorted(_ini):
            for _d in range(_B):
                if len(do_projeto) < n_projeto and 0 <= _p0 + _d < _V:
                    do_projeto.add(_validos[_p0 + _d])

        out, iw = [], 0
        for slot in ordem_slots:
            if slot in do_projeto:
                dono, area = None, testada * ORLA_FUNDO_PROJETO
            else:
                if iw >= len(donos): continue
                dono = donos[iw]; iw += 1
                area = elig_area(dono)
            # ⚠️ SEM PISO: O FUNDO É A CURVA. Era `max(ORLA_PISO_FUNDO, ...)` e o
            # piso entregava 1,44x o prometido a 388 dos 446. Ver a nota de
            # `ORLA_FUNDO_PROJETO`. O lote do PROJETO continua com fundo fixo,
            # porque ele não tem curva a honrar.
            ang = math.radians((a0 + span * (slot + 0.5) / total) % 360.0)
            r_borda = ALCA_R + sentido * ALCA_LARG / 2
            # ⚠️ §41: A VAGA É UMA FATIA DE ANEL, E O FUNDO SAI DA ÁREA EXATA DELA.
            # O retângulo antigo tinha a testada da corda interna e deixava uma cunha
            # vazia entre vizinhos que crescia para fora; a fatia ocupa a vaga
            # inteira, de radial a radial, e o fundo é resolvido para a área da curva
            # (com o mesmo teto `fundo_max` de antes).
            _t0 = math.radians(a0 + span * slot / total)
            _t1 = math.radians(a0 + span * (slot + 1) / total)
            _t0, _t1 = min(_t0, _t1), max(_t0, _t1)
            _dt = _t1 - _t0
            _r2 = r_borda ** 2 + sentido * 2.0 * area / _dt
            r_fundo = math.sqrt(max(0.0, _r2))
            if abs(r_fundo - r_borda) > fundo_max:
                r_fundo = r_borda + sentido * fundo_max
            prof = abs(r_fundo - r_borda)
            _g = {'cantos': CEL.cantos_fatia(r_borda, r_fundo, _t0, _t1), 'geo': 1,
                  'area': CEL.area_fatia(r_borda, r_fundo, _t0, _t1), 'prof': prof,
                  'centro': CEL.centroide_fatia(r_borda, r_fundo, _t0, _t1),
                  'giro': math.degrees(ang) % 360.0}
            x, z = _g['centro']
            out.append((x, z, _g['area'] / prof, prof, math.degrees(ang) % 360.0, dono, _g))
        return out

    frente = fila(['satoshi_visionary', 'btc_maximalist'], ORLA_PROJETO_FRENTE,
                  ORLA_FUNDO_MAX_FRENTE, -1)
    tras = fila(['rune_master'], ORLA_PROJETO_TRAS, ORLA_FUNDO_MAX_TRAS, +1)
    print('Orla Nobre: %d lotes na frente e %d atrás (%d de carteira, %d do projeto), '
          'testada %.1f e %.1f m' % (len(frente), len(tras),
          sum(1 for l in frente + tras if l[5]), sum(1 for l in frente + tras if not l[5]),
          frente[0][2] if frente else 0, tras[0][2] if tras else 0), file=sys.stderr)
    return frente + tras

# ═══════════════════════════════════════════════════════════════════════════
# A ORLA DA BAÍA: OS TIERS 4 E 5 NA MARGEM QUE OLHA A ALÇA
#
# Caderno em `tiersposition.md` §3.3 (o lugar, fechado em 10/09) e §3.10 (a
# forma, fechada em 21/09). Geometria lida de `orla-baia.ts`, que é quem
# esculpe o chão: fileira, canal, dedo e enseada saem de lá, não daqui.
#
# ⚠️ A REGRA DE ÁREA AQUI É A INVERSA DA ORLA NOBRE, e isso está medido no
# cabeçalho de `ORLA_BAIA_FILEIRA_PROF`. Lá a testada é fixa e o fundo varia;
# aqui o fundo é travado pela seção (68 m entre a praia e o canal) e a TESTADA
# é que varia, testada = área ÷ 68. O efeito é que cada lote recebe a área
# publicada exata: a razão entregue/prometida do distrito é 1,000 por
# construção, sem piso nem teto.
#
# ⚠️ OS TRECHOS AVANÇAM JUNTOS, e isso é requisito de desenho. Enchendo um
# trecho de cada vez, os melhores endereços caem todos de um lado da enseada e a
# orla sai assimétrica — e simetria em elemento repetido é regra do fundador.
# Avançando junto, o melhor Ordinal Believer e o segundo ficam um de cada lado
# do eixo, e os quatro dedos crescem no mesmo passo.
S_OB = 8                      # setor 9 no endereço (S09-Q01-B{lote}-L001)
OB_PASSO_SONDA = 12.0         # o mesmo passo de sondagem do tecido
_OB_ANG_DEDO = lambda: [math.degrees((OB_DEDO_LARG / 2) / OB_R_FRENTE) for _ in OB_DEDOS]


class FitaOrla:
    """uma frente de testada feita de trechos que avançam no mesmo passo."""

    def __init__(self):
        self.trechos = []

    def anel(self, r_f, sentido, a_ini, a_fim):
        """um pedaço de fileira em arco. Corre de `a_ini` para `a_fim`, e é a
        ORDEM dos dois que diz de que ponta ela enche: sempre da enseada para
        o flanco."""
        comp = abs(math.radians(a_fim - a_ini)) * r_f
        if comp <= 0: return
        # ⚠️ O CUSTO ANGULAR DO LOTE SE MEDE NO RAIO INTERNO, NÃO NA TESTADA.
        # Ver a nota longa de `_testada_no_anel`: o canto do retângulo fica no
        # raio interno, onde o mesmo ângulo vale menos metros, e consumir o arco
        # pela testada faz o canto invadir o vizinho. `fator` converte: uma
        # testada de `w` custa `w · r_testada / r_interno` de arco lido na
        # testada. Na fileira que cresce para FORA o raio interno é a própria
        # testada e o fator é 1.
        r_in = r_f - OB_PROF if sentido < 0 else r_f
        self.trechos.append({'tipo': 'anel', 'comp': comp, 'cur': 0.0, 'n': 0,
                             'q': len(self.trechos) + 1, 'fator': r_f / max(1.0, r_in),
                             'r': r_f, 'sentido': sentido, 'a0': a_ini,
                             'sinal': 1.0 if a_fim > a_ini else -1.0})

    def dedo(self, rumo, lado):
        """uma banda de dedo, da PONTA para a base: a ponta é o endereço, ela
        tem água nos três lados."""
        comp = OB_DEDO_PONTA - OB_R_FRENTE
        # o dedo é reto: os lotes são paralelos e a testada custa ela mesma
        self.trechos.append({'tipo': 'dedo', 'comp': comp, 'cur': 0.0, 'n': 0,
                             'q': len(self.trechos) + 1, 'fator': 1.0,
                             'rumo': rumo, 'lado': lado})

    def _geo(self, t, s, w):
        """(x, z, giro) do lote que ocupa [s, s+w] deste trecho."""
        if t['tipo'] == 'anel':
            ang = t['a0'] + t['sinal'] * math.degrees((s + w / 2) / t['r'])
            # ⚠️ O RECUO DE FUNDO ANDA O RETÂNGULO INTEIRO meio metro na direção
            # da rua. Sem ele o fundo de duas fileiras de costas fica na MESMA
            # reta tangente e elas se atravessam: 141 pares medidos em 22/09.
            r_c = t['r'] + t['sentido'] * (OB_PROF / 2 - OB_RECUO)
            a = math.radians(ang)
            return math.sin(a) * r_c, -math.cos(a) * r_c, ang % 360.0
        rumo = t['rumo']; lado = t['lado']
        ao_longo = OB_DEDO_PONTA - (s + w / 2)
        perp = lado * (OB_DEDO_LARG / 2 - OB_DEDO_CAIS - OB_PROF / 2 + OB_RECUO)
        a = math.radians(rumo)
        ux, uz = math.sin(a), -math.cos(a)          # o eixo do dedo, para fora
        vx, vz = math.cos(a), math.sin(a)           # a perpendicular dele
        return (ux * ao_longo + vx * perp, uz * ao_longo + vz * perp,
                (rumo - 90.0) % 360.0)

    def _forma(self, t, s, w):
        """§41: a forma exata do lote que ocupa [s, s+w] deste trecho. No arco é
        fatia de anel centrada na origem (geo 1), frente no lado da rua; no dedo é
        retângulo exato (geo 2), frente no cais."""
        if t['tipo'] == 'anel':
            a_i = math.radians(t['a0'] + t['sinal'] * math.degrees(s / t['r']))
            a_f = math.radians(t['a0'] + t['sinal'] * math.degrees((s + w) / t['r']))
            t0, t1 = min(a_i, a_f), max(a_i, a_f)
            r_c = t['r'] + t['sentido'] * (OB_PROF / 2 - OB_RECUO)
            r_fr = r_c - t['sentido'] * OB_PROF / 2
            r_fu = r_c + t['sentido'] * OB_PROF / 2
            return {'cantos': CEL.cantos_fatia(r_fr, r_fu, t0, t1), 'geo': 1,
                    'area': CEL.area_fatia(r_fr, r_fu, t0, t1), 'prof': OB_PROF,
                    'centro': CEL.centroide_fatia(r_fr, r_fu, t0, t1),
                    'giro': math.degrees((t0 + t1) / 2) % 360.0}
        a = math.radians(t['rumo']); lado = t['lado']
        ux, uz = math.sin(a), -math.cos(a)
        vx, vz = math.cos(a), math.sin(a)
        c = OB_DEDO_PONTA - (s + w / 2)
        perp = lado * (OB_DEDO_LARG / 2 - OB_DEDO_CAIS - OB_PROF / 2 + OB_RECUO)
        P = lambda al, pp: (ux * al + vx * pp, uz * al + vz * pp)
        pf, pb = perp + lado * OB_PROF / 2, perp - lado * OB_PROF / 2
        C = [P(c - w / 2, pf), P(c + w / 2, pf), P(c + w / 2, pb), P(c - w / 2, pb)]
        return {'cantos': C, 'geo': 2, 'area': w * OB_PROF, 'prof': OB_PROF,
                'centro': P(c, perp), 'giro': (t['rumo'] - 90.0) % 360.0}
    def proximo(self, w):
        """o próximo lote de testada `w`, no trecho menos adiantado. Devolve
        (x, z, giro, trecho, ordem) ou None quando nenhum trecho tem espaço.

        ⚠️ O TRECHO SAI DAQUI E VIRA O QUARTEIRÃO DO `lot_id`, e isso não é
        enfeite: com um quarteirão só para os 2.062 lotes, o campo B do
        identificador (três dígitos, `B{:03d}`) estourava no lote 1.000 e o
        regex do portão reprovava a cidade inteira. Com o trecho no Q, o maior
        B do distrito é o maior trecho, que tem algumas centenas de lotes."""
        for _ in range(4000):
            cand = [t for t in self.trechos if t['cur'] + w * t['fator'] <= t['comp']]
            if not cand: return None
            t = min(cand, key=lambda t: t['cur'] / t['comp'])
            x, z, giro = self._geo(t, t['cur'], w * t['fator'])
            g = self._forma(t, t['cur'], w * t['fator'])
            if _ob_livre(x, z, giro, w) and not _sobre_avenida(g):
                t['cur'] += w * t['fator']
                t['n'] = t.get('n', 0) + 1
                return x, z, giro, t['q'], t['n'], g
            # ⚠️ ANDA, NÃO DESISTE. É a mesma sondagem de 12 m do tecido: o
            # pedaço reprovado foi reprovado para ESTE lote, e o canal radial
            # que atravessa o distrito tem 144 m de corredor — sem andar, o
            # trecho inteiro morreria na primeira travessia.
            t['cur'] += OB_PASSO_SONDA
        return None

    def sobra(self):
        return sum(max(0.0, t['comp'] - t['cur']) for t in self.trechos)

    def comprimento(self):
        return sum(t['comp'] for t in self.trechos)


# ⚠️ O MOTIVO DA REJEIÇÃO SE CONTA, NÃO SE ADIVINHA. Na primeira rodada
# (21/09) só 1.149 dos 2.062 couberam e a linha inteira foi consumida: sem
# separar os motivos, "não coube" é diagnóstico vazio e o conserto vira chute.
def _sobre_avenida(g, folga=2.0):
    """§42: a forma cai em cima de uma das 12 avenidas que a CENA desenha (a cada 30°,
    44 m nos cardeais e 34 nas demais, de AV_R_INICIO a AV_R_FIM)? A Orla da Baía não
    perguntava, e 31 lotes dela nasciam em cima de A2 e A3 (medido no palco, 23/09)."""
    C = g['cantos']
    rs = [math.hypot(x, z) for x, z in C]
    if max(rs) < 1420.0 or min(rs) > 7050.0: return False
    for _j, _m in _AV_MEIA.items():
        a = 2 * math.pi * _j / TEIA_N_RAD
        ca, sa = math.cos(a), math.sin(a)
        dx, dz = math.sin(a), -math.cos(a)
        if g['geo'] == 1:
            t0 = math.atan2(C[0][0], -C[0][1]); t1 = math.atan2(C[1][0], -C[1][1])
            span = ((t1 - t0) + math.pi) % (2 * math.pi) - math.pi
            meio = t0 + span / 2
            dang = abs(((a - meio) + math.pi) % (2 * math.pi) - math.pi)
            if dang <= abs(span) / 2 + math.asin(min(0.99, (_m + folga) / max(1.0, min(rs)))):
                return True
            continue
        pts = list(C) + [((C[0][0] + C[2][0]) / 2, (C[0][1] + C[2][1]) / 2)]
        lados = [x * ca + z * sa for x, z in pts]
        frente = [x * dx + z * dz for x, z in pts]
        if max(frente) <= 0: continue
        if min(lados) < _m + folga and max(lados) > -(_m + folga) and \
                (min(lados) <= 0 <= max(lados) or min(abs(v) for v in lados) < _m + folga):
            return True
    return False

OB_REJ = {'agua': 0, 'ilha': 0, 'programa': 0, 'canal': 0, 'anel': 0, 'declive': 0, 'ok': 0}

def _ob_livre(x, z, giro, w):
    """a pegada do lote está em terra seca, fora de canal e fora de peça?"""
    c, sn = math.cos(math.radians(giro)), math.sin(math.radians(giro))
    for dx, dz in ((0.0, 0.0), (-w/2, -OB_PROF/2), (w/2, -OB_PROF/2),
                   (w/2, OB_PROF/2), (-w/2, OB_PROF/2)):
        px, pz = x + dx*c - dz*sn, z + dx*sn + dz*c
        # ⚠️ A ÁGUA SE TESTA PELA COTA DESENHADA, não pela máscara de lago. A
        # máscara vem da grade de 59,2 m e o dedo tem 166 m de largura: ela
        # reprovaria o dedo inteiro por causa da lâmina que passa a 8 m do cais.
        if altura(px, pz) <= LAGO_COTA + 0.5: OB_REJ['agua'] += 1; return False
        # ⚠️ A ILHA NÃO TEM COTA, então o teste de água acima passa por cima
        # dela. Ver `ORLA_BAIA_ILHAS` em orla-baia.ts.
        if na_ilha_da_baia(px, pz): OB_REJ['ilha'] += 1; return False
        if em_programa(px, pz) is not None: OB_REJ['programa'] += 1; return False
        # ⚠️ AQUI A RESERVA DO CANAL RADIAL É MAIOR QUE NO RESTO DA CIDADE, e
        # o número é medido na cena, não escolhido. `CANAL_TALUDE + 2` reserva
        # 72 m do eixo, mas a SUPERFÍCIE DESENHADA (`superficieAt`, malha de
        # 59,2 m) borra a margem do canal e só volta aos −30 a 112 m: sondado
        # em r 4.400, rumo 25, a cota a 72 m é −35,3 contra os −30 que o
        # registro declararia. Eram 42 lotes da orla num barranco invisível
        # para o gerador. 85 m de margem cobre os 112 com folga.
        if em_canal(px, pz, 85.0): OB_REJ['canal'] += 1; return False
        if num_anel(px, pz) is not None: OB_REJ['anel'] += 1; return False
    if declive_lote(x, z, c, sn, 0.0, 0.0, w, OB_PROF) > DECL_LOTE_MAX:
        OB_REJ['declive'] += 1; return False
    OB_REJ['ok'] += 1
    return True


def _ob_fita():
    """os trechos, em ordem de qualidade: dedo primeiro, depois a praia, depois
    os quatro anéis de canal, cada fileira abrindo da enseada para o flanco."""
    a0, a1 = OB_ARCO
    e0, e1 = OB_ENSEADA
    f = FitaOrla()
    # 1. os quatro dedos, do par mais perto do eixo para fora
    for rumo in sorted(OB_DEDOS, key=lambda g: abs(g - (a0 + a1) / 2)):
        f.dedo(rumo, +1); f.dedo(rumo, -1)
    # 2. a praia, partida pelos dedos que a atravessam
    # ⚠️ O RAIO VEM DA FILEIRA, NÃO DE `OB_R_FRENTE`. O pé da praia é 4.720 mas a
    # testada da fileira A é 4.708, porque a Rua da Praia de 12 m fica entre as
    # duas. Usar o pé da praia aqui punha a fileira inteira dentro da rua.
    r_a, sent_a, _t_a = OB_FILEIRAS[0]
    dg = math.degrees((OB_DEDO_LARG / 2) / r_a)
    for ini, fim, sentido_enseada in ((a0, e0, -1), (e1, a1, +1)):
        cortes = sorted(g for g in OB_DEDOS if ini < g < fim)
        bordas = [ini] + [b for g in cortes for b in (g - dg, g + dg)] + [fim]
        pares = [(bordas[i], bordas[i+1]) for i in range(0, len(bordas) - 1, 2)]
        # da enseada para o flanco: o setor de baixo enche de `e0` para `a0`
        if sentido_enseada < 0: pares = [(b, a) for a, b in reversed(pares)]
        for aa, bb in pares: f.anel(r_a, sent_a, aa, bb)
    # 3. as fileiras de dentro, de fora para dentro
    #
    # ⚠️ CADA FILEIRA ENTRA NA ENSEADA ATÉ ONDE A ÁGUA DEIXA, e isso não é
    # ganho de testada procurado a fórceps: é o que uma enseada faz. A linha
    # d'água dela mergulha num seno, então quanto mais INTERNA a fileira, mais
    # ela avança para dentro do arco antes de molhar o pé. Parar todas em 41,3 e
    # 61,3 (a borda da enseada) deixava a fileira F, que está 664 m mais para
    # dentro, terminar 4,6° antes do necessário.
    #
    # MEDIDO: as cinco fileiras juntas ganham cerca de 2,0 km de testada assim,
    # que é exatamente o que a reserva maior do canal radial custou.
    def _entra_na_enseada(r_f, lado):
        """o rumo em que a praia da enseada alcança esta fileira. `lado` é -1
        para o setor de baixo (a enseada abre a partir de e0) e +1 para o de
        cima."""
        borda = e0 if lado < 0 else e1
        lo, hi = 0.0, (e1 - e0) / 2            # até o eixo, nunca além
        for _ in range(40):
            m = (lo + hi) / 2
            g = borda + (m if lado < 0 else -m)
            if ob_linha_dagua(g) - OB_PRAIA >= r_f: lo = m
            else: hi = m
        return borda + (lo if lado < 0 else -lo)

    for r_f, sentido, _tier in OB_FILEIRAS[1:]:
        f.anel(r_f, sentido, _entra_na_enseada(r_f, -1), a0)   # setor de baixo
        f.anel(r_f, sentido, _entra_na_enseada(r_f, +1), a1)   # setor de cima
    return f


def planta_orla_baia():
    """os 2.062 lotes dos tiers 4 e 5, na margem oposta da baía."""
    if not TIER_DE: return []
    fila = []
    for t in ('ordinal_believer', 'dog_legend'):
        g = [a for a in elig if TIER_DE.get(a) == t]
        g.sort(key=lambda a: -CHANGE_DE.get(a, -1e9))    # melhor comportamento primeiro
        fila += g
    fita = _ob_fita()
    out, fora = [], []
    for a in fila:
        w = max(OB_TESTADA_MIN, elig_area(a) / OB_PROF)
        pos = fita.proximo(w)
        if pos is None:
            fora.append(a); continue
        out.append((pos[0], pos[1], w, OB_PROF, pos[2], a, pos[3], pos[4], pos[5]))
    print('Orla da Baía: %d lotes (%d tier 4, %d tier 5), %.3f km², testada '
          '%.1f m mediana | linha %.1f km, sobra %.1f km'
          % (len(out), sum(1 for l in out if TIER_DE.get(l[5]) == 'ordinal_believer'),
             sum(1 for l in out if TIER_DE.get(l[5]) == 'dog_legend'),
             sum(l[2] * l[3] for l in out) / 1e6,
             sorted(l[2] for l in out)[len(out)//2] if out else 0,
             fita.comprimento() / 1000, fita.sobra() / 1000), file=sys.stderr)
    if fora:
        print('  ⚠️ %d carteiras dos tiers 4 e 5 NÃO couberam na orla e voltam '
              'para o tecido' % len(fora), file=sys.stderr)
    _tot = sum(OB_REJ.values()) or 1
    print('  a sondagem, por motivo: %s' % '  '.join(
        '%s %d (%.0f%%)' % (k, v, 100.0*v/_tot) for k, v in OB_REJ.items()),
        file=sys.stderr)
    for t in fita.trechos:
        if t['cur'] < t['comp'] * 0.98:
            print('    sobra em %s: %.0f m de %.0f' % (
                ('anel r%.0f de %.1f°' % (t['r'], t['a0'])) if t['tipo'] == 'anel'
                else ('dedo rumo %.1f lado %+d' % (t['rumo'], t['lado'])),
                t['comp'] - t['cur'], t['comp']), file=sys.stderr)
    # ⚠️ DIAGNÓSTICO: `SO_ORLA=1` para aqui, antes do replante do tecido, que é
    # a parte cara. Sem isso cada volta de conserto da orla custa a cidade
    # inteira.
    if os.environ.get('SO_ORLA'):
        sys.exit(0)
    return out

# ═══════════════════════════════════════════════════════════════════════════
# O DISTRITO FINANCEIRO: AS 21 INSTITUCIONAIS DENTRO DA SATOSHI PLAZA
#
# Publicado em `/dogcity/docs` §5 e em `custodia-e-distrito-financeiro.md`:
# endereço próprio para corretora, ponte e mesa de operação, dimensionado pelo
# que detêm, com a MESMA curva e teto elevado de 40.000 para 150.000 m². Elas
# saíram da fila residencial no próprio snapshot (por isso a fila tem 85.797 e
# não 85.818); o que faltava era o chão.
#
# ⚠️ O NÚMERO PUBLICADO É RESERVA, NÃO OCUPAÇÃO, e isso precisa ficar claro: a
# página fala em 1,89 km² para o distrito, e dentro de r 1.420 não existe essa
# terra seca, porque o Lago da Praça ocupa 2,63 dos 3,79 km² do anel. Medido em
# 21/09: sobra 1,2 km² de terra seca, e as 21 carteiras somam 403.911 m², ou
# seja 0,404 km². Cabe com folga de três vezes, sem tocar no lago. A maior
# delas, a Gate.io, chega a 54.300 m², 36% do teto elevado.
#
# Elas ficam na faixa seca entre a muralha do precinto (r 900) e a margem
# interna do lago, de frente para a água, e a faixa pula os quatro bulevares
# cardeais, que são as pontes.
# ⚠️ A FAIXA ENCOLHEU 14 m EM 22/09 PARA CABER A RUA, e o motivo é medição:
# os 21 lotes ocupavam a faixa seca INTEIRA, de 915 a 1.055, e o distrito saía
# com 0% de lote com rua encostada — o único da cidade em zero. Eles davam
# frente para o lago e fundo para a muralha, sem nenhum acesso.
# Agora o fundo começa em 929 e a Rua do Distrito Financeiro corre em 921,
# entre a muralha do precinto (900) e o lote: acesso pelos fundos, vista para a
# água, que é o arranjo normal de frente d'água (o mesmo do dedo da orla).
FIN_RUA_R, FIN_RUA_LARG = 921.0, 12.0
FIN_R0, FIN_R1 = 929.0, 1055.0        # faixa seca entre a rua do distrito e o lago
FIN_PULO = 3.5                        # graus de folga em cada bulevar cardeal
FIN_TETO = 150000.0                   # o teto elevado que a página publica
S_FIN = 7                             # setor 8 no endereço

def planta_distrito_financeiro():
    cam = p('data/snapshots/dog_966670_tag_institucional.json')
    if not os.path.exists(cam): return []
    linhas = json.load(open(cam))
    if isinstance(linhas, dict): linhas = linhas.get('institucionais') or linhas.get('linhas') or []
    prof = FIN_R1 - FIN_R0
    r_med = (FIN_R0 + FIN_R1) / 2
    itens = sorted(linhas, key=lambda r: -float(r.get('dog') or 0))
    out, ang = [], 0.0
    for it in itens:
        dog = float(it.get('dog') or 0)
        area = max(1.0, min(FIN_TETO, K_PUBLICADA * math.sqrt(max(0.0, dog))))
        frente = max(20.0, area / prof)
        # ⚠️ O PASSO SAI DO CANTO DO RETÂNGULO, NÃO DO ARCO NO RAIO MÉDIO. Ver a
        # nota de `_testada_no_anel`. Aqui o erro era grande porque a faixa é
        # estreita (140 m) e o raio é pequeno (985): a Gate.io tem 388 m de
        # testada, ou 22,6° de arco, e o canto dela passava 13,98 m por cima da
        # vizinha. Com o canto na conta, o passo dela vira 24,0°.
        passo = 2.0 * math.degrees(math.atan((frente / 2) / FIN_R0))
        # ⚠️ §41 (23/09): A FATIA DE ANEL TEM A ÁREA EXATA, E A CONTA DA CORDA ACIMA
        # FICA SÓ COMO HISTÓRICO. O lote agora é a fatia inteira entre FIN_R0 e
        # FIN_R1 (geo 1, arcos centrados na origem), então o ângulo sai da área,
        # com o piso de 20 m de arco na frente. A Kraken passa de 57° a 51,5°.
        passo = max(math.degrees(2.0 * area / (FIN_R1 ** 2 - FIN_R0 ** 2)),
                    math.degrees(20.0 / FIN_R0))
        # ⚠️ PULA A PONTE. Os quatro bulevares cardeais atravessam esta faixa e
        # viram ponte sobre o lago: lote em cima deles fecharia a travessia.
        for _ in range(64):
            meio = (ang + passo / 2) % 360.0
            if min(abs(((meio - c + 180) % 360) - 180) for c in (0, 90, 180, 270)) > FIN_PULO + passo / 2:
                break
            ang = (ang + FIN_PULO) % 360.0
        a_meio = math.radians((ang + passo / 2) % 360.0)
        _t0 = math.radians(ang); _t1 = _t0 + math.radians(passo)
        _g = {'cantos': CEL.cantos_fatia(FIN_R0, FIN_R1, _t0, _t1), 'geo': 1,
              'area': CEL.area_fatia(FIN_R0, FIN_R1, _t0, _t1), 'prof': prof,
              'centro': CEL.centroide_fatia(FIN_R0, FIN_R1, _t0, _t1),
              'giro': math.degrees(a_meio) % 360.0}
        x, z = _g['centro']
        out.append((x, z, _g['area'] / prof, prof, math.degrees(a_meio) % 360.0,
                    it.get('address'), it.get('motivos') or it.get('rotulo'), _g))
        ang = (ang + passo + 8.0 * 180.0 / math.pi / r_med) % 360.0   # 8 m de rua entre lotes
    print('Distrito Financeiro: %d lotes institucionais, %.0f m² somados, maior %.0f m²'
          % (len(out), sum(l[2] * l[3] for l in out), max((l[2] * l[3] for l in out), default=0)),
          file=sys.stderr)
    return out

FIN_LOTES = planta_distrito_financeiro()

# ⚠️ A ORLA SAI DA FILA NORMAL. Quem tem endereço na alça não disputa tecido:
# plantar duas vezes daria dois lotes ao mesmo dono, que é o defeito mais grave
# que um loteamento pode ter.
ORLA_LOTES = planta_orla_nobre()
ORLA_BAIA_LOTES = planta_orla_baia()
# ⚠️ A ORLA DA BAÍA SAI DA FILA PELO MESMO MOTIVO QUE A ORLA NOBRE: quem já tem
# endereço não disputa tecido, e plantar duas vezes daria dois lotes ao mesmo
# dono. O conjunto é UM só para os dois destinos, senão a checagem de
# duplicidade lá embaixo teria de saber de dois.
ORLA_DONOS = {l[5] for l in ORLA_LOTES if l[5]} | {l[5] for l in ORLA_BAIA_LOTES if l[5]}
# ⚠️ A FILA INTEIRA CONTINUA SENDO A RÉGUA DE POSTO. Quem foi para a orla sai
# do plantio do tecido mas NÃO sai da fila: `posto` alimenta a coorte gravada
# em cada registro, e tirar 446 carteiras dele mudava a coorte de todo mundo
# que vem depois, além de matar a gravação com KeyError na primeira delas.
CARTEIRAS_TODAS = list(carteiras)
posto_fila = {c[3] for c in CARTEIRAS_TODAS}     # quem é carteira da fila, para contar direito
carteiras = [c for c in carteiras if c[3] not in ORLA_DONOS]
N = len(carteiras)
# ⚠️ E O ALVO DA BISSEÇÃO NÃO É `N`. ELE JÁ ERRA UMA VEZ E ERROU DE NOVO.
#
# `N` é a fila do TECIDO: a fila inteira menos quem já tem endereço na Orla
# Nobre e na Orla da Baía. Mas `_lotes_de_carteira` conta TODO lote de carteira
# que saiu, e os 2.508 das duas orlas estão nele por construção, porque eles
# continuam na fila para efeito de coorte. Comparar um com o outro deixa o teste
# de "coube todo mundo" frouxo em exatamente 2.508 carteiras: a bisseção
# declarava `cabe` com 2.508 carteiras do tecido sem lote nenhum.
#
# É a MESMA família do defeito de 21/09 que trocou `len(saida)` por
# `_lotes_de_carteira` (ver a nota lá): cada distrito especial novo afrouxa de
# novo o teste que conta cabeças, porque muda quem está em qual conjunto. A
# regra que fecha o assunto: o alvo é a FILA INTEIRA, `len(posto_fila)`, que não
# se move quando um distrito novo nasce. Aqui: 69.995 = 67.487 do tecido mais
# 2.508 das duas orlas.
N_DESTINOS = len(posto_fila)
if ORLA_DONOS:
    print('  a fila do tecido fica com %d carteiras (as %d da orla saíram)'
          % (N, len(ORLA_DONOS)), file=sys.stderr)

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
# ⚠️ O TETO ERA A FAIXA INTEIRA, E A FAIXA TEM DUAS FILEIRAS COSTAS COM COSTAS.
# Com PROF_MAX = 50 o lote afundado atravessava para a fileira de trás e ocupava
# o chão de quem tem frente para a outra rua. No limite exato os dois centros
# coincidem e os dois lotes ficam IDÊNTICOS: medido em 20/09 na cidade do
# snapshot, 80 pares de lotes com a mesma posição e o mesmo tamanho para donos
# diferentes, e dezenas de milhares de pares com sobreposição parcial, todos com
# profundidade entre 49 e 50 m. O defeito é antigo, de antes do snapshot.
# O teto passa a ser a FILEIRA. Quem precisa de mais fundo que isso é
# superquadra, e superquadra ocupa o bloco inteiro por construção.
PROF_MAX = FAIXA             # 50 m: o lote pode atravessar a faixa inteira, DESDE QUE
                             # reserve o trecho correspondente na fileira de trás
# ⚠️ A FRAÇÃO DA ÁREA QUE UMA PRATELEIRA TEM DE HONRAR ANTES DE SER ACEITA.
# Ver a nota longa dentro de `coloca`, no ramo do teto de fundo: 0,95 da área da
# passada pega os 87 lotes espremidos do registro selado e não encosta na banda
# normal, que está toda acima de 0,99.
EXIGE_AREA = 0.95

def _valida_lote(C):
    """A máscara fina do lote pronto: cantos (recuados 0,3 m para dentro) e centro
    livres, nenhum ponto abaixo da lâmina, declividade da pegada dentro do teto. As
    fileiras já foram amostradas a cada 3 m contra a máscara inteira; aqui fica o
    que a amostra não vê: o fino entre duas amostras e o declive do lote inteiro."""
    cx, cz = CEL.centroide(C)
    pts = [(x + (cx - x) * 0.3 / max(0.3, math.hypot(cx - x, cz - z)),
            z + (cz - z) * 0.3 / max(0.3, math.hypot(cx - x, cz - z))) for x, z in C]
    for x, z in pts + [(cx, cz)]:
        if not livre_tecido(x, z):
            REJ['mascara'] += 1
            return False
    hs = [altura(x, z) for x, z in pts]
    if min(hs + [altura(cx, cz)]) < LAGO_COTA:
        REJ['agua'] += 1
        return False
    fr = max(1e-6, math.hypot(C[1][0] - C[0][0], C[1][1] - C[0][1]))
    pf = max(1e-6, math.hypot((C[3][0] + C[2][0] - C[0][0] - C[1][0]) / 2,
                              (C[3][1] + C[2][1] - C[0][1] - C[1][1]) / 2))
    gx = ((hs[1] + hs[2]) - (hs[0] + hs[3])) / (2 * fr)
    gz = ((hs[2] + hs[3]) - (hs[0] + hs[1])) / (2 * pf)
    if math.hypot(gx, gz) > DECL_LOTE_MAX:
        REJ['declive'] += 1
        return False
    REJ['ok'] += 1
    return True

# ⚠️ §37/§41: A GEOMETRIA DO LOTE VIAJA AO LADO DE `saida`, POR ENDEREÇO. A tupla de
# nove campos é desempacotada em mais de dez lugares; ela continua com (x, z) no
# centróide e (frente, prof) tais que frente·prof = área exata, e os 4 cantos, a
# área e o `geo` moram aqui. Toda cópia de `saida` leva uma cópia disto junto.
GEOM = {}

def _geom_de(reg):
    C = reg['cantos']
    f = reg['fil']; c = f['cel']
    return {'cantos': [tuple(p) for p in C], 'area': reg['area'], 'geo': 0,
            'giro': math.degrees(c.fi) % 360.0,
            'frente': math.hypot(C[1][0] - C[0][0], C[1][1] - C[0][1]),
            'prof': abs(reg['db'] - reg['df']), 'tipo': reg['tipo'],
            'cel': (c.setor, c.q, c.b), 'fila': f['i'], 'wm': (reg['wa'] + reg['wb']) / 2}

def coloca(s, dog, addr, escala=1.0, exige=0.0):
    """§37/§40: planta a carteira numa CÉLULA do distrito `s` e devolve
    (x, z, frente, prof, quarto, quarteirão), com frente·prof = área exata.
    ⚠️ `exige` FICA NA ASSINATURA E NÃO FAZ MAIS NADA. Ela existia porque o lote de
    retângulo podia sair espremido (área truncada em silêncio); o lote de célula
    sai com a área pedida ou mais (piso de 5 m de frente), nunca menos.
    O coloca de retângulo está no histórico do git (antes de 23/09/2026)."""
    area = max(PISO_LOTE, area_de(dog, max(r_medio[s], R_INICIO)) * escala)
    reg = DIST[s].coloca(area, _valida_lote)
    if reg is None:
        return None
    reg['addr'] = addr
    g = _geom_de(reg)
    GEOM[addr] = g
    C = g['cantos']
    COTA[addr] = altura((C[0][0] + C[1][0]) / 2, (C[0][1] + C[1][1]) / 2)
    PRAT[addr] = (s, reg['fil']['i'], g['wm'] * min(reg['df'], reg['db']))
    cx, cz = CEL.centroide(C)
    c = reg['fil']['cel']
    return (cx, cz, g['area'] / g['prof'], g['prof'], c.q, c.b)

COTA = {}
PRAT = {}     # endereço -> (distrito, índice da prateleira, x ao longo dela)

def _lotes_de_carteira(lista):
    """⚠️ CONTAR A SAÍDA INTEIRA MENTE. Desde 21/09 a saída tem quatro naturezas
    misturadas: lote de carteira, lote do projeto (reserva e orla), lote
    institucional e o que mais vier. O teste de "coube todo mundo" comparava
    `len(saida)` com o tamanho da fila e passou a dar positivo com a cidade
    faltando gente: medido, 9.239 carteiras ficaram sem lote e a bisseção
    declarou sucesso, porque 12.266 lotes de reserva tinham entrado na conta."""
    return sum(1 for r in lista if not str(r[3]).startswith('__projeto') and r[3] in posto_fila)


def socalca():
    """Agrupa os lotes de cada fileira em BANCADAS de cota única.

    ⚠️ DECISÃO DO FUNDADOR, 20/09: socalco com teto de 3 m. Sem isto, 6,1% das
    divisas passam de 3 m e 0,6% passam de 5 m, com pior caso medido de 8,81 m,
    e muro cego dessa altura encostado na divisa é o bloco de concreto de novo,
    agora na escala do vizinho e ao lado de um boneco de 1,70 m.

    A regra: dentro da fileira, lotes consecutivos entram na mesma bancada
    enquanto o terreno deles não se afastar mais que o teto. Todos os lotes de
    uma bancada recebem a MESMA cota, então o muro entre vizinhos ali dentro é
    ZERO. Onde o terreno pede mais, a bancada quebra e nasce o degrau, que é o
    socalco: ele aparece na calçada como degrau ou rampa curta, nunca como
    paredão, porque a quebra é do conjunto e não de um lote sozinho.

    A cota da bancada é a MEDIANA das cotas naturais dela, não a média: mediana
    não é puxada pelo lote de ponta que pegou uma reentrância do relevo.
    """
    _NAT = {a: COTA.get(a, 0.0) for a in PRAT}     # a cota natural, antes de qualquer bancada
    porFila = {}
    for a, (s_, i_, x_) in PRAT.items():
        porFila.setdefault((s_, i_), []).append((x_, a))
    bancadas = quebras = 0
    desloc = []
    for _k, lotes in porFila.items():
        lotes.sort()
        grupo = []
        def fecha(g):
            nonlocal bancadas
            if not g: return
            bancadas += 1
            cs = sorted(COTA.get(a, 0.0) for _x, a in g)
            alvo = cs[len(cs) // 2]
            for _x, a in g:
                desloc.append(abs(COTA.get(a, 0.0) - alvo))
                COTA[a] = alvo
        for x_, a in lotes:
            c = COTA.get(a, 0.0)
            if grupo:
                base = COTA.get(grupo[0][1], 0.0)
                if abs(c - base) > SOCALCO_TETO:
                    fecha(grupo); grupo = []; quebras += 1
            grupo.append((x_, a))
        fecha(grupo)
    # ⚠️ NIVELAR CADA FILEIRA SOZINHA EMPURRA O DESNÍVEL PARA A DIVISA DE FUNDO.
    # Medido no primeiro passe: a mediana do muro caiu de 0,54 m para zero, que
    # é o que a bancada promete, mas a cauda ENGORDOU (acima de 3 m subiu de
    # 6,1% para 8,6%), porque o que sumia entre vizinhos de frente reapareceu
    # entre bancadas e entre as duas fileiras costas com costas, cada uma
    # nivelada por conta própria.
    #
    # A segunda metade da regra é relaxamento: enquanto duas bancadas VIZINHAS
    # (na mesma fileira, ou na fileira de trás, sobre o mesmo trecho) passarem
    # do teto, as duas andam meio a meio na direção uma da outra. Converge, e
    # o custo é a cota se afastar mais do terreno natural, que é terraplanagem
    # medida e não surpresa.
    grupoDe, cotaBanc, vizinhos = {}, {}, {}
    for (s_, i_), lotes in porFila.items():
        lotes.sort()
        atual, base = None, None
        for x_, a in lotes:
            c = COTA.get(a, 0.0)
            if atual is None or abs(c - base) > 1e-9:
                atual = (s_, i_, len(cotaBanc)); base = c
                cotaBanc[atual] = c; vizinhos.setdefault(atual, set())
                if lotes.index((x_, a)) > 0:
                    pass
            grupoDe[a] = atual
    # vizinhança: bancadas consecutivas na mesma fileira e o par de trás
    porFilaBanc = {}
    for a, g in grupoDe.items():
        porFilaBanc.setdefault((g[0], g[1]), []).append((PRAT[a][2], g))
    for _k, lst in porFilaBanc.items():
        lst.sort()
        seq = []
        for _x, g in lst:
            if not seq or seq[-1] != g: seq.append(g)
        for u, v in zip(seq, seq[1:]):
            vizinhos.setdefault(u, set()).add(v); vizinhos.setdefault(v, set()).add(u)
    for (s_, i_), lst in porFilaBanc.items():
        _pr = PASSO[s_][i_] if i_ < len(PASSO[s_]) else None
        _par = _pr.get('par') if _pr else None
        if _par is None: continue
        alvo = porFilaBanc.get((s_, _par['i']))
        if not alvo: continue
        for _x, g in lst:
            for _x2, g2 in alvo:
                if abs(_x - _x2) < 40:
                    vizinhos.setdefault(g, set()).add(g2); vizinhos.setdefault(g2, set()).add(g)
    for _volta in range(40):
        pior = 0.0
        for u, vs in vizinhos.items():
            for v in vs:
                d = cotaBanc[u] - cotaBanc[v]
                if abs(d) > SOCALCO_TETO:
                    passo = (abs(d) - SOCALCO_TETO) / 2.0 * (1 if d > 0 else -1)
                    cotaBanc[u] -= passo; cotaBanc[v] += passo
                    pior = max(pior, abs(d))
        if pior <= SOCALCO_TETO + 0.01: break
    # ⚠️ §42: A BANCADA NÃO SAI DO CHÃO DOS PRÓPRIOS LOTES. O relaxamento acima limita
    # o degrau entre bancadas vizinhas a 3 m puxando as duas uma para a outra, e numa
    # encosta a cadeia de vizinhas arrastava bancada inteira para longe do chão: medido
    # no palco de 23/09, um lote de 410 m² com o chão a −3 m gravou cota +16 m. Aqui a
    # bancada volta para no máximo 5 m de cada lote dela; onde isso quebra o teto de
    # 3 m do degrau, o muro fica (o portão tolera 1% de divisas acima de 3 m).
    _membros = {}
    for a, g in grupoDe.items(): _membros.setdefault(g, []).append(_NAT.get(a, COTA.get(a, 0.0)))
    _presas = 0
    for g, nat in _membros.items():
        lo, hi = max(nat) - 5.0, min(nat) + 5.0
        if cotaBanc[g] < lo or cotaBanc[g] > hi:
            cotaBanc[g] = min(max(cotaBanc[g], lo), hi); _presas += 1
    if _presas:
        print('  socalco: %d bancadas presas a 5 m do próprio chão' % _presas, file=sys.stderr)
    for a, g in grupoDe.items():
        desloc.append(abs(COTA.get(a, 0.0) - cotaBanc[g]))
        COTA[a] = cotaBanc[g]

    desloc.sort()
    if desloc:
        print('  socalco: %d bancadas em %d fileiras, %d quebras; a cota do lote se move '
              '%.2f m na mediana e %.2f m no p90'
              % (bancadas, len(porFila), quebras, desloc[len(desloc)//2], desloc[int(len(desloc)*0.9)]),
              file=sys.stderr)


def _area_livre(t):
    """a área de fileira ainda livre no distrito `t`, em m²"""
    return sum((w1 - w0) * f['A2'] for f in PASSO[t] for w0, w1 in f['livre'])

def uma_passada():
    global PASSO, cursor, saida
    # ⚠️ §40: as fileiras das células voltam ao estado amostrado (a máscara é
    # medida UMA vez, antes da bisseção; cada passada só reinicia os trechos).
    for _D in DIST: _D.reinicia()
    PASSO = [_D.F for _D in DIST]
    cursor = [0]*N_DIST
    GEOM.clear()
    saida = []
    COTA.clear(); PRAT.clear()
    ORC['queimada'] = 0.0; ORC['queimada_n'] = 0
    ORC['vao_usado'] = 0.0; ORC['vao_n'] = 0
    ORC['q_estreita'] = ORC['q_mascara'] = ORC['q_par'] = 0.0
    ORC['espremido'] = ORC['desviado'] = ORC['desviado_area'] = 0
    for _l in VAOS: _l.clear()
    sem_lugar.clear()
    aparadas.clear()
    no_bloco.clear()
    # ⚠️ A ORLA ENTRA PRIMEIRO E NÃO DEPENDE DE k: a geometria dela é fixa, o
    # dono é decidido pelo tier e a área tem regra própria. Ela é setor 7 no
    # endereço, um quarteirão por lote, porque cada lote tem o seu próprio giro
    # tangente ao círculo da avenida.
    for _i, (_x, _z, _fr, _pf, _gi, _end, _rot, _g) in enumerate(FIN_LOTES, 1):
        _GIRO_ORLA[(S_FIN, 1, _i)] = _gi
        _a = _end or f'__projeto_financeiro_{_i:03d}'
        GEOM[_a] = _g
        COTA[_a] = altura(_x, _z)
        saida.append((_x, _z, S_FIN, _a, _fr, _pf, 1, _i, 1))
    for _i, (_x, _z, _fr, _pf, _gi, _dono, _g) in enumerate(ORLA_LOTES, 1):
        _GIRO_ORLA[(S_ORLA, 1, _i)] = _gi
        GEOM[_dono or f'__projeto_orla_{_i:03d}'] = _g
        # ⚠️ A CHAVE DA COTA TEM DE SER O ENDEREÇO GRAVADO, E NÃO ERA. Ela era
        # `__orla{i}` e o registro sai como `__projeto_orla_{i:03d}`: para os 65
        # lotes de projeto da Orla Nobre o `COTA.get(a, 0.0)` da gravação não
        # achava nada e escrevia **cota 0,0** onde o chão é −30. Medido em 22/09
        # pelo censo de divisas: 130 divisas de exatamente 30,00 m entre mansões
        # vizinhas, que é a plataforma da alça contra um zero inventado. O
        # portão não pegava porque 0 está dentro da faixa do relevo.
        _a = _dono or f'__projeto_orla_{_i:03d}'
        COTA[_a] = altura(_x, _z)
        saida.append((_x, _z, S_ORLA, _a, _fr, _pf, 1, _i, 1))
    # ⚠️ A ORLA DA BAÍA ENTRA NA MESMA FILA E PELO MESMO CONTRATO: geometria
    # fixa, dono decidido pelo tier, área pela curva. Setor 9 no endereço, um
    # quarteirão por lote, porque no dedo o giro é radial e na fileira é
    # tangente — dois giros diferentes não cabem num quarteirão só.
    for _x, _z, _fr, _pf, _gi, _dono, _q, _b, _g in ORLA_BAIA_LOTES:
        _GIRO_ORLA[(S_OB, _q, _b)] = _gi
        GEOM[_dono] = _g
        _x, _z = _g['centro']; _fr = _g['area'] / _g['prof']
        COTA[_dono] = altura(_x, _z)
        saida.append((_x, _z, S_OB, _dono, _fr, _pf, _q, _b, 1))
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
    # ⚠️ QUEM JÁ TEM ENDEREÇO NA ORLA NÃO ENTRA AQUI. Quatro carteiras do Dog
    # Social Club também são tier 1 a 3: o laço do DSC plantava e a orla
    # plantava de novo, e o portão pegou 85.801 destinos para 85.797 carteiras.
    # Dois lotes para o mesmo dono é o pior defeito que um registro pode ter.
    for a in sorted(x for x in dsc if x not in ORLA_DONOS):
        r = coloca(S_DSC, elig[a], a)
        if r is None:
            sem_lugar.append(a); continue
        chave = (S_DSC, r[4], r[5])
        no_bloco[chave] = no_bloco.get(chave, 0) + 1
        saida.append((r[0], r[1], S_DSC, a, r[2], r[3], r[4], r[5], no_bloco[chave]))

    # ⚠️ A RESERVA DE 15% É PROMESSA PÚBLICA (contrato §5, docs §5): 15% dos
    # LOTES de cada bairro, espalhados, nunca em bloco único. Ela existe para
    # bancar a troca de quem for marcado institucional por engano e tiver o
    # apelo aceito, e é o land bank do projeto.
    #
    # O jeito mais simples de espalhar é intercalar: a cada 5,67 lotes de
    # carteira nasce um lote de reserva com a MESMA área do lote da vez, na
    # mesma prateleira, no mesmo bairro. Sai 15% do total, distribuído por
    # construção, sem sorteio e sem grumo. 15 de 85 é a conta do contrato:
    # 15.141 reservados ao lado de 85.797 de carteira.
    # ⚠️ 15% ERA NÚMERO DE QUANDO PARECIA SOBRAR TERRA (fundador, 21/09:
    # "podemos adaptar"). Medido: com 15% a razão contra a área publicada cai
    # de 0,96 para 0,81, ou seja cada ponto de reserva custa um ponto no lote
    # de TODO MUNDO. E a reserva tem duas funções de tamanhos muito diferentes:
    # o direito de apelo, que precisa de dezenas de lotes (são 21 marcados, 13
    # deles chamadas frágeis), e o land bank do projeto, que é produto.
    # Dentro do bairro fica só o que serve ao apelo, com folga de cem vezes;
    # o land bank grande sai da coroa externa, onde não tira metro de ninguém.
    # ⚠️ 1%, E FOI DECISÃO DO FUNDADOR EM 22/09, contra número medido. A reserva
    # saiu de 15% para 2% em 21/09 ("15% foi um número que surgiu quando
    # parecíamos ter terra sobrando") e agora para 1%, porque a Orla da Baía
    # consumiu 355 km de prateleira do tecido e a razão entregue/prometida caiu
    # de 0,99 para 0,95, reprovando no portão. Cada ponto de reserva custa um
    # ponto de área de TODO MUNDO, e 1% ainda cobre as 21 carteiras marcadas com
    # direito de apelo dezenas de vezes.
    _pct = float(os.environ.get('RESERVA_PCT', '1')) / 100.0
    _reserva_passo = _pct / max(1e-9, 1.0 - _pct)
    _reserva_conta, _reserva_n = 0.0, 0
    for c, s in zip(gerais, destino):
        _reserva_conta += _reserva_passo
        if _reserva_conta >= 1.0:
            _reserva_conta -= 1.0
            _reserva_n += 1
            _rr = coloca(s, elig[c[3]], f'__projeto_reserva_{_reserva_n:05d}')
            if _rr is not None:
                _ch = (s, _rr[4], _rr[5])
                no_bloco[_ch] = no_bloco.get(_ch, 0) + 1
                saida.append((_rr[0], _rr[1], s, f'__projeto_reserva_{_reserva_n:05d}',
                              _rr[2], _rr[3], _rr[4], _rr[5], no_bloco[_ch]))
        # ⚠️ PRIMEIRO EXIGINDO A ÁREA, DEPOIS ACEITANDO O QUE HOUVER. O desvio de
        # distrito já existia e nunca disparava, porque `coloca` só devolvia None
        # quando não havia prateleira NENHUMA: lote de 30% da promessa não é
        # None. Com `exige` ele devolve None quando a prateleira só entrega
        # sliver, e a carteira vai para o distrito com mais testada livre.
        # ⚠️ E A TERCEIRA TENTATIVA NÃO TEM `exige`, DE PROPÓSITO. A regra do
        # fundador é que todo elegível tem endereço; se nem o distrito mais folgado
        # honra a área, o lote espremido ainda é melhor que carteira sem lote, e
        # o contador `ORC['espremido']` diz quantas vezes isso aconteceu.
        # ⚠️ `_esp0` SEPARA OS DOIS MOTIVOS DE DESVIO, e sem ele o contador mente.
        # `coloca` já devolvia None quando o distrito não tinha prateleira
        # NENHUMA, e esse desvio é antigo: medido, 4.807 carteiras por passada.
        # O desvio POR ÁREA é outro, muito menor (100 na mesma passada), e somar
        # os dois num número só faria o conserto parecer dez vezes maior do que é.
        _s0, _esp0 = s, ORC['espremido']
        r = coloca(s, elig[c[3]], c[3], exige=EXIGE_AREA)
        if r is None:
            _por_area = ORC['espremido'] > _esp0
            alt = max(range(N_DIST), key=_area_livre)
            r = coloca(alt, elig[c[3]], c[3], exige=EXIGE_AREA)
            if r is not None:
                s = alt
                ORC['desviado'] += 1
                if _por_area: ORC['desviado_area'] += 1
            else:
                r = coloca(_s0, elig[c[3]], c[3])
                if r is None:
                    r = coloca(alt, elig[c[3]], c[3]); s = alt
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
        # ⚠️ O CORTE DE CABELO VIROU TOSQUIA, E AGORA A ÁREA É PROMESSA PÚBLICA.
        # Medido em 20/09 com a escada velha (0,6 / 0,35 / 0,15): 3.175 carteiras
        # saíram abaixo do prometido e as piores receberam 5% dele. Uma carteira
        # de 23,4M DOG, com 4.768 m² publicados na landing, saiu com 261 m².
        # Isso é pior do que o problema que a escada resolvia: ela existia para
        # uma carteira não derrubar a mediana de todo mundo, e virou um imposto
        # de 85% sorteado em quem chega no fim da fila do distrito.
        #
        # Agora: primeiro TODOS os distritos com a área INTEIRA, e só depois
        # corte, e raso. Se nem assim couber, a passada reprova e a bisseção
        # baixa k, que é o mecanismo justo: todo mundo divide o aperto.
        _ordem_dist = sorted(range(N_DIST),
                             key=lambda t: -_area_livre(t))
        for t in _ordem_dist:
            if r is not None: break
            if t == s: continue
            r = coloca(t, elig[c[3]], c[3])
            if r is not None: s = t
        for esc in (0.9, 0.8):
            if r is not None: break
            for t in _ordem_dist:
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
    # a sobra de ponta de fileira vira do vizinho (ver `Distrito.fecha_fileiras`)
    _gan = sum(D.fecha_fileiras(_valida_lote) for D in DIST)
    _mud = 0
    for _k, _r in enumerate(saida):
        _g = GEOM.get(_r[3])
        if not _g or 'fila' not in _g: continue
        _reg = next((l for l in PASSO[_r[2]][_g['fila']]['lotes'] if l.get('addr') == _r[3]), None)
        if _reg is None: continue
        _novo = _geom_de(_reg)
        if abs(_novo['area'] - _g['area']) < 1e-6: continue
        GEOM[_r[3]] = _novo
        _cx, _cz = CEL.centroide(_novo['cantos'])
        saida[_k] = (_cx, _cz, _r[2], _r[3], _novo['area'] / _novo['prof'], _novo['prof'],
                     _r[6], _r[7], _r[8])
        C = _novo['cantos']
        COTA[_r[3]] = altura((C[0][0] + C[1][0]) / 2, (C[0][1] + C[1][1]) / 2)
        _mud += 1
    if _gan:
        print('  ponta de fileira: %d sobras absorvidas pelo lote vizinho' % _mud, file=sys.stderr)
    socalca()
    print('  reserva do projeto: %d lotes intercalados (%.1f%% do total)'
          % (_reserva_n, 100.0 * _reserva_n / max(1, len(saida))), file=sys.stderr)
    if os.environ.get('DIAG') and sem_lugar:
        import collections
        print('  DIAG %d sem lugar; por setor: %s' % (len(sem_lugar),
              dict(sorted(collections.Counter(falhou_em).items()))), file=sys.stderr)
        for t in range(N_DIST):
            resto = _area_livre(t)
            usadas = sum(1 for pr in PASSO[t] if not pr['livre'])
            print('    S%02d cursor %4d/%4d  testada livre restante %8.0f m  prateleiras zeradas %4d'
                  % (t+1, cursor[t], len(PASSO[t]), resto, usadas), file=sys.stderr)
        falhou_em.clear()
    # ⚠️ o orçamento fecha em testada (metros lineares), não em área: é assim que
    # a prateleira é consumida, e converter para área aqui esconderia o PROF_MAX.
    # ⚠️ §40: o orçamento passa a ser em ÁREA (m²) de fileira, não em metro de testada
    _tot = sum(D.capacidade_total() for D in DIST)
    _sobra = sum(_area_livre(t) for t in range(N_DIST))
    ORC['queimada'] = sum(D.queimada for D in DIST)
    ORC['total'] = _tot
    ORC['sobra'] = _sobra
    ORC['usada'] = _tot - _sobra - ORC['queimada']
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
# ⚠️ §42 (23/09/2026, decisão do fundador): A CURVA É EXATA, E O k NÃO PASSA DELA.
# Com a célula a terra rende ~18% a mais do que a curva publicada pede; o fundador
# escolheu entregar EXATAMENTE o número que a landing mostrou (razão 1,000 em todos
# os distritos) e deixar a sobra como anel de expansão do projeto. A bisseção
# continua achando o maior k que cabe, mas com teto em `K_PUBLICADA`: se a curva
# publicada cabe, ela é a cidade. `CURVA_EXATA=0` volta a encher a terra toda.
K_TETO = K_PUBLICADA if os.environ.get('CURVA_EXATA', '1') == '1' else float('inf')
K_AREA = min(K_AREA, K_TETO)
k_bom, saida_boa = None, None
# ⚠️ A COTA VIAJA JUNTO COM A CÓPIA. `saida_boa = list(saida)` congela a cidade
# de uma passada, mas `COTA` é um dicionário vivo que a passada SEGUINTE limpa e
# reescreve: gravar as duas coisas separadas casava o lote de uma cidade com a
# cota de outra. Medido antes do conserto: muro de arrimo de até 139 m entre
# vizinhos, que é relevo inexistente neste sítio.
cota_boa, orc_boa = None, None
k_lo, k_hi = None, None
# ⚠️ SEIS TENTATIVAS DEIXAVAM TERRA NA MESA. A rodada do snapshot parou com
# k_lo=0,2805 e k_hi=0,29148, ou seja 3,9% de área ainda em disputa, porque
# acabou a contagem e não porque convergiu. Terra é o recurso que o fundador
# mandou não desperdiçar (20/09), e cada passada custa cerca de um minuto.
# ⚠️ E `k_lo` COMEÇAVA VALENDO `K_AREA`, QUE MATAVA A BISSEÇÃO NA PRIMEIRA
# VOLTA. Se a passada 1 não coubesse, `k_hi` virava o MESMO número que `k_lo` e
# `(k_hi - k_lo)/k_lo` dava 0, abaixo do 0,004: o laço saía com `saida_boa` em
# None e a cidade inteira caía no caminho do PISO, que converge com folga de 2%
# em vez de 0,4%. Medido numa rodada de conferência em 22/09: ela terminou com
# k_lo = 0,90772 e k_hi = 0,92147, ou seja 1,5% da área de TODO MUNDO ficou na
# mesa porque acabou a tolerância, não porque convergiu. Agora `k_lo` começa em
# None ("ainda não provei piso nenhum") e o laço desce sozinho até achar um.
for tentativa in range(12):
    obtido = uma_passada()
    coube = _lotes_de_carteira(saida) >= N_DESTINOS
    med = sorted(w*d for _,_,_,_,w,d,_,_,_ in saida)[len(saida)//2] if saida else 0
    print(f'  passada {tentativa+1}: k={K_AREA:.5g}  {len(saida):,} plantadas, '
          f'{obtido/1e6:.2f} km² ({obtido/alvo*100:.0f}% do alvo), mediana {med:,.0f} m²'
          f'  {"cabe" if coube else "NAO CABE"}', file=sys.stderr)
    if coube:
        k_bom, saida_boa, k_lo, cota_boa, orc_boa = K_AREA, list(saida), K_AREA, dict(COTA), dict(ORC)
        if K_AREA >= K_TETO - 1e-12:
            break                                  # a curva publicada cabe: é ela
        if k_hi is None:
            # ⚠️ §40: O SALTO SÓ SOBE. Com o lote de retângulo a passada desperdiçava
            # área (obtido < alvo) e dividir pela razão subia k. Com a célula, o piso
            # de 5 m de frente e o lote de célula (que leva a travessa junto) fazem
            # obtido > alvo, e a mesma conta DESCIA k a cada passada que cabia,
            # guardando o menor. Agora: mira o desperdício quando há, e sobe no
            # mínimo 3% quando não há, até a primeira passada que não cabe.
            K_AREA = min(K_TETO, K_AREA * max(1.03, min(1.8, alvo / max(1.0, obtido))))
            continue
    else:
        k_hi = K_AREA
    if k_hi is None: break
    if k_lo is None:
        # ⚠️ NADA COUBE AINDA: desce e volta, em vez de sair pela tolerância.
        # Sem este ramo o laço morria aqui e entregava a cidade do caminho do
        # piso, que é o mesmo mecanismo com folga cinco vezes maior.
        K_AREA = k_hi * 0.6
        continue
    if (k_hi - k_lo) / k_lo < 0.004: break
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
        if _lotes_de_carteira(saida) >= N_DESTINOS:
            saida_boa, k_bom, cota_boa, orc_boa = list(saida), K_AREA, dict(COTA), dict(ORC)
            break
    if saida_boa is not None:
        lo, hi = k_bom, k_falha
        for _ in range(5):
            if (hi - lo) / lo < 0.02: break
            K_AREA = (lo + hi) / 2
            uma_passada()
            coube = _lotes_de_carteira(saida) >= N_DESTINOS
            med = sorted(w*d for _,_,_,_,w,d,_,_,_ in saida)[len(saida)//2] if saida else 0
            print(f'  sobe: k={K_AREA:.5g} -> {len(saida):,} plantadas, mediana {med:,.0f} m²'
                  f'  {"cabe" if coube else "NAO CABE"}', file=sys.stderr)
            if coube: saida_boa, k_bom, lo, cota_boa, orc_boa = list(saida), K_AREA, K_AREA, dict(COTA), dict(ORC)
            else: hi = K_AREA
if saida_boa is not None:
    # ⚠️ §40: A MELHOR PASSADA É REFEITA, NÃO SÓ COPIADA. Cada passada reescreve as
    # fileiras, os cortes de travessa das células e a geometria de cada lote (`GEOM`),
    # e a última da bisseção quase nunca é a boa. Copiar só `saida` e a cota deixava
    # a malha e os cantos de uma cidade e os lotes de outra. A passada é
    # determinística: com o mesmo k ela devolve a mesma cidade, e aqui se confere.
    K_AREA = k_bom
    uma_passada()
    if len(saida) != len(saida_boa) or any(a[3] != b[3] for a, b in zip(saida, saida_boa)):
        print('ERRO: a passada refeita com o k vencedor não reproduziu a cidade. Nada foi gravado.',
              file=sys.stderr)
        sys.exit(1)

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

# ⚠️ A GUARDA DURA CONTA CABEÇA DE CARTEIRA, não linhas do arquivo: a saída tem
# lote de projeto, institucional e das duas orlas misturados, e `len(saida)`
# passa no teste com carteira de fora.
_com_lote = _lotes_de_carteira(saida)
if _com_lote < N_DESTINOS:
    print(f'ERRO: {N_DESTINOS - _com_lote:,} carteiras sem lote de {N_DESTINOS:,}. '
          'Nada foi gravado.', file=sys.stderr)
    if sem_lugar[:5]:
        print(f'  exemplos: {sem_lugar[:5]}', file=sys.stderr)
    sys.exit(1)

print(f'plantadas {len(saida):,} linhas, {_com_lote:,} carteiras de {N_DESTINOS:,}',
      file=sys.stderr)
areas = sorted(w*d for _,_,_,_,w,d,_,_,_ in saida)
if areas:
    print(f'lote: menor {areas[0]:,.0f} m² | mediana {areas[len(areas)//2]:,.0f} | '
          f'p99 {areas[int(len(areas)*.99)]:,.0f} | maior {areas[-1]:,.0f}', file=sys.stderr)
    print(f'área somada dos lotes: {sum(areas)/1e6:.2f} km²', file=sys.stderr)

# ── grava ──────────────────────────────────────────────────────────────────
posto = {c[3]: i for i, c in enumerate(CARTEIRAS_TODAS)}
# ⚠️ O utxo_count DECIDE A FORMA DO LOTE (masterplan §9, regra 3) e ele também é
# do BLOCO, não de hoje: gastar um UTXO depois do snapshot não muda a tipologia.
# Com a fonte viva ele vinha do CSV que o cron move; com o snapshot vem do
# próprio registro congelado.
UTX = dict(UTX_SNAP)
if not UTX:
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
def _banda_por_emblema():
    """o raio que cada emblema de fato ocupou, medido no que foi gravado."""
    _por = {}
    for _x, _z, _s2, _a, _w, _d, _q, _b, _n in saida:
        if str(_a).startswith('__projeto'): continue
        _t = TIER_DE.get(_a) or ('grupo' if _a in posto_fila else 'institucional')
        _por.setdefault(_t, []).append(math.hypot(_x, _z))
    _out = {}
    for _t, _rs in _por.items():
        _rs.sort(); _m = len(_rs)
        _out[_t] = {'lotes': _m, 'r_min': round(_rs[0]), 'r_p5': round(_rs[int(_m*0.05)]),
                    'r_p50': round(_rs[_m//2]), 'r_p95': round(_rs[int(_m*0.95)]),
                    'r_max': round(_rs[-1])}
    return _out


# ⚠️ §41: O GIRO É DERIVADO DA FORMA, POR LOTE. Era um por quarteirão (o bloco
# rígido); agora cada lote diz o rumo da face da célula dele, ou o do meio da fatia.
# Fica só para quem ainda lê o v3; o registro de direito são os 4 cantos.
_GIRO_DE = {}
_GIRO_DE.update(_GIRO_ORLA)

# ⚠️ §40: O NÚMERO DO LOTE É A ORDEM NO CHÃO, NÃO A ORDEM DE PLANTIO. Dentro da célula
# os lotes vão de dentro para fora por fileira e, na fileira, em rumo crescente:
# L001 é o canto de dentro mais anti-horário. O endereço lê como uma rua.
_por_cel = {}
for _k, _r in enumerate(saida):
    _g = GEOM.get(_r[3])
    if _g and 'fila' in _g:
        _f = PASSO[_r[2]][_g['fila']]
        _por_cel.setdefault((_r[2], _r[6], _r[7]), []).append(
            ((_f['faixa'], _f['lado'], _g['wm']), _k))
for _lst in _por_cel.values():
    _lst.sort()
    for _n, (_ordem, _k) in enumerate(_lst, 1):
        _r = saida[_k]
        saida[_k] = (_r[0], _r[1], _r[2], _r[3], _r[4], _r[5], _r[6], _r[7], _n)
_sem_geom = [r[3] for r in saida if r[3] not in GEOM]
if _sem_geom:
    print(f'ERRO: {len(_sem_geom)} lotes sem forma registrada (ex.: {_sem_geom[:3]}). Nada foi gravado.',
          file=sys.stderr)
    sys.exit(1)
buf = bytearray()
for x, z, s, a, w, d, _q, _b, _n in saida:
    # ⚠️ LOTE DO PROJETO NÃO TEM CARTEIRA. Ele entra no registro com coorte,
    # forma e família neutras: procurar dado de dono para ele quebrava a
    # gravação inteira na primeira linha.
    # ⚠️ NEM TODO DONO ESTÁ NA FILA. Além do lote do projeto, as 21
    # institucionais têm endereço de carteira de verdade e NÃO estão na fila
    # residencial: elas saíram dela no próprio snapshot, que é por isso que a
    # fila tem 85.797 e não 85.818.
    # ⚠️ "SEM DONO" E "FORA DA FILA" SÃO COISAS DIFERENTES, e tratá-las como uma
    # só fez o .bin afirmar `forma=0` (massa única, casa no centro) nas 21
    # institucionais, entre elas uma carteira com 20.008 UTXOs, que é forma 4
    # (quarteirão de torres). Coorte e família seguem neutras nas duas, porque
    # posição na fila é o que elas de fato não têm; a FORMA não.
    _sem_dono = a.startswith('__projeto')
    _proj = _sem_dono or a not in posto
    coorte = 0 if _proj else min(7, posto[a]*8//N)
    fam = 0 if _proj else familia_de.get(a, 0)
    # ⚠️ OS QUATRO BITS LIVRES DA FLAG VIRARAM O QUARTO DE METRO. `w` e `d` são
    # uint8 em metros inteiros, e arredondar custa até 0,5 m por lado: num lote
    # de 5 m de testada isso é 10%, e para o boneco de 1,70 m é meio metro de
    # divisa no lugar errado. Os bits 4-5 levam o resto da frente e os 6-7 o
    # resto do fundo, em quartos de metro. Quem lê só a forma (bits 1-3) e o DSC
    # (bit 0) não vê diferença nenhuma.
    # ⚠️ UM ARREDONDAMENTO SÓ, E DEPOIS SEPARA. Fazer `floor` na parte inteira e
    # `round` na fração estoura quando a fração passa de 0,875: os quatro quartos
    # viram zero no `& 3` e o lote encolhe quase um metro em silêncio.
    # ⚠️ REGISTRO v3: TESTADA E FUNDO EM DECÍMETROS, uint16. Em um byte o teto
    # era 255 m, e o maior lote institucional tem 388 m de testada: o .bin saía
    # 133 m menor que o registro de direito, e o portão pegou. Dois bytes em
    # decímetro alcançam 6.553 m com 10 cm de resolução, que é mais fina que os
    # 25 cm da posição. Os quatro bits de quarto de metro na flag saem junto:
    # eram remendo para o mesmo problema.
    _w10 = max(1, min(65535, int(round(w * 10))))
    _d10 = max(1, min(65535, int(round(d * 10))))
    _u_bin = 1 if _sem_dono else (UTX.get(a) or UTX_SNAP_TODOS.get(a, 1))
    fl = (0 if _sem_dono else ((1 if a in dsc else 0) | (forma_de(_u_bin) << 1)))
    giro_c = int(round(GEOM[a]['giro'] * 100)) % 36000
    # ⚠️ A POSIÇÃO PASSOU A SER EM QUARTOS DE METRO (versão 2 do registro,
    # 20/09). Em metros inteiros dois lotes que se ENCOSTAM na divisa de fundo
    # apareciam cruzados em até 1 m, porque cada centro andava meio metro no
    # arredondamento: a conferência acusava 23 mil pares e não havia defeito de
    # colocação nenhum, era o registro que não sabia dizer onde o lote estava.
    # Para a maquete vista de cima 1 m é invisível; para o boneco de 1,70 m é um
    # degrau na calçada. int16 em quartos de metro alcança 8.191 m e a cidade
    # chega a 7.430, então cabe. O tamanho do registro não muda.
    buf += struct.pack('<hhBBHBHHH', int(round(x*4)), int(round(z*4)), s, coorte,
                       min(65535, fam), fl, _w10, _d10, giro_c)
open(ps('public/city/cidade-lotes.bin'), 'wb').write(buf)

# ⚠️ §41: O REGISTRO v4, 21 BYTES, OS 4 CANTOS ABSOLUTOS EM QUARTOS DE METRO. Nome
# novo porque o CDN serve o arquivo velho pelo nome velho. O v3 acima continua
# sendo gravado, derivado, até o último leitor migrar.
REG_V4 = '<8hBBHB'
buf4 = bytearray()
for x, z, s, a, w, d, _q, _b, _n in saida:
    _sem_dono = a.startswith('__projeto')
    _proj = _sem_dono or a not in posto
    coorte = 0 if _proj else min(7, posto[a]*8//N)
    fam = 0 if _proj else familia_de.get(a, 0)
    _u_bin = 1 if _sem_dono else (UTX.get(a) or UTX_SNAP_TODOS.get(a, 1))
    fl = (0 if _sem_dono else ((1 if a in dsc else 0) | (forma_de(_u_bin) << 1)))
    fl |= (GEOM[a]['geo'] & 3) << 4
    _cq = [int(round(v * 4)) for pt in GEOM[a]['cantos'] for v in pt]
    if any(abs(v) > 32767 for v in _cq):
        print(f'ERRO: canto fora do int16 no lote de {a}. Nada foi gravado.', file=sys.stderr)
        sys.exit(1)
    buf4 += struct.pack(REG_V4, *_cq, s, coorte, min(65535, fam), fl)
open(ps('public/city/cidade-lotes-v4.bin'), 'wb').write(buf4)

# ⚠️ A COTA DE CADA LOTE, ARQUIVO IRMÃO, MESMA ORDEM, 2 BYTES POR LOTE. int16 em
# CENTÍMETROS: o relevo do sítio vai de -182 a +230 m, ou seja 23.000 cm, e
# int16 vai a 32.767, então cabe com folga e sem perder o centímetro, que é a
# tolerância de piso que o DOGGAMEMODE exige para o boneco de 1,70 m. Quem lê
# desenha o lote plano nesta cota; a diferença para o vizinho é a altura do muro
# de arrimo, e a cidade é que paga esse muro (masterplan §15).
cot = bytearray()
for _x, _z, _s, _a, _w, _d, _q, _b, _n in saida:
    cot += struct.pack('<h', max(-32768, min(32767, int(round(COTA.get(_a, 0.0) * 100)))))
open(ps('public/city/cidade-cotas.bin'), 'wb').write(cot)

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
def _area_gravada(g):
    """⚠️ A ÁREA DO REGISTRO É A DOS CANTOS COMO GRAVADOS (milímetro), não a da conta
    em float: numa fatia de 51° a 1 km do centro, meio centímetro de arredondamento no
    raio já move a área em 4 m², e o portão confere ±1 m² contra os cantos do CSV."""
    C = [(round(x, 3), round(z, 3)) for x, z in g['cantos']]
    if g['geo'] != 1:
        return CEL.shoelace(C)
    rf = (math.hypot(*C[0]) + math.hypot(*C[1])) / 2
    rt = (math.hypot(*C[2]) + math.hypot(*C[3])) / 2
    dt = abs(((math.atan2(C[1][0], -C[1][1]) - math.atan2(C[0][0], -C[0][1])) + math.pi)
             % (2 * math.pi) - math.pi)
    return abs(rf * rf - rt * rt) / 2 * dt

def _frente_de(g):
    """a aresta da frente: corda na célula e no dedo, arco na fatia de anel"""
    (x0, z0), (x1, z1) = g['cantos'][0], g['cantos'][1]
    if g['geo'] == 1:
        r = math.hypot(x0, z0)
        dt = abs(((math.atan2(x1, -z1) - math.atan2(x0, -z0)) + math.pi) % (2 * math.pi) - math.pi)
        return r * dt
    return math.hypot(x1 - x0, z1 - z0)

with open(ps('data/dogcity_lotes.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    # ⚠️ O GIRO VIRA COLUNA EM 22/09, e o motivo é que ele não existia em NENHUM
    # arquivo revisável: o `.bin` guardava o giro e o CSV não, então nenhum
    # conferidor podia comparar o giro contra coisa alguma. Num distrito onde o
    # lote do dedo é radial e o da fileira é tangente, giro errado é lote de
    # lado, e passaria batido.
    w.writerow(['lot_id', 'address', 'ordem', 'setor', 'quarto', 'quarteirao', 'lote',
                'x_m', 'z_m', 'raio_m', 'frente_m', 'prof_m', 'area_m2', 'giro_graus',
                'dog', 'utxo_count', 'forma', 'coorte', 'familia', 'dsc', 'cota_m',
                'p0x_m', 'p0z_m', 'p1x_m', 'p1z_m', 'p2x_m', 'p2z_m', 'p3x_m', 'p3z_m', 'geo'])
    for x, z, s, a, fr, pf, q_, b_, n_ in saida:
        # ⚠️ DUAS COISAS DIFERENTES QUE ERAM UMA SÓ, E A CONFUSÃO MENTIA NO
        # REGISTRO. "Lote sem dono" (o land bank do projeto) e "carteira de
        # verdade fora da fila residencial" (as 21 institucionais) caíam no mesmo
        # `_proj` e saíam com dog=0, utxo_count=0 e forma=0. A primeira não tem
        # dono mesmo; a segunda tem 3,03 bilhões de DOG e 20.008 UTXOs.
        _sem_dono = a.startswith('__projeto')
        _fora_da_fila = a not in posto
        _proj = _sem_dono or _fora_da_fila          # coorte e família seguem neutras
        # DOG e UTXO vêm da fila quando ela conhece o endereço e do snapshot
        # inteiro quando não conhece. Zero só para quem não tem dono.
        _dog = 0.0 if _sem_dono else (elig.get(a) or DOG_SNAP.get(a, 0.0))
        u = 1 if _sem_dono else (UTX.get(a) or UTX_SNAP_TODOS.get(a, 1))
        w.writerow([f'S{s+1:02d}-Q{q_:02d}-B{b_:03d}-L{n_:03d}', a,
                    -1 if _proj else posto[a], s + 1, q_, b_, n_,
                    # ⚠️ O CSV É O REGISTRO DE DIREITO e o .bin é a cópia que a
                    # cena desenha. Gravar posição em metro inteiro aqui fazia o
                    # documento do dono ter menos precisão que o desenho: dois
                    # lotes que se encostam apareciam cruzados em meio metro.
                    round(x, 2), round(z, 2), round(math.hypot(x, z), 1),
                    round(_frente_de(GEOM[a]), 2), round(pf, 2), round(_area_gravada(GEOM[a])),
                    round(GEOM[a]['giro'], 2),
                    round(_dog), 0 if _sem_dono else u,
                    0 if _sem_dono else forma_de(u),
                    0 if _proj else min(7, posto[a]*8//N),
                    0 if _proj else familia_de.get(a, 0),
                    0 if _proj else (1 if a in dsc else 0),
                    round(COTA.get(a, 0.0), 2)]
                   + [round(v, 3) for pt in GEOM[a]['cantos'] for v in pt]
                   + [GEOM[a]['geo']])
print(f'gravado data/dogcity_lotes.csv com {len(saida):,} lotes', file=sys.stderr)

# ⚠️ O COLUMBÁRIO É ARTEFATO DE REGISTRO, não sobra de filtro. Ele entra no
# merkle root junto com os lotes: o endereço existiu no bloco, não alcançou o
# menor lote, e tem direito a um lote no anel de expansão quando voltar a ter
# saldo E comprar a licença.
if COLUMBARIO:
    # ⚠️ A LÁPIDE GANHA COORDENADA, E SEM ISSO O K01 SERIA PEÇA ÓRFÃ. Reservar
    # 9,6 ha e não pôr nada dentro é o mesmo defeito que módulo sem chamador: o
    # §17.1 manda "fileiras alinhadas, espaçamento constante", e até 22/09 o CSV
    # não tinha nem x nem z. Agora a sepultura nasce no campo, em coordenada de
    # mundo, e quem for desenhar o cemitério lê daqui em vez de inventar.
    # A grade é LOCAL ao retângulo: lx corre na tangente (a testada de 556 m) e
    # lz no radial (o fundo de 172,6 m), com alameda a cada 11 fileiras.
    _CEM_MARG, _CEM_W, _CEM_D, _CEM_AL, _CEM_BL = 8.0, 1.5, 3.0, 6.0, 11
    _cem_lx = 2*CEM_A - 2*_CEM_MARG
    _cem_lz = 2*CEM_B - 2*_CEM_MARG
    _cem_cols = max(1, int(_cem_lx // _CEM_W))
    _cem_rows = -(-len(COLUMBARIO) // _cem_cols)
    _cem_alt = _cem_rows*_CEM_D + max(0, -(-_cem_rows // _CEM_BL) - 1)*_CEM_AL
    # ⚠️ GUARDA: se um dia o columbário crescer, é melhor o script morrer aqui do
    # que gravar lápide fora do campo e ninguém conferir.
    assert _cem_alt <= _cem_lz + 1e-6, \
        (f'o columbário não cabe no K01: {len(COLUMBARIO):,} lápides pedem '
         f'{_cem_alt:.1f} m de fundo e o campo tem {_cem_lz:.1f}')
    _cem_c, _cem_s = math.cos(math.radians(CEM_RUMO)), math.sin(math.radians(CEM_RUMO))
    _cem_cx, _cem_cz = math.sin(math.radians(CEM_RUMO))*CEM_R, -math.cos(math.radians(CEM_RUMO))*CEM_R
    with open(ps('data/dogcity_cemiterio.csv'), 'w', newline='') as f:
        _w = csv.writer(f)
        # ⚠️ AS COLUNAS NOVAS VÃO NO FIM. `conferir_lotes.py` lê este arquivo com
        # DictReader e pelo nome da coluna, então acrescentar no fim não mexe em
        # ninguém; inserir no meio quebraria quem lê por posição.
        _w.writerow(['lapide', 'address', 'dog', 'utxo_count', 'posicao_residencial',
                     'airdrop', 'assinou', 'direito', 'x_m', 'z_m'])
        for _i, _r in enumerate(sorted(COLUMBARIO, key=lambda r: -r['dog']), 1):
            _fi, _co = divmod(_i - 1, _cem_cols)
            _plx = -_cem_lx/2 + (_co + 0.5)*_CEM_W
            _plz = -_cem_lz/2 + _fi*_CEM_D + (_fi // _CEM_BL)*_CEM_AL + _CEM_D/2
            _px = _cem_cx + _plx*_cem_c - _plz*_cem_s
            _pz = _cem_cz + _plx*_cem_s + _plz*_cem_c
            _w.writerow([f'L{_i:05d}', _r['address'], _r['dog'], _r.get('utxo_count', 0),
                         _r['posicao_residencial'], 1 if _r.get('airdrop') else 0,
                         _r.get('assinou', 0), 'licença paga + mint do deed = lote no anel de expansão',
                         round(_px, 2), round(_pz, 2)])
    print(f'gravado data/dogcity_cemiterio.csv com {len(COLUMBARIO):,} lápides em '
          f'{_cem_rows} fileiras de {_cem_cols} ({_cem_alt:.1f} m de fundo usado de '
          f'{_cem_lz:.1f}), dentro do K01', file=sys.stderr)

# ⚠️ A CONFERÊNCIA DO TETO DE 12% (masterplan §15). Ela mede a cidade GRAVADA,
# não a intenção do laço: o lote é reconstruído a partir do que foi para o
# arquivo e a declividade sai dos quatro cantos dele. Sem isto a regra seria
# promessa, e promessa não se audita antes do mint.
_decl = []
for x, z, s_, a, fr, pf, q_, b_, n_ in saida:
    gg = math.radians(_GIRO_DE.get((s_, q_, b_), 0.0))
    _decl.append(declive_lote(x, z, math.cos(gg), math.sin(gg), 0.0, 0.0, fr, pf))
_decl.sort()
_nn = len(_decl) or 1
_acima = lambda t: sum(1 for v in _decl if v > t)
print('declividade do lote (medida no que foi gravado): mediana %.1f%% | p90 %.1f%% | '
      'p99 %.1f%% | máx %.1f%%' % (_decl[_nn//2]*100, _decl[int(_nn*0.9)]*100,
      _decl[int(_nn*0.99)]*100, _decl[-1]*100), file=sys.stderr)
print('  acima de 8%%: %d | de 12%%: %d | de 20%%: %d  (teto em vigor: %.0f%%)'
      % (_acima(0.08), _acima(0.12), _acima(0.20), DECL_LOTE_MAX*100), file=sys.stderr)
print('  testada: %.1f km no total | %.1f km usada (%.0f%%) | %.1f km queimada em %d '
      'prateleiras (%.0f%%) | %.1f km sobrando (%.0f%%)'
      % (ORC.get('total',0)/1000, ORC.get('usada',0)/1000,
         100*ORC.get('usada',0)/max(1,ORC.get('total',1)),
         ORC.get('queimada',0)/1000, ORC.get('queimada_n',0),
         100*ORC.get('queimada',0)/max(1,ORC.get('total',1)),
         ORC.get('sobra',0)/1000, 100*ORC.get('sobra',0)/max(1,ORC.get('total',1))),
      file=sys.stderr)
print('  a queima, por motivo: %.0f km testada estreita demais para o lote da vez | '
      '%.0f km máscara | %.0f km fileira de trás ocupada'
      % (ORC.get('q_estreita',0)/1000, ORC.get('q_mascara',0)/1000, ORC.get('q_par',0)/1000),
      file=sys.stderr)
print('  vãos reaproveitados: %d lotes, %.1f km de testada que antes se perdia'
      % (ORC.get('vao_n',0), ORC.get('vao_usado',0)/1000), file=sys.stderr)
# ⚠️ A CAUDA DOS ESPREMIDOS TEM DE APARECER, senão ela volta calada. `recusas` é
# quantas vezes uma prateleira foi recusada por não honrar `EXIGE_AREA` (o que
# antes virava lote de 30% da promessa, sem ninguém contar) e `desviados` é
# quantas carteiras isso mandou para outro distrito. Se `recusas` for grande e
# `desviados` pequeno, o problema deixou de ser a prateleira e passou a ser
# falta de terra: aí a conversa é sobre PHI_LOTE, não sobre o alocador.
print('  cauda da promessa: %d prateleiras recusadas por entregar menos de %.0f%% da '
      'área | %d carteiras trocaram de distrito POR ÁREA | %d trocaram por falta de '
      'prateleira (motivo antigo)'
      % (ORC.get('espremido',0), EXIGE_AREA*100, ORC.get('desviado_area',0),
         ORC.get('desviado',0) - ORC.get('desviado_area',0)), file=sys.stderr)
# ⚠️ A REPARTIÇÃO SAI POR MOTIVO, sempre. Laço que rejeita candidato e só
# imprime o total é laço cego: foi contando por motivo que a orla da baía
# descobriu que os quatro dedos eram 100% rampa de praia. Total não é
# diagnóstico.
print('  sondagem: %d pegadas aprovadas, %d por máscara, %d abaixo da lâmina, %d pelo teto de declive'
      % (REJ['ok'], REJ['mascara'], REJ['agua'], REJ['declive']), file=sys.stderr)
_ct = sorted(COTA.get(a, 0.0) for *_r, a in ((0, 0, 0, r[3]) for r in saida))
print('  cota de testada: mínima %.1f m | mediana %.1f | máxima %.1f'
      % (_ct[0], _ct[_nn//2], _ct[-1]), file=sys.stderr)
json.dump({
    # ⚠️ O ESQUEMA JÁ MENTIU ANTES (o giro entrou e ele não contou, e a prancha
    # do plano diretor ficou um mês lendo 11 bytes). Agora ele leva VERSÃO: quem
    # ler a v2 com código de v1 desenha a cidade a um quarto do tamanho, e isso
    # tem de falhar alto, não em silêncio.
    # ⚠️ §41 (23/09/2026): v4, os 4 cantos. O v3 continua gravado em
    # `cidade-lotes.bin` (derivado) só para quem ainda não migrou; quem lê v4 lê
    # `registroArquivo` e confere `registroBytes`.
    'registroVersao': 4,
    'registroArquivo': 'cidade-lotes-v4.bin',
    'cemiterio': {'lapides': len(COLUMBARIO), 'corteDog': round(DOG_MIN_LOTE, 2),
                   'pisoLote_m2': PISO_LOTE,
                   'regra': 'abaixo do saldo que paga o menor lote, o endereço recebe nicho. '
                            'O nicho é direito de MINTAR, não lote: volta a ter saldo, compra '
                            'licença e minta o deed, e o lote nasce no anel de expansão'},
    # ⚠️ A BANDA POR EMBLEMA É SAÍDA, NÃO CONSTANTE (§19). O caderno escrevia
    # r 960 / 3.300 / 5.300 / 6.900 à mão e três dos quatro números estavam
    # errados por 490 a 901 m. Aqui ela é MEDIDA na cidade que acabou de ser
    # gravada, então nunca mais diverge do que existe.
    'bandaPorEmblema': _banda_por_emblema(),
    'esquema': '<8hBBHB: p0x p0z p1x p1z p2x p2z p3x p3z (int16, quartos de metro, '
               'absolutos; p0p1 = frente, p2p3 = fundo), uint8 setor (0-based), uint8 coorte, '
               'uint16 familia, uint8 flags (bit0 DSC, bits1-3 forma, bits4-5 geo: 0 célula da '
               'teia, 1 fatia de anel centrada na origem, 2 reta). Ver masterplan §41.',
    'registroBytes': 21,
    'esquemaV3': 'cidade-lotes.bin, 15 bytes: int16 x, int16 z (quartos de metro), uint8 setor, '
                 'uint8 coorte, uint16 familia, uint8 flags, uint16 frente_dm, uint16 prof_dm, '
                 'uint16 giro_cc (DERIVADO do v4, para leitor antigo)',
    'chave': 'posicao_residencial do snapshot 966.670 (DOG-tempo, masterplan §12)',
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
    'carteiras': len(CARTEIRAS_TODAS), 'plantadas': _lotes_de_carteira(saida),
    'lotes': {'carteira': _lotes_de_carteira(saida),
              'projeto': sum(1 for r in saida if str(r[3]).startswith('__projeto')),
              'institucional': len(FIN_LOTES),
              'total': len(saida)},
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
    'quartos': len({(c.setor, c.q) for c in CELS}),
    'quarteiroes': len({(r[2], r[6], r[7]) for r in saida if 'fila' in GEOM[r[3]]}),
}, open(ps('public/city/cidade.json'), 'w'), indent=1)
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
def _fileiras_de(k, lado=None):
    out = []
    for i, (_zl, borda, sentido) in enumerate(_z_das_filas(k, lado)):
        abre = 'contorno' if i == 0 or i == 2*k - 1 else f'travessa{(i+1)//2}'
        out.append({'fila': i, 'borda': borda, 'sentido': sentido, 'abre': abre})
    return out
_FILEIRAS = _fileiras_de(3)      # a tabela NOMINAL do quarteirão de 168 m, publicada por
                                  # compatibilidade; §36 não muda ela, só a reconstrução por
                                  # quarteirão específico abaixo, que passa o vão medido

def _fila_do_lote(ox, oz, prof, k=3, bloco_lado=None):
    """Reconstrói a fileira a partir do centro local e da profundidade.
    ⚠️ Reconstrução, não registro: coloca() não devolve a fileira e mudar a
    tupla de `saida` mexeria em nove desempacotamentos. Como oz = borda +
    sentido·prof/2 é exato em float (o mesmo cálculo de coloca()), a fileira
    cujo oz previsto bate com o gravado é única, exceto o caso prof = 50 nas
    duas fileiras do meio, que dão oz = 0 as duas; aí o empate fica com a
    primeira e não altera a contagem (as duas abrem para a mesma travessa).

    ⚠️ §36: `prof` AQUI É A PROFUNDIDADE DO LOTE (perto de 25 m); o vão do
    QUARTEIRÃO que gerou as fileiras é outro número e chega em `bloco_lado`,
    porque `_bloco()` não planta mais pelo nominal de `k` e sim pelo vão
    medido daquele quarteirão contra a teia. Confundir os dois nomes foi como
    este comentário quase saiu errado na primeira versão.
    """
    melhor, erro = 0, 1e18
    for f in _fileiras_de(k, bloco_lado):
        e = abs(oz - (f['borda'] + f['sentido'] * prof / 2))
        if e < erro: erro, melhor = e, f['fila']
    return melhor, erro

# ⚠️ §41 (23/09/2026): O QUARTEIRÃO DA MALHA É A CÉLULA. Cada registro traz a forma
# útil (`poly`, 4 cantos na convenção do lote) e o eixo de cada travessa de 9 m pronto
# para desenhar, de eixo de radial a eixo de radial, partido onde um lote de célula
# passa por cima. Quem desenha não reconstrói nada. Os campos x, z, giro, lado, prof
# e fileiras são DERIVADOS, só para quem ainda lê o quarteirão como retângulo.
# Célula sem lote não entra: a rua em volta dela existe, o quarteirão não.
malha_q, malha_b = [], []
_lotes_cel = collections.Counter()
_tipos_cel = collections.defaultdict(collections.Counter)
_por_fila = collections.Counter()
for _r in saida:
    _g = GEOM[_r[3]]
    if 'fila' not in _g: continue
    _ch = (_r[2], _r[6], _r[7])
    _lotes_cel[_ch] += 1
    _tipos_cel[_ch][_g['tipo']] += 1
    _por_fila[(_r[2], _g['fila'])] += 1
for s in range(N_DIST):
    por_q = {}
    for c in sorted((c for c in CELS if c.setor == s), key=lambda c: (c.q, c.b)):
        ch = (s, c.q, c.b)
        n = _lotes_cel.get(ch, 0)
        if not n: continue
        bid = f'S{s+1:02d}-Q{c.q:02d}-B{c.b:03d}'
        P = c.poly()
        cx, cz = CEL.centroide(P)
        dm = (c.d_in + c.d_out) / 2
        por_fila = [_por_fila.get((s, f['i']), 0) for f in c.fileiras]
        malha_b.append({
            'id': bid, 'setor': s+1, 'quarto': c.q, 'quarteirao': c.b,
            'anel': c.i, 'j0': c.j0, 'j1': c.j1,
            'face': round(math.degrees(c.fi) % 360.0, 4),
            'dIn': round(c.d_in, 2), 'dOut': round(c.d_out, 2),
            'k': c.k, 'fila': round(c.h, 2),
            'poly': [[round(x, 2), round(z, 2)] for x, z in P],
            'travessas': c.travessas(),
            'lotes': n, 'tipos': dict(_tipos_cel[ch]),
            'lotesPorFileira': por_fila,
            'fileirasComLote': sum(1 for v in por_fila if v),
            'superquadra': _tipos_cel[ch].get('celula', 0) > 0,
            'x': round(cx, 1), 'z': round(cz, 1), 'r': round(math.hypot(cx, cz)),
            'phi': round(phi(cx, cz)), 'giro': round(math.degrees(c.fi) % 360.0, 3),
            'lado': round(dm * (c.wR - c.wL), 1), 'prof': round(c.d_out - c.d_in, 1),
            'fileiras': 2 * c.k,
        })
        por_q.setdefault(c.q, []).append((bid, phi(cx, cz)))
    for q, blocos in sorted(por_q.items()):
        malha_q.append({
            'id': f'S{s+1:02d}-Q{q:02d}', 'setor': s+1, 'quarto': q,
            'nome': f'anel {q} da teia',
            'phi': round(sum(ph for _b, ph in blocos) / len(blocos)),
            'quarteiroes': [b for b, _ph in blocos],
        })
print(f'malha: {len(malha_b):,} células com lote, '
      f'{sum(len(b["travessas"]) for b in malha_b):,} trechos de travessa', file=sys.stderr)
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
# ⚠️ O RADIAL AGORA MORRE NO LAGO, não num anel de canal. `phiFim` referenciava
# `CANAL_ANEIS[-1]` e a lista ficou vazia quando os anéis saíram — o gerador
# estourou aqui, e é o tipo de acoplamento que só aparece quando o outro lado
# some. O fim de cada radial é medido: o primeiro raio em que o chão desce abaixo
# da cota do lago. É lá que a vala encontra água e deixa de ser vala.
def _fim_no_lago(rumo):
    """onde o canal encontra A BAÍA, não a primeira poça.

    ⚠️ A VERSÃO ANTERIOR TESTAVA `crua() < LAGO_COTA`, ou seja QUALQUER cota
    abaixo da lâmina. Isso encontra depressão de 200 m² tanto quanto a baía de
    20,5 km², e o canal terminava numa poça no meio do tecido — ou, quando a poça
    não existia, seguia até a casca. Aqui o teste é a máscara da BAÍA, que é o
    maior corpo, o mesmo que a orla usa.

    ⚠️ E ELE RECUA 30 m. Sem o recuo o canal entra na baía e as paredes dele são
    desenhadas POR CIMA da água aberta — foi o que o fundador viu ("sobre a baía
    tem marca do canal"). Medido antes do conserto: o CR02 entrava 265 m.
    """
    a = math.radians(rumo); sx, sz = math.sin(a), -math.cos(a)
    t = R_INICIO
    while t < R_CASCA:
        if em_baia(sx*t, sz*t): return round(max(R_INICIO + 200, t - 30), 1)
        t += 20
    # sem baía neste rumo o canal não tem para onde ir: para na última água
    while t > R_INICIO:
        if crua(sx*t, sz*t) < LAGO_COTA: return round(t - 30, 1)
        t -= 20
    return round(R_CASCA - 200, 1)

canais_pub = {
    'radiais': [{'id': f'CR{i+1:02d}', 'rumo': ru, 'secao': CANAL_RAD_SEC,
                 'lamina': 60.0, 'cota': LAGO_COTA,
                 'rInicio': R_INICIO, 'rFim': _fim_no_lago(ru),
                 'sobreBulevar': ru in AVENIDAS_RADIAIS}
                for i, ru in enumerate(CANAL_RADIAIS)],
    # ⚠️ `vaos` = os trechos em que o anel está INTERROMPIDO, em rumo. Sem eles a
    # cena desenha o anel fechado e a vala volta a passar por cima da peça: o
    # gerador abre o vão e o cliente ignora.
    'aneis': [{'id': f'CA{i+1:02d}', 'phi': an, 'secao': CANAL_ANEL_SEC, 'lamina': 28.0,
               'vaos': CANAL_VAOS[i],
               'contorno': [[round(math.sin(math.radians(g))*raio_em_phi(math.radians(g), an), 1),
                             round(-math.cos(math.radians(g))*raio_em_phi(math.radians(g), an), 1)]
                            for g in range(0, 360, 3)]}
              for i, an in enumerate(CANAL_ANEIS)],
    # ⚠️ O TALUDE VAI JUNTO. `terrain.ts` usava 26 m fixo enquanto a máscara aqui
    # reservava 0: as duas pontas discordavam e o lote da margem nascia na rampa.
    # Publicar é o que faz cavar e reservar serem o mesmo número.
    'talude': CANAL_TALUDE,
    'nota': 'radial e anel a 60 m de lâmina, com talude de 12 m: cabe entre as células da teia',
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
# ⚠️ 4.450 -> 6.900: O BULEVAR TEM DE ATRAVESSAR O CINTURÃO. Ele parava na
# Avenida do Cinturão, e com isso os dois anéis novos (Doca e Escoamento) seriam
# aros sem raio: anel viário sem bulevar que o cruze não liga em nada, é o mesmo
# defeito da roda de bicicleta sem aro, agora ao contrário. Estendendo, cada
# bulevar cruza os dois anéis novos e nascem 18 rotatórias que ligam a produção
# à cidade.
# ⚠️ É O `R_ABOBADA` (R_SITIO - 100), escrito à mão. 6.900 -> 8.900 em 02/09.
R_BUL_FIM = 8900.0
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

with open(ps('public/city/cidade-malha.json'), 'w') as f:
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
    _KS_PUB = sorted({b[3] for b in BANDAS})
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
        # ⚠️ TODO k QUE A CIDADE USA, NÃO SÓ 2, 3 E 4. A tabela era escrita à
        # mão para três valores e as bandas cresceram: Borda usa k=5 e Horizonte
        # k=6, ou seja 778 quarteirões ficavam SEM travessa publicada. Quem lê
        # (a arborização, e agora o desenho da via) simplesmente não plantava
        # nem desenhava nada neles, calado. Agora sai da própria lista de bandas.
        'travessasPorK': {str(k): [{'z0': -_lado(k)/2 + i*(FAIXA+TRAVESSA) + FAIXA,
                                    'z1': -_lado(k)/2 + i*(FAIXA+TRAVESSA) + FAIXA + TRAVESSA}
                                   for i in range(k-1)] for k in _KS_PUB},
        'fileirasPorK': {str(k): _fileiras_de(k) for k in _KS_PUB},
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
    # ⚠️ OS ANÉIS VIÁRIOS VÃO NA MALHA, e não só em cidade.json. A cena carrega a
    # MALHA para montar canal e ponte; sem eles aqui, `canais.ts` não sabe onde
    # ficam as avenidas circulares e três delas ficam sem travessia sobre os oito
    # canais radiais — 24 interrupções, uma delas na Avenida do Cinturão, que é
    # onde os três túneis de eclusa desembocam.
    # ⚠️ OS LAGOS VÃO PUBLICADOS, com a cota única. A cena desenha a lâmina PLANA
    # nesta cota, não seguindo o chão: era esse o defeito que o fundador apontou
    # ("a água desce e sobe, isso é impossível").
    f.write('"lagos":' + json.dumps(
        {'cota': LAGO_COTA,
         'corpos': [{'x': L['x'], 'z': L['z'], 'area': L['area']} for L in LAGOS],
         # ⚠️ A BAÍA VAI IDENTIFICADA. A cena traça o próprio contorno (o chão
         # dela tem pódio e cova, o do gerador é cru) e precisa saber QUAL corpo
         # recebe cais e qual recebe praia. Ela redescobre o maior por
         # preenchimento, e este bloco é o que permite conferir se as duas pontas
         # concordam — foi assim que se achou que o segundo corpo tem 0,53 km²
         # contra 20,48 do primeiro, ou seja não há empate possível.
         'baia': ({'x': _BAIA['x'], 'z': _BAIA['z'], 'area': _BAIA['area'],
                   'reserva': ORLA_RESERVA} if LAGOS else None),
         'nota': 'lamina unica: tudo abaixo de cota dentro da casca e agua; '
                 'o maior corpo e a baia e leva orla construida'},
        ensure_ascii=False, separators=(',', ':')) + ',\n')
    f.write('"aneisViarios":' + json.dumps(
        [{'id': a, 'nome': n, 'r': r, 'larg': w} for a, n, r, w in ANEIS],
        ensure_ascii=False, separators=(',', ':')) + ',\n')
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
        # ⚠️ AS ECLUSAS FICAM NA CASCA, E A CASCA É `R_CASCA` EM RAIO. Estavam em
        # `raio_em_phi(rumo, PHI_BORDA)`, e PHI_BORDA é 6.900 em φ enquanto a
        # casca fecha em 7.050 de RAIO: φ não é raio, e as duas nunca coincidiam.
        # A eclusa ficava dentro ou fora do vidro conforme o rumo.
        # ⚠️ O PORTAL EXTERNO FICA NO DESTINO, não na casca: é lá que o veículo
        # embarca. O interno sai na Avenida do Cinturão (r 4.450), que é o anel
        # viário que já fecha o tecido — o passageiro desce direto na malha.
        # ⚠️ O PORTAL DO PARQUE É NA SOLEIRA, NÃO LÁ DENTRO. O parque mora numa bacia a
        # −156 m que começa a despencar em r 7.150: em 7.400 o chão já está em
        # −113 e o túnel saía suspenso no ar sobre a cova. 7.150 é a última cota
        # firme (+3); de lá a estrada cênica desce para o parque, que é como já
        # estava desenhado na landing.
        # 7.150 -> 9.150: continua sendo a soleira, 100 m além de onde a cidade
        # para nesse rumo (PARQUE_DIST - PARQUE_FRENTE), que é a última cota firme
        # antes de a bacia do parque despencar.
        _eclusa('Parque', PARQUE_RUMO, PARQUE_DIST - PARQUE_FRENTE + 100.0, 4450.0),
        _eclusa('Extracao', 214.0, 9600.0, 4450.0),
        # ⚠️ A ECLUSA TEM DE FICAR NO RUMO DO SPACEPORT, e estava no 0° enquanto
        # ele mora no 182,6°: lados OPOSTOS da cidade. Quem saísse por ela andava
        # 15 km em volta da casca para chegar no pátio de lançamento. 183° é o
        # rumo do Farol do Portão e vizinho do Portão da Abóbada (177°), ou seja
        # o portão de veículo já está lá — a eclusa só volta para junto dele.
        # ⚠️ O PORTAL EXTERNO SEGUE O PÁTIO. Ele foi para r 9.200 (respiro de 1,8 km da
        # casca, ver SPACEPORT_SHIFT em orbit-layer.ts) e o portal vai junto, para
        # 9.100: quem desce do foguete embarca ali mesmo. Túnel de 4.650 m.
        _eclusa('Spaceport', 183.0, 11100.0, 4450.0),
    ], ensure_ascii=False, separators=(',', ':')) + ',\n')
    f.write('"contorno":' + json.dumps(contorno_pub, separators=(',', ':')) + ',\n')
    f.write('"quartos":' + _linhas(malha_q) + ',\n')
    f.write('"quarteiroes":' + _linhas(malha_b) + '\n}\n')
print(f'gravado public/city/cidade-malha.json: {len(malha_q)} quartos, {len(malha_b)} quarteirões, '
      f'{len(bulevares)} bulevares', file=sys.stderr)
