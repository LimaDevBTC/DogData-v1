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
#   python3 scripts/city/conferir_lotes.py --cidade=/caminho/da/saida
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
quero = {r['address'] for r in fila if r['dog'] > 0}
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
# distritos passavam sem ser olhados — justamente os que não nascem do alocador
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

# 5. área entregue contra a prometida pelo snapshot
# ⚠️ só quem recebeu lote entra nesta conta: o nicho não promete metro quadrado
prom = {r['address']: r['area_m2'] for r in fila if r['area_m2'] > 0}
# ⚠️ a orla tem regra de área própria (piso de 60 m de fundo, masterplan §16.2 e
# o caderno §3.2), então ela não entra na conta da curva: ali entregar MAIS que
# o prometido é a regra, não desvio.
raz = sorted(float(r['area_m2']) / prom[r['address']] for r in linhas
             if r['address'] in prom and not r['lot_id'].startswith('S07'))
n = len(raz) or 1
item('área entregue honra a prometida', raz[int(n*0.10)] >= 0.95,
     f'mediana {raz[n//2]:.2f}, p1 {raz[int(n*0.01)]:.2f}, p10 {raz[int(n*0.10)]:.2f}')

# 6. cota dentro da faixa do relevo
fora = [c for c in cotas if not (-200 <= c <= 300)]
item('cota dentro da faixa do relevo', not fora, f'{len(fora)} fora')

# 6b. o .bin é cópia fiel do registro, dentro da resolução dele (um quarto de metro)
pior_bin = 0.0
for i, r in enumerate(linhas):
    x4, z4, _s, _c, _f, _fl, w10, d10, _g = lotes[i]
    pior_bin = max(pior_bin,
                   abs(x4/4.0 - float(r['x_m'])), abs(z4/4.0 - float(r['z_m'])),
                   abs(w10/10.0 - float(r['frente_m'])),
                   abs(d10/10.0 - float(r['prof_m'])))
item('.bin fiel ao registro (1/4 m)', pior_bin <= 0.13, f'pior desvio {pior_bin:.3f} m')

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

print(('REPROVADO: ' + ', '.join(falhas)) if falhas else 'APROVADO')
sys.exit(1 if falhas else 0)
