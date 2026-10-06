import { CircleHelp, Trash2, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

export type ConfirmTone = 'danger' | 'warning' | 'question';

const TONES: Record<ConfirmTone, { icon: ReactNode; box: string; button: string }> = {
    danger: {
        icon: <Trash2 className="size-5" aria-hidden />,
        box: 'tone-danger bg-(--tone-bg) text-(--tone-fg)',
        button: 'bg-danger hover:not-disabled:bg-danger/90',
    },
    warning: {
        icon: <TriangleAlert className="size-5" aria-hidden />,
        box: 'tone-warning bg-(--tone-bg) text-(--tone-fg)',
        button: 'bg-warning text-ink hover:not-disabled:bg-warning/90',
    },
    question: {
        icon: <CircleHelp className="size-5" aria-hidden />,
        box: 'tone-neutral bg-(--tone-bg) text-(--tone-fg)',
        button: '',
    },
};

export interface ConfirmOptions {
    title: string;
    /** Qué va a pasar, en una línea. */
    message: ReactNode;
    /** Texto del botón que confirma. Por defecto "Aceptar". */
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ConfirmTone;
}

export interface ConfirmDialogProps extends ConfirmOptions {
    open: boolean;
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Diálogo de confirmación. No se usa directo: normalmente se pide con el hook
 * useConfirm, que se encarga del estado.
 */
export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Aceptar',
    cancelLabel = 'Cancelar',
    tone = 'question',
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const { icon, box, button } = TONES[tone];

    return (
        <Modal
            open={open}
            title={title}
            size="sm"
            onClose={onCancel}
            footer={
                <>
                    <Button variant="secondary" size="sm" onClick={onCancel}>
                        {cancelLabel}
                    </Button>
                    <Button
                        size="sm"
                        loading={loading}
                        onClick={onConfirm}
                        className={button}
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <div className="flex gap-3">
                <span
                    className={cn(
                        'inline-flex size-10 shrink-0 items-center justify-center rounded-field',
                        box,
                    )}
                >
                    {icon}
                </span>
                <p className="pt-2 text-sm text-ink-muted">{message}</p>
            </div>
        </Modal>
    );
}
