"""SQLAlchemy tables for Supabase. Schema changes go through Alembic (backend/alembic)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


ORDER_STATUSES = ("pending", "preparing", "ready", "collected", "cancelled")


class OrderRow(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(f"status IN {ORDER_STATUSES}", name="orders_status_check"),
        CheckConstraint("fulfillment = 'pickup'", name="orders_pickup_only"),
        CheckConstraint("total >= 0 AND subtotal >= 0", name="orders_amounts_non_negative"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    customer_name: Mapped[str] = mapped_column(String(80), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(25), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    pickup_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    fulfillment: Mapped[str] = mapped_column(String(10), nullable=False, default="pickup")
    payment: Mapped[str] = mapped_column(String(20), nullable=False, default="pay_at_pickup")
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )

    items: Mapped[list["OrderItemRow"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItemRow.position"
    )


class OrderItemRow(Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="order_items_quantity_positive"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    menu_item_id: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)  # snapshot at order time
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)  # snapshot at order time
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    order: Mapped[OrderRow] = relationship(back_populates="items")
