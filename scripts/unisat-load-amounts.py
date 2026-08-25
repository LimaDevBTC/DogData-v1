#!/usr/bin/env python3
"""Carrega os eventos coletados da UniSat e fecha as atribuições pendentes.

⚠️ A METADE QUE FALTAVA. `unisat-fill-amounts.py` COLETA os eventos por bloco
para /tmp/unisat-events.jsonl e para quando a fonte recusa; este script é o
passo que nunca tinha rodado: casar os eventos `send` com as 36.989 transações
gravadas com `attribution: pending` e valor NULO.

⚠️ AGORA DÁ PRA AFIRMAR ZERO. A regra do reparo original era "nulo é não sei;
zero seria afirmar que a pessoa não mandou DOG". Com os eventos da transação em
mãos a afirmação existe: quem tem evento `send` mandou aquele tanto; quem está
na lista de candidatos e NÃO tem evento era gás, e recebe zero com a mesma
procedência (`attribution: unisat_event`). Transação sem evento coletado ainda
continua pendente, intocada.

⚠️ IDEMPOTENTE E RETOMÁVEL DE PROPÓSITO: roda quantas vezes precisar, no meio da
coleta ou depois dela; só toca no que tem evento e ainda está pendente. Também
marca `dog_tx_senders_rebuilt.dog_attribution = 'unisat_event'`, o que ENCOLHE a
lista de blocos que o coletor levanta na retomada.

    python3 scripts/unisat-load-amounts.py             # conferir, não escreve
    python3 scripts/unisat-load-amounts.py --aplicar
"""
import argparse
import json
import os
import re
import urllib.parse
import urllib.request
from collections import defaultdict

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVENTOS = "/tmp/unisat-events.jsonl"


def env(name: str) -> str:
    if os.environ.get(name):
        return os.environ[name]
    for line in open(os.path.join(WEB, ".env.local"), encoding="utf8"):
        m = re.match(rf"^{name}=(.*)$", line.strip())
        if m:
            return m.group(1).strip().strip("'\"")
    raise SystemExit(f"falta {name}")


SB, KEY = env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


def sb(path: str, method: str = "GET", body: dict | None = None):
    req = urllib.request.Request(
        f"{SB}/rest/v1/{path}", headers=H, method=method,
        data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req, timeout=90) as res:
        raw = res.read()
        return json.loads(raw) if raw else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true")
    args = ap.parse_args()

    # eventos send por txid: {txid: {address: soma_raw}}; qualquer evento marca o txid como coberto
    envios: dict[str, dict] = defaultdict(lambda: defaultdict(int))
    cobertos: set[str] = set()
    # ⚠️ evento repetido DOBRA a soma; se um bloco for recoletado um dia, a linha
    # idêntica aparece duas vezes no jsonl e a defesa é dedupar pela linha crua
    vistos: set[int] = set()
    for line in open(EVENTOS, encoding="utf8"):
        marca = hash(line)
        if marca in vistos:
            continue
        vistos.add(marca)
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        cobertos.add(e["txid"])
        if e.get("type") == "send" and e.get("address"):
            envios[e["txid"]][e["address"]] += int(e["amount"])
    print(f"  {len(cobertos)} txids com evento · {len(envios)} com evento send")

    # os pendentes, por paginação de chave na tabela de bookkeeping
    pendentes, cursor = [], ""
    while True:
        page = sb("dog_tx_senders_rebuilt?select=txid&dog_attribution=eq.ambiguous"
                  f"&order=txid.asc&txid=gt.{cursor}&limit=1000")
        if not page:
            break
        pendentes += [r["txid"] for r in page]
        cursor = page[-1]["txid"]
        if len(page) < 1000:
            break
    alvo = [t for t in pendentes if t in cobertos]
    print(f"  {len(pendentes)} pendentes no banco · {len(alvo)} já têm evento coletado")

    preenchidos = zerados = sem_send = estranhos = 0
    for i in range(0, len(alvo), 100):
        lote = alvo[i:i + 100]
        rows = sb("dog_transactions?select=txid,senders&txid=in.(" + ",".join(lote) + ")")
        for r in rows or []:
            snd = r["senders"]
            snd = json.loads(snd) if isinstance(snd, str) else (snd or [])
            ev = envios.get(r["txid"], {})
            if not ev:
                # a tx tem eventos mas nenhum send: não afirmo nada por esse caminho
                sem_send += 1
                continue
            listados = {s.get("address") for s in snd}
            # ⚠️ DEFESA: evento send de endereço que nem era candidato significa que
            # a lista de remetentes está errada; melhor contar do que sobrescrever.
            if not set(ev) & listados:
                estranhos += 1
                continue
            for s in snd:
                raw = ev.get(s.get("address"), 0)
                s["amount"] = raw
                s["amount_dog"] = raw / 1e5
                s["has_dog"] = raw > 0
                s["attribution"] = "unisat_event"
            for a, raw in ev.items():
                if a not in listados:
                    snd.append({"amount": raw, "address": a, "has_dog": True,
                                "amount_dog": raw / 1e5, "attribution": "unisat_event"})
            preenchidos += 1
            zerados += sum(1 for s in snd if s.get("amount") == 0)
            if args.aplicar:
                # o jsonb desta tabela guarda uma STRING de JSON; manter o formato
                sb(f"dog_transactions?txid=eq.{r['txid']}", "PATCH", {"senders": json.dumps(snd)})
                sb(f"dog_tx_senders_rebuilt?txid=eq.{r['txid']}", "PATCH", {"dog_attribution": "unisat_event"})
        if (i // 100) % 10 == 9:
            print(f"    {i + len(lote)}/{len(alvo)}…", flush=True)

    modo = "APLICADO" if args.aplicar else "conferência (nada escrito; use --aplicar)"
    print(f"\n  {modo}: {preenchidos} transações preenchidas · {zerados} candidatos "
          f"virados zero com prova · {sem_send} sem evento send · {estranhos} com "
          f"remetente fora da lista (não tocados)")
    print(f"  seguem pendentes: {len(pendentes) - preenchidos}")


if __name__ == "__main__":
    main()
