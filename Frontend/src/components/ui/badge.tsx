import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone =
    | 'accent'
    | 'neutral'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info';

export interface BadgeProps {
    tone?: BadgeTone;
    children: ReactNode;
    className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
    return (
        <span
            className={cn(
                `tone-${tone}`,
                'inline-flex items-center rounded-full bg-(--tone-bg) px-2 py-0.5 text-[11px] font-semibold text-(--tone-fg) ring-1 ring-(--tone-line)',
                className,
            )}
        >
            {children}
        </span>
    );
}
