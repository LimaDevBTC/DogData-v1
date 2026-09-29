#!/usr/bin/env python3
"""O REGISTRO DA CIDADE SAI DO MUNDO (29/09/2026).

Fundador, depois da revisão do mapa: "não quero confusão com versões antigas da cidade,
o que temos agora é o que é". A cidade é a do jogo (`dogcity-mundo`, tag
`cidade-966670-v1`); o palco (`dogcity-palco`, rodada selada em 22/09 e publicada em
23/09) deixou de ser a fonte do registro. Este script lê a planta do Mundo e o arquivo
de tiers e reescreve os dois arquivos de direito, no formato que `merkle.py` e
`sobe_lookup.py` já leem:

  data/dogcity_lotes.csv      registro v4 (4 cantos em metro, geo 0 célula / 1 fatia):
                              um lote por linha, carteira, empresa ou reserva do projeto
  data/dogcity_cemiterio.csv  as lápides (saldo abaixo de 591,95 $DOG), com a posição da
                              pedra no Mundo (x_m, z_m): o cemitério ganhou chão em 29/09
                              no lugar travado em 22/09 (tiersposition.md §3.14), e a grade
                              é de `dogcity-mundo/plano/src/cemiterio.py`
                              (plano/saida/cemiterio.json)

⚠️ O QUE MUDA DE SIGNIFICADO EM RELAÇÃO AO PALCO:
  - `ordem` é a posição na fila única da escada (tier, depois DOG-tempo), a mesma que
    `dogcity-mundo/plano/src/fila_tiers.py` usa; -1 para empresa e reserva do projeto.
  - `setor`, `quarto`, `quarteirao`, `lote` saem do próprio lot_id do Mundo
    (S<setor>-Q<quarto>-B<quarteirão>-L<lote>); no Mundo o B tem 4 dígitos.
  - `frente_m` é a aresta da frente (p0 p1), `prof_m` a média dos dois lados, `giro_graus`
    o rumo da frente (0 = norte, 90 = leste), `x_m z_m` o centro dos 4 cantos.
  - `coorte`, `familia`, `dsc` eram do palco e saem 0 (não entram no merkle).

  python3 scripts/city/registro_do_mundo.py [--mundo=DIR]
"""
import csv, json, math, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
arg = lambda k, d=None: next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{k}=')), d)
MUNDO = arg('mundo', '/home/bitmax/Projects/bitcoin-fullstack/dogcity-mundo')
# FONTE, e ela mora so' na arvore principal (data/snapshots/ esta' no .gitignore)
TIERS = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/data/snapshots/dog_966670_tiers.json'
CORTE = 591.95   # o saldo que paga o piso de 24 m2 (masterplan §17): abaixo disso, lápide
ESCADA = ('satoshi_visionary', 'btc_maximalist', 'rune_master', 'ordinal_believer',
          'dog_legend', 'diamond_paws', 'dog_soldier', 'hodl_hero', 'steady_holder',
          'profit_taker', 'early_exit', 'panic_seller', 'paper_hands')
RANK = {t: i for i, t in enumerate(ESCADA)}

lotes = json.load(open(os.path.join(MUNDO, 'plano', 'saida', 'lotes.json')))['lotes']
carteiras = json.load(open(TIERS))['carteiras']
por_end = {c['address']: c for c in carteiras}
fila = sorted((c for c in carteiras if c.get('grupo') != 'empresa' and c.get('tier') in RANK),
              key=lambda c: (RANK[c['tier']], c.get('posicao') or 10 ** 9, c['address']))
ordem = {c['address']: i for i, c in enumerate(fila)}


def area4(C):
    return abs(sum(C[i][0] * C[(i + 1) % 4][1] - C[(i + 1) % 4][0] * C[i][1] for i in range(4))) / 2.0


def rumo(dx, dz):
    return math.degrees(math.atan2(dx, -dz)) % 360.0


recusa = {'lot_id fora do padrao S-Q-B-L': [], 'endereco com dois lotes': [],
          'carteira com lote abaixo do corte': [], 'endereco fora do snapshot': []}
vistos = set()
linhas = []
for l in lotes:
    a, lid, C = l['address'], l['lot_id'], l['cantos']
    try:
        s, q, b, n = (int(p[1:]) for p in lid.split('-'))
    except ValueError:
        recusa['lot_id fora do padrao S-Q-B-L'].append(lid)
        continue
    if a in vistos:
        recusa['endereco com dois lotes'].append(a)
    vistos.add(a)
    projeto = a.startswith('__projeto')
    if not projeto:
        c = por_end.get(a)
        if c is None:
            recusa['endereco fora do snapshot'].append(a)
        elif float(c['dog']) < CORTE:
            recusa['carteira com lote abaixo do corte'].append(a)
    cx = sum(p[0] for p in C) / 4.0
    cz = sum(p[1] for p in C) / 4.0
    frente = math.dist(C[0], C[1])
    prof = (math.dist(C[1], C[2]) + math.dist(C[3], C[0])) / 2.0
    linhas.append([lid, a, -1 if (projeto or l['empresa']) else ordem.get(a, -1), s, q, b, n,
                   round(cx, 2), round(cz, 2), round(math.hypot(cx, cz), 1), round(frente, 2), round(prof, 2),
                   round(area4(C)), round(rumo(C[1][0] - C[0][0], C[1][1] - C[0][1]), 2),
                   round(float(l['dog'])), int(l['utxo_count']) if not projeto else 0,
                   0 if projeto else int(l['forma']), 0, 0, 0, round(float(l.get('cota_frente_m') or 0.0), 2)]
                  + [round(v, 3) for p in C for v in p] + [int(l['geo'])])

# as lápides: toda carteira do snapshot abaixo do corte, da maior para a menor
# ⚠️ O ID E A POSIÇÃO VÊM DO MUNDO, e a ordem daqui tem de ser a mesma: o gerador de lá
# ordena igual (saldo decrescente, desempate pelo endereço). Divergência derruba a rodada.
with open(os.path.join(MUNDO, 'plano', 'saida', 'cemiterio.json')) as f:
    cem_mundo = json.load(f)['lapides']
cem_velho = {}
cam_cem = os.path.join(RAIZ, 'data', 'dogcity_cemiterio.csv')
if os.path.exists(cam_cem):
    with open(cam_cem, newline='') as f:
        cem_velho = {r['address']: r for r in csv.DictReader(f)}
lapides = sorted((c for c in carteiras if float(c['dog']) < CORTE), key=lambda c: (-float(c['dog']), c['address']))
com_lote = {l['address'] for l in lotes}
dupla = [c['address'] for c in lapides if c['address'] in com_lote]
if dupla:
    recusa['carteira com lote e lapide'] = dupla
sem_destino = [a for a in por_end if a not in com_lote and float(por_end[a]['dog']) >= CORTE]
if sem_destino:
    recusa['carteira acima do corte sem lote'] = sem_destino

if len(cem_mundo) != len(lapides) or any(
        m[0] != 'L%05d' % i or m[1] != c['address'] for i, (m, c) in enumerate(zip(cem_mundo, lapides), 1)):
    recusa['lapide do Mundo fora da ordem do registro'] = [
        m[0] for m, c in zip(cem_mundo, lapides) if m[1] != c['address']][:3] or ['contagem %d x %d' % (len(cem_mundo), len(lapides))]

if any(recusa.values()):
    for m, v in recusa.items():
        if v:
            print('  %6d  %s  (ex.: %s)' % (len(v), m, ', '.join(map(str, v[:3]))), file=sys.stderr)
    sys.exit('registro_do_mundo: nada gravado.')

CAB = ['lot_id', 'address', 'ordem', 'setor', 'quarto', 'quarteirao', 'lote',
       'x_m', 'z_m', 'raio_m', 'frente_m', 'prof_m', 'area_m2', 'giro_graus',
       'dog', 'utxo_count', 'forma', 'coorte', 'familia', 'dsc', 'cota_m',
       'p0x_m', 'p0z_m', 'p1x_m', 'p1z_m', 'p2x_m', 'p2z_m', 'p3x_m', 'p3z_m', 'geo']
with open(os.path.join(RAIZ, 'data', 'dogcity_lotes.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(CAB)
    w.writerows(linhas)
with open(cam_cem, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['lapide', 'address', 'dog', 'utxo_count', 'posicao_residencial',
                'airdrop', 'assinou', 'direito', 'x_m', 'z_m'])
    for i, (c, m) in enumerate(zip(lapides, cem_mundo), 1):
        v = cem_velho.get(c['address'], {})
        w.writerow([f'L{i:05d}', c['address'], round(float(c['dog']), 2), v.get('utxo_count', ''),
                    c.get('posicao') if c.get('posicao') is not None else v.get('posicao_residencial', ''),
                    1 if c.get('airdrop') else 0, v.get('assinou', 0),
                    'saldo acima da linha + licença paga + mint do deed = lote no Anel 2',
                    round(m[3], 2), round(m[4], 2)])
emp = sum(1 for l in lotes if l['empresa'])
proj = sum(1 for l in lotes if l['address'].startswith('__projeto'))
print(f'registro_do_mundo: {len(linhas):,} lotes ({len(linhas) - emp - proj:,} carteiras, {emp} empresas, '
      f'{proj} da reserva do projeto) e {len(lapides):,} lápides; soma {len(linhas) - proj + len(lapides):,} '
      f'de {len(carteiras):,} carteiras do snapshot')
