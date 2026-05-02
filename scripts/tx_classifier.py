#!/usr/bin/env python3
"""
Bitcoin transaction classifier (pure function, no DB, no loop).

Classifica cada tx de um bloco em:
  - coinbase            : tx coinbase (recompensa do minerador)
  - runes               : output OP_RETURN OP_13 (Runestone, inclui cenotaphs)
  - inscription         : witness contém envelope ord (0063036f7264)
  - op_return_protocol  : OP_RETURN com prefixo de protocolo conhecido (subclass setado)
  - op_return_other     : OP_RETURN genérico, sem protocolo identificado
  - financial           : nenhum dos acima

Cascata: ordem importa. Primeira regra que casa vence.

Uso:
    python3 tx_classifier.py --block 947500            # classifica 1 bloco, imprime agregado
    python3 tx_classifier.py --block 947500 --json     # imprime JSON detalhado por tx
    python3 tx_classifier.py --test                    # roda suite em blocos conhecidos
"""

import argparse
import json
import subprocess
import sys
from collections import Counter

BITCOIN_CLI = "bitcoin-cli"

# ── ord envelope: OP_FALSE OP_IF OP_PUSHBYTES_3 "ord" ─────────────────
ORD_ENVELOPE_HEX = "0063036f7264"

# ── OP_RETURN protocol prefixes (data-only, hex; coinbase commitment excluído) ──
# Cada entrada: (subclass_name, hex_prefix_or_substring, match_mode)
#   match_mode = "prefix" (começa com) ou "contains" (substring no payload)
OP_RETURN_PROTOCOLS = [
    ("babylon",   "62626e31",          "prefix"),    # "bbn1" — Babylon BTC staking
    ("lifi",      "3d7c6c696669",      "prefix"),    # "=|lifi" — LI.FI aggregator
    ("thorchain", "3a746f3a",          "contains"),  # ":to:" — TC OUT memos
    ("thorchain", "3d3a",              "prefix"),    # "=:"   — TC swap memos
    # OP_NET / Stamps / Atomicals: marcadores ainda não confirmados, ficam em "other"
]

# Segwit witness commitment (output do coinbase, não conta como OP_RETURN protocolar)
WITNESS_COMMITMENT_PREFIX = "aa21a9ed"


def bitcoin_cli(*args, timeout=120):
    r = subprocess.run([BITCOIN_CLI, *args], capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"bitcoin-cli {args[0]} failed: {r.stderr.strip()}")
    return r.stdout.strip()


def get_block(height: int) -> dict:
    h = bitcoin_cli("getblockhash", str(height))
    return json.loads(bitcoin_cli("getblock", h, "2"))


# ────────────────────────────────────────────────────────────────────────
# Detectors
# ────────────────────────────────────────────────────────────────────────

def is_coinbase(tx: dict) -> bool:
    vin = tx.get("vin", [])
    return bool(vin) and "coinbase" in vin[0]


def is_runestone(tx: dict) -> bool:
    """OP_RETURN seguido de OP_13 (= magic do Runestone)."""
    for vout in tx.get("vout", []):
        asm = vout.get("scriptPubKey", {}).get("asm", "")
        # Bitcoin Core renderiza OP_PUSHNUM_13 como "13" no asm
        if asm.startswith("OP_RETURN 13 ") or asm == "OP_RETURN 13":
            return True
    return False


def is_inscription(tx: dict) -> bool:
    """Algum input com envelope ord na witness."""
    for vin in tx.get("vin", []):
        for w in vin.get("txinwitness", []) or []:
            if ORD_ENVELOPE_HEX in w:
                return True
    return False


def detect_op_return_protocol(tx: dict) -> tuple[str | None, str | None]:
    """
    Procura OP_RETURN com prefixo conhecido.
    Retorna (subclass, raw_prefix) ou (None, None) se não OP_RETURN.
    Se OP_RETURN sem protocolo identificado: ('__other__', prefixo_hex).
    """
    found_op_return = False
    for vout in tx.get("vout", []):
        asm = vout.get("scriptPubKey", {}).get("asm", "")
        if not asm.startswith("OP_RETURN"):
            continue
        # Extrai os pushes depois do OP_RETURN; pega o primeiro push de dados em hex
        parts = asm.split()
        if len(parts) < 2:
            continue
        data_hex = parts[1].lower()
        # Coinbase witness commitment: ignora
        if data_hex.startswith(WITNESS_COMMITMENT_PREFIX):
            continue
        found_op_return = True
        for subclass, marker, mode in OP_RETURN_PROTOCOLS:
            if mode == "prefix" and data_hex.startswith(marker):
                return subclass, data_hex[:16]
            if mode == "contains" and marker in data_hex:
                return subclass, data_hex[:16]
        # OP_RETURN sem protocolo conhecido → marcar como "other" mas guardar prefixo
        return "__other__", data_hex[:16]
    return (None, None) if not found_op_return else ("__other__", None)


# ────────────────────────────────────────────────────────────────────────
# Cascata principal
# ────────────────────────────────────────────────────────────────────────

def classify_tx(tx: dict) -> dict:
    """
    Retorna {'class': str, 'subclass': str|None, 'op_return_prefix': str|None}.
    Cascata: coinbase → runes → inscription → op_return_protocol → op_return_other → financial.
    """
    if is_coinbase(tx):
        return {"class": "coinbase", "subclass": None, "op_return_prefix": None}
    if is_runestone(tx):
        return {"class": "runes", "subclass": None, "op_return_prefix": None}
    if is_inscription(tx):
        return {"class": "inscription", "subclass": None, "op_return_prefix": None}
    sub, prefix = detect_op_return_protocol(tx)
    if sub is not None and sub != "__other__":
        return {"class": "op_return_protocol", "subclass": sub, "op_return_prefix": prefix}
    if sub == "__other__":
        return {"class": "op_return_other", "subclass": None, "op_return_prefix": prefix}
    return {"class": "financial", "subclass": None, "op_return_prefix": None}


def classify_block(block: dict) -> dict:
    """
    Aplica classify_tx em todas as txs do bloco. Retorna agregado + lista detalhada.
    """
    rows = []
    for tx in block.get("tx", []):
        c = classify_tx(tx)
        rows.append({"txid": tx["txid"], **c})

    counts = Counter(r["class"] for r in rows)
    sub_counts = Counter(
        f"{r['class']}/{r['subclass']}" for r in rows if r["subclass"]
    )
    total = len(rows)
    return {
        "height": block.get("height"),
        "hash": block.get("hash"),
        "time": block.get("time"),
        "tx_count": total,
        "by_class": dict(counts),
        "by_subclass": dict(sub_counts),
        "pct": {k: round(100 * v / total, 2) for k, v in counts.items()} if total else {},
        "rows": rows,
    }


# ────────────────────────────────────────────────────────────────────────
# CLI / testes
# ────────────────────────────────────────────────────────────────────────

TEST_BLOCKS = [
    # (height, label, expectativa qualitativa)
    (700000,  "pre-Taproot/Ordinals/Runes", "100% financial + coinbase"),
    (779832,  "first inscription era",      "alguma inscription"),
    (840000,  "Runes activation block",     "primeiros runestones"),
    (947500,  "recente alta atividade",     "muitos runestones"),
    (947588,  "muito recente",              "smoke test"),
]


def print_summary(agg: dict, label: str = ""):
    h, n = agg["height"], agg["tx_count"]
    print(f"\n── block {h} ({label}) — {n} txs ──")
    width = max(len(k) for k in agg["by_class"]) if agg["by_class"] else 8
    for cls, cnt in sorted(agg["by_class"].items(), key=lambda x: -x[1]):
        pct = agg["pct"].get(cls, 0)
        print(f"  {cls:<{width}}  {cnt:>5}  ({pct:>5.2f}%)")
    if agg["by_subclass"]:
        print("  subclasses:")
        for sub, cnt in sorted(agg["by_subclass"].items(), key=lambda x: -x[1]):
            print(f"    {sub:<32}  {cnt:>5}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--block", type=int, help="block height")
    p.add_argument("--json", action="store_true", help="emit detailed JSON")
    p.add_argument("--test", action="store_true", help="run suite on TEST_BLOCKS")
    args = p.parse_args()

    if args.test:
        for height, label, _ in TEST_BLOCKS:
            try:
                blk = get_block(height)
                agg = classify_block(blk)
                print_summary(agg, label)
            except Exception as e:
                print(f"\n── block {height} ({label}) — ERROR: {e}")
        return

    if args.block is None:
        p.error("use --block <height> ou --test")

    blk = get_block(args.block)
    agg = classify_block(blk)
    if args.json:
        # Não despeja todas as rows (pode ser >4k); resume + amostra
        out = {**agg, "rows_sample": agg["rows"][:10], "rows": None}
        del out["rows"]
        print(json.dumps(out, indent=2))
    else:
        print_summary(agg)


if __name__ == "__main__":
    main()
