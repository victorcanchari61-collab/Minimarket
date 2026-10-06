import { Check } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type'
> {
    label: string;
}

export function Checkbox({ label, className, ...rest }: CheckboxProps) {
    return (
        <label
            className={cn(
                'inline-flex cursor-pointer items-center gap-2 text-sm text-ink-muted',
                className,
            )}
        >
            <input type="checkbox" className="peer sr-only" {...rest} />
            <span
                aria-hidden="true"
                className={cn(
                    'inline-flex size-[18px] shrink-0 items-center justify-center rounded-[6px]',
                    'border border-line-strong text-transparent',
                    'peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white',
                    'peer-focus-visible:ring-4 peer-focus-visible:ring-accent-ring',
                )}
            >
                <Check className="size-3" strokeWidth={3.5} />
            </span>
            <span>{label}</span>
        </label>
    );
}
