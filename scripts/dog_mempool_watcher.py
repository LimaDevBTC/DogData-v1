#!/usr/bin/env python3
"""DOG mempool watcher: a órbita da praça.

Spec: praca-central.md §1 e §4 (fase 1). Roda nesta máquina, ao lado do bitcoind,
e escreve no Supabase (DOGDATA) o que o nosso nó vê da mempool sobre o DOG:

  dog_mempool        uma linha por tx de DOG, `pending` (em órbita) → `confirmed`
                     (pousou, com bloco) ou `dropped` (sumiu sem bloco)
  mempool_snapshot   uma linha: tamanho da mempool, taxas, topo da cadeia, resumo

Como decide que uma tx é de DOG, sem o `ord` (o ord.service fica inativo pelo lock
do redb, e o caminho quente de uma cena ao vivo não pode disputar esse lock):

  1. decodifica o runestone (OP_RETURN OP_13, LEB128, edicts com id delta) e vê se
     há edict do DOG (840000:3)                                → transferência explícita
  2. cruza as ENTRADAS com o conjunto de UTXOs de DOG que o dog_block_scanner.py
     mantém em data/dog_utxo_set.json (outpoint → quantia bruta), mais as saídas
     das txs de DOG ainda pendentes (encadeamento na mempool) → transferência implícita

A quantia de DOG que entra é a soma das entradas conhecidas; a alocação nas saídas
segue as regras do protocolo como o scanner as implementa (edict com output ==
n_outputs divide entre todas as saídas não OP_RETURN, > n é cenotáfio, resto vai
para o pointer ou primeira saída não OP_RETURN, sem saída válida é queima).

Uso:
  python3 scripts/dog_mempool_watcher.py                # daemon, 5 s
  python3 scripts/dog_mempool_watcher.py --once         # uma volta e sai
  python3 scripts/dog_mempool_watcher.py --dry-run      # não escreve no Supabase

Env (.env.local do projeto): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
Opcionais: BITCOIN_RPC_URL (default http://127.0.0.1:8332), BITCOIN_DATADIR
(default ~/.bitcoin, de onde sai o cookie), MEMPOOL_POLL_SECONDS (5).
"""
import argparse
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.request
from base64 import b64encode
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

# ─── ambiente ────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
UTXO_SET_FILE = DATA_DIR / "dog_utxo_set.json"
# Estado fora do repositório: o bot de auto-commit faz `git add -A` de hora em hora,
# e a órbita de agora não é dado para versionar.
STATE_DIR = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "dogdata"
STATE_FILE = STATE_DIR / "mempool_watcher_state.json"


def _load_env():
    """Lê .env.local e .env como o scanner faz, sem exigir python-dotenv."""
    for name in (".env", ".env.local"):
        p = PROJECT_ROOT / name
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
                v = v[1:-1]
            if k and k not in os.environ:
                os.environ[k] = v


_load_env()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
RPC_URL = os.environ.get("BITCOIN_RPC_URL", "http://127.0.0.1:8332")
DATADIR = Path(os.environ.get("BITCOIN_DATADIR", Path.home() / ".bitcoin"))
POLL_SECONDS = float(os.environ.get("MEMPOOL_POLL_SECONDS", "5"))

DOG_ID = (840000, 3)
DOG_DIVISOR = Decimal(10) ** 5
RETENTION_HOURS = 24
BATCH = 40  # chamadas por lote JSON-RPC

log = logging.getLogger("dog-mempool")


# ─── RPC do bitcoind, por HTTP, com lote ─────────────────────────────────────


class Rpc:
    """JSON-RPC com autenticação por cookie (ou rpcuser/rpcpassword do bitcoin.conf).

    Em lote de propósito: uma mempool cheia tem dezenas de milhares de txs, e um
    subprocesso `bitcoin-cli` por tx levaria meia hora só para o primeiro giro. Um
    POST com quarenta chamadas dentro leva o mesmo tempo que uma.
    """

    def __init__(self, url: str, datadir: Path):
        self.url = url
        self.auth = self._auth(datadir)
        self._id = 0

    @staticmethod
    def _auth(datadir: Path) -> str:
        cookie = datadir / ".cookie"
        if cookie.exists():
            raw = cookie.read_text().strip()
        else:
            user = pw = ""
            conf = datadir / "bitcoin.conf"
            if conf.exists():
                for line in conf.read_text().splitlines():
                    if line.startswith("rpcuser="):
                        user = line.split("=", 1)[1].strip()
                    elif line.startswith("rpcpassword="):
                        pw = line.split("=", 1)[1].strip()
            raw = f"{user}:{pw}"
        return "Basic " + b64encode(raw.encode()).decode()

    def _post(self, payload, timeout=120):
        req = urllib.request.Request(
            self.url,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "Authorization": self.auth},
        )
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read())

    def call(self, method: str, *params):
        self._id += 1
        out = self._post({"jsonrpc": "1.0", "id": self._id, "method": method, "params": list(params)})
        if out.get("error"):
            raise RuntimeError(f"{method}: {out['error']}")
        return out["result"]

    def batch(self, calls):
        """[(method, params), ...] → [result | None]. Erro numa chamada não derruba o lote."""
        results = []
        for i in range(0, len(calls), BATCH):
            chunk = calls[i : i + BATCH]
            payload = []
            for j, (method, params) in enumerate(chunk):
                self._id += 1
                payload.append({"jsonrpc": "1.0", "id": f"{self._id}-{j}", "method": method, "params": list(params)})
            out = self._post(payload)
            by_id = {o.get("id"): o for o in out} if isinstance(out, list) else {}
            for j in range(len(chunk)):
                o = by_id.get(payload[j]["id"])
                results.append(None if not o or o.get("error") else o.get("result"))
        return results


# ─── runestone ───────────────────────────────────────────────────────────────

# Tags do protocolo. Par = obrigatório entender; ímpar = pode ignorar.
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


def allocate_dog(tx: dict, dog_in_raw: int, rs):
    """Onde o DOG que entrou vai parar. Devolve (alloc {vout: raw}, burn_raw, explicit).

    Espelha `allocate_dog_outputs` do dog_block_scanner.py, com o pointer também
    valendo na transferência implícita (o protocolo o aplica em ambas)."""
    outs = tx.get("vout", [])
    n_out = len(outs)
    non_opret = [i for i, o in enumerate(outs) if o.get("scriptPubKey", {}).get("type") != "nulldata"]
    if rs and rs["cenotaph"]:
        return {}, dog_in_raw, bool(rs["edicts"])
    dog_edicts = [(out, amt) for (rid, amt, out) in (rs["edicts"] if rs else []) if rid == DOG_ID]
    alloc: dict[int, int] = {}
    allocated = 0
    if dog_edicts:
        for output_idx, amount in dog_edicts:
            remaining = dog_in_raw - allocated
            if remaining <= 0:
                break
            if output_idx == n_out:
                to_split = remaining if amount == 0 else min(amount, remaining)
                if non_opret and to_split > 0:
                    n = len(non_opret)
                    per, left = divmod(to_split, n)
                    if per > 0:
                        for idx in non_opret:
                            alloc[idx] = alloc.get(idx, 0) + per
                    if left > 0:
                        alloc[non_opret[0]] = alloc.get(non_opret[0], 0) + left
                    allocated += to_split
            elif output_idx < n_out:
                amt = remaining if amount == 0 else min(amount, remaining)
                if amt > 0:
                    alloc[output_idx] = alloc.get(output_idx, 0) + amt
                    allocated += amt
    remainder = dog_in_raw - allocated
    burn = 0
    if remainder > 0:
        pointer = rs["pointer"] if rs else None
        if pointer is not None and pointer < n_out and outs[pointer].get("scriptPubKey", {}).get("type") != "nulldata":
            alloc[pointer] = alloc.get(pointer, 0) + remainder
        elif non_opret:
            alloc[non_opret[0]] = alloc.get(non_opret[0], 0) + remainder
        else:
            burn = remainder
    # DOG alocado a uma saída OP_RETURN é queima (edict apontando para o OP_RETURN)
    for idx in list(alloc):
        if outs[idx].get("scriptPubKey", {}).get("type") == "nulldata":
            burn += alloc.pop(idx)
    return alloc, burn, bool(dog_edicts)


def dog(raw: int) -> str:
    """Bruto → DOG com cinco casas, como string exata para a coluna numeric."""
    return str((Decimal(raw) / DOG_DIVISOR).quantize(Decimal("0.00001")))


# ─── o conjunto de UTXOs de DOG ──────────────────────────────────────────────


class DogUtxos:
    """O `dog_utxo_set.json` do scanner (outpoint → quantia bruta), relido quando muda,
    mais as saídas das txs de DOG ainda pendentes (encadeamento dentro da mempool)."""

    def __init__(self, path: Path):
        self.path = path
        self.mtime = 0.0
        self.confirmed: dict[str, int] = {}
        self.pending: dict[str, int] = {}
        self.graduated: dict[str, float] = {}
        self.reload()

    def reload(self):
        self.sweep()
        try:
            mtime = self.path.stat().st_mtime
        except FileNotFoundError:
            log.warning("sem %s: só a transferência explícita será vista", self.path.name)
            return
        if mtime == self.mtime:
            return
        with open(self.path) as f:
            data = json.load(f)
        self.confirmed = {k: int(v) for k, v in data.items()}
        self.mtime = mtime
        log.info("UTXO set: %d outpoints de DOG", len(self.confirmed))

    def get(self, outpoint: str):
        v = self.confirmed.get(outpoint)
        if v is not None:
            return v
        return self.pending.get(outpoint)

    def graduate(self, txids):
        """Saídas de txs que pousaram: ficam mais 10 min como pendentes e depois saem,
        porque a essa altura o scanner já as tem no arquivo."""
        deadline = time.time() + 600
        for op in list(self.pending):
            if op.split(":")[0] in txids:
                self.graduated[op] = deadline

    def sweep(self):
        now = time.time()
        for op, until in list(self.graduated.items()):
            if now > until:
                self.pending.pop(op, None)
                self.graduated.pop(op, None)


# ─── Supabase ────────────────────────────────────────────────────────────────


class Supa:
    def __init__(self, url: str, key: str, dry: bool):
        self.url, self.key, self.dry = url, key, dry
        if not url or not key:
            log.warning("Supabase não configurado: rodando a seco")
            self.dry = True

    def _req(self, method: str, path: str, body=None, prefer="return=minimal"):
        if self.dry:
            return True
        req = urllib.request.Request(
            f"{self.url}/rest/v1/{path}",
            data=json.dumps(body).encode() if body is not None else None,
            method=method,
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                "Prefer": prefer,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                res.read()
            return True
        except urllib.error.HTTPError as e:
            log.error("supabase %s %s: HTTP %s %s", method, path.split("?")[0], e.code, e.read()[:200])
            return False
        except Exception as e:  # noqa: BLE001
            log.error("supabase %s %s: %s", method, path.split("?")[0], e)
            return False

    def upsert_rows(self, rows):
        if not rows:
            return True
        return self._req("POST", "dog_mempool?on_conflict=txid", rows, "resolution=merge-duplicates,return=minimal")

    def patch(self, txids, body):
        if not txids:
            return True
        ok = True
        for i in range(0, len(txids), 100):
            chunk = ",".join(txids[i : i + 100])
            ok = self._req("PATCH", f"dog_mempool?txid=in.({chunk})", body) and ok
        return ok

    def snapshot(self, row):
        return self._req("POST", "mempool_snapshot?on_conflict=id", row, "resolution=merge-duplicates,return=minimal")

    def prune(self, before_iso: str):
        return self._req("DELETE", f"dog_mempool?status=neq.pending&updated_at=lt.{before_iso}")

    def pending_txids(self):
        """As pendentes que o banco conhece, para o watcher retomar depois de um restart."""
        if self.dry:
            return []
        req = urllib.request.Request(
            # ⚠️ `senders` PRECISA VIR JUNTO: sem ele o `liquido()` não sabe separar
            # troco de pagamento e cai no bruto, e aí a correção do painel valeria
            # só para as transações vistas depois do restart. Defeito que só
            # apareceria em reinício, que é quando ninguém está olhando.
            f"{self.url}/rest/v1/dog_mempool?status=eq.pending"
            f"&select=txid,dog_in,first_seen,senders,receivers&limit=2000",
            headers={"apikey": self.key, "Authorization": f"Bearer {self.key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                return json.loads(res.read())
        except Exception as e:  # noqa: BLE001
            log.error("supabase pending: %s", e)
            return []


# ─── o watcher ───────────────────────────────────────────────────────────────


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ts_iso(unix: int) -> str:
    return datetime.fromtimestamp(unix, tz=timezone.utc).isoformat()


class Watcher:
    def __init__(self, rpc: Rpc, supa: Supa, utxos: DogUtxos):
        self.rpc, self.supa, self.utxos = rpc, supa, utxos
        self.known: set[str] = set()          # txids na mempool na última leitura
        self.non_dog: set[str] = set()        # txids já olhados e sem DOG
        self.pending: dict[str, dict] = {}    # txid → linha (as de DOG em órbita)
        self.tip = 0
        self.last_snapshot = 0.0
        self.last_prune = 0.0
        self.last_dog_block = None            # {'height','time','count','amount'}
        self._load_state()

    # estado mínimo entre reinícios: o topo processado e o último bloco com DOG
    def _load_state(self):
        try:
            s = json.loads(STATE_FILE.read_text())
            self.tip = int(s.get("tip", 0))
            self.last_dog_block = s.get("last_dog_block")
        except Exception:  # noqa: BLE001
            pass

    def _save_state(self):
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps({"tip": self.tip, "last_dog_block": self.last_dog_block}))

    def resume(self):
        """Depois de um restart, as pendentes do banco voltam a ser vigiadas."""
        for row in self.supa.pending_txids():
            self.pending[row["txid"]] = {"txid": row["txid"], "dog_in": row.get("dog_in"), "first_seen": row.get("first_seen")}
        if self.pending:
            log.info("retomando %d tx(s) pendente(s) do banco", len(self.pending))

    # ── detecção ──

    def inspect(self, tx: dict):
        """None se a tx não move DOG; senão a linha (sem taxa) e a lista de entradas de DOG."""
        rs = decode_runestone(tx)
        # entradas
        dog_inputs = []  # (outpoint, raw)
        for vin in tx.get("vin", []):
            if "txid" not in vin:
                continue
            op = f"{vin['txid']}:{vin['vout']}"
            raw = self.utxos.get(op)
            if raw:
                dog_inputs.append((op, raw))
        explicit = bool(rs and any(rid == DOG_ID for (rid, _a, _o) in rs["edicts"]))
        if not dog_inputs and not explicit:
            return None
        dog_in_raw = sum(r for _, r in dog_inputs)
        if dog_in_raw == 0 and explicit:
            # Edict de DOG sem entrada conhecida: o set do scanner está atrasado ou a
            # origem é uma saída que ele não viu. A soma dos edicts é a melhor leitura
            # da quantia; o pointer/resto não dá para saber, então só o explícito conta.
            dog_in_raw = sum(a for (rid, a, _o) in rs["edicts"] if rid == DOG_ID and a > 0)
        alloc, burn, _ = allocate_dog(tx, dog_in_raw, rs) if dog_in_raw > 0 else ({}, 0, explicit)
        receivers = []
        for idx, raw in sorted(alloc.items()):
            spk = tx["vout"][idx].get("scriptPubKey", {})
            receivers.append({"address": spk.get("address") or f"vout:{idx}", "dog": dog(raw)})
        row = {
            "txid": tx["txid"],
            "dog_in": dog(dog_in_raw),
            "dog_out": dog(sum(alloc.values())),
            "dog_burn": dog(burn),
            "explicit_edict": explicit,
            "cenotaph": bool(rs and rs["cenotaph"]),
            "receivers": receivers,
            "n_in": len(tx.get("vin", [])),
            "n_out": len(tx.get("vout", [])),
        }
        return row, dog_inputs, alloc

    @staticmethod
    def liquido(row) -> Decimal:
        """Quanto DOG mudou de mão nesta linha, troco descontado.

        ⚠️ `dog_in` É O UTXO INTEIRO GASTO, NÃO A TRANSFERÊNCIA. Rune mora num
        UTXO: mandar 10 mil de um UTXO de 600 mil gasta os 600 mil, entrega 10 mil
        e devolve 590 mil para quem mandou. Somar `dog_in` no painel anuncia uma
        doação sessenta vezes maior do que a que aconteceu, e foi exatamente isso
        que o fundador viu em 24/08/2026.

        A regra é a mesma que o `update-transactions` usa nas confirmadas desde
        sempre, e agora também vive em lib/dog/net-transfer.ts para as telas: só
        conta a saída cujo endereço NÃO está entre os remetentes.

        ⚠️ SEM REMETENTE RESOLVIDO, o bruto é a melhor leitura que existe: não há
        como separar troco de pagamento sem saber de quem partiu."""
        de = set(row.get("senders") or [])
        saidas = row.get("receivers") or []
        bruto = sum(Decimal(str(r.get("dog") or 0)) for r in saidas)
        if not de:
            return bruto
        troco = sum(Decimal(str(r.get("dog") or 0)) for r in saidas if r.get("address") in de)
        return max(bruto - troco, Decimal(0))

    def senders_of(self, dog_inputs):
        """Endereço de cada entrada de DOG, via gettxout (funciona enquanto não confirma)."""
        if not dog_inputs:
            return []
        calls = []
        for op, _ in dog_inputs:
            txid, vout = op.split(":")
            calls.append(("gettxout", [txid, int(vout), True]))
        out = self.rpc.batch(calls)
        seen, addrs, missing = set(), [], []
        for (op, _), o in zip(dog_inputs, out):
            a = (o or {}).get("scriptPubKey", {}).get("address") if o else None
            if a:
                if a not in seen:
                    seen.add(a)
                    addrs.append(a)
            else:
                missing.append(op)
        # Já gasto (a tx pousou antes de a gente perguntar): o nó tem txindex, então
        # a transação de origem responde.
        if missing:
            prev = self.rpc.batch([("getrawtransaction", [op.split(":")[0], True]) for op in missing])
            for op, ptx in zip(missing, prev):
                if not ptx:
                    continue
                vout = int(op.split(":")[1])
                a = ptx["vout"][vout].get("scriptPubKey", {}).get("address") if vout < len(ptx.get("vout", [])) else None
                if a and a not in seen:
                    seen.add(a)
                    addrs.append(a)
        return addrs

    # ── a mempool ──

    def scan_mempool(self):
        mp = set(self.rpc.call("getrawmempool"))
        new = [t for t in mp if t not in self.known and t not in self.non_dog and t not in self.pending]
        gone = [t for t in self.pending if t not in mp]
        self.known = mp
        self.non_dog &= mp  # esquece o que já saiu

        found = 0
        for i in range(0, len(new), 400):
            chunk = new[i : i + 400]
            txs = self.rpc.batch([("getrawtransaction", [t, True]) for t in chunk])
            rows, meta_calls, extra = [], [], []
            for txid, tx in zip(chunk, txs):
                if not tx:
                    continue  # saiu da mempool entre as duas chamadas
                r = self.inspect(tx)
                if r is None:
                    self.non_dog.add(txid)
                    continue
                row, dog_inputs, alloc = r
                rows.append(row)
                meta_calls.append(("getmempoolentry", [txid]))
                extra.append((dog_inputs, alloc))
            if not rows:
                continue
            metas = self.rpc.batch(meta_calls)
            for row, meta, (dog_inputs, alloc) in zip(rows, metas, extra):
                fee_btc = ((meta or {}).get("fees") or {}).get("base")
                vsize = (meta or {}).get("vsize")
                row["fee_sats"] = int(round(fee_btc * 1e8)) if fee_btc is not None else None
                row["vsize"] = vsize
                row["fee_rate"] = str(round(row["fee_sats"] / vsize, 2)) if row["fee_sats"] and vsize else None
                row["rbf"] = bool((meta or {}).get("bip125-replaceable", False))
                row["first_seen"] = ts_iso(meta["time"]) if meta and meta.get("time") else now_iso()
                row["seen_pending"] = True
                row["status"] = "pending"
                row["senders"] = self.senders_of(dog_inputs)
                row["updated_at"] = now_iso()
                self.pending[row["txid"]] = row
                for idx, raw in alloc.items():
                    self.utxos.pending[f"{row['txid']}:{idx}"] = raw
                found += 1
                log.info(
                    "  em órbita  %s  %s DOG  %s sat/vB  %s",
                    row["txid"][:12], row["dog_in"], row["fee_rate"], "edict" if row["explicit_edict"] else "implícita",
                )
            self.supa.upsert_rows(rows)
            if len(new) > 2000:
                log.info("  varredura inicial: %d/%d", min(i + 400, len(new)), len(new))

        # sumiu da mempool e não pousou: caiu (RBF, expulsão, conflito)
        if gone:
            self.supa.patch(gone, {"status": "dropped", "dropped_at": now_iso(), "updated_at": now_iso()})
            for t in gone:
                self.pending.pop(t, None)
                log.info("  caiu       %s", t[:12])
        return found

    # ── o bloco ──

    def scan_blocks(self, height: int):
        """Do topo processado até `height`: quem estava pendente e entrou pousou; quem
        chegou direto no bloco (entre duas leituras, ou pelo minerador) entra como
        confirmada com seen_pending=false. Devolve quantas txs de DOG o último bloco teve."""
        if self.tip == 0:
            self.tip = height  # primeira partida: não revisita a história
            self._save_state()
            return
        for h in range(self.tip + 1, height + 1):
            bh = self.rpc.call("getblockhash", h)
            blk = self.rpc.call("getblock", bh, 2)
            btime = ts_iso(blk["time"])
            landed, unseen = [], []
            for tx in blk["tx"]:
                txid = tx["txid"]
                if txid in self.pending:
                    landed.append(txid)
                    continue
                if txid in self.non_dog:
                    continue
                r = self.inspect(tx)
                if r is not None:
                    row, dog_inputs, alloc = r
                    row.update({
                        "status": "confirmed", "seen_pending": False, "first_seen": btime,
                        "block_height": h, "block_time": btime, "confirmed_at": now_iso(),
                        "senders": self.senders_of(dog_inputs), "updated_at": now_iso(),
                    })
                    unseen.append(row)
            self.supa.patch(landed, {"status": "confirmed", "block_height": h, "block_time": btime,
                                     "confirmed_at": now_iso(), "updated_at": now_iso()})
            self.supa.upsert_rows(unseen)
            amount = Decimal(0)
            for t in landed:
                amount += self.liquido(self.pending[t])
                self.pending.pop(t, None)
            for row in unseen:
                amount += self.liquido(row)
            n = len(landed) + len(unseen)
            # As saídas pendentes das que pousaram agora são UTXOs de verdade. O scanner
            # as põe no set no próximo giro dele (30 s); até lá, e por uma folga, elas
            # continuam respondendo aqui para uma tx encadeada não passar despercebida.
            self.utxos.graduate([t for t in landed] + [r["txid"] for r in unseen])
            log.info("  bloco %d: %d tx(s) de DOG pousaram (%d vistas em órbita, %d direto)", h, n, len(landed), len(unseen))
            if n > 0:
                self.last_dog_block = {"height": h, "time": btime, "count": n, "amount": str(amount)}
            self.tip = h
            self._save_state()

    # ── o painel ──

    def snapshot(self, force=False):
        now = time.time()
        if not force and now - self.last_snapshot < 10:
            return
        info = self.rpc.call("getmempoolinfo")
        tip = self.rpc.call("getblockchaininfo")
        est = self.rpc.batch([("estimatesmartfee", [b]) for b in (1, 3, 6)])
        def rate(e):
            fr = (e or {}).get("feerate")
            return str(round(max(1.0, fr * 1e8 / 1000), 2)) if fr else None
        hdr = self.rpc.call("getblockheader", tip["bestblockhash"])
        pend_amount = sum(self.liquido(r) for r in self.pending.values())
        row = {
            "id": 1,
            "updated_at": now_iso(),
            "tx_count": info.get("size", 0),
            "vbytes": info.get("bytes", 0),
            "min_fee_rate": str(round(info.get("mempoolminfee", 0) * 1e8 / 1000, 2)),
            "fee_fast": rate(est[0]), "fee_normal": rate(est[1]), "fee_slow": rate(est[2]),
            "tip_height": tip["blocks"], "tip_hash": tip["bestblockhash"], "tip_time": ts_iso(hdr["time"]),
            "dog_pending": len(self.pending), "dog_pending_amount": str(pend_amount),
        }
        if self.last_dog_block:
            row.update({
                "last_dog_block": self.last_dog_block["height"],
                "last_dog_block_time": self.last_dog_block["time"],
                "last_dog_block_count": self.last_dog_block["count"],
                "last_dog_block_amount": self.last_dog_block["amount"],
            })
        self.supa.snapshot(row)
        self.last_snapshot = now

    def prune(self):
        if time.time() - self.last_prune < 600:
            return
        # Formato com Z e sem "+": o "+" de um ISO com fuso vira espaço na query string.
        before = (datetime.now(timezone.utc) - timedelta(hours=RETENTION_HOURS)).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.supa.prune(before)
        self.last_prune = time.time()

    def tick(self):
        self.utxos.reload()
        height = self.rpc.call("getblockcount")
        new_block = height > self.tip
        if new_block:
            self.scan_blocks(height)
        self.scan_mempool()
        self.snapshot(force=new_block)
        self.prune()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--poll", type=float, default=POLL_SECONDS)
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")

    rpc = Rpc(RPC_URL, DATADIR)
    supa = Supa(SUPABASE_URL, SUPABASE_KEY, args.dry_run)
    utxos = DogUtxos(UTXO_SET_FILE)
    w = Watcher(rpc, supa, utxos)
    w.resume()
    log.info("dog mempool watcher · %s · poll %.0fs · %s", RPC_URL, args.poll, "SECO" if supa.dry else "supabase")
    while True:
        t0 = time.time()
        try:
            w.tick()
        except Exception as e:  # noqa: BLE001
            log.error("volta falhou: %s", e)
        if args.once:
            break
        time.sleep(max(0.5, args.poll - (time.time() - t0)))


if __name__ == "__main__":
    main()
