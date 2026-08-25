#!/usr/bin/env python3
"""Replay desde o etch: o reparo do grafo histórico, com o scanner de produção.

⚠️ POR QUE ISTO EXISTE. A medição de 24/08 (`measure-index-gap.py`) mostrou que
perto de METADE das transferências de abril/2024 a janeiro/2026 nunca entrou no
índice: o backfill da época perdia linha, e linha perdida esconde as filhas.
Preencher campo não traz linha; só reprocessar a cadeia traz.

⚠️ O MOTOR É O SCANNER DE PRODUÇÃO, não uma reimplementação. `scan_block` com os
dois consertos de alocação (pointer sem edict; marcador de divisão com valor),
carregando o conjunto de UTXOs desde o etch do DOG. O dry-run v3 de 24/08 validou
o motor: alvo perdido detectado, e 99% dos outpoints sobreviventes com valor
idêntico ao ord, a 2 blocos/s.

⚠️ ONDE ELE ESCREVE E ONDE NÃO. Upsert por txid na `dog_transactions` (o mesmo
`push_to_supabase` do scanner, merge-duplicates): linha ausente entra, linha
errada da era defeituosa é corrigida com procedência superior (senders com valor
vindos do próprio replay). Ele NÃO toca `dog_utxo_set.json` nem o estado do
scanner vivo: o conjunto carregado vive em arquivo próprio de checkpoint. Teto
padrão de escrita: bloco 933.999, porque dali pra cima o índice é são e
divergência é sinal pra investigar, não pra sobrescrever calado.

⚠️ CHECKPOINT ATÔMICO a cada 500 blocos (altura + conjunto carregado): queda no
meio retoma de onde parou, sem repetir upsert (idempotente) e sem pular bloco.

    python3 scripts/replay-genesis.py --ate 841500              # conferência
    python3 scripts/replay-genesis.py --aplicar                 # o replay real
    python3 scripts/replay-genesis.py --aplicar                 # de novo = retoma
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CASA = os.path.expanduser("~/.local/share/dogdata")
CHECK = os.path.join(CASA, "replay-checkpoint.json")
CARRY = os.path.join(CASA, "replay-utxo.json")
ETCH = "e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375"
INICIO = 840001
TETO_ESCRITA = 933999  # dali pra cima o índice vivo é são


def env(name: str) -> str:
    for line in open(os.path.join(WEB, ".env.local"), encoding="utf8"):
        m = re.match(rf"^{name}=(.*)$", line.strip())
        if m:
            return m.group(1).strip().strip("'\"")
    return ""


# o scanner lê as credenciais do ambiente na importação
os.environ.setdefault("SUPABASE_URL", env("SUPABASE_URL"))
os.environ.setdefault("SUPABASE_KEY", env("SUPABASE_SERVICE_ROLE_KEY"))
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", env("SUPABASE_SERVICE_ROLE_KEY"))
sys.path.insert(0, os.path.join(WEB, "scripts"))
import dog_block_scanner as sc  # noqa: E402

H_SB = {"apikey": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}"}


def txids_no_banco(de: int, ate: int) -> set[str]:
    # ⚠️ o cursor pagina por `id` (bigint indexado): ordenar por txid dentro de um
    # filtro de blocos derruba o PostgREST com 500 quando a faixa é gorda
    fora, cursor = set(), 0
    while True:
        url = (f"{os.environ['SUPABASE_URL']}/rest/v1/dog_transactions?select=id,txid"
               f"&block_height=gte.{de}&block_height=lte.{ate}"
               f"&order=id.asc&id=gt.{cursor}&limit=1000")
        for tentativa in range(5):
            try:
                page = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=H_SB), timeout=90))
                break
            except Exception:
                if tentativa == 4:
                    raise
                time.sleep(3 * (tentativa + 1))
        if not page:
            break
        fora |= {r["txid"] for r in page}
        cursor = page[-1]["id"]
        if len(page) < 1000:
            break
    return fora


def salva_checkpoint(altura: int, utxo: dict) -> None:
    tmp = CARRY + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(utxo, fh)
    os.replace(tmp, CARRY)
    tmp = CHECK + ".tmp"
    with open(tmp, "w") as fh:
        json.dump({"last_block": altura, "quando": time.strftime("%Y-%m-%dT%H:%M:%S%z")}, fh)
    os.replace(tmp, CHECK)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true", help="sem isto, só conta o que inseriria")
    ap.add_argument("--ate", type=int, default=TETO_ESCRITA)
    args = ap.parse_args()
    teto = min(args.ate, TETO_ESCRITA)

    if os.path.exists(CHECK) and os.path.exists(CARRY):
        altura = json.load(open(CHECK))["last_block"] + 1
        utxo = {k: int(v) for k, v in json.load(open(CARRY)).items()}
        print(f"  retomando do bloco {altura} com {len(utxo)} UTXOs carregados", flush=True)
    else:
        altura = INICIO
        utxo = {f"{ETCH}:1": 10_000_000_000_000_000}
        print(f"  começando do etch (bloco {INICIO})", flush=True)

    t0, blocos, vistos, lote, faltavam = time.time(), 0, 0, [], 0
    janela_ini, janela_txids = altura, set()
    for h in range(altura, teto + 1):
        res = sc.scan_block(h, utxo)
        for tx_data, novos, gastos in (res or []):
            vistos += 1
            janela_txids.add(tx_data["txid"])
            lote.append(tx_data)
            for op in gastos:
                utxo.pop(op, None)
            utxo.update(novos)
        blocos += 1

        if args.aplicar and len(lote) >= 500:
            if not sc.push_to_supabase(lote, addresses=True):
                print(f"  upsert falhou no bloco {h}; parando com checkpoint no bloco anterior", flush=True)
                salva_checkpoint(h - 1, utxo)
                sys.exit(1)
            lote = []

        if h % 500 == 0:
            if not args.aplicar and janela_txids:
                # ⚠️ a contagem é informativa; instabilidade do pooler não pode
                # derrubar a conferência inteira (já derrubou duas vezes)
                try:
                    ja = txids_no_banco(janela_ini, h)
                    faltavam += len(janela_txids - ja)
                except Exception as exc:
                    print(f"    janela {janela_ini}..{h} não conferida ({type(exc).__name__})", flush=True)
                janela_ini, janela_txids = h + 1, set()
            if args.aplicar:
                if lote:
                    if not sc.push_to_supabase(lote, addresses=True):
                        print(f"  upsert falhou no bloco {h}; checkpoint não avança", flush=True)
                        sys.exit(1)
                    lote = []
                salva_checkpoint(h, utxo)
            taxa = blocos / max(time.time() - t0, 1)
            eta = (teto - h) / max(taxa, 0.1) / 3600
            extra = f"faltavam no banco {faltavam} · " if not args.aplicar else ""
            print(f"    {h} · {vistos} tx · {len(utxo)} utxos · {extra}{taxa:.1f} bl/s · ETA {eta:.1f}h", flush=True)

    if args.aplicar:
        if lote and not sc.push_to_supabase(lote, addresses=True):
            sys.exit(1)
        salva_checkpoint(teto, utxo)
    elif janela_txids:
        ja = txids_no_banco(janela_ini, teto)
        faltavam += len(janela_txids - ja)

    modo = "REPLAY APLICADO" if args.aplicar else "conferência (nada escrito)"
    print(f"\n  {modo}: blocos {altura}..{teto} · {vistos} transações vistas"
          + ("" if args.aplicar else f" · {faltavam} não estavam no banco"), flush=True)


if __name__ == "__main__":
    main()
