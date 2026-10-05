# Arquitectura del frontend

Frontend de la suite MiniMarket: **React 19 + TypeScript + Tailwind CSS 4**, entregado por **Inertia** (cada página es una ruta de Laravel) y alimentado por la **API REST** del backend (`/api`, token Bearer). Ver [arquitectura-backend.md](arquitectura-backend.md) para el contrato de la API.

Objetivo: que cualquier pantalla nueva (kardex, ventas, traslados, planilla…) se arme **componiendo piezas ya existentes**, sin copiar y pegar, y que cada archivo tenga **una sola responsabilidad**.

> Estado: propuesta para aprobar. Las decisiones pendientes están al final.

---

## 1. Principios

1. **Separar lo que cambia por razones distintas**: cómo se *ve* (componentes), cómo se *obtienen* los datos (api + hooks) y qué *significa* el negocio (reglas, formato). Nunca en el mismo archivo.
2. **Los componentes visuales no hacen `fetch`.** Reciben datos y callbacks por props.
3. **Las páginas solo componen.** Una página de Inertia no tiene lógica: arma una *feature* y le pasa parámetros de ruta.
4. **Lo reutilizable se construye genérico una sola vez** (tabla, lista infinita, buscador, modal, selector) y las pantallas lo configuran.
5. **La validación real vive en el servidor.** El frontend valida para ayudar al usuario, pero muestra siempre los errores que devuelve la API.
6. **Accesibilidad por defecto**: foco, teclado, roles y etiquetas en cada componente base (no como retoque final).

---

## 2. Capas y qué puede importar a qué

```
pages/            ← rutas Inertia: solo componen una feature
   │
features/         ← una carpeta por sistema/submódulo (erp/inventory, pos/sales…)
   │   ├─ components/   piezas propias de la feature
   │   ├─ hooks/        estado y datos de la feature
   │   ├─ api/          funciones que llaman a la API (sin React)
   │   └─ types.ts      tipos que reflejan los Resources del backend
   │
components/       ← piezas reutilizables por todas las features
   ├─ ui/           primitivas: Button, Input, Modal, Badge, Spinner…
   └─ data/         compuestas: DataTable, InfiniteList, SearchInput, EntityPickerModal…
   │
hooks/            ← hooks genéricos (useDebouncedValue, useInfiniteScroll…)
lib/              ← utilidades sin React (api client, formatos, cn)
```

**Regla de dependencias (solo hacia abajo):**

| Capa | Puede importar de | No puede importar de |
|---|---|---|
| `pages` | `features`, `components`, `layouts` | — |
| `features/x` | `components`, `hooks`, `lib`, **su propia** carpeta | **otras** features |
| `components` | `hooks`, `lib` | `features`, `pages` |
| `hooks`, `lib` | `lib` | `components`, `features` |

Si dos features necesitan lo mismo, **sube** esa pieza a `components/` o `hooks/`; nunca importes de una feature a otra. (Se verifica con la regla de lint `no-restricted-imports`.)

### Estructura de carpetas

```
resources/js/
├── pages/                         Entradas de Inertia (delgadas)
│   ├── auth/login.tsx
│   ├── sistemas.tsx
│   └── erp/
│       ├── kardex.tsx
│       └── traslados/crear.tsx
├── layouts/                       Marcos de página (auth, sistema con sidebar…)
├── features/
│   └── erp/
│       └── inventory/
│           ├── api/               kardex.ts, transfers.ts
│           ├── components/        KardexTable, TransferForm, TransferLinesTable
│           ├── hooks/             useKardex, useTransferForm
│           ├── types.ts           KardexMovement, StockTransfer…
│           └── index.ts           API pública de la feature
├── components/
│   ├── ui/                        button, input, modal, badge, spinner, select…
│   └── data/                      data-table, infinite-list, search-input,
│                                  entity-picker-modal, empty-state, error-state…
├── hooks/                         use-debounced-value, use-infinite-scroll, use-cursor-list
└── lib/                           api.ts, format.ts (moneda S/, fechas), utils.ts, systems.ts
```

---

## 3. Capa de datos

### 3.1 Cliente de API (`lib/api.ts`)

Un único cliente: agrega el token, envía `Accept: application/json`, convierte las respuestas de error en una clase `ApiError` con `status`, `code`, `message`, `errors` y `context` (el formato del backend, sección 6 de la arquitectura del backend). Ningún componente llama a `fetch` directamente.

Una respuesta `401` limpia el token y redirige a `/login` desde un solo lugar.

### 3.2 Funciones de la feature (`features/*/api`)

Funciones puras, tipadas, sin React:

```ts
// features/erp/inventory/api/kardex.ts
export type KardexFilters = {
    warehouseId: number;
    productId: number;
    from: string;
    to: string;
};

export function fetchKardexPage(filters: KardexFilters, cursor?: string) {
    return api.getPage<KardexMovement>('/inventory/kardex', {
        warehouse_id: filters.warehouseId,
        product_id: filters.productId,
        from: filters.from,
        to: filters.to,
        cursor,
    });
}
```

`api.getPage<T>()` devuelve `{ data: T[]; nextCursor: string | null }` (traduce `meta.next_cursor` del backend).

### 3.3 Lista paginada por cursor (`hooks/use-cursor-list.ts`)

Hook genérico que implementa el contrato de listados del backend (20 filas, cursor, sin total):

```ts
const kardex = useCursorList({
    queryKey: ['kardex', filters],
    fetchPage: (cursor) => fetchKardexPage(filters, cursor),
    enabled: filters !== null,
});

// kardex.rows       → filas acumuladas
// kardex.hasMore    → hay otra página
// kardex.loadMore() → pide las siguientes 20
// kardex.isLoading / kardex.isLoadingMore / kardex.error / kardex.reload()
```

Reglas del hook:

- **Primera petición: 20 filas.** Las siguientes se piden solo al acercarse al final.
- Al cambiar los filtros se **reinicia** la lista y se cancela la petición en curso.
- Evita duplicados por `id` y no dispara dos `loadMore` a la vez.
- Los errores se exponen; la lista conserva lo ya cargado y ofrece "Reintentar".

### 3.4 Scroll infinito (`hooks/use-infinite-scroll.ts`)

Un `IntersectionObserver` sobre un elemento centinela al final de la lista. Al hacerse visible llama a `loadMore()`. Se deshabilita si no hay más filas o si hay una carga en curso. Funciona con el scroll de la página o con el de un contenedor (el modal usa el suyo).

> **Memoria:** con muchas páginas cargadas el DOM crece. Hasta ~300 filas no hace falta hacer nada; si una pantalla lo supera, se activa virtualización (`@tanstack/react-virtual`) dentro de `DataTable`, sin cambiar a quien la usa.

---

## 4. Componentes reutilizables

### 4.1 Primitivas (`components/ui`)

Sin lógica de negocio ni datos. Todas aceptan `className`, pasan el resto de props al elemento nativo y exponen estados (`disabled`, `aria-invalid`, `loading`).

`Button` · `Input` · `Select` · `Checkbox` · `Badge` (con variantes de estado) · `Spinner` · `Skeleton` · `Modal` · `ConfirmDialog` · `Tooltip` · `FormField` (etiqueta + control + error).

`Modal`: atrapa el foco, cierra con `Esc` y clic fuera, devuelve el foco al disparador, bloquea el scroll del fondo y tiene `aria-modal`/`aria-labelledby`.

### 4.2 Compuestas (`components/data`)

| Componente | Responsabilidad | Props principales |
|---|---|---|
| `DataTable<T>` | Mostrar filas con columnas declarativas; estados de carga/vacío/error | `columns`, `rows`, `getRowKey`, `onRowClick?`, `footer?` |
| `InfiniteList<T>` / `DataTable` con `infinite` | Pedir las siguientes 20 al llegar al final | `hasMore`, `isLoadingMore`, `onLoadMore` |
| `SearchInput` | Caja de búsqueda con *debounce* (300 ms), mínimo 2 caracteres, botón limpiar | `value`, `onChange`, `minLength` |
| `FilterBar` | Contenedor de filtros que reinicia la lista al cambiar | `children`, `onReset` |
| `EntityPickerModal<T>` | **Modal genérico para elegir registros** (productos, clientes, proveedores…) | ver 4.3 |
| `EmptyState` / `ErrorState` | Mensaje y acción para "sin resultados" y "falló la carga" | `title`, `description`, `action` |
| `PageHeader` | Título, descripción y acciones de una pantalla | `title`, `actions` |

**Columnas declarativas:**

```tsx
const columns: Column<KardexMovement>[] = [
    { key: 'moved_at', header: 'Fecha', cell: (m) => formatDateTime(m.moved_at) },
    { key: 'type', header: 'Movimiento', cell: (m) => <MovementBadge type={m.type} label={m.type_label} /> },
    { key: 'quantity', header: 'Cantidad', align: 'right', cell: (m) => formatQuantity(m.quantity) },
    { key: 'balance', header: 'Saldo', align: 'right', cell: (m) => formatQuantity(m.balance_quantity) },
];
```

Las celdas numéricas usan cifras tabulares y alineación a la derecha; la cabecera de la tabla es fija al hacer scroll.

### 4.3 Ejemplo completo: buscador de productos en un modal

Tres capas, cada una con su responsabilidad:

**1) Genérico (`components/data/entity-picker-modal.tsx`)** — no sabe qué es un producto:

```tsx
type EntityPickerModalProps<T> = {
    open: boolean;
    title: string;
    placeholder?: string;
    fetchPage: (search: string, cursor?: string) => Promise<Page<T>>;
    getKey: (item: T) => string | number;
    renderItem: (item: T) => ReactNode;
    onSelect: (item: T) => void;     // modo simple: elige y cierra
    onClose: () => void;
    multiple?: boolean;              // modo múltiple: marca varios y confirma
    excludeKeys?: Array<string | number>;   // ya agregados: se muestran deshabilitados
};
```

Internamente: `Modal` + `SearchInput` (con debounce) + `useCursorList` + `useInfiniteScroll` sobre el scroll **del propio modal**. Primera carga de 20 resultados; al bajar, otros 20. Navegación con flechas, `Enter` para elegir, `Esc` para cerrar.

**2) Específico (`features/erp/inventory/components/product-picker-modal.tsx`)** — conoce el producto, no el modal:

```tsx
export function ProductPickerModal(props: Pick<EntityPickerModalProps<ProductOption>,
    'open' | 'onSelect' | 'onClose' | 'excludeKeys' | 'multiple'> & { warehouseId?: number }) {
    return (
        <EntityPickerModal<ProductOption>
            {...props}
            title="Buscar producto"
            placeholder="Nombre, SKU o código de barras"
            fetchPage={(search, cursor) => searchProducts({ search, warehouseId: props.warehouseId }, cursor)}
            getKey={(p) => p.id}
            renderItem={(p) => (
                <ProductOptionRow sku={p.sku} name={p.name} stock={p.available_stock} unit={p.unit} />
            )}
        />
    );
}
```

**3) Pantalla de traslados** — usa el selector, no sabe cómo se busca:

```tsx
function TransferForm() {
    const form = useTransferForm();            // estado, validación y envío
    const [picking, setPicking] = useState(false);

    return (
        <>
            <TransferHeaderFields form={form} />
            <TransferLinesTable lines={form.lines} onQuantityChange={form.setQuantity} onRemove={form.removeLine} />
            <Button onClick={() => setPicking(true)}>Agregar producto</Button>

            <ProductPickerModal
                open={picking}
                warehouseId={form.fromWarehouseId}
                excludeKeys={form.lines.map((l) => l.productId)}
                onSelect={(product) => { form.addLine(product); setPicking(false); }}
                onClose={() => setPicking(false)}
            />

            <Button onClick={form.submit} disabled={!form.canSubmit} loading={form.submitting}>
                Registrar traslado
            </Button>
        </>
    );
}
```

Reparto de responsabilidades en este ejemplo:

| Pieza | Responsabilidad | No hace |
|---|---|---|
| `EntityPickerModal` | Interacción de elegir (buscar, listar, teclado, foco) | Saber qué entidad es |
| `ProductPickerModal` | Cómo se busca y cómo se ve un producto | Saber qué se hace al elegirlo |
| `useTransferForm` | Estado de las líneas, validación local, llamada de envío | Dibujar nada |
| `TransferLinesTable` | Mostrar y editar líneas | Pedir datos |
| `searchProducts()` (api) | Llamar al endpoint y tipar la respuesta | Usar React |
| Backend (`StockTransferService`) | Validar stock y registrar el traslado | — |

**Errores del envío:** si el backend responde `INSUFFICIENT_STOCK`, `useTransferForm` marca la línea del `context.product_id` con "Disponible: X" en lugar de mostrar un aviso genérico.

---

## 5. Páginas y layouts

- Una **página** de `pages/` hace solo esto: leer parámetros de la ruta, proteger el acceso y renderizar una feature.

  ```tsx
  export default function Kardex() {
      return <KardexScreen />;        // toda la lógica está en la feature
  }
  ```

- Los **layouts** (`layouts/`) dan el marco: autenticación (panel de sistemas a la izquierda + formulario), y el de sistema (sidebar, cabecera, selector de sucursal). Se asignan por prefijo de nombre de página en `app.tsx`.
- **Tema por sistema:** el layout de un sistema pone `data-system="erp"` en su contenedor y toda la interfaz toma esa paleta (variables `--grad-start`, `--grad-end`, `--accent`, `--surface`, `--text`). Los componentes usan las variables, nunca colores fijos del sistema.
- **Protección de rutas:** hoy cada página comprueba el token; se centraliza en un hook `useRequireAuth()` usado por los layouts de sistema. El servidor protege los datos de verdad: toda llamada a la API exige token.

---

## 6. Formularios

- Un hook por formulario (`useTransferForm`) concentra estado, validación local y envío; el componente solo dibuja.
- Los errores `422` se asignan a su campo (`errors.campo[0]`); los de negocio (`code`) se traducen en un mensaje específico.
- Botón de envío: se desactiva y muestra el estado "Guardando…" mientras dura la petición (evita doble envío).
- Etiquetas siempre visibles (no solo *placeholder*), `autocomplete` correcto y foco en el primer campo con error.

---

## 7. Formato y textos

- Un solo lugar para formatear (`lib/format.ts`): moneda `S/ 1,240.00`, cantidades con 3 decimales cuando corresponde, fechas en `America/Lima`.
- Los enums del backend llegan con su etiqueta (`type_label`); el frontend solo mapea **estilo** (color del `Badge`) por valor, nunca el texto.
- Todos los textos de interfaz en español, con una redacción consistente: botones con verbo (“Registrar traslado”), errores que explican qué pasó y qué hacer.

---

## 8. Pruebas y calidad

| Qué | Cómo |
|---|---|
| Tipos | `tsc --noEmit` en CI |
| Estilo y lint | `vp check` (incluye la regla de importaciones entre capas) |
| Hooks genéricos (`useCursorList`, `useDebouncedValue`) | Pruebas unitarias con Vitest + Testing Library |
| Componentes base (`Modal`, `EntityPickerModal`, `DataTable`) | Pruebas de componente: foco, teclado, estados |
| Flujos críticos (login, traslado, venta) | Verificación en navegador (Playwright) |

---

## 9. Lista de verificación para una pantalla nueva

- [ ] La página solo renderiza una feature.
- [ ] Datos: función en `api/` + hook en `hooks/`; ningún `fetch` en componentes.
- [ ] Listados con `useCursorList` + scroll infinito; primera carga de 20.
- [ ] Tabla con `DataTable` y columnas declarativas; estados vacío / carga / error cubiertos.
- [ ] Selección de registros con `EntityPickerModal`, no con un modal propio.
- [ ] Textos en español; moneda y fechas con `lib/format.ts`.
- [ ] Teclado y foco probados; contraste según el tema del sistema.

---

## 10. Decisiones pendientes

| # | Decisión | Recomendación |
|---|---|---|
| 1 | Datos del servidor (caché, reintentos, listas infinitas) | Usar **TanStack Query** (`@tanstack/react-query`): trae `useInfiniteQuery`, cancelación y caché hechos y probados. Si se prefiere no sumar dependencias, `useCursorList` se escribe a mano (~80 líneas) con el mismo contrato. |
| 2 | Tablas largas | Posponer la virtualización hasta que una pantalla supere ~300 filas. |
| 3 | Tipos de la API | Escribirlos a mano en cada feature al inicio; si crecen mucho, generarlos desde los Resources del backend. |
| 4 | Pruebas de frontend | Agregar Vitest + Testing Library cuando exista el primer componente genérico (`DataTable`). |

---

## 11. Navegación por sistema (sidebar)

- **Una sola fuente de datos:** `lib/navigation.ts` define, para cada sistema, sus módulos y submódulos (nombre + icono). El sidebar, la pantalla de sistemas y los conteos de módulos leen de ahí; para agregar una opción nueva solo se edita ese archivo.
- **Un solo componente:** `components/system/system-sidebar.tsx` sirve a todos los sistemas. El color lo pone el tema (`data-system`), no el componente.
- **Comportamiento:** fondo blanco; los módulos se despliegan y muestran sus submódulos; el módulo de la URL se abre solo y su submódulo queda resaltado. Se puede **contraer** a una columna de iconos (el estado se recuerda en el navegador); en móvil se abre como panel lateral.
- **URL:** `/sistemas/{sistema}/{módulo}/{submódulo}` con los nombres en minúsculas y sin tildes (`/sistemas/erp/inventario/kardex-valorizado`). La URL es la fuente de verdad de qué opción está activa.
- **Marco de página:** `layouts/system-layout.tsx` junta el sidebar, la barra de usuario y el contenido; las pantallas de cada submódulo solo renderizan su contenido dentro de ese layout.
