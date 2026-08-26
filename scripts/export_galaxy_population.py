#!/usr/bin/env python3
"""Exporta a POPULACAO COMPLETA do $DOG Galaxy: todas as carteiras do
historico, cada ponto real e clicavel.

v2 (26/08, pedido do fundador): a v1 amostrava 24k porque enderecos em JSON
pesam 16MB; o fundador quer TODAS ("nossa galaxia da muito mais que isso").
A saida agora e BINARIA e sem enderecos: posicoes quantizadas int16 (x8),
geracao uint16 e classe de tamanho uint8 por carteira. ~2,3MB para 264k.
A identidade resolve no CLIQUE: o arquivo ordena por (first_block, wallet),
ordem APPEND-ONLY (carteira nova sempre tem first_block maior que todas as
existentes, entao indices existentes nunca mudam), e a rota
/api/holders/tree/population/at?i=N faz OFFSET nessa ordem no banco (indice
dog_genealogy_first_block_wallet_idx, migracao galaxy_population_order_index).

As POSICOES replicam bit a bit o hash01/nodePosition de galaxy.ts (FNV-1a
com Math.imul e avalanche, tudo mascarado a uint32 aqui): o ceu do cliente
e o do servidor sao o MESMO ceu. Paridade conferida contra node na entrega.

O esqueleto (top 3000 da API /api/holders/tree) e EXCLUIDO do binario para
nao desenhar em dobro; se a API nao responder na hora do export, ninguem e
excluido (uns pontos duplicados exatos, invisiveis, ate a proxima rodada).

Saidas:
  data/galaxy_population.bin           (embarca no deploy, servido pela rota)
  ~/.local/share/dogdata/galaxy-addr-index.json  (SO local: endereco -> indice,
      para o sync horario de saldos remendar a classe de tamanho no bin)

Cron: encadeado na reconciliacao diaria das 05:15.
"""
import json
import math
import os
import struct
import sys
import time
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
SAIDA_BIN = BASE / 'data' / 'galaxy_population.bin'
STATE_DIR = Path.home() / '.local' / 'share' / 'dogdata'
SAIDA_IDX = STATE_DIR / 'galaxy-addr-index.json'
MAGIA = b'DGX1'
ESCALA = 8.0

for linha in (BASE / '.env.local').read_text().splitlines():
    if '=' in linha and not linha.startswith('#'):
        k, v = linha.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

URL = os.environ['SUPABASE_URL'].rstrip('/')
KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['SUPABASE_ANON_KEY']

M32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return (a * b) & M32


def hash01(s: str, salt: int) -> float:
    """Replica de galaxy.ts hash01: mesmo bit pattern, mesma fracao."""
    h = (0x811C9DC5 ^ _imul(salt + 1, 0x9E3779B1)) & M32
    for ch in s:
        h ^= ord(ch)
        h = _imul(h, 0x01000193)
    h ^= h >> 15
    h = _imul(h, 0x85EBCA6B)
    h ^= h >> 13
    return (h & M32) / 4294967296.0


SHELL_BASE = 30
SHELL_STEP = 34
SHELL_LINEAR_MAX = 24


def shell_radius(d: int) -> float:
    d = max(0, d)
    if d <= SHELL_LINEAR_MAX:
        return SHELL_BASE + d * SHELL_STEP
    return SHELL_BASE + SHELL_LINEAR_MAX * SHELL_STEP + math.log2(1 + d - SHELL_LINEAR_MAX) * SHELL_STEP * 2.4


def node_position(w: str, d: int):
    theta = hash01(w, 1) * math.pi * 2
    r = shell_radius(d) + (hash01(w, 3) - 0.5) * 9
    return (math.cos(theta) * r, (hash01(w, 2) * 2 - 1) * 12, math.sin(theta) * r)


def classe_tamanho(holder: bool, balance: float) -> int:
    if not holder:
        return 0
    if balance >= 100_000_000:
        return 3
    if balance >= 1_000_000:
        return 2
    return 1


def esqueleto() -> set:
    """Os enderecos que a cena ja desenha como estrelas do esqueleto."""
    try:
        req = urllib.request.Request('https://www.dogdata.xyz/api/holders/tree',
                                     headers={'User-Agent': 'dogdata-export'})
        d = json.loads(urllib.request.urlopen(req, timeout=30).read())
        ws = {n['w'] for n in d.get('nodes', [])}
        ws.add(d['root']['w'])
        print(f'esqueleto: {len(ws)} enderecos excluidos do binario', flush=True)
        return ws
    except Exception as e:  # noqa: BLE001
        print(f'esqueleto indisponivel ({e}): sem exclusao nesta rodada', flush=True)
        return set()


def main():
    t0 = time.time()
    skel = esqueleto()
    linhas = []
    offset = 0
    while True:
        req = urllib.request.Request(
            f'{URL}/rest/v1/dog_genealogy?select=wallet,depth,is_holder,balance_dog'
            f'&depth=gt.0&order=first_block.asc,wallet.asc&offset={offset}&limit=1000',
            headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'},
        )
        page = json.loads(urllib.request.urlopen(req, timeout=30).read())
        if not page:
            break
        linhas.extend(page)
        offset += len(page)
        if offset % 40000 == 0:
            print(f'  {offset} carteiras lidas', flush=True)

    n = len(linhas)
    print(f'universo: {n} carteiras; computando posicoes', flush=True)

    xyz = bytearray()
    depths = bytearray()
    classes = bytearray()
    indice = {}
    pos_pack = struct.Struct('<hhh')
    dep_pack = struct.Struct('<H')
    escritos = 0
    for r in linhas:
        w = r['wallet']
        # o indice local cobre TODAS (o sync precisa achar qualquer uma);
        # -1 marca as que estao no esqueleto e fora do binario
        d = int(r['depth'])
        if w in skel:
            indice[w] = -1
            continue
        x, y, z = node_position(w, d)
        xyz += pos_pack.pack(
            max(-32767, min(32767, round(x * ESCALA))),
            max(-32767, min(32767, round(y * ESCALA))),
            max(-32767, min(32767, round(z * ESCALA))),
        )
        depths += dep_pack.pack(min(65535, d))
        classes.append(classe_tamanho(bool(r['is_holder']), float(r['balance_dog'] or 0)))
        indice[w] = escritos
        escritos += 1

    # ⚠️ OS INDICES DO CLIQUE INCLUEM AS PULADAS: a rota /at faz OFFSET na
    # ordem do BANCO (todas as carteiras), entao o binario precisa carregar,
    # para cada ponto, o indice na ordem COMPLETA, nao a posicao no arquivo.
    # Em vez de uma tabela extra, regravamos: o binario ganha um uint32 por
    # ponto com o indice na ordem completa do banco.
    ordem_completa = bytearray()
    ord_pack = struct.Struct('<I')
    i_banco = 0
    for r in linhas:
        if r['wallet'] in skel:
            i_banco += 1
            continue
        ordem_completa += ord_pack.pack(i_banco)
        i_banco += 1

    cab = MAGIA + struct.pack('<I', escritos)
    tmp = SAIDA_BIN.with_suffix('.tmp')
    tmp.write_bytes(bytes(cab) + bytes(xyz) + bytes(depths) + bytes(classes) + bytes(ordem_completa))
    tmp.rename(SAIDA_BIN)

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp_idx = SAIDA_IDX.with_suffix('.tmp')
    tmp_idx.write_text(json.dumps(indice, separators=(',', ':')))
    tmp_idx.rename(SAIDA_IDX)

    kb = SAIDA_BIN.stat().st_size // 1024
    print(f'ok: {escritos} pontos de {n} carteiras ({n - escritos} no esqueleto), '
          f'{kb}KB, {time.time() - t0:.1f}s', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(f'FALHOU: {e}', flush=True)
        sys.exit(1)
