import hmac
import os
from datetime import timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response

from lib.auth import clear_session, is_admin, issue_session, require_admin
from lib.db import db
from lib.email import notify_booking_status
from lib.hours import now_madrid
from models.restaurant import (
    AdminMe,
    AdminStats,
    Booking,
    BookingStatusUpdate,
    MenuItem,
    MenuItemCreate,
    MenuItemUpdate,
    Message,
    MessageUpdate,
    PinLogin,
)

router = APIRouter(prefix="/admin")
protected = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])


def _aware(doc: dict) -> dict:
    ca = doc.get("created_at")
    if ca is not None and ca.tzinfo is None:
        doc["created_at"] = ca.replace(tzinfo=timezone.utc)
    return doc


# ---------- Auth ----------
@router.post("/login", response_model=AdminMe)
async def login(body: PinLogin, response: Response):
    if not hmac.compare_digest(body.pin, os.environ["ADMIN_PIN"]):
        raise HTTPException(status_code=401, detail="invalid_pin")
    issue_session(response)
    return AdminMe(authenticated=True)


@router.post("/logout", response_model=AdminMe)
async def logout(response: Response):
    clear_session(response)
    return AdminMe(authenticated=False)


@router.get("/me", response_model=AdminMe)
async def me(request: Request):
    return AdminMe(authenticated=is_admin(request))


# ---------- Stats ----------
@protected.get("/stats", response_model=AdminStats)
async def stats():
    today = now_madrid().strftime("%Y-%m-%d")
    return AdminStats(
        pending_bookings=await db.bookings.count_documents({"status": "pending"}),
        upcoming_bookings=await db.bookings.count_documents(
            {"date": {"$gte": today}, "status": {"$in": ["pending", "confirmed"]}}
        ),
        unread_messages=await db.messages.count_documents({"read": False}),
        menu_items=await db.menu_items.count_documents({}),
    )


# ---------- Bookings ----------
@protected.get("/bookings", response_model=List[Booking])
async def list_bookings(status: Optional[str] = None):
    q = {"status": status} if status and status != "all" else {}
    docs = await db.bookings.find(q, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(2000)
    return [Booking(**_aware(d)) for d in docs]


@protected.patch("/bookings/{id}", response_model=Booking)
async def update_booking(id: str, body: BookingStatusUpdate, background: BackgroundTasks):
    before = await db.bookings.find_one({"id": id}, {"_id": 0, "status": 1})
    if not before:
        raise HTTPException(status_code=404, detail="not found")
    doc = await db.bookings.find_one_and_update(
        {"id": id}, {"$set": {"status": body.status}}, projection={"_id": 0}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="not found")
    if before.get("status") != body.status:
        background.add_task(notify_booking_status, dict(doc))
    return Booking(**_aware(doc))


# ---------- Messages ----------
@protected.get("/messages", response_model=List[Message])
async def list_messages():
    docs = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [Message(**_aware(d)) for d in docs]


@protected.patch("/messages/{id}", response_model=Message)
async def update_message(id: str, body: MessageUpdate):
    doc = await db.messages.find_one_and_update(
        {"id": id}, {"$set": {"read": body.read}}, projection={"_id": 0}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="not found")
    return Message(**_aware(doc))


@protected.delete("/messages/{id}", status_code=204)
async def delete_message(id: str):
    res = await db.messages.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="not found")


# ---------- Menu ----------
@protected.get("/menu", response_model=List[MenuItem])
async def admin_menu():
    docs = await db.menu_items.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    return [MenuItem(**d) for d in docs]


@protected.post("/menu", response_model=MenuItem, status_code=201)
async def create_menu_item(body: MenuItemCreate):
    item = MenuItem(**body.model_dump())
    await db.menu_items.insert_one(item.model_dump())
    return item


@protected.patch("/menu/{id}", response_model=MenuItem)
async def update_menu_item(id: str, body: MenuItemUpdate):
    changes = body.model_dump(exclude_unset=True)
    doc = await db.menu_items.find_one_and_update(
        {"id": id}, {"$set": changes}, projection={"_id": 0}, return_document=True
    ) if changes else await db.menu_items.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="not found")
    return MenuItem(**doc)


@protected.delete("/menu/{id}", status_code=204)
async def delete_menu_item(id: str):
    res = await db.menu_items.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="not found")
