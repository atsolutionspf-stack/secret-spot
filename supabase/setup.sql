-- =====================================================================
-- Secret Spot - Supabase setup: paste ALL of this into Supabase > SQL Editor > Run.
-- Safe to run more than once. Requires the orders/order_items tables from schema.sql (already created).
-- =====================================================================

-- Secret Spot: full Supabase backend (menu, bookings, messages, admin, pickup orders).
-- Applied by alembic/versions/0002_full_supabase.py. Business rules mirror backend/lib/hours.py + lib/orders.py.

create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(name) between 1 and 80),
  category text not null check (category in ('burgers','alitas','poke','sides','sweets')),
  description_es text not null default '' check (char_length(description_es) <= 300),
  description_en text not null default '' check (char_length(description_en) <= 300),
  price numeric(10,2) not null check (price >= 0 and price <= 1000),
  price_note text not null default '' check (char_length(price_note) <= 20),
  tags text[] not null default '{}' check (tags <@ array['vegan','spicy','star','new']::text[]),
  allergens text not null default '' check (char_length(allergens) <= 40),
  available boolean not null default true,
  sort_order int not null default 0
);
create index if not exists menu_items_available_sort on public.menu_items(available, sort_order);

create table if not exists public.bookings (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  name text not null,
  phone text not null,
  email text not null,
  date date not null,
  time text not null,
  party_size int not null check (party_size between 1 and 30),
  note text not null default '',
  lang text not null default 'es' check (lang in ('es','en')),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  owner_notified boolean not null default false,
  guest_notified_status text,
  created_at timestamptz not null default now()
);
create index if not exists bookings_status_date on public.bookings(status, date, time);
create index if not exists bookings_date_time on public.bookings(date, time);

create table if not exists public.messages (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text not null,
  phone text not null default '',
  subject text not null,
  message text not null check (char_length(message) <= 500),
  read boolean not null default false,
  owner_notified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_created on public.messages(created_at desc);

alter table public.orders add column if not exists owner_notified boolean not null default false;

-- ---------- Admin check + RLS ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

alter table public.admins enable row level security;
alter table public.menu_items enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select to authenticated using (user_id = auth.uid());

drop policy if exists menu_read on public.menu_items;
create policy menu_read on public.menu_items for select to anon, authenticated using (available or public.is_admin());
drop policy if exists menu_admin on public.menu_items;
create policy menu_admin on public.menu_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists bookings_admin on public.bookings;
create policy bookings_admin on public.bookings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists messages_admin on public.messages;
create policy messages_admin on public.messages for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists orders_admin on public.orders;
create policy orders_admin on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists order_items_admin on public.order_items;
create policy order_items_admin on public.order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.menu_items to anon;
grant select, insert, update, delete on public.menu_items, public.bookings, public.messages, public.orders, public.order_items to authenticated;
grant select on public.admins to authenticated;

-- ---------- Opening hours (Europe/Madrid) ----------
-- weekday Mon=0..Sun=6 → minutes of service from 19:00 (Thu 19-00, Fri-Sun 19-01, Mon-Wed closed)
create or replace function public._service_len(wd int) returns int
language sql immutable as $$ select case wd when 3 then 300 when 4 then 360 when 5 then 360 when 6 then 360 end $$;

create or replace function public._madrid_now() returns timestamp
language sql stable as $$ select (now() at time zone 'Europe/Madrid') $$;

create or replace function public._booking_error(d date, t text) returns text
language plpgsql stable as $$
declare
  n timestamp := public._madrid_now();
  len int := public._service_len(extract(isodow from d)::int - 1);
  mins int;
begin
  if d < n::date then return 'date_in_past'; end if;
  if d > n::date + 90 then return 'date_too_far'; end if;
  if len is null then return 'closed_day'; end if;
  if t !~ '^\d{2}:\d{2}$' then return 'invalid_time'; end if;
  mins := split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int;
  if mins < 720 then mins := mins + 1440; end if;  -- after-midnight slots belong to the same service
  if mins < 1140 or mins > 1140 + len - 30 or (mins - 1140) % 30 <> 0 then return 'invalid_time'; end if;
  if d = n::date and mins <= extract(hour from n)::int * 60 + extract(minute from n)::int then return 'time_in_past'; end if;
  return null;
end $$;

-- Pickup slots for the service open right now: now+20 min (rounded up to 15) .. close-15 min.
create or replace function public._pickup_slots(out slots timestamp[], out reason text)
language plpgsql stable as $$
declare
  n timestamp := public._madrid_now();
  wd int := extract(isodow from n)::int - 1;
  mins int := extract(hour from n)::int * 60 + extract(minute from n)::int;
  start_at timestamp; close_at timestamp; earliest timestamp;
begin
  if public._service_len(wd) is not null and mins >= 1140 then
    start_at := date_trunc('day', n) + interval '1140 minutes';
    close_at := start_at + make_interval(mins => public._service_len(wd));
  elsif public._service_len((wd + 6) % 7) is not null then
    start_at := date_trunc('day', n) - interval '1 day' + interval '1140 minutes';
    close_at := start_at + make_interval(mins => public._service_len((wd + 6) % 7));
    if n >= close_at then close_at := null; end if;
  end if;
  if close_at is null then slots := '{}'; reason := 'closed'; return; end if;
  earliest := n + interval '20 minutes';
  if earliest <> date_trunc('minute', earliest) then earliest := date_trunc('minute', earliest) + interval '1 minute'; end if;
  earliest := earliest + make_interval(mins => (15 - extract(minute from earliest)::int % 15) % 15);
  select coalesce(array_agg(s order by s), '{}') into slots
    from generate_series(earliest, close_at - interval '15 minutes', interval '15 minutes') s;
  reason := case when cardinality(slots) = 0 then 'last_orders' end;
end $$;

-- ---------- Public RPCs (the only way anon can write) ----------
create or replace function public.order_config() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare r record;
begin
  select * into r from public._pickup_slots();
  return jsonb_build_object(
    'mode', 'supabase',
    'accepting', cardinality(r.slots) > 0,
    'reason', r.reason,
    'pickup_slots', coalesce((select jsonb_agg(to_char(s, 'HH24:MI') order by s) from unnest(r.slots) s), '[]'::jsonb),
    'prep_minutes', 20);
end $$;

create or replace function public.create_booking(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare err text; b public.bookings;
begin
  if char_length(trim(coalesce(p->>'name',''))) not between 2 and 80
     or char_length(trim(coalesce(p->>'phone',''))) not between 6 and 25
     or coalesce(p->>'email','') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p->>'email') > 254
     or coalesce((p->>'party_size')::int, 0) not between 1 and 30
     or char_length(coalesce(p->>'note','')) > 500
     or coalesce(p->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  err := public._booking_error((p->>'date')::date, p->>'time');
  if err is not null then raise exception '%', err using errcode = 'P0001'; end if;
  insert into public.bookings(code, name, phone, email, date, time, party_size, note, lang)
  values ('SS-' || upper(encode(gen_random_bytes(3), 'hex')), trim(p->>'name'), trim(p->>'phone'), trim(p->>'email'),
          (p->>'date')::date, p->>'time', (p->>'party_size')::int, coalesce(p->>'note',''),
          case when p->>'lang' = 'en' then 'en' else 'es' end)
  returning * into b;
  return to_jsonb(b) - 'owner_notified' - 'guest_notified_status';
end $$;

create or replace function public.create_message(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare m public.messages;
begin
  if char_length(trim(coalesce(p->>'name',''))) not between 2 and 80
     or coalesce(p->>'email','') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p->>'email') > 254
     or char_length(coalesce(p->>'phone','')) > 25
     or char_length(trim(coalesce(p->>'subject',''))) not between 2 and 120
     or char_length(trim(coalesce(p->>'message',''))) not between 2 and 500 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  insert into public.messages(name, email, phone, subject, message)
  values (trim(p->>'name'), trim(p->>'email'), coalesce(p->>'phone',''), trim(p->>'subject'), trim(p->>'message'))
  returning * into m;
  return jsonb_build_object('id', m.id, 'created_at', m.created_at);
end $$;

create or replace function public.create_order(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  r record; slot timestamp; oid text := gen_random_uuid()::text; onum text;
  n_lines int; n_found int; sub numeric(10,2); o public.orders;
begin
  if char_length(trim(coalesce(p->>'customer_name',''))) not between 2 and 80
     or char_length(trim(coalesce(p->>'customer_phone',''))) not between 6 and 25
     or char_length(coalesce(p->>'notes','')) > 500
     or jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') not between 1 and 40 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p->'items') e
             where coalesce((e->>'quantity')::int, 0) not between 1 and 50) then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  select * into r from public._pickup_slots();
  if cardinality(r.slots) = 0 then raise exception '%', r.reason using errcode = 'P0001'; end if;
  select s into slot from unnest(r.slots) s where to_char(s, 'HH24:MI') = p->>'pickup_time';
  if slot is null then raise exception 'invalid_pickup_time' using errcode = 'P0001'; end if;

  create temp table _lines on commit drop as
    select e->>'menu_item_id' as menu_item_id, sum((e->>'quantity')::int) as quantity, min(i) as position
    from jsonb_array_elements(p->'items') with ordinality as t(e, i) group by 1;
  if exists (select 1 from _lines where quantity > 50) then raise exception 'quantity_too_high' using errcode = 'P0001'; end if;
  select count(*) into n_lines from _lines;
  select count(*) into n_found from _lines l join public.menu_items m on m.id = l.menu_item_id and m.available;
  if n_found <> n_lines then raise exception 'item_unavailable' using errcode = 'P0001'; end if;

  select sum(m.price * l.quantity) into sub from _lines l join public.menu_items m on m.id = l.menu_item_id;
  onum := 'P-' || to_char(public._madrid_now(), 'YYMMDD') || '-' || upper(encode(gen_random_bytes(2), 'hex'));

  insert into public.orders(id, order_number, customer_name, customer_phone, notes, pickup_at, subtotal, total,
                            currency, fulfillment, payment, status, created_at)
  values (oid, onum, trim(p->>'customer_name'), trim(p->>'customer_phone'), trim(coalesce(p->>'notes','')),
          slot at time zone 'Europe/Madrid', sub, sub, 'EUR', 'pickup', 'pay_at_pickup', 'pending', now())
  returning * into o;
  insert into public.order_items(id, order_id, menu_item_id, name, unit_price, quantity, line_total, position)
    select gen_random_uuid()::text, oid, m.id, m.name, m.price, l.quantity, m.price * l.quantity, l.position
    from _lines l join public.menu_items m on m.id = l.menu_item_id;

  return jsonb_build_object(
    'persisted', true, 'mode', 'supabase',
    'order', jsonb_build_object(
      'id', o.id, 'order_number', o.order_number, 'customer_name', o.customer_name, 'customer_phone', o.customer_phone,
      'notes', o.notes, 'pickup_at', o.pickup_at, 'pickup_time', to_char(slot, 'HH24:MI'),
      'subtotal', o.subtotal, 'total', o.total, 'currency', o.currency, 'fulfillment', o.fulfillment,
      'payment', o.payment, 'status', o.status, 'created_at', o.created_at,
      'items', (select jsonb_agg(jsonb_build_object('menu_item_id', menu_item_id, 'name', name, 'unit_price', unit_price,
                                                   'quantity', quantity, 'line_total', line_total) order by position)
                from public.order_items where order_id = oid)));
end $$;

revoke all on function public.create_booking(jsonb), public.create_message(jsonb), public.create_order(jsonb), public.order_config() from public;
grant execute on function public.create_booking(jsonb), public.create_message(jsonb), public.create_order(jsonb), public.order_config(), public.is_admin() to anon, authenticated;

-- ---------- Current menu (26 items, prices as on the website) ----------
insert into public.menu_items (id, name, category, description_es, description_en, price, price_note, tags, allergens, available, sort_order) values
  ('2f09981e-c471-4529-b2cd-9e7701c47e61', 'Cheese Bacon', 'burgers', '180g de carne, bacon, queso cheddar y salsa especial. Con patatas.', '180g beef patty, bacon, cheddar cheese and special sauce. Served with fries.', 9.5, '', '{}'::text[], '1, 3, 7, 10, 12', true, 0),
  ('f267ba32-0989-4897-a1c6-2bf2f0cd70c0', 'Perfecta', 'burgers', '180g de carne, tomate, lechuga, cebolla morada y salsa especial. Con patatas.', '180g beef patty, tomato, lettuce, red onion and special sauce. Served with fries.', 10.0, '', '{}'::text[], '1, 3, 7, 10, 12', true, 1),
  ('68d6e5de-2662-40d4-b35c-be91a955798a', 'La de Pollo', 'burgers', 'Pollo kentucky, cheddar, bacon, salsas bbq y especial, lechuga, cebolla y pepinillos. Con patatas.', 'Kentucky-style fried chicken, cheddar, bacon, BBQ and special sauces, lettuce, onion and pickles. Served with fries.', 10.0, '', '{}'::text[], '1, 3, 7, 10, 12', true, 2),
  ('c3e9ba80-c18c-4669-bbde-d66bbed1708b', 'Big Secret', 'burgers', 'Doble carne 360g, doble cheddar, bacon, salsa wings y toque de bbq. Con patatas.', 'Double 360g beef, double cheddar, bacon, wings sauce and a touch of BBQ. Served with fries.', 14.5, '', array['star']::text[], '1, 3, 7, 10, 12', true, 3),
  ('2d34fa9b-9639-40bd-9657-790ac044d42a', 'Trufembert', 'burgers', '180g de carne, cebolla crunchy y caramelizada, mayonesa trufada y crema de camembert. Con patatas.', '180g beef, crunchy and caramelised onion, truffle mayo and camembert cream. Served with fries.', 11.5, '', '{}'::text[], '1, 3, 7, 10, 12', true, 4),
  ('f4176b9e-376d-4858-b48a-c4f158866288', 'Smoky', 'burgers', '180g de carne, cebolla morada, queso ahumado, bacon ahumado y salsa de chipotles ahumados. Con patatas.', '180g beef, red onion, smoked cheese, smoked bacon and smoked chipotle sauce. Served with fries.', 11.5, '', array['spicy']::text[], '1, 3, 7, 10, 12', true, 5),
  ('41be0c20-d91c-4646-a790-d245a4cfe3f0', 'Rib Curl', 'burgers', '180g de carne, costilla de cerdo desmenuzada, salsa bbq, cheddar, pepinillos, cebolla morada y salsa especial. Con patatas.', '180g beef, pulled pork rib, BBQ sauce, cheddar, pickles, red onion and special sauce. Served with fries.', 13.5, '', '{}'::text[], '1, 3, 7, 10, 12', true, 6),
  ('51e888ea-45b2-47e2-8486-403a9e429369', 'Green Wave', 'burgers', '180g de burger vegana de soja y vegetales, rúcula, tomate seco, cebolla morada y salsa de sésamo. Con patatas.', '180g vegan soy & vegetable patty, rocket, sun-dried tomato, red onion and sesame sauce. Served with fries.', 13.0, '', array['vegan']::text[], '1, 3, 7, 10, 12', true, 7),
  ('defb6853-6e31-4332-a266-49b9c96df820', 'Clásicas', 'alitas', 'Alitas de pollo crujientes, receta de la casa.', 'Crispy chicken wings, house recipe.', 8.0, '', '{}'::text[], '1, 7', true, 8),
  ('62c452a8-9146-4b43-9ee9-35c5ae9a8b38', 'Parmesano', 'alitas', 'Alitas crujientes con parmesano.', 'Crispy wings with parmesan.', 9.0, '', '{}'::text[], '1, 7', true, 9),
  ('1dd7504c-620d-4d58-91d0-a31dd1a708ca', 'BBQ', 'alitas', 'Alitas glaseadas en salsa barbacoa.', 'Wings glazed in barbecue sauce.', 9.0, '', '{}'::text[], '1, 7', true, 10),
  ('4f93b3c4-2477-4ccf-ba16-be699d0249ff', 'Búfalo', 'alitas', 'Alitas con salsa búfalo picantita.', 'Wings tossed in tangy buffalo sauce.', 9.0, '', array['spicy']::text[], '1, 7', true, 11),
  ('37d625f0-b178-40a4-aff9-02e0e805bb63', 'Xtrahot', 'alitas', 'Para valientes: nuestra salsa más picante.', 'For the brave: our hottest sauce.', 9.0, '', array['spicy']::text[], '1, 7, 12', true, 12),
  ('5b39f403-b06e-41a8-8750-4368653579ed', 'Wing Lover', 'alitas', 'Ración grande para los fans de las alitas.', 'A big share for true wing lovers.', 13.5, '', array['star']::text[], '1, 7, 12', true, 13),
  ('03616106-f6e9-4a24-a284-1f0b8a95828e', 'Salmón Bowl', 'poke', 'Bowl de arroz con salmón fresco y toppings.', 'Rice bowl with fresh salmon and toppings.', 11.0, '', '{}'::text[], '3, 4, 6, 11, 12', true, 14),
  ('026c2ce0-9fa2-4ccf-b0da-2fdaebdecfed', 'Tuna Bowl', 'poke', 'Bowl de arroz con atún y toppings.', 'Rice bowl with tuna and toppings.', 11.0, '', '{}'::text[], '3, 4, 6, 11, 12', true, 15),
  ('a084e1ac-d320-46da-929b-1eee9fd2825e', 'Chicken Bowl', 'poke', 'Bowl de arroz con pollo y toppings.', 'Rice bowl with chicken and toppings.', 9.5, '', '{}'::text[], '3, 4, 6, 11, 12', true, 16),
  ('bfde1a03-8c5c-4081-b7a2-d66a1394f642', 'Spicy Mix Bowl', 'poke', 'Mezcla de salmón y atún con salsa picante.', 'Salmon and tuna mix with spicy sauce.', 11.5, '', array['spicy']::text[], '3, 4, 6, 11, 12', true, 17),
  ('e1482094-46bc-450b-8aec-2fff4a577cd4', 'Nuggets', 'sides', 'Nuggets de pollo crujientes.', 'Crispy chicken nuggets.', 6.5, '', '{}'::text[], '', true, 18),
  ('7fa2ea16-faf4-4f07-a8ea-2fc80b3031f9', 'Super Combo', 'sides', 'Combo para compartir de nuestros entrantes.', 'Sharing combo of our favourite sides.', 11.0, '', array['star']::text[], '', true, 19),
  ('868d4ff9-6a57-4706-b3f9-e94331b6f67d', 'Croquetas', 'sides', 'Croquetas caseras (precio por unidad).', 'Homemade croquettes (price per piece).', 1.5, 'ud.', '{}'::text[], '1, 7, 9, 10, 12', true, 20),
  ('c787ba49-5d51-463f-ad16-5035f88bf0dc', 'Super Nachos', 'sides', 'Nachos cargados para compartir.', 'Loaded nachos to share.', 10.0, '', '{}'::text[], '', true, 21),
  ('9e6e5214-9ef8-47bc-a7dd-0f93ac4135c4', 'Patatas Fritas Secret', 'sides', 'Nuestras patatas con el toque secreto.', 'Our fries with the secret touch.', 6.0, '', '{}'::text[], '', true, 22),
  ('75ea9e5a-56c3-48e7-b82a-813724808d2c', 'Tequeños', 'sides', 'Palitos de masa rellenos de queso.', 'Cheese-filled pastry sticks.', 8.0, '', '{}'::text[], '1, 7, 9, 10, 12', true, 23),
  ('ca234cb8-0157-4337-8dcf-2a79bb4e77b0', 'Cheesecake Lotus u Oreo', 'sweets', 'Tarta de queso cremosa, elige Lotus u Oreo.', 'Creamy cheesecake, choose Lotus or Oreo.', 4.5, '', array['star']::text[], '', true, 24),
  ('fad23274-768a-4fa9-8ca8-d64f89a11216', 'Tarta del Día o Brownie', 'sweets', 'Pregunta por la tarta del día o pide nuestro brownie.', 'Ask for the cake of the day or go for our brownie.', 4.5, '', '{}'::text[], '1, 3, 7', true, 25)
on conflict (id) do nothing;

-- ---------- Migration bookkeeping (so future Alembic migrations continue from here) ----------
create table if not exists public.alembic_version (version_num varchar(32) primary key);
alter table public.alembic_version enable row level security;
delete from public.alembic_version;
insert into public.alembic_version values ('0002_full_supabase');

-- ---------- Owner access to /admin ----------
-- 1) Supabase > Authentication > Users > "Add user": email Josepmartinadani80@gmail.com + a password
--    (tick "Auto Confirm User"). Optional: add the phone +34613528535 to the same user for SMS sign-in.
-- 2) Then run this line again (or re-run the whole script):
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'josepmartinadani80@gmail.com'
on conflict do nothing;
