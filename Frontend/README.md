# MiniMarket · Frontend (React + Vite)

SPA de la suite MiniMarket: React 19, TypeScript, Tailwind CSS 4 y React Router. Habla con la API en Go (`../backend`).

## Correr

```bash
pnpm install
pnpm dev        # http://localhost:5173 — Vite reenvía /api a http://localhost:8080
pnpm build      # tsc -b + vite build → dist/
pnpm lint       # oxlint
```

La API debe estar corriendo (`go run ./cmd/api` en `../backend`). Para apuntar a otra API, define `VITE_API_URL` (por defecto, mismo origen). Para ver otro tema en el login: `/login?sistema=wms`.

## Estructura (`src/`)

```
pages/        login, sistemas, sistema (módulos y submódulos), not-found
layouts/      auth (panel de sistemas + formulario) y system (sidebar + barra de usuario)
features/     pantallas por sistema/módulo (erp/catalog/products…); screens.ts las enlaza a su ruta
components/
  ui/         primitivas: Button, Input, Modal, Badge, Toast, Tabs, StatCard…
  data/       compuestos: DataTable (20 filas por página, Anterior / Siguiente, pide solo las columnas visibles), Dropdown, DateRangePicker, selectores
  system/     sidebar y utilidades de icono por sistema
hooks/        use-paged-list (tablas), use-cursor-list y use-infinite-scroll (selectores en modal), use-confirm, use-toast…
lib/          api (token Bearer), systems y navigation (datos de sistemas), format, utils
```

Rutas: `/login` · `/sistemas` · `/sistemas/:sistema/:módulo?/:submódulo?`. Sin sesión, todo redirige al login.

## Servido por Laragon (http://minimarket.test)

El host `minimarket.test` (Apache) sirve `Frontend/dist` y reenvía `/api` a la API en Go:

1. `pnpm build` en esta carpeta (genera `dist/`).
2. La API corriendo: `backend/iniciar-api.bat` (o `go run ./cmd/api`).
3. El host está en `C:/laragon/etc/apache2/sites-enabled/00-minimarket.test.conf` (usa `mod_proxy`, ya activado). Si cambias el host, reinicia el servicio de Windows `Apache2.4`.

Cada vez que cambies el frontend, vuelve a ejecutar `pnpm build`; para trabajar con recarga en caliente usa `pnpm dev` (http://localhost:5173).
