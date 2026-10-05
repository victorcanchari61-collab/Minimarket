import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ApiUser } from '@/lib/api';
import { ApiError, clearToken, fetchUser, getToken, logout } from '@/lib/api';

export default function Dashboard() {
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

    return (
        <>
            <Head title="Panel" />
            <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 px-6">
                <h1 className="text-2xl font-bold tracking-tight">
                    {user ? `Hola, ${user.name}` : 'Cargando…'}
                </h1>
                {user && (
                    <p className="text-muted-foreground">
                        Sesión iniciada como {user.email}.
                    </p>
                )}
                <Button
                    onClick={signOut}
                    variant="outline"
                    className="h-11 px-5"
                >
                    Cerrar sesión
                </Button>
            </main>
        </>
    );
}
