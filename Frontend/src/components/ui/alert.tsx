import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

type AlertTone = 'error' | 'warning' | 'info';

const TONES: Record<AlertTone, string> = {
    error: 'tone-danger border-(--tone-solid) bg-(--tone-bg) text-(--tone-fg)',
    warning: 'tone-warning border-(--tone-solid) bg-(--tone-bg) text-(--tone-fg)',
    info: 'tone-neutral border-line bg-surface-alt text-ink-muted',
};

/**
 * `warning` es un aviso: algo a tener en cuenta. `info` es una nota neutra,
 * para lo que no es ni un error ni una advertencia y no debe llamar la
 * atención como una.
 */
export function Alert({
    children,
    tone = 'error',
}: {
    children: ReactNode;
    tone?: AlertTone;
}) {
    return (
        <div
            role="alert"
            className={`flex gap-2 rounded-field border p-3 text-sm ${TONES[tone]}`}
        >
            <CircleAlert className="mt-0.5 size-[18px] shrink-0" aria-hidden />
            <span>{children}</span>
        </div>
    );
}
