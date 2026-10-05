import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Checkbox({
    className,
    ...props
}: Omit<ComponentProps<'input'>, 'type'>) {
    return (
        <input
            type="checkbox"
            className={cn(
                'size-[18px] shrink-0 cursor-pointer rounded-[5px] border-input accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                className,
            )}
            {...props}
        />
    );
}
