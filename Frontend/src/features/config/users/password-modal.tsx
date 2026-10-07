import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { resetUserPassword } from '@/features/config/users/users-api';
import type { SystemUser } from '@/features/config/users/users-api';

type PasswordModalProps = {
    user: SystemUser;
    /** Es el usuario de la sesión: su sesión actual no se cierra. */
    isSelf: boolean;
    onClose: () => void;
    onSaved: (message: string) => void;
};

/** Cambia la contraseña de un usuario sin pedir la anterior. */
export function PasswordModal({
    user,
    isSelf,
    onClose,
    onSaved,
}: PasswordModalProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string>();
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    const save = async () => {
        if (password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres.');

            return;
        }

        setSaving(true);

        try {
            await resetUserPassword(user.id, password);
            onSaved('Contraseña actualizada.');
        } catch (failure) {
            if (failure instanceof ApiError && failure.errors.password) {
                setError(failure.errors.password[0]);
            } else {
                toast.error(
                    failure instanceof Error
                        ? failure.message
                        : 'No se pudo cambiar la contraseña.',
                );
            }

            setSaving(false);
        }
    };

    return (
        <Modal
            open
            title="Reiniciar contraseña"
            description={user.name}
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button size="sm" loading={saving} onClick={() => void save()}>
                        {saving ? 'Guardando…' : 'Cambiar contraseña'}
                    </Button>
                </>
            }
        >
            <Input
                label="Nueva contraseña"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={error}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                autoFocus
            />
            <p className="mt-3 text-xs text-ink-muted">
                {isSelf
                    ? 'Tu sesión actual sigue abierta.'
                    : 'Se cerrarán las sesiones abiertas de este usuario: tendrá que entrar con la nueva contraseña.'}
            </p>
        </Modal>
    );
}
