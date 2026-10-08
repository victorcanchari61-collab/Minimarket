import { Eye, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListPage } from '@/components/data/list-page';
import type { DataTableColumn, TableQuery } from '@/components/data/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RowAction } from '@/components/ui/row-action';
import { RoleModal } from '@/features/config/roles/role-modal';
import {
    deleteRole,
    fetchPermissionCatalog,
    fetchRoleDetail,
    fetchRolesPage,
} from '@/features/config/roles/roles-api';
import type { Role } from '@/features/config/roles/roles-api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePagedList } from '@/hooks/use-paged-list';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';
import type { CatalogNode } from '@/lib/permission-tree';

const MAX_SYSTEM_BADGES = 4;

const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : 'No se pudo completar la acción.';

/** Los sistemas a los que da acceso un rol, para mostrarlos como etiquetas. */
function systemsOf(role: Role, tree: CatalogNode[]): string[] {
    if (role.permissions.includes('*')) {
        return ['Acceso total'];
    }

    const reached = new Set(role.permissions.map((code) => code.split('.')[0]));

    return tree
        .filter((system) => reached.has(system.code))
        .map((system) => system.label);
}

/** Configuraciones › Roles y permisos › Roles, con datos reales de la API. */
export default function RolesScreen() {
    const [query, setQuery] = useState<TableQuery | null>(null);
    const list = usePagedList<Role, TableQuery>({
        query,
        fetchPage: fetchRolesPage,
    });
    const toast = useToast();
    const { confirm, dialog } = useConfirm();
    const { can } = usePermissions();
    const canCreate = can('config.roles.roles.create');
    const canEdit = can('config.roles.roles.edit');
    const canDelete = can('config.roles.roles.delete');

    const [tree, setTree] = useState<CatalogNode[]>([]);
    // undefined = cerrado · null = rol nuevo · Role = editando (o mirando)
    const [editing, setEditing] = useState<Role | null | undefined>(undefined);

    const loadTree = useCallback(() => {
        fetchPermissionCatalog().then(setTree).catch(() => undefined);
    }, []);

    useEffect(loadTree, [loadTree]);

    const columns = useMemo<DataTableColumn<Role>[]>(
        () => [
            {
                key: 'name',
                fields: ['name'],
                label: 'Rol',
                sortable: true,
                filterable: false,
                width: 200,
                render: (role) => (
                    <span className="font-medium text-ink">{role.name}</span>
                ),
            },
            {
                key: 'description',
                fields: ['description'],
                label: 'Descripción',
                searchable: false,
                filterable: false,
                width: 280,
                render: (role) => role.description || '—',
            },
            {
                key: 'access',
                fields: ['permissions'],
                label: 'Da acceso a',
                searchable: false,
                filterable: false,
                width: 280,
                render: (role) => {
                    const systems = systemsOf(role, tree);

                    if (systems.length === 0) {
                        return <span className="text-ink-muted">Nada todavía</span>;
                    }

                    const shown = systems.slice(0, MAX_SYSTEM_BADGES);
                    const rest = systems.length - shown.length;

                    return (
                        <span className="flex flex-wrap gap-1">
                            {shown.map((label) => (
                                <Badge
                                    key={label}
                                    tone={label === 'Acceso total' ? 'info' : 'neutral'}
                                >
                                    {label}
                                </Badge>
                            ))}
                            {rest > 0 && <Badge tone="neutral">+{rest}</Badge>}
                        </span>
                    );
                },
            },
            {
                key: 'users',
                fields: ['user_count'],
                label: 'Usuarios',
                align: 'right',
                searchable: false,
                filterable: false,
                width: 100,
                render: (role) => role.user_count,
            },
            {
                key: 'created',
                fields: ['created_at'],
                label: 'Creado',
                sortable: true,
                searchable: false,
                filterable: false,
                width: 130,
                render: (role) => formatDate(role.created_at),
            },
        ],
        [tree],
    );

    // La fila trae solo las columnas visibles: el formulario carga el rol completo.
    const openEdit = (role: Role) =>
        fetchRoleDetail(role.id)
            .then(setEditing)
            .catch((error) => toast.error(messageOf(error)));

    const askDelete = (role: Role) =>
        confirm({
            title: 'Eliminar rol',
            message: `Se eliminará el rol "${role.name}". Si algún usuario lo tiene, no se podrá eliminar hasta cambiarlo de rol.`,
            confirmLabel: 'Eliminar',
            tone: 'danger',
            action: async () => {
                try {
                    await deleteRole(role.id);
                    toast.success('Rol eliminado.');
                    list.reload();
                } catch (error) {
                    toast.error(messageOf(error));
                }
            },
        });

    return (
        <ListPage<Role>
            icon={<ShieldCheck className="size-5" aria-hidden />}
            title="Roles"
            description="Conjuntos de permisos que se le dan a los usuarios"
            actions={
                canCreate ? (
                    <Button onClick={() => setEditing(null)}>
                        <Plus className="size-4" aria-hidden />
                        Nuevo rol
                    </Button>
                ) : undefined
            }
            columns={columns}
            rowNumbers
            rows={list.rows}
            loading={list.loading}
            pager={list.pager}
            requiredFields={['id', 'name', 'is_system']}
            error={list.error}
            onRetry={list.retry}
            onQuery={setQuery}
            searchPlaceholder="Buscar por nombre del rol…"
            empty="No hay roles que coincidan."
            cardIcon={ShieldCheck}
            rowActions={(role) => (
                <>
                    {role.is_system || !canEdit ? (
                        <RowAction
                            label="Ver permisos"
                            tone="view"
                            onClick={() => openEdit(role)}
                        >
                            <Eye className="size-4" aria-hidden />
                        </RowAction>
                    ) : (
                        <RowAction
                            label="Editar"
                            tone="edit"
                            onClick={() => openEdit(role)}
                        >
                            <Pencil className="size-4" aria-hidden />
                        </RowAction>
                    )}
                    {canDelete && !role.is_system && (
                        <RowAction
                            label="Eliminar"
                            tone="danger"
                            onClick={() => askDelete(role)}
                        >
                            <Trash2 className="size-4" aria-hidden />
                        </RowAction>
                    )}
                </>
            )}
        >
            {editing !== undefined && tree.length > 0 && (
                <RoleModal
                    role={editing}
                    tree={tree}
                    onClose={() => setEditing(undefined)}
                    onSaved={(message) => {
                        setEditing(undefined);
                        toast.success(message);
                        list.reload();
                    }}
                />
            )}
            {dialog}
        </ListPage>
    );
}
