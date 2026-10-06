import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDismiss } from '@/hooks/use-dismiss';
import { cn } from '@/lib/utils';

/**
 * Selector de rango de fechas: un campo con "desde → hasta" que abre un
 * calendario de dos meses con atajos comunes (esta semana, este mes...).
 *
 * El valor entra y sale como fechas yyyy-mm-dd (mismo formato que
 * `<input type="date">`), para no romper nada de lo que ya las consume.
 */

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-mm-dd, en hora local: evita el corrimiento de un día que da toISOString. */
const toIso = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const fromIso = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);

    return new Date(year, month - 1, day);
};

const formatDisplay = (iso: string) => {
    if (!iso) {
        return '';
    }

    const [year, month, day] = iso.split('-');

    return `${day}/${month}/${year}`;
};

interface Preset {
    label: string;
    from: string;
    to: string;
}

/** Rangos de uso frecuente, calculados desde hoy. */
function getPresets(): Preset[] {
    const today = new Date();
    const year = today.getFullYear();

    const weekStart = (date: Date) => {
        const d = new Date(date);
        const weekday = (d.getDay() + 6) % 7; // lunes = 0
        d.setDate(d.getDate() - weekday);

        return d;
    };

    const thisWeekStart = weekStart(today);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    const lastWeekStart = weekStart(lastWeekEnd);

    const thisMonthStart = new Date(year, today.getMonth(), 1);
    const lastMonthEnd = new Date(year, today.getMonth(), 0);
    const lastMonthStart = new Date(
        lastMonthEnd.getFullYear(),
        lastMonthEnd.getMonth(),
        1,
    );

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return [
        { label: 'Hoy', from: toIso(today), to: toIso(today) },
        { label: 'Ayer', from: toIso(yesterday), to: toIso(yesterday) },
        {
            label: 'Esta semana',
            from: toIso(thisWeekStart),
            to: toIso(today),
        },
        {
            label: 'Última semana',
            from: toIso(lastWeekStart),
            to: toIso(lastWeekEnd),
        },
        {
            label: 'Este mes',
            from: toIso(thisMonthStart),
            to: toIso(today),
        },
        {
            label: 'Último mes',
            from: toIso(lastMonthStart),
            to: toIso(lastMonthEnd),
        },
        {
            label: 'Este año',
            from: toIso(new Date(year, 0, 1)),
            to: toIso(today),
        },
        {
            label: 'Último año',
            from: toIso(new Date(year - 1, 0, 1)),
            to: toIso(new Date(year - 1, 11, 31)),
        },
    ];
}

export interface DateRangePickerProps {
    /** Inicio del rango, yyyy-mm-dd; '' si no hay. */
    from: string;
    /** Fin del rango, yyyy-mm-dd; '' si no hay. */
    to: string;
    onChange: (from: string, to: string) => void;
    placeholder?: string;
}

interface PanelPosition {
    top: number;
    left: number;
    width: number;
}

interface VisibleMonth {
    year: number;
    month: number;
}

export function DateRangePicker({
    from,
    to,
    onChange,
    placeholder = 'Selecciona un rango',
}: DateRangePickerProps) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<PanelPosition | null>(null);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [leftMonth, setLeftMonth] = useState<VisibleMonth>(() => {
        const base = from ? fromIso(from) : new Date();

        return { year: base.getFullYear(), month: base.getMonth() };
    });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const close = useCallback(() => setOpen(false), []);
    // La raíz envuelve el botón y no el panel (que vive en un portal): así un
    // clic sobre el propio botón no cuenta como "afuera" y no lo cierra para
    // reabrirlo enseguida. El panel se reconoce por `data-floating-panel`.
    const rootRef = useDismiss<HTMLDivElement>(close);

    const openPanel = () => {
        const base = from ? fromIso(from) : new Date();
        setLeftMonth({ year: base.getFullYear(), month: base.getMonth() });
        // Los atajos se calculan al abrir, no al renderizar: dependen de la
        // hora actual y un render debe dar siempre lo mismo.
        setPresets(getPresets());

        const rect = triggerRef.current?.getBoundingClientRect();

        if (rect) {
            const width = Math.min(720, window.innerWidth - 24);
            setPos({
                top: rect.bottom + 6,
                left: Math.min(
                    Math.max(12, rect.left),
                    window.innerWidth - width - 12,
                ),
                width,
            });
        }

        setOpen(true);
    };

    /*
      Si no cabe debajo, se coloca encima del campo.

      El calendario se anclaba siempre bajo el campo, y dentro de un modal el
      campo suele quedar a media pantalla: el panel se salía por abajo y se
      veía cortado justo por los días, que es lo único que hay que tocar. Se
      corrige después de montarlo porque hasta entonces no se sabe cuánto
      mide.
    */
    useLayoutEffect(() => {
        if (!open || !pos) {
            return;
        }

        const panel = panelRef.current?.getBoundingClientRect();
        const field = triggerRef.current?.getBoundingClientRect();

        if (!panel || !field) {
            return;
        }

        const margin = 12;
        const fitsBelow = pos.top + panel.height <= window.innerHeight - margin;

        if (fitsBelow) {
            return;
        }

        // Encima si hay sitio; si tampoco, pegado al borde y que scrollee.
        const above = field.top - panel.height - 6;
        const top =
            above >= margin
                ? above
                : Math.max(margin, window.innerHeight - panel.height - margin);

        if (Math.abs(top - pos.top) > 1) {
            setPos({ ...pos, top });
        }
    }, [open, pos]);

    const pick = (iso: string) => {
        // Rango completo (o vacío): el clic empieza uno nuevo.
        if (!from || to) {
            onChange(iso, '');

            return;
        }

        if (iso >= from) {
            onChange(from, iso);
        } else {
            onChange(iso, from);
        }

        setOpen(false);
    };

    const applyPreset = (preset: Preset) => {
        onChange(preset.from, preset.to);
        setOpen(false);
    };

    const changeMonth = (delta: number) =>
        setLeftMonth((prev) => {
            const total = prev.year * 12 + prev.month + delta;

            return {
                year: Math.floor(total / 12),
                month: ((total % 12) + 12) % 12,
            };
        });

    const changeYear = (delta: number) =>
        setLeftMonth((prev) => ({ ...prev, year: prev.year + delta }));

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => (open ? setOpen(false) : openPanel())}
                aria-expanded={open}
                aria-haspopup="dialog"
                className="flex w-full cursor-pointer items-center gap-2 rounded-field border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-ink-muted"
            >
                <span
                    className={cn(
                        'flex-1 truncate text-left',
                        !from && !to && 'text-ink-soft',
                    )}
                >
                    {from || to ? (
                        <>
                            {formatDisplay(from) || '...'}{' '}
                            <span className="text-ink-soft">→</span>{' '}
                            {formatDisplay(to) || '...'}
                        </>
                    ) : (
                        placeholder
                    )}
                </span>
                <Calendar
                    className="size-3.5 shrink-0 text-ink-soft"
                    aria-hidden
                />
            </button>

            {open &&
                pos &&
                createPortal(
                    <div
                        ref={panelRef}
                        data-floating-panel
                        style={{
                            top: pos.top,
                            left: pos.left,
                            width: pos.width,
                            maxHeight: 'calc(100vh - 24px)',
                        }}
                        className="fixed z-60 flex overflow-auto rounded-xl border border-line bg-surface shadow-panel"
                    >
                        {/* atajos */}
                        <div className="hidden w-36 shrink-0 flex-col gap-0.5 border-r border-line p-2 sm:flex">
                            {presets.map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => applyPreset(preset)}
                                    className="cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-ink-muted hover:bg-surface-alt hover:text-ink"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        {/* dos meses */}
                        <div className="flex flex-1 flex-col gap-2 p-3 sm:flex-row sm:gap-1">
                            <MonthGrid
                                year={leftMonth.year}
                                month={leftMonth.month}
                                from={from}
                                to={to}
                                onPick={pick}
                                nav={{
                                    onPrevYear: () => changeYear(-1),
                                    onPrevMonth: () => changeMonth(-1),
                                }}
                            />
                            <MonthGrid
                                year={
                                    leftMonth.month === 11
                                        ? leftMonth.year + 1
                                        : leftMonth.year
                                }
                                month={(leftMonth.month + 1) % 12}
                                from={from}
                                to={to}
                                onPick={pick}
                                nav={{
                                    onNextMonth: () => changeMonth(1),
                                    onNextYear: () => changeYear(1),
                                }}
                            />
                        </div>
                    </div>,
                    // En #modal-root y no en body: así el panel conserva el
                    // acento del sistema abierto (ver components/ui/modal).
                    document.getElementById('modal-root') ?? document.body,
                )}
        </div>
    );
}

interface MonthGridProps {
    year: number;
    month: number;
    from: string;
    to: string;
    onPick: (iso: string) => void;
    nav: {
        onPrevYear?: () => void;
        onPrevMonth?: () => void;
        onNextMonth?: () => void;
        onNextYear?: () => void;
    };
}

function MonthGrid({ year, month, from, to, onPick, nav }: MonthGridProps) {
    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7; // lunes = 0
    const gridStart = new Date(year, month, 1 - offset);

    // 6 semanas fijas: el calendario no cambia de alto al pasar de mes.
    const cells = Array.from({ length: 42 }, (_, i) => {
        const date = new Date(gridStart);
        date.setDate(date.getDate() + i);

        return date;
    });

    return (
        <div className="flex-1">
            <div className="mb-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-0.5">
                    {nav.onPrevYear && (
                        <IconButton
                            onClick={nav.onPrevYear}
                            label="Año anterior"
                        >
                            <ChevronsLeft className="size-3.5" aria-hidden />
                        </IconButton>
                    )}
                    {nav.onPrevMonth && (
                        <IconButton
                            onClick={nav.onPrevMonth}
                            label="Mes anterior"
                        >
                            <ChevronLeft className="size-3.5" aria-hidden />
                        </IconButton>
                    )}
                </div>
                <p className="text-[13px] font-semibold text-ink">
                    {MONTHS[month]} {year}
                </p>
                <div className="flex items-center gap-0.5">
                    {nav.onNextMonth && (
                        <IconButton
                            onClick={nav.onNextMonth}
                            label="Mes siguiente"
                        >
                            <ChevronRight className="size-3.5" aria-hidden />
                        </IconButton>
                    )}
                    {nav.onNextYear && (
                        <IconButton
                            onClick={nav.onNextYear}
                            label="Año siguiente"
                        >
                            <ChevronsRight className="size-3.5" aria-hidden />
                        </IconButton>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-7 gap-y-0.5 px-1 text-center text-[11px]">
                {WEEKDAYS.map((day) => (
                    <span key={day} className="py-1 font-medium text-ink-soft">
                        {day}
                    </span>
                ))}

                {cells.map((date) => {
                    const iso = toIso(date);
                    const outsideMonth = date.getMonth() !== month;
                    const isStart = iso === from;
                    const isEnd = iso === to;
                    const inRange = !!from && !!to && iso > from && iso < to;

                    return (
                        <button
                            key={iso}
                            type="button"
                            disabled={outsideMonth}
                            onClick={() => onPick(iso)}
                            className={cn(
                                'relative py-1 text-[12.5px]',
                                outsideMonth
                                    ? 'cursor-default text-line-strong'
                                    : 'cursor-pointer text-ink hover:bg-surface-alt',
                                inRange &&
                                    'bg-accent-soft text-accent-ink hover:bg-accent-soft',
                                (isStart || isEnd) &&
                                    'rounded-full bg-accent font-semibold text-white hover:bg-accent',
                            )}
                        >
                            {date.getDate()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function IconButton({
    onClick,
    label,
    children,
}: {
    onClick: () => void;
    label: string;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="cursor-pointer rounded p-1 text-ink-soft hover:bg-surface-alt hover:text-ink"
        >
            {children}
        </button>
    );
}
