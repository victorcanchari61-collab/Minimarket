import { ChevronDown, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

type UserMenuProps = {
    user: { name: string; email: string };
    /** Etiqueta de contexto junto al nombre (sistema o sucursal activa). */
    context?: { label: string; icon?: LucideIcon };
    onSignOut: () => void;
};

function initialsOf(name: string): string {
    return (
        name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0].toUpperCase())
            .join('') || '?'
    );
}

export default function UserMenu({ user, context, onSignOut }: UserMenuProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) {
            return;
        }

        const closeOnOutsideClick = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);

        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                className="flex h-14 items-center gap-3 rounded-full border border-[#e5e7eb] bg-white py-1.5 pr-4 pl-1.5 text-left shadow-[0_6px_16px_-8px_rgb(16_24_40/0.25)] transition-shadow outline-none hover:shadow-[0_10px_20px_-10px_rgb(16_24_40/0.3)] focus-visible:ring-[3px] focus-visible:ring-(--sys-400,var(--ring))"
            >
                <span
                    aria-hidden
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-(--sys-600,var(--primary)) text-[15px] font-bold text-white"
                >
                    {initialsOf(user.name)}
                </span>

                <span className="hidden min-w-0 sm:block">
                    <span className="block max-w-[11rem] truncate text-[15px] leading-tight font-bold text-[#1a1033]">
                        {user.name}
                    </span>
                    <span className="block max-w-[11rem] truncate text-xs text-muted-foreground">
                        {user.email}
                    </span>
                </span>

                {context && (
                    <span className="hidden items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--sys-600,var(--primary))_12%,white)] px-3 py-1.5 text-xs font-bold tracking-wide text-(--sys-600,var(--primary)) uppercase md:inline-flex">
                        {context.icon && (
                            <context.icon className="size-3.5" aria-hidden />
                        )}
                        {context.label}
                    </span>
                )}

                <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    aria-hidden
                />
            </button>

            {open && (
                <div
                    id={menuId}
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white p-1.5 shadow-[0_18px_36px_-16px_rgb(16_24_40/0.35)]"
                >
                    <div className="px-3 py-2.5 sm:hidden">
                        <p className="truncate text-sm font-bold text-[#1a1033]">
                            {user.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={onSignOut}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#1a1033] outline-none hover:bg-black/[0.04] focus-visible:bg-black/[0.04]"
                    >
                        <LogOut className="size-4" aria-hidden />
                        Cerrar sesión
                    </button>
                </div>
            )}
        </div>
    );
}
