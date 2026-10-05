import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'outline';

const VARIANTS: Record<Variant, string> = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-black/[0.03]',
};

export function Button({
    className,
    variant = 'default',
    type = 'button',
    ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
    return (
        <button
            type={type}
            className={cn(
                'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[background-color,box-shadow,transform] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0',
                VARIANTS[variant],
                className,
            )}
            {...props}
        />
    );
}
