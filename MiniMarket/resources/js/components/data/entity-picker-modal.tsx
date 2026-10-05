import { DataTable } from '@/components/data/data-table';
import type { DataTableProps } from '@/components/data/data-table';
import { Modal } from '@/components/ui/modal';

export interface EntityPickerModalProps<T> extends Omit<
    DataTableProps<T>,
    'actions' | 'onRowClick'
> {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    /** Se llama con la fila elegida; el modal se cierra solo después. */
    onSelect: (row: T) => void;
}

/**
 * Búsqueda avanzada: elegir uno de una lista larga con los filtros por
 * columna, orden y buscador general de `DataTable`, dentro de un modal.
 *
 * Complementa a un campo de búsqueda rápida (escribir dos letras y elegir);
 * este es para cuando esa búsqueda simple no alcanza y hace falta filtrar por
 * varias columnas a la vez. Se elige haciendo clic en la fila entera.
 *
 * Como la tabla se monta junto con el modal, su `onQuery` se dispara al
 * abrirlo: la vista pide la primera tanda en ese momento.
 */
export function EntityPickerModal<T>({
    open,
    onClose,
    title,
    description,
    onSelect,
    // El modal ya limita su alto: la tabla deja menos sitio para el scroll.
    scrollClassName = 'max-h-[50vh]',
    ...table
}: EntityPickerModalProps<T>) {
    return (
        <Modal
            open={open}
            title={title}
            description={description}
            onClose={onClose}
            size="lg"
        >
            <DataTable
                {...table}
                scrollClassName={scrollClassName}
                onRowClick={(row) => {
                    onSelect(row);
                    onClose();
                }}
            />
        </Modal>
    );
}
