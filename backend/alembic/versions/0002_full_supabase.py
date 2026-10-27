"""full Supabase backend: menu, bookings, messages, admins, RLS, public RPCs

Revision ID: 0002_full_supabase
Revises: 0001_create_orders
Create Date: 2026-10-27
"""

from pathlib import Path

from alembic import op

revision = "0002_full_supabase"
down_revision = "0001_create_orders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Raw DBAPI cursor: the SQL contains ':MI' and '%' that SQLAlchemy/psycopg2 param parsing would mangle.
    sql = (Path(__file__).with_name("0002_full_supabase.sql")).read_text()
    op.get_bind().connection.cursor().execute(sql)


def downgrade() -> None:
    op.execute(
        """
        drop function if exists public.create_order(jsonb), public.create_booking(jsonb), public.create_message(jsonb),
          public.order_config(), public._pickup_slots(), public._booking_error(date, text), public._madrid_now(),
          public._service_len(int);
        alter table public.orders drop column if exists owner_notified;
        drop table if exists public.messages, public.bookings, public.menu_items, public.admins;
        drop function if exists public.is_admin();
        """
    )
