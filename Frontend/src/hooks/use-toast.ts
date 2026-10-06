import { useContext } from 'react';
import { ToastContext } from '@/components/ui/toast-context';
import type { ToastApi } from '@/components/ui/toast-context';

/** Avisa fuera del formulario. Sin provider no hace nada: nunca revienta una pantalla por un aviso. */
export function useToast(): ToastApi {
    return (
        useContext(ToastContext) ?? {
            error: () => undefined,
            success: () => undefined,
        }
    );
}
