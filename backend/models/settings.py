from sqlalchemy import Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from models.sql_orders import Base


class OrderSettings(Base):
    __tablename__ = "order_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    accepting_orders: Mapped[bool] = mapped_column(Boolean, nullable=False)
    prep_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    slot_step_min: Mapped[int] = mapped_column(Integer, nullable=False)
    last_pickup_before_close_min: Mapped[int] = mapped_column(Integer, nullable=False)
    days_ahead: Mapped[int] = mapped_column(Integer, nullable=False)
    max_per_slot: Mapped[int] = mapped_column(Integer, nullable=False)


class OpeningHours(Base):
    __tablename__ = "opening_hours"

    weekday: Mapped[int] = mapped_column(Integer, primary_key=True)
    open_from_min: Mapped[int | None] = mapped_column(Integer)
    close_len_min: Mapped[int | None] = mapped_column(Integer)
