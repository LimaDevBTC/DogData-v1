from __future__ import annotations

from typing import Any, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from dogdata.client import DogData


class HoldersResource:
    def __init__(self, client: DogData):
        self._client = client

    def list(self, page: int = 1, limit: int = 100) -> dict[str, Any]:
        return self._client.request("/api/dog-rune/holders", {
            "page": page,
            "limit": limit,
        })

    def get(self, address: str) -> dict[str, Any]:
        return self._client.request("/api/dog-rune/holders", {
            "address": address,
        })

    def count(self) -> dict[str, Any]:
        return self._client.request("/api/dog-rune/holders", {
            "count": True,
        })

    def top(self, limit: int = 100) -> list[dict[str, Any]]:
        result = self.list(page=1, limit=limit)
        return result.get("data", [])
