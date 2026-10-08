import {
    KeyRound,
    Pencil,
    Plus,
    ShieldCheck,
    ShieldOff,
    Trash2,
    UserCheck,
    UserRound,
    UserX,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListPage } from '@/components/data/list-page';
import type { DataTableColumn, TableQuery } from '@/components/data/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RowAction } from '@/components/ui/row-action';
import { ShareCard } from '@/components/ui/share-card';
import { useAuthUser } from '@/hooks/use-auth-user';
import { useConfirm } from '@/hooks/use-confirm';
import { useCursorList } from '@/hooks/use-cursor-list';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';
import { PasswordModal } from '@/features/config/users/password-modal';
import { UserModal } from '@/features/config/users/user-modal';
import {
    deleteUser,
    fetchBranchOptions,
    fetchRoles,
    fetchUserSummary,
    fetchUsersPage,
} from '@/features/config/users/users-api';
import type {
    BranchOption,
    SystemUser,
    UserRole,
    UserSummary,
} from '@/features/config/users/users-api';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
];

const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : 'No se pudo completar la acción.';

/** Configuraciones › Usuarios › Lista de usuarios, con datos reales de la API. */
export default function UsersScreen() {
    const [query, setQuery] = useState<TableQuery | null>(null);
    const list = useCursorList<SystemUser, TableQuery>({
        query,
        fetchPage: fetchUsersPage,
    });
    const toast = useToast();
    const { confirm, dialog } = useConfirm();
    const { user: me } = useAuthUser();
    const { can } = usePermissions();
    const canCreate = can('config.users.list.create');
    const canEdit = can('config.users.list.edit');
    const canDelete = can('config.users.list.delete');
    const canReset = can('config.users.list.reset_password');

    const [summary, setSummary] = useState<UserSummary | null>(null);
    const [roles, setRoles] = useState<UserRole[]>([]);
    const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
    // undefined = cerrado · null = usuario nuevo · SystemUser = editando
    const [editing, setEditing] = useState<SystemUser | null | undefined>(
        undefined,
    );
    const [resetting, setResetting] = useState<SystemUser | null>(null);

    // Todos los usuarios son activos o inactivos: el total sale de ahí.
    const total = summary ? summary.active + summary.inactive : undefined;

    const loadSummary = useCallback(() => {
        fetchUserSummary()
            .then(setSummary)
            .catch(() => setSummary(null));
    }, []);

    useEffect(() => {
        loadSummary();
        fetchRoles().then(setRoles).catch(() => undefined);
        fetchBranchOptions().then(setBranchOptions).catch(() => undefined);
    }, [loadSummary]);

    const columns = useMemo<DataTableColumn<SystemUser>[]>(
        () => [
            {
                key: 'code',
                label: 'Código',
                sortable: true,
                width: 100,
                render: (user) => (
                    <span className="font-mono text-[13px] text-ink-muted">
                        {user.code}
                    </span>
                ),
            },
            {
                key: 'name',
                label: 'Nombre',
                sortable: true,
                width: 220,
                render: (user) => (
                    <span className="font-medium text-ink">{user.name}</span>
                ),
            },
            {
                key: 'document',
                label: 'Documento',
                filterable: false,
                width: 150,
                render: (user) =>
                    user.document_number
                        ? `${user.document_type_label} ${user.document_number}`
                        : '—',
            },
            {
                key: 'email',
                label: 'Correo',
                sortable: true,
                width: 240,
            },
            {
                key: 'phone',
                label: 'Teléfono',
                searchable: false,
                filterable: false,
                width: 130,
                render: (user) => user.phone || '—',
            },
            {
                key: 'position',
                label: 'Cargo',
                searchable: false,
                filterable: false,
                width: 160,
                render: (user) => user.position || '—',
            },
            {
                key: 'roles',
                label: 'Roles',
                searchable: false,
                filterType: 'select',
                filterOptions: roles.map((role) => ({
                    value: String(role.id),
                    label: role.name,
                })),
                width: 220,
                render: (user) =>
                    user.roles.length === 0 ? (
                        <span className="text-ink-muted">Sin roles</span>
                    ) : (
                        <span className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                                <Badge key={role.id} tone="info">
                                    {role.name}
                                </Badge>
                            ))}
                        </span>
                    ),
            },
            {
                key: 'branches',
                label: 'Sucursales',
                searchable: false,
                filterable: false,
                width: 200,
                render: (user) =>
                    user.all_branches ? (
                        <Badge tone="info">Todas</Badge>
                    ) : user.branches.length === 0 ? (
                        <span className="text-ink-muted">Ninguna</span>
                    ) : (
                        <span className="flex flex-wrap gap-1">
                            {user.branches.slice(0, 2).map((branch) => (
                                <Badge key={branch.id} tone="neutral">
                                    {branch.name}
                                </Badge>
                            ))}
                            {user.branches.length > 2 && (
                                <Badge tone="neutral">
                                    +{user.branches.length - 2}
                                </Badge>
                            )}
                        </span>
                    ),
            },
            {
                key: 'status',
                label: 'Estado',
                sortable: true,
                searchable: false,
                filterType: 'select',
                filterOptions: STATUS_OPTIONS,
                width: 120,
                render: (user) => (
                    <Badge tone={user.status === 'active' ? 'success' : 'neutral'}>
                        {user.status_label}
                    </Badge>
                ),
            },
            {
                key: 'last_login',
                label: 'Último acceso',
                searchable: false,
                filterable: false,
                width: 140,
                render: (user) =>
                    user.last_login_at ? formatDate(user.last_login_at) : 'Nunca',
            },
            {
                key: 'created',
                label: 'Creado',
                sortable: true,
                searchable: false,
                filterable: false,
                width: 130,
                render: (user) => formatDate(user.created_at),
            },
        ],
        [roles],
    );

    const refresh = () => {
        list.reload();
        loadSummary();
    };

    const askDelete = (user: SystemUser) =>
        confirm({
            title: 'Eliminar usuario',
            message: `"${user.name}" ya no podrá entrar al sistema y su correo quedará libre.`,
            confirmLabel: 'Eliminar',
            tone: 'danger',
            action: async () => {
                try {
                    await deleteUser(user.id);
                    toast.success('Usuario eliminado.');
                    refresh();
                } catch (error) {
                    toast.error(messageOf(error));
                }
            },
        });

    return (
        <ListPage<SystemUser>
            icon={<UserRound className="size-5" aria-hidden />}
            title="Lista de usuarios"
            description="Quién puede entrar al sistema y con qué roles"
            actions={
                canCreate ? (
                    <Button onClick={() => setEditing(null)}>
                        <Plus className="size-4" aria-hidden />
                        Nuevo usuario
                    </Button>
                ) : undefined
            }
            stats={
                <>
                    <ShareCard
                        label="Activos"
                        icon={<UserCheck className="size-5" aria-hidden />}
                        value={summary?.active}
                        total={total}
                        tone="success"
                    />
                    <ShareCard
                        label="Inactivos"
                        icon={<UserX className="size-5" aria-hidden />}
                        value={summary?.inactive}
                        total={total}
                        tone="neutral"
                    />
                    <ShareCard
                        label="Administradores"
                        icon={<ShieldCheck className="size-5" aria-hidden />}
                        value={summary?.administrators}
                        total={total}
                        tone="info"
                    />
                    <ShareCard
                        label="Sin roles"
                        icon={<ShieldOff className="size-5" aria-hidden />}
                        value={summary?.without_roles}
                        total={total}
                        tone="warning"
                    />
                </>
            }
            columns={columns}
            rowNumbers
            defaultHidden={['position', 'created']}
            rows={list.rows}
            loading={list.loading}
            loadingMore={list.loadingMore}
            hasMore={list.hasMore}
            onLoadMore={list.loadMore}
            error={list.error}
            onRetry={list.retry}
            onQuery={setQuery}
            searchPlaceholder="Buscar por nombre, correo, código o documento…"
            empty="No hay usuarios que coincidan."
            cardIcon={UserRound}
            rowActions={
                canEdit || canReset || canDelete
                    ? (user) => (
                          <>
                              {canEdit && (
                                  <RowAction
                                      label="Editar"
                                      tone="edit"
                                      onClick={() => setEditing(user)}
                                  >
                                      <Pencil className="size-4" aria-hidden />
                                  </RowAction>
                              )}
                              {canReset && (
                                  <RowAction
                                      label="Reiniciar contraseña"
                                      tone="warning"
                                      onClick={() => setResetting(user)}
                                  >
                                      <KeyRound className="size-4" aria-hidden />
                                  </RowAction>
                              )}
                              {canDelete && (
                                  <RowAction
                                      label="Eliminar"
                                      tone="danger"
                                      disabled={user.id === me?.id}
                                      disabledReason="No puedes eliminar tu propio usuario."
                                      onClick={() => askDelete(user)}
                                  >
                                      <Trash2 className="size-4" aria-hidden />
                                  </RowAction>
                              )}
                          </>
                      )
                    : undefined
            }
        >
            {editing !== undefined && (
                <UserModal
                    user={editing}
                    roles={roles}
                    branches={branchOptions}
                    isSelf={editing !== null && editing.id === me?.id}
                    onClose={() => setEditing(undefined)}
                    onSaved={(message) => {
                        setEditing(undefined);
                        toast.success(message);
                        refresh();
                    }}
                />
            )}
            {resetting && (
                <PasswordModal
                    user={resetting}
                    isSelf={resetting.id === me?.id}
                    onClose={() => setResetting(null)}
                    onSaved={(message) => {
                        setResetting(null);
                        toast.success(message);
                    }}
                />
            )}
            {dialog}
        </ListPage>
    );
}
