# Secret Spot — especificación técnica vigente

## Arquitectura desplegada

La web pública y el panel de administración se construyen desde `frontend/` con React, TypeScript y Vite, y se publican en Cloudflare Pages.

**Supabase** es la fuente de datos y autenticación:
- El frontend usa `@supabase/supabase-js` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Las tablas están protegidas mediante RLS.
- Las operaciones públicas de reserva y contacto usan RPCs SQL.
- El panel usa Supabase Auth y la función `is_admin` para verificar permisos.
- Las notificaciones de correo se envían mediante la Edge Function `notify`.

**Cloudflare Worker** en `cloudflare-api/` es la API de pedidos:
- `GET /api/health`
- `GET /api/menu` (endpoint disponible en el Worker)
- `GET /api/orders/config`
- `POST /api/orders`

El Worker usa el secreto `SUPABASE_SECRET_KEY` del entorno de Cloudflare. Nunca debe trasladarse al frontend, a variables `VITE_*` ni al repositorio.

## Flujos funcionales

### Web pública
- Página principal multidioma (español por defecto e inglés).
- Carta obtenida desde Supabase, con disponibilidad, categorías, etiquetas y alérgenos.
- Formulario de reservas, enviado mediante RPC `create_booking`.
- Formulario de contacto, enviado mediante RPC `create_message`.
- Horarios y configuración pública mediante RPC `public_schedule_config`.
- Pedidos para recoger, con pago en el establecimiento.

### Panel /admin
- Autenticación con Supabase Auth (email/contraseña y flujo telefónico OTP si está habilitado en Supabase).
- La función `is_admin` determina si la cuenta autenticada pertenece al conjunto de administradores.
- Gestión de reservas, mensajes, carta, pedidos y configuración de horarios.
- Las consultas y escrituras del panel se hacen con Supabase y quedan sujetas a RLS y RPCs.

### Pedidos para recoger
- El frontend consulta `GET /api/orders/config` para conocer si se aceptan pedidos y qué horas de recogida están disponibles.
- El frontend envía `POST /api/orders` al Worker.
- El Worker valida nombre, teléfono, email, notas, productos, cantidades y hora elegida.
- Los precios se consultan en Supabase en el servidor; no se confía en precios ni totales enviados por el navegador.
- La RPC `create_pickup_order` vuelve a validar y crea el pedido y sus líneas en una única transacción.
- Los pedidos son para recoger y se pagan en el establecimiento.
- La notificación de pedido se solicita a la Edge Function `notify`.

## Datos y seguridad

- Identificador del restaurante configurado en el Worker y en las consultas del frontend.
- La clave pública Supabase puede estar en el bundle del frontend, siempre con RLS correctamente configurado.
- La clave secreta/service-role Supabase solo debe existir como secreto del Worker o en entornos administrativos seguros.
- No registrar datos personales de clientes ni respuestas sensibles de Supabase en logs.
- Cualquier cambio en tablas, RPCs o permisos debe revisarse junto con sus migraciones y políticas RLS.

## Horarios y configuración

Los horarios de negocio, reservas y pedidos se administran desde el panel. La configuración pública se obtiene con `public_schedule_config`; la configuración administrativa se consulta y actualiza mediante `admin_get_schedule_settings` y `admin_update_schedule_settings`.

## Repositorio y componentes

- `frontend/`: aplicación web y panel.
- `cloudflare-api/`: Worker de pedidos, pruebas y SQL de la RPC.
- `supabase/`: esquema, migraciones y Edge Function `notify`.
- `.github/workflows/deploy-notify.yml`: despliegue automatizado de la función.
- `tests/`: pruebas end-to-end.
- `backend/`: backend FastAPI/MongoDB de la plantilla anterior. No es backend de producción; se conserva únicamente por compatibilidad con el proxy local histórico de Vite. No debe ampliarse como arquitectura de producción.
- `plan/`, `design_guidelines.json`: documentación y referencias.

## Desarrollo y despliegue

### Frontend
Desde `frontend/`:
```bash
yarn install
yarn typecheck
yarn lint
yarn test
yarn build
```

Cloudflare Pages usa `frontend/` como directorio de proyecto, `yarn build` como build command y `dist` como directorio de salida.

Variables públicas de Pages:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` (origen del Worker, sin `/api`)

### Worker
Desde `cloudflare-api/`:
```bash
uv run pywrangler deploy
python -m pytest tests -q
```

Variables del Worker:
- `SUPABASE_URL`
- `RESTAURANT_ID`

Secreto del Worker:
- `SUPABASE_SECRET_KEY`

### Backend heredado
El proxy de desarrollo de Vite apunta a `http://localhost:8001`. El directorio `backend/` contiene el servidor FastAPI/MongoDB histórico. No es utilizado por Cloudflare Pages ni por el Worker desplegado. No eliminarlo hasta retirar o sustituir expresamente ese proxy y cualquier flujo local que aún dependa de él.

## Pendiente de verificación

- Confirmar que los valores de entorno de Cloudflare Pages (incluido `VITE_API_BASE_URL`) coinciden con el Worker actualmente desplegado.
- Confirmar que las políticas RLS de las tablas y RPCs siguen cubriendo todos los permisos de administración y escritura pública.
- Tras modificar código, ejecutar las comprobaciones de frontend y las pruebas del Worker antes de desplegar.
