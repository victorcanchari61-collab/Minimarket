import { ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dropdown } from '@/components/data/dropdown';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { fetchAccessRoles, saveRolePermissions } from '@/features/config/permissions/access-api';
import type { AccessRole } from '@/features/config/permissions/access-api';
import { PermissionTree } from '@/features/config/roles/permission-tree';
import { useToast } from '@/hooks/use-toast';
import { compact, expand, sameSet, screenCodes } from '@/lib/permission-tree';
import type { CatalogNode } from '@/lib/permission-tree';

type PanelProps = {
    tree: CatalogNode[];
    /** Las pestañas de la pantalla, que van entre la cabecera y el contenido. */
    tabs: ReactNode;
    canAssign: boolean;
};

/** Pestaña "Por rol": elegir un rol y marcar a qué pantallas y acciones da acceso. */
export function RoleAccessPanel({ tree, tabs, canAssign }: PanelProps) {
    const [roles, setRoles] = useState<AccessRole[] | null>(null);
    const [roleId, setRoleId] = useState<number | null>(null);

    const load = useCallback(() => {
        fetchAccessRoles()
            .then((next) => {
                setRoles(next);
                setRoleId((current) => current ?? next[0]?.id ?? null);
            })
            .catch(() => undefined);
    }, []);

    useEffect(load, [load]);

    const role = roles?.find((candidate) => candidate.id === roleId);

    if (!roles || !role) {
        return (
            <div className="space-y-5">
                <PageHeader
                    icon={<ShieldCheck className="size-5" aria-hidden />}
                    title="Accesos por rol"
                />
                {tabs}
            </div>
        );
    }

    return (
        <RoleEditor
            // Al guardar (o cambiar de rol) el editor arranca de nuevo con lo guardado.
            key={`${role.id}:${role.permissions.join(',')}`}
            role={role}
            roles={roles}
            tree={tree}
            tabs={tabs}
            canAssign={canAssign}
            onSelect={setRoleId}
            onSaved={load}
        />
    );
}

function RoleEditor({
    role,
    roles,
    tree,
    tabs,
    canAssign,
    onSelect,
    onSaved,
}: PanelProps & {
    role: AccessRole;
    roles: AccessRole[];
    onSelect: (id: number) => void;
    onSaved: () => void;
}) {
    const toast = useToast();
    const initial = useMemo(() => expand(role.permissions, tree), [role, tree]);
    const [selected, setSelected] = useState(initial);
    const [saving, setSaving] = useState(false);

    const screens = screenCodes(tree);
    const enabled = screens.filter((code) => selected.has(code)).length;
    const dirty = !sameSet(selected, initial);
    const readOnly = role.is_system || !canAssign;

    const save = async () => {
        setSaving(true);

        try {
            await saveRolePermissions(role.id, compact(selected, tree));
            toast.success('Accesos del rol actualizados.');
            onSaved();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo guardar.');
            setSaving(false);
        }
    };

    const detail = role.is_system
        ? 'Acceso total: configura el sistema, crea usuarios y ve todos los módulos.'
        : role.description;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={<ShieldCheck className="size-5" aria-hidden />}
                title={`Accesos de ${role.name}`}
                description={`${enabled} de ${screens.length} pantallas habilitadas.${detail ? ` ${detail}` : ''}`}
                actions={
                    !readOnly && (
                        <>
                            <Button
                                variant="secondary"
                                disabled={!dirty || saving}
                                onClick={() => setSelected(initial)}
                            >
                                Restablecer
                            </Button>
                            <Button
                                disabled={!dirty}
                                loading={saving}
                                onClick={() => void save()}
                            >
                                {saving ? 'Guardando…' : 'Guardar'}
                            </Button>
                        </>
                    )
                }
            />

            {tabs}

            <div className="max-w-xs">
                <Dropdown
                    label="Rol"
                    value={role.id}
                    onChange={(value) => onSelect(Number(value))}
                    options={roles.map((candidate) => ({
                        value: candidate.id,
                        label: candidate.name,
                    }))}
                />
            </div>

            <PermissionTree
                tree={tree}
                selected={selected}
                onChange={setSelected}
                readOnly={readOnly}
            />
        </div>
    );
}
