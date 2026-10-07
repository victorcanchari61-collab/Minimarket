import { useCallback, useEffect, useState } from 'react';
import { getToken } from '@/lib/api';
import { visibleNav } from '@/lib/navigation';
import { fetchAccess } from '@/lib/permissions';
import type { Access } from '@/lib/permissions';
import type { PortalKey } from '@/lib/systems';

// Se conserva entre pantallas para que el menú no parpadee al navegar, pero
// solo vale para la sesión (token) con la que se pidió.
let cached: { token: string; access: Access } | null = null;

function cachedAccess(): Access | null {
    const token = getToken();

    return token && cached?.token === token ? cached.access : null;
}

/**
 * Qué puede hacer el usuario. `ready` es false hasta que llega la respuesta de
 * la API: mientras tanto no se muestra ni se oculta nada.
 */
export function usePermissions() {
    const [access, setAccess] = useState<Access | null>(cachedAccess);

    useEffect(() => {
        const token = getToken();

        if (!token) {
            return;
        }

        let alive = true;

        fetchAccess()
            .then((next) => {
                cached = { token, access: next };

                if (alive) {
                    setAccess(next);
                }
            })
            .catch(() => undefined); // un 401 lo maneja useAuthUser

        return () => {
            alive = false;
        };
    }, []);

    const can = useCallback(
        (code: string) => access?.actions.has(code) ?? false,
        [access],
    );

    /** El sistema tiene al menos una pantalla que el usuario puede ver. */
    const canEnter = useCallback(
        (key: PortalKey) => visibleNav(key, can).length > 0,
        [can],
    );

    return { ready: access !== null, can, canEnter };
}
