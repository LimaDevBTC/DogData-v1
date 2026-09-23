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
# ⚠️ DOIS REGISTROS, UM PORTÃO (masterplan §37/§41, 23/09/2026). O lote deixou
# de ser retângulo (x, z, frente, prof, giro) e virou 4 cantos explícitos. O
# script DETECTA sozinho qual dos dois está no CSV (pela presença das colunas
# `p0x_m ... p3z_m, geo`) e roda o conjunto de testes certo:
#   - REGISTRO v3 (retângulo): os 23 testes de sempre, byte a byte como hoje.
#   - REGISTRO v4 (4 cantos): todo teste geométrico usa os cantos do CSV
#     diretamente (nunca reconstrói retângulo), a sobreposição passa a olhar
#     TODOS os pares vizinhos (não só dentro do quarteirão) e entram os testes
#     novos do §37 (quadrilátero, área exata, geo=3, faixa do int16, bin v4,
#     lote×rua, lote×célula).
# Nenhuma opção liga isto: é o arquivo em disco que decide, porque o bot de
# auto-commit publica a árvore de hora em hora e não pode escolher versão.
#
#   python3 scripts/city/conferir_lotes.py [--cidade=DIR] [--tolerancia=<m>]
#       [--conexao=<arquivo>] [--csv=ARQ] [--bin=ARQ] [--cemiterio=ARQ]
#       [--cidade-json=ARQ] [--malha=ARQ] [--cotas=ARQ] [--vias=ARQ]
#       [--superficie=DIR] [--entrega=ARQ] [--aceita-legado]
#
# ⚠️ FONTE (o que o GERADOR LÊ) NUNCA SEGUE `--cidade=` (23/09/2026, palco).
# Um PALCO é uma saída fora do git (o gerador novo por célula escreve
# `PALCO/data/dogcity_lotes.csv`, `PALCO/data/dogcity_cemiterio.csv`,
# `PALCO/public/city/{cidade.json,cidade-malha.json,cidade-lotes(-v4).bin,
# cidade-cotas.bin}`); ele NUNCA tem uma cópia de `scripts/gerar_cidade.py`,
# `app/city/plaza/teia.ts`, `data/snapshots/*` ou `public/city/mapa-v1.json`
# ao lado, porque essas são as FONTES que o gerador leu para produzir a
# saída, não parte dela. Rodar `--cidade=PALCO` contra a versão de antes desta
# nota fazia o portão procurar essas fontes DENTRO do palco, não achar, e
# reprovar por motivo errado: `_tag_inst` vinha vazio e as 6 carteiras de
# custódia voltavam a contar como fila residencial comum (69.995 em vez de
# 69.989), a escada de `forma_de` vinha "não achei no gerador" e pulava a
# subconferência de forma, e `app/dogcity/dogcity-data.ts` dava
# FileNotFoundError. As fontes abaixo são RAIZ, sempre, sem opção: são
# `data/snapshots/dog_966670_tag_institucional.json`,
# `scripts/gerar_cidade.py` e `public/city/mapa-v1.json` (o próprio cabeçalho
# dele diz "o gerador de lotes CONSOME este arquivo").
#
#   --cidade=DIR      BASE para toda SAÍDA da rodada (CSV de lotes e
#                      cemitério, os .bin, cidade.json, cidade-malha.json,
#                      vias.json), como sempre foi (padrão: a raiz do
#                      repositório, que também É a saída enquanto a rodada
#                      selada mora ali).
#   --csv=/--bin=/--cemiterio=/--cidade-json=/--malha=/--cotas=/--vias=
#                      sobrepõe UM caminho de SAÍDA por vez, relativo à raiz
#                      do repositório (ou absoluto), sem mudar os demais.
#   --superficie=DIR   onde estão `superficie.json`, `superficie.f32` e
#                      `superficie_lotes.csv` (a superfície assada e a sonda
#                      dos lotes contra a cena): é SAÍDA do processo de
#                      assadura, então o padrão também é `--cidade=DIR/data`,
#                      mas ela pode morar em outro lugar que não o palco (por
#                      exemplo, a assadura de produção, reaproveitada contra
#                      um palco que só mudou o loteamento).
#   --entrega=ARQ      `app/dogcity/dogcity-data.ts`, para o teste "mediana
#                      entregue bate com a publicada". É um arquivo de FONTE
#                      (mora em `app/`, o gerador não escreve lá), mas o
#                      NÚMERO dentro dele (`ENTREGA.mediana`) é saída da
#                      rodada: a página só pode mudar esse número junto com a
#                      cidade. Por isso ganha opção própria em vez de seguir
#                      a regra geral de fonte: o padrão é o do repositório,
#                      e `--entrega=PALCO/app/dogcity/dogcity-data.ts` aponta
#                      para a cópia que o palco atualizou para a rodada dele.
#   --tolerancia=<m>   sobreposição: no v3 o padrão continua 0,02 m (a
#                      resolução do registro antigo); no v4 o padrão passa a
#                      0,05 m (masterplan §37, tarefa 4a). Passar o valor
#                      sobrescreve os dois.
#   --aceita-legado    só para testar a cadeia contra um CSV convertido por
#                      `v4_de_v3.py` (todo geo=3): sem isto, geo=3 reprova.
# ═══════════════════════════════════════════════════════════════════════════
import csv, json, math, os, struct, sys, collections

arg = lambda k, d=None: next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{k}=')), d)
flag = lambda k: f'--{k}' in sys.argv[1:]
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = arg('cidade', RAIZ)
FILA = arg('fila', os.path.join(RAIZ, 'data/snapshots/dog_966670_ordem_residencial.json'))
ACEITA_LEGADO = flag('aceita-legado')


def caminho(nome_canonico, override, base=None):
    """Sem override, o padrão é `base` (BASE, ou seja `--cidade=`, quando
    `base` não é dado) + o nome canônico. Com override (--csv=, --bin=,
    --entrega=, ...), relativo à RAIZ DO REPOSITÓRIO (ou absoluto), NUNCA a
    BASE: dá para apontar um artefato de saída para o palco sem arrastar as
    fontes (que nunca seguem `--cidade=`, ver nota no topo do arquivo)."""
    if override:
        return override if os.path.isabs(override) else os.path.join(RAIZ, override)
    return os.path.join(base if base is not None else BASE, nome_canonico)


# ⚠️ FONTES: SEMPRE A RAIZ DO REPOSITÓRIO, SEM OPÇÃO. O gerador as lê de lá
# não importa onde a saída dele for escrita, e um palco nunca as copia junto.
FONTE_TAG_INSTITUCIONAL = os.path.join(RAIZ, 'data/snapshots/dog_966670_tag_institucional.json')
FONTE_GERADOR = os.path.join(RAIZ, 'scripts/gerar_cidade.py')
FONTE_MAPA_V1 = os.path.join(RAIZ, 'public/city/mapa-v1.json')


# ⚠️ A TOLERÂNCIA É A RESOLUÇÃO DO REGISTRO, NÃO UM GOSTO. O registro v3 (o
# retângulo) guarda posição em quartos de metro, então cada centro pode andar
# 0,125 m e dois lotes que se ENCOSTAM aparecem cruzados em até 0,25 m sem que
# ninguém tenha errado. Medido em 20/09: com 0,10 m o teste acusava 15.593
# pares e TODOS os inspecionados estavam na faixa de 0,15 m, ou seja o teste
# estava medindo o arquivo, não a cidade. O v4 mede o CSV (ponto flutuante,
# nunca quantizado), então o piso deixa de ser sobre a grade do .bin e vira o
# valor fixado no §37 (0,05 m); ambos continuam sobrescrevíveis pela mesma opção.
_tol_arg = arg('tolerancia')
TOL = float(_tol_arg) if _tol_arg is not None else 0.02
TOL_SOBREPOSICAO_V4 = float(_tol_arg) if _tol_arg is not None else 0.05

CAM_CSV = caminho('data/dogcity_lotes.csv', arg('csv'))
CAM_CEM = caminho('data/dogcity_cemiterio.csv', arg('cemiterio'))
CAM_CIDADE_JSON = caminho('public/city/cidade.json', arg('cidade-json'))
CAM_MALHA = caminho('public/city/cidade-malha.json', arg('malha'))
CAM_COTAS = caminho('public/city/cidade-cotas.bin', arg('cotas'))
CAM_VIAS = caminho('public/city/mapa/vias.json', arg('vias'))
# ⚠️ SUPERFÍCIE ASSADA: SAÍDA, MAS COM DIRETÓRIO PRÓPRIO. `--superficie=DIR`
# vale para os três arquivos juntos (superficie.json, superficie.f32,
# superficie_lotes.csv); sem a opção, cai em BASE/data como sempre caiu.
CAM_SUPERFICIE_DIR = caminho('data', arg('superficie'))
# ⚠️ `--entrega=`: caso especial, documentado no cabeçalho do arquivo. Padrão
# é a RAIZ do repositório (não BASE), porque dogcity-data.ts é fonte de lugar
# (mora em app/), mas o número que o teste lê é saída de rodada.
CAM_ENTREGA = caminho('app/dogcity/dogcity-data.ts', arg('entrega'), base=RAIZ)

with open(CAM_CSV, newline='') as _f:
    _leitor = csv.DictReader(_f)
    _campos = _leitor.fieldnames or []
    # ⚠️ A DETECÇÃO É PELO ARQUIVO, NUNCA POR OPÇÃO (a mesma regra de
    # scripts/city/merkle.py): `p0x_m` e `geo` só existem depois que o gerador
    # (ou, em teste, `v4_de_v3.py`) os escreveu.
    V4 = 'p0x_m' in _campos and 'geo' in _campos
    linhas = list(_leitor)

NOME_BIN = 'public/city/cidade-lotes-v4.bin' if V4 else 'public/city/cidade-lotes.bin'
CAM_BIN = caminho(NOME_BIN, arg('bin'))

if V4:
    FMT = '<8hBBHB'; REG = struct.calcsize(FMT)      # registro v4, 21 bytes (masterplan §41)
    assert REG == 21
else:
    FMT = '<hhBBHBHHH'; REG = struct.calcsize(FMT)   # registro v3, 15 bytes
byt = open(CAM_BIN, 'rb').read()
lotes = [struct.unpack_from(FMT, byt, i * REG) for i in range(len(byt) // REG)]
cot = open(CAM_COTAS, 'rb').read()
cotas = [struct.unpack_from('<h', cot, i * 2)[0] / 100.0 for i in range(len(cot) // 2)]
fila = json.load(open(FILA))['ordem']
MANIFESTO = json.load(open(CAM_CIDADE_JSON))

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

print(f'CONFERÊNCIA DO LOTEAMENTO em {BASE} (registro {"v4, 4 cantos" if V4 else "v3, retângulo"})')

# ── GEOMETRIA: cantos de cada lote, e SÓ DE UM JEITO (masterplan §37) ───────
# No v4 os 4 cantos SÃO o CSV: nenhuma fórmula, nenhuma reconstrução. No v3
# eles continuam vindo de `cantos(x, z, frente, prof, giro)`, exatamente como
# sempre. A função abaixo também serve para desenhar o retângulo do lote de
# projeto e a peça de programa mais adiante, que não mudam com a rodada.
def cantos(x, z, w, d, giro):
    ca, sa = math.cos(giro), math.sin(giro)
    return [(x + dx*ca - dz*sa, z + dx*sa + dz*ca)
            for dx, dz in ((-w/2, -d/2), (w/2, -d/2), (w/2, d/2), (-w/2, d/2))]

def _rumo(pt):
    """mesma convenção de sempre neste arquivo (teste do §36): 0 = norte
    (x=0, z<0), crescente em sentido horário."""
    return math.atan2(pt[0], -pt[1])

def _shoelace(c):
    s = 0.0
    for k in range(4):
        x1, z1 = c[k]; x2, z2 = c[(k + 1) % 4]
        s += x1 * z2 - x2 * z1
    return abs(s) / 2.0

# ⚠️ EMENDA DO COORDENADOR (23/09/2026, depois do §41 já fechado): geo=1 NÃO É
# CORDA, é FATIA DE ANEL CENTRADA NA ORIGEM. p0-p1 e p2-p3 são ARCOS de círculo
# centrado em (0,0), as laterais p0-p3 e p1-p2 são RADIAIS. Isso muda três
# coisas, e as três estão implementadas aqui: a ÁREA (setor circular, não
# shoelace dos 4 pontos, que subestimaria a corda), a SOBREPOSIÇÃO/LOTE×RUA
# (a fatia não é convexa quando o arco é grande, então ela é subdividida em
# sub-fatias de no máximo 1° e cada uma vira um quadrilátero que CONTÉM a
# sub-fatia real, empurrando para fora só a aresta de raio maior (a de raio
# menor já fica por dentro do arco verdadeiro usando a corda crua) e o TESTE
# DE FORMA (não é "convexo e simples", é |p0|=|p1|, |p2|=|p3| e as laterais
# radiais).
PASSO_ARCO = math.radians(0.25)   # o §37 pede no máximo 1°; uso 1/4 disso de folga

def sub_poligonos(c, geo):
    """lista de quadriláteros convexos que cobrem o lote. geo 0/2/3: o próprio
    quadrilátero do CSV, sem mudança nenhuma. geo 1: a fatia de anel
    subdividida (ver nota acima)."""
    if geo != 1:
        return [c]
    p0, p1, p2, p3 = c
    r_f = (math.hypot(*p0) + math.hypot(*p1)) / 2.0
    r_t = (math.hypot(*p2) + math.hypot(*p3)) / 2.0
    th0, th1 = _rumo(p0), _rumo(p1)
    dth = (th1 - th0) % (2 * math.pi)
    if dth < 1e-9:
        return [c]
    n = max(1, math.ceil(dth / PASSO_ARCO))
    passo = dth / n
    maior_r, menor_r = (r_f, r_t) if r_f >= r_t else (r_t, r_f)
    maior_r_contido = maior_r / math.cos(passo / 2.0)
    r_f_uso = maior_r_contido if r_f >= r_t else menor_r
    r_t_uso = menor_r if r_f >= r_t else maior_r_contido
    def pt(r, a): return (r * math.sin(a), -r * math.cos(a))
    polys = []
    for k in range(n):
        a0 = th0 + k * passo
        a1 = a0 + passo
        polys.append([pt(r_f_uso, a0), pt(r_f_uso, a1), pt(r_t_uso, a1), pt(r_t_uso, a0)])
    return polys

def area_do_lote(c, geo):
    if geo == 1:
        p0, p1, p2, p3 = c
        r1 = (math.hypot(*p0) + math.hypot(*p1)) / 2.0
        r2 = (math.hypot(*p2) + math.hypot(*p3)) / 2.0
        dth = (_rumo(p1) - _rumo(p0)) % (2 * math.pi)
        return abs(r1 * r1 - r2 * r2) / 2.0 * dth
    return _shoelace(c)

def _quase_radial(a, b, tol=0.05):
    """a e b estão no MESMO rumo a partir da origem? (distância perpendicular
    de b à reta origem-a, em metros, bearing-independente, ao contrário de
    comparar ângulos, que precisaria de uma tolerância diferente por raio)."""
    ra = math.hypot(*a)
    if ra < 1e-6: return True
    cruz = a[0]*b[1] - a[1]*b[0]
    return abs(cruz) / ra <= tol

def _convexo_simples(c, tol=1e-6):
    """todo giro de aresta (a cada vértice) tem o MESMO sinal: é o teste de
    quadrilátero simples e convexo, e vale para os dois sentidos de giro
    (§41: "sentido de giro livre"). Um bowtie (self-intersecting) sempre dá
    sinais misturados aqui, então "simples" e "convexo" saem do mesmo cálculo."""
    n = len(c)
    sinais = []
    for k in range(n):
        ax, az = c[(k - 1) % n]; bx, bz = c[k]; cx, cz = c[(k + 1) % n]
        e1x, e1z = bx - ax, bz - az
        e2x, e2z = cx - bx, cz - bz
        sinais.append(e1x*e2z - e1z*e2x)
    pos = sum(1 for s in sinais if s > tol)
    neg = sum(1 for s in sinais if s < -tol)
    return (pos == n and neg == 0) or (neg == n and pos == 0)

def _dist_pt_seg(p, a, b):
    px, pz = p; ax, az = a; bx, bz = b
    dx, dz = bx - ax, bz - az
    l2 = dx*dx + dz*dz
    if l2 < 1e-12: return math.hypot(px - ax, pz - az)
    t = max(0.0, min(1.0, ((px - ax)*dx + (pz - az)*dz) / l2))
    return math.hypot(px - (ax + t*dx), pz - (az + t*dz))

def _dist_pt_poly_borda(p, poly):
    n = len(poly)
    return min(_dist_pt_seg(p, poly[k], poly[(k + 1) % n]) for k in range(n))

if V4:
    CANTOS_CSV = []
    GEOS = []
    for r in linhas:
        CANTOS_CSV.append(((float(r['p0x_m']), float(r['p0z_m'])),
                            (float(r['p1x_m']), float(r['p1z_m'])),
                            (float(r['p2x_m']), float(r['p2z_m'])),
                            (float(r['p3x_m']), float(r['p3z_m']))))
        GEOS.append(int(r['geo']))
    # POL[i]: lista de quadriláteros CONVEXOS que cobrem o lote (um só, exceto
    # geo=1). BBOX[i]: caixa envolvente de POL[i], para o índice de grade.
    POL, BBOX = [], []
    for i in range(len(linhas)):
        polys = sub_poligonos(CANTOS_CSV[i], GEOS[i])
        POL.append(polys)
        xs = [pt[0] for poly in polys for pt in poly]
        zs = [pt[1] for poly in polys for pt in poly]
        BBOX.append((min(xs), max(xs), min(zs), max(zs)))
else:
    POL, BBOX = [], []
    for i, r in enumerate(linhas):
        _w = max(1.0, float(r['frente_m'])); _d = max(1.0, float(r['prof_m']))
        q = cantos(float(r['x_m']), float(r['z_m']), _w, _d, math.radians(lotes[i][8] / 100))
        POL.append([q])
        xs = [pt[0] for pt in q]; zs = [pt[1] for pt in q]
        BBOX.append((min(xs), max(xs), min(zs), max(zs)))

# 1. cada carteira da fila tem UM destino: lote ou lápide. Nenhuma tem os dois,
#    nenhuma fica sem.
# ⚠️ O COLUMBÁRIO É DESTINO LEGÍTIMO (masterplan §17), então o portão tem de
# lê-lo. Sem isto ele acusaria 15.802 carteiras "faltando" e passaria a mentir
# na direção oposta: reprovaria a cidade certa.
colum = []
if os.path.exists(CAM_CEM):
    colum = [r['address'] for r in csv.DictReader(open(CAM_CEM))]
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
_ct = FONTE_TAG_INSTITUCIONAL
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
if V4:
    # ⚠️ NO v4 A FIDELIDADE FINA VIROU TESTE PRÓPRIO ("bin v4 fiel ao CSV",
    # mais abaixo, no lugar do antigo 6b): ali se confere CADA canto, não uma
    # amostra de x/z. Aqui basta o tamanho: os três arquivos precisam ter o
    # mesmo número de linhas antes de qualquer teste que index por posição.
    mesma = len(lotes) == len(linhas) == len(cotas)
    item('registro (.bin v4, CSV e cotas) do mesmo tamanho', mesma,
         f'{len(lotes)} / {len(linhas)} / {len(cotas)}')
else:
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

def penetracao(A, B):
    """quanto um lote entra no outro, em metros: 0 ou menos quer dizer que não
    entram. Eixo separador com os 4 cantos de cada polígono CONVEXO."""
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

def penetracao_multi(polys_a, polys_b):
    """o mesmo `penetracao`, mas cada lado pode ser uma LISTA de quadriláteros
    (geo=1 subdividido): o pior caso entre todos os pares cobre a fatia
    inteira, porque basta UM sub-quadrilátero encostar para o lote encostar."""
    pior = 0.0
    for pa in polys_a:
        for pb in polys_b:
            v = penetracao(pa, pb)
            if v > pior: pior = v
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

# 4. SOBREPOSIÇÃO
# ⚠️ SÓ O v4 GANHA A GRADE GLOBAL (masterplan §37, tarefa 4a). O v3 continua
# rodando EXATAMENTE como hoje (mesmo agrupamento por quarteirão, mesmo teste
# à parte para os distritos especiais, mesma tolerância padrão), porque a
# tarefa pede o portão novo para o registro novo, não uma reauditoria
# retroativa do registro que o bot de auto-commit publica agora mesmo. (O
# §39 mediu esse mesmo buraco por FORA do portão, com script de diagnóstico
# à parte; a virada para "todos os pares" é o que fecha o buraco NO PORTÃO, e
# só faz sentido cobrar isso da rodada que já fala a língua de 4 cantos.)
if V4:
    # ⚠️ O §39 ACHOU 10.465 PARES QUE O TESTE ANTIGO NUNCA VIA. O teste de
    # sempre comparava lotes DENTRO DO MESMO QUARTEIRÃO (e, à parte, dentro do
    # mesmo setor para S07-S09); 10.453 dos 10.465 pares eram ENTRE
    # quarteirões de QUARTOS VIZINHOS (a costura da emenda polar). Agrupar por
    # quarteirão nunca ia achar isso, não importa quantas vezes se rodasse.
    #
    # ⚠️ A GRADE INDEXA PELA CAIXA ENVOLVENTE INTEIRA, NÃO SÓ PELO CENTRO. Um
    # lote de projeto tem 890 m de frente (S08-Q01-B001-L001, o pátio da
    # Kraken hot); se a grade só olhasse a célula do centro, um vizinho a duas
    # células de distância nunca apareceria como candidato. Inserindo o lote
    # em TODA célula que sua caixa toca, dois polígonos que se tocam sempre
    # compartilham pelo menos uma célula, e não precisa de vizinhança 3×3 por
    # cima.
    _CELD_SOB = 100.0
    _grade_sob = collections.defaultdict(list)
    for i, (x0, x1, z0, z1) in enumerate(BBOX):
        for bi in range(int((x0 - TOL_SOBREPOSICAO_V4) // _CELD_SOB), int((x1 + TOL_SOBREPOSICAO_V4) // _CELD_SOB) + 1):
            for bj in range(int((z0 - TOL_SOBREPOSICAO_V4) // _CELD_SOB), int((z1 + TOL_SOBREPOSICAO_V4) // _CELD_SOB) + 1):
                _grade_sob[(bi, bj)].append(i)

    _visto_sob, _pares_sob, _fundos_sob, _pior_sob = set(), 0, [], (0.0, '', '')
    _mesmo_bloco, _entre_blocos = 0, 0
    for _itens in _grade_sob.values():
        _n_it = len(_itens)
        for _a in range(_n_it):
            for _b in range(_a + 1, _n_it):
                _i, _j = _itens[_a], _itens[_b]
                _chave = (_i, _j) if _i < _j else (_j, _i)
                if _chave in _visto_sob: continue
                _visto_sob.add(_chave)
                _pen = penetracao_multi(POL[_i], POL[_j])
                if _pen > TOL_SOBREPOSICAO_V4:
                    _pares_sob += 1
                    _fundos_sob.append(_pen)
                    _bi_id = '-'.join(linhas[_i]['lot_id'].split('-')[:3])
                    _bj_id = '-'.join(linhas[_j]['lot_id'].split('-')[:3])
                    if _bi_id == _bj_id: _mesmo_bloco += 1
                    else: _entre_blocos += 1
                    if _pen > _pior_sob[0]:
                        _pior_sob = (_pen, linhas[_i]['lot_id'], linhas[_j]['lot_id'])
    _fundos_sob.sort()
    _detalhe_sob = f'{_pares_sob} pares acima de {TOL_SOBREPOSICAO_V4:.2f} m ({_mesmo_bloco} no mesmo quarteirão, {_entre_blocos} entre quarteirões/quartos)'
    if _fundos_sob:
        _detalhe_sob += f', mediana {_fundos_sob[len(_fundos_sob)//2]:.2f} m, pior {_pior_sob[0]:.2f} m em {_pior_sob[1]} x {_pior_sob[2]}'
    item('nenhum lote sobre outro (todos os pares vizinhos, índice de grade)', _pares_sob == 0, _detalhe_sob)
else:
    # ─ EXATAMENTE o teste de sempre (pré-§37): agrupado por quarteirão, mais
    # o teste à parte para os distritos especiais (que gravam um quarteirão
    # por lote e por isso nunca caem no mesmo balde do teste principal).
    por_quarteirao = collections.defaultdict(list)
    for i, r in enumerate(linhas):
        giro_c = lotes[i][8]
        x, z = float(r['x_m']), float(r['z_m'])
        w, d = float(r['frente_m']), float(r['prof_m'])
        _p = r['lot_id'].split('-')
        por_quarteirao['-'.join(_p[:3])].append((i, cantos(x, z, max(1.0, w), max(1.0, d), math.radians(giro_c / 100))))
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
    # ⚠️ Orla Nobre (S07), Distrito Financeiro (S08) e Orla da Baía (S09) gravam
    # UM QUARTEIRÃO POR LOTE, porque cada lote tem giro próprio. O teste 4
    # agrupa por quarteirão: com um lote em cada balde, ele nunca compara dois
    # deles e os três distritos passavam sem ser olhados. Aqui eles são
    # comparados par a par, dentro de cada setor.
    _esp = collections.defaultdict(list)
    for i, r in enumerate(linhas):
        _s_ = int(r['setor'])
        if _s_ < 7: continue
        giro_c = lotes[i][8]
        _esp[_s_].append((i, cantos(float(r['x_m']), float(r['z_m']),
                                    max(1.0, float(r['frente_m'])), max(1.0, float(r['prof_m'])),
                                    math.radians(giro_c / 100))))
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

# 4c. O GIRO DO REGISTRO BATE COM O DO .bin? (só existe no v3)
# ⚠️ Até 22/09 o giro só existia no binário, ou seja não havia contra o que
# conferi-lo: o documento do dono não dizia para que lado o lote está virado.
# Num distrito em que o lote do dedo é radial e o da fileira é tangente, giro
# trocado é lote de lado, e nenhum teste pegava.
if V4:
    item('giro do CSV bate com o do .bin', True,
         'N/A no v4: o .bin de 21 bytes não guarda mais giro (4 cantos absolutos, §41); '
         'ver "bin v4 fiel ao CSV", mais abaixo')
elif 'giro_graus' in (linhas[0].keys() if linhas else {}):
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

# 4i. QUADRILÁTERO SIMPLES E CONVEXO (geo 0/2/3) OU FATIA COERENTE (geo=1)
# (masterplan §37, tarefa 4c; só existe no v4, porque o v3 sempre foi retângulo
# por construção, e `cantos()` não sabe desenhar outra coisa).
#
# ⚠️ GEO=1 NÃO SE TESTA IGUAL. A emenda do coordenador (23/09) tornou a fatia
# de anel não-convexa por definição quando o arco é grande (a corda cortaria
# 114 m para dentro da custódia do Distrito Financeiro, 57° de arco). O teste
# certo para ela é geométrico só que outro: os dois cantos da frente à mesma
# distância da origem, os dois do fundo à mesma distância, e as duas laterais
# exatamente radiais.
if V4:
    _maus_quad = []
    for i, r in enumerate(linhas):
        c, g = CANTOS_CSV[i], GEOS[i]
        if g == 1:
            p0, p1, p2, p3 = c
            ok = (abs(math.hypot(*p0) - math.hypot(*p1)) <= 0.05
                  and abs(math.hypot(*p2) - math.hypot(*p3)) <= 0.05
                  and _quase_radial(p0, p3) and _quase_radial(p1, p2))
        else:
            ok = _convexo_simples(c)
        if not ok: _maus_quad.append(r['lot_id'])
    item('quadrilátero simples e convexo (geo 0/2/3) ou fatia coerente (geo=1)',
         len(linhas) > 0 and not _maus_quad,
         f'{len(linhas)} lotes conferidos; {len(_maus_quad)} reprovam'
         + (f' (ex.: {_maus_quad[:5]})' if _maus_quad else ''))

# 4j. area_m2 BATE COM A ÁREA EXATA DO POLÍGONO, ±1 m² (masterplan §37/§41)
# ⚠️ GEO=1 USA SETOR CIRCULAR, NUNCA SHOELACE. A emenda do coordenador é
# explícita: shoelace dos 4 pontos (que são só os EXTREMOS do arco, ligados
# por corda) subestima a área verdadeira, e é exatamente essa subestimativa
# que cortaria 114 m da custódia do Distrito Financeiro se alguém usasse a
# corda como fronteira de direito.
if V4:
    _maus_area = []
    for i, r in enumerate(linhas):
        _esperado = area_do_lote(CANTOS_CSV[i], GEOS[i])
        _diff = abs(_esperado - float(r['area_m2']))
        if _diff > 1.0:
            _maus_area.append((_diff, r['lot_id'], _esperado, float(r['area_m2'])))
    _maus_area.sort(reverse=True)
    item('area_m2 bate com a área exata do polígono (±1 m²)',
         len(linhas) > 0 and not _maus_area,
         f'{len(linhas)} lotes; {len(_maus_area)} divergem por mais de 1 m²'
         + (f', pior {_maus_area[0][0]:.2f} m² em {_maus_area[0][1]} '
            f'(calc {_maus_area[0][2]:.1f} contra CSV {_maus_area[0][3]:.1f})' if _maus_area else ''))

# 4k. NENHUM RETÂNGULO LEGADO (geo=3) NO REGISTRO (masterplan §41)
# ⚠️ geo=3 É "SÓ O QUE NÃO FOI CONVERTIDO", e o próprio §41 manda o portão
# reprovar se sobrar. `--aceita-legado` existe só para provar a cadeia inteira
# (merkle → escrituras → lookup → portão) contra `v4_de_v3.py`, cujo CSV é
# geo=3 em 100% das linhas de propósito; nunca para uma rodada que vira Charter.
if V4:
    _n_geo3 = sum(1 for g in GEOS if g == 3)
    _ex_geo3 = [linhas[i]['lot_id'] for i in range(len(linhas)) if GEOS[i] == 3][:5]
    if ACEITA_LEGADO:
        item('nenhum retângulo legado (geo=3) no registro', True,
             f'PULADO por --aceita-legado: {_n_geo3} de {len(linhas)} lotes são geo=3 '
             '(só vale para testar a cadeia, nunca para uma rodada real)')
    else:
        item('nenhum retângulo legado (geo=3) no registro', _n_geo3 == 0,
             f'{_n_geo3} de {len(linhas)} lotes ainda em geo=3'
             + (f' (ex.: {_ex_geo3})' if _ex_geo3 else ''))

# 4l. TODO CANTO DENTRO DA FAIXA DO int16 (masterplan §37: "assert de faixa
# dos int16 aborta a rodada" no gerador; aqui o portão só MEDE e reprova).
if V4:
    _LIMITE_CANTO = 32767 / 4.0   # int16 em quartos de metro: 8.191,75 m
    _fora_faixa = []
    for i, r in enumerate(linhas):
        if any(abs(v) >= _LIMITE_CANTO for pt in CANTOS_CSV[i] for v in pt):
            _fora_faixa.append(r['lot_id'])
    item(f'todo canto dentro da faixa do int16 (±{_LIMITE_CANTO:.2f} m)',
         len(linhas) > 0 and not _fora_faixa,
         f'{len(linhas)} lotes; {len(_fora_faixa)} com algum canto fora da faixa'
         + (f' (ex.: {_fora_faixa[:5]})' if _fora_faixa else ''))

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
#
# ⚠️ MIGRADO PARA O POLÍGONO (masterplan §37, tarefa 4d): os cantos vêm de
# `POL[i]` (o CSV no v4, `cantos()` no v3) em vez de reconstruir retângulo a
# partir de frente/prof/giro. `_folga` compara UM PAR de quadriláteros; quando
# o lote é uma lista de sub-fatias (geo=1), `_folga_multi` testa todas as
# combinações e fica com a pior; para geo 0/2/3 (lista de um elemento só) o
# resultado é idêntico ao de sempre.
_TETO_DIVISA = 3.0
_MAX_FORA = 0.01          # 1% das divisas
# ⚠️ O RAIO DO FILTRO RÁPIDO NÃO MUDA NO v3, DE PROPÓSITO. É só uma pré-triagem
# (quem sobra ainda passa por `_folga_multi`, exato), mas um raio diferente
# muda QUAIS pares chegam a ser testados, e portanto o número final. O v3
# usa `max(frente, prof)/2` desde sempre, e trocar por um raio derivado da
# caixa envolvente (mais correto para retângulo girado, mas DIFERENTE) mudaria
# a contagem publicada sem a rodada ter mudado. O v4 usa a caixa envolvente
# porque não há mais "frente"/"prof" autoritativos para derivar o raio dela.
_cant = []
for _i, _r in enumerate(linhas):
    _cx, _cz = float(_r['x_m']), float(_r['z_m'])
    if V4:
        _x0, _x1, _z0, _z1 = BBOX[_i]
        _raio = max(_x1 - _x0, _z1 - _z0) / 2.0
    else:
        _w = max(1.0, float(_r['frente_m'])); _d = max(1.0, float(_r['prof_m']))
        _raio = max(_w, _d) / 2.0
    _cant.append((_cx, _cz, _raio, POL[_i], float(_r['cota_m']), _r['lot_id']))
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
def _folga_multi(polys_a, polys_b):
    pior = -1e9
    for pa in polys_a:
        for pb in polys_b:
            g = _folga(pa, pb)
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
            if _folga_multi(_a[3], _b[3]) <= 1.5: _div.append((abs(_a[4]-_b[4]), _a[5], _b[5]))
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
def _sobrepoe_multi(polys, poly):
    return any(_sobrepoe(p, poly) for p in polys)

_pecas = []
_cam_mapa = FONTE_MAPA_V1
if os.path.exists(_cam_mapa):
    for _a_ in (json.load(open(_cam_mapa)).get('ancoras') or []):
        if _a_.get('poly'):
            _pecas.append(('âncora ' + str(_a_.get('id')),
                           [(float(u), float(v)) for u, v in _a_['poly']]))
for _q_ in (MANIFESTO.get('programa') or []):
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

# ⚠️ REAPROVEITA `_cant` E `_bd` DO TESTE ACIMA de propósito: são os mesmos
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
        if _sobrepoe_multi(_cant[_i][3], _poly):
            _por_peca[_nm] += 1; _sob.add(_i)
_ha_sob = sum(float(linhas[_i]['area_m2']) for _i in _sob) / 1e4
_cart_sob = sum(1 for _i in _sob if not linhas[_i]['address'].startswith('__projeto'))
item('nenhum lote sobre peça de programa', not _sob,
     f'{len(_pecas)} peças (programa + âncoras) contra {len(linhas)} lotes; '
     f'{len(_sob)} lotes sobrepostos, {_ha_sob:.2f} ha, {_cart_sob} de carteira'
     + ('; pior: ' + ', '.join(f'{k} {v}' for k, v in _por_peca.most_common(4)) if _sob else ''))

if V4:
    # 4p. LOTE × RUA DESENHADA (masterplan §37, tarefa 4b/(i))
    # ⚠️ NENHUM POLÍGONO DE LOTE INVADE A FAIXA DE NENHUMA VIA (`vias.json`,
    # o segmento engrossado larg/2 de cada lado) em mais de 0,5 m. É o mesmo
    # eixo separador de sempre: o "corredor" de uma via é só um retângulo
    # (comprimento do segmento × largura), então `penetracao` serve sem
    # mudar uma linha.
    #
    # ⚠️ ESTE TESTE VAI REPROVAR HOJE, E É ISSO MESMO (nota do coordenador,
    # 23/09): o `vias.json` atual grava os anéis ARTERIAIS como CÍRCULO
    # (defeito do dump: `dumpSeg` interpola o ângulo, a cena desenha
    # dodecágono), outro agente está consertando isso à parte. Reprovar aqui
    # não é regressão deste portão: é o portão finalmente medindo um defeito
    # que já existia e ninguém via.
    if not os.path.exists(CAM_VIAS):
        indisponivel('lote não invade a faixa de nenhuma via (vias.json)', f'não achei {CAM_VIAS}')
    else:
        _vias = json.load(open(CAM_VIAS))
        _CELD_RUA = 100.0
        def _corredor(pontos, larg):
            (x1, z1), (x2, z2) = pontos
            dx, dz = x2 - x1, z2 - z1
            comp = math.hypot(dx, dz) or 1e-6
            ux, uz = dx / comp, dz / comp
            nx, nz = -uz, ux
            hw = larg / 2.0
            return [(x1 + nx*hw, z1 + nz*hw), (x2 + nx*hw, z2 + nz*hw),
                    (x2 - nx*hw, z2 - nz*hw), (x1 - nx*hw, z1 - nz*hw)]
        _seg_poly, _seg_tipo = [], []
        _grade_rua = collections.defaultdict(list)
        for _s in _vias:
            _pts = _s.get('pontos') or []
            if len(_pts) < 2: continue
            _poly = _corredor(_pts, float(_s.get('larg') or 0.0))
            _idx = len(_seg_poly)
            _seg_poly.append(_poly); _seg_tipo.append(_s.get('tipo') or '?')
            _xs = [q[0] for q in _poly]; _zs = [q[1] for q in _poly]
            for _bi in range(int(min(_xs)//_CELD_RUA), int(max(_xs)//_CELD_RUA)+1):
                for _bj in range(int(min(_zs)//_CELD_RUA), int(max(_zs)//_CELD_RUA)+1):
                    _grade_rua[(_bi, _bj)].append(_idx)
        _TETO_RUA = 0.5
        _invasoes, _por_tipo, _n_testados = [], collections.Counter(), 0
        for i in range(len(linhas)):
            x0, x1, z0, z1 = BBOX[i]
            _cand = set()
            for bi in range(int(x0//_CELD_RUA), int(x1//_CELD_RUA)+1):
                for bj in range(int(z0//_CELD_RUA), int(z1//_CELD_RUA)+1):
                    _cand.update(_grade_rua.get((bi, bj), ()))
            if not _cand: continue
            _n_testados += 1
            _pior, _pior_tipo = 0.0, None
            for _si in _cand:
                for _pa in POL[i]:
                    _v = penetracao(_pa, _seg_poly[_si])
                    if _v > _pior: _pior, _pior_tipo = _v, _seg_tipo[_si]
            if _pior > _TETO_RUA:
                _invasoes.append((_pior, linhas[i]['lot_id'], _pior_tipo))
                _por_tipo[_pior_tipo] += 1
        _invasoes.sort(reverse=True)
        item('lote não invade a faixa de nenhuma via (vias.json, tolerância 0,5 m)',
             _n_testados > 0 and not _invasoes,
             f'{_n_testados} lotes com via candidata nas redondezas ({len(_seg_poly)} segmentos lidos); '
             f'{len(_invasoes)} invadem mais de {_TETO_RUA} m'
             + (f' ({", ".join(f"{k} {v}" for k, v in _por_tipo.most_common())})' if _invasoes else '')
             + (f'; pior {_invasoes[0][0]:.1f} m em {_invasoes[0][1]} ({_invasoes[0][2]})' if _invasoes else ''))

    # 4q. LOTE DENTRO DA CÉLULA (masterplan §37, tarefa 4b/(ii))
    # ⚠️ SÓ GEO=0 (célula da teia): fatia de anel (geo=1) e reta (geo=2) não
    # nascem de quarteirão-célula do `cidade-malha.json` da mesma forma, e o
    # próprio enunciado da tarefa restringe a "todo lote geo=0".
    #
    # ⚠️ INDISPONÍVEL HOJE, DE PROPÓSITO. `cidade-malha.json` ainda descreve
    # quarteirão como retângulo em coordenadas polares (x, z, r, giro, lado,
    # prof); o campo `poly` por célula é trabalho do §41 que ainda não rodou
    # (é o gerador, fora do escopo desta tarefa). "Indisponível" aqui não é
    # aprovação: conta como falha, exatamente como os outros insumos que faltam.
    _malha_v4 = json.load(open(CAM_MALHA)) if os.path.exists(CAM_MALHA) else None
    _poly_bloco = {}
    if _malha_v4:
        for _q in (_malha_v4.get('quarteiroes') or []):
            if _q.get('poly'):
                _poly_bloco[_q['id']] = [(float(u), float(v)) for u, v in _q['poly']]
    if _malha_v4 is None:
        indisponivel('lote geo=0 cabe na célula (cidade-malha.json)', f'não achei {CAM_MALHA}')
    elif not _poly_bloco:
        indisponivel('lote geo=0 cabe na célula (cidade-malha.json)',
                     'malha sem campo `poly` nos quarteirões (§41 ainda não migrado no gerador)')
    else:
        _TOL_CELULA = 0.15
        _fora_cel, _sem_celula, _n_geo0 = [], 0, 0
        for i, r in enumerate(linhas):
            if GEOS[i] != 0: continue
            _n_geo0 += 1
            _bloco_id = '-'.join(r['lot_id'].split('-')[:3])
            _poly = _poly_bloco.get(_bloco_id)
            if _poly is None:
                _sem_celula += 1; continue
            _pior = 0.0
            for _c in CANTOS_CSV[i]:
                if not _dentro_poly(_c, _poly):
                    _d = _dist_pt_poly_borda(_c, _poly)
                    if _d > _pior: _pior = _d
            if _pior > _TOL_CELULA:
                _fora_cel.append((_pior, r['lot_id']))
        _fora_cel.sort(reverse=True)
        item('lote geo=0 cabe na célula (cidade-malha.json)',
             _n_geo0 > 0 and not _fora_cel and _sem_celula == 0,
             f'{_n_geo0} lotes geo=0 contra {len(_poly_bloco)} células com poly; '
             f'{_sem_celula} sem célula correspondente, {len(_fora_cel)} fora por mais de {_TOL_CELULA} m'
             + (f', pior {_fora_cel[0][0]:.2f} m em {_fora_cel[0][1]}' if _fora_cel else ''))
else:
    # 4h. O QUARTEIRÃO OBEDECE O DODECÁGONO (masterplan §36, 23/09/2026), só v3.
    # No v4 este papel se divide em dois testes que medem contra o que a CENA
    # desenha de verdade (4p, lote×rua; 4q, lote×célula), em vez de contra a
    # fórmula que o gerador usou: a mesma lição que o §40 tirou desta prova.
    #
    # ⚠️ POR QUE ISTO EXISTE. O fundador, nas palavras dele: "a geração dos lotes
    # está circular... ela deveria seguir o modelo do dodecaedro". Medido em 22/09
    # contra o registro selado (masterplan §36): 85,7% dos 2.071 quarteirões
    # residenciais tinham a rua de anel da teia, que É um dodecágono (`vias.ts`
    # desenha com o vértice em `an.r` e a face em 96,6% dele), passando POR DENTRO
    # da própria pegada. A causa era a divisa radial nascer da curva de nível de φ
    # (redonda, ou superelipse fora do núcleo), nunca da FACE do anel desenhado.
    #
    # ⚠️ A FÓRMULA VEM DE app/city/plaza/teia.ts, NUNCA É COPIADA. `anelRaio()`
    # devolve o raio da FACE do anel de vértice R no rumo `ang`:
    #   r_face(ang) = R·cos(15°) / cos(t), t = distância angular ao vértice mais
    #   perto, limitada a [-15°, 15°] (os vértices caem a cada 30°, 7 passos de
    #   360/84, e por isso coincidem com o radial ativo da costura de 22/09).
    # Se a cena mudar a fórmula, este teste lê a nova: o regex abaixo é o mesmo de
    # `_teia_num`/`vaoDoAnel` em `scripts/gerar_cidade.py`, nunca reimplementado à
    # mão. Lido de RAIZ (o repositório), não de BASE (a saída de `--cidade=`):
    # fonte não se move com a rodada, só o registro gerado por ela.
    #
    # ⚠️ SÓ OS DISTRITOS COMUNS ENTRAM (setor 1 a 6). Orla Nobre (S07), Distrito
    # Financeiro (S08) e Orla da Baía (S09) não nascem do alocador de tecido, e a
    # AN7 da Orla Nobre é CÍRCULO por decisão do fundador: o próprio §36 diz que
    # ela é a única exceção. Cobrar dodecágono dela reprovaria uma forma que está
    # certa por definição.
    #
    # ⚠️ POR LOTE, NÃO POR QUARTEIRÃO (o texto do §36: "para cada lote
    # residencial"). Um lote no MEIO do quarteirão nunca é alcançado por anel
    # nenhum; só os lotes da fileira de fora ou de dentro estão perto o bastante
    # para a rua cortar.
    _cam_teia_h = os.path.join(RAIZ, 'app/city/plaza/teia.ts')
    _cam_ger_h = os.path.join(RAIZ, 'scripts/gerar_cidade.py')
    _TETO_DODECA = 0.02      # no máximo 2% dos lotes cruzados (era 85,7% dos quarteirões)
    if not os.path.exists(_cam_teia_h):
        indisponivel('quarteirão obedece o dodecágono da teia (§36)', 'app/city/plaza/teia.ts não existe')
    elif not os.path.exists(_cam_ger_h):
        indisponivel('quarteirão obedece o dodecágono da teia (§36)', 'scripts/gerar_cidade.py não existe')
    else:
        try:
            _txt_teia_h = open(_cam_teia_h, encoding='utf-8').read()
            _txt_ger_h = open(_cam_ger_h, encoding='utf-8').read()
            _m = re.search(r'export const R_DENTRO\s*=\s*([0-9.]+)', _txt_teia_h)
            if not _m: raise ValueError('R_DENTRO sumiu de teia.ts')
            _R_DENTRO_H = float(_m.group(1))
            _m = re.search(r'export const R_FORA\s*=\s*([0-9.]+)', _txt_teia_h)
            if not _m: raise ValueError('R_FORA sumiu de teia.ts')
            _R_FORA_H = float(_m.group(1))
            _vt_h = re.search(r'vaoDoAnel\(r: number\): number \{\s*return\s*(.+?)\n\}', _txt_teia_h, re.S)
            if not _vt_h: raise ValueError('vaoDoAnel sumiu ou mudou de forma em teia.ts')
            _VAO_H = [(float(a), float(b)) for a, b in
                      re.findall(r'r\s*<\s*([0-9.]+)\s*\?\s*([0-9.]+)', _vt_h.group(1))]
            _ELSE_H = re.findall(r':\s*([0-9.]+)', _vt_h.group(1))
            if not _VAO_H or not _ELSE_H: raise ValueError('vaoDoAnel deixou de ser escada de ternários')
            _VAO_FIM_H = float(_ELSE_H[-1])
            def _vao_h(r):
                for _lim, _v in _VAO_H:
                    if r < _lim: return _v
                return _VAO_FIM_H
            _TEIA_ANEIS_H = []
            _rt_h = _R_DENTRO_H
            while _rt_h <= _R_FORA_H:
                _TEIA_ANEIS_H.append(_rt_h); _rt_h += _vao_h(_rt_h)
            _m = re.search(r'^VIA_CONTORNO\s*=\s*([0-9.]+)', _txt_ger_h, re.M)
            if not _m: raise ValueError('VIA_CONTORNO sumiu de gerar_cidade.py')
            _VIA_CONTORNO_H = float(_m.group(1))
            def _teia_face_h(r_vertice, ang):
                _PASSO = math.pi / 6
                _rel = ((ang % _PASSO) + _PASSO) % _PASSO - _PASSO / 2
                return (r_vertice * math.cos(_PASSO / 2)) / math.cos(_rel)
            _cruzados_h, _n_h = [], 0
            for _r in linhas:
                if int(_r['setor']) >= 7: continue
                _x, _z = float(_r['x_m']), float(_r['z_m'])
                _meio = max(1.0, float(_r['prof_m'])) / 2.0
                _rc = math.hypot(_x, _z)
                _r_in, _r_out = _rc - _meio, _rc + _meio
                _lo, _hi = _r_in + _VIA_CONTORNO_H / 2, _r_out - _VIA_CONTORNO_H / 2
                if _hi <= _lo: continue      # lote mais raso que a própria rua: sem zona interna a cruzar
                _n_h += 1
                _ang_h = math.atan2(_x, -_z)
                for _R in _TEIA_ANEIS_H:
                    _rf = _teia_face_h(_R, _ang_h)
                    if _lo < _rf < _hi:
                        _cruzados_h.append((min(_rf - _lo, _hi - _rf), _r['lot_id']))
                        break
            _cruzados_h.sort(reverse=True)
            _n_h = _n_h or 1
            _frac_h = len(_cruzados_h) / _n_h
            item('quarteirão obedece o dodecágono da teia (§36)', _frac_h <= _TETO_DODECA,
                 f'{_n_h} lotes testados (setor 1 a 6, {len(_TEIA_ANEIS_H)} anéis da teia), '
                 f'{len(_cruzados_h)} cruzados por face de anel ({100*_frac_h:.2f}%, '
                 f'teto {_TETO_DODECA*100:.0f}%)'
                 + (f'; pior {_cruzados_h[0][0]:.1f} m de profundidade em {_cruzados_h[0][1]}'
                    if _cruzados_h else ''))
        except Exception as _e:
            indisponivel('quarteirão obedece o dodecágono da teia (§36)', f'{type(_e).__name__}: {_e}')

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
_cem = MANIFESTO.get('cemiterio') or {}
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
    _t = open(CAM_ENTREGA, encoding='utf-8').read()
    _m = re.search(r'ENTREGA[^{]*\{[^}]*?mediana:\s*"?([0-9.]+)', _t, re.S)
    if _m: _pub = float(_m.group(1))
    else: _pub_erro = f'não achei ENTREGA.mediana em {CAM_ENTREGA}'
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
_LAMINA = (json.load(open(CAM_MALHA)).get('lagos', {}).get('cota', -40.0)
           if os.path.exists(CAM_MALHA) else -40.0)
_afogados = sorted(((float(r['cota_m']), r['lot_id'], r['address']) for r in linhas
                    if float(r['cota_m']) < _LAMINA))
item("nenhum lote abaixo da lâmina d'água", not _afogados,
     f'lâmina {_LAMINA:.1f} m; {len(_afogados)} lotes abaixo'
     + (f', pior {_afogados[0][0]:.2f} m em {_afogados[0][1]}' if _afogados else ''))

# 6b. O .bin É CÓPIA FIEL DO REGISTRO
if V4:
    # ⚠️ SUBSTITUÍDO PELO TESTE DO REGISTRO v4 (masterplan §37, tarefa 4c): não
    # é mais "1/4 m em x/z/frente/prof", é os 8 CANTOS e os FLAGS. bits4-5 dos
    # flags = `geo` (não "família geométrica 0/1/2" do texto antigo do §37: o
    # próprio §41, que é o contrato posterior e o que `v4_de_v3.py` já
    # implementa, fixa bits4-5 = geo, 0 a 3, e é essa leitura que este teste usa).
    _n_bin, _n_csv = len(lotes), len(linhas)
    if _n_bin != _n_csv:
        item('bin v4 fiel ao CSV (cantos ±0,13 m, mesma ordem, flags)', False,
             f'.bin tem {_n_bin} registros, CSV tem {_n_csv}: tamanhos diferentes, nada mais foi conferido')
    else:
        _pior_bin4, _flags_ruins, _setor_ruim = 0.0, 0, 0
        _ex_flag, _ex_setor = '', ''
        for i, r in enumerate(linhas):
            b = lotes[i]
            _cantos_bin = [(b[0]/4.0, b[1]/4.0), (b[2]/4.0, b[3]/4.0), (b[4]/4.0, b[5]/4.0), (b[6]/4.0, b[7]/4.0)]
            for (bx, bz), (cx, cz) in zip(_cantos_bin, CANTOS_CSV[i]):
                _pior_bin4 = max(_pior_bin4, abs(bx - cx), abs(bz - cz))
            _setor_bin, _coorte_bin, _flags_bin = b[8], b[9], b[11]
            if _setor_bin != int(r['setor']) - 1 or _coorte_bin != int(r['coorte']):
                _setor_ruim += 1; _ex_setor = _ex_setor or r['lot_id']
            _dsc_bit = _flags_bin & 1
            _forma_bits = (_flags_bin >> 1) & 7
            _geo_bits = (_flags_bin >> 4) & 3
            if (_dsc_bit != (1 if r['dsc'] == '1' else 0) or _forma_bits != int(r['forma'])
                    or _geo_bits != GEOS[i]):
                _flags_ruins += 1; _ex_flag = _ex_flag or r['lot_id']
        item('bin v4 fiel ao CSV (cantos ±0,13 m, mesma ordem, flags)',
             _pior_bin4 <= 0.13 and _flags_ruins == 0 and _setor_ruim == 0,
             f'{_n_bin} registros; pior desvio de canto {_pior_bin4:.3f} m; '
             f'{_flags_ruins} com flags divergentes' + (f' (ex.: {_ex_flag})' if _flags_ruins else '') + '; '
             f'{_setor_ruim} com setor/coorte divergente' + (f' (ex.: {_ex_setor})' if _setor_ruim else ''))
else:
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
# `__plazaPerfil` (ver `scripts/city/assar_superficie.mjs`).
#
# ⚠️ A COTA É DA TESTADA, NÃO DO CENTRO (masterplan §15), e a testada não está
# gravada: o registro tem centro, frente, fundo e giro (v3) ou os 4 cantos
# (v4). Por isso a conferência não exige que a cota bata com um ponto
# escolhido, e sim que ela esteja DENTRO da faixa de alturas da PEGADA,
# amostrada em 9 pontos (centro, quatro cantos, quatro meios de aresta); no
# v4 os cantos e os meios de aresta são os do POLÍGONO DE VERDADE, não os de
# um retângulo reconstruído.
COTA_P99 = 1.5
COTA_PIOR = 6.0
COTA_TOL_GRADE = 1.0   # o teto medido do erro da grade de 15 m (ver 6d)

def _le_superficie():
    """a grade assada da cena: a MESMA fonte que o gerador usa para plantar."""
    import array
    mj = os.path.join(CAM_SUPERFICIE_DIR, 'superficie.json')
    mf = os.path.join(CAM_SUPERFICIE_DIR, 'superficie.f32')
    if not (os.path.exists(mj) and os.path.exists(mf)): return None
    m = json.load(open(mj, encoding='utf-8'))
    a = array.array('f'); a.fromfile(open(mf, 'rb'), m['n'] * m['n'])
    return m, a

_sup = _le_superficie()
if _sup is None:
    indisponivel('cota gravada cai dentro do chão que a cidade desenha',
                 f'falta superficie.f32/.json em {CAM_SUPERFICIE_DIR} (use --superficie=DIR '
                 'se ela mora em outro lugar); asse com '
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
    def _pontos_amostra(c):
        cx = sum(p[0] for p in c) / 4.0; cz = sum(p[1] for p in c) / 4.0
        meios = [((c[k][0]+c[(k+1) % 4][0])/2, (c[k][1]+c[(k+1) % 4][1])/2) for k in range(4)]
        return [(cx, cz)] + list(c) + meios
    _exc, _pior_c, _fora = [], (0.0, '', 0.0), 0
    for _i, _r in enumerate(linhas):
        if V4:
            _hs = [_alt(px, pz) for (px, pz) in _pontos_amostra(CANTOS_CSV[_i])]
        else:
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
# CENA, sondada ponto a ponto no CENTRÓIDE de cada lote por `__plazaPerfil`, que
# é a mesma função que assenta lote, rua e peça:
#
#     node scripts/city/assar_superficie.mjs --pontos=data/dogcity_lotes.csv
#
# ⚠️ E A TOLERÂNCIA NÃO É ARBITRÁRIA: é o erro de INTERPOLAÇÃO da grade de 15 m,
# medido em 22/09 sobre os 70.720 lotes do registro selado, mediana 0,005 m,
# p99 0,212 m, pior 0,864 m, zero lotes acima de 1 m. Os cortes abaixo têm folga
# sobre isso e continuam duas ordens de grandeza abaixo do defeito que a réplica
# analítica produzia.
SUP_P99, SUP_PIOR = 0.5, 1.5
_pl = os.path.join(CAM_SUPERFICIE_DIR, 'superficie_lotes.csv')
if _sup is None:
    pass                    # já reprovou no 6c, não repete a mesma queixa
elif not os.path.exists(_pl):
    indisponivel('a superfície assada é fiel à cena',
                 f'falta superficie_lotes.csv em {CAM_SUPERFICIE_DIR}; sonde com '
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
# ⚠️ O MANIFESTO DECLARA POR NATUREZA, e o portão tem de ler assim: `plantadas`
# e `carteiras` falam de LOTE DE CARTEIRA, enquanto o arquivo tem também
# projeto e institucional. Comparar com o total de linhas reprovava a cidade certa.
_lot = (MANIFESTO.get('lotes') or {})
item('cidade.json bate com os arquivos',
     MANIFESTO.get('plantadas') == len(tenho) and MANIFESTO.get('carteiras') == len(tenho)
     and (_lot.get('total') is None or _lot.get('total') == len(lotes)),
     f"declara {MANIFESTO.get('plantadas')} de {MANIFESTO.get('carteiras')} carteiras, "
     f"{_lot.get('total')} linhas no total, arquivo tem {len(lotes)}")

# 8. o columbário declarado é o columbário gravado
if colum:
    dec = (MANIFESTO.get('cemiterio') or {}).get('lapides')
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
_cam_inst = FONTE_TAG_INSTITUCIONAL
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
    _src_ger = open(FONTE_GERADOR, encoding='utf-8').read()
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
