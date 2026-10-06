import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
    title: string;
    description?: string;
    /** Icono a la izquierda del título, con el color del sistema activo. */
    icon?: ReactNode;
    /** Botones a la derecha del título. */
    actions?: ReactNode;
    className?: string;
}

/**
 * Cabecera de la vista: va suelta sobre el fondo gris, antes de las tarjetas.
 * No se pone dentro de la tabla ni de un bloque blanco.
 */
export function PageHeader({
    title,
    description,
    icon,
    actions,
    className,
}: PageHeaderProps) {
    return (
        <div className={cn('flex flex-col gap-2', className)}>
            {/*
              Título y botones SIEMPRE en la misma fila, también en móvil:
              apilados gastaban tres alturas antes del primer dato y empujaban
              la tabla fuera de la pantalla. La descripción baja a su propia
              línea, que es texto de apoyo y puede esperar.
            */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                {/* flex-1 con un mínimo: el título se lleva el ancho sobrante y
                    nunca se recorta a dos letras para dejarle sitio a los botones. */}
                <div className="flex min-w-[7rem] flex-1 items-center gap-3">
                    {icon && (
                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-field bg-accent-soft text-accent-ink">
                            {icon}
                        </span>
                    )}
                    <h1 className="truncate text-xl font-bold tracking-tight text-ink sm:text-2xl">
                        {title}
                    </h1>
                </div>

                {/*
                  Con tres o cuatro botones ni su propia línea alcanza en un
                  teléfono angosto. En vez de partirlos en filas impredecibles,
                  se desliza como una fila propia: se ve que hay más a la
                  derecha y no empuja el título. Desde sm vuelven a compartir
                  la fila del título, envolviendo si hace falta.
                */}
                {actions && (
                    <div
                        className={cn(
                            'no-scrollbar -mx-4 flex w-full shrink-0 snap-x snap-mandatory items-center gap-2 overflow-x-auto px-4 pb-1',
                            '[&>*]:shrink-0',
                            'sm:ml-auto sm:w-auto sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0 sm:pb-0',
                        )}
                    >
                        {actions}
                    </div>
                )}
            </div>

            {description && (
                <p className="text-sm text-ink-muted">{description}</p>
            )}
        </div>
    );
}
