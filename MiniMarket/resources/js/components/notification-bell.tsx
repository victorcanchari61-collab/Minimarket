import { Bell } from 'lucide-react';

type NotificationBellProps = {
    count?: number;
    onClick?: () => void;
};

export default function NotificationBell({
    count = 0,
    onClick,
}: NotificationBellProps) {
    const label =
        count > 0 ? `Notificaciones: ${count} sin leer` : 'Notificaciones';

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="relative grid size-11 shrink-0 place-items-center rounded-full border border-[#e5e7eb] bg-white text-[#1a1033] shadow-[0_6px_16px_-8px_rgb(16_24_40/0.25)] transition-[transform,box-shadow] outline-none hover:-translate-y-px hover:shadow-[0_10px_20px_-10px_rgb(16_24_40/0.3)] focus-visible:ring-[3px] focus-visible:ring-(--sys-400,var(--ring))"
        >
            <Bell className="size-[18px]" aria-hidden />
            {count > 0 && (
                <span
                    aria-hidden
                    className="absolute -top-1 -right-1 grid min-w-[18px] place-items-center rounded-full bg-(--sys-600,var(--primary)) px-1 text-[10px] leading-[18px] font-bold text-white ring-2 ring-white"
                >
                    {count > 9 ? '9+' : count}
                </span>
            )}
        </button>
    );
}
