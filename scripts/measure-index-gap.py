#!/usr/bin/env python3
"""Quantas transações de DOG o nosso índice simplesmente não tem.

⚠️ ISTO MEDE O SEGUNDO BURACO, e ele é diferente do primeiro. O primeiro era de
CAMPO: 111.799 transações existiam no banco sem remetente, e a reconstrução pelo
nó resolveu. Este é de LINHA: transação que aconteceu na cadeia e não está no
banco de jeito nenhum. Suspeitou-se dele quando o endereço de saque da Kraken
apareceu com uma transação só, o que não é plausível para uma corretora.

⚠️ A MEDIÇÃO NÃO CONFIA EM NINGUÉM DE FORA. Ela lê blocos inteiros do nosso nó,
decodifica o runestone de cada transação com o MESMO código que o watcher usa em
produção, e separa as que carregam um edict explícito de DOG (840000:3). Toda
transação com edict de DOG TEM que estar no índice: é uma transferência de DOG
declarada no protocolo, sem ambiguidade nenhuma.

⚠️ E O QUE ELA MEDE É UM PISO, NÃO O TOTAL. Transferência de DOG sem edict
existe: quando o runestone não traz edict, o protocolo manda o saldo inteiro para
a primeira saída não-OP_RETURN (ou para o pointer). Achar essas exige saber o
conjunto de UTXOs de DOG NAQUELA altura, que a gente não tem para o passado. Uma
amostra que já mostre buraco nas explícitas prova o problema; não mostrar buraco
nelas não prova ausência de problema.

    python3 scripts/measure-index-gap.py                 # 40 blocos espalhados
    python3 scripts/measure-index-gap.py --blocos 120
    python3 scripts/measure-index-gap.py --de 900000 --ate 963000

O QUE ELA MEDIU EM 24/08/2026, e o resultado tem um corte limpo:

    840.000 → 870.000   46,58% fora do índice
    870.000 → 900.000   48,21%
    900.000 → 930.000   39,13%
    920.000 → 935.000   52,94%
    935.000 → 945.000    6,67%
    930.000 → 963.887    0,00%
    963.600 → 963.887    1,54%   (últimos dois dias)

A fronteira está por volta do bloco 934.000, fim de janeiro de 2026, que é quando
o scanner ao vivo assumiu. Depois dela o pipeline está são. Antes dela, o
histórico foi montado por um backfill que perdeu perto de metade das
transferências explícitas, de abril de 2024 a janeiro de 2026.

⚠️ E ESTE BURACO NÃO É O MESMO DO OUTRO REPARO. Aquele era de CAMPO: a linha
existia sem remetente, e `rebuild-backfill-senders.py` preencheu. Este é de
LINHA: a transação aconteceu na cadeia e não está no banco. Preencher campo não
traz linha que nunca entrou.

PROVA DE CUSTÓDIA, com os nossos próprios dados: em 5 de 20 transações apontadas
como ausentes, a entrada de poeira veio de uma transação que o índice CONHECE
como transferência de DOG. Não há como aquela entrada carregar DOG e a
transferência seguinte não ser real. As outras 15 não têm prova por este caminho
porque a origem delas também está faltando, e o buraco se compõe.
"""
import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dog_mempool_watcher import (  # noqa: E402
    DATADIR, DOG_ID, RPC_URL, Rpc, decode_runestone, SUPABASE_KEY, SUPABASE_URL,
)

PRIMEIRO_BLOCO = 840000  # a etch do DOG
H_SB = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}


def no_indice(txids: list[str]) -> set[str]:
    """Quais destes txids o banco conhece.

    ⚠️ EM LOTES DE 120: `txid=in.(...)` com mil ids monta uma URL de 65 KB e quem
    recusa é o Cloudflare, com 520. Já caímos nessa uma vez."""
    achados: set[str] = set()
    for i in range(0, len(txids), 120):
        lote = ",".join(txids[i:i + 120])
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/dog_transactions?select=txid&txid=in.({lote})", headers=H_SB)
        with urllib.request.urlopen(req, timeout=60) as res:
            achados.update(r["txid"] for r in json.load(res))
    return achados


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--blocos", type=int, default=40)
    ap.add_argument("--de", type=int, default=PRIMEIRO_BLOCO)
    ap.add_argument("--ate", type=int, default=None)
    args = ap.parse_args()

    rpc = Rpc(RPC_URL, DATADIR)
    topo = rpc.call("getblockchaininfo")["blocks"]
    ate = args.ate or topo
    # ⚠️ AMOSTRA ESPALHADA, NÃO ALEATÓRIA: passo fixo cobre a linha do tempo
    # inteira de ponta a ponta. Sorteio agrupa por acaso e pode deixar meses sem
    # nenhum bloco, que é justamente onde um buraco de época se esconderia.
    passo = max(1, (ate - args.de) // args.blocos)
    alturas = list(range(args.de, ate + 1, passo))[: args.blocos]
    print(f"  {len(alturas)} blocos entre {args.de} e {ate} (passo {passo})\n", flush=True)

    total_edict = 0
    faltando: list[tuple[int, str]] = []
    for n, h in enumerate(alturas, 1):
        blk = rpc.call("getblock", rpc.call("getblockhash", h), 2)
        comEdict = []
        for tx in blk.get("tx", []):
            rs = decode_runestone(tx)
            if rs and any(rid == DOG_ID for (rid, _a, _o) in rs["edicts"]):
                comEdict.append(tx["txid"])
        total_edict += len(comEdict)
        if comEdict:
            tem = no_indice(comEdict)
            for t in comEdict:
                if t not in tem:
                    faltando.append((h, t))
        if n % 10 == 0 or n == len(alturas):
            print(f"    {n}/{len(alturas)} blocos · {total_edict} tx com edict de DOG · "
                  f"{len(faltando)} fora do índice", flush=True)

    print(f"\n  AMOSTRA: {len(alturas)} blocos · {total_edict} transferências explícitas de DOG")
    if total_edict:
        pct = 100 * len(faltando) / total_edict
        print(f"  FORA DO ÍNDICE: {len(faltando)}  ({pct:.2f}%)")
    for h, t in faltando[:25]:
        print(f"    bloco {h}  {t}")
    if len(faltando) > 25:
        print(f"    … e mais {len(faltando) - 25}")

    if faltando:
        destino = "/tmp/index-gap-sample.json"
        with open(destino, "w", encoding="utf8") as fh:
            json.dump([{"height": h, "txid": t} for h, t in faltando], fh, indent=1)
        print(f"\n  lista completa em {destino}")


if __name__ == "__main__":
    main()
