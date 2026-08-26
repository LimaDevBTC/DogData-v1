#!/usr/bin/env python3
"""Exporta a POPULACAO do $DOG Galaxy: amostra estratificada de carteiras
REAIS para substituir a poeira decorativa da cena.

Diretriz do fundador (26/08): nenhum ponto decorativo; todo e qualquer
ponto da galaxia deve ser uma carteira do nosso historico, clicavel. Nao
da pra embarcar as 264k no payload da pagina (so os enderecos passam de
16MB), entao a cena desenha o esqueleto (top 3000 por subarvore) mais
esta amostra: N carteiras reais, alocadas por geracao PROPORCIONALMENTE a
populacao real (a densidade visual continua sendo o dado, como era com a
poeira), escolhidas por hash do endereco (deterministico: recarregar nunca
rearruma o ceu, e rodadas sucessivas mantem quase a mesma amostra).

Saida: data/galaxy_population.json  {"total": int, "gens": {d: pop}, "w":
[[addr, depth, holder01], ...]} com w em ordem embaralhada deterministica,
entao servir um prefixo de tamanho n preserva a estratificacao.

Cron: encadeado na reconciliacao diaria das 05:15; o sync horario de
saldos atualiza a flag holder dos amostrados no proprio arquivo.
"""
import hashlib
import json
import os
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
SAIDA = BASE / 'data' / 'galaxy_population.json'
N_AMOSTRA = 24000

for linha in (BASE / '.env.local').read_text().splitlines():
    if '=' in linha and not linha.startswith('#'):
        k, v = linha.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

URL = os.environ['SUPABASE_URL'].rstrip('/')
KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['SUPABASE_ANON_KEY']


def h64(s: str) -> int:
    return int.from_bytes(hashlib.blake2b(s.encode(), digest_size=8).digest(), 'big')


def main():
    t0 = time.time()
    por_gen: dict[int, list] = defaultdict(list)
    offset = 0
    total = 0
    while True:
        req = urllib.request.Request(
            f'{URL}/rest/v1/dog_genealogy?select=wallet,depth,is_holder'
            f'&depth=gt.0&order=wallet.asc&offset={offset}&limit=1000',
            headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'},
        )
        page = json.loads(urllib.request.urlopen(req, timeout=30).read())
        if not page:
            break
        for r in page:
            por_gen[int(r['depth'])].append((r['wallet'], 1 if r['is_holder'] else 0))
        offset += len(page)
        total += len(page)
        if total % 40000 == 0:
            print(f'  {total} carteiras lidas', flush=True)

    print(f'universo: {total} carteiras em {len(por_gen)} geracoes', flush=True)

    # alocacao proporcional com piso de 1 por geracao habitada; dentro da
    # geracao, vencem os menores hashes do endereco (estavel entre rodadas)
    amostra = []
    for d, ws in sorted(por_gen.items()):
        n_g = max(1, round(N_AMOSTRA * len(ws) / total))
        escolhidos = sorted(ws, key=lambda t: h64(t[0]))[:n_g]
        for w, h in escolhidos:
            amostra.append([w, d, h])

    # ordem de embaralhamento deterministica por hash com sal proprio:
    # um prefixo de qualquer tamanho continua estratificado
    amostra.sort(key=lambda t: h64('ordem:' + t[0]))

    payload = {
        'total': total,
        'sampled': len(amostra),
        'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'gens': {str(d): len(ws) for d, ws in sorted(por_gen.items())},
        'w': amostra,
    }
    tmp = SAIDA.with_suffix('.tmp')
    tmp.write_text(json.dumps(payload, separators=(',', ':')))
    tmp.rename(SAIDA)
    kb = SAIDA.stat().st_size // 1024
    print(f'ok: {len(amostra)} amostradas de {total}, {kb}KB, {time.time() - t0:.1f}s', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(f'FALHOU: {e}', flush=True)
        sys.exit(1)
