import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiUser } from '@/lib/api';
import { ApiError, clearToken, fetchUser, getToken, logout } from '@/lib/api';

/**
 * Usuario autenticado de la pantalla actual. Sin token, o si la API responde
 * 401, redirige al login.
 */
export function useAuthUser() {
    const navigate = useNavigate();
    const [user, setUser] = useState<ApiUser | null>(null);

    useEffect(() => {
        if (!getToken()) {
            navigate('/login', { replace: true });

            return;
        }

        fetchUser()
            .then(setUser)
            .catch((error) => {
                if (error instanceof ApiError && error.status === 401) {
                    clearToken();
                    navigate('/login', { replace: true });
                }
            });
    }, [navigate]);

    const signOut = async () => {
        await logout().catch(() => undefined);
        navigate('/login');
    };

    return { user, signOut };
}
