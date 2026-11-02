"""order settings and opening hours, editable by the owner

Revision ID: 0002_order_settings
Revises: 0001_create_orders
Create Date: 2026-11-02
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_order_settings"
down_revision = "0001_create_orders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "order_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("accepting_orders", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("prep_minutes", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("slot_step_min", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("last_pickup_before_close_min", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("days_ahead", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("max_per_slot", sa.Integer(), nullable=False, server_default="10"),
        sa.CheckConstraint("id = 1", name="order_settings_single_row"),
        sa.CheckConstraint("slot_step_min > 0", name="order_settings_step_positive"),
        sa.CheckConstraint("max_per_slot > 0", name="order_settings_max_positive"),
        sa.CheckConstraint("days_ahead > 0", name="order_settings_days_positive"),
    )

    op.create_table(
        "opening_hours",
        sa.Column("weekday", sa.Integer(), primary_key=True),  # 0 = lunes ... 6 = domingo
        sa.Column("open_from_min", sa.Integer(), nullable=True),  # minutos desde medianoche
        sa.Column("close_len_min", sa.Integer(), nullable=True),  # duración del servicio; NULL = cerrado
        sa.CheckConstraint("weekday BETWEEN 0 AND 6", name="opening_hours_weekday_range"),
        sa.CheckConstraint("open_from_min BETWEEN 0 AND 1439", name="opening_hours_open_range"),
    )

    # Fila única de ajustes con los valores por defecto
    op.execute("INSERT INTO order_settings (id) VALUES (1)")

    # Horario actual: copia estos valores de lib/hours.py
    # 13:00 = 780 minutos. Un día cerrado va con NULL, NULL.
    op.execute(
        """
        INSERT INTO opening_hours (weekday, open_from_min, close_len_min) VALUES
        (0, NULL, NULL),   -- lunes: cerrado
        (1, NULL, NULL),   -- martes: cerrado
        (2, NULL, NULL),   -- miércoles: cerrado
        (3, 1140, 300),    -- jueves: 19:00 a 00:00
        (4, 1140, 360),    -- viernes: 19:00 a 01:00
        (5, 1140, 360),    -- sábado: 19:00 a 01:00
        (6, 1140, 360)     -- domingo: 19:00 a 01:00
        """
    )

    # Igual que orders: los datos no se pueden leer ni escribir con la clave pública
    op.execute("ALTER TABLE order_settings ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE opening_hours ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("opening_hours")
    op.drop_table("order_settings")
