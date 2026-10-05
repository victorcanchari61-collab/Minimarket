import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { ApiUser } from '@/lib/api';
import { ApiError, clearToken, fetchUser, getToken, logout } from '@/lib/api';

/**
 * Usuario autenticado de la pantalla actual. Sin token, o si la API responde
 * 401, redirige al login.
 */
export function useAuthUser() {
    const [user, setUser] = useState<ApiUser | null>(null);

    useEffect(() => {
        if (!getToken()) {
            router.visit('/login', { replace: true });

            return;
        }

        fetchUser()
            .then(setUser)
            .catch((error) => {
                if (error instanceof ApiError && error.status === 401) {
                    clearToken();
                    router.visit('/login', { replace: true });
                }
            });
    }, []);

    const signOut = async () => {
        await logout().catch(() => undefined);
        router.visit('/login');
    };

    return { user, signOut };
}
