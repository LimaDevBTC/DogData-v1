from __future__ import annotations

from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from dogdata.client import DogData

EXCHANGES = ["kraken", "gateio", "mexc", "bitget", "pionex", "magiceden", "bitflow", "dogswap"]


class PriceResource:
    def __init__(self, client: DogData):
        self._client = client

    def current(self) -> dict[str, Any]:
        return self._client.request("/api/price/kraken")

    def from_exchange(self, exchange: str) -> dict[str, Any]:
        if exchange not in EXCHANGES:
            raise ValueError(f"Unknown exchange: {exchange}. Valid: {EXCHANGES}")
        return self._client.request(f"/api/price/{exchange}")

    def all(self) -> list[dict[str, Any]]:
        results = []
        for exchange in EXCHANGES:
            try:
                results.append(self.from_exchange(exchange))
            except Exception:
                pass
        return results

    def kraken(self) -> dict[str, Any]:
        return self.from_exchange("kraken")

    def gateio(self) -> dict[str, Any]:
        return self.from_exchange("gateio")

    def mexc(self) -> dict[str, Any]:
        return self.from_exchange("mexc")

    def bitget(self) -> dict[str, Any]:
        return self.from_exchange("bitget")

    def pionex(self) -> dict[str, Any]:
        return self.from_exchange("pionex")

    def magiceden(self) -> dict[str, Any]:
        return self.from_exchange("magiceden")

    def bitflow(self) -> dict[str, Any]:
        return self.from_exchange("bitflow")

    def dogswap(self) -> dict[str, Any]:
        return self.from_exchange("dogswap")
