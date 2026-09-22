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
# ── o que entra na folha, e por que exatamente isto ────────────────────────
# A folha é o DIREITO, não o desenho. Entra o que o título vai afirmar:
#
#   lote:   L|lot_id|address|x_cm|z_cm|frente_cm|prof_cm|giro_cc|area_m2|cota_cm
#   lápide: M|address
#
# ⚠️ EM CENTÍMETROS E INTEIROS, NUNCA EM PONTO FLUTUANTE. Texto de float muda de
# forma entre linguagens ("-0.0", "1e-05", 17 dígitos contra 15) e o root mudaria
# sem a cidade mudar. Tudo vira inteiro antes de virar bytes.
#
# ⚠️ O .bin NÃO ENTRA. Ele é a cópia quantizada em quartos de metro que a cena
# desenha; o registro de direito é o CSV, e é o CSV que o portão confere contra
# o .bin. Selar os dois daria dois roots para uma cidade só.
#
# ── a ordem, que é parte da prova ──────────────────────────────────────────
# As folhas são ordenadas por `address` e, no empate (uma carteira nunca tem
# dois destinos, mas lote do projeto não tem carteira), por `lot_id`. Ordenar
# por posição na fila amarraria o root à ordem de chegada, que é um dado que já
# está dentro da folha.
#
# ── a árvore ───────────────────────────────────────────────────────────────
# sha256 duplo, como no Bitcoin. Nível ímpar duplica o último nó, também como no
# Bitcoin. É a construção que qualquer auditor já sabe verificar.
#
#   python3 scripts/city/merkle.py --cidade=/caminho/da/cidade
# ═══════════════════════════════════════════════════════════════════════════
import csv, hashlib, json, os, sys

arg = lambda k, d=None: next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{k}=')), d)
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = arg('cidade', RAIZ)
p = lambda *a: os.path.join(BASE, *a)

def d256(b):
    return hashlib.sha256(hashlib.sha256(b).digest()).digest()

cm = lambda v: int(round(float(v) * 100))

folhas = []
with open(p('data/dogcity_lotes.csv'), newline='') as f:
    for r in csv.DictReader(f):
        giro = r.get('giro_graus')
        folhas.append((r['address'], r['lot_id'], 'L|%s|%s|%d|%d|%d|%d|%d|%d|%d' % (
            r['lot_id'], r['address'], cm(r['x_m']), cm(r['z_m']),
            cm(r['frente_m']), cm(r['prof_m']),
            int(round(float(giro) * 100)) if giro not in (None, '') else -1,
            int(round(float(r['area_m2']))), cm(r['cota_m']))))

cam_cem = p('data/dogcity_cemiterio.csv')
n_lap = 0
if os.path.exists(cam_cem):
    with open(cam_cem, newline='') as f:
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

nivel = [d256(t[2].encode('utf-8')) for t in folhas]
alturas = [len(nivel)]
while len(nivel) > 1:
    if len(nivel) % 2: nivel.append(nivel[-1])      # duplica o último, como no Bitcoin
    nivel = [d256(nivel[i] + nivel[i + 1]) for i in range(0, len(nivel), 2)]
    alturas.append(len(nivel))
root = nivel[0]

# o selo dos arquivos que produziram este root, para amarrar root a artefato
selos = {}
for nome in ('data/dogcity_lotes.csv', 'data/dogcity_cemiterio.csv',
             'public/city/cidade-lotes.bin', 'public/city/cidade.json'):
    cam = p(nome)
    if os.path.exists(cam):
        selos[nome] = hashlib.sha256(open(cam, 'rb').read()).hexdigest()

saida = {
    'versao': 1,
    'algoritmo': 'sha256 duplo, nível ímpar duplica o último (construção do Bitcoin)',
    'folha': 'L|lot_id|address|x_cm|z_cm|frente_cm|prof_cm|giro_cc|area_m2|cota_cm  '
             'ou  M|address; ordenadas por (address, lot_id)',
    'bloco': 966670,
    'folhas': len(folhas),
    'lotes': len(folhas) - n_lap,
    'lapides': n_lap,
    'root': root.hex(),
    'niveis': alturas,
    'selos': selos,
}
dest = p('data/dogcity_merkle.json')
os.makedirs(os.path.dirname(dest), exist_ok=True)
json.dump(saida, open(dest, 'w'), indent=2, ensure_ascii=False)

# ⚠️ AS FOLHAS TAMBÉM VÃO PARA DISCO, e sem elas o root é inútil para terceiro:
# é a lista de folhas que deixa QUALQUER UM recomputar a árvore e extrair a
# prova de inclusão de um endereço sem pedir nada ao projeto.
with open(p('data/dogcity_merkle_folhas.txt'), 'w') as f:
    for _, _, folha in folhas:
        f.write(folha + '\n')

# ⚠️ A PROVA DE INCLUSÃO, e ela é o ponto inteiro do merkle. `--prova=<endereço>`
# devolve os 17 hashes que ligam a folha daquela carteira ao root. Quem tem o
# root da cadeia e esta prova confere o próprio lote sem baixar a cidade e sem
# confiar no projeto. O arquivo de provas pronto não é gravado de propósito:
# 87 mil provas de 17 hashes dariam 47 MB para um dado que se recomputa em
# segundos a partir das folhas.
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

print('merkle root: %s' % root.hex(), file=sys.stderr)
print('  %d folhas (%d lotes, %d lápides), %d níveis'
      % (len(folhas), len(folhas) - n_lap, n_lap, len(alturas)), file=sys.stderr)
print('  gravado data/dogcity_merkle.json e data/dogcity_merkle_folhas.txt', file=sys.stderr)
