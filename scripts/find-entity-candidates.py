#!/usr/bin/env python3
"""Acha carteiras que se comportam como corretora, pool ou mercado, e mostra a prova.

⚠️ ELE NÃO ROTULA NADA. Cospe candidatos com os números que sustentam a suspeita,
para uma pessoa olhar e decidir. Rótulo errado num explorer é manchete errada, e
uma vez publicado ninguém desfaz: gente cita, agrega, repete. A tabela `dog_labels`
guarda o GRAU DA PROVA em cada linha justamente porque a decisão é humana.

⚠️ E ELE SÓ OLHA O PERÍODO SÃO DO ÍNDICE. A medição de 24/08/2026 mostrou que de
abril de 2024 a janeiro de 2026 falta perto de metade das transferências
(`measure-index-gap.py`). Topologia lida num grafo com metade das arestas
faltando produz conclusão confiante e errada: uma carteira que parece ter três
contrapartes pode ter trinta. Daí o corte no bloco 934.000, que é onde o scanner
ao vivo assumiu e o índice passou a fechar.

OS TRÊS FORMATOS QUE ELE PROCURA, e o porquê de cada um:

  varredura de depósito  recebe de MUITA gente distinta e manda para MUITO
                         POUCOS. É o desenho de uma corretora recolhendo
                         depósitos para a carteira quente. O sinal forte é a
                         razão entre contrapartes de entrada e de saída.
  carteira quente        muita contraparte distinta nos DOIS sentidos, volume
                         alto. Paga saques e recebe transferências internas.
  pool ou mercado        contrapartes que voltam (o mesmo endereço negocia
                         várias vezes), volume alto, e entrada e saída em
                         equilíbrio.

    python3 scripts/find-entity-candidates.py
    python3 scripts/find-entity-candidates.py --dias 60 --minimo 40
"""
import argparse
import json
import os
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# ⚠️ o índice só é confiável a partir daqui. Ver o cabeçalho.
BLOCO_SAO = 934000


def env(name: str) -> str:
    if os.environ.get(name):
        return os.environ[name]
    for line in open(os.path.join(WEB, ".env.local"), encoding="utf8"):
        m = re.match(rf"^{name}=(.*)$", line.strip())
        if m:
            return m.group(1).strip().strip("'\"")
    raise SystemExit(f"falta {name}")


SB, KEY = env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def sb(path: str):
    return json.load(urllib.request.urlopen(
        urllib.request.Request(f"{SB}/rest/v1/{path}", headers=H), timeout=90))


def arr(v):
    """⚠️ o jsonb guarda uma STRING de JSON nesta tabela; ler direto devolve texto."""
    if not v:
        return []
    if isinstance(v, list):
        return v
    try:
        once = json.loads(v) if isinstance(v, str) else v
        return once if isinstance(once, list) else (json.loads(once) if isinstance(once, str) else [])
    except Exception:
        return []


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dias", type=int, default=45)
    ap.add_argument("--minimo", type=int, default=25, help="contrapartes distintas para entrar na lista")
    ap.add_argument("--top", type=int, default=18)
    args = ap.parse_args()

    desde = (datetime.now(timezone.utc) - timedelta(days=args.dias)).isoformat()
    print(f"  lendo de {desde[:10]} em diante, e só do bloco {BLOCO_SAO} para cima", flush=True)

    # ⚠️ AS DUAS FONTES DE IDENTIDADE, e não só a nossa. A primeira versão deste
    # script olhava apenas `dog_labels` e por isso devolveu Gate.io, MEXC e Bitget
    # como se fossem descobertas. Foram: elas saíram no topo da lista sem que o
    # programa soubesse quem eram, o que é a melhor validação que o método podia
    # ter. Mas repetir isso a cada rodada é ruído.
    ja = {r["address"]: r["entity"] for r in sb("dog_labels?select=address,entity")}
    try:
        with open(os.path.join(WEB, "public", "data", "verified_addresses.json"), encoding="utf8") as fh:
            for a, v in (json.load(fh).get("verified") or {}).items():
                ja.setdefault(a, v.get("name") or "verificado")
    except Exception:
        pass
    print(f"  {len(ja)} endereços já identificados, fora da lista", flush=True)

    entra = defaultdict(set)      # quem mandou para este endereço
    sai = defaultdict(set)        # para quem este endereço mandou
    dog_in = defaultdict(float)
    dog_out = defaultdict(float)
    n_tx = defaultdict(int)
    repetidas = defaultdict(lambda: defaultdict(int))
    # ⚠️ O ELO COM QUEM JÁ TEM NOME É A PROVA MAIS ÚTIL DAQUI. Uma carteira que
    # varre depósitos e despeja TUDO na Gate.io é da Gate.io: é o `co_flow`, o
    # mesmo grau de prova que usamos para a tesouraria da Kraken. Sem isto o
    # script diz "isto parece corretora" e para, que é meio caminho.
    elo = defaultdict(lambda: defaultdict(float))

    # ⚠️ PAGINAÇÃO POR CHAVE, não por offset: offset profundo faz o Postgres varrer
    # e descartar, e a página 60 estoura o tempo. Já caímos nessa.
    cursor, lidas = "", 0
    while True:
        pagina = sb(
            "dog_transactions?select=txid,senders,receivers,block_height"
            f"&timestamp=gte.{urllib.parse.quote(desde)}&block_height=gte.{BLOCO_SAO}"
            f"&order=txid.asc&txid=gt.{cursor}&limit=1000")
        if not pagina:
            break
        for t in pagina:
            de = [s.get("address") for s in arr(t["senders"]) if s.get("address")]
            para = [(r.get("address"), float(r.get("amount_dog") or 0)) for r in arr(t["receivers"]) if r.get("address")]
            dede = set(de)
            for a in dede:
                n_tx[a] += 1
                for b, v in para:
                    if b in dede:
                        continue  # troco não é contraparte
                    sai[a].add(b)
                    dog_out[a] += v
                    repetidas[a][b] += 1
                    if b in ja:
                        elo[a][f"→ {ja[b]}"] += v
            for b, v in para:
                if b in dede:
                    continue
                n_tx[b] += 1
                dog_in[b] += v
                for a in dede:
                    entra[b].add(a)
                    repetidas[b][a] += 1
                    if a in ja:
                        elo[b][f"← {ja[a]}"] += v
        cursor = pagina[-1]["txid"]
        lidas += len(pagina)
        if lidas % 5000 == 0:
            print(f"    {lidas} transações", flush=True)
        if len(pagina) < 1000:
            break
    print(f"  {lidas} transações lidas · {len(n_tx)} endereços vistos\n", flush=True)

    fmt = lambda n: f"{n/1e9:.2f}B" if n >= 1e9 else f"{n/1e6:.1f}M" if n >= 1e6 else f"{n/1e3:.0f}K"
    linhas = []
    for a in set(list(entra) + list(sai)):
        if a in ja:
            continue
        ent, sd = len(entra[a]), len(sai[a])
        if max(ent, sd) < args.minimo:
            continue
        voltam = sum(1 for _, c in repetidas[a].items() if c > 1)
        # ⚠️ VARREDURA PRECISA DE MUITAS TRANSAÇÕES, NÃO DE MUITAS ENTRADAS. A
        # primeira versão chamou de "varredura de depósito" um endereço com 114
        # remetentes distintos que na verdade fez DUAS transações, uma delas com
        # 57 entradas: isso é uma consolidação única, não uma corretora recolhendo
        # depósito todo dia. Contar contraparte sem olhar quantas VEZES confunde
        # um evento com um hábito.
        episodico = n_tx[a] < max(8, args.minimo // 4)
        # a razão entre contrapartes de entrada e de saída é o que separa os formatos
        if episodico:
            forma = "consolidação de uma vez"
        elif ent >= args.minimo and sd <= 3 and ent >= 8 * max(sd, 1):
            forma = "varredura de depósito"
        elif ent >= args.minimo and sd >= args.minimo:
            forma = "carteira quente" if voltam < ent * 0.25 else "pool ou mercado"
        elif sd >= args.minimo and ent <= 3:
            forma = "distribuidor (saque?)"
        else:
            forma = "hub"
        linhas.append((max(ent, sd), a, forma, ent, sd, voltam, dog_in[a], dog_out[a], n_tx[a]))

    linhas.sort(reverse=True)
    print(f"  {len(linhas)} candidatos · mostrando {min(args.top, len(linhas))}\n")
    print(f"  {'formato':22} {'de':>5} {'para':>5} {'voltam':>6} {'recebeu':>9} {'mandou':>9}  endereço")
    for _, a, forma, ent, sd, voltam, di, do, _n in linhas[:args.top]:
        print(f"  {forma:22} {ent:>5} {sd:>5} {voltam:>6} {fmt(di):>9} {fmt(do):>9}  {a}")
        ligacoes = sorted(elo[a].items(), key=lambda x: -x[1])[:3]
        if ligacoes:
            print("       " + "   ".join(f"{k} {fmt(v)}" for k, v in ligacoes))

    destino = "/tmp/entity-candidates.json"
    with open(destino, "w", encoding="utf8") as fh:
        json.dump([{
            "address": a, "shape": forma, "senders_in": ent, "receivers_out": sd,
            "repeat_counterparties": voltam, "dog_in": di, "dog_out": do, "tx_count": n,
            "links_to_known": dict(sorted(elo[a].items(), key=lambda x: -x[1])),
        } for _, a, forma, ent, sd, voltam, di, do, n in linhas], fh, indent=1)
    print(f"\n  lista completa em {destino}")


if __name__ == "__main__":
    main()
