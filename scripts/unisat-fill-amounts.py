#!/usr/bin/env python3
"""Fecha o terço que falta: quanto DOG cada remetente mandou, pela UniSat.

⚠️ O QUE SOBROU DO REPARO ANTERIOR. `rebuild-backfill-senders.py` resolveu QUEM
mandou em 111.799 transações órfãs, usando o nosso nó. Em 74.810 delas (67%) o
QUANTO saiu de graça, porque havia uma única entrada de 546 sats (o UTXO de rune)
e o resto era gás. Nas outras 36.989 há mais de uma candidata, e essas ficaram
gravadas com `attribution: pending` e valor NULO, nunca zero.

⚠️ E O ORD NÃO RESPONDE ISSO. Testado com 200 outpoints: ele devolve
`indexed: false, runes: {}, spent: true`, porque guarda saldo de rune só para o
conjunto de UTXOs VIVO. Saída gasta em 2024 não tem saldo no índice. Quem tem é a
API de eventos da UniSat, que é a mesma fonte que o pipeline vivo já usa.

TRÊS ARMADILHAS MEDIDAS NESSA API, e as três estão tratadas aqui:

  1. `limit=600` DEVOLVE ZERO EM SILÊNCIO, com `code: 0` de sucesso. O teto está
     entre 500 e 600. Pedir 500 traz 500; pedir 600 traz nada e parece que o
     bloco está vazio. É o tipo de defeito que vira buraco de dado sem ninguém
     perceber, e foi assim que a gente perdeu 23% do histórico da última vez.
  2. `start` PROFUNDO NÃO FUNCIONA. Acima de uns milhares o pedido expira, então
     paginar os 3,2 milhões de eventos de ponta a ponta está fora de questão. O
     caminho é o filtro por BLOCO, que responde bem.
  3. SEM `User-Agent` O CLOUDFLARE BLOQUEIA com 403 e `error code: 1010`. O
     urllib do Python manda `Python-urllib/3.x`, que está na lista negra.
  4. O LIMITE DE TAXA TAMBÉM VEM COMO 403, mas com `code: -2006` no corpo, e é
     por hora, não por segundo: recuar 15 segundos não adianta nada. Esta é a
     armadilha que efetivamente MORDEU, em 24/08/2026. A versão anterior tratava
     403 como algo a insistir, desistia depois de cinco tentativas, devolvia
     lista vazia e AVANÇAVA O CURSOR. Bloco recusado ficou indistinguível de
     bloco vazio, e 1.079 blocos passaram sem gravar um evento sequer, com o
     progresso subindo na tela o tempo todo. É o mesmo defeito que nos custou 23%
     do histórico da outra vez, com outra roupa.

⚠️ A REGRA QUE SAIU DISSO, e ela vale para qualquer coletor daqui em diante:
CURSOR SÓ ANDA SOBRE RESPOSTA, NUNCA SOBRE SILÊNCIO. Se a fonte recusou, o
programa PARA e diz onde parou. Parar é barato; buraco no histórico não é, porque
ninguém descobre no dia, descobre meses depois, quando alguém pergunta.

Ritmo medido: 2,6 pedidos por segundo em série, sem erro. Com concorrência de 4
já aparecem 403. São 23.359 blocos, então umas duas horas e meia. Não há pressa:
o elo já está fechado, isto aqui é refinamento de valor.

    python3 scripts/unisat-fill-amounts.py
"""
import json
import os
import re
import time
import urllib.error
import urllib.request

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = "/tmp/unisat-events.jsonl"
CURSOR = "/tmp/unisat-cursor.txt"
RUNE = "DOG%E2%80%A2GO%E2%80%A2TO%E2%80%A2THE%E2%80%A2MOON"
LIMITE = 500  # ver armadilha 1. NÃO subir para 600.


def env(name: str) -> str:
    if os.environ.get(name):
        return os.environ[name]
    for line in open(os.path.join(WEB, ".env.local"), encoding="utf8"):
        m = re.match(rf"^{name}=(.*)$", line.strip())
        if m:
            return m.group(1).strip().strip("'\"")
    raise SystemExit(f"falta {name}")


SB, KEY, TOKEN = env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), env("UNISAT_API_TOKEN")
H_SB = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
# ver armadilha 3
H_UNI = {"Authorization": f"Bearer {TOKEN}", "User-Agent": "DogData Explorer/1.0"}


class Recusado(Exception):
    """A fonte não respondeu. NÃO é o mesmo que ela ter respondido "nada"."""


def pegar(url: str, headers: dict, tentativas: int = 6):
    """Devolve o JSON, ou levanta `Recusado`.

    ⚠️ NUNCA DEVOLVE None. Ver armadilha 4: o valor de retorno que quer dizer
    "não consegui" acaba lido como "não tem nada lá", e a diferença entre as duas
    é um buraco no histórico."""
    for n in range(tentativas):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=40) as res:
                return json.load(res)
        except urllib.error.HTTPError as e:
            corpo = b""
            try:
                corpo = e.read()
            except Exception:
                pass
            # -2006 é cota da hora, não rajada do segundo: recuo curto não resolve
            cota = b"-2006" in corpo or b"exceeds rate limit" in corpo
            if e.code in (403, 429) and n < tentativas - 1:
                time.sleep(60 * (n + 1) if cota else 2 ** n)
                continue
            raise Recusado(f"HTTP {e.code} {corpo[:120]!r}")
        except Exception as exc:
            if n == tentativas - 1:
                raise Recusado(f"{type(exc).__name__}: {exc}")
            time.sleep(1 + n)
    raise Recusado("tentativas esgotadas")


def alturas_pendentes() -> list[int]:
    """Os blocos das transações ambíguas, em ordem, por paginação de chave."""
    vistos: set[int] = set()
    cursor = ""
    while True:
        page = pegar(
            f"{SB}/rest/v1/dog_tx_senders_rebuilt?select=txid&dog_attribution=eq.ambiguous"
            f"&order=txid.asc&txid=gt.{cursor}&limit=1000", H_SB)
        if not page:
            break  # lista vazia de verdade: acabou a paginação
        ids = [r["txid"] for r in page]
        # a altura vem da tabela principal, em blocos de mil ids
        for i in range(0, len(ids), 200):
            lote = ",".join(ids[i:i + 200])
            alt = pegar(f"{SB}/rest/v1/dog_transactions?select=block_height&txid=in.({lote})", H_SB)
            for r in alt or []:
                if r.get("block_height"):
                    vistos.add(r["block_height"])
        cursor = ids[-1]
        if len(page) < 1000:
            break
    return sorted(vistos)


def eventos_do_bloco(h: int) -> list[dict]:
    """Todos os eventos de DOG num bloco, paginando dentro dele se precisar."""
    fora, start = [], 0
    while True:
        # se a UniSat recusar, a exceção sobe e o laço principal PARA. Ver armadilha 4.
        d = pegar(
            f"https://open-api.unisat.io/v1/indexer/runes/event?rune={RUNE}"
            f"&start={start}&limit={LIMITE}&height={h}", H_UNI)
        det = (d.get("data") or {}).get("detail") or []
        fora += det
        if len(det) < LIMITE:
            return fora
        start += LIMITE


def main() -> None:
    print("  levantando os blocos das transações ambíguas…", flush=True)
    alturas = alturas_pendentes()
    print(f"  {len(alturas)} blocos", flush=True)

    feito = 0
    if os.path.exists(CURSOR):
        feito = int(open(CURSOR).read().strip() or 0)
        alturas = [h for h in alturas if h > feito]
        print(f"  retomando depois do bloco {feito}: faltam {len(alturas)}", flush=True)

    t0 = time.time()
    total_ev = 0
    with open(SAIDA, "a", encoding="utf8", buffering=1) as fh:
        for i, h in enumerate(alturas, 1):
            try:
                eventos = eventos_do_bloco(h)
            except Recusado as exc:
                # ⚠️ PARAR, NÃO PULAR. O cursor fica no último bloco GRAVADO, então
                # é só rodar de novo quando a cota virar.
                print(f"\n  a UniSat recusou no bloco {h}: {exc}")
                print(f"  parando aqui. cursor em {feito if i == 1 else alturas[i - 2]}, "
                      f"faltam {len(alturas) - i + 1} blocos. rode de novo quando a cota virar.")
                break
            for e in eventos:
                fh.write(json.dumps(e) + "\n")
                total_ev += 1
            # ⚠️ o cursor só avança DEPOIS de gravar, senão uma queda pula o bloco
            with open(CURSOR, "w") as c:
                c.write(str(h))
            if i % 200 == 0:
                dt = time.time() - t0
                print(f"    {i}/{len(alturas)} blocos · {total_ev} eventos · "
                      f"{i/dt:.1f} bl/s · faltam ~{(len(alturas)-i)/max(i/dt,0.1)/60:.0f} min", flush=True)
    print(f"\n  {total_ev} eventos em {(time.time()-t0)/60:.1f} min")


if __name__ == "__main__":
    main()
