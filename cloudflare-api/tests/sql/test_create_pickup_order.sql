-- Assertions for create_pickup_order against fake_schema.sql (fictitious data only).
\set ON_ERROR_STOP on
create function _expect_error(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql;
  exception when others then
    if sqlerrm like '%' || msg || '%' then return; end if;
    raise exception 'expected % but got: %', msg, sqlerrm;
  end;
  raise exception 'expected error % but call succeeded', msg;
end $$;

create function _call(items text, slot text default '20:15', total numeric default null) returns text
language sql as $$
  select format($f$select create_pickup_order('00000000-0000-4000-8000-000000000001',
    'Cliente Ficticio', '+34600000000', 'nota', %L, %L::jsonb, %L)$f$, slot, items, total) $$;

-- 1. happy path: prices from DB, both tables written
do $$ declare r jsonb; begin
  r := create_pickup_order('00000000-0000-4000-8000-000000000001', 'Cliente Ficticio', '+34600000000', null, '20:15',
        '[{"menu_item_id":"11111111-1111-4111-8111-111111111111","quantity":2},
          {"menu_item_id":"22222222-2222-4222-8222-222222222222","quantity":1}]', 29.00);
  assert r->>'status' = 'pending' and (r->>'total')::numeric = 29.00 and r->>'pickup_time' = '20:15', r::text;
  assert r->>'order_number' ~ '^SS-\d{6}-[0-9A-F]{5}$', r::text;
  assert (select count(*) from orders) = 1;
  assert (select count(*) from order_items) = 2;
  assert (select fulfillment||'/'||payment from orders) = 'pickup/pay_at_pickup';
  assert (select sum(line_total) from order_items) = 29.00;
  raise notice 'OK happy path %', r;
end $$;

-- 2. business rule rejections
select _expect_error(_call('[{"menu_item_id":"33333333-3333-4333-8333-333333333333","quantity":1}]'), 'product_unavailable');
select _expect_error(_call('[{"menu_item_id":"44444444-4444-4444-8444-444444444444","quantity":1}]'), 'product_not_found');
select _expect_error(_call('[{"menu_item_id":"55555555-5555-4555-8555-555555555555","quantity":1}]'), 'product_not_found');
select _expect_error(_call('[]'), 'empty_order');
select _expect_error(_call('[{"menu_item_id":"11111111-1111-4111-8111-111111111111","quantity":0}]'), 'invalid_order');
select _expect_error(_call('[{"menu_item_id":"11111111-1111-4111-8111-111111111111","quantity":1.5}]'), 'invalid_order');
select _expect_error(_call('[{"menu_item_id":"11111111-1111-4111-8111-111111111111","quantity":1},
                              {"menu_item_id":"11111111-1111-4111-8111-111111111111","quantity":1}]'), 'duplicate_item');
select _expect_error(_call('[{"menu_item_id":"11111111-1111-4111-8111-111111111111","quantity":1}]', '03:00'), 'slot_unavailable');
select _expect_error(_call('[{"menu_item_id":"11111111-1111-4111-8111-111111111111","quantity":1}]', '20:15', 0.01), 'price_changed');
update _cfg set accepting = false;
select _expect_error(_call('[{"menu_item_id":"11111111-1111-4111-8111-111111111111","quantity":1}]'), 'orders_closed');
update _cfg set accepting = true;

-- 3. failure while saving a line -> no orphan order
select _expect_error(_call('[{"menu_item_id":"22222222-2222-4222-8222-222222222222","quantity":1},
                              {"menu_item_id":"11111111-1111-4111-8111-111111111111","quantity":13}]'), 'simulated order_items failure');
do $$ begin
  assert (select count(*) from orders) = 1, 'orphan order left behind';
  assert (select count(*) from order_items) = 2, 'orphan lines left behind';
  raise notice 'OK rollback: still 1 order / 2 lines after failed save';
end $$;

-- 4. after-midnight slot lands on a future timestamp
do $$ declare r jsonb; begin
  r := create_pickup_order('00000000-0000-4000-8000-000000000001', 'Cliente Ficticio', '+34600000000', null, '00:30',
        '[{"menu_item_id":"22222222-2222-4222-8222-222222222222","quantity":1}]', null);
  assert (select pickup_at from orders where order_number = r->>'order_number') > now() - interval '5 minutes';
  raise notice 'OK 00:30 slot';
end $$;

-- 5. browsers can't call it
do $$ begin
  assert not has_function_privilege('anon', 'create_pickup_order(uuid,text,text,text,text,jsonb,numeric)', 'execute');
  assert not has_function_privilege('authenticated', 'create_pickup_order(uuid,text,text,text,text,jsonb,numeric)', 'execute');
  assert has_function_privilege('service_role', 'create_pickup_order(uuid,text,text,text,text,jsonb,numeric)', 'execute');
  raise notice 'OK grants';
end $$;

-- 6. order_config returning a table row instead of jsonb also works
drop function order_config(uuid);
create function order_config(p_restaurant_id uuid)
  returns table(accepting boolean, pickup_slots text[], prep_minutes int) language sql as $$
  select accepting, array(select jsonb_array_elements_text(slots)), 20 from _cfg $$;
do $$ declare r jsonb; begin
  r := create_pickup_order('00000000-0000-4000-8000-000000000001', 'Cliente Ficticio', '+34600000000', null, '20:00',
        '[{"menu_item_id":"22222222-2222-4222-8222-222222222222","quantity":3}]', 12.00);
  assert (r->>'total')::numeric = 12.00;
  raise notice 'OK table-returning order_config';
end $$;
\echo ALL SQL CHECKS PASSED
