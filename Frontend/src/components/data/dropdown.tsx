import type { ReactNode } from 'react';
import { ListDropdown } from '@/components/data/list-dropdown';
import type { FieldSize } from '@/components/ui/field-size';
import { cn } from '@/lib/utils';

export interface DropdownOption {
    value: number | string;
    label: string;
    /** Dato de la derecha, en gris: una equivalencia, un código. */
    detail?: ReactNode;
    /** Aclaración bajo el nombre. */
    note?: string;
    /** Se ve pero no se puede elegir: un empleado que ya tiene usuario, por ejemplo. */
    disabled?: boolean;
}

export interface DropdownProps {
    label?: string;
    value: number | string;
    options: DropdownOption[];
    onChange: (value: number | string) => void;
    /** Texto cuando no hay nada elegido. */
    placeholder?: string;
    optional?: boolean;
    /** Widget a la derecha de la etiqueta, normalmente un AddButton. */
    hint?: ReactNode;
    error?: string;
    disabled?: boolean;
    /** Alto del campo, igual que en un Input. En una celda de tabla, 'sm'. */
    size?: FieldSize;
    className?: string;
}

/**
 * Campo para elegir de una lista.
 *
 * Reemplaza al `select` nativo, cuyo menú lo dibuja el sistema operativo: se
 * veía distinto en cada máquina y no se parecía al resto del panel. Este abre
 * la misma lista de [ListDropdown], con el ancho del campo, el elegido
 * marcado con un check y el mismo borde y altura que un Input.
 */
export function Dropdown({
    label,
    value,
    options,
    onChange,
    placeholder = 'Elegir',
    optional,
    hint,
    error,
    disabled,
    size = 'md',
    className,
}: DropdownProps) {
    const chosen = options.find((option) => option.value === value);

    return (
        <div className={cn('w-full', className)}>
            {(label || hint) && (
                // items-center y no baseline: si la etiqueta parte en dos
                // líneas, el botón de la derecha se quedaba arriba y
                // descuadraba la fila.
                <div className="mb-1.5 flex min-h-5 items-center justify-between gap-2">
                    {label && (
                        <span className="ui-label truncate">
                            {label}
                            {optional && (
                                <span className="ml-1.5 font-normal text-ink-muted">
                                    (opcional)
                                </span>
                            )}
                        </span>
                    )}
                    {hint}
                </div>
            )}

            <ListDropdown
                variant="field"
                size={size}
                summary={chosen?.label ?? placeholder}
                selected={value}
                disabled={disabled}
                error={Boolean(error)}
                empty="No hay opciones"
                items={options.map((option) => ({
                    id: option.value,
                    label: option.label,
                    detail: option.detail,
                    note: option.note,
                    disabled: option.disabled,
                    onClick: option.disabled
                        ? undefined
                        : () => onChange(option.value),
                }))}
                className={cn(!chosen && 'text-ink-soft')}
            />

            {error && (
                <p role="alert" className="mt-1.5 text-xs text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}
