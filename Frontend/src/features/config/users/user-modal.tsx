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
    BranchOption,
    DocumentType,
    SystemUser,
    UserRole,
    UserStatus,
} from '@/features/config/users/users-api';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
];

const DOCUMENT_OPTIONS = [
    { value: '', label: 'Sin documento' },
    { value: 'dni', label: 'DNI' },
    { value: 'ce', label: 'Carné de extranjería' },
    { value: 'passport', label: 'Pasaporte' },
];

/** Lo mismo que valida el servidor, para avisar antes de enviar. */
const DOCUMENT_FORMAT: Record<DocumentType, { pattern: RegExp; hint: string }> = {
    dni: { pattern: /^\d{8}$/, hint: 'El DNI tiene 8 dígitos.' },
    ce: {
        pattern: /^[A-Za-z0-9]{9,12}$/,
        hint: 'El carné tiene entre 9 y 12 letras o números.',
    },
    passport: {
        pattern: /^[A-Za-z0-9]{6,12}$/,
        hint: 'El pasaporte tiene entre 6 y 12 letras o números.',
    },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-\s]{6,20}$/;

type UserModalProps = {
    /** null = usuario nuevo. */
    user: SystemUser | null;
    roles: UserRole[];
    /** Las sucursales que se pueden asignar. */
    branches: BranchOption[];
    /** Es el usuario de la sesión: no puede desactivarse a sí mismo. */
    isSelf: boolean;
    onClose: () => void;
    onSaved: (message: string) => void;
};

/** Crear o editar un usuario, con sus datos y sus roles. */
export function UserModal({
    user,
    roles,
    branches,
    isSelf,
    onClose,
    onSaved,
}: UserModalProps) {
    const [name, setName] = useState(user?.name ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [phone, setPhone] = useState(user?.phone ?? '');
    const [position, setPosition] = useState(user?.position ?? '');
    const [documentType, setDocumentType] = useState<DocumentType | ''>(
        user?.document_type ?? '',
    );
    const [documentNumber, setDocumentNumber] = useState(
        user?.document_number ?? '',
    );
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<UserStatus>(user?.status ?? 'active');
    const [roleIds, setRoleIds] = useState<number[]>(
        user?.roles.map((role) => role.id) ?? [],
    );
    const [allBranches, setAllBranches] = useState(user?.all_branches ?? false);
    const [branchIds, setBranchIds] = useState<number[]>(
        user?.branches.map((branch) => branch.id) ?? [],
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

    // Un administrador trabaja en toda la cadena: no hay nada que elegir.
    const isAdmin = roles.some(
        (role) => role.is_admin && roleIds.includes(role.id),
    );
    const everywhere = isAdmin || allBranches;

    const toggleBranch = (id: number) =>
        setBranchIds((current) =>
            current.includes(id)
                ? current.filter((value) => value !== id)
                : [...current, id],
        );

    const save = async () => {
        const next: Record<string, string> = {};
        const number = documentNumber.trim();

        if (!name.trim()) next.name = 'Escribe el nombre.';
        if (!EMAIL.test(email.trim())) next.email = 'Escribe un correo válido.';
        if (phone.trim() && !PHONE.test(phone.trim()))
            next.phone = 'El teléfono no es válido.';
        if (documentType && !number)
            next.document_number = 'Escribe el número de documento.';
        if (!documentType && number)
            next.document_type = 'Elige el tipo de documento.';
        if (documentType && number && !DOCUMENT_FORMAT[documentType].pattern.test(number))
            next.document_number = DOCUMENT_FORMAT[documentType].hint;
        if (!user && password.length < 8)
            next.password = 'La contraseña debe tener al menos 8 caracteres.';
        if (!everywhere && branchIds.length === 0)
            next.branch_ids = 'Elige al menos una sucursal o marca todas.';

        setErrors(next);

        if (Object.keys(next).length > 0) {
            return;
        }

        const payload = {
            name: name.trim(),
            email: email.trim(),
            document_type: documentType,
            document_number: number,
            phone: phone.trim(),
            position: position.trim(),
            status,
            role_ids: roleIds,
            all_branches: everywhere,
            branch_ids: everywhere ? [] : branchIds,
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
            description={
                user ? `${user.code} · Configuraciones › Usuarios` : 'Configuraciones › Usuarios'
            }
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
                    label="Nombre completo"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    error={errors.name}
                    className="sm:col-span-2"
                    autoFocus
                />
                <Dropdown
                    label="Tipo de documento"
                    value={documentType}
                    onChange={(value) => setDocumentType(value as DocumentType | '')}
                    options={DOCUMENT_OPTIONS}
                    error={errors.document_type}
                />
                <Input
                    label="Número de documento"
                    value={documentNumber}
                    onChange={(event) => setDocumentNumber(event.target.value)}
                    error={errors.document_number}
                    disabled={!documentType}
                    inputMode={documentType === 'dni' ? 'numeric' : 'text'}
                />
                <Input
                    label="Correo"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    error={errors.email}
                    autoComplete="off"
                />
                <Input
                    label="Teléfono"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    error={errors.phone}
                    inputMode="tel"
                    placeholder="987 654 321"
                />
                <Input
                    label="Cargo"
                    value={position}
                    onChange={(event) => setPosition(event.target.value)}
                    error={errors.position}
                    placeholder="Cajero, almacenero, supervisor…"
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

                <fieldset className="sm:col-span-2">
                    <legend className="mb-2 text-sm font-medium text-ink">
                        Sucursales
                    </legend>
                    <Checkbox
                        label="Acceso a todas las sucursales"
                        checked={everywhere}
                        disabled={isAdmin}
                        onChange={() => setAllBranches((value) => !value)}
                    />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {branches.map((branch) => (
                            <Checkbox
                                key={branch.id}
                                label={branch.name}
                                checked={everywhere || branchIds.includes(branch.id)}
                                disabled={everywhere}
                                onChange={() => toggleBranch(branch.id)}
                            />
                        ))}
                    </div>
                    {errors.branch_ids && (
                        <p className="mt-1.5 text-xs text-danger">
                            {errors.branch_ids}
                        </p>
                    )}
                    <p className="mt-2 text-xs text-ink-muted">
                        {isAdmin
                            ? 'Los administradores trabajan en todas las sucursales.'
                            : 'Solo podrá trabajar en las sucursales marcadas. “Todas” incluye también las que se creen después.'}
                    </p>
                </fieldset>

                {!user && (
                    <p className="text-xs text-ink-muted sm:col-span-2">
                        El código del usuario (USR-0001, USR-0002…) se genera
                        solo al guardar.
                    </p>
                )}
            </div>
        </Modal>
    );
}
