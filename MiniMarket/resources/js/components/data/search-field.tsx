import { ListFilter, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { FIELD_HEIGHT } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';

export interface SearchFieldOption<T> {
    item: T;
    label: string;
    /** Segunda línea, más chica y gris: documento, código... */
    detail?: string;
    /** Tercer dato, a la derecha: rubro, distrito... */
    note?: string;
}

export interface SearchFieldProps<T> {
    label?: string;
    value: T | null;
    onChange: (value: T | null) => void;
    /** Las opciones, si se tienen todas a mano. Con `search` no hace falta. */
    options?: SearchFieldOption<T>[];
    /**
     * Busca en el servidor lo que se va escribiendo (con una pequeña espera
     * entre teclas), para listas que no conviene traer enteras: el padrón de
     * clientes. Si está, las opciones son lo que devuelve, no `options`.
     */
    search?: (text: string) => Promise<SearchFieldOption<T>[]>;
    /**
     * Lo que se muestra para el valor elegido cuando no está entre las
     * opciones a mano: al editar, el cliente del documento, que todavía no
     * salió en ninguna búsqueda.
     */
    selected?: SearchFieldOption<T> | null;
    placeholder?: string;
    optional?: boolean;
    disabled?: boolean;
    error?: string;
    className?: string;
    /** Texto cuando nada coincide. */
    emptyText?: string;
    /**
     * Abre una búsqueda más completa (normalmente un modal con filtros por
     * columna) para cuando escribir dos letras acá no alcanza. Sin esto, el
     * campo solo ofrece el filtro simple.
     */
    onAdvanced?: () => void;
    advancedLabel?: string;
    /**
     * Resalta el campo con el tono de advertencia y pinta el botón de búsqueda
     * avanzada con el color del sistema. Para el buscador que se usa todo el
     * tiempo —el de productos al armar un documento—, que tiene que
     * encontrarse de un vistazo.
     */
    highlighted?: boolean;
}

/** Con menos letras que esto no se pregunta al servidor: se muestra la lista inicial. */
const MIN_SEARCH_CHARS = 2;

/** Sin acentos y en minúsculas: escribir "azucar" debe encontrar "Azúcar". */
const normalize = (s: string) =>
    s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();

/**
 * Campo que se escribe directo, como cualquier input, y filtra una lista de
 * cientos de opciones a medida que se tipea — un proveedor, un cliente.
 *
 * A diferencia de un desplegable (que abre TODAS las opciones y deja buscar
 * adentro), acá el cursor entra al campo mismo: se empieza a escribir sin un
 * clic de más, y la lista aparece filtrada debajo. Se cierra solo al elegir,
 * al perder el foco o con Escape. Con flechas y Enter se elige sin ratón.
 */
export function SearchField<T>({
    label,
    value,
    onChange,
    options = [],
    search,
    selected,
    placeholder = 'Buscar...',
    optional,
    disabled,
    error,
    className,
    highlighted = false,
    emptyText = 'Nada coincide',
    onAdvanced,
    advancedLabel = 'Búsqueda avanzada',
}: SearchFieldProps<T>) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [position, setPosition] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);
    const fieldRef = useRef<HTMLDivElement>(null);
    // Lo último buscado y lo que devolvió: la respuesta lleva su texto para
    // saber si todavía corresponde a lo que hay escrito.
    const [remote, setRemote] = useState<{
        query: string;
        options: SearchFieldOption<T>[];
    } | null>(null);
    const searchRef = useRef(search);

    useEffect(() => {
        searchRef.current = search;
    });

    const debounced = useDebouncedValue(text.trim(), 300);
    const query = debounced.length >= MIN_SEARCH_CHARS ? debounced : '';

    // Con búsqueda en el servidor: se pide lo tipeado cuando se deja de
    // escribir un momento, y una respuesta vieja no pisa a la más nueva.
    useEffect(() => {
        const run = searchRef.current;

        if (!open || !run) {
            return;
        }

        let current = true;

        run(query)
            .then((result) => {
                if (current) {
                    setRemote({ query, options: result });
                }
            })
            .catch(() => {
                if (current) {
                    setRemote({ query, options: [] });
                }
            });

        return () => {
            current = false;
        };
    }, [open, query]);

    const chosen =
        options.find((o) => o.item === value) ??
        remote?.options.find((o) => o.item === value) ??
        (selected && selected.item === value ? selected : undefined);

    // Lo que se ve en el input: mientras se escribe, lo tipeado; si no, el
    // nombre de lo elegido.
    const visibleText = open ? text : (chosen?.label ?? '');

    const term = normalize(text.trim());
    const visible = search
        ? (remote?.options ?? [])
        : term
          ? options.filter((o) =>
                normalize(
                    `${o.label} ${o.detail ?? ''} ${o.note ?? ''}`,
                ).includes(term),
            )
          : options;
    const searching = Boolean(search) && open && remote?.query !== query;
    const lastIndex = visible.length - 1;
    const active = Math.min(activeIndex, lastIndex);

    // La lista es `fixed` y se mide contra el campo: si la página o el modal
    // se desplazan, hay que volver a medir para que no quede flotando.
    useEffect(() => {
        if (!open) {
            return;
        }

        const place = () => {
            const rect = fieldRef.current?.getBoundingClientRect();

            if (rect) {
                setPosition({
                    top: rect.bottom + 6,
                    left: rect.left,
                    width: rect.width,
                });
            }
        };

        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);

        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open]);

    // Con flechas, la opción activa tiene que quedar a la vista dentro de la lista.
    useEffect(() => {
        if (open) {
            document
                .getElementById(`${id}-option-${active}`)
                ?.scrollIntoView({ block: 'nearest' });
        }
    }, [open, active, id]);

    const close = () => {
        setOpen(false);
        setText('');
    };

    const choose = (option: SearchFieldOption<T>) => {
        onChange(option.item);
        close();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape' && open) {
            // Si el campo vive dentro de un modal, Escape cierra solo la lista.
            event.stopPropagation();
            close();
        } else if (event.key === 'ArrowDown' && visible.length > 0) {
            event.preventDefault();
            setActiveIndex(Math.min(active + 1, lastIndex));
        } else if (event.key === 'ArrowUp' && visible.length > 0) {
            event.preventDefault();
            setActiveIndex(Math.max(active - 1, 0));
        } else if (event.key === 'Enter' && open && visible[active]) {
            event.preventDefault();
            choose(visible[active]);
        }
    };

    return (
        <div className={cn('w-full', className)} ref={fieldRef}>
            {label && (
                <div className="mb-1.5 flex min-h-5 items-center gap-2">
                    <label htmlFor={id} className="ui-label truncate">
                        {label}
                        {optional && (
                            <span className="ml-1.5 font-normal text-ink-soft">
                                (opcional)
                            </span>
                        )}
                    </label>
                </div>
            )}

            <div
                className={cn(
                    'flex items-center gap-2 rounded-field border px-3',
                    FIELD_HEIGHT.md,
                    highlighted
                        ? 'tone-warning bg-(--tone-bg) pr-1 focus-within:border-(--tone-solid)'
                        : 'bg-surface focus-within:border-ink-soft',
                    error
                        ? 'border-danger'
                        : highlighted
                          ? 'border-(--tone-line)'
                          : 'border-line',
                )}
            >
                <Search
                    size={15}
                    aria-hidden
                    className={cn(
                        'shrink-0',
                        highlighted ? 'text-(--tone-solid)' : 'text-ink-soft',
                    )}
                />
                <input
                    id={id}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={`${id}-list`}
                    aria-autocomplete="list"
                    aria-invalid={Boolean(error)}
                    disabled={disabled}
                    value={visibleText}
                    placeholder={placeholder}
                    onFocus={(event) => {
                        const rect = fieldRef.current?.getBoundingClientRect();

                        if (rect) {
                            setPosition({
                                top: rect.bottom + 6,
                                left: rect.left,
                                width: rect.width,
                            });
                        }

                        setOpen(true);
                        setText('');
                        setActiveIndex(0);
                        event.currentTarget.select();
                    }}
                    onBlur={close}
                    onChange={(event) => {
                        setText(event.target.value);
                        setActiveIndex(0);
                    }}
                    onKeyDown={onKeyDown}
                    className="min-w-0 flex-1 border-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
                />
                {onAdvanced && (
                    <button
                        type="button"
                        onClick={onAdvanced}
                        aria-label={advancedLabel}
                        title={advancedLabel}
                        className={cn(
                            'shrink-0 cursor-pointer',
                            highlighted
                                ? 'flex size-8 items-center justify-center rounded-field bg-accent text-white hover:bg-accent-hover'
                                : 'text-ink-soft hover:text-accent',
                        )}
                    >
                        <ListFilter size={16} />
                    </button>
                )}
            </div>

            {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}

            {open &&
                position &&
                createPortal(
                    /*
                      La lista se monta fuera del campo (en #modal-root, para
                      heredar el color del sistema abierto) y no puede quitarle
                      el foco al input: con mousedown prevenido, elegir una
                      opción no dispara el blur que cierra la lista antes de
                      que llegue el clic.
                    */
                    <div
                        id={`${id}-list`}
                        role="listbox"
                        data-floating-panel
                        onMouseDown={(event) => event.preventDefault()}
                        style={{
                            top: position.top,
                            left: position.left,
                            width: position.width,
                        }}
                        className="fixed z-60 max-h-64 overflow-y-auto rounded-panel bg-surface py-1 shadow-panel ring-1 ring-line"
                    >
                        {visible.length === 0 ? (
                            <p className="px-3 py-4 text-center text-xs text-ink-soft">
                                {searching ? 'Buscando…' : emptyText}
                            </p>
                        ) : (
                            visible.map((option, index) => (
                                <div
                                    key={index}
                                    id={`${id}-option-${index}`}
                                    role="option"
                                    aria-selected={option.item === value}
                                    onClick={() => choose(option)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={cn(
                                        'flex cursor-pointer items-center justify-between gap-3 px-3 py-2',
                                        index === active && 'bg-surface-alt',
                                        option.item === value &&
                                            'bg-accent-soft',
                                    )}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-[13px] text-ink">
                                            {option.label}
                                        </span>
                                        {option.detail && (
                                            <span className="block truncate text-[11px] text-ink-soft">
                                                {option.detail}
                                            </span>
                                        )}
                                    </span>
                                    {option.note && (
                                        <span className="shrink-0 text-[12px] font-medium text-ink-muted">
                                            {option.note}
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>,
                    document.getElementById('modal-root') ?? document.body,
                )}
        </div>
    );
}
