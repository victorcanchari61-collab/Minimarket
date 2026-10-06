import { useCallback, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { ConfirmOptions } from '@/components/ui/confirm-dialog';

interface ConfirmState extends ConfirmOptions {
    action: () => Promise<void> | void;
}

/**
 * Pide confirmación antes de una acción.
 *
 *   const { confirm, dialog } = useConfirm();
 *   confirm({ title: 'Eliminar', message: '…', tone: 'danger', action: () => remove(x) });
 *   return <>{dialog}</>;
 *
 * El hook se encarga del estado y del "cargando" mientras la acción corre, así
 * ninguna pantalla declara tres useState para lo mismo.
 */
export function useConfirm() {
    const [state, setState] = useState<ConfirmState | null>(null);
    const [loading, setLoading] = useState(false);

    const confirm = useCallback((options: ConfirmState) => setState(options), []);

    const accept = useCallback(async () => {
        if (!state) {
            return;
        }

        setLoading(true);

        try {
            await state.action();
            setState(null);
        } finally {
            setLoading(false);
        }
    }, [state]);

    const dialog = (
        <ConfirmDialog
            open={state !== null}
            title={state?.title ?? ''}
            message={state?.message ?? ''}
            confirmLabel={state?.confirmLabel}
            cancelLabel={state?.cancelLabel}
            tone={state?.tone}
            loading={loading}
            onConfirm={() => void accept()}
            onCancel={() => setState(null)}
        />
    );

    return { confirm, dialog };
}
