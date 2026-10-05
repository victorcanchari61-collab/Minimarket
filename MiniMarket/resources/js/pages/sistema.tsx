import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import NotificationBell from '@/components/notification-bell';
import UserMenu from '@/components/user-menu';
import { useAuthUser } from '@/hooks/use-auth-user';
import { BRAND_NAME, findPortalEntry } from '@/lib/systems';
import type { PortalKey } from '@/lib/systems';

export default function Sistema({ system: key }: { system: PortalKey }) {
    const system = findPortalEntry(key);
    const { user, signOut } = useAuthUser();

    return (
        <>
            <Head title={system.name} />

            <div
                data-system={system.key}
                className="min-h-dvh bg-[#f3f4f6] font-display text-(--text)"
            >
                <div
                    aria-hidden
                    className="h-1.5"
                    style={{ background: 'var(--grad)' }}
                />

                <main className="mx-auto max-w-[900px] px-6 py-10">
                    <div className="flex items-center justify-between gap-4">
                        <Link
                            href="/sistemas"
                            className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground outline-none hover:text-(--text) focus-visible:ring-[3px] focus-visible:ring-(--sys-400)"
                        >
                            <ArrowLeft className="size-4" aria-hidden />
                            {BRAND_NAME}
                        </Link>

                        {user ? (
                            <div className="flex items-center gap-3">
                                <UserMenu
                                    user={user}
                                    context={{
                                        label: system.name,
                                        icon: system.icon,
                                    }}
                                    onSignOut={signOut}
                                />
                                <NotificationBell />
                            </div>
                        ) : (
                            <div
                                aria-hidden
                                className="h-14 w-60 animate-pulse rounded-full bg-white/80"
                            />
                        )}
                    </div>

                    <div className="mt-8 flex items-center gap-4">
                        <span className="grid size-14 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--grad-end)_14%,white)] text-(--sys-600)">
                            <system.icon className="size-7" aria-hidden />
                        </span>
                        <div>
                            <h1 className="text-3xl font-bold tracking-[-0.02em]">
                                {system.name}
                            </h1>
                            <p className="text-muted-foreground">
                                {system.fullName}
                            </p>
                        </div>
                    </div>

                    <p className="mt-8 rounded-2xl border border-dashed border-[color-mix(in_oklab,var(--grad-start)_35%,#e5e7eb)] bg-white px-5 py-4 text-[15px] text-muted-foreground">
                        {key === 'config' ? 'Esta sección' : 'Este sistema'}{' '}
                        todavía está en construcción. Estos son sus{' '}
                        {system.modules.length} módulos:
                    </p>

                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {system.modules.map((module) => (
                            <li
                                key={module}
                                className="rounded-xl border border-[color-mix(in_oklab,var(--grad-start)_16%,#e5e7eb)] bg-white px-4 py-3 text-[15px] font-medium"
                            >
                                {module}
                            </li>
                        ))}
                    </ul>
                </main>
            </div>
        </>
    );
}
