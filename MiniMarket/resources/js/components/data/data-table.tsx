import {
    ArrowDown,
    ArrowUp,
    ChevronsUpDown,
    Eye,
    GripVertical,
    Search,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { describeFilter } from '@/components/data/data-table-filters';
import type {
    DataTableFilter,
    FilterType,
} from '@/components/data/data-table-filters';
import { FiltersButton } from '@/components/data/filters-button';
import { Button } from '@/components/ui/button';
import { FIELD_HEIGHT } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useDismiss } from '@/hooks/use-dismiss';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { cn } from '@/lib/utils';

/**
 * Tabla de listado con columnas movibles, ocultables y redimensionables, orden
 * y búsqueda por columna, buscador general y filtros acumulables. Se pinta con
 * el acento del sistema activo (data-system) a través de los tokens de
 * app.css.
 *
 * Trabaja SIEMPRE contra el servidor y con scroll infinito: un listado trae
 * como máximo 20 filas con un cursor, y las siguientes 20 se piden solas al
 * llegar al final del scroll. No hay páginas, ni "por página", ni total (el
 * backend nunca hace COUNT(*)).
 *
 * Por eso la tabla NO filtra, ordena ni recorta nada en memoria: pinta
 * exactamente las `rows` que recibe y avisa con `onQuery` qué está pidiendo
 * (búsqueda, orden y filtros). Quien la usa vacía la lista y vuelve a pedir
 * desde la primera fila cada vez que `onQuery` se dispara.
 */

/** Ancho fijo de la columna de acciones: no se redimensiona ni se reparte. */
const ACTIONS_WIDTH = 140;

/**
 * Lo mínimo que mide una columna sin ancho propio, en píxeles.
 *
 * Es lo que necesita una cabecera corta ("SUBTOTAL") con un importe debajo
 * ("S/ 3000.00"). Menos que esto y las dos se recortan a la vez.
 */
const MIN_COLUMN_WIDTH = 120;

/** Lo menos que puede medir una columna al arrastrar su borde. */
const MIN_RESIZE_WIDTH = 90;

/** Cuánto espera la tabla, tras el último cambio, para avisar la consulta. */
const QUERY_DELAY = 300;

/** Filas de relleno mientras llega la primera tanda. */
const SKELETON_ROWS = 5;

export interface DataTableColumn<T> {
    key: string;
    label: string;
    align?: 'left' | 'right';
    sortable?: boolean;
    searchable?: boolean;
    filterable?: boolean;
    /** Tipo de control que arma el panel de filtros para esta columna. */
    filterType?: FilterType;
    /** Opciones del desplegable cuando `filterType: 'select'`. */
    filterOptions?: { value: string; label: string }[];
    render?: (row: T) => ReactNode;

    /**
     * En la tarjeta del móvil, la cabecera lleva su etiqueta al costado.
     *
     * Por defecto no: en un listado la primera columna es el nombre de la cosa
     * (el cliente, el documento) y ponerle "Producto:" delante sobra. Hace
     * falta cuando la cabecera es un campo que se edita, porque ahí sí es un
     * dato más y el resto de la tarjeta sí los rotula.
     */
    cardLabel?: boolean;

    /**
     * Ancho de arranque en píxeles. Sin esto todas las columnas se reparten el
     * espacio por igual, que sobra en las cortas (una equivalencia, un costo) y
     * falta en las largas. El usuario sigue pudiendo arrastrar el borde, y el
     * doble clic vuelve a este ancho.
     */
    width?: number;
}

export interface TableFilterQuery {
    column: string;
    operator: string;
    value: string;
    valueTo?: string;
}

/** Lo que la tabla está pidiendo: el espejo de su estado, para mandarlo al backend. */
export interface TableQuery {
    search: string;
    /** Columna y sentido del orden, o null si no hay orden elegido. */
    sort: { column: string; direction: 'asc' | 'desc' } | null;
    filters: TableFilterQuery[];
}

export interface DataTableProps<T> {
    columns: DataTableColumn<T>[];
    /** Las filas cargadas hasta ahora; la tabla las pinta tal cual. */
    rows: T[];
    /** Primera carga: se pintan filas de relleno. */
    loading?: boolean;
    /** Carga de la siguiente tanda: se pinta una fila "Cargando más…". */
    loadingMore?: boolean;
    /** Hay otra tanda por pedir con el cursor. */
    hasMore?: boolean;
    /** Pide la siguiente tanda (scroll al final o botón "Cargar más"). */
    onLoadMore?: () => void;
    /** Mensaje de la última petición fallida. */
    error?: string;
    onRetry?: () => void;
    /**
     * Avisa la consulta actual, con 300ms de espera tras el último cambio. Se
     * dispara también al montar, con los filtros iniciales.
     */
    onQuery: (query: TableQuery) => void;
    /**
     * Filtros con los que la tabla arranca, a la vista en el panel y como chip.
     *
     * Es para el filtro que la vista aplica igual aunque nadie lo toque (el
     * rango de fechas de hoy, por ejemplo): sin esto los datos salían filtrados
     * pero el panel decía "sin filtros". Restablecer y quitar el chip vuelven a
     * estos, no a vacío.
     */
    initialFilters?: Omit<DataTableFilter, 'id'>[];
    /** Propiedad que identifica cada fila. */
    rowKey?: keyof T & string;
    searchPlaceholder?: string;
    empty?: string;
    /** Icono de la tarjeta en la vista móvil. */
    cardIcon?: ComponentType<{
        size?: number;
        className?: string;
        'aria-hidden'?: boolean;
    }>;
    /** Columna de acciones en la tabla y botones de cada tarjeta en móvil. */
    actions?: (row: T) => ReactNode;
    /**
     * Ancho de la columna de Acciones, en px. El valor por defecto (140)
     * alcanza para 3-4 íconos; una vista con más botones por fila necesita
     * declarar uno mayor, o esos íconos fuerzan un scroll horizontal aunque el
     * resto de columnas sean pocas.
     */
    actionsWidth?: number;
    /** Si se pasa, toda la fila (y la tarjeta en móvil) queda clickeable. */
    onRowClick?: (row: T) => void;
    /** Oculta el buscador general y los botones de filtros/columnas, para tablas chicas donde solo estorban. */
    toolbar?: boolean;
    /** Oculta el pie "N filas cargadas" y el botón "Cargar más". */
    footer?: boolean;
    /** Alto máximo del área con scroll; sticky de la cabecera incluido. */
    scrollClassName?: string;
    className?: string;
}

/** Lo que pinta una celda: `render` o, sin él, el campo de la fila si es un valor simple. */
function cellContent<T>(column: DataTableColumn<T>, row: T): ReactNode {
    if (column.render) {
        return column.render(row);
    }

    const raw = (row as Record<string, unknown>)[column.key];

    return typeof raw === 'string' || typeof raw === 'number' ? raw : null;
}

function sameFilter(a: DataTableFilter, b?: DataTableFilter): boolean {
    return (
        !!b &&
        a.operator === b.operator &&
        a.value === b.value &&
        (a.valueTo ?? '') === (b.valueTo ?? '')
    );
}

export function DataTable<T>({
    columns,
    rows,
    loading = false,
    loadingMore = false,
    hasMore = false,
    onLoadMore,
    error,
    onRetry,
    onQuery,
    initialFilters,
    rowKey = 'id' as keyof T & string,
    searchPlaceholder = 'Buscar...',
    empty = 'No hay registros para mostrar.',
    cardIcon: CardIcon,
    actions,
    actionsWidth = ACTIONS_WIDTH,
    onRowClick,
    toolbar = true,
    footer = true,
    scrollClassName = 'max-h-[70vh]',
    className,
}: DataTableProps<T>) {
    // Orden elegido arrastrando cabeceras. Solo guarda lo que el usuario
    // movió: las columnas que la vista agrega o quita después se resuelven al
    // calcular `orderedKeys`, sin sincronizar nada.
    const [order, setOrder] = useState<string[]>([]);
    const [hidden, setHidden] = useState<string[]>([]);
    const [sort, setSort] = useState<TableQuery['sort']>(null);
    const [search, setSearch] = useState('');
    const [columnSearch, setColumnSearch] = useState<Record<string, string>>({});
    // Celda desde la que se abrió el buscador de columna: el popover se pinta
    // en un portal anclado a ella, porque el área con scroll recortaría lo que
    // se salga de ella.
    const [openSearch, setOpenSearch] = useState<{
        key: string;
        anchor: HTMLElement;
    } | null>(null);
    // Se fijan al montar: la vista suele pasarlos inline y cambiarían en cada render.
    const [initial] = useState<DataTableFilter[]>(() =>
        (initialFilters ?? []).map((filter) => ({ ...filter, id: filter.column })),
    );
    const [filters, setFilters] = useState<DataTableFilter[]>(initial);
    const initialOf = (column: string) =>
        initial.find((filter) => filter.column === column);
    const atStart =
        filters.length === initial.length &&
        filters.every((filter) => sameFilter(filter, initialOf(filter.column)));
    const [panel, setPanel] = useState<'columns' | 'filters' | null>(null);
    const [dragging, setDragging] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<string | null>(null);
    // Anchos fijados por el usuario al arrastrar el borde de una cabecera.
    const [widths, setWidths] = useState<Record<string, number>>({});
    const [resizingKey, setResizingKey] = useState<string | null>(null);

    const byKey = useMemo(
        () =>
            Object.fromEntries(
                columns.map((column) => [column.key, column]),
            ) as Record<string, DataTableColumn<T>>,
        [columns],
    );

    const orderedKeys = useMemo(() => {
        const current = order.filter((key) => key in byKey);
        const added = columns
            .map((column) => column.key)
            .filter((key) => !current.includes(key));

        return [...current, ...added];
    }, [order, columns, byKey]);

    // Columnas en el orden elegido y sin las ocultas.
    const visible = useMemo(
        () =>
            orderedKeys.flatMap((key) =>
                key in byKey && !hidden.includes(key) ? [byKey[key]] : [],
            ),
        [orderedKeys, byKey, hidden],
    );

    const toggleSort = (key: string) =>
        setSort((previous) => {
            if (previous?.column !== key) {
                return { column: key, direction: 'asc' };
            }

            return previous.direction === 'asc'
                ? { column: key, direction: 'desc' }
                : null;
        });

    const toggleColumn = (key: string) =>
        setHidden((previous) =>
            previous.includes(key)
                ? previous.filter((hiddenKey) => hiddenKey !== key)
                : [...previous, key],
        );

    const handleDrop = (targetKey: string) => {
        if (!dragging || dragging === targetKey) {
            return;
        }

        const next = orderedKeys.filter((key) => key !== dragging);
        next.splice(next.indexOf(targetKey), 0, dragging);
        setOrder(next);
        setDragging(null);
        setDragOver(null);
    };

    const startResize = (event: MouseEvent<HTMLSpanElement>, key: string) => {
        event.preventDefault();
        event.stopPropagation();

        const th = event.currentTarget.closest('th');

        if (!th) {
            return;
        }

        const startX = event.clientX;
        const startWidth = th.getBoundingClientRect().width;
        setResizingKey(key);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        const onMove = (moveEvent: globalThis.MouseEvent) =>
            setWidths((previous) => ({
                ...previous,
                [key]: Math.max(
                    MIN_RESIZE_WIDTH,
                    startWidth + moveEvent.clientX - startX,
                ),
            }));

        const onUp = () => {
            setResizingKey(null);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    /** Doble clic en el borde: la columna vuelve a su ancho de arranque. */
    const resetWidth = (key: string) =>
        setWidths((previous) => {
            const next = { ...previous };
            delete next[key];

            return next;
        });

    /*
     * Lo que la tabla le pide al backend.
     *
     * Todo cambio (escribir, ordenar, filtrar) espera 300ms: un clic y una
     * tecla salen por el mismo camino, y así una ráfaga de cambios es una sola
     * petición. La búsqueda por columna es un filtro más, solo que escrito
     * desde la cabecera en vez del panel de filtros.
     *
     * `onQuery` se guarda en una ref y NO entra en las dependencias: la vista
     * normalmente la pasa como función inline, que cambia en cada render, y el
     * efecto se repetiría sin parar.
     */
    const query = useMemo<TableQuery>(
        () => ({
            search: search.trim(),
            sort,
            filters: [
                ...filters.map((filter) => ({
                    column: filter.column,
                    operator: filter.operator,
                    value: filter.value,
                    valueTo: filter.valueTo,
                })),
                ...Object.entries(columnSearch)
                    .filter(([, text]) => text.trim())
                    .map(([column, text]) => ({
                        column,
                        operator: 'contains',
                        value: text.trim(),
                    })),
            ],
        }),
        [search, sort, filters, columnSearch],
    );
    const debouncedQuery = useDebouncedValue(query, QUERY_DELAY);

    const onQueryRef = useRef(onQuery);
    const lastQueryRef = useRef<string | null>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const cardsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        onQueryRef.current = onQuery;
    });

    useEffect(() => {
        const signature = JSON.stringify(debouncedQuery);

        if (lastQueryRef.current === signature) {
            return;
        }

        lastQueryRef.current = signature;
        onQueryRef.current(debouncedQuery);

        // Lista nueva: se vuelve al principio, no a donde estaba el scroll.
        bodyRef.current?.scrollTo({ top: 0 });
        cardsRef.current?.scrollTo({ top: 0 });
    }, [debouncedQuery]);

    /*
     * Scroll infinito. Cada vista (tabla y tarjetas) tiene su propio
     * centinela con su contenedor como `root`; la que está oculta con CSS no
     * intersecta nunca, así que solo dispara la visible.
     *
     * Con un error pendiente no se pide más: sin esto el centinela seguiría a
     * la vista y reintentaría en bucle una petición que falla.
     */
    const loadMore = () => onLoadMore?.();
    const busy = loadingMore || loading || Boolean(error);
    const tableSentinelRef = useInfiniteScroll({
        hasMore,
        loading: busy,
        onLoadMore: loadMore,
        root: bodyRef,
    });
    const cardsSentinelRef = useInfiniteScroll({
        hasMore,
        loading: busy,
        onLoadMore: loadMore,
        root: cardsRef,
    });

    /*
     * El reparto del ancho.
     *
     * Las columnas automáticas se reparten lo que queda DESPUÉS de descontar
     * la de Acciones y las que ya tienen ancho propio (fijado en la columna o
     * arrastrado por el usuario). Antes se repartía el 100% y la de Acciones
     * se sumaba encima en píxeles, así que la tabla medía siempre más que su
     * contenedor y aparecía un scroll horizontal aunque hubiera cuatro
     * columnas.
     *
     * Hay además un ANCHO MÍNIMO de la tabla: con `table-fixed`, un contenedor
     * angosto repartía lo poco que había entre TODAS las columnas y la
     * cabecera quedaba en "P. | C. | S.". Por debajo de este mínimo la tabla
     * ya no se encoge, se desplaza de lado.
     */
    const minTableWidth = useMemo(() => {
        const sum = visible.reduce(
            (total, column) =>
                total + (widths[column.key] ?? column.width ?? MIN_COLUMN_WIDTH),
            0,
        );

        return sum + (actions ? actionsWidth : 0);
    }, [visible, widths, actions, actionsWidth]);

    const colTemplate = useMemo(() => {
        const fixed = visible.map(
            (column) => widths[column.key] ?? column.width ?? null,
        );
        const fixedSum = fixed.reduce<number>((sum, width) => sum + (width ?? 0), 0);
        const loose = fixed.filter((width) => width === null).length;

        const reserved = `${fixedSum + (actions ? actionsWidth : 0)}px`;
        const auto = `calc((100% - ${reserved}) / ${Math.max(1, loose)})`;
        const cols: (string | number)[] = fixed.map((width) => width ?? auto);

        if (actions) {
            cols.push(actionsWidth);
        }

        return cols;
    }, [visible, widths, actions, actionsWidth]);

    const closePanel = () => setPanel(null);
    const activeColumnSearches = Object.values(columnSearch).filter((value) =>
        value.trim(),
    ).length;
    const colSpan = (visible.length || 1) + (actions ? 1 : 0);
    const isEmpty = !loading && !error && rows.length === 0;

    return (
        <div className={className}>
            {toolbar && (
                <>
                    {/* Barra de herramientas: suelta, sin tarjeta que la envuelva. */}
                    <div className="mb-2 flex items-center justify-end gap-2">
                        <div className="min-w-0 flex-1 sm:max-w-xs sm:flex-none sm:basis-80">
                            <div
                                className={cn(
                                    'flex items-center gap-2 rounded-field border border-line bg-surface px-3',
                                    'focus-within:border-ink-muted',
                                    FIELD_HEIGHT.sm,
                                )}
                            >
                                <Search
                                    className="size-[15px] shrink-0 text-ink-muted"
                                    aria-hidden
                                />
                                <input
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder={searchPlaceholder}
                                    aria-label="Buscar"
                                    className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-soft"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        aria-label="Limpiar búsqueda"
                                        className="shrink-0 cursor-pointer text-ink-soft hover:text-ink"
                                    >
                                        <X className="size-3.5" aria-hidden />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Iconos junto al buscador, en el extremo derecho. */}
                        <div className="flex items-center gap-1">
                            <FiltersButton
                                columns={columns}
                                filters={filters}
                                setFilters={setFilters}
                                initialFilters={initial}
                                open={panel === 'filters'}
                                onToggle={() =>
                                    setPanel((current) =>
                                        current === 'filters' ? null : 'filters',
                                    )
                                }
                                onClose={closePanel}
                            />

                            <ColumnsButton
                                order={orderedKeys}
                                byKey={byKey}
                                hidden={hidden}
                                onToggle={toggleColumn}
                                onShowAll={() => setHidden([])}
                                open={panel === 'columns'}
                                onOpen={() =>
                                    setPanel((current) =>
                                        current === 'columns' ? null : 'columns',
                                    )
                                }
                                onClose={closePanel}
                            />
                        </div>
                    </div>

                    {/* Chips de filtros activos. */}
                    {(filters.length > 0 || activeColumnSearches > 0) && (
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            {filters.map((filter) => (
                                <span
                                    key={filter.id}
                                    className="tone-accent inline-flex items-center gap-1.5 rounded-full border border-(--tone-line) bg-(--tone-bg) py-1 pr-1.5 pl-2.5 text-[11px] text-(--tone-fg)"
                                >
                                    <span className="font-medium">
                                        {byKey[filter.column]?.label}
                                    </span>
                                    <span>{describeFilter(filter)}</span>
                                    {/* El de inicio no se quita: quitarlo volvería a él mismo. */}
                                    {!sameFilter(
                                        filter,
                                        initialOf(filter.column),
                                    ) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const start = initialOf(
                                                    filter.column,
                                                );

                                                setFilters((previous) =>
                                                    start
                                                        ? previous.map((other) =>
                                                              other.id ===
                                                              filter.id
                                                                  ? start
                                                                  : other,
                                                          )
                                                        : previous.filter(
                                                              (other) =>
                                                                  other.id !==
                                                                  filter.id,
                                                          ),
                                                );
                                            }}
                                            aria-label="Quitar filtro"
                                            className="cursor-pointer rounded-full p-0.5 hover:bg-surface"
                                        >
                                            <X className="size-[11px]" aria-hidden />
                                        </button>
                                    )}
                                </span>
                            ))}

                            {Object.entries(columnSearch)
                                .filter(([, value]) => value.trim())
                                .map(([key, value]) => (
                                    <span
                                        key={key}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1.5 pl-2.5 text-[11px] text-ink-muted"
                                    >
                                        <Search
                                            className="size-2.5"
                                            aria-hidden
                                        />
                                        <span className="font-medium">
                                            {byKey[key]?.label}
                                        </span>
                                        <span>{value}</span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setColumnSearch((previous) => ({
                                                    ...previous,
                                                    [key]: '',
                                                }))
                                            }
                                            aria-label="Quitar búsqueda de columna"
                                            className="cursor-pointer rounded-full p-0.5 hover:bg-surface-alt"
                                        >
                                            <X className="size-[11px]" aria-hidden />
                                        </button>
                                    </span>
                                ))}

                            {(!atStart || activeColumnSearches > 0) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilters(initial);
                                        setColumnSearch({});
                                    }}
                                    className="ml-auto cursor-pointer text-[11px] font-medium text-ink-muted hover:text-ink"
                                >
                                    Limpiar todo
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Tabla: la cabecera queda pegada arriba del área con scroll. */}
            <div className="hidden overflow-hidden rounded-field border border-line bg-surface shadow-sm sm:block">
                <div
                    ref={bodyRef}
                    className={cn('overflow-auto', scrollClassName)}
                >
                    <table
                        className="w-full border-collapse text-sm"
                        style={{
                            tableLayout: 'fixed',
                            minWidth: minTableWidth,
                        }}
                    >
                        <colgroup>
                            {colTemplate.map((width, index) => (
                                <col key={index} style={{ width }} />
                            ))}
                        </colgroup>

                        <thead>
                            <tr className="text-white">
                                {visible.map((column) => {
                                    const isSorted = sort?.column === column.key;
                                    const isDragged = dragging === column.key;
                                    const isTarget =
                                        dragOver === column.key &&
                                        dragging !== column.key;

                                    return (
                                        <th
                                            key={column.key}
                                            scope="col"
                                            aria-sort={
                                                isSorted
                                                    ? sort?.direction === 'asc'
                                                        ? 'ascending'
                                                        : 'descending'
                                                    : undefined
                                            }
                                            draggable={resizingKey === null}
                                            onDragStart={() =>
                                                setDragging(column.key)
                                            }
                                            onDragEnd={() => {
                                                setDragging(null);
                                                setDragOver(null);
                                            }}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                setDragOver(column.key);
                                            }}
                                            onDrop={() => handleDrop(column.key)}
                                            className={cn(
                                                'group sticky top-0 z-10 overflow-hidden bg-accent px-3 py-1.5',
                                                resizingKey === column.key &&
                                                    'select-none',
                                                isDragged && 'opacity-40',
                                                isTarget && 'bg-accent-hover',
                                            )}
                                        >
                                            {isTarget && (
                                                <span className="absolute inset-y-0 left-0 w-0.5 bg-white" />
                                            )}

                                            <div
                                                className={cn(
                                                    'flex min-w-0 items-center gap-1',
                                                    column.align === 'right' &&
                                                        'justify-end',
                                                )}
                                            >
                                                {/*
                                                  Los controles se esconden cuando
                                                  la columna es angosta y vuelven al
                                                  pasar el mouse: antes se
                                                  desbordaban sobre la columna
                                                  vecina. Los que están en uso
                                                  (orden activo o búsqueda escrita)
                                                  se quedan siempre visibles.
                                                */}
                                                <GripVertical
                                                    className="hidden size-[13px] shrink-0 cursor-grab text-white/60 group-hover:inline-block hover:text-white active:cursor-grabbing"
                                                    aria-hidden
                                                />

                                                <span className="min-w-0 truncate text-[11px] font-semibold tracking-wider uppercase">
                                                    {column.label}
                                                </span>

                                                {column.sortable !== false && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            toggleSort(column.key)
                                                        }
                                                        aria-label={`Ordenar por ${column.label}`}
                                                        className={cn(
                                                            'shrink-0 cursor-pointer rounded p-0.5 hover:text-white',
                                                            isSorted
                                                                ? 'text-white'
                                                                : 'hidden text-white/60 group-hover:block',
                                                        )}
                                                    >
                                                        {isSorted &&
                                                        sort?.direction ===
                                                            'asc' ? (
                                                            <ArrowUp
                                                                className="size-[13px]"
                                                                aria-hidden
                                                            />
                                                        ) : isSorted ? (
                                                            <ArrowDown
                                                                className="size-[13px]"
                                                                aria-hidden
                                                            />
                                                        ) : (
                                                            <ChevronsUpDown
                                                                className="size-[13px]"
                                                                aria-hidden
                                                            />
                                                        )}
                                                    </button>
                                                )}

                                                {column.searchable !== false && (
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            const th =
                                                                event.currentTarget.closest(
                                                                    'th',
                                                                );

                                                            if (!th) {
                                                                return;
                                                            }

                                                            setOpenSearch(
                                                                (current) =>
                                                                    current?.key ===
                                                                    column.key
                                                                        ? null
                                                                        : {
                                                                              key: column.key,
                                                                              anchor: th,
                                                                          },
                                                            );
                                                        }}
                                                        aria-label={`Buscar en ${column.label}`}
                                                        className={cn(
                                                            'shrink-0 cursor-pointer rounded p-0.5 hover:text-white',
                                                            columnSearch[
                                                                column.key
                                                            ]?.trim()
                                                                ? 'text-white'
                                                                : 'hidden text-white/60 group-hover:block',
                                                        )}
                                                    >
                                                        <Search
                                                            className="size-[13px]"
                                                            aria-hidden
                                                        />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Tirador para agrandar o reducir la columna. */}
                                            <span
                                                role="separator"
                                                aria-orientation="vertical"
                                                aria-label={`Redimensionar ${column.label}`}
                                                onMouseDown={(event) =>
                                                    startResize(event, column.key)
                                                }
                                                onDoubleClick={() =>
                                                    resetWidth(column.key)
                                                }
                                                onDragStart={(event) =>
                                                    event.preventDefault()
                                                }
                                                className={cn(
                                                    'absolute top-0 right-0 z-10 flex h-full w-2 cursor-col-resize items-center justify-center',
                                                    'after:h-1/2 after:w-0.5 after:rounded-full after:bg-white',
                                                    resizingKey === column.key
                                                        ? 'after:opacity-100'
                                                        : 'after:opacity-40 hover:after:opacity-100',
                                                )}
                                            />
                                        </th>
                                    );
                                })}

                                {/* Columna fija: no se mueve, no se oculta ni se ordena. */}
                                {actions && (
                                    <th
                                        scope="col"
                                        className="sticky top-0 z-10 bg-accent px-3 py-1.5 text-center text-[11px] font-semibold tracking-wider whitespace-nowrap uppercase"
                                    >
                                        Acciones
                                    </th>
                                )}
                            </tr>
                        </thead>

                        <tbody>
                            {loading &&
                                Array.from({ length: SKELETON_ROWS }, (_, index) => (
                                    <tr
                                        key={`skeleton-${index}`}
                                        className="border-b border-line"
                                        aria-hidden
                                    >
                                        {visible.map((column) => (
                                            <td
                                                key={column.key}
                                                className="px-3 py-2.5"
                                            >
                                                <span className="block h-3 w-3/4 rounded-field bg-line" />
                                            </td>
                                        ))}
                                        {actions && (
                                            <td className="px-3 py-2.5">
                                                <span className="mx-auto block h-3 w-1/2 rounded-field bg-line" />
                                            </td>
                                        )}
                                    </tr>
                                ))}

                            {isEmpty && (
                                <MessageRow colSpan={colSpan}>{empty}</MessageRow>
                            )}

                            {!loading &&
                                rows.map((row) => (
                                    <tr
                                        key={String(
                                            (row as Record<string, unknown>)[
                                                rowKey
                                            ],
                                        )}
                                        onClick={
                                            onRowClick
                                                ? () => onRowClick(row)
                                                : undefined
                                        }
                                        onKeyDown={
                                            onRowClick
                                                ? (event) => {
                                                      if (
                                                          event.key === 'Enter' &&
                                                          event.target ===
                                                              event.currentTarget
                                                      ) {
                                                          onRowClick(row);
                                                      }
                                                  }
                                                : undefined
                                        }
                                        tabIndex={onRowClick ? 0 : undefined}
                                        className={cn(
                                            'border-b border-line last:border-b-0 hover:bg-accent-soft',
                                            onRowClick && 'cursor-pointer',
                                        )}
                                    >
                                        {visible.map((column) => (
                                            <td
                                                key={column.key}
                                                className={cn(
                                                    // Con `table-fixed` el contenido no puede
                                                    // ensanchar la columna: lo que no cabe se recorta.
                                                    'truncate px-3 py-1.5 text-ink',
                                                    column.align === 'right' &&
                                                        'text-right tabular-nums',
                                                )}
                                            >
                                                {cellContent(column, row)}
                                            </td>
                                        ))}

                                        {actions && (
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                                                <div
                                                    className="flex items-center justify-center gap-1"
                                                    onClick={(event) =>
                                                        event.stopPropagation()
                                                    }
                                                    onKeyDown={(event) =>
                                                        event.stopPropagation()
                                                    }
                                                >
                                                    {actions(row)}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}

                            {loadingMore && (
                                <MessageRow colSpan={colSpan}>
                                    Cargando más…
                                </MessageRow>
                            )}

                            {error && (
                                <MessageRow colSpan={colSpan}>
                                    <ErrorMessage
                                        message={error}
                                        onRetry={onRetry}
                                    />
                                </MessageRow>
                            )}
                        </tbody>
                    </table>

                    {/* Centinela: al hacerse visible pide la siguiente tanda. */}
                    <div ref={tableSentinelRef} className="h-px" aria-hidden />
                </div>
            </div>

            {/* Móvil: cada fila se convierte en una tarjeta. */}
            <div
                ref={cardsRef}
                className={cn('space-y-2 overflow-y-auto sm:hidden', scrollClassName)}
            >
                {loading &&
                    Array.from({ length: 3 }, (_, index) => (
                        <div
                            key={`skeleton-card-${index}`}
                            className="space-y-2 rounded-panel border border-line bg-surface p-3"
                            aria-hidden
                        >
                            <span className="block h-4 w-2/3 rounded-field bg-line" />
                            <span className="block h-3 w-full rounded-field bg-line" />
                            <span className="block h-3 w-5/6 rounded-field bg-line" />
                        </div>
                    ))}

                {isEmpty && (
                    <p className="rounded-panel border border-line bg-surface px-4 py-10 text-center text-sm text-ink-muted">
                        {empty}
                    </p>
                )}

                {!loading &&
                    rows.map((row) => {
                        const [head, ...rest] = visible;

                        return (
                            <div
                                key={String(
                                    (row as Record<string, unknown>)[rowKey],
                                )}
                                onClick={
                                    onRowClick ? () => onRowClick(row) : undefined
                                }
                                onKeyDown={
                                    onRowClick
                                        ? (event) => {
                                              if (
                                                  event.key === 'Enter' &&
                                                  event.target ===
                                                      event.currentTarget
                                              ) {
                                                  onRowClick(row);
                                              }
                                          }
                                        : undefined
                                }
                                role={onRowClick ? 'button' : undefined}
                                tabIndex={onRowClick ? 0 : undefined}
                                className={cn(
                                    'rounded-panel border border-line bg-surface p-3 shadow-sm',
                                    onRowClick &&
                                        'cursor-pointer active:bg-accent-soft',
                                )}
                            >
                                {head && (
                                    <div className="mb-2.5 flex items-start justify-between gap-2">
                                        {/* La etiqueta al costado y no encima: en la tarjeta cada
                                            dato es una fila de "nombre — valor", y la cabecera no
                                            tiene por qué leerse distinto del resto. */}
                                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                            {head.cardLabel && (
                                                <span className="shrink-0 text-[12px] text-ink-muted">
                                                    {head.label}
                                                </span>
                                            )}
                                            <div className="flex min-w-0 items-center gap-2">
                                                {CardIcon && (
                                                    <CardIcon
                                                        size={16}
                                                        className="shrink-0 text-accent"
                                                        aria-hidden={true}
                                                    />
                                                )}
                                                <p className="truncate text-sm font-semibold text-ink">
                                                    {cellContent(head, row)}
                                                </p>
                                            </div>
                                        </div>
                                        {actions && (
                                            <div
                                                className="flex shrink-0 items-center gap-1"
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
                                                onKeyDown={(event) =>
                                                    event.stopPropagation()
                                                }
                                            >
                                                {actions(row)}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <dl className="space-y-1.5">
                                    {rest.map((column) => {
                                        const value = cellContent(column, row);
                                        const isBlank =
                                            value === null ||
                                            value === undefined ||
                                            value === '';

                                        return (
                                            <div
                                                key={column.key}
                                                className="flex items-center justify-between gap-3"
                                            >
                                                <dt className="shrink-0 text-[12px] text-ink-muted">
                                                    {column.label}
                                                </dt>
                                                <dd className="min-w-0 truncate text-right text-[12px] text-ink">
                                                    {isBlank ? (
                                                        <span className="text-ink-soft">
                                                            —
                                                        </span>
                                                    ) : (
                                                        value
                                                    )}
                                                </dd>
                                            </div>
                                        );
                                    })}
                                </dl>
                            </div>
                        );
                    })}

                {loadingMore && (
                    <p className="px-4 py-3 text-center text-[12px] text-ink-muted">
                        Cargando más…
                    </p>
                )}

                {error && (
                    <div className="rounded-panel border border-line bg-surface px-4 py-6 text-center text-sm">
                        <ErrorMessage message={error} onRetry={onRetry} />
                    </div>
                )}

                <div ref={cardsSentinelRef} className="h-px" aria-hidden />
            </div>

            {/* Buscador de columna: fuera del árbol de la tabla para que nada lo recorte. */}
            {openSearch && byKey[openSearch.key] && (
                <ColumnSearchPopover
                    key={openSearch.key}
                    column={byKey[openSearch.key]}
                    anchor={openSearch.anchor}
                    value={columnSearch[openSearch.key] ?? ''}
                    onChange={(value) =>
                        setColumnSearch((previous) => ({
                            ...previous,
                            [openSearch.key]: value,
                        }))
                    }
                    onClose={() => setOpenSearch(null)}
                />
            )}

            {footer && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-muted">
                    <span>
                        {loading
                            ? 'Cargando…'
                            : rows.length === 0
                              ? 'Sin registros'
                              : `${rows.length} ${rows.length === 1 ? 'fila cargada' : 'filas cargadas'}`}
                        {hasMore && ' · Hay más'}
                    </span>

                    {/* Alternativa por teclado al scroll infinito. */}
                    {hasMore && (
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            loading={loadingMore}
                            disabled={loading || Boolean(error)}
                            onClick={loadMore}
                        >
                            Cargar más
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

/* ------------------------- mensajes dentro de la tabla ---------------------- */

function MessageRow({
    colSpan,
    children,
}: {
    colSpan: number;
    children: ReactNode;
}) {
    return (
        <tr>
            <td
                colSpan={colSpan}
                className="px-4 py-6 text-center text-sm text-ink-muted"
            >
                {children}
            </td>
        </tr>
    );
}

function ErrorMessage({
    message,
    onRetry,
}: {
    message: string;
    onRetry?: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-2">
            <p role="alert" className="text-danger">
                {message}
            </p>
            {onRetry && (
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={onRetry}
                >
                    Reintentar
                </Button>
            )}
        </div>
    );
}

/* ----------------------- buscador flotante de columna ----------------------- */

/** Ventana bajo la celda de cabecera, en coordenadas de pantalla. */
function placePopover(anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(224, window.innerWidth - 32);

    return {
        top: rect.bottom + 4,
        // Si la columna está pegada al borde derecho, se alinea hacia dentro.
        left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
    };
}

function ColumnSearchPopover<T>({
    column,
    anchor,
    value,
    onChange,
    onClose,
}: {
    column: DataTableColumn<T>;
    /** Celda de cabecera bajo la que se coloca la ventana. */
    anchor: HTMLElement;
    value: string;
    onChange: (value: string) => void;
    onClose: () => void;
}) {
    const ref = useDismiss(onClose);
    const inputRef = useRef<HTMLInputElement>(null);
    const [position, setPosition] = useState(() => placePopover(anchor));

    // Se pinta con position:fixed en coordenadas de pantalla, calculadas desde
    // la celda. Así flota sobre la tabla en vez de quedar recortado por el
    // área con scroll, y sigue a la celda si la ventana o la tabla se mueven.
    useEffect(() => {
        const place = () => setPosition(placePopover(anchor));

        inputRef.current?.focus();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);

        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [anchor]);

    return createPortal(
        <div
            ref={ref}
            data-floating-panel
            style={{ top: position.top, left: position.left }}
            className="fixed z-50 w-[min(14rem,calc(100vw-2rem))] rounded-field border border-line bg-surface p-2 shadow-panel"
        >
            <div
                className={cn(
                    'flex items-center gap-2 rounded-field border border-line bg-surface px-2',
                    'focus-within:border-ink-muted',
                    FIELD_HEIGHT.sm,
                )}
            >
                <Search
                    className="size-[13px] shrink-0 text-ink-muted"
                    aria-hidden
                />
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && onClose()}
                    placeholder={`Buscar ${column.label.toLowerCase()}`}
                    aria-label={`Buscar en ${column.label}`}
                    className="min-w-0 flex-1 border-none bg-transparent text-[12px] font-normal tracking-normal text-ink normal-case outline-none placeholder:text-ink-soft"
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        aria-label="Limpiar"
                        className="shrink-0 cursor-pointer rounded p-0.5 text-ink-soft hover:text-ink"
                    >
                        <X className="size-3" aria-hidden />
                    </button>
                )}
            </div>
        </div>,
        document.getElementById('modal-root') ?? document.body,
    );
}

/* ---------------------------- menú de columnas ---------------------------- */

function ColumnsButton<T>({
    order,
    byKey,
    hidden,
    onToggle,
    onShowAll,
    open,
    onOpen,
    onClose,
}: {
    order: string[];
    byKey: Record<string, DataTableColumn<T>>;
    hidden: string[];
    onToggle: (key: string) => void;
    onShowAll: () => void;
    open: boolean;
    onOpen: () => void;
    onClose: () => void;
}) {
    const ref = useDismiss(() => open && onClose());

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={onOpen}
                aria-expanded={open}
                aria-label="Mostrar u ocultar columnas"
                title="Columnas"
                className={cn(
                    'relative flex size-(--height-field-sm) cursor-pointer items-center justify-center rounded-field',
                    'text-accent-ink hover:bg-accent-soft',
                    open && 'bg-accent-soft',
                )}
            >
                <Eye className="size-[17px]" aria-hidden />
                {hidden.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-surface">
                        {hidden.length}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 z-30 mt-2 w-[min(15rem,calc(100vw-2rem))] rounded-field border border-line bg-surface shadow-panel">
                    <div className="flex items-center justify-between border-b border-line px-3 py-2">
                        <p className="text-[12px] font-semibold text-ink">
                            Mostrar columnas
                        </p>
                        <button
                            type="button"
                            onClick={onShowAll}
                            className="cursor-pointer text-[11px] font-medium text-accent-ink hover:underline"
                        >
                            Todas
                        </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-1">
                        {order.map((key) => {
                            const column = byKey[key];

                            if (!column) {
                                return null;
                            }

                            return (
                                <label
                                    key={key}
                                    className="flex cursor-pointer items-center gap-2.5 rounded-field px-2 py-1.5 text-[13px] text-ink hover:bg-surface-alt"
                                >
                                    <input
                                        type="checkbox"
                                        checked={!hidden.includes(key)}
                                        onChange={() => onToggle(key)}
                                        className="size-3.5 accent-accent"
                                    />
                                    <span className="truncate">
                                        {column.label}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                    <p className="border-t border-line px-3 py-2 text-[10px] leading-relaxed text-ink-soft">
                        Arrastra las cabeceras de la tabla para cambiar su orden.
                    </p>
                </div>
            )}
        </div>
    );
}
