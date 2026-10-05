import { TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Tarjeta de indicador.
 *
 * El icono es obligatorio a propósito: en una fila de tres o cuatro tarjetas el
 * ojo se guía por la forma antes que por el texto, y una sin icono rompe el
 * ritmo de la fila.
 */

export type StatTone =
    | 'accent'
    | 'neutral'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info';

export interface StatCardProps {
    label: string;
    value: string;
    /** Obligatorio: toda tarjeta lleva icono. */
    icon: ReactNode;
    tone?: StatTone;
    /** Variación respecto al periodo anterior, p. ej. 12.4 o -3.1. */
    trend?: number;
    /** Aclaración corta bajo el número. */
    hint?: string;
    className?: string;
}

export function StatCard({
    label,
    value,
    icon,
    tone = 'accent',
    trend,
    hint,
    className,
}: StatCardProps) {
    const rises = (trend ?? 0) >= 0;

    return (
        <div
            className={cn(
                `tone-${tone}`,
                'relative flex items-start gap-3 overflow-hidden rounded-panel border border-line bg-white p-4',
                // En la fila desplazable de móvil cada tarjeta conserva un
                // ancho legible; en la grilla de escritorio se reparte.
                'w-[62%] shrink-0 snap-start sm:w-auto sm:shrink',
                className,
            )}
        >
            {/* Franja de color: da identidad sin llenar la tarjeta de fondo. */}
            <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1 bg-(--tone-solid)"
            />

            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-field bg-(--tone-bg) text-(--tone-fg)">
                {icon}
            </span>

            <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink-muted">
                    {label}
                </p>

                <p className="mt-0.5 text-2xl leading-none font-extrabold tracking-tight text-ink tabular-nums">
                    {value}
                </p>

                {(trend !== undefined || hint) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        {trend !== undefined && (
                            <span
                                className={cn(
                                    rises ? 'tone-success' : 'tone-danger',
                                    'inline-flex items-center gap-1 rounded-full bg-(--tone-bg) px-1.5 py-0.5 font-semibold text-(--tone-fg)',
                                )}
                            >
                                {rises ? (
                                    <TrendingUp className="size-3" aria-hidden />
                                ) : (
                                    <TrendingDown className="size-3" aria-hidden />
                                )}
                                {rises ? '+' : ''}
                                {trend}%
                            </span>
                        )}
                        {hint && (
                            <span className="truncate text-ink-soft">{hint}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
