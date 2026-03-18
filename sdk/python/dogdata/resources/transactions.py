from __future__ import annotations

from typing import Any, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from dogdata.client import DogData


class TransactionsResource:
    def __init__(self, client: DogData):
        self._client = client

    def list(self, page: int = 1, limit: int = 100) -> dict[str, Any]:
        return self._client.request("/api/dog-rune/transactions-kv", {
            "page": page,
            "limit": limit,
        })

    def get(self, txid: str) -> dict[str, Any]:
        return self._client.request("/api/dog-rune/transactions-kv", {
            "txid": txid,
        })

    def recent(self, limit: int = 20) -> list[dict[str, Any]]:
        result = self.list(page=1, limit=limit)
        return result.get("data", [])

    def by_address(self, address: str, page: int = 1, limit: int = 100) -> dict[str, Any]:
        return self._client.request("/api/dog-rune/transactions-kv", {
            "address": address,
            "page": page,
            "limit": limit,
        })
