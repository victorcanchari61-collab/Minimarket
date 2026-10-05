import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ModalProps {
    open: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    /** Botones del pie. */
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
    /** Clases extra en el fondo fijo, p. ej. "sm:hidden" para una variante solo móvil. */
    className?: string;
    children: ReactNode;
}

const SIZES = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    '3xl': 'max-w-[90rem]',
};

export function Modal({
    open,
    title,
    description,
    onClose,
    footer,
    size = 'md',
    className,
    children,
}: ModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const previouslyFocused = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);

        return () => {
            document.removeEventListener('keydown', onKey);
            previouslyFocused?.focus();
        };
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    /*
      Se monta en #modal-root y no donde se declara: como hijo de la vista
      heredaba lo que el contenedor dijera de sus hijos (márgenes, overflow,
      z-index) y el fondo oscuro podía quedar corto o recortado. Fuera del
      flujo, inset-0 siempre es la ventana completa.

      #modal-root vive DENTRO del data-system del sistema abierto (lo pone
      SystemLayout), así que la cabecera toma el color de ese sistema. Sin él
      (login) cae a document.body y usa el acento por defecto.
    */
    const target = document.getElementById('modal-root') ?? document.body;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
                'fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4',
                className,
            )}
            onMouseDown={(event) =>
                event.target === event.currentTarget && onClose()
            }
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                className={cn(
                    'flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-panel bg-white shadow-panel outline-none sm:rounded-panel',
                    SIZES[size],
                )}
            >
                <div className="flex items-center justify-between gap-3 bg-accent px-4 py-2.5">
                    <div className="min-w-0 leading-tight">
                        <h2 className="truncate text-sm font-bold text-white">
                            {title}
                        </h2>
                        {description && (
                            <p className="truncate text-[11px] text-white/80">
                                {description}
                            </p>
                        )}
                    </div>

                    {/*
                      La X solo aparece cuando NO hay pie: si el pie ya trae
                      "Cancelar", dos formas de cerrar lo mismo sobran. Escape
                      y el clic fuera cierran en ambos casos.
                    */}
                    {!footer && (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Cerrar"
                            className="cursor-pointer rounded-lg p-1 text-white/80 hover:bg-white/15 hover:text-white"
                        >
                            <X className="size-4" aria-hidden />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

                {footer && (
                    <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        target,
    );
}
