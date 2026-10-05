import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Significado de la acción. Cada uno tiene SU color, igual en todos los
 * sistemas: eliminar es rojo en Inventario, en POS y en RR. HH.
 */
export type RowActionTone =
    | 'view'
    | 'edit'
    | 'danger'
    | 'success'
    | 'warning'
    | 'neutral';

const TONES: Record<RowActionTone, string> = {
    /** Ver detalle. */
    view: 'tone-info text-(--tone-fg) hover:bg-(--tone-bg)',
    /** Editar: el acento del sistema. */
    edit: 'tone-accent text-(--tone-fg) hover:bg-(--tone-bg)',
    /** Anular / eliminar. */
    danger: 'tone-danger text-(--tone-fg) hover:bg-(--tone-bg)',
    /** Confirmar / recibir. */
    success: 'tone-success text-(--tone-fg) hover:bg-(--tone-bg)',
    /** Devolver y otras acciones intermedias. */
    warning: 'tone-warning text-(--tone-fg) hover:bg-(--tone-bg)',
    neutral: 'tone-neutral text-(--tone-fg) hover:bg-(--tone-bg)',
};

export interface RowActionProps {
    /** Texto del tooltip y de la etiqueta accesible. */
    label: string;
    onClick?: () => void;
    tone?: RowActionTone;
    disabled?: boolean;
    /**
     * Motivo por el que la acción no está disponible. Se muestra al pasar el
     * mouse: un botón que desaparece no explica nada, uno apagado con su razón
     * sí.
     */
    disabledReason?: string;
    children: ReactNode;
    className?: string;
}

/**
 * Botón de icono de la columna Acciones.
 *
 * Los colores son FIJOS por significado (salvo "editar", que toma el acento):
 * así el usuario reconoce "eliminar" por su rojo en cualquier pantalla.
 */
export function RowAction({
    label,
    onClick,
    tone = 'edit',
    disabled = false,
    disabledReason,
    children,
    className,
}: RowActionProps) {
    return (
        <button
            type="button"
            title={disabled ? (disabledReason ?? label) : label}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                'rounded-md p-1.5',
                disabled
                    ? 'cursor-not-allowed text-line-strong'
                    : cn('cursor-pointer', TONES[tone]),
                className,
            )}
        >
            {children}
        </button>
    );
}
