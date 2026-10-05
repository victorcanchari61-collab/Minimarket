import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: ComponentProps<'input'>) {
    return (
        <input
            className={cn(
                'h-12 w-full min-w-0 rounded-xl border border-input bg-card px-3 text-base text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:opacity-60 md:text-sm',
                className,
            )}
            {...props}
        />
    );
}
