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
