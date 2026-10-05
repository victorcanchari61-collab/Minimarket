import { Filter, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DataTableColumn } from '@/components/data/data-table';
import type {
    DataTableFilter,
    FilterType,
} from '@/components/data/data-table-filters';
import { FilterField } from '@/components/data/filter-field';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

/**
 * Botón de "Filtros" de `DataTable`: abre un `Modal` (con su fondo oscuro y su
 * cierre con Escape/clic afuera; reimplementar eso a mano hacía que un clic
 * dentro de un desplegable o del calendario del rango de fechas cerrara el
 * panel entero).
 *
 * El panel es el MISMO en cualquier tamaño: todos los filtros a la vista, uno
 * por columna, con Restablecer y Aplicar.
 *
 * El operador no se elige: lo decide el tipo de la columna (rango para fechas,
 * igualdad para listas, contiene para texto), que es lo que se quiere el 99%
 * de las veces y una decisión menos que tomar.
 *
 * Qué control pintar según `filterType` lo resuelve `FilterField`.
 */
export interface FiltersButtonProps<T> {
    columns: DataTableColumn<T>[];
    filters: DataTableFilter[];
    setFilters: Dispatch<SetStateAction<DataTableFilter[]>>;
    /** Con los que arranca la tabla: Restablecer vuelve a estos. */
    initialFilters?: DataTableFilter[];
    open: boolean;
    onToggle: () => void;
    onClose: () => void;
}

export function FiltersButton<T>({
    columns,
    filters,
    setFilters,
    initialFilters = [],
    open,
    onToggle,
    onClose,
}: FiltersButtonProps<T>) {
    const filterable = columns.filter((column) => column.filterable !== false);

    return (
        <>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-label="Filtros"
                title="Filtros"
                className={cn(
                    'relative flex size-(--height-field-sm) cursor-pointer items-center justify-center rounded-field',
                    'text-accent-ink hover:bg-accent-soft',
                    open && 'bg-accent-soft',
                )}
            >
                <Filter className="size-[17px]" aria-hidden />
                {filters.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-surface">
                        {filters.length}
                    </span>
                )}
            </button>

            {/* Centrado en móvil (hoja inferior), pegado a la derecha y centrado
                verticalmente en escritorio: nunca colgando de donde haya
                quedado el botón en la pantalla. */}
            <Modal
                open={open}
                title="Filtros"
                onClose={onClose}
                size="sm"
                className="sm:justify-end sm:pr-10"
            >
                <div className="flex flex-col gap-4">
                    <FiltersPanel
                        filterable={filterable}
                        filters={filters}
                        setFilters={setFilters}
                        initialFilters={initialFilters}
                        onClose={onClose}
                    />
                </div>
            </Modal>
        </>
    );
}

type Draft = Record<string, { value: string; valueTo: string }>;

function toDraft(filters: DataTableFilter[]): Draft {
    const draft: Draft = {};

    for (const filter of filters) {
        draft[filter.column] = {
            value: filter.value,
            valueTo: filter.valueTo ?? '',
        };
    }

    return draft;
}

function FiltersPanel<T>({
    filterable,
    filters,
    setFilters,
    initialFilters,
    onClose,
}: {
    filterable: DataTableColumn<T>[];
    filters: DataTableFilter[];
    setFilters: Dispatch<SetStateAction<DataTableFilter[]>>;
    initialFilters: DataTableFilter[];
    onClose: () => void;
}) {
    // El Modal no monta su contenido cerrado, así que el borrador se arma de
    // nuevo cada vez que se abre, a partir de lo ya aplicado.
    const [draft, setDraft] = useState<Draft>(() => toDraft(filters));

    const setValue = (key: string, field: 'value' | 'valueTo', value: string) =>
        setDraft((previous) => ({
            ...previous,
            [key]: {
                value: previous[key]?.value ?? '',
                valueTo: previous[key]?.valueTo ?? '',
                [field]: value,
            },
        }));

    const apply = () => {
        const next: DataTableFilter[] = [];

        for (const column of filterable) {
            const entry = draft[column.key];

            if (!entry) {
                continue;
            }

            const type: FilterType = column.filterType ?? 'text';

            if (type === 'date') {
                if (entry.value || entry.valueTo) {
                    next.push({
                        id: column.key,
                        column: column.key,
                        operator: 'between',
                        value: entry.value,
                        valueTo: entry.valueTo,
                    });
                }
            } else if (entry.value.trim()) {
                next.push({
                    id: column.key,
                    column: column.key,
                    operator: type === 'select' ? 'equals' : 'contains',
                    value: entry.value,
                });
            }
        }

        // Un filtro de inicio que se dejó vacío vuelve a su valor: la vista lo
        // aplica igual, y así se sigue viendo cuál es.
        for (const initial of initialFilters) {
            if (!next.some((filter) => filter.column === initial.column)) {
                next.push(initial);
            }
        }

        setFilters(next);
        onClose();
    };

    const reset = () => {
        setDraft(toDraft(initialFilters));
        setFilters(initialFilters);
    };

    return (
        <>
            <div className="flex flex-col gap-3.5">
                {filterable.map((column) => {
                    const type: FilterType = column.filterType ?? 'text';
                    const entry = draft[column.key] ?? {
                        value: '',
                        valueTo: '',
                    };

                    return (
                        <div key={column.key} className="flex flex-col gap-1">
                            <p className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                                {column.label}
                            </p>
                            <FilterField
                                type={type}
                                options={column.filterOptions}
                                value={entry.value}
                                valueTo={entry.valueTo}
                                onChange={(value) =>
                                    setValue(column.key, 'value', value)
                                }
                                onChangeTo={(value) =>
                                    setValue(column.key, 'valueTo', value)
                                }
                                onEnter={apply}
                                textPlaceholder={`Buscar ${column.label.toLowerCase()}...`}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center gap-2 border-t border-line pt-3">
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={reset}
                >
                    <RotateCcw className="size-[13px]" aria-hidden />
                    Restablecer
                </Button>
                <Button
                    type="button"
                    size="sm"
                    onClick={apply}
                    className="flex-1"
                >
                    Aplicar filtros
                </Button>
            </div>
        </>
    );
}
