import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { LOGIN_SYSTEM_LIST } from '@/lib/systems';
import type { StatusTone, SystemDefinition } from '@/lib/systems';

const SLIDE_SECONDS = 6;

const TONE_CLASSES: Record<StatusTone, string> = {
    ok: 'text-[oklch(0.86_0.16_160)]',
    warn: 'text-[oklch(0.87_0.15_92)]',
    info: 'text-[oklch(0.86_0.09_235)]',
    bad: 'text-[oklch(0.82_0.14_22)]',
};

export default function SystemShowcase({
    system,
}: {
    system: SystemDefinition;
}) {
    const initial = Math.max(
        0,
        LOGIN_SYSTEM_LIST.findIndex((item) => item.key === system.key),
    );
    const [active, setActive] = useState(initial);
    const [paused, setPaused] = useState(false);

    const systemCount = LOGIN_SYSTEM_LIST.length;
    const current = LOGIN_SYSTEM_LIST[active];

    useEffect(() => {
        setActive(initial);
    }, [initial]);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setPaused(true);
        }
    }, []);

    return (
        <div className="mx-auto w-full max-w-[580px]">
            <div
                role="tablist"
                aria-label="Sistemas de la plataforma"
                className="flex flex-wrap gap-2"
            >
                {LOGIN_SYSTEM_LIST.map((item, index) => {
                    const isActive = index === active;

                    return (
                        <button
                            key={item.key}
                            type="button"
                            role="tab"
                            id={`showcase-tab-${index}`}
                            aria-selected={isActive}
                            aria-controls="showcase-panel"
                            onClick={() => setActive(index)}
                            className={cn(
                                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-(--sys-900)',
                                isActive
                                    ? 'border-white bg-white text-(--sys-900)'
                                    : 'border-white/20 bg-white/5 text-(--sys-200) hover:border-white/35 hover:bg-white/10',
                            )}
                        >
                            <item.icon className="size-4" aria-hidden />
                            {item.name}
                        </button>
                    );
                })}
            </div>

            <div
                key={current.key}
                id="showcase-panel"
                role="tabpanel"
                aria-labelledby={`showcase-tab-${active}`}
                className="mt-10"
            >
                <h2 className="sys-rise max-w-[15ch] font-display text-[2.6rem] leading-[1.08] font-bold tracking-[-0.03em] text-balance text-white xl:max-w-[17ch] xl:text-[2.9rem]">
                    {current.headline}
                </h2>
                <p
                    className="sys-rise mt-5 max-w-[48ch] text-[15px] leading-relaxed text-(--sys-200)"
                    style={{ '--sys-delay': '70ms' } as React.CSSProperties}
                >
                    {current.blurb}
                </p>
                <p
                    className="sys-rise mt-3 max-w-[52ch] text-[13px] leading-relaxed text-(--sys-300)"
                    style={{ '--sys-delay': '110ms' } as React.CSSProperties}
                >
                    <span className="font-semibold text-(--sys-200)">
                        {current.fullName}:
                    </span>{' '}
                    {current.modules.join(' · ')}
                </p>

                <div
                    className="sys-rise mt-8 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] shadow-[0_24px_48px_-24px_rgb(0_0_0/0.55)]"
                    style={{ '--sys-delay': '140ms' } as React.CSSProperties}
                >
                    <ul className="divide-y divide-white/10">
                        {current.rows.map((row) => (
                            <li
                                key={row.title}
                                className="flex items-center gap-4 px-5 py-4"
                            >
                                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-(--sys-200)">
                                    <row.icon className="size-5" aria-hidden />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[15px] font-semibold text-white">
                                        {row.title}
                                    </p>
                                    <p className="mt-0.5 truncate text-[13px] text-(--sys-200)">
                                        {row.subtitle}
                                    </p>
                                </div>
                                <span
                                    className={cn(
                                        'shrink-0 text-[13px] font-semibold',
                                        TONE_CLASSES[row.tone],
                                    )}
                                >
                                    {row.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-black/10 px-5 py-3 text-[13px]">
                        <span className="flex min-w-0 items-center gap-2.5 text-(--sys-200)">
                            <span
                                aria-hidden
                                className="size-2 shrink-0 rounded-full bg-(--sys-400)"
                            />
                            <span className="truncate">{current.footer}</span>
                        </span>
                        <span className="shrink-0 text-xs text-(--sys-300)">
                            Datos de ejemplo
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex items-center gap-3">
                <div className="flex flex-1 gap-2">
                    {LOGIN_SYSTEM_LIST.map((item, index) => (
                        <button
                            key={item.key}
                            type="button"
                            aria-label={`Ver ${item.name}`}
                            onClick={() => setActive(index)}
                            className="group flex h-6 flex-1 items-center outline-none"
                        >
                            <span className="relative block h-[3px] w-full overflow-hidden rounded-full bg-white/20 group-focus-visible:ring-2 group-focus-visible:ring-white/70 group-focus-visible:ring-offset-4 group-focus-visible:ring-offset-(--sys-900)">
                                {index < active && (
                                    <span className="absolute inset-0 bg-white" />
                                )}
                                {index === active && (
                                    <span
                                        key={current.key}
                                        className="sys-fill absolute inset-0 bg-white"
                                        data-paused={paused}
                                        style={
                                            {
                                                '--sys-duration': `${SLIDE_SECONDS}s`,
                                            } as React.CSSProperties
                                        }
                                        onAnimationEnd={() =>
                                            setActive(
                                                (i) => (i + 1) % systemCount,
                                            )
                                        }
                                    />
                                )}
                            </span>
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => setPaused((value) => !value)}
                    aria-label={
                        paused ? 'Reanudar presentación' : 'Pausar presentación'
                    }
                    className="grid size-9 shrink-0 place-items-center rounded-full border border-white/25 text-white transition-colors outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-(--sys-900)"
                >
                    {paused ? (
                        <Play className="size-4" aria-hidden />
                    ) : (
                        <Pause className="size-4" aria-hidden />
                    )}
                </button>
            </div>
        </div>
    );
}
