#!/usr/bin/env python3
"""A justificativa de um rótulo é PÚBLICA. Este script confere que ela não conta
mais do que devia.

⚠️ POR QUE ISTO EXISTE. Em 24/08/2026 o painel "Why we say this" entrou no ar
mostrando a coluna `evidence_note` inteira na página do endereço, e a nota da
carteira quente da Kraken dizia "sweeps the founder's own deposits: 7 deposits
from him". A prova era verdadeira e foi ela que nos convenceu. Mas publicada, ela
conta ao mundo que o fundador deposita na Kraken, e ao lado da carteira PÚBLICA de
doações dá para deduzir quando e quanto ele vendeu.

⚠️ E O ERRO NASCEU DE UMA MUDANÇA INOCENTE. A nota foi escrita quando ela era um
registro interno de por que acreditamos no rótulo. Meses (ou horas) depois, uma
tela nova passou a mostrá-la. Todo campo interno é um campo público esperando uma
tela nova, e é por isso que a checagem tem que ser mecânica.

A REGRA: o grau da prova pode ser `own_flow` (é verdade, temos os recibos), mas o
TEXTO público só carrega o que qualquer um consegue conferir sozinho na cadeia.
Quem é a contraparte fica de fora.

    python3 scripts/check-label-privacy.py        # sai != 0 se achar algo
"""
import json
import os
import re
import sys
import urllib.request

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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

# ⚠️ COM LIMITE DE PALAVRA. A primeira versão procurava "his " como substring e
# acusou "this ", que é ruído puro; alarme falso treina quem lê a ignorar o alarme.
PESSOAIS = re.compile(
    r"\b(founder|fundador|owner of this site|my |our own wallet|personal|pessoal|his|her|hers)\b",
    re.I,
)
# txid inteiro numa nota pública liga o rótulo a uma transação específica, e com
# ela a uma contraparte. Prefixo curto para ilustrar é aceitável; 64 hex não é.
TXID = re.compile(r"\b[0-9a-f]{40,64}\b", re.I)


def main() -> None:
    linhas = json.load(urllib.request.urlopen(
        urllib.request.Request(f"{SB}/rest/v1/dog_labels?select=address,entity,role,internal,evidence,evidence_note",
                               headers=H), timeout=60))
    publicas = [r for r in linhas if not r["internal"]]
    print(f"  {len(linhas)} rótulos · {len(publicas)} publicáveis · {len(linhas)-len(publicas)} interno(s)\n")

    problemas = []
    for r in publicas:
        nota = r.get("evidence_note") or ""
        nome = r["entity"] or f"({r['kind'] if 'kind' in r else 'classe'})"
        for regra, achado in (("pessoa", PESSOAIS.search(nota)), ("txid", TXID.search(nota))):
            if achado:
                problemas.append((nome, r["address"], regra, achado.group(0), nota[:110]))

    if not problemas:
        print("  nenhuma nota pública conta mais do que devia.")
        return
    print(f"  {len(problemas)} PROBLEMA(S):\n")
    for nome, addr, regra, achado, trecho in problemas:
        print(f"    [{regra}] {nome} · {addr[:22]}…")
        print(f"      achado: {achado!r}")
        print(f"      nota:   {trecho}\n")
    sys.exit(1)


if __name__ == "__main__":
    main()
