import { createContext } from 'react';

export interface ToastApi {
    /** Un fallo: se queda 6 s, que un error hay que alcanzar a leerlo. */
    error: (message: string) => void;
    /** Una confirmación: 3 s basta. */
    success: (message: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
