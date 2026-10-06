import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FIELD_HEIGHT } from '@/components/ui/field-size';
import type { FieldSize } from '@/components/ui/field-size';
import { cn } from '@/lib/utils';

export interface ListDropdownItem {
    id: string | number;
    /** Lo que se lee a la izquierda: el nombre del elemento. */
    label: string;
    /** Dato de la derecha, en gris: una equivalencia, un total. */
    detail?: ReactNode;
    /** Etiqueta corta bajo el nombre, para marcar el elemento principal. */
    note?: string;
    /** Se ve pero no se puede elegir: lo ocupado, lo que ya no aplica. */
    disabled?: boolean;
    onClick?: () => void;
}

export interface ListDropdownProps {
    /** Texto del botón cerrado: "4 presentaciones" o el valor elegido. */
    summary: string;
    items: ListDropdownItem[];
    icon?: ReactNode;
    /** Título dentro del panel. */
    title?: string;
    /** Texto cuando no hay elementos. */
    empty?: string;

    /**
     * pill: para consultar dentro de una celda de tabla.
     * field: para elegir dentro de un formulario, con la altura de un Input.
     */
    variant?: 'pill' | 'field';

    /** Alto del campo, igual que en un Input. Solo aplica a la variante field. */
    size?: FieldSize;

    /** Item elegido: se marca con un check y se cierra el panel al elegir. */
    selected?: string | number;

    /**
     * Varios elegidos: cada uno con su check, y el panel NO se cierra al
     * marcar, para poder elegir de corrido. Es lo que hace `MultiDropdown`.
     */
    selectedIds?: Array<string | number>;

    disabled?: boolean;
    error?: boolean;

    /**
     * Buscador dentro del panel. Por defecto aparece solo cuando hay muchas
     * opciones: con cinco estorba, con veintisiete es la única forma de llegar.
     */
    searchable?: boolean;

    className?: string;
}

interface PanelPosition {
    top: number;
    left: number;
    width: number;
}

/** Dónde se monta el panel flotante (ver `components/ui/modal`). */
const portalTarget = () =>
    document.getElementById('modal-root') ?? document.body;

/** Desde cuántas opciones el buscador aparece solo. */
const SEARCH_THRESHOLD = 8;

/**
 * Lista corta dentro de una celda.
 *
 * Un `select` nativo no sirve aquí: sugiere que se elige algo, y el sistema
 * operativo decide cómo se ve el menú, así que rompe con el resto del panel.
 * Esto es un botón que abre una lista con el diseño del sistema.
 *
 * El panel se pinta con position:fixed en un portal, igual que el buscador de
 * columna, porque la tabla necesita overflow-hidden para sincronizar su
 * cabecera y recortaría cualquier cosa que sobresalga de la celda.
 */
export function ListDropdown({
    summary,
    items,
    icon,
    title,
    empty = 'Sin elementos',
    variant = 'pill',
    size = 'md',
    selected,
    selectedIds,
    disabled,
    error,
    searchable,
    className,
}: ListDropdownProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [pos, setPos] = useState<PanelPosition | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const hasSearch = searchable ?? items.length >= SEARCH_THRESHOLD;
    const isMulti = selectedIds !== undefined;
    const isChecked = (id: string | number) =>
        isMulti ? selectedIds.includes(id) : id === selected;
    const showChecks = isMulti || selected !== undefined;

    // Busca en el nombre y también en el dato de la derecha, que suele ser el
    // código: escribir "KG" tiene que encontrar "Kilogramo".
    const text = query.trim().toLowerCase();
    const visible = text
        ? items.filter((item) =>
              `${item.label} ${item.note ?? ''} ${typeof item.detail === 'string' ? item.detail : ''}`
                  .toLowerCase()
                  .includes(text),
          )
        : items;

    // El filtro no sobrevive al cierre: al volver a abrir se ve la lista
    // completa, que es lo que uno espera.
    const close = useCallback(() => {
        setOpen(false);
        setQuery('');
    }, []);

    const computePosition = useCallback((): PanelPosition | null => {
        const button = buttonRef.current;

        if (!button) {
            return null;
        }

        const rect = button.getBoundingClientRect();
        /*
          De campo, el panel mide lo mismo que el campo: se lee como su
          continuación y no como una ventana suelta.

          Con un mínimo, eso sí: metido en una celda de tabla el campo puede
          quedar en 120 px, y entonces el menú salía tan angosto que todas las
          opciones se leían iguales ("Transferencia ...", "Transferencia ...")
          y no había forma de elegir. El campo sigue truncando; el menú, no.
        */
        const width = variant === 'field' ? Math.max(rect.width, 240) : 260;
        // Alto real del panel: la lista no pasa de max-h-[16rem] y el título
        // ocupa 33px. Estimarlo de más hacía que se abriera hacia arriba sin
        // necesidad, tapando lo que hay encima del campo.
        const height =
            Math.min(items.length * 40 + 8, 256) +
            (title ? 33 : 0) +
            (hasSearch ? 45 : 0);

        // Si no cabe debajo, se abre hacia arriba.
        const fitsBelow = rect.bottom + height < window.innerHeight;

        return {
            top: fitsBelow
                ? rect.bottom + 6
                : Math.max(8, rect.top - height - 6),
            left: Math.min(
                Math.max(8, rect.left),
                window.innerWidth - width - 8,
            ),
            width,
        };
    }, [variant, items.length, title, hasSearch]);

    const toggle = () => {
        if (open) {
            close();

            return;
        }

        /*
          Dentro de un modal con scroll (el panel de Filtros, por ejemplo), un
          campo cerca del borde inferior "no cabe abajo" para la ventana, pero
          sí cabría si el propio panel se desplazara un poco: sin esto se abría
          hacia arriba y tapaba los campos de encima, cuando alcanzaba con
          correr la pantalla. Se centra el campo primero, y recién con eso se
          mide.
        */
        buttonRef.current?.scrollIntoView({
            block: 'center',
            behavior: 'instant',
        });
        setPos(computePosition());
        setOpen(true);
    };

    useEffect(() => {
        if (!open) {
            return;
        }

        const reposition = () => {
            const next = computePosition();

            if (next) {
                setPos(next);
            }
        };

        // Listeners propios y no `useDismiss`: ese hook ignora los clics
        // dentro de un modal, y este panel suele vivir en uno, donde un clic
        // en cualquier otra parte del modal también debe cerrarlo.
        const onOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            if (
                !panelRef.current?.contains(target) &&
                !buttonRef.current?.contains(target)
            ) {
                close();
            }
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                close();
            }
        };

        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        document.addEventListener('mousedown', onOutside);
        document.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
            document.removeEventListener('mousedown', onOutside);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, computePosition, close]);

    /*
      El cursor entra en el buscador al abrir: se abre y se escribe, sin un
      clic más. Va en su propio efecto y no junto al cálculo de posición,
      porque el input todavía no existe cuando aquel corre: el panel se pinta
      recién cuando `pos` deja de ser null. Depende de `placed` y no de `pos`,
      que cambia también al hacer scroll y no hay que robar el foco cada vez.
    */
    const placed = pos !== null;

    useEffect(() => {
        if (open && placed) {
            searchRef.current?.focus();
        }
    }, [open, placed]);

    const isField = variant === 'field';

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                aria-expanded={open}
                aria-haspopup="listbox"
                onClick={(event) => {
                    event.stopPropagation();
                    toggle();
                }}
                className={cn(
                    'flex cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-50',
                    isField &&
                        'w-full justify-between gap-2 rounded-field border bg-surface px-3 text-left text-ink',
                    isField && FIELD_HEIGHT[size],
                    isField && (size === 'sm' ? 'text-[13px]' : 'text-sm'),
                    isField &&
                        (error
                            ? 'border-danger'
                            : open
                              ? 'border-ink-muted'
                              : 'border-line'),

                    !isField &&
                        'inline-flex max-w-full gap-1.5 rounded-full border px-2.5 py-1 text-[12px]',
                    !isField &&
                        (open
                            ? 'border-accent bg-accent-soft text-accent-ink'
                            : 'border-line bg-surface text-ink-muted hover:border-line-strong'),
                    className,
                )}
            >
                <span className="flex min-w-0 items-center gap-1.5">
                    {icon}
                    <span className="truncate">{summary}</span>
                </span>
                <ChevronDown
                    className={cn(
                        'shrink-0 text-ink-soft',
                        isField ? 'size-4' : 'size-[13px]',
                        open && 'rotate-180',
                    )}
                    aria-hidden
                />
            </button>

            {open &&
                pos &&
                createPortal(
                    <div
                        ref={panelRef}
                        data-floating-panel
                        style={{
                            top: pos.top,
                            left: pos.left,
                            width: pos.width,
                        }}
                        className={cn(
                            'fixed z-50 max-w-[calc(100vw-2rem)] overflow-hidden',
                            // rounded-field y no rounded-panel: los 20px del
                            // panel son para un modal grande, y en una lista
                            // de 200 px dejan un marco vacío alrededor de la
                            // única fila. Además así el menú tiene el mismo
                            // radio que el campo del que sale.
                            'rounded-field border border-line bg-surface shadow-panel',
                        )}
                    >
                        {title && (
                            <p className="border-b border-line px-3 py-2 text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                                {title}
                            </p>
                        )}

                        {hasSearch && items.length > 0 && (
                            <div className="relative border-b border-line p-2">
                                <Search
                                    className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-ink-soft"
                                    aria-hidden
                                />
                                <input
                                    ref={searchRef}
                                    value={query}
                                    onChange={(event) =>
                                        setQuery(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        // Enter elige lo único que quedó:
                                        // buscar y confirmar sin levantar la
                                        // mano del teclado.
                                        if (
                                            event.key === 'Enter' &&
                                            visible.length === 1
                                        ) {
                                            visible[0].onClick?.();

                                            if (!isMulti) {
                                                close();
                                            }
                                        }
                                    }}
                                    placeholder="Buscar..."
                                    aria-label="Buscar"
                                    className="w-full rounded-field border border-line bg-surface py-1.5 pr-7 pl-7 text-[13px] text-ink outline-none placeholder:text-ink-soft focus:border-ink-muted"
                                />
                                {query && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQuery('');
                                            searchRef.current?.focus();
                                        }}
                                        aria-label="Limpiar búsqueda"
                                        className="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer rounded p-0.5 text-ink-soft hover:text-ink"
                                    >
                                        <X
                                            className="size-[13px]"
                                            aria-hidden
                                        />
                                    </button>
                                )}
                            </div>
                        )}

                        {items.length === 0 ? (
                            <p className="px-3 py-4 text-center text-xs text-ink-soft">
                                {empty}
                            </p>
                        ) : visible.length === 0 ? (
                            <p className="px-3 py-4 text-center text-xs text-ink-soft">
                                Nada coincide con «{query}»
                            </p>
                        ) : (
                            <ul
                                role="listbox"
                                aria-multiselectable={isMulti || undefined}
                                className="max-h-[16rem] overflow-y-auto py-1"
                            >
                                {visible.map((item) => (
                                    <li key={item.id}>
                                        <div
                                            role={
                                                item.onClick
                                                    ? 'option'
                                                    : undefined
                                            }
                                            aria-selected={isChecked(item.id)}
                                            aria-disabled={
                                                item.disabled || undefined
                                            }
                                            onClick={() => {
                                                item.onClick?.();

                                                // Elegir cierra: en un campo,
                                                // el panel ya cumplió. Con
                                                // varios elegidos no, y lo
                                                // deshabilitado no elige nada,
                                                // así que tampoco cierra.
                                                if (
                                                    selected !== undefined &&
                                                    item.onClick
                                                ) {
                                                    close();
                                                }
                                            }}
                                            className={cn(
                                                'flex items-center justify-between gap-3 px-3 py-2',
                                                item.onClick &&
                                                    'cursor-pointer hover:bg-surface-alt',
                                                item.disabled &&
                                                    'cursor-not-allowed opacity-50',
                                                isChecked(item.id) &&
                                                    'bg-accent-soft',
                                            )}
                                        >
                                            <span className="flex min-w-0 items-center gap-2">
                                                {showChecks && (
                                                    <Check
                                                        className={cn(
                                                            'size-3.5 shrink-0 text-accent-ink',
                                                            !isChecked(
                                                                item.id,
                                                            ) && 'invisible',
                                                        )}
                                                        aria-hidden
                                                    />
                                                )}
                                                <span className="min-w-0">
                                                    <span className="block truncate text-[13px] text-ink">
                                                        {item.label}
                                                    </span>
                                                    {item.note && (
                                                        <span className="block text-[11px] text-ink-soft">
                                                            {item.note}
                                                        </span>
                                                    )}
                                                </span>
                                            </span>
                                            {item.detail && (
                                                <span className="shrink-0 text-[12px] font-medium text-ink-muted">
                                                    {item.detail}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>,
                    // En #modal-root y no en body: así el panel conserva el
                    // acento del sistema abierto (ver components/ui/modal).
                    portalTarget(),
                )}
        </>
    );
}
