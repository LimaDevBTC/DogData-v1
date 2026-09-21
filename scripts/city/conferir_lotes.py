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

FMT = '<hhBBHBBBH'; REG = struct.calcsize(FMT)
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

# 1. cada carteira da fila tem UM destino: lote ou nicho. Nenhuma tem os dois,
#    nenhuma fica sem.
# ⚠️ O COLUMBÁRIO É DESTINO LEGÍTIMO (masterplan §17), então o portão tem de
# lê-lo. Sem isto ele acusaria 15.802 carteiras "faltando" e passaria a mentir
# na direção oposta: reprovaria a cidade certa.
colum = []
cam_col = os.path.join(BASE, 'data/dogcity_columbario.csv')
if os.path.exists(cam_col):
    colum = [r['address'] for r in csv.DictReader(open(cam_col))]
quero = {r['address'] for r in fila if r['dog'] > 0}
tenho = [r['address'] for r in linhas]
destinos = tenho + colum
dobrados = set(tenho) & set(colum)
item('cada carteira tem um destino, lote ou nicho',
     len(destinos) == len(set(destinos)) == len(quero) and set(destinos) == quero and not dobrados,
     f'{len(tenho)} lotes + {len(colum)} nichos = {len(destinos)} de {len(quero)} carteiras, '
     f'{len(dobrados)} em dois lugares')

# 2. os três arquivos na mesma ordem
mesma = (len(lotes) == len(linhas) == len(cotas)) and all(
    abs(lotes[i][0] / 4.0 - float(linhas[i]['x_m'])) <= 1 and
    abs(lotes[i][1] / 4.0 - float(linhas[i]['z_m'])) <= 1 for i in range(0, len(linhas), 7))
item('.bin, CSV e cotas na mesma ordem', mesma, f'{len(lotes)} / {len(linhas)} / {len(cotas)}')

# 3. lot_id único e no formato
import re
pad = re.compile(r'^S\d{2}-Q\d{2}-B\d{3}-L\d{3}$')
ids = [r['lot_id'] for r in linhas]
item('lot_id único e no padrão', len(set(ids)) == len(ids) and all(pad.match(i) for i in ids))

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
    por_quarteirao[r['lot_id'][:14]].append((i, cantos(x, z, max(1.0, w), max(1.0, d), math.radians(giro_c/100))))
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

# 5. área entregue contra a prometida pelo snapshot
# ⚠️ só quem recebeu lote entra nesta conta: o nicho não promete metro quadrado
prom = {r['address']: r['area_m2'] for r in fila if r['area_m2'] > 0}
raz = sorted(float(r['area_m2']) / prom[r['address']] for r in linhas if r['address'] in prom)
n = len(raz) or 1
item('área entregue honra a prometida', raz[int(n*0.10)] >= 0.95,
     f'mediana {raz[n//2]:.2f}, p1 {raz[int(n*0.01)]:.2f}, p10 {raz[int(n*0.10)]:.2f}')

# 6. cota dentro da faixa do relevo
fora = [c for c in cotas if not (-200 <= c <= 300)]
item('cota dentro da faixa do relevo', not fora, f'{len(fora)} fora')

# 6b. o .bin é cópia fiel do registro, dentro da resolução dele (um quarto de metro)
pior_bin = 0.0
for i, r in enumerate(linhas):
    x4, z4, _s, _c, _f, _fl, w8, d8, _g = lotes[i]
    pior_bin = max(pior_bin,
                   abs(x4/4.0 - float(r['x_m'])), abs(z4/4.0 - float(r['z_m'])),
                   abs(w8 + ((_fl >> 4) & 3)/4.0 - float(r['frente_m'])),
                   abs(d8 + ((_fl >> 6) & 3)/4.0 - float(r['prof_m'])))
item('.bin fiel ao registro (1/4 m)', pior_bin <= 0.13, f'pior desvio {pior_bin:.3f} m')

# 7. o que a cidade.json declara bate com o que existe
meta = json.load(open(os.path.join(BASE, 'public/city/cidade.json')))
item('cidade.json bate com os arquivos',
     meta.get('plantadas') == len(lotes) and meta.get('carteiras') == len(lotes),
     f"declara {meta.get('plantadas')} de {meta.get('carteiras')}")

# 8. o columbário declarado é o columbário gravado
if colum:
    dec = (meta.get('columbario') or {}).get('nichos')
    item('columbário declarado bate com o gravado', dec == len(colum),
         f'declara {dec}, gravados {len(colum)}')

print(('REPROVADO: ' + ', '.join(falhas)) if falhas else 'APROVADO')
sys.exit(1 if falhas else 0)
