-- Fictitious stand-in for the real Supabase schema. ONLY for a throwaway local Postgres.
create role anon nologin; create role authenticated nologin; create role service_role nologin;

create table menu_items (id uuid primary key, restaurant_id uuid not null, name text not null,
                         price numeric(10,2) not null, available boolean not null default true);
create table orders (id uuid primary key default gen_random_uuid(), restaurant_id uuid not null,
  order_number text not null, customer_name text not null, customer_phone text not null, notes text,
  pickup_at timestamptz not null, pickup_time text not null, subtotal numeric(10,2) not null,
  total numeric(10,2) not null, currency text not null, fulfillment text not null, payment text not null,
  status text not null, created_at timestamptz not null default now());
create table order_items (id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade, menu_item_id text not null,
  name text not null, unit_price numeric(10,2) not null, quantity int not null,
  line_total numeric(10,2) not null, created_at timestamptz not null default now());

-- test knob replacing restaurant_order_settings
create table _cfg (accepting boolean, slots jsonb);
insert into _cfg values (true, '["20:00","20:15","00:30"]');

create function order_config(p_restaurant_id uuid) returns jsonb language sql as $$
  select jsonb_build_object('accepting', accepting, 'pickup_slots', slots, 'prep_minutes', 20) from _cfg $$;

insert into menu_items values
 ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000001', 'Burger Test', 12.50, true),
 ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-000000000001', 'Patatas Test', 4.00, true),
 ('33333333-3333-4333-8333-333333333333', '00000000-0000-4000-8000-000000000001', 'Agotado Test', 9.00, false),
 ('44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000099', 'Ajeno', 1.00, true);

-- simulates a failure while saving lines
create function _boom() returns trigger language plpgsql as $$
begin if new.quantity = 13 then raise exception 'simulated order_items failure'; end if; return new; end $$;
create trigger order_items_boom before insert on order_items for each row execute function _boom();
