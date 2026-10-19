import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

Category = Literal["burgers", "alitas", "poke", "sides", "sweets"]
Tag = Literal["vegan", "spicy", "star", "new"]
BookingStatus = Literal["pending", "confirmed", "cancelled", "completed"]


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Menu ----------
class MenuItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category: Category
    description_es: str = Field(default="", max_length=300)
    description_en: str = Field(default="", max_length=300)
    price: float = Field(ge=0, le=1000)
    price_note: str = Field(default="", max_length=20)  # e.g. "ud." for per-unit
    tags: list[Tag] = Field(default_factory=list)
    allergens: str = Field(default="", max_length=40)
    available: bool = True
    sort_order: int = 0


class MenuItemCreate(MenuItemBase):
    pass


class MenuItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    category: Optional[Category] = None
    description_es: Optional[str] = Field(default=None, max_length=300)
    description_en: Optional[str] = Field(default=None, max_length=300)
    price: Optional[float] = Field(default=None, ge=0, le=1000)
    price_note: Optional[str] = Field(default=None, max_length=20)
    tags: Optional[list[Tag]] = None
    allergens: Optional[str] = Field(default=None, max_length=40)
    available: Optional[bool] = None
    sort_order: Optional[int] = None


class MenuItem(MenuItemBase):
    id: str = Field(default_factory=_uuid)


# ---------- Bookings ----------
class BookingCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=6, max_length=25)
    email: EmailStr
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    party_size: int = Field(ge=1, le=30)
    note: str = Field(default="", max_length=500)
    lang: Literal["es", "en"] = "es"  # guest's site language, used for their emails


class Booking(BookingCreate):
    id: str = Field(default_factory=_uuid)
    code: str = ""
    status: BookingStatus = "pending"
    created_at: datetime = Field(default_factory=_now)


class BookingStatusUpdate(BaseModel):
    status: BookingStatus


# ---------- Messages ----------
class MessageCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: str = Field(default="", max_length=25)
    subject: str = Field(min_length=2, max_length=120)
    message: str = Field(min_length=2, max_length=500)


class Message(MessageCreate):
    id: str = Field(default_factory=_uuid)
    read: bool = False
    created_at: datetime = Field(default_factory=_now)


class MessageUpdate(BaseModel):
    read: bool


# ---------- Hours / Admin ----------
class HoursStatus(BaseModel):
    today: str
    is_open: bool
    now_time: str
    weekday: int  # 0=Mon .. 6=Sun (Europe/Madrid)


class PinLogin(BaseModel):
    pin: str = Field(min_length=1, max_length=20)


class AdminMe(BaseModel):
    authenticated: bool


class AdminStats(BaseModel):
    pending_bookings: int
    upcoming_bookings: int
    unread_messages: int
    menu_items: int
