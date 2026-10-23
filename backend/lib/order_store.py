"""Where pickup orders are stored. Swap point for the Supabase integration.

- DemoOrderStore (default): stores NOTHING. Used while DATABASE_URL is not configured.
- SupabaseOrderStore: writes to Supabase Postgres (tables in alembic/versions/0001_create_orders.py).
  Activates automatically when DATABASE_URL (Supabase *Transaction Pooler* URI, port 6543) is set
  in backend/.env and `alembic upgrade head` has been run.
"""

import logging
import os
from typing import Protocol

from models.orders import Order, StoreMode

logger = logging.getLogger(__name__)


class OrderStore(Protocol):
    mode: StoreMode

    async def save(self, order: Order) -> bool:
        """Persist the order. Returns True only if it was really stored."""
        ...


class DemoOrderStore:
    mode: StoreMode = "demo"

    async def save(self, order: Order) -> bool:
        logger.info(f"[demo] order {order.order_number} NOT stored (Supabase not connected)")
        return False


class SupabaseOrderStore:
    mode: StoreMode = "supabase"

    async def save(self, order: Order) -> bool:
        # Imported lazily so the app runs without the Postgres driver being exercised in demo mode.
        from lib.supabase_db import session_scope
        from models.sql_orders import OrderItemRow, OrderRow

        async with session_scope() as session:
            row = OrderRow(
                id=order.id,
                order_number=order.order_number,
                customer_name=order.customer_name,
                customer_phone=order.customer_phone,
                notes=order.notes,
                pickup_at=order.pickup_at,
                subtotal=order.subtotal,
                total=order.total,
                currency=order.currency,
                fulfillment=order.fulfillment,
                payment=order.payment,
                status=order.status,
                created_at=order.created_at,
            )
            row.items = [
                OrderItemRow(
                    menu_item_id=line.menu_item_id,
                    name=line.name,
                    unit_price=line.unit_price,
                    quantity=line.quantity,
                    line_total=line.line_total,
                    position=i,
                )
                for i, line in enumerate(order.items)
            ]
            session.add(row)
            await session.commit()  # order + items in one transaction
        return True


def get_order_store() -> OrderStore:
    if os.environ.get("DATABASE_URL"):
        return SupabaseOrderStore()
    return DemoOrderStore()
