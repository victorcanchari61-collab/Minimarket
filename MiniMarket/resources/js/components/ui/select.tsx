import type { ReactNode, SelectHTMLAttributes } from 'react';
import { useId } from 'react';
import { FIELD_HEIGHT } from '@/components/ui/input';
import type { FieldSize } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface SelectProps extends Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    'size'
> {
    label?: string;
    /** sm 36px (tablas) · md 40px (formularios) · lg 48px. */
    size?: FieldSize;
    error?: string;
    /** Marca "(opcional)" junto a la etiqueta. */
    optional?: boolean;
    hint?: ReactNode;
    className?: string;
    children: ReactNode;
}

/**
 * Desplegable del sistema, hermano de Input: misma altura, mismo borde y el
 * mismo foco sobrio. Sin esto cada vista copiaba una cadena larga de clases y
 * bastaba con que una quedara vieja para que el formulario se viera dispar.
 */
export function Select({
    label,
    size = 'md',
    error,
    optional,
    hint,
    className,
    children,
    ...rest
}: SelectProps) {
    const id = useId();

    return (
        <div className={cn('w-full', className)}>
            {(label || hint) && (
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    {label && (
                        <label className="ui-label" htmlFor={id}>
                            {label}
                            {optional && (
                                <span className="ml-1.5 font-normal text-ink-muted">
                                    (opcional)
                                </span>
                            )}
                        </label>
                    )}
                    {hint}
                </div>
            )}

            <select
                id={id}
                aria-invalid={Boolean(error)}
                className={cn(
                    'w-full cursor-pointer rounded-field border bg-surface px-3 text-ink outline-none',
                    'focus:border-ink-muted',
                    FIELD_HEIGHT[size],
                    size === 'sm' ? 'text-[13px]' : 'text-sm',
                    error ? 'border-danger' : 'border-line',
                )}
                {...rest}
            >
                {children}
            </select>

            {error && (
                <p role="alert" className="mt-1.5 text-xs text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}
