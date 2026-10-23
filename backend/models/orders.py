"""Pickup order API contract. Mirrored by frontend/src/features/orders/types.ts — keep in sync."""

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

OrderStatus = Literal["pending", "preparing", "ready", "collected", "cancelled"]
StoreMode = Literal["demo", "supabase"]


class OrderItemIn(BaseModel):
    menu_item_id: str = Field(min_length=1, max_length=64)
    quantity: int = Field(ge=1, le=50)


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=2, max_length=80)
    customer_phone: str = Field(min_length=6, max_length=25)
    notes: str = Field(default="", max_length=500)
    pickup_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    items: list[OrderItemIn] = Field(min_length=1, max_length=40)


class OrderLine(BaseModel):
    menu_item_id: str
    name: str
    unit_price: float  # euros, VAT included, taken from the menu at order time
    quantity: int
    line_total: float


class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    customer_name: str
    customer_phone: str
    notes: str = ""
    pickup_at: datetime  # aware, Europe/Madrid
    pickup_time: str  # "HH:MM" label shown to the guest
    items: list[OrderLine]
    subtotal: float
    total: float
    currency: Literal["EUR"] = "EUR"
    fulfillment: Literal["pickup"] = "pickup"  # pickup only: no delivery
    payment: Literal["pay_at_pickup"] = "pay_at_pickup"
    status: OrderStatus = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrderConfig(BaseModel):
    mode: StoreMode  # "demo" = orders are NOT saved anywhere
    accepting: bool
    reason: Optional[Literal["closed", "last_orders"]] = None
    pickup_slots: list[str] = Field(default_factory=list)
    prep_minutes: int


class OrderResult(BaseModel):
    order: Order
    persisted: bool  # False in demo mode: nothing was stored, the restaurant was NOT notified
    mode: StoreMode
