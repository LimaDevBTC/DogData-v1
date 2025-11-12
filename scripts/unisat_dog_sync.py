#!/usr/bin/env python3
"""
Sincroniza transações DOG utilizando a Xverse API como fonte principal
com fallback para a API gratuita da Unisat.

Gera/atualiza o arquivo public/data/dog_transactions.json mantendo
as últimas N transações (default: 500) com informações de inputs/outputs.
"""

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

# === Configurações gerais ====================================================

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "public" / "data"
OUTPUT_FILE = DATA_DIR / "dog_transactions.json"

DOG_RUNE_ID = "840000:3"
DOG_DIVISIBILITY = 5
DOG_FACTOR = 10 ** DOG_DIVISIBILITY
MAX_TRANSACTIONS = int(os.getenv("DOG_MAX_TRANSACTIONS", "500"))
NET_EPSILON = 1e-5

# --- Xverse ------------------------------------------------------------------
XVERSE_API_BASE = os.getenv("XVERSE_API_BASE", "https://api.secretkeylabs.io").rstrip("/")
XVERSE_API_KEY = os.getenv("XVERSE_API_KEY")
XVERSE_ACTIVITY_LIMIT = 25
XVERSE_MAX_PAGES = int(os.getenv("XVERSE_ACTIVITY_MAX_PAGES", "250"))
XVERSE_DELAY_SEC = float(os.getenv("XVERSE_ACTIVITY_DELAY_MS", "250")) / 1000.0
XVERSE_FEE_DELAY_SEC = float(os.getenv("XVERSE_FEE_DELAY_MS", "400")) / 1000.0

# --- Unisat (fallback) -------------------------------------------------------
UNISAT_API = "https://open-api.unisat.io/v1/indexer"
UNISAT_RUNE_NAME = "DOG•GO•TO•THE•MOON"
UNISAT_API_TOKEN = os.getenv(
    "UNISAT_API_TOKEN",
    "4478b2eaea855f5077a91089130f495d226935eccd4477be5340f01ec59db008",
)


# === Funções utilitárias =====================================================

def safe_int(value: Any) -> int:
    """Converte valor em inteiro de forma resiliente."""
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            if "." in value:
                return int(float(value))
            return int(value)
        except ValueError:
            return 0
    return 0


def round_dog(value: float) -> float:
    return round(value, DOG_DIVISIBILITY)


def iso_timestamp(value: Optional[str]) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat()
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return datetime.now(timezone.utc).isoformat()


# === Cliente Xverse ==========================================================

class XverseDogSync:
    def __init__(self, max_transactions: int = MAX_TRANSACTIONS):
        if not XVERSE_API_KEY:
            raise RuntimeError("XVERSE_API_KEY não está configurada.")

        self.max_transactions = max_transactions
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "DogData Sync/1.0",
                "Accept": "application/json",
                "x-api-key": XVERSE_API_KEY,
            }
        )

    def _request(self, path: str, params: Optional[Dict[str, Any]] = None, retries: int = 3) -> Dict[str, Any]:
        url = f"{XVERSE_API_BASE}{path}"
        for attempt in range(1, retries + 1):
            try:
                response = self.session.get(url, params=params, timeout=30)
                if response.status_code == 429:
                    wait = min(5, attempt * 2)
                    print(f"  ⏳ Xverse rate limit (429). Aguardando {wait}s...")
                    time.sleep(wait)
                    continue
                response.raise_for_status()
                return response.json()
            except Exception as exc:  # pylint: disable=broad-except
                if attempt == retries:
                    raise
                wait = attempt * 2
                print(f"  ⚠️ Erro Xverse (tentativa {attempt}/{retries}): {exc}. Retentando em {wait}s...")
                time.sleep(wait)
        raise RuntimeError("Falha inesperada na chamada Xverse")

    def fetch_transactions(self) -> List[Dict[str, Any]]:
        print("🔍 Buscando transações via Xverse API...")
        grouped: Dict[str, Dict[str, Any]] = {}
        offset = 0
        pages = 0

        while len(grouped) < self.max_transactions and pages < XVERSE_MAX_PAGES:
            data = self._request(
                f"/v1/runes/{DOG_RUNE_ID}/activity",
                params={"offset": offset},
            )
            items = data.get("items") or []
            if not items:
                print("  ℹ️ Nenhuma página adicional retornada pela Xverse.")
                break

            for item in items:
                txid = item.get("txid")
                if not txid:
                    continue

                entry = grouped.setdefault(
                    txid,
                    {
                        "block_height": item.get("blockHeight") or 0,
                        "block_time": item.get("blockTime"),
                        "inputs": [],
                        "outputs": [],
                        "others": [],
                    },
                )

                if not entry["block_height"] and item.get("blockHeight"):
                    entry["block_height"] = item["blockHeight"]
                if not entry["block_time"] and item.get("blockTime"):
                    entry["block_time"] = item["blockTime"]

                item_type = (item.get("type") or "").lower()
                if item_type == "input":
                    entry["inputs"].append(item)
                elif item_type in ("output", "mint"):
                    entry["outputs"].append(item)
                else:
                    entry["others"].append(item)

            offset += data.get("limit") or XVERSE_ACTIVITY_LIMIT
            pages += 1
            print(f"  ✅ Página {pages} processada (tx acumuladas: {len(grouped)})")

            if XVERSE_DELAY_SEC > 0:
                time.sleep(XVERSE_DELAY_SEC)

        transactions: List[Dict[str, Any]] = []
        for txid, payload in grouped.items():
            tx_data = self._build_transaction(txid, payload)
            if tx_data:
                transactions.append(tx_data)

        transactions.sort(
            key=lambda tx: (tx["block_height"], tx["timestamp"]),
            reverse=True,
        )
        trimmed = transactions[: self.max_transactions]
        print(f"✅ Xverse retornou {len(trimmed)} transações (de {len(transactions)} encontradas)")
        self._enrich_with_fees(trimmed)
        return trimmed

    def _build_transaction(self, txid: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        inputs = payload.get("inputs") or []
        outputs = payload.get("outputs") or []

        senders: List[Dict[str, Any]] = []
        sender_addresses = set()
        total_in = 0.0

        for item in inputs:
            address = item.get("address") or ""
            amount_raw = safe_int(item.get("amount"))
            amount_dog = amount_raw / DOG_FACTOR
            total_in += amount_dog

            if address:
                sender_addresses.add(address)

            senders.append(
                {
                    "address": address,
                    "amount": amount_raw,
                    "amount_dog": round_dog(amount_dog),
                    "has_dog": amount_dog > NET_EPSILON,
                }
            )

        receivers: List[Dict[str, Any]] = []
        total_out = 0.0
        total_change = 0.0

        for item in outputs:
            address = item.get("address") or ""
            if not address:
                continue

            amount_raw = safe_int(item.get("amount"))
            amount_dog = amount_raw / DOG_FACTOR
            is_change = address in sender_addresses
            if is_change:
                total_change += amount_dog
            total_out += amount_dog

            receivers.append(
                {
                    "address": address,
                    "amount": amount_raw,
                    "amount_dog": round_dog(amount_dog),
                    "has_dog": amount_dog > NET_EPSILON,
                    "is_change": is_change,
                }
            )

        total_in = total_in if total_in > NET_EPSILON else total_out
        net_transfer = max(total_out - total_change, 0.0)

        return {
            "txid": txid,
            "block_height": payload.get("block_height") or 0,
            "timestamp": iso_timestamp(payload.get("block_time")),
            "senders": senders,
            "receivers": receivers,
            "sender_count": len(senders),
            "receiver_count": len(receivers),
            "total_dog_in": round_dog(total_in),
            "total_dog_out": round_dog(total_out),
            "total_dog_moved": round_dog(total_out),
            "net_transfer": round_dog(net_transfer),
            "change_amount": round_dog(total_change),
            "has_change": total_change > NET_EPSILON,
        }

    def _fetch_btc_totals(self, txid: str) -> Optional[Tuple[int, int]]:
        try:
            inputs_resp = self.session.get(
                f"{XVERSE_API_BASE}/v1/ordinals/tx/{txid}/inputs",
                timeout=30,
            )
            inputs_resp.raise_for_status()
            inputs_data = inputs_resp.json()
            in_sats = sum(safe_int(item.get("value")) for item in inputs_data.get("items", []))

            if XVERSE_FEE_DELAY_SEC > 0:
                time.sleep(XVERSE_FEE_DELAY_SEC)

            outputs_resp = self.session.get(
                f"{XVERSE_API_BASE}/v1/ordinals/tx/{txid}/outputs",
                timeout=30,
            )
            outputs_resp.raise_for_status()
            outputs_data = outputs_resp.json()
            out_sats = sum(safe_int(item.get("value")) for item in outputs_data.get("items", []))

            return in_sats, out_sats
        except Exception as exc:  # pylint: disable=broad-except
            print(f"⚠️ Falha ao obter BTC totals para {txid[:8]}…: {exc}")
            return None

    def _enrich_with_fees(self, transactions: List[Dict[str, Any]]) -> None:
        if not XVERSE_API_KEY:
            return

        for index, tx in enumerate(transactions, start=1):
            if tx.get("fee_sats") is not None:
                continue

            totals = self._fetch_btc_totals(tx["txid"])
            if totals:
                in_sats, out_sats = totals
                tx["fee_sats"] = max(in_sats - out_sats, 0)


# === Fallback Unisat =========================================================

class LegacyUnisatDogSync:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "DogData Explorer/1.0"})
        if UNISAT_API_TOKEN:
            self.session.headers["Authorization"] = f"Bearer {UNISAT_API_TOKEN}"

    def fetch_events(self, total_needed: int = 1500) -> List[Dict[str, Any]]:
        print(f"🔍 (fallback) Buscando ~{total_needed} eventos na Unisat...")
        url = f"{UNISAT_API}/runes/event"
        events: List[Dict[str, Any]] = []
        batch_size = 200
        start = 0

        while len(events) < total_needed:
            params = {"rune": UNISAT_RUNE_NAME, "start": start, "limit": batch_size}
            try:
                response = self.session.get(url, params=params, timeout=60)
                response.raise_for_status()
                data = response.json()
            except Exception as exc:  # pylint: disable=broad-except
                print(f"❌ Erro ao buscar eventos Unisat: {exc}")
                break

            if data.get("code") != 0:
                print(f"❌ Erro na resposta Unisat: {data}")
                break

            detail = data.get("data", {}).get("detail") or []
            if not detail:
                print("  ℹ️ Unisat não retornou mais eventos.")
                break

            events.extend(detail)
            print(f"  ✅ +{len(detail)} eventos (total: {len(events)})")

            if len(detail) < batch_size:
                break
            start += batch_size
            time.sleep(0.5)

        print(f"✅ Total de eventos Unisat: {len(events)}")
        return events

    def group_events_by_txid(self, events: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for event in events:
            txid = event.get("txid")
            if not txid:
                continue
            grouped.setdefault(txid, []).append(event)
        return grouped

    def process_transaction(self, txid: str, events: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        sends = [
            e
            for e in events
            if (e.get("event") or e.get("type")) in ("send", "SEND")
        ]
        receives = [
            e
            for e in events
            if (e.get("event") or e.get("type")) in ("receive", "RECEIVE")
        ]

        if not sends and not receives:
            return None

        first_event = events[0]
        block_height = int(first_event.get("height") or 0)
        timestamp_unix = int(first_event.get("timestamp") or 0)
        timestamp = (
            datetime.fromtimestamp(timestamp_unix, tz=timezone.utc).isoformat()
            if timestamp_unix
            else datetime.now(timezone.utc).isoformat()
        )

        senders: List[Dict[str, Any]] = []
        sender_addresses = set()
        total_in = 0.0

        for send in sends:
            address = send.get("address") or ""
            amount_raw = safe_int(send.get("amount"))
            amount_dog = amount_raw / DOG_FACTOR
            total_in += amount_dog
            if address:
                sender_addresses.add(address)
            senders.append(
                {
                    "address": address,
                    "amount": amount_raw,
                    "amount_dog": round_dog(amount_dog),
                    "has_dog": amount_dog > NET_EPSILON,
                }
            )

        receivers: List[Dict[str, Any]] = []
        total_out = 0.0
        total_change = 0.0

        for receive in receives:
            address = receive.get("address") or ""
            amount_raw = safe_int(receive.get("amount"))
            amount_dog = amount_raw / DOG_FACTOR
            is_change = address in sender_addresses
            if is_change:
                total_change += amount_dog
            total_out += amount_dog
            receivers.append(
                {
                    "address": address,
                    "amount": amount_raw,
                    "amount_dog": round_dog(amount_dog),
                    "has_dog": amount_dog > NET_EPSILON,
                    "is_change": is_change,
                }
            )

        total_in = total_in if total_in > NET_EPSILON else total_out
        net_transfer = max(total_out - total_change, 0.0)

        return {
            "txid": txid,
            "block_height": block_height,
            "timestamp": timestamp,
            "senders": senders,
            "receivers": receivers,
            "sender_count": len(senders),
            "receiver_count": len(receivers),
            "total_dog_in": round_dog(total_in),
            "total_dog_out": round_dog(total_out),
            "total_dog_moved": round_dog(total_out),
            "net_transfer": round_dog(net_transfer),
            "change_amount": round_dog(total_change),
            "has_change": total_change > NET_EPSILON,
        }

    def fetch_transactions(self) -> List[Dict[str, Any]]:
        events = self.fetch_events(total_needed=1500)
        if not events:
            return []

        tx_events = self.group_events_by_txid(events)
        transactions: List[Dict[str, Any]] = []

        for txid, grouped_events in tx_events.items():
            tx_data = self.process_transaction(txid, grouped_events)
            if tx_data:
                transactions.append(tx_data)

        transactions.sort(
            key=lambda tx: (tx["block_height"], tx["timestamp"]),
            reverse=True,
        )
        trimmed = transactions[:MAX_TRANSACTIONS]
        print(f"✅ Fallback Unisat produziu {len(trimmed)} transações.")
        return trimmed


# === Persistência ============================================================

def save_transactions(transactions: List[Dict[str, Any]], source: str) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    payload = {
        "timestamp": now.isoformat(),
        "total_transactions": len(transactions),
        "last_block": transactions[0]["block_height"] if transactions else 0,
        "last_update": now.strftime("%Y-%m-%d %H:%M:%S"),
        "source": source,
        "transactions": transactions,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, indent=2, ensure_ascii=False)

    print("=" * 60)
    print(f"✅ Arquivo salvo em: {OUTPUT_FILE}")
    print(f"📊 Total de transações: {len(transactions)} | Fonte: {source.upper()}")
    if transactions:
        sample = transactions[0]
        print("🔍 Exemplo (TX mais recente):")
        print(f"   TXID: {sample['txid'][:16]}...")
        print(f"   Bloco: {sample['block_height']} | Total DOG: {sample['total_dog_moved']:.2f}")
        print(f"   Senders: {sample['sender_count']} | Receivers: {sample['receiver_count']}")
    print("=" * 60)


# === Execução ================================================================

def main() -> int:
    print("=" * 60)
    print("🐕 DOG SYNC - Xverse principal • Unisat fallback")
    print("=" * 60)

    source = "xverse"
    transactions: List[Dict[str, Any]] = []

    try:
        xverse_sync = XverseDogSync()
        transactions = xverse_sync.fetch_transactions()
    except Exception as exc:  # pylint: disable=broad-except
        source = "unisat"
        print(f"❌ Falha com Xverse: {exc}")
        print("⚠️ Tentando fallback Unisat...")
        try:
            fallback_sync = LegacyUnisatDogSync()
            transactions = fallback_sync.fetch_transactions()
        except Exception as fallback_exc:  # pylint: disable=broad-except
            print(f"❌ Falha também no fallback Unisat: {fallback_exc}")
            return 1

    if not transactions:
        print("❌ Nenhuma transação foi obtida.")
        return 1

    save_transactions(transactions, source)
    print("✅ Sincronização concluída com sucesso!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


