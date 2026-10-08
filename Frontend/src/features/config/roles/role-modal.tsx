import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PermissionTree } from '@/features/config/roles/permission-tree';
import { createRole, updateRole } from '@/features/config/roles/roles-api';
import type { Role } from '@/features/config/roles/roles-api';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { actionsOf, compact, expand } from '@/lib/permission-tree';
import type { CatalogNode } from '@/lib/permission-tree';

type RoleModalProps = {
    /** null = rol nuevo. */
    role: Role | null;
    tree: CatalogNode[];
    onClose: () => void;
    onSaved: (message: string) => void;
};

/** Crear o editar un rol y marcar sus permisos. Un rol del sistema solo se mira. */
export function RoleModal({ role, tree, onClose, onSaved }: RoleModalProps) {
    const readOnly = role?.is_system ?? false;

    const [name, setName] = useState(role?.name ?? '');
    const [description, setDescription] = useState(role?.description ?? '');
    const [selected, setSelected] = useState<Set<string>>(() =>
        expand(role?.permissions ?? [], tree),
    );
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const toast = useToast();

    const total = tree.reduce((sum, system) => sum + actionsOf(system).length, 0);

    const save = async () => {
        if (!name.trim()) {
            setErrors({ name: 'Escribe el nombre del rol.' });

            return;
        }

        setErrors({});
        setSaving(true);

        const payload = {
            name: name.trim(),
            description: description.trim(),
            permissions: compact(selected, tree),
        };

        try {
            if (role) {
                await updateRole(role.id, payload);
                onSaved('Rol actualizado.');
            } else {
                await createRole(payload);
                onSaved('Rol creado.');
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
                        : 'No se pudo guardar el rol.',
                );
            }

            setSaving(false);
        }
    };

    return (
        <Modal
            open
            size="xl"
            title={readOnly ? role!.name : role ? 'Editar rol' : 'Nuevo rol'}
            description="Configuraciones › Roles y permisos"
            onClose={onClose}
            footer={
                readOnly ? (
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cerrar
                    </Button>
                ) : (
                    <>
                        <Button variant="secondary" size="sm" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            loading={saving}
                            onClick={() => void save()}
                        >
                            {saving ? 'Guardando…' : 'Guardar'}
                        </Button>
                    </>
                )
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Input
                    label="Nombre del rol"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    error={errors.name}
                    disabled={readOnly}
                    placeholder="Vendedor, Supervisor…"
                    autoFocus={!readOnly}
                />
                <Input
                    label="Descripción"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    error={errors.description}
                    disabled={readOnly}
                    placeholder="Para qué sirve este rol"
                />
            </div>

            <div className="mt-5">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-ink">Permisos</h3>
                    <span className="text-xs text-ink-soft tabular-nums">
                        {readOnly ? 'Acceso total' : `${selected.size} de ${total} acciones`}
                    </span>
                </div>

                {errors.permissions && (
                    <p className="mb-2 text-xs text-danger">{errors.permissions}</p>
                )}

                <div className="max-h-[46vh] overflow-y-auto pr-1">
                    <PermissionTree
                        tree={tree}
                        selected={selected}
                        onChange={setSelected}
                        readOnly={readOnly}
                    />
                </div>

                <p className="mt-2 text-xs text-ink-muted">
                    Marcar un sistema, un módulo o un submódulo da todo lo que
                    tiene adentro, incluso lo que se agregue después. Cualquier
                    acción incluye poder ver su pantalla.
                </p>
            </div>
        </Modal>
    );
}
