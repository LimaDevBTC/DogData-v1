from __future__ import annotations

from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from dogdata.client import DogData


class MarketsResource:
    def __init__(self, client: DogData):
        self._client = client

    def list(self) -> list[dict[str, Any]]:
        return self._client.request("/api/markets")

    def by_exchange(self, exchange: str) -> dict[str, Any]:
        markets = self.list()
        for market in markets:
            if market.get("exchange", "").lower() == exchange.lower():
                return market
        raise ValueError(f'Exchange "{exchange}" not found')
