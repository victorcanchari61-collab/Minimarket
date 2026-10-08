import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
    id: string;
    label: string;
    /** Icono a la izquierda del texto (de 16 px: `className="size-4"`). */
    icon?: ReactNode;
    /** Número al costado: cuántos registros tiene la pestaña. */
    badge?: number;
}

export interface TabsProps {
    items: TabItem[];
    active: string;
    onChange: (id: string) => void;
    /** Texto para lectores de pantalla: qué es este grupo de pestañas. */
    label?: string;
    className?: string;
}

/**
 * Pestañas de una vista, en forma de cápsula: la activa se rellena con el color
 * del sistema y el resto quedan en reposo. Con ícono y, si hace falta, una
 * cifra (cuántas solicitudes esperan).
 *
 * Se usan cuando varias vistas pequeñas pertenecen al mismo tema y no merecen
 * una entrada propia en el menú. Se navega con las flechas del teclado.
 */
export function Tabs({ items, active, onChange, label, className }: TabsProps) {
    const move = (from: number, step: number) => {
        const next = items[(from + step + items.length) % items.length];

        onChange(next.id);
        document.getElementById(tabId(next.id))?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label={label}
            className={cn(
                // En móvil se desliza: tres pestañas con ícono no entran en 360px.
                'no-scrollbar -mx-4 flex overflow-x-auto px-4 sm:mx-0 sm:px-0',
                className,
            )}
        >
            <div className="inline-flex shrink-0 gap-1 rounded-full border border-line bg-white p-1">
                {items.map((item, index) => {
                    const isActive = item.id === active;

                    return (
                        <button
                            key={item.id}
                            id={tabId(item.id)}
                            role="tab"
                            type="button"
                            aria-selected={isActive}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => onChange(item.id)}
                            onKeyDown={(event) => {
                                if (event.key === 'ArrowRight') {
                                    event.preventDefault();
                                    move(index, 1);
                                } else if (event.key === 'ArrowLeft') {
                                    event.preventDefault();
                                    move(index, -1);
                                }
                            }}
                            className={cn(
                                // Mismo borde que el contenedor: una cápsula dentro de otra.
                                'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap outline-none',
                                'transition-colors focus-visible:ring-4 focus-visible:ring-accent-ring',
                                isActive
                                    ? 'bg-accent text-white shadow-sm'
                                    : 'text-ink-muted hover:bg-surface-alt hover:text-ink',
                            )}
                        >
                            {item.icon}
                            {item.label}
                            {item.badge !== undefined && (
                                <span
                                    className={cn(
                                        'min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] leading-none font-semibold tabular-nums',
                                        isActive
                                            ? 'bg-white/25 text-white'
                                            : 'bg-accent-soft text-accent-ink',
                                    )}
                                >
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

const tabId = (id: string) => `tab-${id}`;
