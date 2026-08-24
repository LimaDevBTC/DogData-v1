#!/usr/bin/env python3
"""Pergunta ao índice ord quanto DOG cada entrada carregava.

⚠️ ISTO FECHA O TERÇO QUE FALTAVA. A reconstrução pelo nó (rebuild-backfill-senders)
resolveu QUEM mandou em 100% das 111.799 transações órfãs. Em 67% delas o QUANTO
sai de graça, porque existe uma única entrada de 546 sats (o UTXO de rune) e as
outras são gás. Nos 36.989 restantes há mais de um candidato, ou nenhum na
convenção da poeira, e só o índice de runes sabe qual entrada carregava DOG.

⚠️ A JANELA DO ORD É CURTA E EXCLUSIVA, e o desenho todo existe por causa disso.
O índice é redb, que aceita UM escritor: enquanto o ord roda, o dog_scanner e o
tx-class-scanner ficam fora. São 146.743 outpoints para uns 29 minutos, ou seja
84 por segundo, e por isso:

  1. servidor HTTP, não CLI. Um processo `ord` por outpoint custaria ~100 ms de
     partida e levaria horas.
  2. NADA de banco durante a janela. Cada resposta cai num JSONL local, que é
     escrita sequencial em disco. A carga para o Supabase acontece DEPOIS, com o
     ord já devolvido.
  3. retomável por linha. Se a janela fechar no meio, o que foi resolvido está
     gravado e a próxima execução pula.

    ord --data-dir .../ord/data --index-runes server --http-port 8080   # em outro terminal
    python3 scripts/resolve-rune-inputs.py --workers 24
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ORD = os.environ.get("ORD_URL", "http://127.0.0.1:8080")
ENTRADA = "/tmp/outpoints.txt"
SAIDA = "/tmp/rune-inputs.jsonl"
# O nome do rune como o ord o escreve, com os pontos separadores.
DOG = "DOG•GO•TO•THE•MOON"


def dog_de(payload: dict) -> int | None:
    """Quantos átomos de DOG este outpoint carregava.

    ⚠️ O FORMATO DO CAMPO `runes` MUDOU ENTRE VERSÕES DO ORD: já foi um objeto
    {nome: {amount, divisibility, symbol}} e já foi uma lista de pares
    [nome, {amount,...}]. Aceitar os dois é uma linha e evita a janela inteira ser
    perdida por causa de uma versão diferente da esperada."""
    runes = payload.get("runes")
    if runes is None:
        return None
    if isinstance(runes, dict):
        pile = runes.get(DOG)
        if pile is None:
            return 0
        return int(pile["amount"] if isinstance(pile, dict) else pile)
    if isinstance(runes, list):
        for item in runes:
            if isinstance(item, (list, tuple)) and len(item) == 2 and item[0] == DOG:
                pile = item[1]
                return int(pile["amount"] if isinstance(pile, dict) else pile)
        return 0
    return None


def buscar(op: str) -> str | None:
    """Uma linha de JSONL por outpoint, ou None quando o ord não souber."""
    req = urllib.request.Request(f"{ORD}/output/{op}", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            d = json.load(res)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return json.dumps({"op": op, "dog": None, "erro": "404"})
        return None
    except Exception:
        return None
    return json.dumps({"op": op, "dog": dog_de(d), "value": d.get("value")})


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=24)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    alvos = [l.strip() for l in open(ENTRADA, encoding="utf8") if l.strip()]
    feitos = set()
    if os.path.exists(SAIDA):
        with open(SAIDA, encoding="utf8") as fh:
            for linha in fh:
                try:
                    feitos.add(json.loads(linha)["op"])
                except Exception:
                    pass
    fila = [o for o in alvos if o not in feitos]
    if args.limit:
        fila = fila[: args.limit]
    print(f"  {len(alvos)} outpoints · {len(feitos)} já resolvidos · {len(fila)} nesta rodada", flush=True)
    if not fila:
        return

    t0 = time.time()
    ok = falha = 0
    # ⚠️ ABERTO EM MODO APPEND COM `line_buffering`: cada resposta vai para o
    # disco na hora. Se a janela fechar no meio, nada do que já foi perguntado se
    # perde, que é o ponto inteiro de gravar em arquivo e não em memória.
    with open(SAIDA, "a", encoding="utf8", buffering=1) as fh, \
            ThreadPoolExecutor(max_workers=args.workers) as pool:
        for i, linha in enumerate(pool.map(buscar, fila), 1):
            if linha is None:
                falha += 1
            else:
                fh.write(linha + "\n")
                ok += 1
            if i % 2000 == 0:
                dt = time.time() - t0
                resta = (len(fila) - i) / max(i / dt, 1)
                print(f"    {i}/{len(fila)} · {i/dt:.0f} op/s · faltam ~{resta/60:.1f} min · {falha} falhas", flush=True)

    dt = time.time() - t0
    print(f"\n  {ok} resolvidos, {falha} falhas, {dt/60:.1f} min ({ok/max(dt,1):.0f} op/s)")
    if falha:
        print("  rode de novo para repescar as falhas: o arquivo é retomável")


if __name__ == "__main__":
    main()
