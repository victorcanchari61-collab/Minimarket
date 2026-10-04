import { Form, Head } from '@inertiajs/react';
import { Lock, Mail } from 'lucide-react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TeamInvitationAlert from '@/components/team-invitation-alert';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import PasskeyVerify from '@/components/passkey-verify';
import type { TeamInvitationContext } from '@/types';

const LINK_CLASS = 'font-medium text-primary decoration-transparent';

type Props = {
    status?: string;
    canResetPassword: boolean;
    teamInvitation?: TeamInvitationContext | null;
};

export default function Login({
    status,
    canResetPassword,
    teamInvitation,
}: Props) {
    return (
        <>
            <Head title="Iniciar sesión" />

            {teamInvitation && (
                <TeamInvitationAlert
                    invitation={teamInvitation}
                    action="Log in"
                />
            )}

            <div className="[&_span.bg-background]:bg-(--sys-50) dark:[&_span.bg-background]:bg-background [&_button]:h-12 [&_button]:rounded-xl [&_button]:text-sm [&_button]:font-semibold">
                <PasskeyVerify
                    label="Ingresar con una llave de acceso"
                    loadingLabel="Verificando…"
                    separator="O continúa con tu correo"
                />
            </div>

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Correo electrónico</Label>
                                <div className="relative">
                                    <Mail
                                        aria-hidden
                                        className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        id="email"
                                        type="email"
                                        name="email"
                                        required
                                        autoFocus
                                        tabIndex={1}
                                        autoComplete="email"
                                        placeholder="nombre@empresa.com"
                                        className="h-12 rounded-xl bg-card pl-11"
                                        aria-invalid={!!errors.email}
                                    />
                                </div>
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">Contraseña</Label>
                                <div className="relative">
                                    <Lock
                                        aria-hidden
                                        className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-[18px] -translate-y-1/2 text-muted-foreground"
                                    />
                                    <PasswordInput
                                        id="password"
                                        name="password"
                                        required
                                        tabIndex={2}
                                        autoComplete="current-password"
                                        placeholder="Tu contraseña"
                                        className="h-12 rounded-xl bg-card pl-11"
                                        showLabel="Mostrar contraseña"
                                        hideLabel="Ocultar contraseña"
                                        aria-invalid={!!errors.password}
                                    />
                                </div>
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2.5">
                                    <Checkbox
                                        id="remember"
                                        name="remember"
                                        tabIndex={3}
                                        className="size-[18px] rounded-[5px]"
                                    />
                                    <Label
                                        htmlFor="remember"
                                        className="font-normal"
                                    >
                                        Recordarme
                                    </Label>
                                </div>
                                {canResetPassword && (
                                    <TextLink
                                        href={request()}
                                        className={LINK_CLASS}
                                        tabIndex={5}
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </TextLink>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="mt-1 h-12 w-full rounded-xl text-[15px] font-semibold shadow-[0_10px_20px_-10px_var(--sys-600)] transition-[background-color,box-shadow,transform] active:translate-y-px"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                {processing ? 'Ingresando…' : 'Iniciar sesión'}
                            </Button>
                        </div>

                        <div className="text-center text-sm text-muted-foreground">
                            ¿No tienes cuenta?{' '}
                            <TextLink
                                href={register({
                                    query: {
                                        invitation: teamInvitation?.code,
                                    },
                                })}
                                data-test="register-link"
                                className={LINK_CLASS}
                                tabIndex={5}
                            >
                                Regístrate
                            </TextLink>
                        </div>
                    </>
                )}
            </Form>

            {status && (
                <div className="mt-6 text-center text-sm font-medium text-green-700 dark:text-green-400">
                    {status}
                </div>
            )}
        </>
    );
}

Login.layout = {
    title: 'Bienvenido de nuevo',
    description: 'Ingresa a tu cuenta para continuar.',
};
