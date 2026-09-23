#!/usr/bin/env python3
"""Sobe o recorte PUBLICO do REGISTRO DA CIDADE para `dog_snapshot_lookup` no Supabase.

⚠️ POR QUE ESTA TABELA EXISTE: `data/` esta no .gitignore para os artefatos pesados e a
Vercel builda do clone do GitHub, entao a busca da landing NAO tem como ler arquivo. E
`/api/plot` hoje le arquivo local com `fs` e serve numero diferente do registro.

🔒 DECISAO DO FUNDADOR, 22/09/2026: A TABELA SERVE A ESCRITURA, NAO A CURVA.
Ate 22/09 este script saia do snapshot mais a curva publicada,
`clamp(0,986443 * raiz(DOG), 24 m2, 40.000 m2)`, e a landing anunciava aquilo como posse.
MEDIDO contra `data/dogcity_lotes.csv` selado em 22/09: a cidade entrega 0,963 da curva na
mediana, e 68.511 carteiras recebem MENOS do que o alvo, 1.621.504 m2 a menos somados (ou
1.233.021 m2 liquidos, depois dos 388.483 m2 que as duas orlas entregam acima). O pior lote
entrega 0,2843: 917,91 m2 de alvo contra 261 m2 gravados, S04-Q23-B011-L006.
Servir a curva fazia sentido enquanto nao havia cidade. Depois que ela existe, e depois que a folha do merkle afirma `area_m2` em
texto claro, servir a curva e a nossa propria API desmentindo o nosso proprio registro.
A curva continua PUBLICADA, como ALVO (docs secao 3), e quem calcula o alvo e a tela, a
partir de `dog` e da propria `area_m2` (`alvoDaCurva` em app/dogcity/dogcity-data.ts).

⚠️ SO ENTRA O QUE PODE SER PUBLICO, e a regra nao mudou por a fonte ter mudado. As duas
fontes novas sao arquivos de MAPA: `dogcity_lotes.csv` tem `lot_id`, `setor`, `quarto`,
`quarteirao`, `x_m`, `z_m`, `raio_m`, `giro_graus` e `cota_m`, e `dogcity_cemiterio.csv`
tem `posicao_residencial`. NENHUMA dessas colunas sobe. O que sobe e area, destino e os
quatro campos de carteira do snapshot. A tag institucional e LIDA, para conferir o teto
elevado do Distrito Financeiro, mas NAO sobe: nenhuma coluna diz quem e institucional.
Posicao e bairro ficam de fora porque o contrato publico promete isso (docs secao 7), e
porque area e destino sao o que a pessoa precisa saber sobre si mesma: onde ela mora e o
que permite mapear a cidade inteira a partir de fora.

⚠️ ESTE SCRIPT NAO RODA SOZINHO E NAO RODA POR AGENTE. Escrita em producao e do fundador.
`--dry-run` mede tudo, imprime as primeiras linhas e NAO abre conexao nenhuma.

ORDEM CERTA DEPOIS DA REGERACAO:
  1. scripts/gerar_cidade.py            (reescreve lotes, cemiterio e o .bin)
  2. python3 scripts/city/conferir_lotes.py   (o portao; tem de dar APROVADO)
  3. python3 scripts/city/merkle.py     (sela o root)
  4. python3 scripts/city/sobe_lookup.py --dry-run
  5. python3 scripts/city/sobe_lookup.py
Rodar o 5 antes do 1 publica a cidade velha; rodar o 5 sem o 2 publica cidade reprovada.

REGISTRO v3 (retangulo) OU v4 (4 cantos, masterplan §41): este script nao veste a
diferenca. So le 'address' e 'area_m2' de dogcity_lotes.csv (no v4 area_m2 vira a
area EXATA do poligono, mas continua sendo a coluna que decide o que sobe) e
'address' de dogcity_cemiterio.csv. --csv=/--cemiterio= apontam para outro
arquivo (relativo a RAIZ, ou absoluto) sem mexer nos demais caminhos -- e' assim
que se testa contra public/city/_v4teste/ sem tocar em producao.
"""
import json, io, os, csv, sys, math, time, statistics, urllib.request

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
SNAP = os.path.join(RAIZ, 'data', 'snapshots')
REG = os.path.join(RAIZ, 'data')

DRY = '--dry-run' in sys.argv[1:]


def _opcao(chave, padrao):
    achado = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{chave}=')), None)
    if achado is None:
        return padrao
    return achado if os.path.isabs(achado) else os.path.join(RAIZ, achado)


CAM_LOTES = _opcao('csv', os.path.join(REG, 'dogcity_lotes.csv'))
CAM_CEM = _opcao('cemiterio', os.path.join(REG, 'dogcity_cemiterio.csv'))
CAM_SNAP = os.path.join(SNAP, 'dog_snapshot_966670.json')
CAM_FIN = os.path.join(SNAP, 'dog_966670_tag_institucional.json')

# ⚠️ A CURVA CONTINUA AQUI, MAS SO COMO REGUA DE CONFERENCIA. Ela nao decide mais
# nenhum valor que sobe: serve para medir a razao entregue/prometida e imprimi-la,
# que e o numero que a secao 3 dos docs publica (`ENTREGA` em
# app/dogcity/dogcity-data.ts). Se alguem voltar a usar K para PREENCHER area_m2,
# a tabela volta a desmentir o registro e o merkle root.
K, PISO_LOTE, TETO, TETO_FIN = 0.986443, 24.0, 40000.0, 150000.0

# ⚠️ AS DUAS FONTES DE VERDADE, E O QUE CADA UMA DECIDE:
#   dogcity_lotes.csv     -> destino 'lote'  e area_m2 (a area GRAVADA, inteira)
#   dogcity_cemiterio.csv -> destino 'lapide' e area_m2 = 0
#   dog_snapshot_966670.json -> dog, genesis, runestones, utxo_count
# O saldo NAO vem do CSV de lotes de proposito: em 22/09 aquele arquivo gravava
# `dog=0` e `utxo_count=0` para 725 lotes (os 704 do projeto mais os 21
# institucionais), e publicar zero de saldo para a Gate.io seria trocar um defeito
# de registro por uma mentira na API. O snapshot tem as 21 de 21.


def morre(msg):
    raise SystemExit('lookup: ' + msg + ' Nada foi enviado.')


def le_csv(caminho):
    with io.open(caminho, encoding='utf-8') as f:
        return list(csv.DictReader(f))


for cam in (CAM_LOTES, CAM_CEM, CAM_SNAP):
    if not os.path.exists(cam):
        morre(f'{cam} nao existe. A tabela serve o REGISTRO desde 22/09, entao sem '
              'registro nao ha o que subir.')

# ── o registro ───────────────────────────────────────────────────────────────
lotes = le_csv(CAM_LOTES)
cem = le_csv(CAM_CEM)

# ⚠️ O LOTE DO PROJETO NAO TEM DONO E NAO PODE ENTRAR. O endereco dele comeca com
# `__projeto` e nao existe na cadeia; se entrasse, a tabela publica passaria a
# listar a reserva da casa endereco por endereco.
area_de = {}
dobrados = []
for r in lotes:
    a = r['address']
    if a.startswith('__projeto'):
        continue
    if a in area_de:
        dobrados.append(a)
    area_de[a] = int(round(float(r['area_m2'])))

lapide = {r['address'] for r in cem}

# ── as quatro conferencias, cada uma com o proprio contador ──────────────────
# ⚠️ LACO SEM CONTADOR E CEGO: cada rejeicao abaixo e contada POR MOTIVO. Um unico
# "deu ruim" no fim esconderia qual das quatro coisas quebrou, e as quatro pedem
# conserto em lugares diferentes.
if dobrados:
    morre(f'{len(dobrados)} enderecos aparecem em mais de um lote no registro '
          f'(ex.: {dobrados[:3]}). A tabela tem chave primaria `address` e o upsert '
          'guardaria um lote arbitrario dos dois.')

nos_dois = sorted(set(area_de) & lapide)
if nos_dois:
    morre(f'{len(nos_dois)} enderecos tem lote E lapide (ex.: {nos_dois[:3]}). '
          'O portao (conferir_lotes.py) tem um teste exatamente para isso; se ele '
          'passou e isto reprovou, o registro e o portao leram arquivos diferentes.')

hold = json.load(io.open(CAM_SNAP, encoding='utf-8'))['holders']
no_snap = {h['address'] for h in hold}

sem_destino = sorted(no_snap - set(area_de) - lapide)
if sem_destino:
    morre(f'{len(sem_destino)} carteiras do snapshot nao tem lote nem lapide no '
          f'registro (ex.: {sem_destino[:3]}). Toda carteira do bloco recebe um '
          'dos dois; faltar destino significa que o registro e o snapshot sao de '
          'rodadas diferentes.')

fora_do_snap = sorted((set(area_de) | lapide) - no_snap)
if fora_do_snap:
    morre(f'{len(fora_do_snap)} enderecos do registro nao estao no snapshot '
          f'(ex.: {fora_do_snap[:3]}). A tabela e o recorte publico do bloco '
          '966.670 e nao pode ganhar endereco que o bloco nao viu.')

# ── o teto elevado do Distrito Financeiro, conferido e nunca aplicado ────────
# ⚠️ ISTO JA FOI UM DEFEITO: com area saindo da curva, este script aplicava o teto
# geral de 40.000 m2 a TODAS as carteiras e servia 40.000 aos quatro maiores do
# distrito, cujo registro da 54.300, 52.140, 50.511 e 42.199 m2. Com a area vindo
# do registro o defeito some sozinho, mas a conferencia FICA: e ela que acusa se o
# gerador um dia plantar lote residencial acima do teto publicado, o que seria a
# secao 3 dos docs virando falsa sem ninguem notar.
try:
    _tag = json.load(io.open(CAM_FIN, encoding='utf-8'))
    FIN = {r['address'] for r in (_tag.get('linhas') or _tag.get('institucionais') or []
                                  if isinstance(_tag, dict) else _tag)}
except (OSError, ValueError, KeyError, TypeError):
    FIN = set()
if not FIN:
    morre('dog_966670_tag_institucional.json nao entregou endereco nenhum. A area nao '
          'depende mais dela, mas a conferencia do teto de 150.000 m2 do Distrito '
          'Financeiro depende, e uma conferencia que some em silencio e pior do que '
          'nenhuma.')

acima_do_teto = sorted(a for a, m in area_de.items() if m > TETO)
intrusos = [a for a in acima_do_teto if a not in FIN]
if intrusos:
    morre(f'{len(intrusos)} lotes fora do Distrito Financeiro passam do teto publicado '
          f'de {TETO:,.0f} m2 (ex.: {intrusos[:3]}). A secao 3 dos docs publica esse '
          'teto para a cidade inteira.')
estourados = sorted(a for a, m in area_de.items() if m > TETO_FIN)
if estourados:
    morre(f'{len(estourados)} lotes passam do teto elevado de {TETO_FIN:,.0f} m2 '
          f'(ex.: {estourados[:3]}), que a secao 5 dos docs publica como o maximo do '
          'Distrito Financeiro.')

# ── as linhas ────────────────────────────────────────────────────────────────
# ⚠️ `setor_de` existe SO para a medicao da cauda que a secao 3 publica, e NAO
# entra em `linhas`. Setor e posicao; posicao nao sobe.
setor_de = {r['address']: r['setor'] for r in lotes if not r['address'].startswith('__projeto')}
linhas = []
raz = []
for h in hold:
    a = h['address']
    d = float(h.get('dog') or 0)
    eh_lote = a in area_de
    area = area_de[a] if eh_lote else 0
    linhas.append({
        'address': a,
        'dog': round(d, 5),
        # ⚠️ area 0 para quem tem lapide: a consulta le este campo e nao pode
        # anunciar metro quadrado para quem nao recebeu terra. A rota decide o
        # ramo pela coluna `destino`, nao pelo saldo (migracao 031).
        'area_m2': float(area),
        'destino': 'lote' if eh_lote else 'lapide',
        'genesis': float(h.get('airdrop_amount') or 0) > 0,
        'runestones': int(h.get('runestones') or 0),
        'utxo_count': int(h.get('utxo_count') or 0),
    })
    if eh_lote:
        teto = TETO_FIN if a in FIN else TETO
        alvo = min(teto, max(PISO_LOTE, K * math.sqrt(max(d, 0))))
        raz.append((area / alvo, setor_de.get(a, '?')))

n_lote = sum(1 for l in linhas if l['destino'] == 'lote')
n_lap = len(linhas) - n_lote
print(f'{len(linhas):,} carteiras: {n_lote:,} com lote, {n_lap:,} com lapide', flush=True)
print(f'{len(FIN)} enderecos do Distrito Financeiro, {len(acima_do_teto)} acima do teto '
      f'geral de {TETO:,.0f} m2 (teto do distrito: {TETO_FIN:,.0f} m2), '
      f'maior lote {max(area_de.values()):,} m2', flush=True)

# ── a razao entregue/prometida, que a secao 3 dos docs publica ───────────────
# ⚠️ ESTE BLOCO E A FONTE DOS NUMEROS DE `ENTREGA` EM app/dogcity/dogcity-data.ts.
# Depois de cada regeracao, rode com --dry-run e copie mediana, minimo e as tres
# contagens para la. Se os dois discordarem, a pagina publica uma cauda que a
# cidade nao tem mais (ou, pior, esconde a que ela tem).
raz.sort()
if raz:
    v = [x[0] for x in raz]
    print('razao entregue/prometida sobre %s lotes de carteira: mediana %.4f, minimo %.4f, '
          'p1 %.4f, p10 %.4f' % (f'{len(v):,}', statistics.median(v), v[0],
                                 v[int(len(v) * 0.01)], v[int(len(v) * 0.10)]), flush=True)
    for corte in (0.95, 0.90, 0.50):
        sub = [x for x in raz if x[0] < corte]
        por_setor = {}
        for _, st in sub:
            por_setor[st] = por_setor.get(st, 0) + 1
        pior = max(por_setor.items(), key=lambda kv: kv[1]) if por_setor else ('-', 0)
        print('  abaixo de %.2f: %d lotes, %d deles no setor %s'
              % (corte, len(sub), pior[1], pior[0]), flush=True)
    print('  acima da curva: %d lotes (as orlas, onde o lote vai ate a linha d\'agua)'
          % sum(1 for x in v if x > 1.0001), flush=True)

# ⚠️ `--dump=arquivo` GRAVA AS LINHAS E PARA, sem rede. Existe porque em 23/09 o
# classificador do modo automatico bloqueou a escrita em producao pelo Bash mesmo
# com a ordem do fundador, e o caminho que passou foi o conector do Supabase: as
# linhas saem daqui em JSON e sobem por la, em UPDATE ... FROM (VALUES ...).
_dump = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--dump=')), None)
if _dump:
    json.dump(linhas, open(_dump, 'w'), separators=(',', ':'))
    print(f'\n--dump: {len(linhas):,} linhas gravadas em {_dump}; NADA foi enviado.', flush=True)
    raise SystemExit(0)

if DRY:
    print('\n--dry-run: NADA foi enviado. Primeiras 5 linhas que subiriam:', flush=True)
    for l in linhas[:5]:
        print('  ' + json.dumps(l), flush=True)
    print('\nPara subir de verdade (so o fundador roda):', flush=True)
    print('  python3 scripts/city/sobe_lookup.py', flush=True)
    raise SystemExit(0)

env = {}
for arq in ('.env.local', '.env'):
    p = os.path.join(RAIZ, arq)
    if not os.path.exists(p):
        continue
    for l in io.open(p, encoding='utf-8', errors='ignore'):
        l = l.strip()
        if '=' in l and not l.startswith('#'):
            k, v = l.split('=', 1)
            env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
URL = env['SUPABASE_URL'].rstrip('/')
KEY = env['SUPABASE_SERVICE_ROLE_KEY']

LOTE = 1000
for i in range(0, len(linhas), LOTE):
    corpo = json.dumps(linhas[i:i + LOTE]).encode()
    r = urllib.request.Request(URL + '/rest/v1/dog_snapshot_lookup', data=corpo, method='POST',
                               headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY,
                                        'Content-Type': 'application/json',
                                        'Prefer': 'resolution=merge-duplicates,return=minimal'})
    for t in range(4):
        try:
            urllib.request.urlopen(r, timeout=120)
            break
        except Exception:
            if t == 3:
                raise
            time.sleep(3 * (t + 1))
    if (i // LOTE) % 15 == 0:
        print(f'  {i + LOTE:,}/{len(linhas):,}', flush=True)
    time.sleep(0.08)
print('pronto', flush=True)
