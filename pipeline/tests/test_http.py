import httpx
import pytest

from macro_event_lab.http import RateLimitedClient


def test_client_errors_never_show_the_api_key():
    def reply(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error_message": "Bad Request"}, request=request)

    client = RateLimitedClient(
        "https://api.example.org", requests_per_second=1000, transport=httpx.MockTransport(reply)
    )
    with pytest.raises(httpx.HTTPStatusError) as caught:
        client.get("/series/observations", params={"series_id": "DGS2", "api_key": "secret123"})

    message = str(caught.value)
    assert "secret123" not in message
    assert "DGS2" in message and "Bad Request" in message
