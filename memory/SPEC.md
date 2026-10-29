# ARCHITECTURE (current): static React site → Supabase directly (see /app/supabase/README.md)
- Frontend talks ONLY to Supabase via frontend/src/lib/data.ts (supabase-js, VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
- Tables: menu_items, bookings, messages, orders, order_items, admins (RLS; only users in public.admins read/write private data).
- Public writes via RPC: create_booking, create_message, create_order (prices from menu_items, hours/pickup slots in SQL), order_config.
- Owner login: Supabase Auth email+password (phone OTP once an SMS provider is enabled). PIN login removed.
- Emails: Supabase Edge Function `notify` (Resend, user's own key) — invoked by the site after each write; dedup flags in DB.
- Hosting: Cloudflare Pages (frontend/, yarn build, dist, public/_redirects). The FastAPI/Mongo backend below is LEGACY and unused by the site.
- Schema source of truth: backend/alembic/versions/0002_full_supabase.sql; paste-ready supabase/setup.sql (schema + 26-item menu).

# Secret Spot — restaurant website (Puçol beach)
Public single-page site (ES default / EN toggle, persisted in localStorage `ss_lang`) + PIN-protected admin at /admin.

## Public (/)
Hero (Hacer una reserva / Nuestro menú), Story, Services (9: terraza, vistas al mar, servicio en barra, mascotas, zona infantil, accesible, para llevar, bodas, eventos privados), Payment options, Menu (tabs burgers/alitas/poke/sides/sweets; only available items),
Booking form, Contact form (≤500 chars), hours with live Open/Closed badge (Europe/Madrid), footer with legal notice dialog, mobile action bar.

## Allergens
menu_items.allergens is a string of numbers "1, 3, 10" (1–14). Shown as icon chips per dish + legend under the menu (frontend/src/components/site/Allergens.tsx).
Numbering (owner's list; #10 assumed Lácteos because the list repeated Mostaza): 1 Gluten, 2 Crustáceos, 3 Huevos, 4 Pescado, 5 Cacahuete, 6 Soja, 7 Frutos secos, 8 Apio, 9 Mostaza, 10 Lácteos, 11 Sésamo, 12 Sulfitos, 13 Moluscos, 14 Altramuces.

## Pickup orders (DEMO MODE until Supabase is connected) — see /app/supabase/README.md
- "Pedir ahora" buttons (header, hero, menu section, mobile bar) open a Sheet: Carta → Carrito → Datos → Resumen → Confirmación.
- Pickup only, pay at pickup. Ordering only while open; pickup slots every 15 min from now+20 min to close-15 min (backend/lib/orders.py).
- Cart stores ids+qty only (localStorage ss_cart_v1); prices from the live menu, computed in cents (features/orders/cart.ts).
  Server recomputes totals from Mongo menu prices with Decimal; client prices are ignored.
- GET /api/orders/config → {mode: demo|supabase, accepting, reason: closed|last_orders|null, pickup_slots, prep_minutes}
- POST /api/orders {customer_name, customer_phone, notes, pickup_time, items[{menu_item_id, quantity}]} → 201 {order, persisted, mode}
  400 detail codes: closed, last_orders, invalid_pickup_time, item_unavailable, quantity_too_high; 503 store_unavailable.
- Store: DemoOrderStore (persisted=false, nothing saved) unless DATABASE_URL (Supabase transaction pooler) is set → SupabaseOrderStore
  (SQLAlchemy async, tables orders/order_items via Alembic, RLS on) + owner email on each real order.
- Visibility: buttons ALWAYS shown (owner request), also on the published site; demo banners + "PRUEBA · NO GUARDADO" confirmation remain.
- Testing while closed: pin the clock in pytest (tests/test_orders_api.py) or mock /api/orders/config in the browser.

## Opening hours (backend/lib/hours.py mirrors frontend/src/lib/hours.ts)
Thu 19:00–00:00, Fri–Sun 19:00–01:00, Mon–Wed closed. Booking slots every 30 min, last 30 min before close (Thu ≤23:30, Fri–Sun ≤00:30).
Server rejects: closed_day, invalid_time, date_in_past, time_in_past, date_too_far (>90 days) → 400 {detail: code}.

## API (/api)
- GET /hours → {today, is_open, now_time, weekday(Mon=0)}
- GET /menu (available only) · POST /bookings (201, status=pending, code SS-XXXXXX) · POST /messages (201)
- POST /admin/login {pin} → sets cookie · POST /admin/logout · GET /admin/me
- Protected: GET /admin/stats · GET /admin/bookings?status= · PATCH /admin/bookings/{id} {status}
  GET /admin/messages · PATCH /admin/messages/{id} {read} · DELETE /admin/messages/{id}
  GET/POST /admin/menu · PATCH/DELETE /admin/menu/{id}

## Data (Mongo, string uuid `id`)
menu_items{name, category, description_es/en, price, price_note, tags[vegan|spicy|star|new], allergens, available, sort_order}
bookings{name, phone, email, date, time, party_size, note, code, status pending|confirmed|cancelled|completed, created_at}
messages{name, email, phone, subject, message, read, created_at}

## Seed
`cd backend && python seed.py` (26 real menu items from the old site; `--reset` reloads). Bookings/messages start empty.
## Email notifications (backend/lib/email.py, Emergent-managed Resend, sent as background tasks; failures only logged)
- New booking → owner (OWNER_EMAIL) + guest "received" email
- New contact message → owner
- Admin changes booking status to confirmed/cancelled → guest email (only when the status actually changes; completed sends nothing)
- Guest emails use booking.lang (es|en, sent by the frontend from the site language). Reply-To = EMAIL_REPLY_TO.
- Env: EMERGENT_EMAIL_KEY, EMAIL_FROM_NAME="Secret Spot", EMAIL_REPLY_TO, OWNER_EMAIL, PUBLIC_SITE_URL
- Testing: use delivered@resend.dev as guest email; owner alerts go to the real inbox.

Not in scope: online ordering/payment, SMS/WhatsApp, capacity checks.

## Cloudflare Worker API (user's repo, branch pedidos-backend)
- `cloudflare-api/src/main.py` (FastAPI on Python Workers): GET /api/menu, GET /api/orders/config, POST /api/orders (pickup only, pay_at_pickup, status pending).
- POST /api/orders validates input, checks order_config (accepting + pickup_slots), loads menu_items by server RESTAURANT_ID, computes prices server-side, then calls RPC `create_pickup_order` (cloudflare-api/sql/create_pickup_order.sql) which re-validates and inserts order + lines in one transaction. RPC executable only by service_role.
- Tests: `cloudflare-api/tests/test_orders.py` (mocked Supabase) and `cloudflare-api/tests/sql/run.sh` (throwaway local Postgres with fake schema).
- Frontend order config now comes from GET /api/orders/config (lib/api.ts; optional public VITE_API_BASE_URL = Worker origin on Cloudflare Pages). No direct supabase.rpc("order_config").
- Order submission is TEST MODE only (ORDERS_LIVE=false in features/orders/orderService.ts): built locally, persisted=false, no network.
