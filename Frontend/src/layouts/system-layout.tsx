import { Menu, PanelLeftOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import NotificationBell from '@/components/notification-bell';
import SystemSidebar from '@/components/system/system-sidebar';
import { IconGradientDefs } from '@/components/system/themed-icon';
import UserMenu from '@/components/user-menu';
import { useAuthUser } from '@/hooks/use-auth-user';
import { usePermissions } from '@/hooks/use-permissions';
import { visibleNav } from '@/lib/navigation';
import type { PortalEntry } from '@/lib/systems';

const COLLAPSED_KEY = 'minimarket.sidebar.collapsed';
const HIDDEN_KEY = 'minimarket.sidebar.hidden';

function readFlag(key: string): boolean {
    try {
        return window.localStorage.getItem(key) === '1';
    } catch {
        return false;
    }
}

function writeFlag(key: string, value: boolean) {
    try {
        window.localStorage.setItem(key, value ? '1' : '0');
    } catch {
        // Sin almacenamiento: el estado dura solo esta visita.
    }
}

type SystemLayoutProps = {
    system: PortalEntry;
    activeModule?: string | null;
    activeItem?: string | null;
    breadcrumb?: ReactNode;
    children: ReactNode;
};

export default function SystemLayout({
    system,
    activeModule,
    activeItem,
    breadcrumb,
    children,
}: SystemLayoutProps) {
    const { user, signOut } = useAuthUser();
    const { ready, can } = usePermissions();
    const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY));
    const [hidden, setHidden] = useState(() => readFlag(HIDDEN_KEY));
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        if (!mobileOpen) {
            return;
        }

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMobileOpen(false);
            }
        };

        document.addEventListener('keydown', closeOnEscape);

        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [mobileOpen]);

    const toggleCollapsed = () => {
        setCollapsed((value) => {
            writeFlag(COLLAPSED_KEY, !value);

            return !value;
        });
    };

    const setSidebarHidden = (value: boolean) => {
        writeFlag(HIDDEN_KEY, value);
        setHidden(value);
    };

    const nav = ready ? visibleNav(system.key, can) : [];

    return (
        <div
            data-system={system.key}
            className="flex min-h-dvh bg-[#f3f4f6] font-display text-(--text)"
        >
            <IconGradientDefs />

            {/* Destino de los modales: dentro del data-system para heredar su color. */}
            <div id="modal-root" />

            {!hidden && (
                <aside className="sticky top-0 hidden h-dvh shrink-0 lg:block">
                    <SystemSidebar
                        system={system}
                        nav={nav}
                        activeModule={activeModule}
                        activeItem={activeItem}
                        collapsed={collapsed}
                        onToggleCollapsed={toggleCollapsed}
                        onHide={() => setSidebarHidden(true)}
                    />
                </aside>
            )}

            {mobileOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <button
                        type="button"
                        aria-label="Cerrar el menú"
                        onClick={() => setMobileOpen(false)}
                        className="absolute inset-0 bg-black/40"
                    />
                    <div className="relative h-full w-fit max-w-[85vw]">
                        <SystemSidebar
                            system={system}
                            nav={nav}
                            activeModule={activeModule}
                            activeItem={activeItem}
                            collapsed={false}
                            onToggleCollapsed={() => undefined}
                            onClose={() => setMobileOpen(false)}
                        />
                    </div>
                </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center justify-between gap-3 px-5 pt-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(true)}
                            aria-label="Abrir el menú"
                            className="grid size-11 shrink-0 place-items-center rounded-full border border-[#e5e7eb] bg-white outline-none focus-visible:ring-[3px] focus-visible:ring-(--sys-400) lg:hidden"
                        >
                            <Menu className="size-[18px]" aria-hidden />
                        </button>
                        {hidden && (
                            <button
                                type="button"
                                onClick={() => setSidebarHidden(false)}
                                aria-label="Mostrar el menú"
                                title="Mostrar el menú"
                                className="hidden size-11 shrink-0 place-items-center rounded-full border border-[#e5e7eb] bg-white outline-none hover:bg-black/[0.03] focus-visible:ring-[3px] focus-visible:ring-(--sys-400) lg:grid"
                            >
                                <PanelLeftOpen
                                    className="size-[18px]"
                                    aria-hidden
                                />
                            </button>
                        )}
                        <div className="min-w-0">{breadcrumb}</div>
                    </div>

                    {user ? (
                        <div className="flex shrink-0 items-center gap-2.5">
                            <UserMenu
                                user={user}
                                currentKey={system.key}
                                onSignOut={signOut}
                            />
                            <NotificationBell />
                        </div>
                    ) : (
                        <div
                            aria-hidden
                            className="h-11 w-56 animate-pulse rounded-full bg-white/80"
                        />
                    )}
                </header>

                <main className="flex-1 px-6 pt-8 pb-12">{children}</main>
            </div>
        </div>
    );
}
