
import os
import json
from urllib.parse import urlencode

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from workers import asgi, env, fetch

app = FastAPI(title="Secret Spot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://secret-spot.pages.dev"],
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/")
async def root():
    return {"status": "ok", "service": "secret-spot-api"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/menu")
async def get_menu():
    try:
        supabase_url = env.SUPABASE_URL.rstrip("/")
        secret_key = env.SUPABASE_SECRET_KEY
        restaurant_id = env.RESTAURANT_ID

        params = urlencode({
            "select": (
                "id,name,category,description_es,description_en,"
                "price,price_note,tags,allergens,available,sort_order"
            ),
            "restaurant_id": f"eq.{restaurant_id}",
            "available": "eq.true",
            "order": "sort_order.asc",
        })

        response = await fetch(
            f"{supabase_url}/rest/v1/menu_items?{params}",
            method="GET",
            headers={
                "apikey": secret_key,
                "Authorization": f"Bearer {secret_key}",
                "Accept": "application/json",
            },
        )

        body = await response.text()

        if response.status < 200 or response.status >= 300:
            raise HTTPException(
                status_code=502,
                detail=f"Error consultando la carta: {body}",
            )

        return json.loads(body)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo consultar la carta: {type(exc).__name__}",
        )


Default = asgi.entrypoint(app)
