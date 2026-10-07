import { useState } from 'react';
import { Dropdown } from '@/components/data/dropdown';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { createUser, updateUser } from '@/features/config/users/users-api';
import type {
    SystemUser,
    UserRole,
    UserStatus,
} from '@/features/config/users/users-api';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UserModalProps = {
    /** null = usuario nuevo. */
    user: SystemUser | null;
    roles: UserRole[];
    /** Es el usuario de la sesión: no puede desactivarse a sí mismo. */
    isSelf: boolean;
    onClose: () => void;
    onSaved: (message: string) => void;
};

/** Crear o editar un usuario, con sus roles. */
export function UserModal({
    user,
    roles,
    isSelf,
    onClose,
    onSaved,
}: UserModalProps) {
    const [name, setName] = useState(user?.name ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<UserStatus>(user?.status ?? 'active');
    const [roleIds, setRoleIds] = useState<number[]>(
        user?.roles.map((role) => role.id) ?? [],
    );
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const toast = useToast();

    const toggleRole = (id: number) =>
        setRoleIds((current) =>
            current.includes(id)
                ? current.filter((value) => value !== id)
                : [...current, id],
        );

    const save = async () => {
        const next: Record<string, string> = {};

        if (!name.trim()) next.name = 'Escribe el nombre.';
        if (!EMAIL.test(email.trim())) next.email = 'Escribe un correo válido.';
        if (!user && password.length < 8)
            next.password = 'La contraseña debe tener al menos 8 caracteres.';

        setErrors(next);

        if (Object.keys(next).length > 0) {
            return;
        }

        const payload = {
            name: name.trim(),
            email: email.trim(),
            status,
            role_ids: roleIds,
        };

        setSaving(true);

        try {
            if (user) {
                await updateUser(user.id, payload);
                onSaved('Usuario actualizado.');
            } else {
                await createUser({ ...payload, password });
                onSaved('Usuario creado.');
            }
        } catch (error) {
            if (error instanceof ApiError && Object.keys(error.errors).length) {
                setErrors(
                    Object.fromEntries(
                        Object.entries(error.errors).map(([field, messages]) => [
                            field,
                            messages[0],
                        ]),
                    ),
                );
            } else {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : 'No se pudo guardar el usuario.',
                );
            }

            setSaving(false);
        }
    };

    return (
        <Modal
            open
            title={user ? 'Editar usuario' : 'Nuevo usuario'}
            description="Configuraciones › Usuarios"
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button size="sm" loading={saving} onClick={() => void save()}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Input
                    label="Nombre"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    error={errors.name}
                    className="sm:col-span-2"
                    autoFocus
                />
                <Input
                    label="Correo"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    error={errors.email}
                    autoComplete="off"
                />
                {user ? (
                    <Dropdown
                        label="Estado"
                        value={status}
                        onChange={(value) => setStatus(value as UserStatus)}
                        options={
                            isSelf
                                ? STATUS_OPTIONS.filter(
                                      (option) => option.value === 'active',
                                  )
                                : STATUS_OPTIONS
                        }
                        error={errors.status}
                    />
                ) : (
                    <Input
                        label="Contraseña"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        error={errors.password}
                        autoComplete="new-password"
                        placeholder="Mínimo 8 caracteres"
                    />
                )}

                <fieldset className="sm:col-span-2">
                    <legend className="mb-2 text-sm font-medium text-ink">
                        Roles
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {roles.map((role) => (
                            <Checkbox
                                key={role.id}
                                label={role.name}
                                checked={roleIds.includes(role.id)}
                                onChange={() => toggleRole(role.id)}
                            />
                        ))}
                    </div>
                    {errors.role_ids && (
                        <p className="mt-1.5 text-xs text-danger">
                            {errors.role_ids}
                        </p>
                    )}
                    <p className="mt-2 text-xs text-ink-muted">
                        El usuario recibe todos los permisos de sus roles. Los
                        permisos individuales se dan en Roles y permisos.
                    </p>
                </fieldset>
            </div>
        </Modal>
    );
}
