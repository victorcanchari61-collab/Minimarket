import { Link } from 'react-router-dom';
import {
    ChevronDown,
    ChevronsLeft,
    House,
    PanelLeftClose,
    PanelLeftOpen,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { NavModule } from '@/lib/navigation';
import { slugify } from '@/lib/navigation';
import type { PortalEntry } from '@/lib/systems';
import CollapsedModule from '@/components/system/collapsed-module';
import { ACTIVE_ROW } from '@/components/system/nav-styles';
import ThemedIcon from '@/components/system/themed-icon';
import { cn } from '@/lib/utils';

type SystemSidebarProps = {
    system: PortalEntry;
    nav: NavModule[];
    activeModule?: string | null;
    activeItem?: string | null;
    collapsed: boolean;
    onToggleCollapsed: () => void;
    /** Oculta el menú por completo (en escritorio; se vuelve a abrir desde el encabezado). */
    onHide?: () => void;
    /** Solo en móvil: cierra el panel al elegir una opción. */
    onClose?: () => void;
};

const FOOTER_BUTTON =
    'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-[12.5px] font-medium text-muted-foreground outline-none hover:bg-black/[0.04] hover:text-(--text) focus-visible:ring-[3px] focus-visible:ring-(--sys-400)';

export default function SystemSidebar({
    system,
    nav,
    activeModule,
    activeItem,
    collapsed,
    onToggleCollapsed,
    onHide,
    onClose,
}: SystemSidebarProps) {
    const [open, setOpen] = useState<Set<string>>(
        () => new Set(activeModule ? [activeModule] : []),
    );

    // Al navegar a otro módulo se abre solo; el usuario puede cerrarlo después.
    const [previousModule, setPreviousModule] = useState(activeModule);

    if (previousModule !== activeModule) {
        setPreviousModule(activeModule);

        if (activeModule) {
            setOpen((current) => new Set(current).add(activeModule));
        }
    }

    const toggleModule = (slug: string) => {
        setOpen((current) => {
            const next = new Set(current);

            if (!next.delete(slug)) {
                next.add(slug);
            }

            return next;
        });
    };

    const base = `/sistemas/${system.key}`;
    const atHome = !activeModule;

    return (
        <nav
            aria-label={`Menú de ${system.name}`}
            className={cn(
                'flex h-full flex-col border-r border-[color-mix(in_oklab,var(--grad-start)_10%,#e5e7eb)] bg-white transition-[width] duration-200 ease-out',
                collapsed ? 'w-[4rem]' : 'w-[15.5rem]',
            )}
        >
            <div
                className={cn(
                    'flex items-center gap-3 px-3 pt-4 pb-3',
                    collapsed && 'flex-col',
                )}
            >
                <Link
                    to="/sistemas"
                    title="Volver a los sistemas"
                    onClick={onClose}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-(--sys-400)"
                >
                    <span
                        className="grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-[0_8px_16px_-8px_color-mix(in_oklab,var(--grad-end)_70%,transparent)]"
                        style={{
                            background:
                                'linear-gradient(135deg, var(--grad-start), var(--grad-end))',
                        }}
                    >
                        <system.icon className="size-5" aria-hidden />
                    </span>
                    {!collapsed && (
                        <span className="min-w-0">
                            <span className="block truncate text-[15px] leading-tight font-bold text-(--text)">
                                {system.name}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                                {system.fullName}
                            </span>
                        </span>
                    )}
                </Link>

                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar el menú"
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-black/[0.05] focus-visible:ring-[3px] focus-visible:ring-(--sys-400) lg:hidden"
                    >
                        <X className="size-[18px]" aria-hidden />
                    </button>
                )}
            </div>

            <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
                <li>
                    <Link
                        to={base}
                        title={collapsed ? 'Inicio' : undefined}
                        onClick={onClose}
                        aria-current={atHome ? 'page' : undefined}
                        className={cn(
                            'flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13px] font-semibold text-(--text) outline-none hover:bg-black/[0.04] focus-visible:ring-[3px] focus-visible:ring-(--sys-400)',
                            atHome && ACTIVE_ROW,
                            collapsed && 'justify-center',
                        )}
                    >
                        <span className="grid size-7 shrink-0 place-items-center">
                            <ThemedIcon icon={House} className="size-[18px]" />
                        </span>
                        {!collapsed && 'Inicio'}
                    </Link>
                </li>

                {nav.map((entry) => {
                    const slug = slugify(entry.label);
                    const isOpen = !collapsed && open.has(slug);
                    const isActiveModule = activeModule === slug;
                    const panelId = `nav-${system.key}-${slug}`;

                    if (collapsed) {
                        return (
                            <CollapsedModule
                                key={slug}
                                entry={entry}
                                base={base}
                                isActiveModule={isActiveModule}
                                activeItem={activeItem}
                            />
                        );
                    }

                    return (
                        <li key={slug}>
                            <button
                                type="button"
                                onClick={() => toggleModule(slug)}
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                className={cn(
                                    'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13px] font-semibold text-(--text) outline-none hover:bg-black/[0.04] focus-visible:ring-[3px] focus-visible:ring-(--sys-400)',
                                )}
                            >
                                <span className="grid size-7 shrink-0 place-items-center">
                                    <ThemedIcon
                                        icon={entry.icon}
                                        className="size-[18px]"
                                    />
                                </span>
                                <span className="min-w-0 flex-1 leading-snug">
                                    {entry.label}
                                </span>
                                <ChevronDown
                                    className={cn(
                                        'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                                        isOpen && 'rotate-180',
                                    )}
                                    aria-hidden
                                />
                            </button>

                            {!collapsed && (
                                <div
                                    id={panelId}
                                    className={cn(
                                        'grid transition-[grid-template-rows] duration-200 ease-out',
                                        isOpen
                                            ? 'grid-rows-[1fr]'
                                            : 'grid-rows-[0fr]',
                                    )}
                                >
                                    <ul
                                        className="relative -mx-2 flex flex-col gap-0.5 overflow-hidden pr-2 pl-8 before:absolute before:top-1 before:bottom-1 before:left-[22px] before:w-px before:bg-[#dfe3e8] before:content-['']"
                                        inert={!isOpen}
                                    >
                                        {entry.items.map((subItem) => {
                                            const itemSlug = slugify(
                                                subItem.label,
                                            );
                                            const isActive =
                                                isActiveModule &&
                                                activeItem === itemSlug;

                                            return (
                                                <li key={itemSlug}>
                                                    <Link
                                                        to={`${base}/${slug}/${itemSlug}`}
                                                        onClick={onClose}
                                                        aria-current={
                                                            isActive
                                                                ? 'page'
                                                                : undefined
                                                        }
                                                        className={cn(
                                                            'flex items-center gap-2.5 rounded-xl py-1.5 pr-2 pl-2.5 text-[12.5px] outline-none hover:bg-black/[0.04] focus-visible:ring-[3px] focus-visible:ring-(--sys-400)',
                                                            isActive
                                                                ? cn(
                                                                      ACTIVE_ROW,
                                                                      'font-semibold before:-left-8',
                                                                  )
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
                            )}
                        </li>
                    );
                })}
            </ul>

            <div
                className={cn(
                    'hidden gap-0.5 border-t border-[color-mix(in_oklab,var(--grad-start)_10%,#e5e7eb)] p-2 lg:flex',
                    // Abierto: los dos botones comparten una fila; contraído no cabe, van uno sobre otro.
                    collapsed ? 'flex-col' : 'flex-row',
                )}
            >
                <button
                    type="button"
                    onClick={onToggleCollapsed}
                    aria-label={
                        collapsed ? 'Expandir el menú' : 'Contraer el menú'
                    }
                    aria-expanded={!collapsed}
                    title={collapsed ? 'Expandir el menú' : undefined}
                    className={cn(
                        FOOTER_BUTTON,
                        collapsed ? 'justify-center' : 'min-w-0 flex-1',
                    )}
                >
                    <span className="grid size-7 shrink-0 place-items-center">
                        {collapsed ? (
                            <PanelLeftOpen
                                className="size-[18px]"
                                aria-hidden
                            />
                        ) : (
                            <PanelLeftClose
                                className="size-[18px]"
                                aria-hidden
                            />
                        )}
                    </span>
                    {!collapsed && 'Contraer'}
                </button>

                {onHide && (
                    <button
                        type="button"
                        onClick={onHide}
                        aria-label="Ocultar el menú"
                        title={collapsed ? 'Ocultar el menú' : undefined}
                        className={cn(
                            FOOTER_BUTTON,
                            collapsed ? 'justify-center' : 'min-w-0 flex-1',
                        )}
                    >
                        <span className="grid size-7 shrink-0 place-items-center">
                            <ChevronsLeft
                                className="size-[18px]"
                                aria-hidden
                            />
                        </span>
                        {!collapsed && 'Ocultar'}
                    </button>
                )}
            </div>
        </nav>
    );
}
