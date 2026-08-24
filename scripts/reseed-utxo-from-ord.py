#!/usr/bin/env python3
"""Reconstrói `dog_utxo_set.json` a partir do índice do ord.

⚠️ POR QUE ISTO É NECESSÁRIO, e por que é rápido. Os dois defeitos de alocação
(pointer ignorado sem edict, e o marcador de divisão com valor) entregaram DOG na
saída errada por meses. O conserto no código impede que aconteça de novo, mas NÃO
desfaz o conjunto de UTXOs que já foi montado errado: a partir dele, todo saldo
de holder sai torto.

Medido em 24/08/2026, comparando com o ord:

    22,22% do supply atribuído ao endereço errado
    a carteira quente da Kraken aparecia com 12,67B quando tem 23,35B
    o então #3 aparecia com 2,91B quando tem 0,69B

⚠️ E O ORD É A REFERÊNCIA CERTA PARA SEMEAR. Ele é a implementação de referência
do protocolo de runes, escrita por outra gente, indexando do mesmo nó. Não é uma
segunda opinião nossa: é a régua. O próprio scanner já tinha uma função
`ord_balances()` de bootstrap para isto, só nunca tinha sido usada para corrigir.

⚠️ O CONJUNTO NOVO PODE ESTAR ATRÁS DO NOSSO. O dump do ord é de um instante; o
scanner pode ter avançado alguns blocos depois. Por isso o script REBOBINA o
estado do scanner alguns blocos, para ele reprocessar a ponta com o conjunto
correto. Reprocessar é idempotente (upsert por txid).

    ord --data-dir .../ord/data balances > /tmp/ord-balances.json
    # extrair a seção do DOG (o dump inteiro tem 1,2 GB) -> /tmp/ord-dog-balances.json
    python3 scripts/reseed-utxo-from-ord.py --conferir     # não escreve nada
    python3 scripts/reseed-utxo-from-ord.py --aplicar
"""
import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
NOSSO = RAIZ / "data" / "dog_utxo_set.json"
ESTADO = RAIZ / "data" / "scanner_state.json"
ORD = Path("/tmp/ord-dog-balances.json")
REBOBINA = 30  # blocos que o scanner reprocessa depois da troca


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true", help="sem isto, só confere e sai")
    args = ap.parse_args()

    if not ORD.exists():
        sys.exit(f"falta {ORD}")
    novo = {k: int(v["amount"] if isinstance(v, dict) else v) for k, v in json.loads(ORD.read_text()).items()}
    velho = {k: int(v) for k, v in json.loads(NOSSO.read_text()).items()}

    print(f"  atual : {len(velho):>8} outpoints · {sum(velho.values())/1e5:>18,.0f} DOG")
    print(f"  ord   : {len(novo):>8} outpoints · {sum(novo.values())/1e5:>18,.0f} DOG")
    fora = len(set(velho) - set(novo))
    dentro = len(set(novo) - set(velho))
    print(f"  saem {fora} · entram {dentro} · mudam de valor "
          f"{sum(1 for k in set(velho)&set(novo) if velho[k]!=novo[k])}")

    # ⚠️ TRAVA DE SEGURANÇA. Se o conjunto do ord não somar perto de 100 bilhões,
    # o dump está truncado ou é de outro rune, e semear com ele seria trocar um
    # erro conhecido por um desconhecido.
    total = sum(novo.values()) / 1e5
    if not (99e9 <= total <= 100.1e9):
        sys.exit(f"  RECUSADO: o conjunto do ord soma {total:,.0f} DOG, fora da faixa do supply")
    print(f"  soma dentro da faixa do supply ({100*total/1e11:.3f}%)")

    if not args.aplicar:
        print("\n  (conferência apenas; use --aplicar para escrever)")
        return

    carimbo = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bkp = NOSSO.with_suffix(f".{carimbo}.bak.json")
    shutil.copy2(NOSSO, bkp)
    NOSSO.write_text(json.dumps(novo))
    print(f"\n  gravado. cópia do anterior em {bkp.name}")

    if ESTADO.exists():
        st = json.loads(ESTADO.read_text())
        antes = st.get("last_block")
        if isinstance(antes, int):
            st["last_block"] = antes - REBOBINA
            bkp2 = ESTADO.with_suffix(f".{carimbo}.bak.json")
            shutil.copy2(ESTADO, bkp2)
            ESTADO.write_text(json.dumps(st, indent=2))
            print(f"  scanner rebobinado de {antes} para {st['last_block']} "
                  f"para reprocessar a ponta com o conjunto certo")
    print("\n  agora reinicie o scanner:  sudo systemctl restart dog-scanner")


if __name__ == "__main__":
    main()
