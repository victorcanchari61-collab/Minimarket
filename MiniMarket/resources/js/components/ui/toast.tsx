import { CircleAlert, CircleCheck, X } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react';
import { cn } from '@/lib/utils';

/**
 * Aviso momentáneo, arriba del todo y fuera del formulario.
 *
 * Existe porque el error al pie de un formulario largo no se ve: el usuario
 * pulsa Guardar, la página no se mueve y parece que el botón no hizo nada. Sale
 * siempre en el mismo sitio, y el campo culpable se marca aparte: el aviso dice
 * QUÉ pasa, el campo dice DÓNDE.
 */

type Tone = 'error' | 'success';

interface ToastItem {
    id: number;
    message: string;
    tone: Tone;
    /** Sistema donde se mostró: el aviso cuelga fuera del layout y no hereda su data-system. */
    system: string | undefined;
}

interface ToastApi {
    /** Un fallo: se queda 6 s, que un error hay que alcanzar a leerlo. */
    error: (message: string) => void;
    /** Una confirmación: 3 s basta. */
    success: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION: Record<Tone, number> = { error: 6000, success: 3000 };

/** /sistemas/erp/... → "erp". Fuera de un sistema no hay acento propio. */
function currentSystem(): string | undefined {
    const [section, key] = window.location.pathname.split('/').filter(Boolean);

    return section === 'sistemas' ? key : undefined;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const next = useRef(0);

    const close = useCallback((id: number) => {
        setItems((current) => current.filter((item) => item.id !== id));
    }, []);

    const show = useCallback(
        (message: string, tone: Tone) => {
            const id = ++next.current;

            setItems((current) => [
                ...current,
                { id, message, tone, system: currentSystem() },
            ]);
            window.setTimeout(() => close(id), DURATION[tone]);
        },
        [close],
    );

    const api = useMemo<ToastApi>(
        () => ({
            error: (message) => show(message, 'error'),
            success: (message) => show(message, 'success'),
        }),
        [show],
    );

    return (
        <ToastContext.Provider value={api}>
            {children}

            <div className="pointer-events-none fixed top-20 right-4 z-[200] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
                {items.map((item) => (
                    <ToastCard
                        key={item.id}
                        item={item}
                        onClose={() => close(item.id)}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastCard({
    item,
    onClose,
}: {
    item: ToastItem;
    onClose: () => void;
}) {
    // Un fallo va en rojo siempre: el color del sistema identifica dónde estás,
    // no que algo salió mal.
    const isError = item.tone === 'error';

    return (
        <div
            data-system={item.system}
            role="alert"
            className={cn(
                'pointer-events-auto flex w-full items-start gap-2 rounded-field p-3 text-sm text-white shadow-panel',
                isError ? 'bg-danger' : 'bg-accent',
            )}
        >
            {isError ? (
                <CircleAlert className="mt-0.5 size-[18px] shrink-0" aria-hidden />
            ) : (
                <CircleCheck className="mt-0.5 size-[18px] shrink-0" aria-hidden />
            )}

            <span className="flex-1">{item.message}</span>

            <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar aviso"
                className="cursor-pointer opacity-70 hover:opacity-100"
            >
                <X className="size-4" aria-hidden />
            </button>
        </div>
    );
}

/** Avisa fuera del formulario. Sin provider no hace nada: nunca revienta una pantalla por un aviso. */
export function useToast(): ToastApi {
    return (
        useContext(ToastContext) ?? { error: () => undefined, success: () => undefined }
    );
}
