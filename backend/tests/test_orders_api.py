"""Order API end to end inside the app process, with the clock pinned to an open service.
Uses the real seeded menu from Mongo. Demo store: nothing is persisted."""

from datetime import datetime

import httpx
import pytest
import pytest_asyncio

import routers.orders as orders_router
from lib.db import db
from lib.hours import TZ
from server import app

THU_20 = datetime(2026, 10, 22, 20, 0, tzinfo=TZ)

# Motor binds to one event loop: share a module-scoped loop across these tests.
pytestmark = pytest.mark.asyncio(loop_scope="module")


@pytest.fixture
def open_now(monkeypatch):
    monkeypatch.setattr(orders_router, "now_madrid", lambda: THU_20)
    monkeypatch.delenv("DATABASE_URL", raising=False)


@pytest_asyncio.fixture(loop_scope="module")
async def api():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t/api") as c:
        yield c


async def _menu():
    docs = await db.menu_items.find({"available": True}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    by_name = {d["name"]: d for d in docs}
    return by_name


async def test_config_open(open_now, api):
    r = await api.get("/orders/config")
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "demo" and body["accepting"] is True
    assert body["pickup_slots"][0] == "20:30" and body["pickup_slots"][-1] == "23:45"


async def test_order_priced_from_real_menu_and_not_persisted(open_now, api):
    m = await _menu()
    cheese, croq, big = m["Cheese Bacon"], m["Croquetas"], m["Big Secret"]
    r = await api.post(
        "/orders",
        json={
            "customer_name": "Ana",
            "customer_phone": "600111222",
            "notes": "sin cebolla",
            "pickup_time": "21:00",
            "items": [
                {"menu_item_id": cheese["id"], "quantity": 2},
                {"menu_item_id": croq["id"], "quantity": 4},
                {"menu_item_id": big["id"], "quantity": 1},
            ],
        },
    )
    assert r.status_code == 201, r.text
    res = r.json()
    assert res["persisted"] is False and res["mode"] == "demo"
    o = res["order"]
    expected = cheese["price"] * 2 + croq["price"] * 4 + big["price"]
    assert o["subtotal"] == pytest.approx(expected) and o["total"] == pytest.approx(expected)
    assert [(i["name"], i["quantity"]) for i in o["items"]] == [("Cheese Bacon", 2), ("Croquetas", 4), ("Big Secret", 1)]
    assert o["fulfillment"] == "pickup" and o["status"] == "pending" and o["pickup_time"] == "21:00"
    assert o["order_number"].startswith("P-261022-")
    assert o["pickup_at"].startswith("2026-10-22T21:00:00")


async def test_client_price_is_ignored(open_now, api):
    m = await _menu()
    r = await api.post(
        "/orders",
        json={
            "customer_name": "Ana", "customer_phone": "600111222", "pickup_time": "21:00",
            "items": [{"menu_item_id": m["Cheese Bacon"]["id"], "quantity": 1, "unit_price": 0.01}],
        },
    )
    assert r.status_code == 201
    assert r.json()["order"]["total"] == pytest.approx(m["Cheese Bacon"]["price"])


@pytest.mark.parametrize(
    "patch,code",
    [({"pickup_time": "19:00"}, "invalid_pickup_time"), ({"items": [{"menu_item_id": "nope", "quantity": 1}]}, "item_unavailable")],
)
async def test_rejections(open_now, api, patch, code):
    m = await _menu()
    body = {
        "customer_name": "Ana", "customer_phone": "600111222", "pickup_time": "21:00",
        "items": [{"menu_item_id": m["Cheese Bacon"]["id"], "quantity": 1}],
    } | patch
    r = await api.post("/orders", json=body)
    assert r.status_code == 400 and r.json()["detail"] == code
