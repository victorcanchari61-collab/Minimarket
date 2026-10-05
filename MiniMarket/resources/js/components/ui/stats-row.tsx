import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * La fila de indicadores de arriba de una pantalla.
 *
 * En móvil van en UNA fila que se desliza: apilados uno sobre otro empujaban la
 * tabla fuera de la pantalla y obligaban a hacer scroll antes de ver el primer
 * dato. Desde sm vuelven a ser una grilla. Los márgenes negativos hacen que la
 * fila sangre hasta el borde, para que se note que hay más tarjetas a la
 * derecha.
 */
export function StatsRow({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1',
                // auto-fit: la fila acomoda 3 o 4 tarjetas sin que la vista lo declare.
                'sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] sm:gap-4',
                'sm:overflow-visible sm:px-0 sm:pb-0',
                className,
            )}
        >
            {children}
        </section>
    );
}
