"""
Verifies the Cloudflare Python Workers API (cloudflare-api/) criteria:
- Local workerd (pywrangler dev --port 8787) boots and serves existing routes.
- POST /api/orders validation (invalid JSON -> 400, missing/empty fields -> 422).

Assumes a local `uv run pywrangler dev --port 8787` is already running
(per the briefing, it is started ahead of time from /app/cloudflare-api).
This test talks to it over real HTTP — no mocking.
"""
import httpx

WORKER_BASE = "http://127.0.0.1:8787"


def test_worker_root_and_health():
    r = httpx.get(f"{WORKER_BASE}/", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "ok"
    assert body.get("service") == "secret-spot-api"

    r2 = httpx.get(f"{WORKER_BASE}/api/health", timeout=10)
    assert r2.status_code == 200
    assert r2.json() == {"status": "ok"}


def test_orders_invalid_json_returns_400():
    r = httpx.post(
        f"{WORKER_BASE}/api/orders",
        content="{bad",
        headers={"Content-Type": "application/json"},
        timeout=10,
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "invalid_json"


def test_orders_empty_payload_returns_422_invalid_order():
    r = httpx.post(f"{WORKER_BASE}/api/orders", json={}, timeout=10)
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["code"] == "invalid_order"
    assert "items" in detail["fields"]


def test_orders_empty_items_returns_422_invalid_order():
    r = httpx.post(
        f"{WORKER_BASE}/api/orders",
        json={"customer_name": "x", "customer_phone": "123", "items": []},
        timeout=10,
    )
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["code"] == "invalid_order"
    assert "items" in detail["fields"]
