from __future__ import annotations

from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from dogdata.client import DogData


class MetricsResource:
    def __init__(self, client: DogData):
        self._client = client

    def utxo(self) -> dict[str, Any]:
        return self._client.request("/api/metrics/utxo")

    def holder_concentration(self) -> dict[str, Any]:
        return self._client.request("/api/metrics/holder-concentration")

    def realized_cap(self) -> dict[str, Any]:
        return self._client.request("/api/metrics/realized-cap")

    def all(self) -> dict[str, Any]:
        return {
            "utxo": self.utxo(),
            "concentration": self.holder_concentration(),
            "realized_cap": self.realized_cap(),
        }
