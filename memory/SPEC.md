# Secret Spot — restaurant website (Puçol beach)
Public single-page site (ES default / EN toggle, persisted in localStorage `ss_lang`) + PIN-protected admin at /admin.

## Public (/)
Hero (Hacer una reserva / Nuestro menú), Story, Services (12), Payment options, Menu (tabs burgers/alitas/poke/sides/sweets; only available items),
Booking form, Contact form (≤500 chars), hours with live Open/Closed badge (Europe/Madrid), footer with legal notice dialog, mobile action bar.

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
Not in scope: online ordering/payment, email/SMS notifications, capacity checks.
