import { apiGet } from '@/lib/api';

export type BranchKind = 'store' | 'distribution';

export type Branch = {
    id: number;
    code: string;
    name: string;
    address: string;
    kind: BranchKind;
    kind_label: string;
};

export function fetchBranches(): Promise<Branch[]> {
    return apiGet<Branch[]>('/company/branches');
}

const ACTIVE_KEY = 'minimarket.branch';
const listeners = new Set<() => void>();

/** Sucursal en la que trabaja el usuario (la elige en el menú de su cuenta). */
export function getActiveBranchId(): number | null {
    try {
        const value = Number(window.localStorage.getItem(ACTIVE_KEY));

        return Number.isInteger(value) && value > 0 ? value : null;
    } catch {
        return null;
    }
}

export function setActiveBranchId(id: number): void {
    try {
        window.localStorage.setItem(ACTIVE_KEY, String(id));
    } catch {
        // Sin almacenamiento: no se recuerda la elección.
    }

    listeners.forEach((listener) => listener());
}

const changeListeners = new Set<() => void>();

/** Avisa que las sucursales cambiaron (se creó, editó o eliminó una): el selector de la cuenta las vuelve a pedir. */
export function notifyBranchesChanged(): void {
    changeListeners.forEach((listener) => listener());
}

export function subscribeBranchesChanged(listener: () => void): () => void {
    changeListeners.add(listener);

    return () => changeListeners.delete(listener);
}

export function subscribeActiveBranch(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}
