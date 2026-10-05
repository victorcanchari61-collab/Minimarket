import { Link } from '@inertiajs/react';
import {
    ChevronDown,
    House,
    PanelLeftClose,
    PanelLeftOpen,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { NavModule } from '@/lib/navigation';
import { slugify } from '@/lib/navigation';
import type { PortalEntry } from '@/lib/systems';
import { cn } from '@/lib/utils';

type SystemSidebarProps = {
    system: PortalEntry;
    nav: NavModule[];
    activeModule?: string | null;
    activeItem?: string | null;
    collapsed: boolean;
    onToggleCollapsed: () => void;
    /** Solo en móvil: cierra el panel al elegir una opción. */
    onClose?: () => void;
};

const TINT = 'bg-[color-mix(in_oklab,var(--grad-end)_14%,white)]';
const ACTIVE_BG = 'bg-[color-mix(in_oklab,var(--grad-start)_10%,white)]';

export default function SystemSidebar({
    system,
    nav,
    activeModule,
    activeItem,
    collapsed,
    onToggleCollapsed,
    onClose,
}: SystemSidebarProps) {
    const [open, setOpen] = useState<Set<string>>(
        () => new Set(activeModule ? [activeModule] : []),
    );

    useEffect(() => {
        if (activeModule) {
            setOpen((current) => new Set(current).add(activeModule));
        }
    }, [activeModule]);

    const toggleModule = (slug: string) => {
        if (collapsed) {
            onToggleCollapsed();
            setOpen((current) => new Set(current).add(slug));

            return;
        }

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
                'flex h-full flex-col overflow-y-auto border-r border-[color-mix(in_oklab,var(--grad-start)_10%,#e5e7eb)] bg-white transition-[width] duration-200 ease-out',
                collapsed ? 'w-[4.5rem]' : 'w-[17rem]',
            )}
        >
            <div
                className={cn(
                    'flex items-center gap-3 px-3 pt-4 pb-3',
                    collapsed && 'flex-col',
                )}
            >
                <Link
                    href="/sistemas"
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
                            <span className="block truncate text-base leading-tight font-bold text-(--text)">
                                {system.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                                {system.fullName}
                            </span>
                        </span>
                    )}
                </Link>

                <button
                    type="button"
                    onClick={onToggleCollapsed}
                    aria-label={
                        collapsed ? 'Expandir el menú' : 'Contraer el menú'
                    }
                    aria-expanded={!collapsed}
                    className="hidden size-8 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-black/[0.05] hover:text-(--text) focus-visible:ring-[3px] focus-visible:ring-(--sys-400) lg:grid"
                >
                    {collapsed ? (
                        <PanelLeftOpen className="size-[18px]" aria-hidden />
                    ) : (
                        <PanelLeftClose className="size-[18px]" aria-hidden />
                    )}
                </button>

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

            <ul className="flex flex-col gap-0.5 px-2 pb-6">
                <li>
                    <Link
                        href={base}
                        title={collapsed ? 'Inicio' : undefined}
                        onClick={onClose}
                        aria-current={atHome ? 'page' : undefined}
                        className={cn(
                            'flex items-center gap-3 rounded-xl px-2 py-2 text-[14px] font-semibold text-(--text) outline-none hover:bg-black/[0.04] focus-visible:ring-[3px] focus-visible:ring-(--sys-400)',
                            atHome && ACTIVE_BG,
                            collapsed && 'justify-center',
                        )}
                    >
                        <span
                            className={cn(
                                'grid size-8 shrink-0 place-items-center rounded-lg text-(--sys-600)',
                                TINT,
                            )}
                        >
                            <House className="size-[18px]" aria-hidden />
                        </span>
                        {!collapsed && 'Inicio'}
                    </Link>
                </li>

                {nav.map((entry) => {
                    const slug = slugify(entry.label);
                    const isOpen = !collapsed && open.has(slug);
                    const isActiveModule = activeModule === slug;
                    const panelId = `nav-${system.key}-${slug}`;

                    return (
                        <li key={slug}>
                            <button
                                type="button"
                                onClick={() => toggleModule(slug)}
                                title={collapsed ? entry.label : undefined}
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[14px] font-semibold text-(--text) outline-none hover:bg-black/[0.04] focus-visible:ring-[3px] focus-visible:ring-(--sys-400)',
                                    (isOpen || (collapsed && isActiveModule)) &&
                                        'bg-(--surface)',
                                    collapsed && 'justify-center',
                                )}
                            >
                                <span
                                    className={cn(
                                        'grid size-8 shrink-0 place-items-center rounded-lg text-(--sys-600)',
                                        TINT,
                                    )}
                                >
                                    <entry.icon
                                        className="size-[18px]"
                                        aria-hidden
                                    />
                                </span>
                                {!collapsed && (
                                    <>
                                        <span className="min-w-0 flex-1 leading-snug">
                                            {entry.label}
                                        </span>
                                        <ChevronDown
                                            className={cn(
                                                'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                                                isOpen && 'rotate-180',
                                            )}
                                            aria-hidden
                                        />
                                    </>
                                )}
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
                                        className="flex flex-col gap-0.5 overflow-hidden"
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
                                                        href={`${base}/${slug}/${itemSlug}`}
                                                        onClick={onClose}
                                                        aria-current={
                                                            isActive
                                                                ? 'page'
                                                                : undefined
                                                        }
                                                        className={cn(
                                                            'flex items-center gap-3 rounded-xl py-2 pr-2 pl-[1.1rem] text-[13.5px] text-(--text) outline-none hover:bg-black/[0.04] focus-visible:ring-[3px] focus-visible:ring-(--sys-400)',
                                                            isActive
                                                                ? cn(
                                                                      ACTIVE_BG,
                                                                      'font-semibold',
                                                                  )
                                                                : 'font-medium',
                                                        )}
                                                    >
                                                        <subItem.icon
                                                            className="size-4 shrink-0 text-(--sys-600)"
                                                            aria-hidden
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
        </nav>
    );
}
