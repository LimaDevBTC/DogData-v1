from __future__ import annotations

from typing import Any, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from dogdata.client import DogData


class ForensicResource:
    def __init__(self, client: DogData):
        self._client = client

    def profiles(self, page: int = 1, limit: int = 100) -> dict[str, Any]:
        return self._client.request("/api/forensic/profiles", {
            "page": page,
            "limit": limit,
        })

    def profile(self, address: str) -> dict[str, Any]:
        return self._client.request("/api/forensic/profiles", {
            "address": address,
        })

    def summary(self) -> dict[str, Any]:
        return self._client.request("/api/forensic/summary")

    def by_category(self, category: str, page: int = 1, limit: int = 100) -> dict[str, Any]:
        return self._client.request("/api/forensic/profiles", {
            "category": category,
            "page": page,
            "limit": limit,
        })

    def diamond_hands(self, page: int = 1, limit: int = 100) -> dict[str, Any]:
        return self.by_category("diamond_hands", page, limit)

    def paper_hands(self, page: int = 1, limit: int = 100) -> dict[str, Any]:
        return self.by_category("paper_hands", page, limit)
