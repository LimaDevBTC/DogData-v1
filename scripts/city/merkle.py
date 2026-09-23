#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# O MERKLE ROOT DO REGISTRO DA DOGCITY
#
# ⚠️ POR QUE ISTO EXISTE. O masterplan §3 promete reprodutibilidade e a fase 4
# do plano de mint manda inscrever um Ordinal-pai (o Charter) com o merkle root
# do registro. Até 22/09/2026 o root NÃO EXISTIA: o que havia era o sha256
# plano do artefato (`congelar-mapa.ts`), que prova que o arquivo não mudou mas
# não deixa NINGUÉM provar que UMA carteira está lá dentro sem baixar tudo.
#
# A diferença importa no dia do mint: com o root na cadeia, o serviço que
# inscreve o título pode ser auditado por terceiro com 17 hashes, e o holder
# pode conferir o próprio lote sem confiar em nós.
#
# ── DOIS FORMATOS DE FOLHA, E O SCRIPT ESCOLHE PELO CSV (masterplan §41) ────
# O lote deixou de ser retângulo (x, z, frente, prof, giro) e virou 4 cantos
# explícitos. Quando `data/dogcity_lotes.csv` já tem as colunas `p0x_m ...
# p3z_m, geo` (a rodada v4), a folha muda de forma e a versão do cabeçalho
# sobe de 2 para 3. Enquanto essas colunas não existirem (a rodada v3, ainda
# publicada), o script sela EXATAMENTE como sempre selou: folha versão 2,
# cabeçalho `H|2|...`. Nenhuma opção liga isto; é o arquivo em disco que decide,
# porque o bot de auto-commit publica a árvore de hora em hora e não pode
# escolher versão nenhuma.
#
#   registro v3 (retângulo), folha versão 2:
#     L|lot_id|address|x_cm|z_cm|frente_cm|prof_cm|giro_cc|area_m2|cota_cm|forma
#   registro v4 (4 cantos), folha versão 3:
#     L|lot_id|address|p0x_cm|p0z_cm|p1x_cm|p1z_cm|p2x_cm|p2z_cm|p3x_cm|p3z_cm|
#     area_m2|cota_cm|forma|geo
#
#   cabeçalho, sempre: H|versao|bloco|n_folhas|artefato=sha256|...
#   lápide, sempre:    M|address
#
# ⚠️ EM CENTÍMETROS E INTEIROS, NUNCA EM PONTO FLUTUANTE. Texto de float muda de
# forma entre linguagens ("-0.0", "1e-05", 17 dígitos contra 15) e o root mudaria
# sem a cidade mudar. Tudo vira inteiro antes de virar bytes.
#
# ⚠️ O .bin NÃO ENTRA NA FOLHA DO LOTE, mas entra no CABEÇALHO. Ele é a cópia
# quantizada (quartos de metro) que a cena desenha; o registro de direito é o
# CSV, e é o CSV que o portão confere contra o .bin. O cabeçalho amarra os
# QUATRO artefatos (CSV, cemitério, .bin, cidade.json) pelo sha256, então
# selar só o CSV daria um root que não prova o desenho publicado.
#
# ⚠️ GEO=3 (RETÂNGULO LEGADO) NÃO SE SELA NA RODADA REAL. É o que sobra de um
# CSV que passou pelo conversor de transição (`v4_de_v3.py`) sem o gerador novo
# ter rodado; selar isso publicaria direito que o próprio §41 chama de "só o
# que não foi convertido". A flag `--aceita-legado` existe SÓ para testar a
# cadeia (merkle → escrituras → lookup → portão) contra o dado de teste, nunca
# para uma rodada que vai virar Charter.
#
# ── a ordem, que é parte da prova ──────────────────────────────────────────
# As folhas L e M são ordenadas por `address` e, no empate (uma carteira nunca
# tem dois destinos, mas lote do projeto não tem carteira), por `lot_id`.
# Ordenar por posição na fila amarraria o root à ordem de chegada, que é um dado
# que já está dentro da folha.
#
# ⚠️ O CABEÇALHO FICA FORA DA ORDENAÇÃO e é inserido no índice 0 depois dela.
# Ele não tem endereço, então participar do `sort` o jogaria para o começo por
# acidente e não por regra, e qualquer mudança na chave o moveria.
#
# ── a árvore ───────────────────────────────────────────────────────────────
# sha256 duplo, como no Bitcoin. Nível ímpar duplica o último nó, também como no
# Bitcoin. É a construção que qualquer auditor já sabe verificar.
#
#   python3 scripts/city/merkle.py [--cidade=DIR] [--csv=ARQ] [--cemiterio=ARQ]
#                                  [--bin=ARQ] [--cidade-json=ARQ] [--saida=DIR]
#                                  [--aceita-legado] [--prova=endereço]
#
#   --cidade=DIR     BASE para todos os quatro artefatos e para a saída, como
#                     sempre foi (padrão: a raiz do repositório).
#   --csv=/--cemiterio=/--bin=/--cidade-json=/--saida=
#                     sobrepõe UM caminho por vez, relativo à raiz do
#                     repositório (ou absoluto). É como se aponta para
#                     `public/city/_v4teste/` sem mudar mais nada: os outros
#                     três artefatos continuam saindo de `--cidade=` (ou da
#                     raiz, se `--cidade=` também não foi dado).
# ═══════════════════════════════════════════════════════════════════════════
import csv, hashlib, json, os, sys

arg = lambda k, d=None: next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{k}=')), d)
flag = lambda k: f'--{k}' in sys.argv[1:]
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = arg('cidade', RAIZ)
p = lambda *a: os.path.join(BASE, *a)


def caminho(nome_canonico, override):
    """Sem override, o de sempre: BASE (--cidade=) + o nome canônico. Com
    override (--csv=, --bin=, ...), o caminho é relativo À RAIZ DO REPOSITÓRIO
    (ou absoluto), nunca a BASE: é assim que dá para apontar um artefato só
    para a pasta de teste sem arrastar os outros três."""
    if override:
        return override if os.path.isabs(override) else os.path.join(RAIZ, override)
    return p(nome_canonico)


def d256(b):
    return hashlib.sha256(hashlib.sha256(b).digest()).digest()


cm = lambda v: int(round(float(v) * 100))

# ⚠️ O BLOCO MORA AQUI, E EM UM LUGAR SÓ. A versão da folha (VERSAO) não é mais
# uma constante: ela sai do formato do CSV em disco (ver V4 abaixo), porque
# selar a rodada errada com o número da rodada certa seria pior que não selar.
BLOCO = 966670
ACEITA_LEGADO = flag('aceita-legado')

CAM_CSV = caminho('data/dogcity_lotes.csv', arg('csv'))
CAM_CEM = caminho('data/dogcity_cemiterio.csv', arg('cemiterio'))
CAM_CIDADE_JSON = caminho('public/city/cidade.json', arg('cidade-json'))

# a mesma escada do gerador (`forma_de`, scripts/gerar_cidade.py): 0 massa única,
# 1 pátio, 2 condomínio baixo, 3 torre, 4 quarteirão com várias torres
forma_de = lambda u: 0 if u <= 1 else 1 if u <= 3 else 2 if u <= 9 else 3 if u <= 99 else 4

if not os.path.exists(CAM_CSV):
    sys.exit(f'merkle: {CAM_CSV} não existe. A cidade foi gerada?')
with open(CAM_CSV, newline='') as _f:
    _leitor = csv.DictReader(_f)
    _campos = _leitor.fieldnames or []
    # ⚠️ A DETECÇÃO É PELO ARQUIVO, NUNCA POR OPÇÃO. `p0x_m` e `geo` só existem
    # no CSV depois que `scripts/gerar_cidade.py` (ou, em teste, `v4_de_v3.py`)
    # os escreveu; a presença deles é o único sinal que não pode mentir.
    V4 = 'p0x_m' in _campos and 'geo' in _campos
    linhas_csv = list(_leitor)
VERSAO = 3 if V4 else 2
NOME_BIN = 'public/city/cidade-lotes-v4.bin' if V4 else 'public/city/cidade-lotes.bin'
CAM_BIN = caminho(NOME_BIN, arg('bin'))

# ⚠️ ZERO É UMA TIPOLOGIA DE VERDADE, NÃO UM CAMPO VAZIO. `forma=0` quer dizer
# "massa única, casa no centro", e 48.357 lotes de uma UTXO só são zero com toda
# a razão. O que NÃO pode existir é lote de carteira com `dog=0` ou
# `utxo_count=0`: carteira que está no snapshot tem saldo e tem UTXO, e zero ali
# é o gerador não tendo achado o dado. Foi o que aconteceu em 22/09 com os 21
# lotes do Distrito Financeiro, que saíram do registro com dog, utxo_count e
# forma zerados: a Gate.io tem 3,03B DOG e 20.008 UTXOs no bloco, ou seja forma
# 4, e o registro selado afirmava forma 0. Como a tipologia é CONGELADA
# (masterplan §2) e trava o catálogo de prédio do dono (§4.1), selar isso é
# selar direito errado, e o root não desfaz. Aqui a rodada MORRE antes de
# escrever qualquer coisa, com contador por motivo.
recusa = {'CSV sem coluna forma legível': [],
          'forma fora da faixa 0 a 4': [],
          'lote do projeto com tipologia (projeto não tem dono)': [],
          'lote de carteira com dog ou utxo_count zerado': [],
          'forma divergente do utxo_count da própria linha': []}
if V4:
    recusa['CSV v4 sem coluna geo legível'] = []
    recusa['geo fora da faixa 0 a 3'] = []
    # ⚠️ ESTA É A TRAVA DO §41: "o portão reprova se sobrar" retângulo legado.
    # `--aceita-legado` é a única porta, e só serve para testar a cadeia contra
    # `v4_de_v3.py`, nunca para uma rodada que vira Charter.
    recusa['geo=3 (retângulo legado); use --aceita-legado só para testar a cadeia'] = []

folhas = []
for r in linhas_csv:
    giro = r.get('giro_graus')
    projeto = r['address'].startswith('__projeto')
    try:
        forma = int(r['forma'])
    except (KeyError, TypeError, ValueError):
        # a rodada já vai morrer lá embaixo; não montar folha com campo inventado
        recusa['CSV sem coluna forma legível'].append(r['lot_id'])
        continue
    if forma not in (0, 1, 2, 3, 4):
        recusa['forma fora da faixa 0 a 4'].append(r['lot_id'])
    elif projeto:
        if forma:
            recusa['lote do projeto com tipologia (projeto não tem dono)'].append(r['lot_id'])
    else:
        u = int(float(r.get('utxo_count') or 0))
        if u < 1 or float(r.get('dog') or 0) <= 0:
            recusa['lote de carteira com dog ou utxo_count zerado'].append(r['lot_id'])
        elif forma != forma_de(u):
            recusa['forma divergente do utxo_count da própria linha'].append(r['lot_id'])

    if V4:
        try:
            geo = int(r['geo'])
            cantos_cm = [cm(r[f'p{k}{eixo}_m']) for k in range(4) for eixo in ('x', 'z')]
        except (KeyError, TypeError, ValueError):
            recusa['CSV v4 sem coluna geo legível'].append(r['lot_id'])
            continue
        if geo not in (0, 1, 2, 3):
            recusa['geo fora da faixa 0 a 3'].append(r['lot_id'])
        elif geo == 3 and not ACEITA_LEGADO:
            recusa['geo=3 (retângulo legado); use --aceita-legado só para testar a cadeia'].append(r['lot_id'])
        campos = [r['lot_id'], r['address']] + [str(v) for v in cantos_cm] + [
            str(int(round(float(r['area_m2'])))), str(cm(r['cota_m'])), str(forma), str(geo)]
        folha_txt = 'L|' + '|'.join(campos)
    else:
        folha_txt = 'L|%s|%s|%d|%d|%d|%d|%d|%d|%d|%d' % (
            r['lot_id'], r['address'], cm(r['x_m']), cm(r['z_m']),
            cm(r['frente_m']), cm(r['prof_m']),
            int(round(float(giro) * 100)) if giro not in (None, '') else -1,
            int(round(float(r['area_m2']))), cm(r['cota_m']), forma)
    folhas.append((r['address'], r['lot_id'], folha_txt))

if any(recusa.values()):
    print('merkle: o registro NÃO pode ser selado, e nada foi gravado.', file=sys.stderr)
    for motivo, ids in recusa.items():
        if ids:
            print('  %6d  %s  (ex.: %s)' % (len(ids), motivo, ', '.join(ids[:3])), file=sys.stderr)
    sys.exit('merkle: conserte o gerador (ou tire --aceita-legado da linha de comando) e '
             'regere antes de selar. A tipologia e a geometria entram na folha, e folha '
             'errada vira direito errado na cadeia.')

n_lap = 0
if os.path.exists(CAM_CEM):
    with open(CAM_CEM, newline='') as f:
        for r in csv.DictReader(f):
            folhas.append((r['address'], '', 'M|%s' % r['address']))
            n_lap += 1

if not folhas:
    sys.exit('merkle: nenhuma folha. A cidade foi gerada?')

# ⚠️ ORDEM DETERMINÍSTICA, e ela faz parte da prova.
folhas.sort(key=lambda t: (t[0], t[1]))
chaves = [t[0] for t in folhas]
if len(set(chaves)) != len(chaves):
    dup = [a for a in set(chaves) if chaves.count(a) > 1][:3]
    sys.exit(f'merkle: {len(chaves) - len(set(chaves))} endereços com mais de um destino '
             f'(ex.: {dup}). O portão tinha de ter pegado isto. Nada foi gravado.')

# ── A FOLHA DE CABEÇALHO, sempre no índice 0 ───────────────────────────────
#
# ⚠️ O ROOT SOZINHO NÃO DIZ DE QUE CIDADE ELE É. Sem cabeçalho, o registro de
# outro bloco produz um root do mesmo formato e nada DENTRO da árvore distingue
# os dois; e o sha256 dos quatro artefatos vivia só em `dogcity_merkle.json`,
# que NÃO vai para a cadeia, ou seja o `.bin` que a cena desenha ficava sem
# lastro on chain. Com o cabeçalho, o Charter inscreve o root e mais nada, e o
# .bin continua provado.
#
# ⚠️ ELE TAMBÉM FECHA A AMBIGUIDADE DO NÓ DUPLICADO da construção do Bitcoin
# (CVE-2012-2459), porque passa a existir uma contagem de folhas DENTRO da
# árvore.
#
# ⚠️ ELE NÃO ENTRA NA ORDENAÇÃO, e isso é de propósito: a ordenação por
# (address, lot_id) já aconteceu acima, e o cabeçalho é enfiado no índice 0
# depois. `chaves` recebe a string vazia no mesmo índice para não desalinhar o
# `--prova`; nenhum endereço é vazio (os do projeto começam com `__projeto`).
ARTEFATOS = (('data/dogcity_lotes.csv', CAM_CSV),
             ('data/dogcity_cemiterio.csv', CAM_CEM),
             (NOME_BIN, CAM_BIN),
             ('public/city/cidade.json', CAM_CIDADE_JSON))
selos, faltam = {}, []
for nome, cam in ARTEFATOS:
    if os.path.exists(cam):
        selos[nome] = hashlib.sha256(open(cam, 'rb').read()).hexdigest()
    else:
        faltam.append(nome)
# ⚠️ ARTEFATO QUE FALTA DERRUBA A RODADA. O cabeçalho é justamente a amarra
# entre root e arquivo: selar um '-' no lugar do sha256 do .bin publicaria um
# root que afirma "esta cidade não tem desenho", em silêncio.
if faltam:
    sys.exit('merkle: faltam %d dos quatro artefatos (%s). O cabeçalho amarra o root '
              'a eles, então nada foi gravado.' % (len(faltam), ', '.join(faltam)))

cabecalho = 'H|%d|%d|%d|%s' % (
    VERSAO, BLOCO, len(folhas) + 1,
    '|'.join('%s=%s' % (n, selos[n]) for n, _ in ARTEFATOS))
folhas.insert(0, ('', '', cabecalho))
chaves.insert(0, '')

nivel = [d256(t[2].encode('utf-8')) for t in folhas]
alturas = [len(nivel)]
while len(nivel) > 1:
    if len(nivel) % 2: nivel.append(nivel[-1])      # duplica o último, como no Bitcoin
    nivel = [d256(nivel[i] + nivel[i + 1]) for i in range(0, len(nivel), 2)]
    alturas.append(len(nivel))
root = nivel[0]

FOLHA_DOC = (
    'H|versao|bloco|n_folhas|artefato=sha256|... no índice 0; depois  '
    'L|lot_id|address|p0x_cm|p0z_cm|p1x_cm|p1z_cm|p2x_cm|p2z_cm|p3x_cm|p3z_cm|'
    'area_m2|cota_cm|forma|geo  ou  M|address; as folhas L e M ordenadas por '
    '(address, lot_id). O distrito não é campo: ele é o prefixo S do lot_id.'
    if V4 else
    'H|versao|bloco|n_folhas|artefato=sha256|... no índice 0; depois  '
    'L|lot_id|address|x_cm|z_cm|frente_cm|prof_cm|giro_cc|area_m2|cota_cm|forma  '
    'ou  M|address; as folhas L e M ordenadas por (address, lot_id). '
    'O distrito não é campo: ele é o prefixo S do lot_id.'
)
saida = {
    'versao': VERSAO,
    'registro': 'v4 (4 cantos)' if V4 else 'v3 (retângulo)',
    'algoritmo': 'sha256 duplo, nível ímpar duplica o último (construção do Bitcoin)',
    'folha': FOLHA_DOC,
    'bloco': BLOCO,
    'folhas': len(folhas),
    'cabecalho': cabecalho,
    'lotes': len(folhas) - n_lap - 1,
    'lapides': n_lap,
    'root': root.hex(),
    'niveis': alturas,
    'selos': selos,
}
SAIDA_DIR = caminho('data', arg('saida'))
os.makedirs(SAIDA_DIR, exist_ok=True)
dest = os.path.join(SAIDA_DIR, 'dogcity_merkle.json')
json.dump(saida, open(dest, 'w'), indent=2, ensure_ascii=False)

# ⚠️ AS FOLHAS TAMBÉM VÃO PARA DISCO, e sem elas o root é inútil para terceiro:
# é a lista de folhas que deixa QUALQUER UM recomputar a árvore e extrair a
# prova de inclusão de um endereço sem pedir nada ao projeto.
with open(os.path.join(SAIDA_DIR, 'dogcity_merkle_folhas.txt'), 'w') as f:
    for _, _, folha in folhas:
        f.write(folha + '\n')

# ⚠️ A PROVA DE INCLUSÃO, e ela é o ponto inteiro do merkle. `--prova=<endereço>`
# devolve os hashes que ligam a folha daquela carteira ao root. Quem tem o
# root da cadeia e esta prova confere o próprio lote sem baixar a cidade e sem
# confiar no projeto. O arquivo de provas pronto não é gravado de propósito:
# dezenas de milhares de provas dariam megabytes para um dado que se recomputa
# em segundos a partir das folhas.
alvo = arg('prova')
if alvo:
    try:
        idx = chaves.index(alvo)
    except ValueError:
        sys.exit(f'merkle: {alvo} não está no registro do bloco 966.670.')
    cam, i, n = [], idx, [d256(t[2].encode('utf-8')) for t in folhas]
    while len(n) > 1:
        if len(n) % 2: n.append(n[-1])
        irmao = i ^ 1
        cam.append({'lado': 'dir' if irmao > i else 'esq', 'hash': n[irmao].hex()})
        n = [d256(n[k] + n[k + 1]) for k in range(0, len(n), 2)]
        i //= 2
    conf = d256(folhas[idx][2].encode('utf-8'))
    for passo in cam:
        h = bytes.fromhex(passo['hash'])
        conf = d256(conf + h) if passo['lado'] == 'dir' else d256(h + conf)
    print(json.dumps({'address': alvo, 'folha': folhas[idx][2], 'indice': idx,
                      'caminho': cam, 'root': root.hex(),
                      'confere': conf.hex() == root.hex()}, indent=2, ensure_ascii=False))
    sys.exit(0 if conf == root else 1)

print('merkle root (versão %d, registro %s): %s' % (VERSAO, 'v4' if V4 else 'v3', root.hex()), file=sys.stderr)
print('  %d folhas (1 cabeçalho, %d lotes, %d lápides), %d níveis'
      % (len(folhas), len(folhas) - n_lap - 1, n_lap, len(alturas)), file=sys.stderr)
print('  cabeçalho: %s' % cabecalho, file=sys.stderr)
print('  gravado %s e %s' % (dest, os.path.join(SAIDA_DIR, 'dogcity_merkle_folhas.txt')), file=sys.stderr)
if V4 and ACEITA_LEGADO:
    print('  ⚠️  --aceita-legado estava ligado: geo=3 foi selado. NÃO é uma rodada real.', file=sys.stderr)
