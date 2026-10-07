import { Link } from 'react-router-dom';
import { useEffect, useId, useRef, useState } from 'react';
import ThemedIcon from '@/components/system/themed-icon';
import { ACTIVE_ROW } from '@/components/system/nav-styles';
import type { NavModule } from '@/lib/navigation';
import { slugify } from '@/lib/navigation';
import { cn } from '@/lib/utils';

type CollapsedModuleProps = {
    entry: NavModule;
    /** Ruta del sistema: /sistemas/erp */
    base: string;
    isActiveModule: boolean;
    activeItem?: string | null;
};

const CLOSE_DELAY_MS = 120;

/**
 * Un módulo con el menú contraído: solo se ve el ícono. Al pasar el mouse (o
 * enfocarlo con el teclado, o tocarlo) se abre a su derecha un panel con los
 * submódulos. Va con `position: fixed` porque la lista del menú recorta lo que
 * se sale de ella.
 */
export default function CollapsedModule({
    entry,
    base,
    isActiveModule,
    activeItem,
}: CollapsedModuleProps) {
    const slug = slugify(entry.label);
    const panelId = useId();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const timer = useRef<number | undefined>(undefined);
    // null = cerrado; si no, dónde está el ícono para anclar el panel.
    const [anchor, setAnchor] = useState<DOMRect | null>(null);

    const open = () => {
        window.clearTimeout(timer.current);

        if (buttonRef.current) {
            setAnchor(buttonRef.current.getBoundingClientRect());
        }
    };

    // Un pequeño margen para que el mouse pueda cruzar del ícono al panel.
    const closeSoon = () => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setAnchor(null), CLOSE_DELAY_MS);
    };

    useEffect(() => () => window.clearTimeout(timer.current), []);

    useEffect(() => {
        if (!anchor) {
            return;
        }

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setAnchor(null);
                buttonRef.current?.focus();
            }
        };

        document.addEventListener('keydown', closeOnEscape);

        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [anchor]);

    return (
        <li
            onMouseEnter={open}
            onMouseLeave={closeSoon}
            onFocus={open}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    closeSoon();
                }
            }}
        >
            <button
                ref={buttonRef}
                type="button"
                onClick={() => (anchor ? setAnchor(null) : open())}
                aria-label={entry.label}
                aria-haspopup="menu"
                aria-expanded={anchor !== null}
                aria-controls={anchor ? panelId : undefined}
                className={cn(
                    'flex w-full items-center justify-center rounded-xl px-2 py-1.5 text-(--text) outline-none hover:bg-black/[0.04] focus-visible:ring-[3px] focus-visible:ring-(--sys-400)',
                    isActiveModule && ACTIVE_ROW,
                    anchor && !isActiveModule && 'bg-black/[0.04]',
                )}
            >
                <span className="grid size-7 shrink-0 place-items-center">
                    <ThemedIcon icon={entry.icon} className="size-[18px]" />
                </span>
            </button>

            {anchor && (
                // El relleno izquierdo es parte del panel: así no hay hueco
                // entre el ícono y el panel al mover el mouse.
                <div
                    id={panelId}
                    role="menu"
                    aria-label={entry.label}
                    className="fixed z-50 flyout-in pl-3"
                    style={{
                        top: Math.max(8, anchor.top - 8),
                        left: anchor.right,
                        maxHeight: `calc(100dvh - ${Math.max(8, anchor.top - 8) + 12}px)`,
                    }}
                >
                    <div className="max-h-[inherit] w-60 overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white p-1.5 shadow-[0_18px_36px_-16px_rgb(16_24_40/0.35)]">
                        <p className="px-3 pt-2 pb-1.5 text-[11px] font-bold tracking-[0.08em] text-(--sys-600) uppercase">
                            {entry.label}
                        </p>

                        <ul className="flex flex-col gap-0.5">
                            {entry.items.map((subItem) => {
                                const itemSlug = slugify(subItem.label);
                                const isActive =
                                    isActiveModule && activeItem === itemSlug;

                                return (
                                    <li key={itemSlug}>
                                        <Link
                                            to={`${base}/${slug}/${itemSlug}`}
                                            role="menuitem"
                                            onClick={() => setAnchor(null)}
                                            aria-current={
                                                isActive ? 'page' : undefined
                                            }
                                            className={cn(
                                                'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] outline-none hover:bg-black/[0.04] focus-visible:bg-black/[0.04]',
                                                isActive
                                                    ? 'bg-[color-mix(in_oklab,var(--grad-start)_9%,white)] font-semibold text-(--sys-600)'
                                                    : 'font-medium text-(--text)',
                                            )}
                                        >
                                            <ThemedIcon
                                                icon={subItem.icon}
                                                className="size-4 shrink-0"
                                            />
                                            <span className="min-w-0 leading-snug">
                                                {subItem.label}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            )}
        </li>
    );
}
