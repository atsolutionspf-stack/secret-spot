import secrets
from typing import List

from fastapi import APIRouter, HTTPException

from lib.db import db
from lib.hours import is_open, now_madrid, validate_booking_slot
from models.restaurant import Booking, BookingCreate, HoursStatus, MenuItem, Message, MessageCreate

router = APIRouter()


@router.get("/hours", response_model=HoursStatus)
async def hours_status():
    now = now_madrid()
    return HoursStatus(
        today=now.strftime("%Y-%m-%d"),
        is_open=is_open(now),
        now_time=now.strftime("%H:%M"),
        weekday=now.weekday(),
    )


@router.get("/menu", response_model=List[MenuItem])
async def public_menu():
    docs = await db.menu_items.find({"available": True}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    return [MenuItem(**d) for d in docs]


@router.post("/bookings", response_model=Booking, status_code=201)
async def create_booking(body: BookingCreate):
    err = validate_booking_slot(body.date, body.time)
    if err:
        raise HTTPException(status_code=400, detail=err)
    booking = Booking(**body.model_dump(), code="SS-" + secrets.token_hex(3).upper())
    await db.bookings.insert_one(booking.model_dump())
    return booking


@router.post("/messages", response_model=Message, status_code=201)
async def create_message(body: MessageCreate):
    msg = Message(**body.model_dump())
    await db.messages.insert_one(msg.model_dump())
    return msg
