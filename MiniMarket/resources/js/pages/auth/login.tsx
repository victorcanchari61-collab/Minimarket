import { Head, router } from '@inertiajs/react';
import { KeyRound, Mail } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ApiError, getToken, login } from '@/lib/api';

type Props = {
    demoCredentials?: { email: string; password: string } | null;
};

export default function Login({ demoCredentials }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const submitRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (getToken()) {
            router.visit('/sistemas', { replace: true });
        }
    }, []);

    const fillDemoCredentials = () => {
        if (!demoCredentials) {
            return;
        }

        setEmail(demoCredentials.email);
        setPassword(demoCredentials.password);
        setErrors({});
        submitRef.current?.focus();
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        try {
            await login(email, password, remember);
            router.visit('/sistemas');
        } catch (error) {
            if (error instanceof ApiError) {
                setErrors({
                    email: error.errors.email?.[0] ?? error.message,
                    password: error.errors.password?.[0] ?? '',
                });
            } else {
                setErrors({ email: 'No se pudo conectar con el servidor.' });
            }

            setProcessing(false);
        }
    };

    return (
        <>
            <Head title="Iniciar sesión" />

            <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
                <div className="grid gap-5">
                    <Input
                        label="Correo electrónico"
                        icon={<Mail aria-hidden />}
                        type="email"
                        name="email"
                        size="lg"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        error={errors.email}
                        required
                        autoFocus
                        autoComplete="email"
                        placeholder="nombre@empresa.com"
                    />

                    <Input
                        label="Contraseña"
                        type="password"
                        name="password"
                        size="lg"
                        revealable
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        error={errors.password}
                        required
                        autoComplete="current-password"
                        placeholder="Tu contraseña"
                    />

                    <Checkbox
                        label="Recordarme"
                        name="remember"
                        checked={remember}
                        onChange={(event) => setRemember(event.target.checked)}
                        className="w-fit"
                    />

                    <Button
                        ref={submitRef}
                        type="submit"
                        size="lg"
                        block
                        loading={processing}
                        data-test="login-button"
                        className="mt-1 shadow-[0_10px_20px_-10px_var(--sys-600)]"
                    >
                        {processing ? 'Ingresando…' : 'Iniciar sesión'}
                    </Button>
                </div>

                {demoCredentials && (
                    <Button
                        variant="secondary"
                        block
                        onClick={fillDemoCredentials}
                        className="border-dashed"
                        data-test="demo-credentials-button"
                    >
                        <KeyRound className="size-4" aria-hidden />
                        Usar credenciales de prueba
                    </Button>
                )}
            </form>
        </>
    );
}

Login.layout = {
    title: 'Bienvenido de nuevo',
    description: 'Ingresa a tu cuenta para continuar.',
};
