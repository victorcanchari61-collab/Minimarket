import type { ReactNode } from 'react';

/**
 * Tipos y utilidades puras del sistema de filtros de `DataTable`.
 *
 * Vive separado de `data-table.tsx` y de `filters-button.tsx` porque no le
 * pertenece a ninguno de los dos: la tabla lo usa para armar la consulta
 * (`DataTableFilter`, `describeFilter` para el chip) y el panel de filtros lo
 * usa para armar el formulario (`FilterType`, `OPERATORS`). Sin este archivo,
 * cualquiera de los dos tendría que importar del otro.
 */

export const OPERATORS = [
    { id: 'contains', label: 'contiene' },
    { id: 'equals', label: 'es igual a' },
    { id: 'between', label: 'entre' },
] as const;

export type OperatorId = (typeof OPERATORS)[number]['id'];

/**
 * Cómo se arma el filtro de una columna en el panel de "Filtros":
 *
 *   'text' (por defecto): operador "contiene" + un input libre.
 *   'select': un único operador ("es igual a") con una lista de
 *      `filterOptions`, para columnas de estado/categoría/tipo: no tiene
 *      sentido "contiene" sobre un enum.
 *   'date': un rango Desde/Hasta, para que filtrar por fecha no dependa de
 *      escribir una fecha a mano.
 *
 * La tabla no filtra nada en memoria: solo avisa el filtro y el servidor lo
 * aplica.
 */
export type FilterType = 'text' | 'select' | 'date';

export interface DataTableFilter {
    id: string;
    column: string;
    operator: OperatorId;
    value: string;
    /** Solo para operator: 'between', el extremo superior del rango. */
    valueTo?: string;
}

/** yyyy-mm-dd del calendario, mostrado como se lee aquí: 27/09/2026. */
function formatDay(iso: string): string {
    return /^\d{4}-\d{2}-\d{2}$/.test(iso)
        ? iso.split('-').reverse().join('/')
        : iso;
}

/** Texto legible de lo que compara un filtro, para el chip. */
export function describeFilter(filter: DataTableFilter): ReactNode {
    if (filter.operator === 'between') {
        const { value, valueTo } = filter;

        if (value && valueTo && value === valueTo) {
            return <b>{formatDay(value)}</b>;
        }

        if (value && valueTo) {
            return (
                <>
                    <b>{formatDay(value)}</b> — <b>{formatDay(valueTo)}</b>
                </>
            );
        }

        return (
            <b>
                {value
                    ? `desde ${formatDay(value)}`
                    : `hasta ${formatDay(valueTo ?? '')}`}
            </b>
        );
    }

    return (
        <>
            <span className="text-ink-muted">
                {
                    OPERATORS.find(
                        (operator) => operator.id === filter.operator,
                    )?.label
                }
            </span>{' '}
            <b>{filter.value}</b>
        </>
    );
}
