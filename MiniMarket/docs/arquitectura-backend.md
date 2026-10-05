# Arquitectura del backend

Backend de la suite MiniMarket: **Laravel 13 / PHP 8.3**, API REST bajo `/api` (sin versión en la ruta), autenticación con **Laravel Sanctum** (token Bearer) y una sola base de datos compartida por todos los sistemas (POS, ERP, SCM, WMS, RR. HH., CRM, BI).

Este documento define **cómo se organiza el código y las reglas que no se negocian**. Todo módulo nuevo debe seguirlo; las reglas marcadas como *test de arquitectura* se verifican automáticamente en CI.

> Estado: propuesta para aprobar. Las decisiones pendientes están al final.

---

## 1. Principios

| Principio | Cómo se aplica aquí |
|---|---|
| **S** (una sola responsabilidad) | Un controlador solo traduce HTTP; un servicio ejecuta *un* caso de uso de negocio; una consulta (`Query`) lee datos; un `FormRequest` valida. |
| **O** (abierto/cerrado) | Lo que varía se modela como un `enum` con comportamiento (p. ej. `CostingMethod`: promedio móvil o último costo). Agregar un caso nuevo no obliga a tocar el servicio. |
| **L** (sustitución) | Las clases que se extienden (`DomainException` y sus hijas) se usan sin que el consumidor note la diferencia: mismos tipos, mismo comportamiento. |
| **I** (interfaces pequeñas) | Servicios pequeños y cohesivos (`StockMovementService`, `StockTransferService`), no un `InventoryService` gigante. |
| **D** (inversión de dependencias) | Un servicio recibe a los demás servicios por **constructor** (el contenedor de Laravel los inyecta); no los crea con `new` dentro de la lógica. Una interfaz se crea solo cuando existe una segunda implementación real. |

Reglas complementarias:

- **Controladores delgados** (máx. ~10 líneas por método): validar → llamar → devolver Resource.
- **La lógica de negocio solo vive en servicios.** Nunca en controladores, modelos, Resources ni migraciones.
- **Lecturas y escrituras separadas** (CQRS ligero): las *escrituras* pasan por `Services`; las *lecturas de listados* por `Queries`.
- **Los errores de negocio son excepciones de dominio**, no `abort()` ni arreglos con `false`.
- **Los valores fijos son Enums**, nunca cadenas o números sueltos.
- **Todo cambia de estado dentro de una transacción** abierta por el servicio.
- **Sin ceremonia innecesaria:** no se crean DTOs ni interfaces "por si acaso". Los datos validados son `$request->validated()` y las dependencias son clases concretas inyectadas. Una interfaz solo se introduce cuando hay dos implementaciones reales.

---

## 2. Estructura de carpetas

Monolito modular: se organiza por **sistema → submódulo**, y cada submódulo contiene todas sus capas. Laravel ya autocarga `App\`, así que no hace falta configuración extra.

```
app/
├── Modules/
│   ├── Erp/
│   │   ├── Inventory/                      ← submódulo
│   │   │   ├── Enums/                      MovementType, TransferStatus…
│   │   │   ├── Events/                     StockTransferred, StockAdjusted…
│   │   │   ├── Exceptions/                 InsufficientStockException…
│   │   │   ├── Http/
│   │   │   │   ├── Controllers/
│   │   │   │   ├── Requests/               FormRequest (validación)
│   │   │   │   └── Resources/              Forma de la respuesta JSON
│   │   │   ├── Models/                     Eloquent (solo relaciones, casts, scopes)
│   │   │   ├── Policies/                   Autorización
│   │   │   ├── Queries/                    Listados (KardexQuery, StockQuery…)
│   │   │   ├── Services/                   Casos de uso de escritura
│   │   │   ├── InventoryServiceProvider.php
│   │   │   └── routes.php
│   │   └── Catalog/ …
│   ├── Pos/ …
│   ├── Scm/ …
│   ├── Wms/ …
│   ├── Hcm/ …
│   ├── Crm/ …
│   └── Bi/ …
└── Shared/                                  ← núcleo compartido (sin lógica de un sistema)
    ├── Enums/                               ErrorCode, PageSize…
    ├── Exceptions/                          DomainException (base)
    ├── Http/                                Respuestas y middleware comunes
    ├── Queries/                             CursorQuery (base de todos los listados)
    └── ValueObjects/                        Money, Quantity
```

### Propiedad de los datos

- **Cada tabla tiene un solo módulo dueño.** Solo el dueño la escribe.
- Un módulo que necesita datos de otro los pide al **servicio del módulo dueño** o reacciona a un **evento**; nunca hace `Model::query()` sobre un modelo ajeno.
- Convención de nombres: datos maestros compartidos sin prefijo (`products`, `branches`, `warehouses`); tablas propias del sistema con prefijo (`pos_sales`, `wms_locations`, `hcm_employees`).

### Comunicación entre sistemas

| Caso | Mecanismo | Ejemplo |
|---|---|---|
| Debe ser consistente al instante | Llamada al **servicio del módulo dueño** dentro de la misma transacción | POS confirma una venta → `StockMovementService::deduct()` |
| Puede ocurrir después | **Evento** + listener en cola | Venta confirmada → CRM suma puntos; BI actualiza consolidados |

---

## 3. Flujo de una petición

```
Request HTTP
   │
   ▼
FormRequest ──── valida y normaliza ──────────────► 422 si falla
   │
   ▼
Controller ───── pasa los datos validados y delega ► (sin lógica)
   │
   ├── escritura ──► Service ── DB::transaction ──► Models / Events
   │                     └── lanza DomainException si rompe una regla
   │
   └── lectura ───► Query ── cursorPaginate(20) ──► CursorPaginator
   │
   ▼
Resource ──────── forma de la respuesta ──────────► JSON
```

Las excepciones de dominio las convierte en JSON **un único manejador** (sección 6); ningún controlador captura excepciones.

---

## 4. Reglas para consultas y listados

Los listados son lo que más puede degradar el sistema (el kardex, las ventas o la asistencia tienen millones de filas). Estas reglas son **obligatorias**:

1. **Máximo 20 filas por petición.** El límite es una constante del servidor (`PageSize::MAX = 20`). El cliente puede pedir menos, nunca más; cualquier valor mayor se ignora.
2. **Paginación por cursor (keyset), no por número de página.** Está prohibido `offset` / `?page=N` en tablas de movimientos. Con cursor, la página 500 cuesta lo mismo que la 1.
3. **Orden determinista con desempate por `id`** (`ORDER BY moved_at DESC, id DESC`). Sin desempate el cursor puede repetir o saltar filas.
4. **Filtros obligatorios en tablas grandes.** El kardex exige *almacén + producto + rango de fechas* (máx. 92 días).
5. **`select` explícito**; nunca `SELECT *` en listados.
6. **Sin N+1.** Relaciones con `with()`. En desarrollo y pruebas se activa `Model::preventLazyLoading()` para que falle ruidosamente.
7. **Sin `COUNT(*)` en listados.** La respuesta indica si hay más (`next_cursor`), no el total. Los totales se piden a un endpoint de resumen aparte, con caché.
8. **Búsqueda de texto con índice.** Mínimo 2 caracteres; para códigos se usa prefijo (`ILIKE 'abc%'`); para nombres, índice `pg_trgm` (GIN).
9. **Filtros y orden con lista blanca.** Los campos permitidos se declaran en la `Query`; cualquier otro se rechaza con 422.
10. **Un índice compuesto que cubra filtro + orden**, documentado en la migración y verificado con `EXPLAIN`.
11. **Resource mínimo en listados.** Solo las columnas que se muestran; el detalle completo va en `show`.
12. **Exportaciones fuera del listado.** Excel/CSV se generan en un job en cola con `lazyById()`; nunca ampliando el límite de 20.

### 4.1 Contrato de respuesta de un listado

```
GET /api/inventory/kardex?warehouse_id=3&product_id=120&from=2026-09-01&to=2026-09-30
GET /api/inventory/kardex?warehouse_id=3&product_id=120&from=2026-09-01&to=2026-09-30&cursor=eyJtb3ZlZF9hdCI6…
```

```json
{
  "data": [
    {
      "id": 90412,
      "moved_at": "2026-09-30T18:42:10-05:00",
      "type": "sale",
      "type_label": "Venta",
      "document": "B001-0412",
      "quantity": "-2.000",
      "unit_cost": "3.2000",
      "balance_quantity": "118.000",
      "balance_cost": "384.1000"
    }
  ],
  "meta": { "per_page": 20, "next_cursor": "eyJtb3ZlZF9hdCI6…", "prev_cursor": null },
  "links": { "next": "http://minimarket.test/api/inventory/kardex?cursor=…" }
}
```

- `next_cursor === null` ⇒ no hay más filas.
- El cliente envía el `cursor` tal cual lo recibió; nunca lo construye ni lo interpreta.
- Es el formato nativo de `cursorPaginate()` de Laravel con un `ResourceCollection`; no se inventa un formato propio.

### 4.2 Ejemplo completo: kardex

**Tabla e índice** (la migración documenta por qué existe el índice):

```php
Schema::create('inventory_movements', function (Blueprint $table) {
    $table->id();
    $table->foreignId('warehouse_id')->constrained();
    $table->foreignId('product_id')->constrained();
    $table->string('type');                         // MovementType
    $table->decimal('quantity', 14, 3);             // + entra, − sale
    $table->decimal('unit_cost', 14, 4);
    $table->decimal('balance_quantity', 14, 3);     // saldo luego del movimiento
    $table->decimal('balance_cost', 14, 4);
    $table->nullableMorphs('document');
    $table->timestamp('moved_at');
    $table->timestamps();

    // Cubre WHERE warehouse+product y ORDER BY moved_at DESC, id DESC
    $table->index(['warehouse_id', 'product_id', 'moved_at', 'id'], 'movements_kardex_idx');
});
```

> **El saldo se guarda al insertar** (`balance_quantity`, `balance_cost`), calculado por el servicio con el stock bloqueado. No se calcula con funciones de ventana sobre todo el histórico en cada lectura: eso es lo que hace inviable un kardex grande.

**Base de todos los listados** (en `Shared`):

```php
abstract class CursorQuery
{
    abstract protected function builder(): Builder;

    public function page(): CursorPaginator
    {
        return $this->builder()->cursorPaginate(PageSize::MAX);
    }
}
```

**La consulta del kardex:**

```php
final class KardexQuery extends CursorQuery
{
    /**
     * @param  array{warehouse_id: int, product_id: int, from: string, to: string}  $filters
     */
    public function __construct(private readonly array $filters) {}

    protected function builder(): Builder
    {
        return InventoryMovement::query()
            ->select(['id', 'type', 'quantity', 'unit_cost', 'balance_quantity',
                      'balance_cost', 'document_type', 'document_id', 'moved_at'])
            ->where('warehouse_id', $this->filters['warehouse_id'])
            ->where('product_id', $this->filters['product_id'])
            ->whereBetween('moved_at', [$this->filters['from'], $this->filters['to']])
            ->with('document')                       // evita N+1
            ->orderByDesc('moved_at')
            ->orderByDesc('id');                     // desempate para el cursor
    }
}
```

**Validación (FormRequest):**

```php
final class KardexIndexRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'product_id'   => ['required', 'integer', 'exists:products,id'],
            'from'         => ['required', 'date'],
            'to'           => ['required', 'date', 'after_or_equal:from',
                               new MaxDaysSpan(from: 'from', days: 92)],   // regla propia, reutilizable
            'cursor'       => ['nullable', 'string'],
        ];
    }
}
```

**Controlador:**

```php
final class KardexController extends Controller
{
    public function index(KardexIndexRequest $request): ResourceCollection
    {
        $this->authorize('viewKardex', Warehouse::findOrFail($request->warehouse_id));

        return KardexMovementResource::collection(
            (new KardexQuery($request->safe()->except('cursor')))->page()
        );
    }
}
```

**Prueba mínima obligatoria** (Pest): con 45 movimientos, la 1.ª petición devuelve 20 y `next_cursor`; la 2.ª, 20 distintos; la 3.ª, 5 y `next_cursor = null`; ninguna fila se repite ni se salta.

---

## 5. Servicios (casos de uso de escritura)

Un servicio = **un caso de uso** (o un conjunto muy cohesivo). Reglas:

- Recibe **parámetros simples y tipados** (ids, cantidades) o, si son muchos, el array validado con su forma en PHPDoc (`@param array{…}`); nunca el `Request`.
- Abre la **transacción** y bloquea lo necesario (`lockForUpdate`).
- Lanza **excepciones de dominio**; no devuelve `false` ni arreglos de error.
- Dispara **eventos** cuando otros sistemas deben enterarse.
- No conoce HTTP: no usa `request()`, `auth()` ni `response()`; recibe al usuario por parámetro.
- Recibe otros servicios o clases concretas por constructor (inyección del contenedor).

### Ejemplo: traslado entre almacenes

```php
final class StockTransferService
{
    public function __construct(
        private readonly StockMovementService $movements,
        private readonly Dispatcher $events,
    ) {}

    /**
     * @param  array<int, array{product_id: int, quantity: string}>  $lines
     */
    public function transfer(int $fromWarehouseId, int $toWarehouseId, array $lines, User $by): StockTransfer
    {
        return DB::transaction(function () use ($fromWarehouseId, $toWarehouseId, $lines, $by) {
            $transfer = StockTransfer::create([
                'from_warehouse_id' => $fromWarehouseId,
                'to_warehouse_id'   => $toWarehouseId,
                'status'            => TransferStatus::Completed,
                'created_by'        => $by->id,
            ]);

            foreach ($lines as $line) {
                $this->movements->out($fromWarehouseId, $line['product_id'], $line['quantity'], $transfer);
                $this->movements->in($toWarehouseId, $line['product_id'], $line['quantity'], $transfer);
            }

            $this->events->dispatch(new StockTransferred($transfer));

            return $transfer;
        });
    }
}
```

El controlador la llama así: `$service->transfer($v['from_warehouse_id'], $v['to_warehouse_id'], $v['lines'], $request->user())`.

`StockMovementService::out()` lanza `InsufficientStockException` si no alcanza el stock; el servicio no la captura: la transacción se revierte sola y el manejador la convierte en respuesta.

### Variantes (abierto/cerrado): costeo

Lo que varía vive en un `enum` con comportamiento; el servicio no tiene `if` por método de costeo:

```php
enum CostingMethod: string
{
    case MovingAverage = 'moving_average';
    case LastCost = 'last_cost';

    public function costAfterEntry(Stock $stock, Quantity $incoming, Money $incomingCost): Money
    {
        return match ($this) {
            self::MovingAverage => $stock->value()->add($incoming->times($incomingCost))
                                         ->dividedBy($stock->quantity()->add($incoming)),
            self::LastCost      => $incomingCost,
        };
    }
}
```

Agregar un método nuevo es agregar un `case` y su rama. Si algún día la lógica de una variante crece o necesita dependencias propias, ese es el momento de extraerla a una clase con interfaz; no antes.

---

## 6. Excepciones y errores

### Jerarquía

```
DomainException (abstract, Shared)           ← base de todos los errores de negocio
├── InsufficientStockException               (Inventory)
├── CashRegisterClosedException              (Pos)
├── InvalidTransferStateException            (Inventory)
└── …
```

```php
abstract class DomainException extends \RuntimeException
{
    abstract public function errorCode(): ErrorCode;

    /** @return array<string, mixed> */
    public function context(): array { return []; }
}

final class InsufficientStockException extends DomainException
{
    public function __construct(
        public readonly int $productId,
        public readonly string $available,
        public readonly string $requested,
    ) {
        parent::__construct('No hay stock suficiente para completar la operación.');
    }

    public function errorCode(): ErrorCode { return ErrorCode::InsufficientStock; }

    public function context(): array
    {
        return ['product_id' => $this->productId, 'available' => $this->available, 'requested' => $this->requested];
    }
}
```

### Códigos de error (enum)

```php
enum ErrorCode: string
{
    case InsufficientStock = 'INSUFFICIENT_STOCK';
    case CashRegisterClosed = 'CASH_REGISTER_CLOSED';
    case InvalidState = 'INVALID_STATE';
    // …

    public function httpStatus(): int
    {
        return match ($this) {
            self::InsufficientStock, self::InvalidState => 409,
            self::CashRegisterClosed => 422,
        };
    }
}
```

### Un solo punto de conversión (`bootstrap/app.php`)

```php
$exceptions->render(function (DomainException $e, Request $request) {
    return response()->json([
        'message' => $e->getMessage(),
        'code'    => $e->errorCode()->value,
        'context' => $e->context(),
    ], $e->errorCode()->httpStatus());
});
```

### Formato de error para el frontend

| Situación | Estado | Cuerpo |
|---|---|---|
| Validación | 422 | `{ "message": "…", "errors": { "campo": ["…"] } }` (formato de Laravel) |
| Regla de negocio | 409 / 422 | `{ "message": "…", "code": "INSUFFICIENT_STOCK", "context": {…} }` |
| Sin sesión | 401 | `{ "message": "Unauthenticated." }` |
| Sin permiso | 403 | `{ "message": "…" }` |
| Error inesperado | 500 | `{ "message": "Error interno." }` — el detalle va al log, nunca al cliente |

El frontend decide qué mostrar por `code`, no por el texto del mensaje.

---

## 7. Enums

- Todo conjunto cerrado de valores es un `enum` con tipo (`string`/`int`) y vive en el `Enums/` de su módulo.
- Los modelos los usan en `casts()`; las migraciones guardan su `->value`.
- Si el frontend necesita la etiqueta, el enum la expone (`label()`), y el Resource la envía junto al valor (`type` + `type_label`).
- Los enums pueden contener comportamiento propio (`isFinal()`, `canTransitionTo()`), lo que evita `if` dispersos por el código.

```php
enum TransferStatus: string
{
    case Draft = 'draft';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function label(): string { /* "Borrador", "Completado", "Anulado" */ }

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Draft => in_array($next, [self::Completed, self::Cancelled], true),
            default => false,
        };
    }
}
```

---

## 8. Autenticación, permisos y sucursales

- **Autenticación:** token Bearer de Sanctum (`POST /api/login`, `POST /api/logout`, `GET /api/user`). Todas las rutas de módulos van bajo `auth:sanctum`.
- **Autorización:** `Policies` por modelo y **habilidades por sistema** en el token (`pos:use`, `erp:use`…), de modo que el selector de sistemas solo muestre los permitidos.
- **Multisucursal:** la sucursal activa viaja en el encabezado `X-Branch-Id`; un middleware verifica que el usuario pertenezca a ella y un *global scope* filtra los modelos por sucursal. Los servicios reciben la sucursal por parámetro, no la leen de la sesión.
- **Auditoría:** las operaciones de escritura registran quién y cuándo (`created_by`, `updated_by`) y las sensibles (anulaciones, ajustes) generan un registro de auditoría.

---

## 9. Datos y dinero

- **Nunca `float`.** Cantidades `DECIMAL(14,3)` (permiten balanza en kg), costos `DECIMAL(14,4)`, precios `DECIMAL(14,2)`.
- En PHP se usan los *value objects* `Money` y `Quantity` (cálculo con `bcmath`/`brick/math`) para no operar con cadenas sueltas.
- Fechas en UTC en la base; se muestran en `America/Lima`.
- **Idempotencia:** las operaciones que el POS puede reintentar (venta, cobro) aceptan una `Idempotency-Key` para no duplicarse si falla la red.
- **Concurrencia:** el stock se modifica bloqueando la fila de `stocks (warehouse_id, product_id)` con `lockForUpdate()` dentro de la transacción.

---

## 10. Pruebas y calidad

| Capa | Tipo de prueba | Qué verifica |
|---|---|---|
| Endpoint | Feature (Pest) | Códigos de estado, forma del JSON, permisos, máximo 20 filas, continuidad del cursor |
| Servicio | Unit / Feature con BD | Reglas de negocio, transacción revertida ante la excepción, eventos emitidos |
| Estrategias y enums | Unit | Cálculo de costo, transiciones de estado |
| **Arquitectura** | Pest `arch()` | Que se cumplan las reglas de capas (abajo) |

**Tests de arquitectura** (fallan si alguien rompe las reglas):

```php
arch('los controladores no usan la base de datos directamente')
    ->expect('App\Modules')->classes()->toHaveSuffix('Controller')
    ->not->toUse([DB::class, 'Illuminate\Database\Eloquent\Model']);

arch('los servicios no conocen HTTP')
    ->expect('App\Modules\*\*\Services')
    ->not->toUse(['Illuminate\Http\Request', 'Illuminate\Support\Facades\Auth']);

arch('las excepciones de dominio extienden la base')
    ->expect('App\Modules\*\*\Exceptions')->toExtend(DomainException::class);

arch('los enums viven en Enums')
    ->expect('App\Modules')->enums()->toBeIn('Enums');

arch('un módulo no usa los modelos de otro; solo sus servicios')
    ->expect('App\Modules\Pos')->not->toUse('App\Modules\Erp\*\Models');
```

Además: `Larastan` en CI, `Pint` para estilo, y `Model::preventLazyLoading()` activo fuera de producción.

---

## 11. Lista de verificación para un módulo nuevo

- [ ] Carpeta `app/Modules/{Sistema}/{Submódulo}` con sus capas y su `ServiceProvider`.
- [ ] Rutas en `routes.php` del submódulo, bajo `auth:sanctum` y la habilidad del sistema.
- [ ] `FormRequest` para cada entrada; el servicio recibe parámetros tipados o el array validado.
- [ ] Servicios con transacción y excepciones de dominio; dependencias inyectadas por constructor.
- [ ] Listados con `CursorQuery`, máximo 20, índice compuesto documentado.
- [ ] Enums para todo valor cerrado; `ErrorCode` para cada error de negocio nuevo.
- [ ] Policies y pruebas Feature + Unit + las de arquitectura en verde.

---

## 12. Decisiones pendientes

| # | Decisión | Recomendación |
|---|---|---|
| 1 | Idioma del código (clases, tablas, rutas) | **Inglés** en código, base de datos y rutas; **español** en mensajes y etiquetas. Los términos fiscales (boleta, factura, SUNAT) se mantienen como términos de dominio. |
| 2 | Base de datos de producción | **PostgreSQL** (ya indicado en la arquitectura de sistemas). Los índices y la búsqueda `pg_trgm` de este documento lo asumen; en desarrollo se puede usar SQLite solo para pruebas ligeras. |
| 3 | Permisos | Empezar con **Policies + habilidades de token** (sin dependencias). Si se necesitan roles editables por pantalla, evaluar `spatie/laravel-permission`. |
| 4 | Orden de construcción | 1) `Shared` (núcleo), 2) **ERP: Catálogo e Inventario** (todos los sistemas dependen de él), 3) POS, 4) SCM/WMS, 5) RR. HH., CRM, BI. |
