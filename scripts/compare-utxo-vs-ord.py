#!/usr/bin/env python3
"""O nosso conjunto de UTXOs contra o do ord, outpoint por outpoint.

⚠️ ESTE É O TESTE DECISIVO, e ele existe porque os testes mais baratos NÃO
respondem. Somar o supply não serve: quando o scanner deixa de ver uma transação,
a saída que ela gastou fica no nosso conjunto PARA SEMPRE, como fantasma. O total
continua fechando 100% e o erro fica escondido dentro dele. Só a comparação
outpoint a outpoint contra um indexador independente separa as três coisas:

    fantasma   está no nosso conjunto e não no do ord  → gastamos e não vimos
    ausente    está no do ord e não no nosso           → recebeu e não vimos
    divergente está nos dois com valores diferentes    → alocamos errado

⚠️ E O ORD É INDEPENDENTE DE VERDADE. Ele indexa a partir do mesmo nó, com
implementação própria do protocolo de runes, escrita por outra gente. Não é uma
segunda opinião nossa com roupa diferente.

    ord --data-dir .../ord/data balances > /tmp/ord-balances.json
    # a seção do DOG, em fluxo, porque o dump inteiro tem 1,2 GB:
    python3 - <<'EOF'
    ALVO = '"DOG' + chr(8226) + 'GO' + chr(8226) + 'TO' + chr(8226) + 'THE' + chr(8226) + 'MOON": {'
    # ... ver o extrator no commit que introduziu este arquivo
    EOF
    python3 scripts/compare-utxo-vs-ord.py
"""
import json
import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
NOSSO = RAIZ / "data" / "dog_utxo_set.json"
# ⚠️ A SEÇÃO DO DOG, JÁ EXTRAÍDA, e não o dump inteiro. O `ord balances` cospe
# 1,2 GB com TODOS os runes, e json.load disso numa máquina que roda o nó, o
# scanner e o watcher ao mesmo tempo derruba os três. O extrator em fluxo está
# documentado no cabeçalho do repositório desta função.
ORD = Path(os.environ.get("ORD_BALANCES", "/tmp/ord-dog-balances.json"))
DOG = "DOG•GO•TO•THE•MOON"


def fmt(raw: int) -> str:
    d = raw / 1e5
    return f"{d/1e9:.2f}B" if d >= 1e9 else f"{d/1e6:.2f}M" if d >= 1e6 else f"{d:,.2f}"


def main() -> None:
    if not ORD.exists():
        sys.exit(f"falta {ORD}: rode `ord balances` antes")
    bal = json.loads(ORD.read_text())
    # aceita tanto o dump inteiro quanto a seção do DOG já extraída
    dele = bal.get("runes", {}).get(DOG) if "runes" in bal else bal
    if not dele:
        sys.exit(f"nada de DOG em {ORD}")
    # o ord devolve {outpoint: amount} ou {outpoint: {amount: n, ...}}
    ord_map = {k: int(v["amount"] if isinstance(v, dict) else v) for k, v in dele.items()}
    nosso_map = {k: int(v) for k, v in json.loads(NOSSO.read_text()).items()}

    print(f"  nosso : {len(nosso_map):>8} outpoints · {fmt(sum(nosso_map.values()))} DOG")
    print(f"  ord   : {len(ord_map):>8} outpoints · {fmt(sum(ord_map.values()))} DOG\n")

    fantasmas = {k: v for k, v in nosso_map.items() if k not in ord_map}
    ausentes = {k: v for k, v in ord_map.items() if k not in nosso_map}
    divergentes = {k: (nosso_map[k], ord_map[k]) for k in nosso_map if k in ord_map and nosso_map[k] != ord_map[k]}

    tot = max(len(ord_map), 1)
    print(f"  FANTASMAS  {len(fantasmas):>7} ({100*len(fantasmas)/tot:5.2f}%)  {fmt(sum(fantasmas.values())):>10} DOG"
          "   gastamos e não vimos")
    print(f"  AUSENTES   {len(ausentes):>7} ({100*len(ausentes)/tot:5.2f}%)  {fmt(sum(ausentes.values())):>10} DOG"
          "   recebeu e não vimos")
    print(f"  DIVERGENTES{len(divergentes):>7} ({100*len(divergentes)/tot:5.2f}%)  "
          f"{fmt(sum(abs(a-b) for a, b in divergentes.values())):>10} DOG   alocamos errado")

    for nome, d in (("ausentes", ausentes), ("fantasmas", fantasmas)):
        if d:
            print(f"\n  maiores {nome}:")
            for k, v in sorted(d.items(), key=lambda x: -x[1])[:6]:
                print(f"    {k}  {fmt(v):>12} DOG")
    if divergentes:
        print("\n  maiores divergências (nosso -> ord):")
        for k, (a, b) in sorted(divergentes.items(), key=lambda x: -abs(x[1][0]-x[1][1]))[:6]:
            print(f"    {k}  {fmt(a)} -> {fmt(b)}")

    saida = "/tmp/utxo-diff.json"
    with open(saida, "w", encoding="utf8") as fh:
        json.dump({"fantasmas": fantasmas, "ausentes": ausentes,
                   "divergentes": {k: {"nosso": a, "ord": b} for k, (a, b) in divergentes.items()}}, fh)
    print(f"\n  diferença completa em {saida}")


if __name__ == "__main__":
    main()
