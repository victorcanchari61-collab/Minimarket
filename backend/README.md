# MiniMarket · API (Go + Gin + PostgreSQL)

API REST de la suite MiniMarket. Responde en `http://localhost:8080`.

## Correr

```bash
cp .env.example .env        # una sola vez; ajusta DATABASE_URL si hace falta
go run ./cmd/api            # aplica las migraciones y arranca la API
go test ./...               # usa la base minimarket_test (la crea si falta)
```

Requiere Go 1.27 y PostgreSQL (base `minimarket`).

## Rutas

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/login` | `{ email, password }` → `{ token, token_type, user }` (5 intentos por minuto) |
| GET | `/api/user` | usuario del token → `{ data }` |
| POST | `/api/logout` | revoca el token actual |
| GET | `/api/demo-credentials` | solo con `APP_ENV=local`: crea y devuelve el usuario de prueba |
| GET | `/up` · `/api/health` | vida del servicio · vida con base de datos |

Los errores siguen un solo formato: `{ message, code, errors?, context? }`. Validación → 422 con `errors` por campo; el frontend decide por `code`.

## Estructura

```
cmd/api/                 punto de entrada
internal/
  config/                variables de entorno
  database/              pool de PostgreSQL y migraciones (migrations/*.sql, embebidas)
  server/                enrutador y middleware global
  modules/<modulo>/      handler (HTTP) → service (reglas) → repository (SQL)
  shared/
    apperror/            errores de negocio con código estable
    httpx/               errores → JSON, validación de entrada, límite de intentos
    pagination/          listados: máximo 20 filas, cursor, sin COUNT(*)
```

Reglas: el handler solo traduce HTTP; el service tiene las reglas y devuelve `*apperror.Error`; solo el repository escribe SQL. Sin DTOs ni interfaces mientras no haya una segunda implementación.
