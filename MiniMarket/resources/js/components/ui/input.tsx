import { Eye, EyeOff } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Campo de texto del sistema.
 *
 * Es el ÚNICO lugar donde se define cómo se ve un input: altura, borde y foco.
 * Cambiar algo aquí lo cambia en todas las pantallas; las alturas salen de los
 * tokens --height-field-* de app.css.
 */

/** sm 36px (tablas y barras) · md 40px (formularios) · lg 48px (login). */
export type FieldSize = 'sm' | 'md' | 'lg';

export const FIELD_HEIGHT: Record<FieldSize, string> = {
    sm: 'h-[var(--height-field-sm)]',
    md: 'h-[var(--height-field-md)]',
    lg: 'h-[var(--height-field-lg)]',
};

const FIELD_TEXT: Record<FieldSize, string> = {
    sm: 'text-[13px]',
    md: 'text-sm',
    lg: 'text-base',
};

export interface InputProps extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'size'
> {
    label?: string;
    /** Contenido a la derecha de la etiqueta (un enlace de ayuda, un botón "+"). */
    hint?: ReactNode;
    error?: string;
    icon?: ReactNode;
    /** Muestra el botón ver/ocultar cuando type="password". */
    revealable?: boolean;
    /** Añade "(opcional)" junto a la etiqueta, en gris y sin negrita. */
    optional?: boolean;
    size?: FieldSize;
}

export function Input({
    label,
    hint,
    error,
    icon,
    revealable = false,
    optional = false,
    size = 'md',
    type = 'text',
    id,
    className,
    ...rest
}: InputProps) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const [visible, setVisible] = useState(false);
    const resolvedType =
        revealable && type === 'password' && visible ? 'text' : type;

    return (
        <div className={cn('w-full', className)}>
            {(label || hint) && (
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    {label && (
                        <label className="ui-label" htmlFor={inputId}>
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

            {/*
              Foco sobrio: solo se oscurece el borde, sin anillo de color. La
              altura es fija y el borde mantiene 1px, así que el campo no
              cambia de tamaño al enfocarlo.
            */}
            <div
                className={cn(
                    'flex items-center gap-2 rounded-field border bg-surface px-3',
                    FIELD_HEIGHT[size],
                    'focus-within:border-ink-muted',
                    error ? 'border-danger' : 'border-line',
                )}
            >
                {icon && (
                    <span className="shrink-0 text-ink-muted [&_svg]:size-[18px]">
                        {icon}
                    </span>
                )}
                <input
                    id={inputId}
                    type={resolvedType}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    className={cn(
                        'min-w-0 flex-1 border-none bg-transparent text-ink outline-none placeholder:text-ink-soft',
                        FIELD_TEXT[size],
                    )}
                    {...rest}
                />
                {revealable && type === 'password' && (
                    <button
                        type="button"
                        onClick={() => setVisible((value) => !value)}
                        aria-label={
                            visible ? 'Ocultar contraseña' : 'Mostrar contraseña'
                        }
                        className="cursor-pointer rounded p-1 text-ink-muted hover:text-accent-ink"
                    >
                        {visible ? (
                            <EyeOff className="size-[18px]" aria-hidden />
                        ) : (
                            <Eye className="size-[18px]" aria-hidden />
                        )}
                    </button>
                )}
            </div>

            {error && (
                <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}
