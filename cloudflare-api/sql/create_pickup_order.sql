-- Secret Spot · atomic pickup order creation.
-- Run once in the Supabase SQL Editor (safe to re-run).
-- Called only by the Worker with SUPABASE_SECRET_KEY (service_role).

-- Guarantees order_number uniqueness per restaurant (fails if duplicates already exist).
create unique index if not exists orders_restaurant_order_number_uidx
  on public.orders (restaurant_id, order_number);

create or replace function public.create_pickup_order(
  p_restaurant_id   uuid,
  p_customer_name   text,
  p_customer_phone  text,
  p_notes           text,
  p_pickup_time     text,
  p_items           jsonb,
  p_expected_total  numeric
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_cfg        jsonb;
  v_now_local  timestamp := now() at time zone 'Europe/Madrid';
  v_pickup_at  timestamptz;
  v_lines      int;
  v_distinct   int;
  v_found      int;
  v_available  int;
  v_subtotal   numeric(10,2);
  v_order_id   uuid;
  v_number     text;
  v_attempt    int := 0;
begin
  -- 1. Input shape (the Worker validates too; this is the last line of defence)
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'empty_order';
  end if;
  if jsonb_array_length(p_items) > 30
     or coalesce(length(trim(p_customer_name)), 0) not between 2 and 80
     or coalesce(length(trim(p_customer_phone)), 0) not between 6 and 20
     or coalesce(length(p_notes), 0) > 500
     or coalesce(length(p_pickup_time), 0) not between 4 and 40
     or exists (
       select 1 from jsonb_array_elements(p_items) e
       where jsonb_typeof(e->'quantity') <> 'number'
          or (e->>'quantity')::numeric <> trunc((e->>'quantity')::numeric)
          or (e->>'quantity')::numeric not between 1 and 20
          or coalesce(e->>'menu_item_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     ) then
    raise exception using errcode = 'P0001', message = 'invalid_order';
  end if;

  select count(*), count(distinct (e->>'menu_item_id')::uuid)
    into v_lines, v_distinct
    from jsonb_array_elements(p_items) e;
  if v_lines <> v_distinct then
    raise exception using errcode = 'P0001', message = 'duplicate_item';
  end if;

  -- 2. Orders enabled + slot currently offered (same rules as GET /api/orders/config)
  select to_jsonb(c) into v_cfg from public.order_config(p_restaurant_id) c limit 1;
  if coalesce((v_cfg->>'accepting')::boolean, false) is not true then
    raise exception using errcode = 'P0001', message = 'orders_closed';
  end if;
  if not exists (
    select 1 from jsonb_array_elements_text(coalesce(v_cfg->'pickup_slots', '[]'::jsonb)) s
    where s = p_pickup_time
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  if p_pickup_time ~ '^\d{2}:\d{2}$' then
    v_pickup_at := (v_now_local::date + p_pickup_time::time) at time zone 'Europe/Madrid';
    -- after-midnight slots (00:00-01:00) belong to the next calendar day
    if v_pickup_at < now() - interval '5 minutes' then
      v_pickup_at := v_pickup_at + interval '1 day';
    end if;
  else
    v_pickup_at := p_pickup_time::timestamptz;
  end if;

  -- 3. Products: this restaurant only, locked so price/availability can't change mid-transaction
  perform 1 from public.menu_items m
   where m.restaurant_id = p_restaurant_id
     and m.id in (select (e->>'menu_item_id')::uuid from jsonb_array_elements(p_items) e)
   for share;

  select count(m.id), count(m.id) filter (where m.available),
         coalesce(sum(round(m.price * (e->>'quantity')::int, 2)), 0)
    into v_found, v_available, v_subtotal
    from jsonb_array_elements(p_items) e
    left join public.menu_items m
      on m.id = (e->>'menu_item_id')::uuid and m.restaurant_id = p_restaurant_id;

  if v_found <> v_lines then
    raise exception using errcode = 'P0001', message = 'product_not_found';
  end if;
  if v_available <> v_lines then
    raise exception using errcode = 'P0001', message = 'product_unavailable';
  end if;
  if p_expected_total is not null and round(p_expected_total, 2) <> v_subtotal then
    raise exception using errcode = 'P0001', message = 'price_changed';
  end if;

  -- 4. Unique order number, e.g. SS-260131-4F2A9
  loop
    v_attempt := v_attempt + 1;
    v_number := 'SS-' || to_char(v_now_local, 'YYMMDD') || '-'
             || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (
      select 1 from public.orders where restaurant_id = p_restaurant_id and order_number = v_number
    );
    if v_attempt >= 5 then
      raise exception using errcode = 'P0001', message = 'order_number_collision';
    end if;
  end loop;

  -- 5. Order + lines in the same transaction: any failure rolls back both
  insert into public.orders (
    restaurant_id, order_number, customer_name, customer_phone, notes,
    pickup_at, pickup_time, subtotal, total, currency, fulfillment, payment, status
  ) values (
    p_restaurant_id, v_number, trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_notes), ''),
    v_pickup_at, p_pickup_time, v_subtotal, v_subtotal, 'EUR', 'pickup', 'pay_at_pickup', 'pending'
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, menu_item_id, name, unit_price, quantity, line_total)
  select v_order_id, m.id::text, m.name, m.price, (e->>'quantity')::int,
         round(m.price * (e->>'quantity')::int, 2)
    from jsonb_array_elements(p_items) e
    join public.menu_items m
      on m.id = (e->>'menu_item_id')::uuid and m.restaurant_id = p_restaurant_id;

  return jsonb_build_object(
    'order_number', v_number,
    'status', 'pending',
    'pickup_time', p_pickup_time,
    'total', v_subtotal,
    'currency', 'EUR'
  );
end;
$$;

-- Only the backend (service_role) may call it; never anon/authenticated browsers.
revoke all on function public.create_pickup_order(uuid, text, text, text, text, jsonb, numeric)
  from public, anon, authenticated;
grant execute on function public.create_pickup_order(uuid, text, text, text, text, jsonb, numeric)
  to service_role;
