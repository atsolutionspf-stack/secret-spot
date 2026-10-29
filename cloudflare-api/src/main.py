import json
import re
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated, Optional
from urllib.parse import urlencode
from uuid import UUID

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from workers import asgi, fetch

app = FastAPI(title="Secret Spot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://secret-spot.pages.dev"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------


class SupabaseError(HTTPException):
    """Supabase answered with a non-2xx status.

    The client only sees a generic 502. The raw Supabase body is kept in
    ``payload`` for internal mapping and is never returned or logged.
    """

    def __init__(self, upstream_status: int, payload):
        super().__init__(status_code=502, detail="Error de Supabase")
        self.upstream_status = upstream_status
        self.payload = payload


async def supabase_request(
    request: Request,
    path: str,
    method: str = "GET",
    body=None,
):
    env = request.scope["env"]
    supabase_url = env.SUPABASE_URL.rstrip("/")
    secret_key = env.SUPABASE_SECRET_KEY

    headers = {
        "apikey": secret_key,
        "Authorization": f"Bearer {secret_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    response = await fetch(
        f"{supabase_url}{path}",
        method=method,
        headers=headers,
        body=json.dumps(body) if body is not None else None,
    )

    response_body = await response.text()

    if response.status < 200 or response.status >= 300:
        try:
            payload = json.loads(response_body) if response_body else None
        except ValueError:
            payload = None
        raise SupabaseError(response.status, payload)

    return json.loads(response_body) if response_body else None


def api_error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


# ---------------------------------------------------------------------------
# Existing endpoints
# ---------------------------------------------------------------------------


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "secret-spot-api",
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/menu")
async def get_menu(request: Request):
    env = request.scope["env"]
    restaurant_id = env.RESTAURANT_ID

    params = urlencode({
        "select": (
            "id,name,category,description_es,description_en,"
            "ingredients,price,price_note,tags,allergens,"
            "available,sort_order"
        ),
        "restaurant_id": f"eq.{restaurant_id}",
        "available": "eq.true",
        "order": "sort_order.asc",
    })

    try:
        return await supabase_request(
            request,
            f"/rest/v1/menu_items?{params}",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Error interno consultando la carta: {type(exc).__name__}",
        )


async def fetch_order_config(request: Request) -> dict:
    env = request.scope["env"]
    result = await supabase_request(
        request,
        "/rest/v1/rpc/order_config",
        method="POST",
        body={"p_restaurant_id": env.RESTAURANT_ID},
    )
    # The RPC may return an object or a one-row table.
    if isinstance(result, list):
        result = result[0] if result else {}
    return result or {}


@app.get("/api/orders/config")
async def get_order_config(request: Request):
    try:
        return await fetch_order_config(request)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Error interno consultando la configuración de pedidos: "
                f"{type(exc).__name__}"
            ),
        )


# ---------------------------------------------------------------------------
# POST /api/orders  (pickup only, pay at pickup)
# ---------------------------------------------------------------------------

MAX_BODY_BYTES = 16 * 1024
MAX_LINES = 30
MAX_QTY_PER_LINE = 20
PHONE_RE = re.compile(r"^\+?[0-9][0-9 ()\-]{5,19}$")
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
CENT = Decimal("0.01")

# Messages raised by public.create_pickup_order (see sql/create_pickup_order.sql).
RPC_ERRORS = {
    "orders_closed": (409, "Ahora mismo no aceptamos pedidos."),
    "slot_unavailable": (409, "La hora de recogida elegida ya no está disponible."),
    "product_not_found": (422, "Algún producto no existe en la carta."),
    "product_unavailable": (409, "Algún producto ya no está disponible."),
    "price_changed": (409, "Los precios han cambiado. Revisa tu pedido."),
    "duplicate_item": (422, "Hay productos repetidos en el pedido."),
    "empty_order": (422, "El pedido está vacío."),
    "invalid_order": (422, "El pedido no es válido."),
}


class OrderLineIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    menu_item_id: UUID
    quantity: Annotated[int, Field(strict=True, ge=1, le=MAX_QTY_PER_LINE)]


class OrderIn(BaseModel):
    # Unknown fields (price, restaurant_id, total...) are ignored, never trusted.
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    customer_name: Annotated[str, Field(min_length=2, max_length=80)]
    customer_phone: Annotated[str, Field(min_length=6, max_length=20)]
    notes: Optional[Annotated[str, Field(max_length=500)]] = None
    pickup_time: Annotated[str, Field(min_length=4, max_length=40)]
    items: Annotated[list[OrderLineIn], Field(min_length=1, max_length=MAX_LINES)]

    @field_validator("customer_name", "notes", "pickup_time")
    @classmethod
    def no_control_chars(cls, v):
        if v is not None and CONTROL_RE.search(v):
            raise ValueError("caracteres no permitidos")
        return v

    @field_validator("customer_phone")
    @classmethod
    def valid_phone(cls, v: str):
        digits = sum(c.isdigit() for c in v)
        if not PHONE_RE.match(v) or not 6 <= digits <= 15:
            raise ValueError("teléfono no válido")
        return v

    @field_validator("items")
    @classmethod
    def unique_items(cls, v: list[OrderLineIn]):
        ids = [line.menu_item_id for line in v]
        if len(ids) != len(set(ids)):
            raise ValueError("productos duplicados")
        return v


class OrderCreated(BaseModel):
    order_number: str
    status: str
    pickup_time: str
    total: float
    currency: str


def _money(value) -> Decimal:
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


async def _read_order(request: Request) -> OrderIn:
    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        raise api_error(413, "payload_too_large", "El pedido es demasiado grande.")
    try:
        data = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise api_error(400, "invalid_json", "El cuerpo debe ser JSON válido.")
    if not isinstance(data, dict):
        raise api_error(400, "invalid_json", "El cuerpo debe ser un objeto JSON.")
    try:
        return OrderIn.model_validate(data)
    except ValidationError as exc:
        # Field names only; never echo the submitted values back.
        fields = sorted({str(err["loc"][0]) for err in exc.errors() if err["loc"]})
        raise HTTPException(
            status_code=422,
            detail={
                "code": "invalid_order",
                "message": "Revisa los datos del pedido.",
                "fields": fields,
            },
        )


@app.post("/api/orders", status_code=201, response_model=OrderCreated)
async def create_order(request: Request):
    order = await _read_order(request)
    restaurant_id = request.scope["env"].RESTAURANT_ID

    try:
        # 1. Orders enabled + chosen slot offered right now.
        config = await fetch_order_config(request)
        if not config.get("accepting"):
            raise api_error(409, "orders_closed", RPC_ERRORS["orders_closed"][1])
        slots = [str(s) for s in (config.get("pickup_slots") or [])]
        if order.pickup_time not in slots:
            raise api_error(409, "slot_unavailable", RPC_ERRORS["slot_unavailable"][1])

        # 2. Products from this restaurant only, with current prices.
        ids = ",".join(str(line.menu_item_id) for line in order.items)
        params = urlencode({
            "select": "id,name,price,available",
            "restaurant_id": f"eq.{restaurant_id}",
            "id": f"in.({ids})",
        })
        rows = await supabase_request(request, f"/rest/v1/menu_items?{params}") or []
        by_id = {str(r["id"]): r for r in rows}

        subtotal = Decimal("0.00")
        for line in order.items:
            item = by_id.get(str(line.menu_item_id))
            if item is None:
                raise api_error(422, "product_not_found", RPC_ERRORS["product_not_found"][1])
            if item.get("available") is not True:
                raise api_error(409, "product_unavailable", RPC_ERRORS["product_unavailable"][1])
            subtotal += _money(item["price"]) * line.quantity

        # 3. Atomic insert of order + lines. The RPC re-checks everything
        #    inside one transaction and recomputes prices itself.
        saved = await supabase_request(
            request,
            "/rest/v1/rpc/create_pickup_order",
            method="POST",
            body={
                "p_restaurant_id": restaurant_id,
                "p_customer_name": order.customer_name,
                "p_customer_phone": order.customer_phone,
                "p_notes": order.notes or None,
                "p_pickup_time": order.pickup_time,
                "p_items": [
                    {"menu_item_id": str(line.menu_item_id), "quantity": line.quantity}
                    for line in order.items
                ],
                "p_expected_total": str(subtotal),
            },
        )
    except SupabaseError as exc:
        message = (exc.payload or {}).get("message") if isinstance(exc.payload, dict) else None
        if message in RPC_ERRORS:
            status, text = RPC_ERRORS[message]
            raise api_error(status, message, text)
        print(f"create_order: Supabase error status={exc.upstream_status}")
        raise api_error(503, "order_save_failed", "No se pudo guardar el pedido. Inténtalo de nuevo.")
    except HTTPException:
        raise
    except Exception as exc:
        print(f"create_order: unexpected {type(exc).__name__}")
        raise api_error(503, "order_save_failed", "No se pudo guardar el pedido. Inténtalo de nuevo.")

    if isinstance(saved, list):
        saved = saved[0] if saved else None
    if not isinstance(saved, dict) or not saved.get("order_number"):
        raise api_error(503, "order_save_failed", "No se pudo guardar el pedido. Inténtalo de nuevo.")

    return OrderCreated(
        order_number=saved["order_number"],
        status=saved["status"],
        pickup_time=str(saved["pickup_time"]),
        total=float(_money(saved["total"])),
        currency=saved.get("currency") or "EUR",
    )

@app.get("/api/debug/routes")
async def debug_routes():
    return {
        "routes": [
            {
                "path": getattr(route, "path", ""),
                "methods": sorted(getattr(route, "methods", []) or []),
            }
            for route in app.routes
        ]
    }

Default = asgi.entrypoint(app)
