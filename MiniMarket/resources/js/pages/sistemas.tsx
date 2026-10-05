import { Head, Link } from '@inertiajs/react';
import { ArrowRight, ShoppingBasket } from 'lucide-react';
import type { CSSProperties } from 'react';
import NotificationBell from '@/components/notification-bell';
import UserMenu from '@/components/user-menu';
import { useAuthUser } from '@/hooks/use-auth-user';
import { BRAND_NAME, PORTAL_ENTRIES, SYSTEM_LIST } from '@/lib/systems';

export default function Sistemas() {
    const { user, signOut } = useAuthUser();

    return (
        <>
            <Head title="Sistemas" />

            <div className="min-h-dvh bg-[#f3f4f6] font-display text-[#1a1033]">
                <header className="mx-auto flex max-w-[1180px] items-center justify-end gap-3 px-6 pt-5">
                    {user ? (
                        <>
                            <UserMenu user={user} onSignOut={signOut} />
                            <NotificationBell />
                        </>
                    ) : (
                        <div
                            aria-hidden
                            className="h-14 w-60 animate-pulse rounded-full bg-white/80"
                        />
                    )}
                </header>

                <main className="mx-auto flex max-w-[1180px] flex-col items-center px-6 pt-10 pb-16 sm:pt-16">
                    <div className="grid size-16 place-items-center rounded-[18px] bg-[#1a1033] text-white shadow-[0_14px_28px_-12px_rgb(26_16_51/0.55)]">
                        <ShoppingBasket className="size-7" aria-hidden />
                    </div>

                    <h1 className="mt-6 text-center text-[2rem] leading-tight font-bold tracking-[-0.02em]">
                        {BRAND_NAME}
                    </h1>
                    <p className="mt-1.5 text-center text-[15px] text-muted-foreground">
                        Suite operativa para tu cadena de minimarkets
                    </p>
                    <p className="mt-6 max-w-[46ch] text-center text-[15px] leading-relaxed text-balance text-[#4b5563]">
                        {SYSTEM_LIST.length} sistemas integrados con una sola
                        base de datos. Elige uno para empezar a trabajar.
                    </p>

                    <ul className="mt-10 flex w-full flex-wrap justify-center gap-4">
                        {PORTAL_ENTRIES.map((system, index) => (
                            <li
                                key={system.key}
                                className="sys-rise w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)]"
                                style={
                                    {
                                        '--sys-delay': `${index * 60}ms`,
                                    } as CSSProperties
                                }
                            >
                                <Link
                                    href={`/sistemas/${system.key}`}
                                    data-system={system.key}
                                    className="group relative block overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--grad-start)_22%,#e5e7eb)] bg-white p-5 shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition-[transform,box-shadow,border-color] duration-300 ease-out outline-none hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--grad-start)_55%,#e5e7eb)] hover:shadow-[0_18px_32px_-18px_color-mix(in_oklab,var(--grad-end)_60%,transparent)] focus-visible:ring-[3px] focus-visible:ring-(--sys-400)"
                                >
                                    <span
                                        aria-hidden
                                        className="absolute inset-x-0 top-0 h-[3px] opacity-80 transition-opacity group-hover:opacity-100"
                                        style={{ background: 'var(--grad)' }}
                                    />

                                    <div className="flex items-center gap-4">
                                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--grad-end)_14%,white)] text-(--sys-600)">
                                            <system.icon
                                                className="size-[22px]"
                                                aria-hidden
                                            />
                                        </span>
                                        <div className="min-w-0">
                                            <h2 className="text-lg leading-tight font-bold tracking-tight text-(--text)">
                                                {system.name}
                                            </h2>
                                            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                                                {system.fullName}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-5 flex items-center justify-between">
                                        <span className="rounded-lg border border-[color-mix(in_oklab,var(--grad-start)_28%,#e5e7eb)] bg-(--surface) px-2.5 py-1 text-xs font-semibold text-(--text)">
                                            {system.modules.length} módulos
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-(--sys-600)">
                                            Entrar
                                            <ArrowRight
                                                className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                                                aria-hidden
                                            />
                                        </span>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </main>
            </div>
        </>
    );
}
