import type { ReactNode } from 'react';
import { DataTable } from '@/components/data/data-table';
import type { DataTableProps } from '@/components/data/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { StatsRow } from '@/components/ui/stats-row';
import { cn } from '@/lib/utils';

export interface ListPageProps<T> extends Omit<DataTableProps<T>, 'actions'> {
    /** Icono de la cabecera, en pastilla con el color del sistema activo. */
    icon?: ReactNode;
    title: string;
    description?: string;
    /** Botones de la cabecera, normalmente el de crear. */
    actions?: ReactNode;
    /** Tarjetas de indicadores sobre la tabla. */
    stats?: ReactNode;
    /** Aviso o error, arriba de todo. */
    alert?: ReactNode;
    /** Bloque destacado entre los indicadores y la tabla. */
    banner?: ReactNode;
    /** Botones de cada fila (columna Acciones de la tabla). */
    rowActions?: (row: T) => ReactNode;
    /** Nota al pie, bajo la tabla. */
    note?: ReactNode;
    /** Modales y demás piezas sueltas de la vista. */
    children?: ReactNode;
}

/**
 * Vista de listado: cabecera, indicadores y tabla, con el mismo armado en
 * todas las pantallas.
 *
 * Es el ÚNICO lugar donde se decide cómo se compone un listado: qué lleva
 * tarjeta y qué no, cuánto espacio hay entre bloques, dónde van los botones.
 * Un cambio de diseño se hace aquí y lo toman todas las vistas.
 *
 * Lo que no sea de la cabecera se pasa tal cual a DataTable.
 */
export function ListPage<T>({
    icon,
    title,
    description,
    actions,
    stats,
    alert,
    banner,
    rowActions,
    note,
    children,
    className,
    ...table
}: ListPageProps<T>) {
    return (
        <div className={cn('space-y-5', className)}>
            <PageHeader
                icon={icon}
                title={title}
                description={description}
                actions={actions}
            />

            {alert}

            {/* En móvil, una fila que se desliza; desde sm, una grilla. Ver StatsRow. */}
            {stats && <StatsRow>{stats}</StatsRow>}

            {banner}

            {/* La tabla trae su propio borde: no se envuelve en tarjeta. */}
            <div>
                <DataTable {...table} actions={rowActions} />
                {note && (
                    <div className="mt-3 text-xs text-ink-soft">{note}</div>
                )}
            </div>

            {children}
        </div>
    );
}
