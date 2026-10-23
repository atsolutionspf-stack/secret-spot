from fastapi import APIRouter, BackgroundTasks, HTTPException

from lib.db import db
from lib.email import notify_new_order
from lib.hours import now_madrid
from lib.order_store import get_order_store
from lib.orders import PREP_MINUTES, OrderError, build_order, pickup_slots
from models.orders import OrderConfig, OrderCreate, OrderResult

router = APIRouter(prefix="/orders")


@router.get("/config", response_model=OrderConfig)
async def order_config():
    slots, reason = pickup_slots(now_madrid())
    return OrderConfig(
        mode=get_order_store().mode,
        accepting=bool(slots),
        reason=reason,
        pickup_slots=[s.strftime("%H:%M") for s in slots],
        prep_minutes=PREP_MINUTES,
    )


@router.post("", response_model=OrderResult, status_code=201)
async def create_order(body: OrderCreate, background: BackgroundTasks):
    ids = list({i.menu_item_id for i in body.items})
    docs = await db.menu_items.find({"id": {"$in": ids}}, {"_id": 0}).to_list(len(ids))
    try:
        order = build_order(body, {d["id"]: d for d in docs}, now_madrid())
    except OrderError as e:
        raise HTTPException(status_code=400, detail=e.code)

    store = get_order_store()
    try:
        persisted = await store.save(order)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=503, detail="store_unavailable")
    if persisted:
        background.add_task(notify_new_order, order.model_dump())
    return OrderResult(order=order, persisted=persisted, mode=store.mode)
