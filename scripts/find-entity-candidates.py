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

⚠️ ELE FALA O VOCABULÁRIO FECHADO, e isso não é detalhe. A classe proposta sai
com o mesmo nome que o banco aceita (CHECK da migração 008) e que a tela desenha
(lib/dog/taxonomy.ts). Antes ele dizia "pool ou mercado", que é uma frase bonita
e não é rótulo: ninguém consegue colar isso numa linha de `dog_labels` sem
traduzir na cabeça, e tradução na cabeça é onde entra o erro.

  exchange     recebe de MUITA gente distinta e varre para MUITO POUCOS destinos,
               ou paga saques para muitos. A razão entre contrapartes de entrada
               e de saída é o sinal forte.
  marketplace  aparece numa FATIA GRANDE de todas as transferências do ativo, com
               contrapartes que voltam. Casa duas pontas e não fica com o ativo.
  swap_pool    contrapartes que voltam e saldo permanente alto: negocia contra o
               próprio estoque.
  desk         volume alto nos dois sentidos COM corretoras já rotuladas, pouca
               contraparte de varejo. Gira estoque entre praças.
  distributor  um para muitos, repetidamente, com pouca fonte de entrada.

⚠️ E ELE NÃO PROPÕE NOME PRÓPRIO, SÓ CLASSE. Saber que uma carteira é um mercado
é uma conclusão da cadeia. Saber que ela é a UniSat é uma afirmação sobre uma
empresa, e nenhum número deste script sustenta isso.

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
    # ⚠️ O SALDO PARADO É O QUE SEPARA POOL DE MESA, e nenhuma contagem de
    # contraparte diz isso. Um pool GUARDA o estoque contra o qual negocia: o
    # saldo é o instrumento. Uma mesa GIRA estoque: passa muito mais volume do
    # que o saldo que carrega. A razão entre volume e saldo (o giro) separa os
    # dois num número só, e sem ela os dois caem na mesma gaveta.
    saldo = {}
    try:
        with open(os.path.join(WEB, "data", "dog_holders_by_address.json"), encoding="utf8") as fh:
            for h in json.load(fh).get("holders", []):
                if h.get("address"):
                    saldo[h["address"]] = float(h.get("total_dog") or 0)
    except Exception as e:
        print(f"  (sem arquivo de saldos: {e}) — o giro não entra na conta", flush=True)

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
    part = defaultdict(int)   # em quantas transações o endereço aparece, de qualquer lado
    total_tx = 0
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
            total_tx += 1
            de = [s.get("address") for s in arr(t["senders"]) if s.get("address")]
            para = [(r.get("address"), float(r.get("amount_dog") or 0)) for r in arr(t["receivers"]) if r.get("address")]
            dede = set(de)
            for a in dede | {b for b, _ in [(r.get("address"), 0) for r in arr(t["receivers"])] if b}:
                part[a] += 1
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
        # ⚠️ A PARTICIPAÇÃO É O QUE SEPARA MERCADO DE NEGOCIANTE, e ela não sai
        # da contagem de contrapartes: sai da fatia de TODAS as transferências em
        # que o endereço aparece. Uma carteira presente em 18% de tudo é
        # infraestrutura; uma com as mesmas contrapartes e presente em 0,5% é um
        # negociante ativo. Sem esta linha os dois caem na mesma gaveta.
        fatia = part[a] / max(total_tx, 1)
        volume = dog_in[a] + dog_out[a]
        bal = saldo.get(a, 0.0)
        giro = volume / bal if bal > 0 else float("inf")
        # quanto do volume desta carteira é com quem JÁ tem nome
        com_conhecidos = sum(elo[a].values()) / max(volume, 1)

        # ⚠️ A ORDEM DAS REGRAS IMPORTA, e a primeira versão errou nela. Ela punha
        # `exchange` antes de `desk` e classificou como corretora a carteira que
        # despejou 1,41 BILHÃO na Kraken. Corretora não joga o estoque inteiro
        # dentro de outra corretora: quem faz isso é mesa. O sinal é a fatia do
        # volume que acontece COM quem já tem nome; a contraparte de uma corretora
        # de verdade é varejo, não concorrente.
        if episodico:
            forma = "—"  # consolidação de uma vez: é um evento, não um hábito
        elif com_conhecidos >= 0.5:
            forma = "desk"
        elif fatia >= 0.03 and voltam >= ent * 0.25:
            forma = "marketplace"
        elif ent >= args.minimo and sd <= 3 and ent >= 8 * max(sd, 1):
            forma = "exchange"
        elif voltam >= ent * 0.25 and ent >= args.minimo and sd >= args.minimo and giro <= 12:
            # ⚠️ COM TETO DE GIRO: sem ele, qualquer carteira com contrapartes que
            # voltam virava "pool", inclusive uma que não guarda estoque nenhum.
            forma = "swap_pool"
        elif sd >= args.minimo and ent <= 3:
            forma = "distributor"
        else:
            forma = "—"
        linhas.append((max(ent, sd), a, forma, ent, sd, voltam, dog_in[a], dog_out[a], n_tx[a], bal, giro))

    linhas.sort(reverse=True)
    print(f"  {len(linhas)} candidatos · mostrando {min(args.top, len(linhas))}\n")
    print(f"  {'classe':13} {'fatia':>6} {'de':>5} {'para':>5} {'volta':>5} {'saldo':>9} {'giro':>6} {'recebeu':>9} {'mandou':>9}  endereço")
    for _, a, forma, ent, sd, voltam, di, do, _n, bal, giro in linhas[:args.top]:
        g = "∞" if giro == float("inf") else f"{giro:.1f}"
        print(f"  {forma:13} {100*part[a]/max(total_tx,1):>5.1f}% {ent:>5} {sd:>5} {voltam:>5} "
              f"{fmt(bal):>9} {g:>6} {fmt(di):>9} {fmt(do):>9}  {a}")
        ligacoes = sorted(elo[a].items(), key=lambda x: -x[1])[:3]
        if ligacoes:
            print("       " + "   ".join(f"{k} {fmt(v)}" for k, v in ligacoes))

    destino = "/tmp/entity-candidates.json"
    with open(destino, "w", encoding="utf8") as fh:
        json.dump([{
            "address": a, "kind": forma if forma != "—" else None,
            "participation": round(part[a] / max(total_tx, 1), 4), "senders_in": ent, "receivers_out": sd,
            "repeat_counterparties": voltam, "dog_in": di, "dog_out": do, "tx_count": n,
            "balance_dog": bal, "turnover": None if giro == float("inf") else round(giro, 2),
            "links_to_known": dict(sorted(elo[a].items(), key=lambda x: -x[1])),
        } for _, a, forma, ent, sd, voltam, di, do, n, bal, giro in linhas], fh, indent=1)
    print(f"\n  lista completa em {destino}")


if __name__ == "__main__":
    main()
