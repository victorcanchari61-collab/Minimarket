import type { ReactNode } from 'react';
import type { StatTone } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';

export interface ShareCardProps {
    label: string;
    /** Obligatorio, igual que en StatCard: en una fila de cards el ojo se guía por la forma. */
    icon: ReactNode;
    /** Cuántos son. `undefined` mientras llega el dato. */
    value: number | undefined;
    /** El total del que forman parte. Con él se calcula la barra y el porcentaje. */
    total: number | undefined;
    tone?: StatTone;
    className?: string;
}

/**
 * Indicador con proporción: el número y una barra fina que muestra qué parte
 * del total es. Para conteos que son parte de un todo (activos, inactivos,
 * sin rol…); para un valor suelto (ventas del día) sigue siendo StatCard.
 */
export function ShareCard({
    label,
    icon,
    value,
    total,
    tone = 'accent',
    className,
}: ShareCardProps) {
    const known = value !== undefined && total !== undefined;
    const share = known && total > 0 ? value / total : 0;
    // Un valor mayor que cero siempre deja ver su trazo, aunque sea 1 de 5000.
    const width = known && value > 0 ? Math.max(share * 100, 3) : 0;

    return (
        <div
            className={cn(
                `tone-${tone}`,
                'rounded-panel border border-line bg-white p-4',
                // Misma lógica que StatCard: en móvil se desliza, en escritorio se reparte.
                'w-[62%] shrink-0 snap-start sm:w-auto sm:shrink',
                className,
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink-muted">
                        {label}
                    </p>

                    <p className="mt-0.5 text-2xl leading-none font-extrabold tracking-tight text-ink tabular-nums">
                        {known ? value : '—'}
                    </p>
                </div>

                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-field bg-(--tone-bg) text-(--tone-fg)">
                    {icon}
                </span>
            </div>

            <div
                role="presentation"
                className="mt-3 h-1 overflow-hidden rounded-full bg-(--tone-bg)"
            >
                <div
                    className="h-full rounded-full bg-(--tone-solid) transition-[width] duration-500 ease-out"
                    style={{ width: `${width}%` }}
                />
            </div>

            <p className="mt-1.5 text-xs text-ink-soft">
                {known ? `${Math.round(share * 100)}% del total` : '—'}
            </p>
        </div>
    );
}
