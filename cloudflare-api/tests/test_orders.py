"""POST /api/orders tests with FICTITIOUS data. Supabase is mocked: no network, no real orders.

Run:  cd cloudflare-api && python -m pytest tests -q
"""
import json
import sys
import types
from types import SimpleNamespace

import pytest

# Stub the Cloudflare `workers` runtime module so main.py imports outside a Worker.
_workers = types.ModuleType("workers")
_workers.asgi = SimpleNamespace(entrypoint=lambda app: app)


async def _no_network(*args, **kwargs):  # pragma: no cover
    raise AssertionError("real fetch must never be called in tests")


_workers.fetch = _no_network
sys.modules["workers"] = _workers
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1] / "src"))

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

RESTAURANT = "00000000-0000-4000-8000-000000000001"
OTHER_RESTAURANT = "00000000-0000-4000-8000-000000000099"
BURGER = "11111111-1111-4111-8111-111111111111"
FRIES = "22222222-2222-4222-8222-222222222222"
SOLD_OUT = "33333333-3333-4333-8333-333333333333"
FOREIGN = "44444444-4444-4444-8444-444444444444"
SECRET = "sb_secret_FAKE_TEST_KEY"

MENU = [
    {"id": BURGER, "restaurant_id": RESTAURANT, "name": "Burger Test", "price": 12.5, "available": True},
    {"id": FRIES, "restaurant_id": RESTAURANT, "name": "Patatas Test", "price": 4.0, "available": True},
    {"id": SOLD_OUT, "restaurant_id": RESTAURANT, "name": "Agotado Test", "price": 9.0, "available": False},
    {"id": FOREIGN, "restaurant_id": OTHER_RESTAURANT, "name": "Ajeno", "price": 1.0, "available": True},
]


class FakeSupabase:
    def __init__(self, accepting=True, slots=("20:00", "20:15"), rpc_error=None):
        self.accepting = accepting
        self.slots = list(slots)
        self.rpc_error = rpc_error
        self.rpc_calls = []

    async def __call__(self, request, path, method="GET", body=None):
        if path == "/rest/v1/rpc/order_config":
            return {"accepting": self.accepting, "pickup_slots": self.slots, "prep_minutes": 20}
        if path.startswith("/rest/v1/menu_items?"):
            from urllib.parse import parse_qs, urlsplit
            q = parse_qs(urlsplit(path).query)
            rid = q["restaurant_id"][0].removeprefix("eq.")
            ids = q["id"][0].removeprefix("in.(").removesuffix(")").split(",")
            return [
                {k: m[k] for k in ("id", "name", "price", "available")}
                for m in MENU if m["restaurant_id"] == rid and m["id"] in ids
            ]
        if path == "/rest/v1/rpc/create_pickup_order":
            self.rpc_calls.append(body)
            if self.rpc_error:
                raise main.SupabaseError(*self.rpc_error)
            return {"order_number": "SS-260101-TEST1", "status": "pending",
                    "pickup_time": body["p_pickup_time"], "total": body["p_expected_total"], "currency": "EUR"}
        raise AssertionError(f"unexpected path {path}")


def with_env(app):
    async def wrapped(scope, receive, send):
        if scope["type"] == "http":
            scope["env"] = SimpleNamespace(SUPABASE_URL="https://fake.supabase.co",
                                           SUPABASE_SECRET_KEY=SECRET, RESTAURANT_ID=RESTAURANT)
        await app(scope, receive, send)
    return wrapped


@pytest.fixture
def fake(monkeypatch):
    f = FakeSupabase()
    monkeypatch.setattr(main, "supabase_request", f)
    return f


@pytest.fixture
def client():
    return TestClient(with_env(main.app))


def order(**over):
    body = {
        "customer_name": "Cliente Ficticio",
        "customer_phone": "+34 600 000 000",
        "notes": "Sin cebolla",
        "pickup_time": "20:15",
        "items": [{"menu_item_id": BURGER, "quantity": 2}, {"menu_item_id": FRIES, "quantity": 1}],
    }
    body.update(over)
    return body


def code(r):
    return r.json()["detail"]["code"]


def test_happy_path_server_prices_ignore_client(client, fake):
    body = order(restaurant_id=OTHER_RESTAURANT, total=0.01)
    body["items"][0]["unit_price"] = 0.01
    r = client.post("/api/orders", json=body)
    assert r.status_code == 201, r.text
    assert r.json() == {"order_number": "SS-260101-TEST1", "status": "pending",
                        "pickup_time": "20:15", "total": 29.0, "currency": "EUR"}
    call = fake.rpc_calls[0]
    assert call["p_restaurant_id"] == RESTAURANT
    assert call["p_expected_total"] == "29.00"
    assert all(set(i) == {"menu_item_id", "quantity"} for i in call["p_items"])
    assert SECRET not in r.text


def test_invalid_json(client, fake):
    r = client.post("/api/orders", content=b"{not json", headers={"Content-Type": "application/json"})
    assert r.status_code == 400 and code(r) == "invalid_json"
    r = client.post("/api/orders", json=[1, 2])
    assert r.status_code == 400


def test_too_large(client, fake):
    r = client.post("/api/orders", content=b"x" * (main.MAX_BODY_BYTES + 1))
    assert r.status_code == 413


@pytest.mark.parametrize("over,field", [
    ({"items": []}, "items"),
    ({"items": [{"menu_item_id": BURGER, "quantity": 0}]}, "items"),
    ({"items": [{"menu_item_id": BURGER, "quantity": -1}]}, "items"),
    ({"items": [{"menu_item_id": BURGER, "quantity": 1.5}]}, "items"),
    ({"items": [{"menu_item_id": BURGER, "quantity": "2"}]}, "items"),
    ({"items": [{"menu_item_id": BURGER, "quantity": 21}]}, "items"),
    ({"items": [{"menu_item_id": "not-a-uuid", "quantity": 1}]}, "items"),
    ({"items": [{"menu_item_id": BURGER, "quantity": 1}, {"menu_item_id": BURGER, "quantity": 2}]}, "items"),
    ({"items": [{"menu_item_id": f"{i:08d}-0000-4000-8000-000000000000", "quantity": 1} for i in range(31)]}, "items"),
    ({"customer_name": "A"}, "customer_name"),
    ({"customer_name": "x" * 81}, "customer_name"),
    ({"customer_phone": "abc"}, "customer_phone"),
    ({"notes": "n" * 501}, "notes"),
    ({"pickup_time": ""}, "pickup_time"),
])
def test_validation(client, fake, over, field):
    r = client.post("/api/orders", json=order(**over))
    assert r.status_code == 422, r.text
    assert code(r) == "invalid_order" and field in r.json()["detail"]["fields"]
    assert fake.rpc_calls == []


def test_missing_fields(client, fake):
    r = client.post("/api/orders", json={})
    assert r.status_code == 422
    assert set(r.json()["detail"]["fields"]) >= {"customer_name", "customer_phone", "pickup_time", "items"}


def test_product_unavailable(client, fake):
    r = client.post("/api/orders", json=order(items=[{"menu_item_id": SOLD_OUT, "quantity": 1}]))
    assert r.status_code == 409 and code(r) == "product_unavailable"
    assert fake.rpc_calls == []


def test_product_not_found_and_other_restaurant(client, fake):
    for pid in ("55555555-5555-4555-8555-555555555555", FOREIGN):
        r = client.post("/api/orders", json=order(items=[{"menu_item_id": pid, "quantity": 1}]))
        assert r.status_code == 422 and code(r) == "product_not_found"
    assert fake.rpc_calls == []


def test_orders_closed(client, fake):
    fake.accepting = False
    r = client.post("/api/orders", json=order())
    assert r.status_code == 409 and code(r) == "orders_closed"
    assert fake.rpc_calls == []


def test_slot_not_offered(client, fake):
    r = client.post("/api/orders", json=order(pickup_time="03:00"))
    assert r.status_code == 409 and code(r) == "slot_unavailable"
    assert fake.rpc_calls == []


def test_save_failure_is_generic_and_hides_details(client, fake):
    fake.rpc_error = (500, {"code": "23503", "message": "insert on order_items violates fk",
                            "details": "Key (secret)=..."})
    r = client.post("/api/orders", json=order())
    assert r.status_code == 503 and code(r) == "order_save_failed"
    assert "order_items" not in r.text and "secret" not in r.text.lower()


def test_rpc_business_errors_are_mapped(client, fake):
    fake.rpc_error = (400, {"code": "P0001", "message": "price_changed"})
    r = client.post("/api/orders", json=order())
    assert r.status_code == 409 and code(r) == "price_changed"


def test_existing_endpoints_still_work(client, fake):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/orders/config").json()["accepting"] is True
