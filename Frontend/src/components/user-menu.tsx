import { Link } from 'react-router-dom';
import {
    Check,
    ChevronDown,
    House,
    LogOut,
    Store,
    Warehouse,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useBranches } from '@/hooks/use-branches';
import { usePermissions } from '@/hooks/use-permissions';
import type { Branch } from '@/lib/branches';
import type { PortalEntry, PortalKey } from '@/lib/systems';
import { SETTINGS, SYSTEM_LIST } from '@/lib/systems';
import { cn } from '@/lib/utils';

type UserMenuProps = {
    user: { name: string; email: string };
    /** Sistema que se está usando; se marca en la lista. */
    currentKey?: PortalKey;
    onSignOut: () => void;
};

const ITEM =
    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[#1a1033] outline-none hover:bg-black/[0.04] focus-visible:bg-black/[0.04]';

const SELECTED =
    'bg-[color-mix(in_oklab,var(--sys-600,var(--primary))_10%,white)] font-semibold text-(--sys-600,var(--primary)) hover:bg-[color-mix(in_oklab,var(--sys-600,var(--primary))_14%,white)]';

const SECTION =
    'px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase';

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

function BranchIcon({
    branch,
    className,
}: {
    branch: Branch;
    className: string;
}) {
    const Icon = branch.kind === 'distribution' ? Warehouse : Store;

    return <Icon className={className} aria-hidden />;
}

export default function UserMenu({
    user,
    currentKey,
    onSignOut,
}: UserMenuProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const menuId = useId();
    const { ready, canEnter } = usePermissions();
    const { branches, active, select } = useBranches();

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
                className="flex h-11 items-center gap-2.5 rounded-full border border-[#e5e7eb] bg-white py-1 pr-3 pl-1 text-left shadow-[0_6px_16px_-8px_rgb(16_24_40/0.25)] transition-shadow outline-none hover:shadow-[0_10px_20px_-10px_rgb(16_24_40/0.3)] focus-visible:ring-[3px] focus-visible:ring-(--sys-400,var(--ring))"
            >
                <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-(--sys-600,var(--primary)) text-[13px] font-bold text-white"
                >
                    {initialsOf(user.name)}
                </span>

                <span className="hidden min-w-0 sm:block">
                    <span className="block max-w-[11rem] truncate text-sm leading-tight font-bold text-[#1a1033]">
                        {user.name}
                    </span>
                    <span className="block max-w-[11rem] truncate text-[11px] leading-tight text-muted-foreground">
                        {user.email}
                    </span>
                </span>

                {active && (
                    <span className="hidden max-w-[12rem] items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--sys-600,var(--primary))_12%,white)] px-2.5 py-1 text-[11px] font-bold tracking-wide text-(--sys-600,var(--primary)) uppercase md:inline-flex">
                        <BranchIcon
                            branch={active}
                            className="size-3 shrink-0"
                        />
                        <span className="truncate">{active.name}</span>
                    </span>
                )}

                <ChevronDown
                    className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    aria-hidden
                />
            </button>

            {open && (
                <div
                    id={menuId}
                    role="menu"
                    className="absolute right-0 z-20 mt-2 max-h-[min(34rem,80dvh)] w-72 overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white p-1.5 shadow-[0_18px_36px_-16px_rgb(16_24_40/0.35)]"
                >
                    <div className="px-3 py-2.5">
                        <p className="truncate text-sm font-bold text-[#1a1033]">
                            {user.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                            {user.email}
                        </p>
                        {active && (
                            <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--sys-600,var(--primary))_12%,white)] px-2.5 py-1 text-[11px] font-bold tracking-wide text-(--sys-600,var(--primary)) uppercase">
                                <BranchIcon
                                    branch={active}
                                    className="size-3 shrink-0"
                                />
                                <span className="truncate">{active.name}</span>
                            </span>
                        )}
                    </div>

                    <div className="my-1 border-t border-[#e5e7eb]" />

                    <Link
                        to="/sistemas"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className={ITEM}
                    >
                        <House
                            className="size-4 text-muted-foreground"
                            aria-hidden
                        />
                        Inicio
                    </Link>

                    {branches.length > 0 && (
                        <>
                            <p className={SECTION}>
                                {branches.length === 1 ? 'Tu sucursal' : 'Sucursales'}
                            </p>
                            {branches.map((branch) => {
                                const selected = branch.id === active?.id;

                                return (
                                    <button
                                        key={branch.id}
                                        type="button"
                                        role="menuitemradio"
                                        aria-checked={selected}
                                        // Con una sola sucursal no hay nada que elegir.
                                        disabled={branches.length === 1}
                                        onClick={() => {
                                            select(branch.id);
                                            setOpen(false);
                                        }}
                                        className={cn(
                                            ITEM,
                                            selected && SELECTED,
                                        )}
                                    >
                                        <BranchIcon
                                            branch={branch}
                                            className="size-4 shrink-0"
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                            {branch.name}
                                        </span>
                                        {selected && (
                                            <Check
                                                className="size-4 shrink-0"
                                                aria-hidden
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </>
                    )}

                    <p className={SECTION}>Sistemas</p>
                    {SYSTEM_LIST.filter(
                        (entry) => ready && canEnter(entry.key),
                    ).map((entry) => (
                        <SystemLink
                            key={entry.key}
                            entry={entry}
                            current={entry.key === currentKey}
                            onNavigate={() => setOpen(false)}
                        />
                    ))}

                    {ready && canEnter(SETTINGS.key) && (
                        <>
                            <div className="my-1.5 border-t border-[#e5e7eb]" />
                            <SystemLink
                                entry={SETTINGS}
                                current={SETTINGS.key === currentKey}
                                onNavigate={() => setOpen(false)}
                            />
                        </>
                    )}

                    <div className="my-1.5 border-t border-[#e5e7eb]" />
                    <button
                        type="button"
                        role="menuitem"
                        onClick={onSignOut}
                        className={cn(
                            ITEM,
                            'font-semibold text-[#dc2626] hover:bg-[#dc2626]/[0.07] focus-visible:bg-[#dc2626]/[0.07]',
                        )}
                    >
                        <LogOut className="size-4" aria-hidden />
                        Cerrar sesión
                    </button>
                </div>
            )}
        </div>
    );
}

function SystemLink({
    entry,
    current,
    onNavigate,
}: {
    entry: PortalEntry;
    current: boolean;
    onNavigate: () => void;
}) {
    return (
        <Link
            to={`/sistemas/${entry.key}`}
            role="menuitem"
            data-system={entry.key}
            aria-current={current ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
                ITEM,
                current &&
                    'bg-[color-mix(in_oklab,var(--grad-start)_10%,white)] font-semibold',
            )}
        >
            <entry.icon className="size-4 text-(--sys-600)" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
            {current && (
                <Check
                    className="size-4 shrink-0 text-(--sys-600)"
                    aria-hidden
                />
            )}
        </Link>
    );
}
