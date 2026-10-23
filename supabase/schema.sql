BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001_create_orders

CREATE TABLE orders (
    id VARCHAR(36) NOT NULL,
    order_number VARCHAR(20) NOT NULL,
    customer_name VARCHAR(80) NOT NULL,
    customer_phone VARCHAR(25) NOT NULL,
    notes TEXT DEFAULT '' NOT NULL,
    pickup_at TIMESTAMP WITH TIME ZONE NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR' NOT NULL,
    fulfillment VARCHAR(10) DEFAULT 'pickup' NOT NULL,
    payment VARCHAR(20) DEFAULT 'pay_at_pickup' NOT NULL,
    status VARCHAR(12) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT orders_status_check CHECK (status IN ('pending', 'preparing', 'ready', 'collected', 'cancelled')),
    CONSTRAINT orders_pickup_only CHECK (fulfillment = 'pickup'),
    CONSTRAINT orders_amounts_non_negative CHECK (total >= 0 AND subtotal >= 0),
    UNIQUE (order_number)
);

CREATE INDEX ix_orders_pickup_at ON orders (pickup_at);

CREATE INDEX ix_orders_status ON orders (status);

CREATE INDEX ix_orders_created_at ON orders (created_at);

CREATE TABLE order_items (
    id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36) NOT NULL,
    menu_item_id VARCHAR(64) NOT NULL,
    name VARCHAR(80) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    line_total NUMERIC(10, 2) NOT NULL,
    position INTEGER DEFAULT '0' NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
    FOREIGN KEY(order_id) REFERENCES orders (id) ON DELETE CASCADE
);

CREATE INDEX ix_order_items_order_id ON order_items (order_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

INSERT INTO alembic_version (version_num) VALUES ('0001_create_orders') RETURNING alembic_version.version_num;

COMMIT;
