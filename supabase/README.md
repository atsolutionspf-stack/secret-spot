# Pedidos para recoger → Supabase

Estado actual: **MODO PRUEBA**. Los pedidos se calculan y validan en el servidor, pero **no se guardan en ningún sitio**
y **no llegan al restaurante**. En la web publicada el botón «Pedir ahora» está oculto hasta conectar Supabase;
en la vista previa se muestra para poder probarlo, con avisos de «Modo prueba».

## Qué hay que hacer para recibir pedidos reales

1. **Crear un proyecto en Supabase** (https://supabase.com/dashboard → New project). Guarda la contraseña de la base de datos.
2. **Copiar la cadena de conexión «Transaction Pooler»**: en tu proyecto, botón **Connect** → pestaña **Transaction pooler**.
   Tiene esta forma (puerto **6543**, host `pooler.supabase.com`):
   `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
   ⚠️ No sirve la «Direct connection» (`db.[ref].supabase.co:5432`): falla desde el servidor.
3. **Dársela al asistente** (se guarda de forma segura como `DATABASE_URL` en `backend/.env`; nunca la pegues en el chat).
4. **Crear las tablas**: `cd backend && alembic upgrade head`
   (alternativa manual: pegar `supabase/schema.sql` en el *SQL Editor* de Supabase).
5. **Reiniciar el backend**. A partir de ahí `GET /api/orders/config` devuelve `"mode": "supabase"`:
   - el botón «Pedir ahora» aparece también en la web publicada,
   - la confirmación dice «¡Pedido recibido!» en lugar de «pedido de prueba»,
   - el dueño recibe un email con cada pedido (OWNER_EMAIL).
6. **Volver a publicar** la web para que la versión pública use la conexión.

## Pendiente recomendado (no incluido todavía)

- **Ver y gestionar pedidos en el panel /admin** (lista del día, cambiar estado: preparando → listo → recogido / cancelado).
  Mientras tanto, se pueden ver en Supabase → *Table editor* → `orders` / `order_items`, y llegan por email.
- **Aviso al cliente** (SMS o email) cuando el pedido esté listo: ahora solo se pide nombre y teléfono.
- **Pausar pedidos** desde el panel en noches de mucho trabajo, o limitar pedidos por franja de 15 min.
- Pago online (ahora el pago es en el local, al recoger).

## Estructura (para desarrolladores)

| Pieza | Archivo |
|---|---|
| Contrato API (Pydantic) | `backend/models/orders.py` ↔ `frontend/src/features/orders/types.ts` |
| Reglas: franjas de recogida, precios desde la carta (Decimal), nº de pedido | `backend/lib/orders.py` |
| Almacén intercambiable: `DemoOrderStore` (no guarda) / `SupabaseOrderStore` | `backend/lib/order_store.py` |
| Conexión Supabase (SQLAlchemy async + asyncpg, pooler) | `backend/lib/supabase_db.py` |
| Tablas `orders` + `order_items` (RLS activado, sin acceso público) | `backend/models/sql_orders.py`, `backend/alembic/versions/0001_create_orders.py`, `supabase/schema.sql` |
| Endpoints | `GET /api/orders/config`, `POST /api/orders` (`backend/routers/orders.py`) |
| Lógica del carrito (pura, en céntimos) | `frontend/src/features/orders/cart.ts` (+ `cart.test.ts`) |
| Llamadas a la API / visibilidad del botón | `frontend/src/features/orders/orderService.ts` |
| Estado del carrito (localStorage) | `frontend/src/features/orders/CartProvider.tsx` |
| Interfaz (diseño) | `frontend/src/features/orders/components/*` |

El navegador **nunca** habla con Supabase ni envía precios: solo ids y cantidades. El servidor vuelve a calcular
todo con la carta real, comprueba que el local está abierto y que la hora de recogida es válida.

Datos guardados por pedido: número, nombre y teléfono del cliente, observaciones, fecha/hora de recogida,
productos (id, nombre y precio en el momento del pedido, cantidad, total de línea), subtotal, total, moneda,
`fulfillment = 'pickup'` (forzado en la base de datos), `payment = 'pay_at_pickup'`, estado y fecha de creación.

Pruebas: `cd backend && python -m pytest tests/test_order_logic.py tests/test_orders_api.py -n 0` ·
`cd frontend && yarn test`
