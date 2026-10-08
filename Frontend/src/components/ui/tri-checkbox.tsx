import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TriState = 'checked' | 'unchecked' | 'mixed';

export interface TriCheckboxProps {
    state: TriState;
    label: string;
    onChange: () => void;
    disabled?: boolean;
    className?: string;
    labelClassName?: string;
}

/**
 * Casilla de tres estados: marcada, vacía o parcial ("algunos de los de
 * adentro"). La parcial sirve para un padre cuyos hijos están marcados a medias.
 */
export function TriCheckbox({
    state,
    label,
    onChange,
    disabled,
    className,
    labelClassName,
}: TriCheckboxProps) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={state === 'mixed' ? 'mixed' : state === 'checked'}
            disabled={disabled}
            onClick={onChange}
            className={cn(
                'group inline-flex items-center gap-2 text-left text-sm text-ink-muted outline-none',
                'disabled:cursor-not-allowed disabled:opacity-70',
                className,
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    'inline-flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border',
                    'group-focus-visible:ring-4 group-focus-visible:ring-accent-ring',
                    state === 'unchecked'
                        ? 'border-line-strong text-transparent'
                        : 'border-accent bg-accent text-white',
                )}
            >
                {state === 'mixed' ? (
                    <Minus className="size-3" strokeWidth={3.5} />
                ) : (
                    <Check className="size-3" strokeWidth={3.5} />
                )}
            </span>
            <span className={labelClassName}>{label}</span>
        </button>
    );
}
