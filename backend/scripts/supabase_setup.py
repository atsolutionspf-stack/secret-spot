"""One-off Supabase setup. Run: cd /app/backend && python scripts/supabase_setup.py
1) alembic upgrade head (stamps 0001 first if the orders tables were created by hand from schema.sql)
2) copies the current menu from Mongo into public.menu_items (only if empty)
3) creates/updates the owner admin user (email + phone) and adds it to public.admins
Prints no secrets. Needs DATABASE_URL (transaction pooler), SUPABASE_ACCESS_TOKEN, VITE_SUPABASE_URL.
"""

import asyncio
import json
import os
import secrets
import subprocess
import sys
from pathlib import Path

import httpx
import psycopg2
from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND / ".env")
load_dotenv(BACKEND.parent / "frontend" / ".env")
sys.path.insert(0, str(BACKEND))

OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "Josepmartinadani80@gmail.com").lower()
OWNER_PHONE = "+34613528535"
REF = os.environ["VITE_SUPABASE_URL"].split("//")[1].split(".")[0]


def migrate(conn) -> None:
    cur = conn.cursor()
    cur.execute("select to_regclass('public.alembic_version'), to_regclass('public.orders')")
    has_version, has_orders = cur.fetchone()
    if has_orders and not has_version:
        subprocess.run(["alembic", "stamp", "0001_create_orders"], cwd=BACKEND, check=True)
    subprocess.run(["alembic", "upgrade", "head"], cwd=BACKEND, check=True)


def copy_menu(conn) -> None:
    from lib.db import db

    cur = conn.cursor()
    cur.execute("select count(*) from public.menu_items")
    if cur.fetchone()[0]:
        print("menu already in Supabase")
        return
    async def load():
        return await db.menu_items.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)

    docs = asyncio.run(load())
    for d in docs:
        cur.execute(
            """insert into public.menu_items(id,name,category,description_es,description_en,price,price_note,tags,allergens,available,sort_order)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (d["id"], d["name"], d["category"], d.get("description_es", ""), d.get("description_en", ""), d["price"],
             d.get("price_note", ""), d.get("tags", []), d.get("allergens", ""), d.get("available", True), d.get("sort_order", 0)),
        )
    conn.commit()
    print(f"copied {len(docs)} menu items")


def service_key() -> str:
    r = httpx.get(
        f"https://api.supabase.com/v1/projects/{REF}/api-keys?reveal=true",
        headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}"},
        timeout=30,
    )
    r.raise_for_status()
    for k in r.json():
        if k.get("name") == "service_role" or k.get("type") == "secret":
            return k["api_key"]
    raise RuntimeError("service_role key not found")


def ensure_admin(conn) -> None:
    key = service_key()
    base = os.environ["VITE_SUPABASE_URL"].rstrip("/")
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    cur = conn.cursor()
    cur.execute("select id from auth.users where lower(email) = %s", (OWNER_EMAIL,))
    row = cur.fetchone()
    password = None
    if row:
        uid = row[0]
    else:
        password = secrets.token_urlsafe(12)
        r = httpx.post(f"{base}/auth/v1/admin/users", headers=h, timeout=30, json={
            "email": OWNER_EMAIL, "password": password, "email_confirm": True,
            "phone": OWNER_PHONE, "phone_confirm": True,
        })
        r.raise_for_status()
        uid = r.json()["id"]
    cur.execute("insert into public.admins(user_id) values (%s) on conflict do nothing", (uid,))
    conn.commit()
    creds = BACKEND.parent / "memory" / "test_credentials.md"
    if password:
        creds.write_text(
            "# Test credentials\n"
            f"- Admin panel /admin (Supabase Auth): **{OWNER_EMAIL}** / **{password}**\n"
            f"- Phone sign-in for the same user: {OWNER_PHONE} (works only once an SMS provider is enabled in Supabase Auth)\n"
            "- Change the password in Supabase → Authentication → Users.\n"
        )
    print("admin user ready" + (" (new password written to memory/test_credentials.md)" if password else " (existing user kept)"))


if __name__ == "__main__":
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    migrate(conn)
    copy_menu(conn)
    ensure_admin(conn)
    print(json.dumps({"project": REF[:4] + "…", "done": True}))
