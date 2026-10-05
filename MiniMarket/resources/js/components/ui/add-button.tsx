import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AddButtonProps {
    /** Qué se va a crear: texto de accesibilidad y tooltip. */
    label: string;
    onClick: () => void;
    className?: string;
}

/**
 * Botón redondo de "+" junto a la etiqueta de un campo.
 *
 * Sirve para crear ahí mismo lo que falta en un desplegable: si al dar de alta
 * un producto no existe la categoría, se crea sin salir del formulario y sin
 * perder lo escrito.
 *
 * Va en el hueco `hint` de Input y Select, a la derecha de la etiqueta.
 */
export function AddButton({ label, onClick, className }: AddButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className={cn(
                'inline-flex size-5 cursor-pointer items-center justify-center rounded-full bg-accent-soft text-accent-ink',
                className,
            )}
        >
            <Plus className="size-[13px]" strokeWidth={2.5} aria-hidden />
        </button>
    );
}
