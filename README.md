# Secret Spot — web y API

Repositorio de la web pública y del panel de administración de Secret Spot (Puçol).

## Arquitectura en producción

La aplicación está separada en tres servicios:

- **Cloudflare Pages** publica el frontend React/Vite. Directorio de proyecto: `frontend/`; comando de build: `yarn build`; salida: `dist/`.
- **Supabase** es la base de datos y la capa de autenticación. El navegador usa el cliente Supabase con la clave pública *anon/publishable* y las políticas RLS. Las operaciones privilegiadas deben quedar protegidas por RLS o ejecutarse mediante funciones SQL/servicios de confianza.
- **Cloudflare Worker** (`cloudflare-api/`) es la API privada de pedidos. Consulta Supabase desde el servidor usando el secreto `SUPABASE_SECRET_KEY`, que se configura como secreto del Worker y nunca debe guardarse en Git.

### Flujos principales

- Carta, reservas, mensajes, autenticación del panel, administración de carta, reservas, pedidos y ajustes: cliente Supabase desde `frontend/src/lib/data.ts`, sujeto a RLS y RPCs.
- Notificaciones de correo: Supabase Edge Function `notify`, invocada desde el frontend tras las operaciones correspondientes.
- Pedidos para recoger: frontend → Cloudflare Worker → Supabase. El Worker valida datos, disponibilidad y precios; la RPC `create_pickup_order` realiza la escritura atómica.
- Configuración y disponibilidad de pedidos: frontend → `GET /api/orders/config` del Worker.

## Estructura del repositorio

| Ruta | Función |
|---|---|
| `frontend/` | Web pública, panel /admin, componentes, estilos y cliente Supabase |
| `cloudflare-api/` | API de pedidos desplegada como Cloudflare Python Worker |
| `supabase/` | SQL, migraciones y Edge Functions |
| `.github/workflows/` | Automatización para desplegar la función `notify` |
| `tests/` | Pruebas end-to-end del frontend |
| `backend/` | Backend FastAPI/MongoDB heredado para el entorno local antiguo; no forma parte del despliegue de producción |
| `design_guidelines.json`, `plan/`, `memory/` | Referencias y documentación del proyecto |

## Configuración

### Cloudflare Pages

Configura en el proyecto de Pages, para producción y previews cuando corresponda:

- `VITE_SUPABASE_URL`: URL del proyecto Supabase.
- `VITE_SUPABASE_ANON_KEY`: clave pública anon/publishable de Supabase.
- `VITE_API_BASE_URL`: URL pública del Worker `secret-spot-api`, sin añadir `/api`.

No configures la clave service-role/secret de Supabase en Pages ni en variables `VITE_*`: esas variables se incorporan al bundle del navegador.

### Cloudflare Worker

El proyecto Worker se encuentra en `cloudflare-api/`.

- Configuración: `cloudflare-api/wrangler.jsonc`.
- Entrada: `cloudflare-api/src/main.py`.
- Dependencia de ejecución: FastAPI.
- Secreto requerido: `SUPABASE_SECRET_KEY`, añadido como Worker secret desde Wrangler o el panel de Cloudflare.
- Variables no secretas: `SUPABASE_URL` y `RESTAURANT_ID`, configuradas en `wrangler.jsonc`.

Desde `cloudflare-api/`, el despliegue configurado es:

```bash
uv run pywrangler deploy
```

No incluyas secretos reales, tokens, archivos `.env` ni credenciales en commits.

### Supabase

- SQL inicial y estructura: `supabase/schema.sql` y `supabase/setup.sql`.
- Cambios incrementales: `supabase/migrations/`.
- Función de notificaciones: `supabase/functions/notify/`.
- La RPC de creación atómica de pedidos también está documentada en `cloudflare-api/sql/create_pickup_order.sql`.

Al aplicar cambios de base de datos, revisa las migraciones y las políticas RLS; no ejecutes scripts de inicialización sobre una base de datos con datos reales sin revisar antes su efecto.

## Desarrollo local

El frontend se inicia desde `frontend/`:

```bash
yarn install
yarn dev
```

El build y las comprobaciones disponibles:

```bash
yarn typecheck
yarn lint
yarn test
yarn build
```

El `vite.config.ts` conserva un proxy local de `/api` a `http://localhost:8001` para el backend FastAPI heredado. Ese backend y MongoDB no son la arquitectura de producción. Para probar pedidos localmente, asegúrate de que el endpoint local está alineado con el contrato actual del Worker; el despliegue real utiliza exclusivamente `cloudflare-api/`.

Para probar el Worker fuera de Cloudflare, instala las dependencias declaradas en `cloudflare-api/pyproject.toml` y ejecuta sus pruebas:

```bash
cd cloudflare-api
python -m pytest tests -q
```

Las pruebas del Worker usan datos ficticios y mocks; no crean pedidos reales.

## Criterios de mantenimiento

- No borrar ni renombrar `frontend/`, `cloudflare-api/` o `supabase/` sin revisar antes sus despliegues.
- No subir secretos. Los valores `VITE_*` son públicos por diseño.
- Mantener sincronizados los contratos de frontend, Worker y RPC SQL.
- Conservar las pruebas y migraciones: no son residuos de build.
- El backend `backend/` es legado. Se mantiene temporalmente para no romper el proxy y el entorno de desarrollo existentes; su retirada requiere migrar primero ese flujo local.
