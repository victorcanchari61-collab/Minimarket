import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
    id: string;
    label: string;
    icon?: ReactNode;
    /** Número al costado: cuántos registros tiene la pestaña. */
    badge?: number;
}

export interface TabsProps {
    items: TabItem[];
    active: string;
    onChange: (id: string) => void;
    className?: string;
}

/**
 * Pestañas de una vista.
 *
 * Se usan cuando varias tablas pequeñas pertenecen al mismo tema y no merecen
 * una entrada propia en el menú.
 */
export function Tabs({ items, active, onChange, className }: TabsProps) {
    return (
        <div
            role="tablist"
            className={cn(
                // Se desliza en móvil: cuatro pestañas no entran en 390px.
                'no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0',
                className,
            )}
        >
            {items.map((item) => {
                const isActive = item.id === active;

                return (
                    <button
                        key={item.id}
                        role="tab"
                        type="button"
                        aria-selected={isActive}
                        onClick={() => onChange(item.id)}
                        className={cn(
                            'relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm whitespace-nowrap',
                            isActive
                                ? 'font-semibold text-accent-ink'
                                : 'text-ink-muted hover:text-ink',
                        )}
                    >
                        {item.icon}
                        {item.label}
                        {item.badge !== undefined && (
                            <span
                                className={cn(
                                    'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                                    isActive
                                        ? 'bg-accent-soft text-accent-ink'
                                        : 'bg-surface-alt text-ink-muted',
                                )}
                            >
                                {item.badge}
                            </span>
                        )}

                        {/* La línea inferior marca la activa sin mover el texto. */}
                        {isActive && (
                            <span
                                aria-hidden="true"
                                className="absolute inset-x-0 -bottom-px h-0.5 bg-accent"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
