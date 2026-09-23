#!/usr/bin/env python3
"""
RECONSTRÓI A TAG INSTITUCIONAL A PARTIR DO RÓTULO, QUE É A FONTE QUE MANDA.

⚠️ POR QUE ESTA FERRAMENTA EXISTE, e é um defeito medido em 22/09/2026. A tag
institucional tem uma regra de quatro discriminadores e o PRIMEIRO deles é
"rótulo conhecido". Ela LEU a tabela de rótulos. O que ela fez de errado foi
aplicar o rótulo como filtro sobre o TOPO da fila de DOG-tempo, e CUSTÓDIA GIRA:
ela mora no FUNDO dessa fila. A carteira quente da Kraken, com 12,948 bilhões de
DOG (12,9% do supply), está na posição 82.761 de 85.818; a institucional mais
funda da tag está na 489. Ela nunca foi candidata.

Resultado: seis carteiras de custódia, 13,2% do supply, recebendo LOTE
RESIDENCIAL, e as duas únicas carteiras da cidade a bater no teto de 40.000 m²
eram a Kraken e um cofre. O §12.1 do masterplan é explícito: "só sai custódia,
moeda que é de outra pessoa".

⚠️ E O CRUZAMENTO JÁ EXISTIA EM DISCO: `dog_966670_pagadores_rotulados.json`,
gerado UM DIA ANTES da tag, já listava "Kraken/hot, posição 82761". Peça pronta,
fio não ligado, pela quinta vez no mesmo dia.

⚠️ O QUE É CUSTÓDIA AQUI SAI DA NOSSA PRÓPRIA TAXONOMIA, não de opinião:
`lib/dog/taxonomy.ts` põe `exchange` e `marketplace` no grupo `infrastructure`,
definido como "custodia ou intermedia dinheiro de terceiros". `desk` e
`treasury` NÃO entram: a §12.1 manda atacadista e mesa que compraram de gente
real e seguraram FICAREM, e um cofre que só recebe não é custódia provada.

Uso:  python3 scripts/city/tag_institucional.py [--escreve]
Sem --escreve ele só mostra o que mudaria.
"""
import json, os, sys, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
p = lambda *a: os.path.join(RAIZ, *a)
CUSTODIA = {'exchange', 'marketplace'}
TAG = p('data/snapshots/dog_966670_tag_institucional.json')
SNAP = p('data/snapshots/dog_snapshot_966670.json')

def rotulos():
    """os rótulos de produção. Cai para as migrações se não houver rede."""
    env = {}
    for nome in ('.env.local', '.env'):
        try:
            for ln in open(p(nome), encoding='utf-8'):
                if '=' in ln and not ln.strip().startswith('#'):
                    k, v = ln.split('=', 1); env[k.strip()] = v.strip().strip('"\'')
        except FileNotFoundError: pass
    url = env.get('NEXT_PUBLIC_SUPABASE_URL') or env.get('SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if url and key:
        try:
            req = urllib.request.Request(
                f'{url}/rest/v1/dog_labels?select=address,entity,role,kind,evidence',
                headers={'apikey': key, 'Authorization': f'Bearer {key}'})
            return json.load(urllib.request.urlopen(req, timeout=20)), 'produção'
        except Exception as e:
            print(f'⚠️  produção indisponível ({type(e).__name__}), caindo nas migrações', file=sys.stderr)
    import re, glob
    out = []
    for f in sorted(glob.glob(p('supabase/migrations/*.sql'))):
        txt = open(f, encoding='utf-8').read()
        for m in re.finditer(r"\('((?:bc1|[13])[a-zA-Z0-9]{20,})',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'", txt):
            a, nome, papel, tipo = m.groups()
            out.append({'address': a, 'entity': nome, 'role': papel, 'kind': tipo, 'evidence': 'migração'})
    return out, 'migrações'

def main():
    rot, fonte = rotulos()
    print(f'rótulos lidos de {fonte}: {len(rot)}')
    dog = {r['address']: float(r.get('dog') or 0)
           for r in json.load(open(SNAP, encoding='utf-8'))['holders']}
    tag = json.load(open(TAG, encoding='utf-8'))
    ja = {l['address'] for l in tag['linhas']}
    novas = []
    for r in rot:
        a = r['address']
        if (r.get('kind') or '') not in CUSTODIA or a in ja or a not in dog: continue
        quem = r.get('entity') or 'não identificada'
        novas.append({'posicao': 0, 'address': a, 'dog': dog[a], 'destinos': None,
                      'motivos': [f"rótulo: {quem}/{r.get('role') or '-'}/{r['kind']}"
                                  f" [{r.get('evidence')}]",
                                  'fonte: tabela de rótulos, cruzada contra o snapshot INTEIRO'
                                  ' e não contra o topo da fila (o defeito de 13/09)']})
    if not novas:
        print('nada a acrescentar: toda custódia rotulada já está na tag'); return
    print(f'\nCUSTÓDIA ROTULADA QUE ESTAVA NA FILA RESIDENCIAL: {len(novas)}')
    for n in sorted(novas, key=lambda x: -x['dog']):
        print(f"  {n['dog']/1e9:9.3f}B DOG  {n['motivos'][0]:<52} {n['address'][:18]}...")
    print(f"  ---- somados {sum(n['dog'] for n in novas)/1e9:.3f}B DOG")
    if '--escreve' not in sys.argv:
        print('\n(nada foi escrito; passe --escreve para gravar)'); return
    tag['linhas'] = sorted(tag['linhas'] + novas, key=lambda x: -float(x.get('dog') or 0))
    for i, l in enumerate(tag['linhas'], 1): l['posicao'] = i
    tag['regra'] = (tag.get('regra', '') +
                    ' | 22/09: mais TODA carteira com rótulo de kind exchange ou marketplace '
                    '(grupo infrastructure em lib/dog/taxonomy.ts), cruzada contra o snapshot '
                    'INTEIRO e não contra o topo da fila de DOG-tempo, que era o defeito.')
    json.dump(tag, open(TAG, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\ngravado {TAG}: {len(tag["linhas"])} institucionais')

main()
