import { Head, Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import SystemLayout from '@/layouts/system-layout';
import { findNav, slugify, SYSTEM_NAV } from '@/lib/navigation';
import { findPortalEntry } from '@/lib/systems';
import type { PortalKey } from '@/lib/systems';

type Props = {
    system: PortalKey;
    module?: string | null;
    item?: string | null;
};

const CARD =
    'group flex items-center gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--grad-start)_16%,#e5e7eb)] bg-white p-4 outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-16px_color-mix(in_oklab,var(--grad-end)_55%,transparent)] focus-visible:ring-[3px] focus-visible:ring-(--sys-400)';

export default function Sistema({ system: key, module, item }: Props) {
    const system = findPortalEntry(key);
    const { module: currentModule, item: currentItem } = findNav(
        key,
        module,
        item,
    );
    const moduleSlug = currentModule ? slugify(currentModule.label) : null;
    const itemSlug = currentItem ? slugify(currentItem.label) : null;
    const base = `/sistemas/${key}`;

    const crumbs = [
        { label: system.name, href: base },
        currentModule && {
            label: currentModule.label,
            href: `${base}/${moduleSlug}`,
        },
        currentItem && { label: currentItem.label, href: null },
    ].filter((crumb): crumb is { label: string; href: string | null } =>
        Boolean(crumb),
    );

    const breadcrumb = (
        <ol className="flex flex-wrap items-center gap-1.5 text-sm">
            {crumbs.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-1.5">
                    {index > 0 && (
                        <ChevronRight
                            className="size-3.5 text-muted-foreground"
                            aria-hidden
                        />
                    )}
                    {crumb.href ? (
                        <Link
                            href={crumb.href}
                            className="rounded font-medium text-muted-foreground outline-none hover:text-(--text) focus-visible:ring-[3px] focus-visible:ring-(--sys-400)"
                        >
                            {crumb.label}
                        </Link>
                    ) : (
                        <span
                            aria-current="page"
                            className="font-semibold text-(--text)"
                        >
                            {crumb.label}
                        </span>
                    )}
                </li>
            ))}
        </ol>
    );

    const title = currentItem?.label ?? currentModule?.label ?? system.name;
    const subtitle = currentItem
        ? currentModule?.label
        : currentModule
          ? `${currentModule.items.length} opciones`
          : system.fullName;
    const TitleIcon = currentItem?.icon ?? currentModule?.icon ?? system.icon;

    const cards = currentItem
        ? []
        : currentModule
          ? currentModule.items.map((entry) => ({
                label: entry.label,
                icon: entry.icon,
                href: `${base}/${moduleSlug}/${slugify(entry.label)}`,
                meta: null as string | null,
            }))
          : SYSTEM_NAV[key].map((entry) => ({
                label: entry.label,
                icon: entry.icon,
                href: `${base}/${slugify(entry.label)}`,
                meta: `${entry.items.length} opciones`,
            }));

    return (
        <>
            <Head title={title} />

            <SystemLayout
                system={system}
                activeModule={moduleSlug}
                activeItem={itemSlug}
                breadcrumb={breadcrumb}
            >
                <div className="mx-auto max-w-[960px]">
                    <div className="flex items-center gap-4">
                        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--grad-end)_14%,white)] text-(--sys-600)">
                            <TitleIcon className="size-7" aria-hidden />
                        </span>
                        <div className="min-w-0">
                            <h1 className="text-3xl font-bold tracking-[-0.02em] text-balance">
                                {title}
                            </h1>
                            <p className="text-muted-foreground">{subtitle}</p>
                        </div>
                    </div>

                    <p className="mt-8 rounded-2xl border border-dashed border-[color-mix(in_oklab,var(--grad-start)_35%,#e5e7eb)] bg-white px-5 py-4 text-[15px] text-muted-foreground">
                        {currentItem
                            ? 'Esta pantalla todavía está en construcción.'
                            : 'Elige una opción del menú. Todavía están en construcción.'}
                    </p>

                    {cards.length > 0 && (
                        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                            {cards.map((card) => (
                                <li key={card.href}>
                                    <Link href={card.href} className={CARD}>
                                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--grad-end)_14%,white)] text-(--sys-600)">
                                            <card.icon
                                                className="size-5"
                                                aria-hidden
                                            />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[15px] leading-snug font-semibold">
                                                {card.label}
                                            </span>
                                            {card.meta && (
                                                <span className="block text-xs text-muted-foreground">
                                                    {card.meta}
                                                </span>
                                            )}
                                        </span>
                                        <ChevronRight
                                            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
                                            aria-hidden
                                        />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </SystemLayout>
        </>
    );
}
