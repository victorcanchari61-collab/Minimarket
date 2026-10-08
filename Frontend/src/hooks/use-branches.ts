import { useEffect, useState, useSyncExternalStore } from 'react';
import { getToken } from '@/lib/api';
import {
    fetchBranches,
    getActiveBranchId,
    setActiveBranchId,
    subscribeActiveBranch,
    subscribeBranchesChanged,
} from '@/lib/branches';
import type { Branch } from '@/lib/branches';

// Igual que los permisos: se conserva entre pantallas, pero solo para la sesión.
let cached: { token: string; branches: Branch[] } | null = null;

function cachedBranches(): Branch[] | null {
    const token = getToken();

    return token && cached?.token === token ? cached.branches : null;
}

/**
 * Las sucursales y cuál es la activa. Si la elegida ya no existe (o nunca se
 * eligió), la activa es la primera tienda: un centro de distribución no vende.
 */
export function useBranches() {
    const [branches, setBranches] = useState<Branch[] | null>(cachedBranches);
    const storedId = useSyncExternalStore(
        subscribeActiveBranch,
        getActiveBranchId,
    );

    useEffect(() => {
        let alive = true;

        const load = () => {
            const token = getToken();

            if (!token) {
                return;
            }

            fetchBranches()
                .then((next) => {
                    cached = { token, branches: next };

                    if (alive) {
                        setBranches(next);
                    }
                })
                .catch(() => undefined); // un 401 lo maneja useAuthUser
        };

        load();

        // Si se crea, edita o elimina una sucursal, el selector se actualiza.
        const unsubscribe = subscribeBranchesChanged(load);

        return () => {
            alive = false;
            unsubscribe();
        };
    }, []);

    const list = branches ?? [];
    const active =
        list.find((branch) => branch.id === storedId) ??
        list.find((branch) => branch.kind === 'store') ??
        list[0] ??
        null;

    return { branches: list, active, select: setActiveBranchId };
}
