import type { LucideIcon } from 'lucide-react';

const GRADIENT_ID = 'system-icon-gradient';

/**
 * Degradado del tema del sistema para el trazo de los iconos. Se monta una
 * sola vez dentro del contenedor con data-system; las coordenadas en espacio
 * de usuario (viewBox 24×24 de lucide) evitan que los trazos rectos, sin alto
 * ni ancho, queden sin pintar.
 */
export function IconGradientDefs() {
    return (
        <svg
            width="0"
            height="0"
            aria-hidden
            focusable="false"
            className="pointer-events-none absolute"
        >
            <defs>
                <linearGradient
                    id={GRADIENT_ID}
                    gradientUnits="userSpaceOnUse"
                    x1="3"
                    y1="3"
                    x2="21"
                    y2="21"
                >
                    <stop offset="0" style={{ stopColor: 'var(--icon-a)' }} />
                    <stop offset="1" style={{ stopColor: 'var(--icon-b)' }} />
                </linearGradient>
            </defs>
        </svg>
    );
}

export default function ThemedIcon({
    icon: Icon,
    className,
}: {
    icon: LucideIcon;
    className?: string;
}) {
    return (
        <Icon
            className={className}
            stroke={`url(#${GRADIENT_ID})`}
            aria-hidden
        />
    );
}
