# Secret Spot on Supabase + Cloudflare Pages

The website now talks **only to Supabase** (no Emergent server needed): menu, bookings, contact messages,
pickup orders and the owner panel. Prices, opening hours and pickup times are checked **inside Supabase**
(SQL functions), so nobody can change a price from the browser. Customer data is protected by RLS:
only the owner account can read it.

## 1. Create the tables (5 minutes, once)
1. Supabase → **SQL Editor** → New query.
2. Paste the whole content of **`supabase/setup.sql`** → **Run**. It's safe to run again.
   It creates `menu_items`, `bookings`, `messages`, `admins`, the security rules and functions,
   and loads the current 26-dish menu. (Your existing `orders` / `order_items` tables are kept.)

## 2. Create the owner login
1. Supabase → **Authentication → Users → Add user** → email `Josepmartinadani80@gmail.com`, a password,
   tick **Auto Confirm User**. Optional: add phone `+34613528535` to the same user.
2. Run the last line of `setup.sql` again (the `insert into public.admins …`) so that user can open `/admin`.
3. Phone sign-in: Authentication → **Sign In / Providers → Phone** → enable and connect an SMS provider
   (Twilio, MessageBird, Vonage…). Until then only email + password works.

## 3. Emails (Resend)
1. Resend → **Domains** → add and verify your domain (without it, Resend only delivers to your own Resend account email).
2. Supabase → **Edge Functions** → Deploy a new function → *Via Editor* → name **`notify`** →
   paste `supabase/functions/notify/index.ts` → Deploy.
3. Edge Functions → **Secrets** → add:
   - `RESEND_API_KEY` = your Resend key
   - `OWNER_EMAIL` = `Josepmartinadani80@gmail.com`
   - `EMAIL_FROM` = `Secret Spot <reservas@your-domain>` (must be on the verified domain)
   - `SITE_URL` = your Cloudflare site address (e.g. `https://secretspot.pages.dev`)
   Emails sent: owner on each booking / message / order; guest on booking received, confirmed or cancelled.

## 4. Cloudflare Pages
- Root directory `frontend` · Build command `yarn build` · Output directory `dist`.
- Settings → **Environment variables** (Production and Preview):
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API). Then redeploy.
- `frontend/public/_redirects` makes `/admin` work on Pages. No Pages Functions are needed.

## Where things live
| What | File |
|---|---|
| Tables, RLS, SQL functions (source of truth) | `backend/alembic/versions/0002_full_supabase.sql` (+ `0001_create_orders.py`) |
| Paste-ready script (schema + menu) | `supabase/setup.sql` |
| Email function | `supabase/functions/notify/index.ts` |
| All data access in the site | `frontend/src/lib/data.ts`, client in `frontend/src/lib/supabase.ts` |
| Cart logic (pure, cents) | `frontend/src/features/orders/cart.ts` |

Public writes only go through `create_booking`, `create_message`, `create_order` (RPC); `order_config` returns pickup slots.
Error codes raised by those functions: `closed_day`, `invalid_time`, `date_in_past`, `time_in_past`, `date_too_far`,
`closed`, `last_orders`, `invalid_pickup_time`, `item_unavailable`, `quantity_too_high`, `invalid_input`.

With a Transaction Pooler connection string + Supabase access token, `cd backend && python scripts/supabase_setup.py`
does steps 1–2 automatically (Alembic migrations, menu copy, owner user).
