# Arquitectura del backend

API REST de la suite MiniMarket en **Go 1.27 + Gin + PostgreSQL** (`pgx`), con rutas bajo `/api` (sin versión) y autenticación por **token Bearer**. Una sola base de datos compartida por todos los sistemas (POS, ERP, SCM, WMS, RR. HH., CRM, BI).

Este documento define **cómo se organiza el código y las reglas que no se negocian**. Está pensado para cómo trabaja Go (errores como valores, paquetes planos, dependencias explícitas), no como una traducción de otro framework.

---

## 1. Principios

| Principio | Cómo se aplica en Go |
|---|---|
| **S** (una sola responsabilidad) | Un archivo, una tarea: `http.go` habla HTTP, `service.go` aplica reglas, `store.go` escribe SQL, `*_query.go` arma un listado. |
| **O** (abierto/cerrado) | Lo que varía se modela con tipos y funciones, no con herencia (Go no la tiene): un enum con métodos (`ProductStatus.Label()`), o una tabla de funciones por variante. |
| **L** (sustitución) | Cualquier implementación de una interfaz cumple su contrato completo. Casi no hay interfaces; ver "Sin ceremonia". |
| **I** (interfaces pequeñas) | Servicios pequeños y cohesivos por funcionalidad; si un consumidor necesita una interfaz, la define él mismo con uno o dos métodos. |
| **D** (inversión de dependencias) | Las dependencias llegan **por constructor** (`NewService(store)`). No hay contenedor que las inyecte: `internal/server` las arma a mano (composición explícita). |

Reglas complementarias:

- **El handler solo traduce HTTP:** leer y validar la entrada, llamar al servicio, escribir la respuesta. Sin reglas de negocio.
- **Las reglas de negocio viven en el servicio**, y es el servicio quien abre la transacción.
- **Los errores son valores**: una función que falla *devuelve* un `error` y quien la llama lo revisa. No hay excepciones. Los errores de negocio llevan un código estable.
- **Un solo punto convierte errores en JSON** (middleware `web.Errors`); ningún handler escribe respuestas de error.
- **Los valores fijos son enums** (tipos con constantes y métodos), nunca cadenas o números sueltos.
- **Un paquete por submódulo del menú**, no por tipo ni por módulo. Un submódulo es una entidad con su propia pantalla y sus propias reglas (Productos, Unidades…): es lo que tiene **una sola razón para cambiar**. Nada de carpetas globales `controllers/`, `services/` o `models/` (en Go provocan ciclos de importación) ni de paquetes por módulo completo, que terminan en archivos de miles de líneas.
- **Sin ceremonia innecesaria:** no se crean DTOs entre capas ni interfaces "por si acaso". Las estructuras de entrada y salida de un handler existen porque Go no convierte JSON por arte de magia; no son una capa más.

---

## 2. Estructura de carpetas

```
backend/
├── cmd/
│   ├── api/main.go              arranca la API (config, base de datos, migraciones, apagado ordenado)
│   └── seed/main.go             datos de ejemplo, solo con APP_ENV=local
└── internal/
    ├── apperror/                errores de negocio con código estable (Code, HTTPStatus)
    ├── pagination/              listados: máximo 20 filas, cursor, sin COUNT(*)
    ├── web/                     piezas HTTP comunes: errores→JSON, validación, límite de intentos
    ├── platform/
    │   ├── config/              variables de entorno
    │   └── database/            pool de PostgreSQL, Executor, InTx, migraciones (migrations/*.sql)
    ├── auth/                    login por token, usuario actual, middleware de sesión
    ├── erp/                     sistema
    │   └── catalog/             módulo del menú ("Catálogo y maestros"): solo una carpeta que agrupa
    │       ├── products/        ← submódulo = un paquete (Productos)
    │       │   ├── http.go        handlers y rutas (único archivo que conoce a Gin)
    │       │   ├── service.go     reglas de negocio
    │       │   ├── store.go       SQL de escritura y consultas simples
    │       │   ├── list_query.go  el listado (20 filas, cursor)
    │       │   ├── types.go       estructuras y enums
    │       │   ├── errors.go      errores de negocio del submódulo
    │       │   └── wire.go        New(db): arma store → servicio → handler
    │       ├── units/           Unidades y presentaciones
    │       └── …                partners/, warehouses/, price_lists/ cuando se construyan
    ├── pos/ · scm/ · wms/ · hcm/ · crm/ · bi/   (cada sistema, con sus submódulos)
    ├── server/                  arma el enrutador y conecta los submódulos (composición)
    └── testutil/                utilidades de pruebas con PostgreSQL real
```

Organización: **sistema → módulo → submódulo**. El sistema y el módulo son solo carpetas que agrupan; cada **submódulo** del menú es **un paquete plano** de Go (`internal/erp/catalog/products`). Una entidad que todavía no tiene pantalla propia (las categorías de producto, hoy) vive dentro del submódulo que la usa, hasta que tenga la suya.

### Propiedad de los datos

- **Cada tabla tiene un solo submódulo dueño.** Solo el dueño la escribe.
- Un submódulo que necesita datos de otro llama al **servicio del dueño** (o reacciona a un evento); nunca **escribe** en tablas ajenas.
- Excepción de **solo lectura**: un listado puede hacer `JOIN` con un maestro para mostrar su nombre (la unidad o la categoría de un producto). Es lo que evita el N+1 y se hace únicamente en el `*_query.go` o en las consultas del `store`.
- Un submódulo **no importa a otro**; si hace falta, la dependencia se declara en `allowedCrossImports` (prueba de arquitectura) con su motivo.
- Nombres de tablas: maestros compartidos sin prefijo (`products`, `units`, `product_categories`); tablas propias de un sistema con prefijo (`pos_sales`, `wms_locations`, `hcm_employees`).

### Comunicación entre sistemas

| Caso | Mecanismo | Ejemplo |
|---|---|---|
| Debe ser consistente al instante | Llamada al **servicio del dueño**, en la misma transacción | POS confirma una venta → el servicio de inventario descuenta stock |
| Puede ocurrir después | **Evento** y reacción posterior (cola cuando haga falta) | Venta confirmada → CRM suma puntos; BI actualiza consolidados |

---

## 3. Qué hace cada archivo de un submódulo

| Archivo | Responsabilidad | No hace |
|---|---|---|
| `http.go` | Define las rutas, lee la entrada (`web.Bind`, `web.BindQuery`), llama al servicio y arma el JSON de respuesta. Contiene las estructuras de entrada (con `binding`) y de salida (con `json`). | Reglas de negocio ni SQL |
| `service.go` | Reglas de negocio, normalización, transacciones. Traduce los errores del store a errores de negocio. | Conocer HTTP (ni `gin` ni `net/http`) |
| `store.go` | Todo el SQL de escritura y las consultas simples. Traduce violaciones de restricciones de PostgreSQL a errores propios. | Reglas de negocio |
| `*_query.go` | Un listado: filtros, orden permitido, cursor y límite de 20. | Escribir datos |
| `types.go` | Estructuras de dominio y enums. | Lógica con efectos |
| `wire.go` | `New(db)`: arma store → servicio → handler. Es lo único que necesita quien monta el submódulo (`internal/server`). | Importar Gin |
| `errors.go` | Los errores de negocio del submódulo (código, mensaje, campo). | — |

Estas reglas se verifican **automáticamente** (sección 10).

### 3.1 Cuando un submódulo crece

- **Un archivo no pasa de 300 líneas.** Si `service.go` o `store.go` se acercan, se parten **por caso de uso**: `create_product.go`, `update_product.go`… cada uno con sus reglas y su SQL, sin crear carpetas nuevas.
- **Una entidad nueva con pantalla propia es un submódulo nuevo** (otro paquete), no más código dentro del existente.
- **El `store` solo tiene SQL de su submódulo.** Lo que necesita un comando de desarrollo (como `cmd/seed`) se consulta ahí mismo, sin agregar métodos al `store` que solo ese comando usa.

---

## 4. Flujo de una petición

```
Petición HTTP
   │
   ▼
http.go ─ web.Bind / web.BindQuery ── valida la forma ───────────► 422 si falla
   │
   ▼
service.go ─ normaliza, aplica reglas, abre la transacción
   │     ├─ store.go (escritura)   ─ SQL con pgx ─► PostgreSQL
   │     └─ *_query.go (lectura)   ─ SQL con pgx, 20 filas + cursor
   │
   │   si algo falla: devuelve un error (valor); el servicio lo traduce
   ▼
http.go ─ c.JSON(...)  ó  c.Error(err) ──► web.Errors lo convierte en JSON
```

---

## 5. Reglas para consultas y listados

Los listados son lo que más puede degradar el sistema (el kardex, las ventas o la asistencia tienen millones de filas). Estas reglas son **obligatorias**:

1. **Máximo 20 filas por petición.** Es una constante del servidor (`pagination.PageSize = 20`). El cliente nunca puede pedir más.
2. **Paginación por cursor (keyset), no por número de página.** Prohibido `OFFSET` y `?page=N` en tablas grandes: con cursor, la página 500 cuesta lo mismo que la 1.
3. **Orden determinista con desempate por `id`** (`ORDER BY columna, id`). Sin desempate el cursor puede repetir o saltar filas.
4. **Filtros obligatorios en tablas grandes.** El kardex exigirá *almacén + producto + rango de fechas* (máx. 92 días).
5. **Columnas explícitas**; nunca `SELECT *` en un listado.
6. **Sin N+1:** lo que se muestra de otra tabla viene en el mismo `JOIN`.
7. **Sin `COUNT(*)` en listados.** La respuesta dice si hay más (`next_cursor`); los totales se piden a un endpoint de resumen aparte (`/products/summary`).
8. **Búsqueda de texto con índice:** mínimo 2 caracteres; para códigos, prefijo; para nombres, índice `pg_trgm` y `unaccent` (así "cafe" encuentra "Café"). Los `%` y `_` que escribe el usuario se tratan como texto, no como comodines.
9. **Filtros y orden con lista blanca.** Solo se ordena por columnas declaradas en la consulta, cada una con su índice; cualquier otra se rechaza con 422.
10. **Un índice `(columna, id)` por cada orden permitido**, documentado en la migración.
11. **Salida mínima en listados:** solo lo que se muestra; el detalle va en `GET /:id`.
12. **Exportaciones fuera del listado:** un trabajo en segundo plano, nunca ampliando el límite de 20.

### 5.1 Contrato de respuesta de un listado

```
GET /api/catalog/products?sort=price&direction=desc&status=active
GET /api/catalog/products?sort=price&direction=desc&status=active&cursor=eyJvIjoicHJpY2U6REVTQyIs…
```

```json
{
  "data": [
    { "id": 12, "sku": "SKU-100091", "name": "Aceite vegetal 1 L", "category": "Abarrotes",
      "unit": "Botella", "price": "8.89", "status": "active", "status_label": "Activo" }
  ],
  "meta": { "per_page": 20, "next_cursor": "eyJvIjoi…", "prev_cursor": null }
}
```

- `next_cursor` nulo ⇒ no hay más filas.
- El cliente envía el cursor **tal cual** lo recibió. El cursor guarda el orden con el que se generó: si el cliente cambia de orden y reusa un cursor viejo, se rechaza (422).
- El precio viaja como **texto exacto** (`"8.89"`), nunca como número decimal.

### 5.2 Cómo se construye (ejemplo real: productos)

- `pagination.Limit()` devuelve 21: se piden 20 más una; la fila de sobra solo sirve para saber si hay otra página, sin `COUNT(*)`.
- La condición del cursor es una comparación de filas: `(p.price, p.id) < ($1::numeric, $2)`.
- `pagination.Build` recorta a 20 y arma el cursor de la última fila.
- Índices de la migración `0004`: `products_name_idx`, `products_sku_idx`, `products_price_idx`, `products_status_idx` (todos `(columna, id)`), más `products_name_search_idx` (GIN con `pg_trgm`).

---

## 6. Servicios y transacciones

Un servicio ejecuta **un caso de uso** (o un conjunto muy cohesivo). Reglas:

- Recibe valores simples o una estructura de entrada; **nunca** el contexto HTTP.
- Abre la **transacción** y bloquea lo necesario (`SELECT … FOR UPDATE`); un error devuelto revierte todo.
- Devuelve errores de negocio con código; no devuelve `false` ni mensajes sueltos.
- Recibe otros servicios por constructor.
- Los bloqueos de varias filas se toman siempre en el mismo orden (por id) para evitar interbloqueos.

`database.Executor` lo cumplen tanto el pool como una transacción, de modo que un store funciona igual dentro y fuera de ella:

```go
// service.go — ejemplo: traslado entre almacenes
func (s *Service) Transfer(ctx context.Context, in TransferInput, userID int64) error {
    return database.InTx(ctx, s.pool, func(tx pgx.Tx) error {
        store := NewStore(tx)               // el mismo store, ahora dentro de la transacción
        for _, line := range in.Lines {
            if err := store.Deduct(ctx, in.From, line.ProductID, line.Qty); err != nil {
                return err                  // p. ej. stock insuficiente → se revierte todo
            }
            if err := store.Add(ctx, in.To, line.ProductID, line.Qty); err != nil {
                return err
            }
        }
        return store.SaveTransfer(ctx, in, userID)
    })
}
```

---

## 7. Errores

Un error de negocio es un `*apperror.Error` con un **código estable**; el middleware `web.Errors` lo convierte en la respuesta. El frontend decide qué mostrar por el `code`, no por el texto.

| Situación | Estado | Cuerpo |
|---|---|---|
| Validación | 422 | `{ "message", "code": "VALIDATION_ERROR", "errors": { "campo": ["…"] } }` |
| Credenciales incorrectas | 422 | `{ …, "code": "INVALID_CREDENTIALS", "errors": { "email": ["…"] } }` |
| Sin sesión | 401 | `{ "message", "code": "UNAUTHENTICATED" }` |
| No existe | 404 | `{ "message", "code": "NOT_FOUND" }` |
| Conflicto (p. ej. SKU repetido) | 409 | `{ …, "code": "CONFLICT", "errors": { "sku": ["…"] } }` |
| Demasiados intentos | 429 | `{ …, "code": "TOO_MANY_REQUESTS", "context": { "retry_after": 42 } }` |
| Error inesperado | 500 | `{ "message": "Error interno.", "code": "INTERNAL_ERROR" }` (el detalle va al log, nunca al cliente) |

Cómo fluyen en Go:

- El **store** devuelve errores internos del paquete (`errDuplicateSKU`, `errNotFound`…), sin saber de HTTP ni de códigos.
- El **servicio** los traduce (`mapStoreError`) a errores de negocio con código y campo.
- El **handler** hace `c.Error(err)` y regresa; no escribe nada.

Para agregar un error nuevo: un código en `apperror` (si no existe) y una función en el `errors.go` del submódulo.

---

## 8. Enums

Todo conjunto cerrado de valores es un **tipo propio con constantes y métodos**, en el `types.go` de su submódulo:

```go
type ProductStatus string

const (
    StatusActive   ProductStatus = "active"
    StatusInactive ProductStatus = "inactive"
)

func (s ProductStatus) Valid() bool  { return s == StatusActive || s == StatusInactive }
func (s ProductStatus) Label() string { /* "Activo", "Inactivo" */ }
```

La base de datos refuerza lo mismo con un `CHECK`. Los enums pueden llevar comportamiento propio (`CanTransitionTo`, `Label`), lo que evita `if` dispersos. El frontend recibe el valor y su etiqueta (`status` + `status_label`).

---

## 9. Autenticación, permisos y sucursales

- **Hecho:** `POST /api/login` cambia credenciales por un token; solo se guarda su hash SHA-256. `GET /api/user` y `POST /api/logout` exigen el token (`auth.Required`). El login tiene límite de 5 intentos por minuto y no delata qué correos existen. `GET /api/demo-credentials` solo responde con `APP_ENV=local`.
- **Pendiente (Configuraciones):** roles y permisos con códigos como `inventory.kardex.view`, exigidos por ruta; las habilidades por sistema (`pos:use`, `erp:use`) para filtrar el menú; la **sucursal activa** en `X-Branch-Id` validada contra las sucursales del usuario; y auditoría de quién y cuándo en las escrituras.

---

## 10. Datos, dinero y pruebas

**Datos**
- **Nunca `float`.** Dinero y cantidades son `NUMERIC` en la base; en Go viajan como texto exacto hasta que haga falta calcular (entonces se decide el tipo decimal).
- Las fechas se guardan con zona horaria (`TIMESTAMPTZ`) y se muestran en `America/Lima`.
- Las operaciones que el POS puede reintentar (venta, cobro) llevarán una clave de idempotencia.
- Un registro eliminado se marca (`deleted_at`) en vez de borrarse: los documentos que lo usaron siguen siendo válidos y su SKU queda libre.
- **Migraciones:** archivos SQL numerados en `internal/platform/database/migrations/`, embebidos en el ejecutable y aplicados al arrancar, cada una en su transacción.

**Pruebas** (`go test ./...`)
| Qué | Cómo |
|---|---|
| Endpoints | Pruebas con `httptest` contra **PostgreSQL real** (`minimarket_test`, creada si falta). Un candado de PostgreSQL evita que dos paquetes de prueba se pisen. |
| Listados | 45 filas → páginas de 20, 20 y 5; sin repetidos ni saltos; orden descendente con cursor; filtros; búsqueda sin acentos; cursor de otro orden rechazado. |
| Reglas | El login (token, contraseña errónea, límite de intentos, cierre de sesión) y el catálogo completo (crear, editar, eliminar, SKU repetido, validaciones, resumen). |
| **Arquitectura** | `internal/architecture_test.go` revisa los archivos y falla si: otro archivo que no sea `http.go` importa Gin o `net/http`; un `http.go` toca `pgx` o la base de datos; lo común (`apperror`, `pagination`, `web`, `platform`) depende de un submódulo; un submódulo importa a otro sin estar en `allowedCrossImports`; o un archivo pasa de 300 líneas. |

Además: `go vet ./...` y `gofmt` limpios.

---

## 11. Lista de verificación para un submódulo nuevo

- [ ] Paquete `internal/<sistema>/<módulo>/<submódulo>/` con `http.go`, `service.go`, `store.go`, `types.go`, `errors.go` y `wire.go` (y un `*_query.go` por listado).
- [ ] Montado en `internal/server/server.go` con `<paquete>.New(pool).Routes(protected)`, dentro del grupo que exige sesión.
- [ ] Migración SQL numerada con sus índices `(columna, id)` por cada orden permitido.
- [ ] Listados con máximo 20 filas, cursor, orden con lista blanca y filtros obligatorios si la tabla es grande.
- [ ] Enums para todo valor cerrado; `CHECK` equivalente en la base.
- [ ] Errores de negocio con código; el store no conoce códigos.
- [ ] Pruebas de endpoint con PostgreSQL real, incluida la continuidad del cursor; la prueba de arquitectura en verde.

---

## 12. Estado actual

| Pieza | Estado |
|---|---|
| Núcleo (errores, paginación, validación, límite de intentos, migraciones) | Hecho |
| Login por token, usuario actual, cierre de sesión | Hecho |
| ERP › Catálogo › Productos (listado, crear, editar, eliminar, resumen, categorías) | Hecho |
| ERP › Catálogo › Unidades y presentaciones (listado de unidades) | Hecho (el CRUD y las presentaciones, pendientes) |
| Roles, permisos y sucursales (Configuraciones) | Pendiente |
| ERP › Inventario con kardex | Pendiente (siguiente) |
| Eventos entre sistemas y trabajos en segundo plano (SUNAT, CRM, BI) | Pendiente |
| Tipo decimal para cálculos de dinero y cantidades | Pendiente (se decide al primer cálculo) |
