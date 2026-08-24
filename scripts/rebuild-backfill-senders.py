#!/usr/bin/env python3
"""Reconstrói os remetentes das transações `backfilled_partial` a partir do NOSSO nó.

⚠️ POR QUE ISTO EXISTE. 111.799 transações (23% do histórico DOG, de 24/04/2024 a
18/03/2026) foram gravadas com `sender_count = 0` e `senders = []`: sabemos quem
recebeu e não sabemos quem mandou. Descoberto em 2026-08-24 quando o fundador
mandou o txid de um saque da Kraken e o endereço que pagou não existia no banco.

O que isso quebra, na ordem: um quarto das arestas do grafo não existe; a
navegação por contraparte para na primeira transação antiga; e o rotulador por
topologia (que é como a gente acha corretora sem depender da Arkham) fica cego
justamente onde precisa enxergar.

⚠️ A FONTE É O NOSSO NÓ, E ISSO NÃO É ORGULHO, É ARQUITETURA. Reconstruir a
partir de explorador de terceiro transformaria um buraco de dado numa dependência
permanente. `getrawtransaction <txid> 2` devolve o prevout de cada entrada com
endereço e valor, numa chamada só, porque o txindex está sincronizado.

⚠️ E ELE NÃO ESCREVE EM PRODUÇÃO. Escreve em `dog_tx_senders_rebuilt`, que é
estágio. Conferir por amostra contra um explorador independente, e só então
aplicar em `dog_transactions` num passo documentado.

Medido antes de escrever: 15 ms por transação, 68 tx/s, zero falhas em 225
amostras, 2,8 entradas por transação em média.

    python3 scripts/rebuild-backfill-senders.py            # tudo
    python3 scripts/rebuild-backfill-senders.py --limit 500  # amostra
    python3 scripts/rebuild-backfill-senders.py --workers 4
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUST = 546  # o UTXO de rune padrão. Ver `dog_attribution` na migração.


def env(name: str) -> str:
    """Lê o .env.local, que é o mesmo arquivo que os serviços do systemd carregam."""
    if os.environ.get(name):
        return os.environ[name]
    with open(os.path.join(WEB, ".env.local"), encoding="utf8") as fh:
        for line in fh:
            m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
            if m and m.group(1) == name:
                return m.group(2).strip().strip("'\"")
    sys.exit(f"falta {name} no ambiente e no .env.local")


SB_URL = env("SUPABASE_URL")
SB_KEY = env("SUPABASE_SERVICE_ROLE_KEY")
HEAD = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Content-Type": "application/json"}


def sb(path: str, method: str = "GET", body=None, extra=None, tentativas: int = 4):
    """⚠️ COM REPETIÇÃO: o PostgREST devolve 500 esporádico sob carga, e uma
    reconstrução de 111 mil linhas não pode morrer por causa de um deles."""
    for n in range(tentativas):
        try:
            return _sb(path, method, body, extra)
        except Exception:
            if n == tentativas - 1:
                raise
            time.sleep(2 ** n)


def _sb(path: str, method: str = "GET", body=None, extra=None):
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={**HEAD, **(extra or {})},
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        raw = res.read()
        return json.loads(raw) if raw else None


CURSOR = "/tmp/rebuild-backfill-cursor.txt"


def pagina(depois: str, passo: int = 500) -> list[str]:
    """Uma página de txids pendentes, por CHAVE.

    ⚠️ DUAS ARMADILHAS JÁ CAÍDAS AQUI, e as duas viraram comentário para ninguém
    reescrever igual:

    1. `offset=N` obriga o Postgres a varrer e descartar N linhas por página. Na
       página 60 de 112 o pedido estoura o tempo e o PostgREST devolve 500.
    2. Perguntar "quais destes mil já foram feitos" com `txid=in.(...)` monta uma
       URL de 65 KB, e aí quem recusa é o Cloudflare, com 520.

    A saída é cursor: paginar por `txid=gt.<último>` e guardar onde parou num
    arquivo local. Custo constante por página, URL curta, e retomável."""
    return [r["txid"] for r in sb(
        "dog_transactions?type=eq.backfilled_partial&select=txid"
        f"&order=txid.asc&txid=gt.{depois}&limit={passo}"
    )]


def resolver(txid: str) -> dict | None:
    """Uma chamada ao nó, e dela sai tudo que falta."""
    out = subprocess.run(
        ["bitcoin-cli", "getrawtransaction", txid, "2"],
        capture_output=True, text=True, timeout=60,
    )
    if out.returncode != 0:
        return None
    d = json.loads(out.stdout)
    entradas = []
    for v in d.get("vin", []):
        p = v.get("prevout") or {}
        spk = p.get("scriptPubKey") or {}
        entradas.append({
            "address": spk.get("address"),
            "value_sats": round(float(p.get("value", 0)) * 1e8),
            "txid": v.get("txid"),
            "vout": v.get("vout"),
        })
    if not entradas:
        return None
    dust = [e for e in entradas if e["value_sats"] == DUST]
    return {
        "txid": txid,
        "input_addresses": [e["address"] for e in entradas if e["address"]],
        "inputs": entradas,
        # uma entrada de poeira só: aquela carregava o rune e a atribuição é direta
        "dog_attribution": "direct" if len(dust) == 1 else "ambiguous",
        "input_count": len(entradas),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--batch", type=int, default=500)
    ap.add_argument("--reiniciar", action="store_true", help="ignora o cursor e começa do zero")
    args = ap.parse_args()

    cursor = ""
    if os.path.exists(CURSOR) and not args.reiniciar:
        cursor = open(CURSOR, encoding="utf8").read().strip()
        if cursor:
            print(f"  retomando de {cursor[:16]}…")

    t0 = time.time()
    feitos = falhas = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        while True:
            txids = pagina(cursor)
            if not txids:
                break
            lote = [r for r in pool.map(resolver, txids) if r is not None]
            falhas += len(txids) - len(lote)
            if lote:
                sb("dog_tx_senders_rebuilt", "POST", lote,
                   {"Prefer": "resolution=merge-duplicates,return=minimal"})
                feitos += len(lote)
            # ⚠️ O CURSOR SÓ AVANÇA DEPOIS DA ESCRITA. Ao contrário, uma queda
            # entre resolver e gravar pularia a página inteira em silêncio.
            cursor = txids[-1]
            with open(CURSOR, "w", encoding="utf8") as fh:
                fh.write(cursor)
            dt = time.time() - t0
            print(f"    {feitos} feitas · {feitos/dt:.0f} tx/s · cursor {cursor[:12]}…", flush=True)
            if args.limit and feitos >= args.limit:
                break

    dt = time.time() - t0
    print(f"\n  {feitos} reconstruídas, {falhas} falhas, {dt/60:.1f} min ({feitos/max(dt,1):.0f} tx/s)")


if __name__ == "__main__":
    main()
