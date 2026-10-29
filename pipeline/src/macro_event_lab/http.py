"""A small HTTP client with a rate limit and retries on 429 / 5xx."""

from __future__ import annotations

import time
from typing import Any

import httpx

from macro_event_lab.raw_store import redact

USER_AGENT = "macro-event-lab/0.1 (student research project; github.com/aansensei)"
RETRY_STATUS = {429, 500, 502, 503, 504}


class RateLimitedClient:
    def __init__(
        self,
        base_url: str,
        requests_per_second: float,
        max_retries: int = 5,
        timeout: float = 30.0,
        transport: httpx.BaseTransport | None = None,
        accept: str = "application/json",
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url,
            timeout=timeout,
            transport=transport,
            headers={"User-Agent": USER_AGENT, "Accept": accept},
        )
        self._min_interval = 1.0 / requests_per_second
        self._last_request = 0.0
        self._max_retries = max_retries

    def _wait_turn(self) -> None:
        elapsed = time.monotonic() - self._last_request
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_request = time.monotonic()

    def get(self, path: str, params: dict[str, Any] | None = None) -> httpx.Response:
        """GET with rate limiting. Retries 429/5xx with exponential backoff, raises on 4xx."""
        for attempt in range(self._max_retries + 1):
            self._wait_turn()
            try:
                response = self._client.get(path, params=params)
            except httpx.TransportError:
                if attempt == self._max_retries:
                    raise
                time.sleep(2**attempt)
                continue
            if response.status_code in RETRY_STATUS and attempt < self._max_retries:
                retry_after = response.headers.get("Retry-After")
                delay = float(retry_after) if retry_after and retry_after.isdigit() else 2**attempt
                time.sleep(delay)
                continue
            if response.is_error:
                # the request URL carries API keys, so the error names the path and redacted params
                raise httpx.HTTPStatusError(
                    f"HTTP {response.status_code} for {path} with params {redact(params)}: "
                    f"{response.text[:300]}",
                    request=response.request,
                    response=response,
                )
            return response
        raise RuntimeError("unreachable")

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> RateLimitedClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
