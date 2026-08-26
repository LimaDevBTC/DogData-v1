#!/usr/bin/env python3
"""Sincroniza os SALDOS do $DOG Galaxy (dog_genealogy) com o UTXO set local.

Por que existe: o vigia por bloco (dog_genealogy_updater.py) so trata
CHEGADAS: no novo com saldo aproximado pelo recebido. Quem GASTA nunca era
debitado ate o reconciliador completo rodar, e o reconciliador nunca ganhou
cron; o fundador fez uma tx em 26/08, o explorer mostrou o saldo certo e a
galaxia nao. Este script fecha o buraco de hora em hora.

Como: data/dog_utxos_by_address.json (regravado pelo automated_update.py a
cada hora) e a verdade de saldo por endereco. Um instantaneo local guarda o
que ja foi sincronizado; a cada rodada so as carteiras cujo saldo MUDOU
desde o instantaneo levam escrita no Supabase (instancia pequena: escrever
264k linhas por hora seria abuso; escrever so o delta e barato).

Primeira rodada (sem instantaneo): baixa os saldos atuais da tabela
paginado (pelo tamanho DEVOLVIDO, PostgREST tampa em 1000) e corrige toda a
deriva acumulada de uma vez.

Subarvores (subtree_*) ficam com o reconciliador diario
(build_dog_genealogy.py); aqui e so balance_dog e is_holder.

Cron: 35 * * * * (depois do automated_update das :00, que leva ~25 min).
"""
import json
import math
import os
import sys
import time
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
STATE_DIR = Path.home() / '.local' / 'share' / 'dogdata'
SNAPSHOT = STATE_DIR / 'genealogy-balance-sync.json'
UTXOS = BASE / 'data' / 'dog_utxos_by_address.json'

for linha in (BASE / '.env.local').read_text().splitlines():
    if '=' in linha and not linha.startswith('#'):
        k, v = linha.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

URL = os.environ['SUPABASE_URL'].rstrip('/')
KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['SUPABASE_ANON_KEY']


def req(method, path, body=None):
    r = urllib.request.Request(
        URL + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            'apikey': KEY,
            'Authorization': f'Bearer {KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
    )
    with urllib.request.urlopen(r, timeout=30) as res:
        return res.read()


def saldos_locais():
    """endereco -> saldo somado do UTXO set local (4 casas, como a tabela)."""
    d = json.load(open(UTXOS))
    return {a: round(sum(u['dog'] for u in us), 4) for a, us in d.items()}


def saldos_do_banco():
    """Primeira rodada: baixa wallet+balance_dog inteiro, paginado pelo
    tamanho devolvido (nunca pelo passo pedido, licao de 26/08)."""
    out = {}
    offset = 0
    while True:
        raw = req('GET', f'/rest/v1/dog_genealogy?select=wallet,balance_dog&order=wallet.asc&offset={offset}&limit=1000')
        page = json.loads(raw)
        for r in page:
            out[r['wallet']] = round(float(r['balance_dog'] or 0), 4)
        if not page:
            break
        offset += len(page)
        if offset % 20000 == 0:
            print(f'  seed: {offset} carteiras lidas', flush=True)
    return out


def main():
    t0 = time.time()
    locais = saldos_locais()
    print(f'UTXO set local: {len(locais)} enderecos com saldo', flush=True)

    if SNAPSHOT.exists():
        antes = json.load(open(SNAPSHOT))
        universo_conhecido = set(antes)
    else:
        print('sem instantaneo: primeira rodada compara contra o banco inteiro', flush=True)
        antes = saldos_do_banco()
        universo_conhecido = set(antes)
        print(f'banco: {len(antes)} carteiras', flush=True)

    # quem mudou de saldo, e quem tinha saldo e zerou (sumiu do UTXO set)
    mudou = {}
    for a, b in locais.items():
        if antes.get(a) != b:
            mudou[a] = b
    for a, b in antes.items():
        if b > 0 and a not in locais:
            mudou[a] = 0.0

    # so carteiras que a genealogia conhece: no novo e trabalho do vigia,
    # nao daqui (um PATCH em carteira inexistente e no-op inofensivo, mas
    # nao ha motivo pra gastar requisicao com endereco fora da arvore)
    alvo = {a: b for a, b in mudou.items() if a in universo_conhecido}
    pulados = len(mudou) - len(alvo)
    print(f'mudaram: {len(mudou)} (patch em {len(alvo)}, {pulados} fora da arvore ficam pro vigia)', flush=True)

    # zeradas em lote (mesmo corpo), o resto uma a uma
    zeradas = [a for a, b in alvo.items() if b == 0]
    for i in range(0, len(zeradas), 80):
        chunk = ','.join(zeradas[i:i + 80])
        req('PATCH', f'/rest/v1/dog_genealogy?wallet=in.({chunk})',
            {'balance_dog': 0, 'is_holder': False})
    n = len(zeradas)
    for a, b in alvo.items():
        if b == 0:
            continue
        req('PATCH', f'/rest/v1/dog_genealogy?wallet=eq.{a}',
            {'balance_dog': b, 'is_holder': True})
        n += 1
        if n % 200 == 0:
            print(f'  {n}/{len(alvo)} sincronizadas', flush=True)

    # a populacao da galaxia (binario com TODAS as carteiras) guarda a
    # classe de cada ponto (0 gastou, 1 holder, 2 1M+, 3 100M+); quem mudou
    # de saldo nesta rodada tem o byte remendado no proprio .bin, senao o
    # ponto fica mentindo de cor ate o export diario. O indice local
    # (endereco -> posicao no arquivo) vem do export; -1 = esta no
    # esqueleto, fora do binario.
    pop_bin = BASE / 'data' / 'galaxy_population.bin'
    pop_idx = STATE_DIR / 'galaxy-addr-index.json'
    if mudou and pop_bin.exists() and pop_idx.exists():
        try:
            idx = json.loads(pop_idx.read_text())
            raw = bytearray(pop_bin.read_bytes())
            n_bin = int.from_bytes(raw[4:8], 'little')
            base_classe = 8 + n_bin * 6 + n_bin * 2
            tocou = 0
            for a, b in mudou.items():
                i = idx.get(a)
                if i is None or i < 0 or i >= n_bin:
                    continue
                # mesma formula do export (DGX2): byte de saldo em log,
                # normalizado pelo supply (10^11, nunca 10^10: saturava)
                if b <= 0:
                    classe = 0
                else:
                    classe = max(1, min(255, round(255 * min(1.0, math.log10(1 + b) / 11))))
                pos = base_classe + i
                if raw[pos] != classe:
                    raw[pos] = classe
                    tocou += 1
            if tocou:
                tmp_pop = pop_bin.with_suffix('.tmp')
                tmp_pop.write_bytes(bytes(raw))
                tmp_pop.rename(pop_bin)
                print(f'populacao da galaxia: {tocou} classes remendadas no binario', flush=True)
        except Exception as e:  # noqa: BLE001
            print(f'populacao da galaxia: falhou ({e}), o export diario corrige', flush=True)

    # o instantaneo novo = a verdade local desta rodada; enderecos que o
    # banco conhecia entram tambem (para o proximo diff enxergar zeragens)
    prox = dict(locais)
    for a in universo_conhecido:
        prox.setdefault(a, 0.0)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = SNAPSHOT.with_suffix('.tmp')
    tmp.write_text(json.dumps(prox))
    tmp.rename(SNAPSHOT)
    print(f'ok: {len(alvo)} carteiras sincronizadas em {time.time() - t0:.1f}s', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(f'FALHOU: {e}', flush=True)
        sys.exit(1)
