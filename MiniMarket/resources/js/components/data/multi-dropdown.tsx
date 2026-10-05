import type { ReactNode } from 'react';
import type { DropdownOption } from '@/components/data/dropdown';
import { ListDropdown } from '@/components/data/list-dropdown';
import type { FieldSize } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface MultiDropdownProps {
    label?: string;
    /** Los valores marcados, en el orden en que se marcaron. */
    value: Array<number | string>;
    options: DropdownOption[];
    onChange: (value: Array<number | string>) => void;
    /** Texto cuando no hay nada marcado. */
    placeholder?: string;
    optional?: boolean;
    /** Widget a la derecha de la etiqueta. */
    hint?: ReactNode;
    error?: string;
    disabled?: boolean;
    size?: FieldSize;
    className?: string;
}

/**
 * Campo para elegir VARIOS de una lista.
 *
 * Hermano de [Dropdown]: mismo borde, misma altura y la misma lista con
 * buscador, pero cada opción se marca y se desmarca sin cerrar el panel, para
 * poder elegir de corrido. El botón cerrado dice qué hay marcado: los nombres
 * si caben ("Vendedor, Almacenero") o cuántos son.
 *
 * El orden importa cuando quien lo usa lo necesita (el primer rol es el
 * principal): se conserva el orden en que se fueron marcando.
 */
export function MultiDropdown({
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
}: MultiDropdownProps) {
    const checked = value
        .map((v) => options.find((option) => option.value === v))
        .filter((option): option is DropdownOption => option !== undefined);

    const summary =
        checked.length === 0
            ? placeholder
            : checked.length <= 2
              ? checked.map((option) => option.label).join(', ')
              : `${checked.length} elegidos`;

    const toggle = (v: number | string) =>
        onChange(
            value.includes(v) ? value.filter((x) => x !== v) : [...value, v],
        );

    return (
        <div className={cn('w-full', className)}>
            {(label || hint) && (
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
                summary={summary}
                selectedIds={value}
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
                        : () => toggle(option.value),
                }))}
                className={cn(checked.length === 0 && 'text-ink-soft')}
            />

            {/* Lo marcado, legible aunque el botón solo diga "3 elegidos". */}
            {checked.length > 2 && (
                <p className="mt-1.5 text-xs text-ink-soft">
                    {checked.map((option) => option.label).join(', ')}
                </p>
            )}

            {error && (
                <p role="alert" className="mt-1.5 text-xs text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}
