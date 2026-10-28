import json
from urllib.parse import urlencode

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from workers import asgi, fetch

app = FastAPI(title="Secret Spot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://secret-spot.pages.dev"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


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
        raise HTTPException(
            status_code=502,
            detail=f"Error de Supabase: {response_body}",
        )

    return json.loads(response_body) if response_body else None


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
            detail=f"Error interno consultando la carta: {type(exc).__name__}: {exc}",
        )


@app.get("/api/orders/config")
async def get_order_config(request: Request):
    env = request.scope["env"]
    restaurant_id = env.RESTAURANT_ID

    try:
        result = await supabase_request(
            request,
            "/rest/v1/rpc/order_config",
            method="POST",
            body={"p_restaurant_id": restaurant_id},
        )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Error interno consultando la configuración de pedidos: "
                f"{type(exc).__name__}: {exc}"
            ),
        )


Default = asgi.entrypoint(app)
