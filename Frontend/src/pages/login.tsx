import { KeyRound, Mail } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { usePageTitle } from '@/hooks/use-page-title';
import type { DemoCredentials } from '@/lib/api';
import { ApiError, fetchDemoCredentials, getToken, login } from '@/lib/api';

export default function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [demo, setDemo] = useState<DemoCredentials | null>(null);
    const submitRef = useRef<HTMLButtonElement>(null);

    usePageTitle('Iniciar sesión');

    useEffect(() => {
        if (getToken()) {
            navigate('/sistemas', { replace: true });

            return;
        }

        // La API solo ofrece (y crea) el usuario de prueba en entorno local.
        void fetchDemoCredentials().then(setDemo);
    }, [navigate]);

    const fillDemoCredentials = () => {
        if (!demo) {
            return;
        }

        setEmail(demo.email);
        setPassword(demo.password);
        setErrors({});
        submitRef.current?.focus();
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        try {
            await login(email, password, remember);
            navigate('/sistemas');
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

            {demo && (
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
    );
}
