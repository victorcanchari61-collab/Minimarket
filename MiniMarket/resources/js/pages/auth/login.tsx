import { Head, router } from '@inertiajs/react';
import { KeyRound, Mail } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import PasswordInput from '@/components/password-input';
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
                    <div className="grid gap-2">
                        <label htmlFor="email" className="text-sm font-medium">
                            Correo electrónico
                        </label>
                        <div className="relative">
                            <Mail
                                aria-hidden
                                className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground"
                            />
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                required
                                autoFocus
                                autoComplete="email"
                                placeholder="nombre@empresa.com"
                                className="pl-11"
                                aria-invalid={!!errors.email}
                                aria-describedby={
                                    errors.email ? 'email-error' : undefined
                                }
                            />
                        </div>
                        {errors.email && (
                            <p
                                id="email-error"
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {errors.email}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <label
                            htmlFor="password"
                            className="text-sm font-medium"
                        >
                            Contraseña
                        </label>
                        <PasswordInput
                            id="password"
                            name="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            required
                            autoComplete="current-password"
                            placeholder="Tu contraseña"
                            aria-invalid={!!errors.password}
                        />
                        {errors.password && (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {errors.password}
                            </p>
                        )}
                    </div>

                    <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm">
                        <Checkbox
                            name="remember"
                            checked={remember}
                            onChange={(event) =>
                                setRemember(event.target.checked)
                            }
                        />
                        Recordarme
                    </label>

                    <Button
                        ref={submitRef}
                        type="submit"
                        disabled={processing}
                        data-test="login-button"
                        className="mt-1 h-12 w-full text-[15px] font-semibold shadow-[0_10px_20px_-10px_var(--sys-600)] active:translate-y-px"
                    >
                        {processing ? 'Ingresando…' : 'Iniciar sesión'}
                    </Button>
                </div>

                {demoCredentials && (
                    <Button
                        variant="outline"
                        onClick={fillDemoCredentials}
                        className="h-11 w-full border-dashed"
                        data-test="demo-credentials-button"
                    >
                        <KeyRound aria-hidden />
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
