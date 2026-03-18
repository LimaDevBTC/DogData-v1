from __future__ import annotations

from typing import Any, Optional

import httpx

from dogdata.resources.holders import HoldersResource
from dogdata.resources.transactions import TransactionsResource
from dogdata.resources.price import PriceResource
from dogdata.resources.metrics import MetricsResource
from dogdata.resources.forensic import ForensicResource
from dogdata.resources.markets import MarketsResource


class DogDataError(Exception):
    def __init__(self, message: str, status: int = 0, code: str = "unknown"):
        super().__init__(message)
        self.status = status
        self.code = code


class DogData:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://www.dogdata.xyz",
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

        headers: dict[str, str] = {
            "Accept": "application/json",
            "User-Agent": "dogdata-python/1.0.0",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        self._client = httpx.Client(
            base_url=self.base_url,
            headers=headers,
            timeout=timeout,
        )

        self.holders = HoldersResource(self)
        self.transactions = TransactionsResource(self)
        self.price = PriceResource(self)
        self.metrics = MetricsResource(self)
        self.forensic = ForensicResource(self)
        self.markets = MarketsResource(self)

    def request(
        self,
        path: str,
        params: Optional[dict[str, Any]] = None,
    ) -> Any:
        cleaned_params: dict[str, Any] = {}
        if params:
            cleaned_params = {k: v for k, v in params.items() if v is not None}

        try:
            response = self._client.get(path, params=cleaned_params)
        except httpx.TimeoutException:
            raise DogDataError("Request timed out", status=408, code="timeout")
        except httpx.HTTPError as e:
            raise DogDataError(str(e), status=0, code="network_error")

        if response.status_code >= 400:
            try:
                body = response.json()
                msg = body.get("message", response.text)
                code = body.get("error", "api_error")
            except Exception:
                msg = response.text
                code = "api_error"
            raise DogDataError(msg, status=response.status_code, code=code)

        return response.json()

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "DogData":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
