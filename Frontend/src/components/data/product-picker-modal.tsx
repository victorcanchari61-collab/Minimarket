import { Package, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Dropdown } from '@/components/data/dropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { initialPresentation, presentationOptions } from '@/lib/presentations';
import type { PresentationUsage, UsableProduct } from '@/lib/presentations';
import { cn } from '@/lib/utils';

/** Lo mínimo de un producto que este buscador necesita para funcionar. */
export interface PickableProduct extends UsableProduct {
    id: number;
    code: string;
    name: string;
    brand?: string | null;
    category?: string | null;
    /** Stock disponible en unidad base: se pinta junto a la unidad elegida. */
    stock?: number | null;
    /**
     * Lo que ya apartan pedidos pendientes, en unidad base. Solo informa: junto
     * al stock aparece "5 reservados" para que quien vende esté atento, pero no
     * bloquea nada.
     */
    reserved?: number;
}

/** Una elección del buscador: el producto, la presentación y la cantidad marcada. */
export interface ProductSelection<T extends PickableProduct = PickableProduct> {
    product: T;
    /** 0 = unidad base. */
    presentationId: number;
    quantity: number;
}

/** Una página de resultados con paginación por cursor: sin totales ni números de página. */
export interface ProductPage<T extends PickableProduct = PickableProduct> {
    data: T[];
    nextCursor: string | null;
}

export interface ProductPickerModalProps<
    T extends PickableProduct = PickableProduct,
> {
    open: boolean;
    onClose: () => void;
    /**
     * Pide una página de productos. Sin cursor es la primera; con el
     * `nextCursor` de la anterior, la siguiente. `search` llega vacío cuando
     * no hay búsqueda (menos de 2 letras).
     */
    fetchProducts: (search: string, cursor?: string) => Promise<ProductPage<T>>;
    /** Para qué se arma la línea: decide qué unidades se ofrecen (ver `presentationOptions`). */
    usage?: PresentationUsage;
    /** Se llama una sola vez con todo lo marcado al pulsar "Agregar". */
    onAdd: (selections: ProductSelection<T>[]) => void;
}

/** Con menos letras que esto no se busca: se muestra la lista sin filtrar. */
const MIN_SEARCH_CHARS = 2;

/** Lo último cargado, con el texto con el que se pidió. */
interface Results<T> {
    search: string;
    items: T[];
    nextCursor: string | null;
    failed: boolean;
}

/**
 * Un campo con la etiqueta recortando su borde.
 *
 * El Input y el Dropdown del sistema ponen la etiqueta ENCIMA, que en un
 * formulario está bien pero dentro de una fila de lista suma una línea de alto
 * a cada producto marcado. Aquí la etiqueta se monta sobre el borde y el campo
 * ocupa una sola altura.
 */
function LabeledField({
    label,
    className,
    children,
}: {
    label: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn('relative', className)}>
            <span className="absolute -top-2 left-2.5 z-10 bg-surface px-1 text-[11px] font-medium text-ink-soft">
                {label}
            </span>
            {children}
        </div>
    );
}

/** Stock convertido a la unidad elegida, con dos decimales como mucho. */
const inUnit = (base: number, factor: number) =>
    Number((base / factor).toFixed(2));

/**
 * Buscar productos en una lista de tarjetas marcables — se eligen varios a la
 * vez (cada uno con su unidad y cantidad) y se agregan todos juntos, en vez de
 * abrir el buscador una vez por producto.
 *
 * Los productos llegan de `fetchProducts` de a 20 con cursor: al llegar al
 * final de la lista se piden los 20 siguientes. Lo marcado se conserva aunque
 * cambie la búsqueda.
 */
export function ProductPickerModal<T extends PickableProduct = PickableProduct>(
    props: ProductPickerModalProps<T>,
) {
    // El contenido solo existe mientras el modal está abierto: así cada
    // apertura arranca limpia (sin búsqueda ni marcas) sin efectos de reinicio.
    return props.open ? <ProductPickerContent {...props} /> : null;
}

function ProductPickerContent<T extends PickableProduct>({
    onClose,
    fetchProducts,
    usage,
    onAdd,
}: ProductPickerModalProps<T>) {
    const [text, setText] = useState('');
    const debouncedText = useDebouncedValue(text.trim(), 300);
    const search =
        debouncedText.length >= MIN_SEARCH_CHARS ? debouncedText : '';

    const [results, setResults] = useState<Results<T> | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [moreFailed, setMoreFailed] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const fetchRef = useRef(fetchProducts);

    /** Marcados, en el orden en que se marcaron. Se guarda el producto entero: la búsqueda cambia y la lista con ella. */
    const [picked, setPicked] = useState<T[]>([]);
    /** Unidad elegida por fila: { [productId]: presentationId } — 0 = unidad base. */
    const [units, setUnits] = useState<Record<number, number>>({});
    /** Cantidad escrita por fila: { [productId]: '3' } */
    const [quantities, setQuantities] = useState<Record<number, string>>({});

    useEffect(() => {
        fetchRef.current = fetchProducts;
    });

    // Primera página de cada búsqueda. Una respuesta vieja no pisa a la nueva.
    useEffect(() => {
        let current = true;

        fetchRef
            .current(search)
            .then((page) => {
                if (current) {
                    setResults({
                        search,
                        items: page.data,
                        nextCursor: page.nextCursor,
                        failed: false,
                    });
                    setMoreFailed(false);
                }
            })
            .catch(() => {
                if (current) {
                    setResults({
                        search,
                        items: [],
                        nextCursor: null,
                        failed: true,
                    });
                }
            });

        return () => {
            current = false;
        };
    }, [search]);

    // Hasta que llega la primera página de la búsqueda actual se sigue
    // mostrando la anterior, para que la lista no parpadee al escribir.
    const searching = results === null || results.search !== search;
    const items = results?.items ?? [];

    const loadMore = () => {
        if (!results?.nextCursor || loadingMore || searching) {
            return;
        }

        const { search: forSearch, nextCursor } = results;

        setLoadingMore(true);
        fetchRef
            .current(forSearch, nextCursor)
            .then((page) =>
                setResults((prev) => {
                    if (!prev || prev.search !== forSearch) {
                        return prev;
                    }

                    // El cursor puede traer de nuevo alguno ya cargado.
                    const known = new Set(prev.items.map((p) => p.id));

                    return {
                        ...prev,
                        items: [
                            ...prev.items,
                            ...page.data.filter((p) => !known.has(p.id)),
                        ],
                        nextCursor: page.nextCursor,
                    };
                }),
            )
            .catch(() => setMoreFailed(true))
            .finally(() => setLoadingMore(false));
    };

    // Un fallo detiene la carga automática: si no, el centinela volvería a
    // pedir sin parar. Se reintenta con el botón.
    const sentinelRef = useInfiniteScroll({
        hasMore: Boolean(results?.nextCursor) && !moreFailed,
        loading: loadingMore || searching,
        onLoadMore: loadMore,
        root: listRef,
    });

    /** La unidad con la que arranca cada fila: la base si se puede usar, si no la primera que sí. */
    const initialUnit = (product: PickableProduct) =>
        initialPresentation(product, usage) ?? 0;

    const selections: ProductSelection<T>[] = picked.map((product) => ({
        product,
        presentationId: units[product.id] ?? initialUnit(product),
        quantity: Number(quantities[product.id] ?? '1') || 1,
    }));

    const isPicked = (product: T) => picked.some((p) => p.id === product.id);

    const toggle = (product: T) =>
        setPicked((prev) =>
            prev.some((p) => p.id === product.id)
                ? prev.filter((p) => p.id !== product.id)
                : [...prev, product],
        );

    /** Escribir una cantidad marca la fila automáticamente. */
    const setQuantity = (product: T, value: string) => {
        setQuantities((prev) => ({ ...prev, [product.id]: value }));
        setPicked((prev) =>
            prev.some((p) => p.id === product.id) ? prev : [...prev, product],
        );
    };

    const confirm = () => {
        const useful = selections.filter((s) => s.quantity > 0);

        if (useful.length === 0) {
            return;
        }

        onAdd(useful);
        onClose();
    };

    return (
        <Modal
            open
            onClose={onClose}
            title="Buscar producto"
            description="Busca por nombre o código; marca los productos y ajusta unidad y cantidad."
            size="lg"
            footer={
                <>
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cerrar
                    </Button>
                    <Button
                        size="sm"
                        onClick={confirm}
                        disabled={selections.length === 0}
                    >
                        Agregar
                        {selections.length > 0 ? ` (${selections.length})` : ''}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    <Input
                        autoFocus
                        icon={<Search />}
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        placeholder="Nombre, código, marca..."
                        aria-label="Buscar producto"
                    />

                    {/* Estado de la búsqueda y cuántos llevas marcados, justo sobre la lista. */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-ink-soft">
                            {searching
                                ? 'Buscando…'
                                : `${items.length} producto${items.length === 1 ? '' : 's'}${results?.nextCursor ? ' o más' : ''}`}
                        </span>
                        {selections.length > 0 && (
                            <span className="text-xs font-semibold text-accent">
                                {selections.length} seleccionado
                                {selections.length === 1 ? '' : 's'}
                            </span>
                        )}
                    </div>
                </div>

                {results?.failed && !searching ? (
                    <div className="flex flex-col items-center gap-2 py-14 text-center">
                        <Package size={28} className="text-ink-soft" />
                        <p className="text-sm text-danger">
                            No se pudieron cargar los productos.
                        </p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-14 text-center">
                        <Package size={28} className="text-ink-soft" />
                        <p className="text-sm text-ink-soft">
                            {searching
                                ? 'Buscando…'
                                : 'Ningún producto coincide con la búsqueda.'}
                        </p>
                    </div>
                ) : (
                    <div
                        ref={listRef}
                        className="flex max-h-[22rem] flex-col gap-2 overflow-x-hidden overflow-y-auto p-0.5"
                    >
                        {items.map((p) => {
                            // `stock` es lo disponible; lo que hay en el almacén es eso más lo apartado.
                            const available = p.stock ?? null;
                            const reserved = p.reserved ?? 0;
                            const inWarehouse =
                                available != null ? available + reserved : null;
                            const marked = isPicked(p);

                            // El stock se lee en la unidad elegida, que por defecto es la más grande: "10 Saco 50KG"
                            // dice más que "500 KG" a quien vende por saco.
                            const unitOptions = presentationOptions(p, usage);
                            const chosenUnit = units[p.id] ?? initialUnit(p);
                            const chosenFactor =
                                unitOptions.find((o) => o.value === chosenUnit)
                                    ?.factor ?? 1;

                            return (
                                <div
                                    key={p.id}
                                    onClick={() => toggle(p)}
                                    className={cn(
                                        'cursor-pointer rounded-field border px-3 py-2.5',
                                        marked
                                            ? 'border-accent bg-accent-soft'
                                            : 'border-line bg-surface hover:border-line-strong',
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={marked}
                                            onChange={() => toggle(p)}
                                            onClick={(e) => e.stopPropagation()}
                                            aria-label={`Seleccionar ${p.name}`}
                                            className="size-4 shrink-0 cursor-pointer accent-accent"
                                        />

                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-ink">
                                                {p.name}
                                            </span>
                                            <span className="block truncate text-xs text-ink-soft">
                                                {p.code}
                                                {p.brand && ` · ${p.brand}`}
                                                {p.category &&
                                                    ` · ${p.category}`}
                                            </span>
                                        </span>

                                        {inWarehouse != null && (
                                            <div
                                                className="flex w-44 shrink-0 flex-col items-stretch gap-0.5"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                {/* Cada opción muestra el stock convertido a esa unidad; elegirla también deja
                                                    esa unidad para la línea, así lo que se ve y lo que se pide coinciden. */}
                                                <Dropdown
                                                    size="sm"
                                                    value={chosenUnit}
                                                    onChange={(v) =>
                                                        setUnits((prev) => ({
                                                            ...prev,
                                                            [p.id]: Number(v),
                                                        }))
                                                    }
                                                    options={unitOptions.map(
                                                        (o) => ({
                                                            value: o.value,
                                                            label: `${inUnit(inWarehouse, o.factor)} ${o.label}`,
                                                        }),
                                                    )}
                                                    className={cn(
                                                        available! <= 0 &&
                                                            'text-danger',
                                                    )}
                                                />

                                                {reserved > 0 ? (
                                                    <span
                                                        className="text-right text-[11px] font-medium text-warning"
                                                        title="Lo apartan pedidos pendientes. Es solo informativo: puedes pedir igual."
                                                    >
                                                        {inUnit(
                                                            reserved,
                                                            chosenFactor,
                                                        )}{' '}
                                                        reservados ·{' '}
                                                        {inUnit(
                                                            available!,
                                                            chosenFactor,
                                                        )}{' '}
                                                        libres
                                                    </span>
                                                ) : available! <= 0 ? (
                                                    <span className="text-right text-[11px] font-medium text-danger">
                                                        Sin stock
                                                    </span>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>

                                    {/*
                                      Unidad y cantidad solo en la fila marcada: con cientos de
                                      productos en pantalla, repetirlas en todas alarga la lista
                                      sin que sirvan de nada — son de lo que ya elegiste.
                                    */}
                                    {marked && (
                                        <div
                                            className="mt-2.5 flex items-end gap-2 pl-7"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <LabeledField
                                                label="Unidad"
                                                className="min-w-0 flex-1"
                                            >
                                                <Dropdown
                                                    value={chosenUnit}
                                                    onChange={(v) =>
                                                        setUnits((prev) => ({
                                                            ...prev,
                                                            [p.id]: Number(v),
                                                        }))
                                                    }
                                                    options={unitOptions.map(
                                                        (o) => ({
                                                            value: o.value,
                                                            label: o.label,
                                                        }),
                                                    )}
                                                />
                                            </LabeledField>

                                            <LabeledField
                                                label="Cant."
                                                className="w-24 shrink-0"
                                            >
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.0001"
                                                    value={
                                                        quantities[p.id] ?? '1'
                                                    }
                                                    onChange={(e) =>
                                                        setQuantity(
                                                            p,
                                                            e.target.value,
                                                        )
                                                    }
                                                    aria-label={`Cantidad de ${p.name}`}
                                                />
                                            </LabeledField>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Centinela: al hacerse visible se piden los 20 siguientes. */}
                        <div ref={sentinelRef} className="py-1 text-center">
                            {loadingMore && (
                                <span className="text-xs text-ink-soft">
                                    Cargando más…
                                </span>
                            )}
                            {moreFailed && (
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setMoreFailed(false);
                                    }}
                                >
                                    No se pudo cargar. Reintentar
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
