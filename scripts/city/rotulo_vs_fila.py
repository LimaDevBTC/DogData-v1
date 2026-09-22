#!/usr/bin/env python3
"""Cruza a TABELA DE ROTULOS com a FILA RESIDENCIAL e com o registro de lotes.

⚠️ POR QUE ESTA FERRAMENTA EXISTE (22/09/2026). A tag institucional
(`dog_966670_tag_institucional.json`) diz que o primeiro discriminador dela e
"ROTULO CONHECIDO", e o universo em que ela foi calculada foi o TOPO 500 da
regua (`sobreposicao.py` e `dossie_topo.py` leem `ordem[:500]`). A Kraken hot
esta na posicao 82.761, porque `lth_pct` dela e 0: ela gira. Ou seja o filtro
procurou custodia exatamente na parte da lista onde custodia, por construcao,
nao pode estar, e tres corretoras que a propria casa rotulou ficaram na fila
residencial.

Esta ferramenta SO MEDE. Nao escreve em `data/`, nao escreve em `supabase/`,
nao decide nada. Ela responde uma pergunta: quem esta em `dog_labels` e mesmo
assim recebe lote de gente.

Fonte do rotulo, em ordem de preferencia:
  1. a tabela `dog_labels` de producao, via REST (usa `.env.local`)
  2. os INSERT das migracoes em `supabase/migrations/*.sql`, quando o banco
     nao responde. Migracao nao e a verdade viva, e a saida diz qual foi usada.

⚠️ `internal = true` NAO SIGNIFICA "nao e corretora". A coluna governa o que
pode ir para a TELA, nao o que conta para a decisao de terra: a hot da Bitget e
a hot da Gate.io sao `internal = true` porque o NOME delas se apoia em rotulo de
terceiro. Uma leitura que filtra `internal = false` para decidir lote deixa
custodia passar, e e por isso que esta ferramenta le as duas.

Uso:
  python3 scripts/city/rotulo_vs_fila.py
  python3 scripts/city/rotulo_vs_fila.py --so-corretora   # kind = exchange
"""
import json, io, os, re, csv, sys, math, urllib.request

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
SNAP = os.path.join(RAIZ, 'data', 'snapshots')
MIG = os.path.join(RAIZ, 'supabase', 'migrations')
SO_CORRETORA = '--so-corretora' in sys.argv[1:]

SUPPLY = 100_000_000_000.0
K_PUB, TETO, TETO_FIN = 0.986443, 40000.0, 150000.0


def env():
    fora = {}
    for arq in ('.env.local', '.env'):
        p = os.path.join(RAIZ, arq)
        if not os.path.exists(p):
            continue
        for l in io.open(p, encoding='utf-8', errors='ignore'):
            l = l.strip()
            if '=' in l and not l.startswith('#'):
                k, v = l.split('=', 1)
                fora.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return fora


def rotulos_do_banco():
    e = env()
    url, key = e.get('SUPABASE_URL'), e.get('SUPABASE_SERVICE_ROLE_KEY') or e.get('SUPABASE_ANON_KEY')
    if not (url and key):
        return None
    req = urllib.request.Request(
        url.rstrip('/') + '/rest/v1/dog_labels?select=address,entity,role,kind,evidence,internal',
        headers={'apikey': key, 'Authorization': 'Bearer ' + key})
    try:
        with urllib.request.urlopen(req, timeout=60) as z:
            return {r['address']: r for r in json.loads(z.read())}
    except Exception as ex:
        print('  (banco nao respondeu: %s)' % ex, file=sys.stderr)
        return None


def rotulos_das_migracoes():
    """Plano B: le os INSERT literais. So o suficiente para nao ficar cego."""
    fora = {}
    pat = re.compile(r"\('(bc1[a-z0-9]+|[13][A-Za-z0-9]+)',\s*('[^']*'|NULL),\s*('[^']*'|NULL),\s*"
                     r"'([a-z_]+)',\s*'([a-z_]+)'", re.I)
    for nome in sorted(os.listdir(MIG)):
        if not nome.endswith('.sql'):
            continue
        txt = io.open(os.path.join(MIG, nome), encoding='utf-8').read()
        if 'INSERT INTO dog_labels' not in txt:
            continue
        for m in pat.finditer(txt):
            a, ent, rol, kind, ev = m.groups()
            fora[a] = {'address': a, 'entity': None if ent == 'NULL' else ent.strip("'"),
                       'role': None if rol == 'NULL' else rol.strip("'"), 'kind': kind,
                       'evidence': ev, 'internal': None, 'fonte': nome}
    return fora


def main():
    rot = rotulos_do_banco()
    fonte = 'dog_labels (producao)'
    if not rot:
        rot = rotulos_das_migracoes()
        fonte = 'supabase/migrations/*.sql (PLANO B, nao e a verdade viva)'
    print('rotulos: %d, de %s' % (len(rot), fonte))

    fila = json.load(io.open(os.path.join(SNAP, 'dog_966670_ordem_residencial.json'),
                             encoding='utf-8'))['ordem']
    na_fila = {x['address']: x for x in fila}
    tag = json.load(io.open(os.path.join(SNAP, 'dog_966670_tag_institucional.json'),
                            encoding='utf-8'))['linhas']
    no_distrito = {x['address'] for x in tag}

    lotes = {}
    cam = os.path.join(RAIZ, 'data', 'dogcity_lotes.csv')
    if os.path.exists(cam):
        for r in csv.DictReader(io.open(cam, encoding='utf-8')):
            if not r['address'].startswith('__projeto'):
                lotes[r['address']] = r

    dentro, corretos, fora_do_bloco = [], [], []
    for a, r in sorted(rot.items(), key=lambda kv: -(na_fila.get(kv[0], {}).get('dog') or 0)):
        if SO_CORRETORA and r.get('kind') != 'exchange':
            continue
        if a in na_fila:
            dentro.append((a, r, na_fila[a]))
        elif a in no_distrito:
            corretos.append((a, r))
        else:
            fora_do_bloco.append((a, r))

    print()
    print('=' * 112)
    print('  ROTULADOS QUE RECEBEM LOTE RESIDENCIAL  (%d)' % len(dentro))
    print('=' * 112)
    print('  %-26s %18s %7s %10s %10s %11s  %s' %
          ('rotulo', 'DOG', '% supply', 'pos', 'pos_resid', 'area registro', 'lote'))
    soma_dog = soma_area = 0.0
    for a, r, x in dentro:
        nome = (r.get('entity') or '') + ('/' + r['role'] if r.get('role') else '')
        nome = nome or ('(' + (r.get('kind') or '?') + ')')
        lote = lotes.get(a)
        area = float(lote['area_m2']) if lote else 0.0
        soma_dog += x['dog']; soma_area += area
        flag = '  ⚠️ ACIMA DO TETO PUBLICADO' if area > TETO else ''
        print(f"  {nome[:26]:<26} {x['dog']:>18,.0f} {100*x['dog']/SUPPLY:>6.3f}% "
              f"{x['posicao']:>10} {x['posicao_residencial']:>10} {area:>11,.0f}  "
              f"{lote['lot_id'] if lote else '(sem lote)'}{flag}")
        print('      %s  kind=%s evidence=%s internal=%s' %
              (a, r.get('kind'), r.get('evidence'), r.get('internal')))
    print('  ' + '-' * 108)
    print(f'  soma: {soma_dog:,.0f} DOG ({100*soma_dog/SUPPLY:.3f}% do supply), '
          f'{soma_area:,.0f} m2 de terra residencial')

    print()
    print('  ROTULADOS JA NO DISTRITO FINANCEIRO (%d): %s' %
          (len(corretos), ', '.join((r.get('entity') or r.get('kind') or '?') for _, r in corretos)))
    print('  ROTULADOS FORA DO BLOCO 966.670 (%d): %s' %
          (len(fora_do_bloco),
           ', '.join(((r.get('entity') or '') + '/' + (r.get('role') or '')).strip('/')
                     or (r.get('kind') or '?') for _, r in fora_do_bloco)))

    # o que a tag pegou sem rotulo nenhum: e a parte que o comportamento sozinho
    # resolveu, e ela mede o quanto a heuristica ainda vale depois do conserto
    sem_rotulo = [x for x in tag if x['address'] not in rot]
    print('  DAS %d INSTITUCIONAIS, %d NAO TEM ROTULO: so o comportamento as pegou.'
          % (len(tag), len(sem_rotulo)))


if __name__ == '__main__':
    main()
