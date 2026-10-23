"""Pickup order business logic: pickup slots and server-side pricing. No I/O here."""

import secrets
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from lib.hours import CLOSE_LEN, OPEN_FROM, TZ
from models.orders import Order, OrderCreate, OrderLine

PREP_MINUTES = 20  # earliest pickup = now + prep time
SLOT_STEP = 15
LAST_PICKUP_BEFORE_CLOSE = 15  # last slot is 15 min before closing


class OrderError(ValueError):
    """Raised with a stable code the frontend translates."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _service_window(now: datetime) -> tuple[datetime, datetime] | None:
    """(service_start, service_close) of the service open right now, else None."""
    minutes = now.hour * 60 + now.minute
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    wd = now.weekday()
    if wd in CLOSE_LEN and minutes >= OPEN_FROM:
        start = midnight + timedelta(minutes=OPEN_FROM)
        return start, start + timedelta(minutes=CLOSE_LEN[wd])
    prev = (wd - 1) % 7
    if prev in CLOSE_LEN:
        start = midnight - timedelta(days=1) + timedelta(minutes=OPEN_FROM)
        close = start + timedelta(minutes=CLOSE_LEN[prev])
        if now < close:
            return start, close
    return None


def pickup_slots(now: datetime) -> tuple[list[datetime], str | None]:
    """Bookable pickup times for the current service. Returns (slots, reason_if_empty)."""
    window = _service_window(now)
    if window is None:
        return [], "closed"
    _, close = window
    earliest = now + timedelta(minutes=PREP_MINUTES)
    if earliest.second or earliest.microsecond:
        earliest += timedelta(minutes=1)
    earliest = earliest.replace(second=0, microsecond=0)
    first = earliest + timedelta(minutes=(-earliest.minute) % SLOT_STEP)  # round up to the slot step
    last = close - timedelta(minutes=LAST_PICKUP_BEFORE_CLOSE)
    slots = []
    t = first
    while t <= last:
        slots.append(t)
        t += timedelta(minutes=SLOT_STEP)
    return slots, (None if slots else "last_orders")


def _money(d: Decimal) -> float:
    return float(d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def new_order_number(now: datetime) -> str:
    return f"P-{now.strftime('%y%m%d')}-{secrets.token_hex(2).upper()}"


def build_order(body: OrderCreate, menu_by_id: dict[str, dict], now: datetime) -> Order:
    """Validates the request against the live menu and pickup slots; prices come ONLY from the menu."""
    slots, reason = pickup_slots(now)
    if not slots:
        raise OrderError(reason or "closed")
    by_label = {s.strftime("%H:%M"): s for s in slots}
    pickup_at = by_label.get(body.pickup_time)
    if pickup_at is None:
        raise OrderError("invalid_pickup_time")

    # merge duplicate lines, keep first-seen order
    qty: dict[str, int] = {}
    for it in body.items:
        qty[it.menu_item_id] = qty.get(it.menu_item_id, 0) + it.quantity

    lines: list[OrderLine] = []
    subtotal = Decimal("0")
    for item_id, q in qty.items():
        item = menu_by_id.get(item_id)
        if item is None or not item.get("available", False):
            raise OrderError("item_unavailable")
        if q > 50:
            raise OrderError("quantity_too_high")
        unit = Decimal(str(item["price"]))
        line_total = unit * q
        subtotal += line_total
        lines.append(
            OrderLine(menu_item_id=item_id, name=item["name"], unit_price=_money(unit), quantity=q, line_total=_money(line_total))
        )

    return Order(
        order_number=new_order_number(now),
        customer_name=body.customer_name.strip(),
        customer_phone=body.customer_phone.strip(),
        notes=body.notes.strip(),
        pickup_at=pickup_at.astimezone(TZ),
        pickup_time=body.pickup_time,
        items=lines,
        subtotal=_money(subtotal),
        total=_money(subtotal),  # no fees: pickup only, prices include VAT
    )
