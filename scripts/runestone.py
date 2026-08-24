#!/usr/bin/env python3
"""O decodificador de runestone, em python puro. UMA implementação, dois donos.

⚠️ POR QUE ISTO VIROU MÓDULO. O `dog_block_scanner.py` decodificava chamando o
binário `ord` por transação (`ord decode --txid`), e o `dog_mempool_watcher.py`
decodificava em python. Duas implementações do mesmo protocolo no mesmo
repositório é uma promessa de divergência, e a do `ord` trazia junto um defeito
grave: a chamada era embrulhada em `except Exception: pass` e devolvia `None`, o
que a alocação lê como "esta transação não tem edict". Falha de processo externo
ficava indistinguível de transação sem edict, e o resultado era DOG alocado na
saída errada, em silêncio, com o erro se propagando para todo descendente.

⚠️ A EQUIVALÊNCIA FOI MEDIDA, NÃO SUPOSTA. 20.105 transações com runestone,
espalhadas do bloco 840.648 ao 963.800, decodificadas pelos dois caminhos: ZERO
diferenças. Foi essa medição que autorizou tirar o processo externo do caminho
quente.

⚠️ E TIRAR O `ord` DALI RESOLVE TRÊS COISAS DE UMA VEZ:
  1. some a falha silenciosa, porque não há mais processo para falhar;
  2. some a disputa pela trava do redb, que é single-writer: enquanto o scanner
     martelava o índice, qualquer outro uso do ord competia com ele;
  3. o replay fica reproduzível e muito mais rápido, sem um processo por
     transação.

O `ord` continua sendo a nossa referência para conferir. Ele só deixa de ser
dependência de quem grava.
"""
from __future__ import annotations

TAG_BODY, TAG_FLAGS, TAG_RUNE, TAG_PREMINE, TAG_CAP, TAG_AMOUNT = 0, 2, 4, 6, 8, 10
TAG_HEIGHT_START, TAG_HEIGHT_END, TAG_OFFSET_START, TAG_OFFSET_END = 12, 14, 16, 18
TAG_MINT, TAG_POINTER, TAG_CENOTAPH = 20, 22, 126
KNOWN_EVEN_TAGS = {
    TAG_BODY, TAG_FLAGS, TAG_RUNE, TAG_PREMINE, TAG_CAP, TAG_AMOUNT,
    TAG_HEIGHT_START, TAG_HEIGHT_END, TAG_OFFSET_START, TAG_OFFSET_END,
    TAG_MINT, TAG_POINTER, TAG_CENOTAPH,
}
U128_MAX = (1 << 128) - 1


def _leb128(payload: bytes):
    """Lista de inteiros, ou None se o último varint estiver truncado (cenotáfio)."""
    out = []
    i, n = 0, len(payload)
    while i < n:
        value = 0
        shift = 0
        while True:
            if i >= n:
                return None
            c = payload[i]
            i += 1
            value |= (c & 0x7F) << shift
            if c < 0x80:
                break
            shift += 7
            if shift > 127:
                return None
        if value > U128_MAX:
            return None
        out.append(value)
    return out


def _runestone_payload(script_hex: str):
    """Concatena os pushes de um `OP_RETURN OP_13 …`. None se não for runestone;
    False se for runestone com opcode que não é push (cenotáfio)."""
    b = bytes.fromhex(script_hex)
    if len(b) < 2 or b[0] != 0x6A or b[1] != 0x5D:
        return None
    i, payload = 2, b""
    while i < len(b):
        op = b[i]
        i += 1
        if 1 <= op <= 75:
            payload += b[i : i + op]
            i += op
        elif op == 0x4C:
            n = b[i]
            i += 1
            payload += b[i : i + n]
            i += n
        elif op == 0x4D:
            n = int.from_bytes(b[i : i + 2], "little")
            i += 2
            payload += b[i : i + n]
            i += n
        elif op == 0x4E:
            n = int.from_bytes(b[i : i + 4], "little")
            i += 4
            payload += b[i : i + n]
            i += n
        else:
            return False
    return payload


def decode_runestone(tx: dict):
    """{'edicts': [((block, tx), amount, output)], 'pointer': int|None,
        'cenotaph': bool, 'mint': bool} ou None quando a tx não tem runestone.
    O primeiro OP_RETURN OP_13 é o runestone; os demais são ignorados, como o ord."""
    n_out = len(tx.get("vout", []))
    for vout in tx.get("vout", []):
        payload = _runestone_payload(vout["scriptPubKey"]["hex"])
        if payload is None:
            continue
        rs = {"edicts": [], "pointer": None, "cenotaph": False, "mint": False}
        if payload is False:
            rs["cenotaph"] = True
            return rs
        ints = _leb128(payload)
        if ints is None:
            rs["cenotaph"] = True
            return rs
        i = 0
        while i < len(ints):
            tag = ints[i]
            i += 1
            if tag == TAG_BODY:
                body = ints[i:]
                if len(body) % 4 != 0:
                    rs["cenotaph"] = True
                blk = txi = 0
                for j in range(0, len(body) - 3, 4):
                    d_blk, d_tx, amount, output = body[j : j + 4]
                    if d_blk == 0:
                        txi += d_tx
                    else:
                        blk += d_blk
                        txi = d_tx
                    if output > n_out:
                        rs["cenotaph"] = True
                    rs["edicts"].append(((blk, txi), amount, output))
                break
            if i >= len(ints):
                # tag sem valor no fim: o ord trata como cenotáfio
                rs["cenotaph"] = True
                break
            value = ints[i]
            i += 1
            if tag == TAG_POINTER:
                if rs["pointer"] is None:
                    rs["pointer"] = value
                if value >= n_out:
                    rs["cenotaph"] = True
            elif tag == TAG_MINT:
                rs["mint"] = True
                if i < len(ints):
                    i += 1  # o mint é (block, tx): dois valores
            elif tag == TAG_CENOTAPH or (tag % 2 == 0 and tag not in KNOWN_EVEN_TAGS):
                rs["cenotaph"] = True
        return rs
    return None
