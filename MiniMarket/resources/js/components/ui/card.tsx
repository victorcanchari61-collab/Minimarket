import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    /** Sin sombra. */
    flat?: boolean;
}

export function Card({
    flat = false,
    className,
    children,
    ...rest
}: CardProps) {
    return (
        <div
            className={cn('ui-surface p-6 sm:p-8', !flat && 'shadow-panel', className)}
            {...rest}
        >
            {children}
        </div>
    );
}
