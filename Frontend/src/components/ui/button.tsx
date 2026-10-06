import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ComponentProps<'button'> {
    variant?: Variant;
    size?: Size;
    /** Ocupa todo el ancho disponible. */
    block?: boolean;
    /** Deshabilita el botón mientras corre la acción (el texto lo cambia quien lo usa). */
    loading?: boolean;
    iconRight?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
    primary:
        'bg-accent text-white shadow-sm hover:not-disabled:bg-accent-hover active:not-disabled:bg-accent-hover',
    secondary:
        'bg-surface text-ink border border-line hover:not-disabled:bg-surface-alt',
    ghost: 'bg-transparent text-accent-ink hover:not-disabled:bg-accent-soft',
};

// Mismas alturas que los campos, para que un botón junto a un input calce.
const SIZES: Record<Size, string> = {
    sm: 'h-[var(--height-field-sm)] px-3 text-sm',
    md: 'h-[var(--height-field-md)] px-5 text-sm',
    lg: 'h-[var(--height-field-lg)] px-7 text-base',
};

export function Button({
    variant = 'primary',
    size = 'md',
    block = false,
    loading = false,
    iconRight,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
}: ButtonProps) {
    return (
        <button
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(
                'inline-flex cursor-pointer items-center justify-center gap-2 rounded-field font-semibold',
                'focus-visible:ring-4 focus-visible:ring-accent-ring focus-visible:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-60',
                variant === 'ghost' ? 'px-2 py-1 text-sm' : SIZES[size],
                VARIANTS[variant],
                block && 'w-full',
                className,
            )}
            {...rest}
        >
            {children}
            {iconRight}
        </button>
    );
}
