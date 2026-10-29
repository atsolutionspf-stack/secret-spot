"""Criterion: with the real preview backend (current wall-clock time, outside opening
hours), GET /api/orders/config reports the shop as closed with no pickup slots.

Hits the live running server over HTTP (not the in-process app) per the backend-test
convention; no DB writes, no fixtures needed — purely reads current config.
"""

import httpx


def test_orders_config_closed_now(client):
    r = client.get("/orders/config")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["accepting"] is False
    assert body["reason"] == "closed"
    assert body["pickup_slots"] == []
