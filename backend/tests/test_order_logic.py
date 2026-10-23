"""Pure order logic: pricing from the menu + pickup slots. No network, no DB."""

from datetime import datetime

import pytest

from lib.hours import TZ
from lib.orders import OrderError, build_order, pickup_slots
from models.orders import OrderCreate, OrderItemIn

MENU = {
    "a": {"id": "a", "name": "Cheese Bacon", "price": 9.5, "available": True},
    "b": {"id": "b", "name": "Croquetas", "price": 1.5, "available": True},
    "c": {"id": "c", "name": "Big Secret", "price": 14.5, "available": True},
    "x": {"id": "x", "name": "Hidden", "price": 5.0, "available": False},
}


def at(y, m, d, h, mi, s=0):
    return datetime(y, m, d, h, mi, s, tzinfo=TZ)


THU_20 = at(2026, 10, 22, 20, 0)  # Thursday, open 19:00-00:00


def body(items, time="20:30"):
    return OrderCreate(
        customer_name="Ana", customer_phone="600111222", pickup_time=time,
        items=[OrderItemIn(menu_item_id=i, quantity=q) for i, q in items],
    )


def labels(now):
    return [s.strftime("%H:%M") for s in pickup_slots(now)[0]]


def test_slots_thursday_evening():
    s = labels(THU_20)
    assert s[0] == "20:30" and s[-1] == "23:45"  # now+20 rounded up to 15; last = close-15


def test_slots_round_up_with_seconds():
    assert labels(at(2026, 10, 22, 20, 10, 30))[0] == "20:45"  # 20:30:30 -> 20:45


def test_closed_monday_and_before_opening():
    assert pickup_slots(at(2026, 10, 19, 21, 0)) == ([], "closed")
    assert pickup_slots(at(2026, 10, 22, 18, 30)) == ([], "closed")


def test_after_midnight_saturday_is_friday_service():
    s = labels(at(2026, 10, 24, 0, 10))  # Sat 00:10, Friday service closes 01:00
    assert s == ["00:30", "00:45"]


def test_friday_after_midnight_closed_because_thursday_closes_at_midnight():
    assert pickup_slots(at(2026, 10, 23, 0, 10)) == ([], "closed")


def test_last_orders():
    assert pickup_slots(at(2026, 10, 22, 23, 40)) == ([], "last_orders")


def test_totals_from_menu_and_merged_lines():
    o = build_order(body([("a", 2), ("b", 3), ("a", 1)]), MENU, THU_20)
    assert [(line.name, line.quantity, line.line_total) for line in o.items] == [("Cheese Bacon", 3, 28.5), ("Croquetas", 3, 4.5)]
    assert o.subtotal == 33.0 and o.total == 33.0
    assert o.fulfillment == "pickup" and o.status == "pending"
    assert o.order_number.startswith("P-261022-")


def test_decimal_precision():
    o = build_order(body([("b", 7), ("c", 3)]), MENU, THU_20)  # 10.5 + 43.5
    assert o.total == 54.0


@pytest.mark.parametrize(
    "items,time,code",
    [
        ([("x", 1)], "20:30", "item_unavailable"),
        ([("zzz", 1)], "20:30", "item_unavailable"),
        ([("a", 1)], "20:15", "invalid_pickup_time"),
        ([("a", 30), ("a", 30)], "20:30", "quantity_too_high"),
    ],
)
def test_rejections(items, time, code):
    with pytest.raises(OrderError) as e:
        build_order(body(items, time), MENU, THU_20)
    assert e.value.code == code
