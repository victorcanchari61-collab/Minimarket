import { Link, useLocation } from 'react-router-dom';
import SystemShowcase from '@/components/auth/system-showcase';
import { BRAND_NAME, resolveSystem } from '@/lib/systems';
import type { SystemDefinition } from '@/lib/systems';
import type { ReactNode } from 'react';

type AuthLayoutProps = {
    children?: ReactNode;
    title?: string;
    description?: string;
};

function SystemBrand({ system }: { system: SystemDefinition }) {
    return (
        <Link
            to="/"
            className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-(--sys-900)"
        >
            <span className="grid size-10 place-items-center rounded-xl bg-(--sys-500) text-white shadow-[0_8px_16px_-6px_rgb(0_0_0/0.45)]">
                <system.icon className="size-5" aria-hidden />
            </span>
            <span className="text-white">
                <span className="block font-display text-xl leading-none font-bold tracking-tight">
                    {BRAND_NAME}
                </span>
                <span className="mt-1 block text-xs text-(--sys-200)">
                    {system.name} · {system.fullName}
                </span>
            </span>
        </Link>
    );
}

export default function AuthShowcaseLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    // ?sistema=wms solo sirve para previsualizar los demás temas.
    const { search } = useLocation();
    const system = resolveSystem(search);

    return (
        <div
            data-system={system.key}
            className="sys-theme grid min-h-dvh bg-background font-display lg:h-dvh lg:grid-cols-[1.04fr_1fr]"
        >
            <header className="sys-panel relative flex items-center justify-between px-5 py-4 lg:hidden">
                <SystemBrand system={system} />
            </header>

            <aside className="sys-panel relative hidden flex-col gap-10 overflow-y-auto px-12 py-12 lg:flex xl:px-16">
                <div className="relative z-10">
                    <SystemBrand system={system} />
                </div>
                <div className="relative z-10 my-auto pb-6">
                    <SystemShowcase key={system.key} system={system} />
                </div>
            </aside>

            <main className="bg-(--sys-50) lg:overflow-y-auto">
                <div className="mx-auto flex min-h-full w-full max-w-[400px] flex-col justify-center px-6 py-10 lg:py-12">
                    <div className="flex flex-col items-center text-center">
                        <p className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                            Desarrollado por
                        </p>
                        <span className="mt-3 block">
                            <img
                                src="/brintech-logo.png"
                                alt="Brintech Technology Consulting"
                                width={720}
                                height={425}
                                className="h-auto w-44"
                            />
                        </span>
                        <h1 className="mt-6 text-[1.75rem] leading-tight font-bold tracking-[-0.02em] text-balance">
                            {title}
                        </h1>
                        {description && (
                            <p className="mt-2 text-[15px] text-balance text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>

                    <div className="mt-8">{children}</div>
                </div>
            </main>
        </div>
    );
}
