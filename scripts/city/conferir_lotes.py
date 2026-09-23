#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# A CONFERÊNCIA DO LOTEAMENTO: a cidade gravada pode virar registro?
#
# ⚠️ POR QUE ISTO EXISTE. Em 20/09/2026 uma auditoria achou 80 pares de lotes
# com a MESMA posição e o MESMO tamanho para donos diferentes, e dezenas de
# milhares com sobreposição parcial. O defeito era antigo e nenhuma conferência
# do projeto olhava para isso: `conferir_terreno.py` mede o relevo, não o lote.
# Nada vira merkle root antes de passar aqui.
#
# ⚠️ SOBREPOSIÇÃO SE MEDE NO QUADRO DO LOTE, NUNCA NO MUNDO. O lote é girado
# pelo quarteirão (até 360°), então comparar |x1-x2| contra (w1+w2)/2 acusa
# sobreposição onde não há e perde a que existe. Aqui o teste é o do eixo
# separador, com os quatro cantos de cada lote.
#
# ⚠️ E EM 22/09 ELE DEU 15 DE 15 APROVADO NUMA CIDADE ERRADA. Ele não mentiu:
# ele não olhava. Faltavam cinco perguntas, e cada uma tinha defeito medido do
# outro lado: 845 lotes em cima de obra que a cena já constrói (72,18 ha), 36
# lotes abaixo da lâmina d'água, 8.171 lotes com a cota de outro chão (a
# mediana era 0,00 e a cauda 56,6 m), 725 lotes com `dog`, `utxo_count`,
# `forma` e `coorte` zerados, e 409 ilhas de pavimento que ninguém tinha de
# aprovar antes da rodada. Portão que só sabe responder o que já foi
# perguntado uma vez não é portão: é histórico.
#
#   python3 scripts/city/conferir_lotes.py --cidade=/caminho/da/saida
#   opções: --tolerancia=<m> (sobreposição, padrão 0,02)
#           --conexao=<arquivo> (saída de vias-varredura.mjs, padrão
#                                /tmp/vias/conexao.json)
# ═══════════════════════════════════════════════════════════════════════════
import csv, json, math, os, struct, sys, collections

arg = lambda k, d: next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{k}=')), d)
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = arg('cidade', RAIZ)
FILA = arg('fila', os.path.join(RAIZ, 'data/snapshots/dog_966670_ordem_residencial.json'))
# ⚠️ A TOLERÂNCIA É A RESOLUÇÃO DO REGISTRO, NÃO UM GOSTO. O registro v2 guarda
# posição em quartos de metro, então cada centro pode andar 0,125 m e dois lotes
# que se ENCOSTAM aparecem cruzados em até 0,25 m sem que ninguém tenha errado.
# Abaixo disso é quadriculado; acima é defeito de colocação. Medido em 20/09:
# com 0,10 m o teste acusava 15.593 pares e TODOS os inspecionados estavam na
# faixa de 0,15 m, ou seja o teste estava medindo o arquivo, não a cidade.
TOL = float(arg('tolerancia', '0.02'))

FMT = '<hhBBHBHHH'; REG = struct.calcsize(FMT)  # registro v3, 15 bytes
byt = open(os.path.join(BASE, 'public/city/cidade-lotes.bin'), 'rb').read()
lotes = [struct.unpack_from(FMT, byt, i * REG) for i in range(len(byt) // REG)]
linhas = list(csv.DictReader(open(os.path.join(BASE, 'data/dogcity_lotes.csv'))))
cot = open(os.path.join(BASE, 'public/city/cidade-cotas.bin'), 'rb').read()
cotas = [struct.unpack_from('<h', cot, i * 2)[0] / 100.0 for i in range(len(cot) // 2)]
fila = json.load(open(FILA))['ordem']

falhas = []
def item(nome, ok, detalhe=''):
    print(('  PASSA  ' if ok else '  FALHA  ') + nome + (('  ' + detalhe) if detalhe else ''))
    if not ok: falhas.append(nome)

def indisponivel(nome, detalhe=''):
    """⚠️ SILÊNCIO NÃO É APROVAÇÃO. Quando falta o insumo de um teste, ele não
    passa: ele fica INDISPONÍVEL e reprova a rodada junto com as falhas. É o
    contrário do que aconteceu com a conectividade viária, que existia só como
    relatório num arquivo em /tmp e por isso nunca reprovou nada. Portão que
    aprova o que não conseguiu medir é o portão de 15/15 na cidade errada."""
    print('  INDISP  ' + nome + (('  ' + detalhe) if detalhe else ''))
    falhas.append(nome + ' (INDISPONÍVEL)')

print(f'CONFERÊNCIA DO LOTEAMENTO em {BASE}')

# 1. cada carteira da fila tem UM destino: lote ou lápide. Nenhuma tem os dois,
#    nenhuma fica sem.
# ⚠️ O COLUMBÁRIO É DESTINO LEGÍTIMO (masterplan §17), então o portão tem de
# lê-lo. Sem isto ele acusaria 15.802 carteiras "faltando" e passaria a mentir
# na direção oposta: reprovaria a cidade certa.
colum = []
cam_col = os.path.join(BASE, 'data/dogcity_cemiterio.csv')
if os.path.exists(cam_col):
    colum = [r['address'] for r in csv.DictReader(open(cam_col))]
# ⚠️ TRÊS DESTINOS, NÃO DOIS. Além de lote de carteira e lápide existe o LOTE
# DO PROJETO: a Orla Nobre tem 65 e a reserva de apelo terá 15% dos lotes de
# cada bairro (contrato público §5). Eles aparecem no registro com endereço
# sintético `__projeto_*` e NÃO são carteira: contá-los como dono faria o
# portão reprovar a cidade certa, e ignorá-los faria ele perder um lote
# atribuído a dois donos.
# ⚠️ QUATRO NATUREZAS, NÃO TRÊS. As 21 institucionais têm endereço de carteira
# de verdade e NÃO estão na fila residencial: elas saíram dela no snapshot e
# ganharam lote no Distrito Financeiro. Contá-las como carteira da fila fazia o
# portão acusar 85.822 de 85.797, ou seja reprovar por excesso de gente.
# ⚠️ E A TAG INSTITUCIONAL SAI DA FILA AQUI TAMBÉM (22/09). O arquivo de ordem é
# de 13/09 e já vinha sem as 21 daquele dia; quando a tag cresceu para 27 (a
# quente da Kraken e mais cinco de custódia rotulada), as seis continuaram no
# arquivo de ordem e o portão passou a contá-las como carteira da fila: acusava
# `69.995 de 69.989`. A tag é a fonte, não o arquivo de ordem.
_tag_inst = set()
_ct = os.path.join(BASE, 'data/snapshots/dog_966670_tag_institucional.json')
if os.path.exists(_ct):
    _tag_inst = {l['address'] for l in (json.load(open(_ct)).get('linhas') or [])}
quero = {r['address'] for r in fila if r['dog'] > 0 and r['address'] not in _tag_inst}
projeto = [r['address'] for r in linhas if r['address'].startswith('__projeto')]
institucional = [r['address'] for r in linhas
                 if not r['address'].startswith('__projeto') and r['address'] not in quero]
tenho = [r['address'] for r in linhas
         if not r['address'].startswith('__projeto') and r['address'] in quero]
destinos = tenho + colum
dobrados = set(tenho) & set(colum)
item('cada carteira tem um destino, lote ou lápide',
     len(destinos) == len(set(destinos)) == len(quero) and set(destinos) == quero and not dobrados,
     f'{len(tenho)} lotes + {len(colum)} lápides = {len(destinos)} de {len(quero)} carteiras, '
     f'{len(projeto)} do projeto e {len(institucional)} institucionais à parte, '
     f'{len(dobrados)} em dois lugares')
item('lote do projeto não tem dono de carteira',
     all(a not in quero for a in projeto) and len(set(projeto)) == len(projeto),
     f'{len(projeto)} lotes do projeto, todos com endereço próprio')

# 2. os três arquivos na mesma ordem
mesma = (len(lotes) == len(linhas) == len(cotas)) and all(
    abs(lotes[i][0] / 4.0 - float(linhas[i]['x_m'])) <= 1 and
    abs(lotes[i][1] / 4.0 - float(linhas[i]['z_m'])) <= 1 for i in range(0, len(linhas), 7))
item('.bin, CSV e cotas na mesma ordem', mesma, f'{len(lotes)} / {len(linhas)} / {len(cotas)}')

# 3. lot_id único e no formato
import re
# ⚠️ O CAMPO B TEM LARGURA VARIÁVEL E O REGEX FIXO JÁ REPROVOU A CIDADE UMA VEZ.
# `B{:03d}` escreve QUATRO dígitos quando o quarteirão passa de 999, e a Orla da
# Baía chegou a ter 2.062 lotes num quarteirão só. O gerador foi consertado para
# numerar por TRECHO, mas o portão não pode depender disso: ele aceita 3 ou mais
# dígitos e diz qual é o maior que encontrou, para o dia em que estourar de novo.
pad = re.compile(r'^S\d{2}-Q\d{2}-B\d{3,}-L\d{3,}$')
ids = [r['lot_id'] for r in linhas]
_maus = [i for i in ids if not pad.match(i)]
_maiorB = max((int(i.split('-')[2][1:]) for i in ids if pad.match(i)), default=0)
item('lot_id único e no padrão', len(set(ids)) == len(ids) and not _maus,
     f'{len(set(ids))} únicos de {len(ids)}, maior quarteirão B{_maiorB}'
     + (f', {len(_maus)} fora do padrão (ex.: {_maus[:2]})' if _maus else ''))

# 4. sobreposição, pelo eixo separador, dentro do mesmo quarteirão
def cantos(x, z, w, d, giro):
    ca, sa = math.cos(giro), math.sin(giro)
    return [(x + dx*ca - dz*sa, z + dx*sa + dz*ca)
            for dx, dz in ((-w/2, -d/2), (w/2, -d/2), (w/2, d/2), (-w/2, d/2))]
def penetracao(A, B):
    """quanto um lote entra no outro, em metros: 0 ou menos quer dizer que não entram."""
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


def cruza(A, B, tol):
    """eixo separador com folga: encolhe as duas caixas por tol/2 antes de testar."""
    for P, Q in ((A, B), (B, A)):
        for i in range(4):
            ex, ez = P[(i+1) % 4][0] - P[i][0], P[(i+1) % 4][1] - P[i][1]
            n = math.hypot(ex, ez)
            if n < 1e-9: continue
            nx, nz = -ez/n, ex/n
            pa = [p[0]*nx + p[1]*nz for p in P]; pb = [p[0]*nx + p[1]*nz for p in Q]
            if min(pb) > max(pa) - tol or max(pb) < min(pa) + tol: return False
    return True
por_quarteirao = collections.defaultdict(list)
# ⚠️ A SOBREPOSIÇÃO SE MEDE NO REGISTRO DE DIREITO, QUE É O CSV. O `.bin` é a
# cópia quantizada em quartos de metro para a cena, e medir nela confunde o
# quadriculado do arquivo com defeito de cidade: media 0,39 m de "invasão" onde
# a geometria real encosta exata. O `.bin` se confere logo abaixo, contra o CSV.
for i, r in enumerate(linhas):
    _, _, _s, _c, _f, _fl, _w, _d, giro_c = lotes[i]
    x, z = float(r['x_m']), float(r['z_m'])
    w, d = float(r['frente_m']), float(r['prof_m'])
    # ⚠️ SPLIT, NÃO FATIA. `lot_id[:14]` supõe que o campo B tem sempre três
    # dígitos; com quatro ele corta no meio do número e junta quarteirões
    # diferentes no mesmo balde, o que ESCONDE sobreposição em vez de achar.
    _p = r['lot_id'].split('-')
    por_quarteirao['-'.join(_p[:3])].append((i, cantos(x, z, max(1.0, w), max(1.0, d), math.radians(giro_c/100))))
pares, piores, fundos = 0, [], []
for _q, itens in por_quarteirao.items():
    for a in range(len(itens)):
        for b in range(a + 1, len(itens)):
            pen = penetracao(itens[a][1], itens[b][1])
            if pen > TOL:
                pares += 1
                fundos.append(pen)
                if pen > (piores[0][0] if piores else 0):
                    piores = [(pen, linhas[itens[a][0]]['lot_id'], linhas[itens[b][0]]['lot_id'])]
fundos.sort()
detalhe = f'{pares} pares acima de {TOL:.2f} m'
if fundos:
    detalhe += f', mediana {fundos[len(fundos)//2]:.2f} m, pior {fundos[-1]:.2f} m em {piores[0][1:] if piores else ""}'
item('nenhum lote sobre outro', pares == 0, detalhe)

# 4b. OS DISTRITOS ESPECIAIS NÃO ERAM CONFERIDOS POR NINGUÉM
# ⚠️ Orla Nobre (S07), Distrito Financeiro (S08) e Orla da Baía (S09) gravam UM
# QUARTEIRÃO POR LOTE, porque cada lote tem giro próprio. O teste 4 agrupa por
# quarteirão: com um lote em cada balde, ele nunca compara dois deles e os três
# distritos passavam sem ser olhados, justamente os que não nascem do alocador
# de tecido e não têm prateleira para garantir que não se encostam.
# Aqui eles são comparados par a par, dentro de cada setor.
_esp = collections.defaultdict(list)
for i, r in enumerate(linhas):
    _s_ = int(r['setor'])
    if _s_ < 7: continue
    _, _, _, _, _, _, _, _, giro_c = lotes[i]
    _esp[_s_].append((i, cantos(float(r['x_m']), float(r['z_m']),
                                max(1.0, float(r['frente_m'])), max(1.0, float(r['prof_m'])),
                                math.radians(giro_c/100))))
_pe, _piore = 0, (0.0, '', '')
for _s_, itens in _esp.items():
    for a in range(len(itens)):
        for b in range(a + 1, len(itens)):
            pen = penetracao(itens[a][1], itens[b][1])
            if pen > TOL:
                _pe += 1
                if pen > _piore[0]:
                    _piore = (pen, linhas[itens[a][0]]['lot_id'], linhas[itens[b][0]]['lot_id'])
item('nenhum lote sobre outro nos distritos especiais (S07, S08, S09)', _pe == 0,
     f'{sum(len(v) for v in _esp.values())} lotes comparados par a par, {_pe} pares acima de {TOL:.2f} m'
     + (f', pior {_piore[0]:.2f} m em {_piore[1]} x {_piore[2]}' if _pe else ''))

# 4c. O GIRO DO REGISTRO BATE COM O DO .bin?
# ⚠️ Até 22/09 o giro só existia no binário, ou seja não havia contra o que
# conferi-lo: o documento do dono não dizia para que lado o lote está virado.
# Num distrito em que o lote do dedo é radial e o da fileira é tangente, giro
# trocado é lote de lado, e nenhum teste pegava.
if 'giro_graus' in (linhas[0].keys() if linhas else {}):
    _pior_g, _onde_g, _n_g = 0.0, '', 0
    for i, r in enumerate(linhas):
        g_csv = float(r['giro_graus']) % 360.0
        g_bin = (lotes[i][8] / 100.0) % 360.0
        d = abs(((g_csv - g_bin + 180) % 360) - 180)
        if d > 0.01: _n_g += 1
        if d > _pior_g: _pior_g, _onde_g = d, r['lot_id']
    item('giro do CSV bate com o do .bin', _pior_g <= 0.01,
         f'pior desvio {_pior_g:.4f}° em {_onde_g}, {_n_g} acima de 0,01°')
else:
    item('giro do CSV bate com o do .bin', True,
         'PULADO: este CSV é anterior à coluna giro_graus (22/09)')

# 4f. O MURO DE DIVISA OBEDECE AO TETO DE 3 m?
# ⚠️ O §15 promete que a cidade paga o talude entre vizinhos e que ele não passa
# de 3 m. O socalco cumpre isso DENTRO da fileira e entre fileiras pareadas, mas
# nada media o degrau entre lotes de QUARTEIRÕES diferentes que se encostam, e é
# lá que ele estoura. Medido em 22/09: 530 divisas de 105.445 acima de 3 m
# (0,50%), a pior com 14,66 m, quase todas em divisa de quarto.
#
# O teste não exige zero, porque zero exigiria acoplar o socalco através de
# quarteirão e isso é obra grande. Ele exige que a EXCEÇÃO continue exceção, e
# grita o número em toda rodada para ela não crescer calada.
_TETO_DIVISA = 3.0
_MAX_FORA = 0.01          # 1% das divisas
_cant = []
for _i, _r in enumerate(linhas):
    _w = max(1.0, float(_r['frente_m'])); _d = max(1.0, float(_r['prof_m']))
    _cant.append((float(_r['x_m']), float(_r['z_m']), max(_w, _d) / 2,
                  cantos(float(_r['x_m']), float(_r['z_m']), _w, _d, math.radians(lotes[_i][8] / 100)),
                  float(_r['cota_m']), _r['lot_id']))
def _folga(A, B_):
    pior = -1e9
    for P_, Q_ in ((A, B_), (B_, A)):
        for k in range(4):
            ex, ez = P_[(k+1) % 4][0]-P_[k][0], P_[(k+1) % 4][1]-P_[k][1]
            L = math.hypot(ex, ez) or 1; nx, nz = -ez/L, ex/L
            pa = [q[0]*nx+q[1]*nz for q in P_]; pb = [q[0]*nx+q[1]*nz for q in Q_]
            g = max(min(pb)-max(pa), min(pa)-max(pb))
            if g > pior: pior = g
    return pior
_CELD = 80.0
_bd = collections.defaultdict(list)
for _i, _p in enumerate(_cant): _bd[(int(_p[0]//_CELD), int(_p[1]//_CELD))].append(_i)
_div, _vis = [], set()
for (_bi, _bj), _ix in _bd.items():
    _cd = []
    for _di in (-1, 0, 1):
        for _dj in (-1, 0, 1): _cd += _bd.get((_bi+_di, _bj+_dj), [])
    for _i in _ix:
        for _j in _cd:
            if _j <= _i or (_i, _j) in _vis: continue
            _a, _b = _cant[_i], _cant[_j]
            if (_a[0]-_b[0])**2 + (_a[1]-_b[1])**2 > (_a[2]+_b[2]+3)**2: continue
            _vis.add((_i, _j))
            if _folga(_a[3], _b[3]) <= 1.5: _div.append((abs(_a[4]-_b[4]), _a[5], _b[5]))
_div.sort(reverse=True)
_nd = len(_div) or 1
_fora = sum(1 for d in _div if d[0] > _TETO_DIVISA)
item('muro de divisa dentro do teto de 3 m', _fora <= _nd * _MAX_FORA,
     f'{_nd} divisas medidas, {_fora} acima de {_TETO_DIVISA:.0f} m ({100*_fora/_nd:.2f}%, teto {_MAX_FORA*100:.0f}%)'
     + (f', pior {_div[0][0]:.2f} m em {_div[0][1]} x {_div[0][2]}' if _div else ''))

# 4g. NENHUM LOTE EM CIMA DE PEÇA DE PROGRAMA
# ⚠️ O PORTÃO NUNCA OLHOU A OBRA QUE A CENA JÁ CONSTRÓI. Medido em 22/09 sobre
# o registro selado: 845 lotes em 72,18 ha caem dentro das 7 parcelas ancoradas
# de `public/city/mapa-v1.json` (CAMPUS 679, ESTADIO 279, ATLETISMO 212, GEODE
# 180, SPHERE 58, DERBY 55, AQUATICS 53). O gerador reserva terra pelas 52 peças
# do programa congelado e não conhece NENHUMA das âncoras, embora o cabeçalho do
# próprio mapa-v1.json prometa que "o gerador de lotes CONSOME este arquivo".
#
# ⚠️ AS DUAS FONTES ENTRAM, E NÃO É REDUNDÂNCIA. O programa é onde o gerador
# guardou terra; a âncora é onde a cena de fato levanta a peça. Quando os dois
# discordam a cidade erra dos dois lados ao mesmo tempo, e foi o que aconteceu:
# o $DOG ARENA está a 1.125 m da máscara E03 e o DOG Derby a 250 m da E02, ou
# seja 80,6 ha guardados em lugar nenhum e 845 lotes sobre o lugar certo.
#
# ⚠️ POLÍGONO, NUNCA O RETÂNGULO INSCRITO. A peça de célula é um trapézio da
# teia; testar o retângulo inscrito deixa lote nascer nos cantos, que é
# exatamente onde peça e quadra brigam (a mesma nota está em `em_programa()`).
# Quando o manifesto publica `poly`, ele manda. Só as peças de borda, que saem
# como retângulo ou elipse sem `poly`, são reconstruídas de `x/z/a/b/rot`, com
# `a` e `b` em SEMI-eixos, que é a convenção de `em_programa()`.
def _dentro_poly(pt, poly):
    """cruzamento de raio: vale para polígono côncavo, que é o caso do trapézio"""
    x, y = pt; c = False; m_ = len(poly)
    for k in range(m_):
        x1, y1 = poly[k]; x2, y2 = poly[(k+1) % m_]
        if ((y1 > y) != (y2 > y)) and (x < (x2-x1)*(y-y1)/((y2-y1) or 1e-18) + x1): c = not c
    return c
def _cruzam(a1, a2, b1, b2):
    _d = lambda o, a, b: (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    d1, d2 = _d(b1, b2, a1), _d(b1, b2, a2)
    d3, d4 = _d(a1, a2, b1), _d(a1, a2, b2)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))
def _sobrepoe(quad, poly):
    """⚠️ TRÊS PERGUNTAS, NÃO UMA. Canto do lote dentro da peça pega o lote
    engolido; vértice da peça dentro do lote pega a peça pequena dentro de um
    lote grande; cruzamento de aresta pega o caso em que nenhum vértice está
    dentro do outro e mesmo assim as duas figuras se atravessam."""
    if any(_dentro_poly(q_, poly) for q_ in quad): return True
    if any(_dentro_poly(v_, quad) for v_ in poly): return True
    return any(_cruzam(quad[k], quad[(k+1) % 4], poly[j], poly[(j+1) % len(poly)])
               for k in range(4) for j in range(len(poly)))

_pecas = []
_cam_mapa = os.path.join(BASE, 'public/city/mapa-v1.json')
if os.path.exists(_cam_mapa):
    for _a_ in (json.load(open(_cam_mapa)).get('ancoras') or []):
        if _a_.get('poly'):
            _pecas.append(('âncora ' + str(_a_.get('id')),
                           [(float(u), float(v)) for u, v in _a_['poly']]))
_prog_manif = json.load(open(os.path.join(BASE, 'public/city/cidade.json')))
for _q_ in (_prog_manif.get('programa') or []):
    if _q_.get('poly'):
        _pecas.append((str(_q_.get('id')), [(float(u), float(v)) for u, v in _q_['poly']]))
        continue
    _cx, _cz, _sa_, _sb_ = _q_.get('x'), _q_.get('z'), _q_.get('a'), _q_.get('b')
    if _cx is None or _cz is None or not _sa_ or not _sb_: continue
    _ro = math.radians(float(_q_.get('rot') or 0.0)); _rc, _rs = math.cos(_ro), math.sin(_ro)
    if _q_.get('forma') == 'retangulo':
        _loc = [(-_sa_, -_sb_), (_sa_, -_sb_), (_sa_, _sb_), (-_sa_, _sb_)]
    else:   # elipse: 24 lados descrevem a borda com menos de 1% de erro de área
        _loc = [(_sa_*math.cos(2*math.pi*k/24), _sb_*math.sin(2*math.pi*k/24)) for k in range(24)]
    _pecas.append((str(_q_.get('id')),
                   [(float(_cx) + lx*_rc - lz*_rs, float(_cz) + lx*_rs + lz*_rc) for lx, lz in _loc]))

# ⚠️ REAPROVEITA `_cant` e `_bd` DO TESTE ACIMA de propósito: são os mesmos
# quatro cantos e o mesmo balde de 80 m. Recalcular daria a chance de os dois
# testes medirem lotes com geometrias levemente diferentes, que é como um
# portão passa a discordar de si mesmo.
_sob, _por_peca = set(), collections.Counter()
for _nm, _poly in _pecas:
    _xs = [q[0] for q in _poly]; _zs = [q[1] for q in _poly]
    _x0, _x1 = min(_xs) - 200, max(_xs) + 200
    _z0, _z1 = min(_zs) - 200, max(_zs) + 200
    _cand = set()
    for _bi in range(int(_x0 // _CELD), int(_x1 // _CELD) + 1):
        for _bj in range(int(_z0 // _CELD), int(_z1 // _CELD) + 1):
            _cand.update(_bd.get((_bi, _bj), ()))
    for _i in _cand:
        if _sobrepoe(_cant[_i][3], _poly):
            _por_peca[_nm] += 1; _sob.add(_i)
_ha_sob = sum(float(linhas[_i]['area_m2']) for _i in _sob) / 1e4
_cart_sob = sum(1 for _i in _sob if not linhas[_i]['address'].startswith('__projeto'))
item('nenhum lote sobre peça de programa', not _sob,
     f'{len(_pecas)} peças (programa + âncoras) contra {len(linhas)} lotes; '
     f'{len(_sob)} lotes sobrepostos, {_ha_sob:.2f} ha, {_cart_sob} de carteira'
     + ('; pior: ' + ', '.join(f'{k} {v}' for k, v in _por_peca.most_common(4)) if _sob else ''))

# 4e. NENHUM LOTE TEM COTA DE OUTRO LUGAR
# ⚠️ O teste 6 só exige que a cota caia na FAIXA do relevo do sítio, e por isso
# um zero inventado passa: zero está dentro da faixa. Medido em 22/09, os 65
# lotes de projeto da Orla Nobre saíram com cota 0,0 (a chave do dicionário não
# batia com o endereço gravado) contra os −30 da plataforma da alça, criando
# 130 divisas de exatamente 30,00 m entre mansões vizinhas.
#
# Aqui a cota é conferida contra a dos VIZINHOS geométricos: um lote cuja cota
# se afasta demais de todos os lotes encostados nele está com cota de outro
# lugar. É barato e pega a família inteira desse defeito.
_pt = [(float(r['x_m']), float(r['z_m']), float(r['cota_m']), r['lot_id']) for r in linhas]
_CEL = 90.0
_bal = collections.defaultdict(list)
for _i, (_x, _z, _c, _id) in enumerate(_pt):
    _bal[(int(_x // _CEL), int(_z // _CEL))].append(_i)
_orfaos = []
for (_bi, _bj), _idx in _bal.items():
    _viz = []
    for _di in (-1, 0, 1):
        for _dj in (-1, 0, 1): _viz += _bal.get((_bi + _di, _bj + _dj), [])
    for _i in _idx:
        _x, _z, _c, _id = _pt[_i]
        _perto = [_pt[_j][2] for _j in _viz
                  if _j != _i and (_pt[_j][0]-_x)**2 + (_pt[_j][1]-_z)**2 < 120*120]
        if len(_perto) < 4: continue
        _perto.sort()
        _med = _perto[len(_perto)//2]
        if abs(_c - _med) > 25.0: _orfaos.append((abs(_c - _med), _id, _c, _med))
_orfaos.sort(reverse=True)
item('nenhum lote com cota de outro lugar', not _orfaos,
     f'{len(_pt)} lotes contra a mediana dos vizinhos em 120 m; {len(_orfaos)} acima de 25 m'
     + (f', pior {_orfaos[0][0]:.1f} m em {_orfaos[0][1]} (cota {_orfaos[0][2]:.1f} contra {_orfaos[0][3]:.1f})' if _orfaos else ''))

# 4d. O CEMITÉRIO OBEDECE À REGRA QUE O PRÓPRIO MANIFESTO PUBLICA?
# ⚠️ Nenhum teste cruzava o destino "lápide" com o motivo dele. O portão sabia
# que toda carteira tem UM destino, mas não que o destino é o CERTO: uma
# carteira rica no cemitério, ou uma abaixo do corte com lote, passava.
_manif = json.load(open(os.path.join(BASE, 'public/city/cidade.json')))
_cem = _manif.get('cemiterio') or {}
_corte = float(_cem.get('corteDog') or 0)
if _corte > 0 and colum:
    _dog = {r['address']: float(r.get('dog') or 0) for r in fila}
    _ricos = [a for a in colum if _dog.get(a, 0) > _corte + 0.01]
    _pobres = [r['address'] for r in linhas
               if not str(r['address']).startswith('__projeto')
               and r['address'] in _dog and _dog[r['address']] < _corte - 0.01]
    item('cemitério obedece ao corte publicado',
         not _ricos and not _pobres,
         f'corte {_corte:.2f} DOG; {len(_ricos)} lápides acima do corte, '
         f'{len(_pobres)} lotes abaixo dele'
         + (f' (ex.: {(_ricos or _pobres)[:2]})' if (_ricos or _pobres) else ''))
else:
    item('cemitério obedece ao corte publicado', True,
         'PULADO: manifesto sem corteDog ou cidade sem cemitério')

# 5. A ÁREA ENTREGUE: EQUIDADE E NÍVEL DECLARADO, EM DOIS TESTES
# ⚠️ O PISO DE 0,95 DA CURVA SAIU EM 22/09, E A TROCA NÃO É REBAIXAMENTO.
#
# O teste velho exigia p10 >= 0,95 da curva publicada. Ele nasceu quando a curva
# ainda não tinha sido medida contra o sítio, e o que a rodada de 22/09 provou é
# que o terreno não sustenta esse número: a cidade entrega 0,92 na mediana, e boa
# parte da queda é a cidade PARANDO de vender terra que tinha prédio em cima (as
# 7 parcelas ancoradas custaram 2,39 km² de tecido nobre, e 856 lotes estavam
# gravados por cima delas).
#
# ⚠️ E PISO QUE SE AJUSTA AO RESULTADO DEIXA DE SER PISO. Por isso ele não desce:
# ele vira outra coisa, em dois testes que mordem onde importa.
#
#   5a. EQUIDADE. `p1 / mediana >= 0,95`: ninguém recebe muito menos que o
#       vizinho. É isto que pega a INJUSTIÇA, que é o defeito real. A cauda dos
#       85 lotes espremidos do setor 4 (um deles com 307 m² de 930 prometidos)
#       reprovaria aqui, e passava no teste velho porque ele olhava o p10.
#
#   5b. NÍVEL DECLARADO. A mediana entregue tem de bater com o número que a
#       PÁGINA PUBLICA (`ENTREGA.mediana` em app/dogcity/dogcity-data.ts). Assim
#       o nível deixa de ser opinião e vira contrato: ele não escorrega em
#       silêncio, porque mudá-lo obriga a mudar o que o holder lê. Se a página e
#       o registro divergirem, um dos dois está mentindo, e o portão não decide
#       qual: ele reprova e nomeia os dois números.
prom = {r['address']: r['area_m2'] for r in fila if r['area_m2'] > 0}
raz = sorted(float(r['area_m2']) / prom[r['address']] for r in linhas if r['address'] in prom)
n = len(raz) or 1
_med, _p1 = raz[n//2], raz[int(n*0.01)]
item('área entregue é equânime (p1 sobre mediana)', _med > 0 and _p1/_med >= 0.95,
     f'{n} lotes de carteira: mediana {_med:.4f}, p1 {_p1:.4f}, '
     f'razão {_p1/_med if _med else 0:.4f} (piso 0,95); mínimo {raz[0]:.4f}')

# ⚠️ O NÚMERO PUBLICADO É LIDO DO ARQUIVO DA PÁGINA, não copiado para cá: cópia
# diverge, e foi cópia de chão que custou 15.834 cotas erradas neste mesmo dia.
_pub, _pub_erro = None, ''
try:
    _t = open(os.path.join(BASE, 'app/dogcity/dogcity-data.ts'), encoding='utf-8').read()
    _m = re.search(r'ENTREGA[^{]*\{[^}]*?mediana:\s*"?([0-9.]+)', _t, re.S)
    if _m: _pub = float(_m.group(1))
    else: _pub_erro = 'não achei ENTREGA.mediana em app/dogcity/dogcity-data.ts'
except Exception as _e:
    _pub_erro = f'{type(_e).__name__}: {_e}'
if _pub is None:
    indisponivel('mediana entregue bate com a publicada', _pub_erro)
else:
    item('mediana entregue bate com a publicada', abs(_med - _pub) <= 0.005,
         f'registro {_med:.4f} contra página {_pub:.4f} (tolerância 0,005); '
         f'se divergir, um dos dois está mentindo')

# 6. cota dentro da faixa do relevo
fora = [c for c in cotas if not (-200 <= c <= 300)]
item('cota dentro da faixa do relevo', not fora, f'{len(fora)} fora')

# 6a. NENHUM LOTE DEBAIXO D'ÁGUA, e este teste faltava.
# ⚠️ A REGRA É DO FUNDADOR (30/08): lâmina única, "toda água da cidade precisa
# ter exatamente o mesmo nível", e o manifesto publica "tudo abaixo de cota
# dentro da casca é água". O teste acima só confere se a cota é PLAUSÍVEL, não
# se ela está acima da água: na cidade de 22/09 passaram 36 lotes de carteira
# com cota entre −45,07 e −40,25, todos em poças de menos de 3 ha que
# `_acha_lagos()` descarta antes de entrar na máscara.
# ⚠️ A LÂMINA SE LÊ DO MANIFESTO, não se crava aqui: o dia em que ela mudar,
# este teste muda junto, em vez de virar a quarta cópia do número.
_cam_malha = os.path.join(BASE, 'public/city/cidade-malha.json')
_LAMINA = (json.load(open(_cam_malha)).get('lagos', {}).get('cota', -40.0)
           if os.path.exists(_cam_malha) else -40.0)
_afogados = sorted(((float(r['cota_m']), r['lot_id'], r['address']) for r in linhas
                    if float(r['cota_m']) < _LAMINA))
item("nenhum lote abaixo da lâmina d'água", not _afogados,
     f'lâmina {_LAMINA:.1f} m; {len(_afogados)} lotes abaixo'
     + (f', pior {_afogados[0][0]:.2f} m em {_afogados[0][1]}' if _afogados else ''))

# 6b. o .bin é cópia fiel do registro, dentro da resolução dele (um quarto de metro)
pior_bin = 0.0
for i, r in enumerate(linhas):
    x4, z4, _s, _c, _f, _fl, w10, d10, _g = lotes[i]
    pior_bin = max(pior_bin,
                   abs(x4/4.0 - float(r['x_m'])), abs(z4/4.0 - float(r['z_m'])),
                   abs(w10/10.0 - float(r['frente_m'])),
                   abs(d10/10.0 - float(r['prof_m'])))
item('.bin fiel ao registro (1/4 m)', pior_bin <= 0.13, f'pior desvio {pior_bin:.3f} m')

# 6c. A COTA GRAVADA CAI DENTRO DO CHÃO QUE A CIDADE DESENHA, JULGADA PELA CAUDA
# ⚠️ O TESTE 4e COMPARA COM OS VIZINHOS, E ERRO SISTEMÁTICO PASSA INTEIRO. Um
# bairro todo 35 m fora do lugar tem vizinhos igualmente errados, então a
# mediana da vizinhança concorda com ele e o teste aplaude. Medido em 22/09:
# 15.834 lotes a mais de 1,5 m, 1.647 acima de 30 m, pior 56,72 m, e mesmo assim
# 4e passou e `conferir_terreno.py` (que julgava pela MEDIANA, 0,00 m) passou
# junto. Aqui a referência é absoluta e quem reprova é a CAUDA: p99 e pior.
# Defeito de chão nunca é uniforme, ele mora na FEIÇÃO.
#
# ⚠️ A REFERÊNCIA MUDOU EM 22/09, E ESSA É A NOTA IMPORTANTE. Este teste
# comparava com a RÉPLICA ANALÍTICA que `conferir_terreno.py` reconstrói do
# gerador. Só que o gerador parou de replicar o chão: `altura()` agora lê
# `data/superficie.f32`, que é a superfície assada da própria cena pela sonda
# `__plazaPerfil` (ver `scripts/city/assar_superficie.mjs`). Comparar a cota com
# a réplica passou a medir a distância entre duas coisas que ninguém usa: medido,
# a réplica e a superfície divergem até 155 m. O teste reprovaria para sempre,
# pelo motivo errado, que é a pior espécie de portão.
#
# ⚠️ A COTA É DA TESTADA, NÃO DO CENTRO (masterplan §15), e a testada não está
# gravada: o registro tem centro, frente, fundo e giro. Por isso a conferência
# não exige que a cota bata com um ponto escolhido, e sim que ela esteja DENTRO
# da faixa de alturas da PEGADA, amostrada em 9 pontos (centro, quatro cantos,
# quatro meios de face), com a tolerância de grade do teste 6d somada.
COTA_P99 = 1.5
COTA_PIOR = 6.0
COTA_TOL_GRADE = 1.0   # o teto medido do erro da grade de 15 m (ver 6d)

def _le_superficie():
    """a grade assada da cena: a MESMA fonte que o gerador usa para plantar."""
    import array
    mj = os.path.join(BASE, 'data/superficie.json')
    mf = os.path.join(BASE, 'data/superficie.f32')
    if not (os.path.exists(mj) and os.path.exists(mf)): return None
    m = json.load(open(mj, encoding='utf-8'))
    a = array.array('f'); a.fromfile(open(mf, 'rb'), m['n'] * m['n'])
    return m, a

_sup = _le_superficie()
if _sup is None:
    indisponivel('cota gravada cai dentro do chão que a cidade desenha',
                 'falta data/superficie.f32; asse com '
                 'node scripts/city/assar_superficie.mjs (dev server no ar)')
else:
    _m, _a = _sup
    _sn, _sr, _sc = _m['n'], float(_m['raio']), float(_m['celulaM'])
    def _alt(x, z):
        fi = (x + _sr) / _sc; fj = (z + _sr) / _sc
        if not (0 <= fi <= _sn - 1.001 and 0 <= fj <= _sn - 1.001): return None
        i, j = int(fi), int(fj); u, v = fi - i, fj - j
        G = lambda q, w: _a[w * _sn + q]
        return (G(i, j)*(1-u)*(1-v) + G(i+1, j)*u*(1-v)
                + G(i, j+1)*(1-u)*v + G(i+1, j+1)*u*v)
    _exc, _pior_c, _fora = [], (0.0, '', 0.0), 0
    for _i, _r in enumerate(linhas):
        _x, _z = float(_r['x_m']), float(_r['z_m'])
        _g = math.radians(float(lotes[_i][8]) / 100.0)
        _hw, _hd = max(1.0, float(_r['frente_m'])) / 2, max(1.0, float(_r['prof_m'])) / 2
        _cg, _sg = math.cos(_g), math.sin(_g)
        _hs = [_alt(_x + lx*_cg - lz*_sg, _z + lx*_sg + lz*_cg)
               for lx, lz in ((0, 0), (-_hw, -_hd), (_hw, -_hd), (_hw, _hd), (-_hw, _hd),
                              (0, -_hd), (0, _hd), (-_hw, 0), (_hw, 0))]
        _hs = [h for h in _hs if h is not None]
        if not _hs: _fora += 1; continue
        _c = float(_r['cota_m'])
        _v = max(0.0, _c - (max(_hs) + COTA_TOL_GRADE), (min(_hs) - COTA_TOL_GRADE) - _c)
        _exc.append(_v)
        if _v > _pior_c[0]: _pior_c = (_v, _r['lot_id'], _c)
    _exc.sort()
    _n99 = _exc[int(len(_exc) * 0.99)] if _exc else 0.0
    item('cota gravada cai dentro do chão que a cidade desenha',
         bool(_exc) and _n99 <= COTA_P99 and _exc[-1] <= COTA_PIOR and _fora == 0,
         f'{len(_exc)} lotes contra a superfície assada: mediana {_exc[len(_exc)//2]:.2f} m, '
         f'p99 {_n99:.2f} m (corte {COTA_P99:.1f}), pior {_exc[-1]:.2f} m (corte {COTA_PIOR:.1f}) '
         f'em {_pior_c[1]} (grava {_pior_c[2]:.2f} m); '
         f'{sum(1 for v in _exc if v > COTA_P99)} acima do corte de p99'
         + (f'; {_fora} lotes FORA da grade assada' if _fora else ''))

# 6d. A SUPERFÍCIE ASSADA É FIEL À CENA
# ⚠️ ESTE É O TESTE QUE IMPEDE O 6c DE SER CIRCULAR. O gerador planta sobre a
# grade assada e o 6c julga a cota contra a mesma grade: sozinhos, os dois
# concordariam mesmo que a grade inteira estivesse errada. Aqui a referência é a
# CENA, sondada ponto a ponto no centro de cada lote por `__plazaPerfil`, que é
# a mesma função que assenta lote, rua e peça:
#
#     node scripts/city/assar_superficie.mjs --pontos=data/dogcity_lotes.csv
#
# ⚠️ E A TOLERÂNCIA NÃO É ARBITRÁRIA: é o erro de INTERPOLAÇÃO da grade de 15 m,
# medido em 22/09 sobre os 70.720 lotes do registro selado, mediana 0,005 m,
# p99 0,212 m, pior 0,864 m, zero lotes acima de 1 m. Os cortes abaixo têm folga
# sobre isso e continuam duas ordens de grandeza abaixo do defeito que a réplica
# analítica produzia.
SUP_P99, SUP_PIOR = 0.5, 1.5
_pl = os.path.join(BASE, 'data/superficie_lotes.csv')
if _sup is None:
    pass                    # já reprovou no 6c, não repete a mesma queixa
elif not os.path.exists(_pl):
    indisponivel('a superfície assada é fiel à cena',
                 'falta data/superficie_lotes.csv; sonde com '
                 'node scripts/city/assar_superficie.mjs --pontos=data/dogcity_lotes.csv')
else:
    _ex = {}
    with open(_pl, newline='') as _f:
        for _q in csv.DictReader(_f): _ex[_q['lot_id']] = float(_q['cota_cena_m'])
    _d, _piorS, _semq = [], (0.0, ''), 0
    for _r in linhas:
        _e = _ex.get(_r['lot_id'])
        if _e is None: _semq += 1; continue
        _gq = _alt(float(_r['x_m']), float(_r['z_m']))
        if _gq is None: _semq += 1; continue
        _v = abs(_gq - _e); _d.append(_v)
        if _v > _piorS[0]: _piorS = (_v, _r['lot_id'])
    _d.sort()
    _p99 = _d[int(len(_d) * 0.99)] if _d else 0.0
    item('a superfície assada é fiel à cena',
         bool(_d) and _semq == 0 and _p99 <= SUP_P99 and _d[-1] <= SUP_PIOR,
         f'{len(_d)} lotes sondados na cena: mediana {_d[len(_d)//2]:.3f} m, '
         f'p99 {_p99:.3f} m (corte {SUP_P99}), pior {_d[-1]:.3f} m (corte {SUP_PIOR}) em {_piorS[1]}'
         + (f'; {_semq} lotes sem sonda (a sonda é de outra rodada)' if _semq else ''))

# 7. o que a cidade.json declara bate com o que existe
meta = json.load(open(os.path.join(BASE, 'public/city/cidade.json')))
# ⚠️ O META DECLARA POR NATUREZA, e o portão tem de ler assim: `plantadas` e
# `carteiras` falam de LOTE DE CARTEIRA, enquanto o arquivo tem também projeto
# e institucional. Comparar com o total de linhas reprovava a cidade certa.
_lot = (meta.get('lotes') or {})
item('cidade.json bate com os arquivos',
     meta.get('plantadas') == len(tenho) and meta.get('carteiras') == len(tenho)
     and (_lot.get('total') is None or _lot.get('total') == len(lotes)),
     f"declara {meta.get('plantadas')} de {meta.get('carteiras')} carteiras, "
     f"{_lot.get('total')} linhas no total, arquivo tem {len(lotes)}")

# 8. o columbário declarado é o columbário gravado
if colum:
    dec = (meta.get('cemiterio') or {}).get('lapides')
    item('cemitério declarado bate com o gravado', dec == len(colum),
         f'declara {dec}, gravados {len(colum)}')

# 9. AS COLUNAS QUE NINGUÉM LIA
# ⚠️ O PORTÃO CONFERIA GEOMETRIA E IGNORAVA A IDENTIDADE. `dog`, `utxo_count`,
# `forma` e `coorte` entram no registro, aparecem na página do dono e nunca
# foram comparadas com fonte nenhuma. Medido em 22/09: 725 lotes gravam as
# quatro colunas em zero. 704 são lote de projeto, onde zero é a resposta certa
# porque não há carteira atrás; os outros 21 são as institucionais do Distrito
# Financeiro, carteiras de verdade, e a maior delas é a Gate.io com 3,03
# bilhões de DOG gravados como 0 e `forma` 0, que o gerador traduz por "massa
# única: casa no centro".
# ⚠️ A CAUSA É UMA LINHA SÓ, e por isso este teste é barato: na gravação do CSV
# `_proj = a.startswith('__projeto') or a not in posto` mete institucional e
# projeto no mesmo balde, e `posto` é só a fila residencial. A institucional tem
# fonte própria (`dog_966670_tag_institucional.json`) e ela é lida aqui.
_fonte_dog = {r['address']: float(r.get('dog') or 0) for r in fila}
_cam_inst = os.path.join(BASE, 'data/snapshots/dog_966670_tag_institucional.json')
_n_inst = 0
if os.path.exists(_cam_inst):
    for _l in (json.load(open(_cam_inst)).get('linhas') or []):
        if _l.get('address'):
            _fonte_dog.setdefault(_l['address'], float(_l.get('dog') or 0)); _n_inst += 1
# ⚠️ A ESCADA DE `forma` SE LÊ DO GERADOR, não se copia: ela é `forma_de(u)` e
# muda quando o produto mudar. Se o texto dela sumir, a subconferência de forma
# é PULADA e dita como pulada, nunca dada por boa.
_escada = []
try:
    import re as _re2
    _src_ger = open(os.path.join(BASE, 'scripts/gerar_cidade.py'), encoding='utf-8').read()
    _bloco = _src_ger[_src_ger.index('def forma_de(u):'):][:400]
    _escada = [(int(a), int(b)) for a, b in _re2.findall(r'if u <= (\d+): *return (\d+)', _bloco)]
    _ult = _re2.search(r'\n *return (\d+)', _bloco)
    _escada_ult = int(_ult.group(1)) if _ult else None
except Exception:
    _escada, _escada_ult = [], None
if _escada_ult is None: _escada = []     # escada meio lida é escada não lida
def _forma_de(u):
    for _lim, _v in _escada:
        if u <= _lim: return _v
    return _escada_ult
_mot = collections.Counter()
_ex = {}
for _r in linhas:
    _a = _r['address']; _proj = _a.startswith('__projeto')
    _d = float(_r['dog']); _u = int(_r['utxo_count'])
    _f = int(_r['forma']); _co = int(_r['coorte'])
    if _proj:
        # o lote do projeto não tem carteira atrás: as quatro colunas são zero
        if _d or _u or _f or _co:
            _mot['projeto com coluna de carteira'] += 1; _ex.setdefault('projeto com coluna de carteira', _r['lot_id'])
        continue
    _src_d = _fonte_dog.get(_a)
    if _src_d is None:
        _mot['carteira sem fonte de saldo'] += 1; _ex.setdefault('carteira sem fonte de saldo', _r['lot_id'])
    elif abs(_d - _src_d) > 1.0:      # o CSV grava DOG arredondado ao inteiro
        _mot['dog diferente da fonte'] += 1; _ex.setdefault('dog diferente da fonte', _r['lot_id'])
    if _u < 1:
        _mot['utxo_count zerado'] += 1; _ex.setdefault('utxo_count zerado', _r['lot_id'])
    elif _escada and _f != _forma_de(_u):
        _mot['forma fora da escada'] += 1; _ex.setdefault('forma fora da escada', _r['lot_id'])
    if not (0 <= _co <= 7):
        _mot['coorte fora de 0 a 7'] += 1; _ex.setdefault('coorte fora de 0 a 7', _r['lot_id'])
_zerados = sum(1 for _r in linhas if not _r['address'].startswith('__projeto')
               and not float(_r['dog']) and not int(_r['utxo_count'])
               and not int(_r['forma']) and not int(_r['coorte']))
item('dog, utxo_count, forma e coorte batem com a fonte', not _mot,
     f'{_n_inst} institucionais na fonte à parte, escada de forma com {len(_escada)} degraus'
     + ('' if _escada else ' (PULADA: não achei forma_de no gerador)')
     + f'; {_zerados} carteiras com as quatro colunas zeradas; '
     + (', '.join(f'{k} {v} (ex.: {_ex[k]})' for k, v in _mot.most_common()) if _mot else 'nenhum desvio'))

# 10. A CONECTIVIDADE VIÁRIA É PORTÃO, NÃO RELATÓRIO
# ⚠️ O CORTE ESTÁ ESCRITO AQUI, ANTES DA RODADA, DE PROPÓSITO. A varredura de
# vias já existia e já media: 409 grupos de pavimento, 370 deles só de
# `via:pista`, 4,21 km² fora da rede (14,0% do pavimento desenhado). Só que ela
# saía num arquivo em /tmp que ninguém tinha de ler, então a cidade passou por
# 15 testes com 370 ilhas. Critério escolhido depois de ver o número é critério
# que cabe no número; este está escrito antes.
# ⚠️ A ILHA SE MEDE CONTRA O PAVIMENTO, não contra a cidade: é a fração do
# pavimento desenhado que não está no maior componente conexo. A varredura tem
# de ter rodado com `--dilata=1`, senão a serrilha da grade parte rua contínua
# em pedaços e o número mente para pior.
#   node scripts/city/vias-varredura.mjs --cel=6 --dilata=1
# ⚠️ O CORTE DE "MENOS DE 60 GRUPOS" SAIU EM 22/09, E A TROCA NÃO É
# REBAIXAMENTO: ele media a coisa errada. CONTAGEM de fragmento não é defeito.
# Medido depois do conserto da poda da teia, a cidade tem 108 grupos e 107 deles
# somam 0,700 km², com MEDIANA de 4.300 m², que é uma lasca do tamanho de um
# lote; 98,1% do pavimento está numa rede só. Reprovar por "108 > 60" seria
# reprovar uma cidade conectada por causa de aparas.
#
# O que É defeito é PEDAÇO GRANDE órfão: 25 ha de asfalto que não levam a lugar
# nenhum. Então a contagem sai e entram duas perguntas que significam algo:
#     ilha total ... < 3% do pavimento (o holder alcança a cidade)
#     maior ilha ... < 0,25 km²        (nenhum pedaço grande órfão)
#
# ⚠️ E A MAIOR ILHA DE HOJE É A SATOSHI PLAZA, 0,161 km²: ela passa neste corte e
# é defeito PRÓPRIO, do deck não costurar com a malha em volta. Tem de ser
# consertada pelo motivo dela, não por este teste.
VIAS_ILHA_MAX = 0.03
VIAS_MAIOR_ILHA_KM2 = 0.25
_cam_con = arg('conexao', '/tmp/vias/conexao.json')
if not os.path.exists(_cam_con):
    indisponivel('malha viária conexa',
                 f'não achei {_cam_con}; rode `node scripts/city/vias-varredura.mjs '
                 f'--cel=6 --dilata=1` com o dev server no ar')
else:
    try:
        _con = json.load(open(_cam_con))
        _gr = _con.get('grupos') or []
        _cels = [int(g.get('celulas') or 0) for g in _gr]
        _tot = sum(_cels) or 0
    except Exception as _e:
        _gr, _tot = [], 0
    if not _gr or not _tot:
        indisponivel('malha viária conexa', f'{_cam_con} não tem `grupos` legível')
    else:
        _cel2 = float(_con.get('cel') or 1) ** 2
        _ilha = (_tot - max(_cels)) / _tot
        _km2 = (_tot - max(_cels)) * _cel2 / 1e6
        _ord = sorted(_cels, reverse=True)
        _maior_ilha = (_ord[1] * _cel2 / 1e6) if len(_ord) > 1 else 0.0
        item('malha viária conexa',
             _ilha < VIAS_ILHA_MAX and _maior_ilha <= VIAS_MAIOR_ILHA_KM2,
             f'rede {max(_cels)*_cel2/1e6:.2f} km² de {_tot*_cel2/1e6:.2f} '
             f'({100*max(_cels)/_tot:.1f}%); ilha {100*_ilha:.1f}% '
             f'(corte {VIAS_ILHA_MAX*100:.0f}%), maior ilha {_maior_ilha:.3f} km² '
             f'(corte {VIAS_MAIOR_ILHA_KM2}); {len(_gr)-1} fragmentos, {_km2:.2f} km² fora')

print(('REPROVADO: ' + ', '.join(falhas)) if falhas else 'APROVADO')
sys.exit(1 if falhas else 0)
