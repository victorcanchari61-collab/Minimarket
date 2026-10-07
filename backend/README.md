# MiniMarket · API (Go + Gin + PostgreSQL)

API REST de la suite MiniMarket. Responde en `http://localhost:8080` (y en `http://minimarket.test/api` a través de Apache).

La arquitectura y las reglas están en [`../docs/arquitectura-backend.md`](../docs/arquitectura-backend.md).

## Correr

```bash
cp .env.example .env        # una sola vez; ajusta DATABASE_URL si hace falta
go run ./cmd/api            # aplica las migraciones y arranca la API
go run ./cmd/seed           # (solo local) crea el usuario de prueba y 160 productos de ejemplo
go test ./...               # usa la base minimarket_test (la crea si falta)
```

Requiere Go 1.27 y PostgreSQL (base `minimarket`). En Windows, `iniciar-api.bat` arranca la API en segundo plano.

## Rutas

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/login` | `{ email, password }` → `{ token, token_type, user }` (5 intentos por minuto) |
| GET | `/api/user` | usuario del token |
| POST | `/api/logout` | revoca el token actual |
| GET | `/api/demo-credentials` | solo con `APP_ENV=local`: crea y devuelve el usuario de prueba |
| GET | `/api/catalog/products` | 20 productos por petición con cursor; filtros `search`, `sku`, `name`, `category_id`, `status`, `price_from`, `price_to`; orden `sort` (`sku`, `name`, `price`, `status`) y `direction` |
| POST · GET · PUT · DELETE | `/api/catalog/products[/:id]` | crear, ver, editar y eliminar (marca `deleted_at`) |
| GET | `/api/catalog/products/summary` | activos, inactivos y categorías en uso |
| GET | `/api/catalog/categories` · `/api/catalog/units` | listas para los formularios |
| GET · POST | `/api/users` | usuarios: 20 por petición con cursor (`search`, `role_id`, `status`, `sort`, `direction`) · alta con roles |
| GET · PUT · DELETE | `/api/users/:id` | ver, editar (datos, estado y roles) y eliminar |
| PUT | `/api/users/:id/password` | reiniciar contraseña (cierra las sesiones del usuario) |
| GET | `/api/users/summary` · `/api/users/roles` | activos e inactivos · roles para el formulario |
| GET | `/api/company/branches` | sucursales activas (cualquier usuario con sesión; alimenta el selector de sucursal) |
| GET | `/api/permissions/me` | acciones que puede hacer el usuario (arma el menú) |
| GET | `/api/permissions/catalog` | árbol completo de permisos (sistema → módulo → submódulo → acciones) |
| GET | `/up` · `/api/health` | vida del servicio · vida con base de datos |

Todas las rutas, salvo el login, las credenciales de prueba y los chequeos de salud, exigen `Authorization: Bearer <token>` y, además, el permiso de su acción (403 `FORBIDDEN` si falta). Los errores siguen un solo formato: `{ message, code, errors?, context? }`.

## Estructura

```
cmd/api · cmd/seed        puntos de entrada
internal/
  apperror/ pagination/ web/     errores con código · listados de 20 con cursor · piezas HTTP comunes
  platform/{config,database}/    entorno · pool de PostgreSQL, transacciones y migraciones
  auth/                          login por token
  permission/                    catálogo de permisos, regla de acceso y guardia por ruta
  erp/catalog/products/          un submódulo = un paquete: http.go service.go store.go list_query.go types.go errors.go wire.go
  config/users/list/             Configuraciones › Usuarios › Lista de usuarios
  config/company/branches/        Configuraciones › Empresa y sucursales › Sucursales
  erp/catalog/units/             otro submódulo (Unidades y presentaciones)
  server/                        enrutador (compone los submódulos)
  testutil/                      pruebas con PostgreSQL real
```
