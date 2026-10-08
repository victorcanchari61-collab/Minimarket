import {
    Building2,
    CircleCheck,
    CircleOff,
    Pencil,
    Plus,
    Store,
    Trash2,
    Warehouse,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListPage } from '@/components/data/list-page';
import type { DataTableColumn, TableQuery } from '@/components/data/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RowAction } from '@/components/ui/row-action';
import { ShareCard } from '@/components/ui/share-card';
import { BranchModal } from '@/features/config/company/branch-modal';
import {
    deleteBranch,
    fetchBranchDetail,
    fetchBranchesPage,
    fetchBranchSummary,
} from '@/features/config/company/company-api';
import type { BranchSummary, ManagedBranch } from '@/features/config/company/company-api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePagedList } from '@/hooks/use-paged-list';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { notifyBranchesChanged } from '@/lib/branches';
import { formatDate } from '@/lib/format';

const KIND_OPTIONS = [
    { value: 'store', label: 'Tienda' },
    { value: 'distribution', label: 'Centro de distribución' },
];

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activa' },
    { value: 'inactive', label: 'Inactiva' },
];

const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : 'No se pudo completar la acción.';

/** Configuraciones › Empresa y sucursales › Sucursales, con datos reales de la API. */
export default function BranchesScreen() {
    const [query, setQuery] = useState<TableQuery | null>(null);
    const list = usePagedList<ManagedBranch, TableQuery>({
        query,
        fetchPage: fetchBranchesPage,
    });
    const toast = useToast();
    const { confirm, dialog } = useConfirm();
    const { can } = usePermissions();
    const canCreate = can('config.company.branches.create');
    const canEdit = can('config.company.branches.edit');
    const canDelete = can('config.company.branches.delete');

    const [summary, setSummary] = useState<BranchSummary | null>(null);
    // undefined = cerrado · null = sucursal nueva · ManagedBranch = editando
    const [editing, setEditing] = useState<ManagedBranch | null | undefined>(undefined);

    const loadSummary = useCallback(() => {
        fetchBranchSummary()
            .then(setSummary)
            .catch(() => setSummary(null));
    }, []);

    useEffect(loadSummary, [loadSummary]);

    // Todas las sucursales están activas o inactivas: de ahí sale el total.
    const total = summary ? summary.active + summary.inactive : undefined;

    const columns = useMemo<DataTableColumn<ManagedBranch>[]>(
        () => [
            {
                key: 'code',
                fields: ['code'],
                label: 'Código',
                sortable: true,
                filterable: false,
                width: 100,
                render: (branch) => (
                    <span className="font-mono text-[13px] text-ink-muted">{branch.code}</span>
                ),
            },
            {
                key: 'name',
                fields: ['name'],
                label: 'Sucursal',
                sortable: true,
                filterable: false,
                width: 220,
                render: (branch) => (
                    <span className="font-medium text-ink">{branch.name}</span>
                ),
            },
            {
                key: 'kind',
                fields: ['kind', 'kind_label'],
                label: 'Tipo',
                sortable: true,
                searchable: false,
                filterType: 'select',
                filterOptions: KIND_OPTIONS,
                width: 190,
                render: (branch) => (
                    <Badge tone={branch.kind === 'store' ? 'neutral' : 'info'}>
                        {branch.kind_label}
                    </Badge>
                ),
            },
            {
                key: 'sunat',
                fields: ['sunat_code'],
                label: 'SUNAT',
                searchable: false,
                filterable: false,
                width: 90,
                render: (branch) => branch.sunat_code || '—',
            },
            {
                key: 'address',
                fields: ['address'],
                label: 'Dirección',
                searchable: false,
                filterable: false,
                width: 260,
                render: (branch) => branch.address || '—',
            },
            {
                key: 'warehouses',
                fields: ['warehouses'],
                label: 'Almacenes',
                align: 'right',
                searchable: false,
                filterable: false,
                width: 100,
                render: (branch) => branch.warehouses,
            },
            {
                key: 'users',
                fields: ['users'],
                label: 'Usuarios',
                align: 'right',
                searchable: false,
                filterable: false,
                width: 100,
                render: (branch) => branch.users,
            },
            {
                key: 'status',
                fields: ['active'],
                label: 'Estado',
                sortable: true,
                searchable: false,
                filterType: 'select',
                filterOptions: STATUS_OPTIONS,
                width: 110,
                render: (branch) => (
                    <Badge tone={branch.active ? 'success' : 'neutral'}>
                        {branch.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                ),
            },
            {
                key: 'phone',
                fields: ['phone'],
                label: 'Teléfono',
                searchable: false,
                filterable: false,
                width: 130,
                render: (branch) => branch.phone || '—',
            },
            {
                key: 'created',
                fields: ['created_at'],
                label: 'Creada',
                sortable: true,
                searchable: false,
                filterable: false,
                width: 120,
                render: (branch) => formatDate(branch.created_at),
            },
        ],
        [],
    );

    const changed = () => {
        list.reload();
        loadSummary();
        notifyBranchesChanged(); // el selector de la cuenta debe ver el cambio
    };

    // La fila trae solo las columnas visibles: el formulario carga la sucursal completa.
    const openEdit = (branch: ManagedBranch) =>
        fetchBranchDetail(branch.id)
            .then(setEditing)
            .catch((error) => toast.error(messageOf(error)));

    const askDelete = (branch: ManagedBranch) =>
        confirm({
            title: 'Eliminar sucursal',
            message: `Se eliminará "${branch.name}" y su código quedará libre. Si tiene almacenes o usuarios asignados no se podrá eliminar; si solo quieres dejar de usarla, desactívala.`,
            confirmLabel: 'Eliminar',
            tone: 'danger',
            action: async () => {
                try {
                    await deleteBranch(branch.id);
                    toast.success('Sucursal eliminada.');
                    changed();
                } catch (error) {
                    toast.error(messageOf(error));
                }
            },
        });

    return (
        <ListPage<ManagedBranch>
            icon={<Building2 className="size-5" aria-hidden />}
            title="Sucursales"
            description="Los locales de la cadena: tiendas y centros de distribución"
            actions={
                canCreate ? (
                    <Button onClick={() => setEditing(null)}>
                        <Plus className="size-4" aria-hidden />
                        Nueva sucursal
                    </Button>
                ) : undefined
            }
            stats={
                <>
                    <ShareCard
                        label="Activas"
                        icon={<CircleCheck className="size-5" aria-hidden />}
                        value={summary?.active}
                        total={total}
                        tone="success"
                    />
                    <ShareCard
                        label="Inactivas"
                        icon={<CircleOff className="size-5" aria-hidden />}
                        value={summary?.inactive}
                        total={total}
                        tone="neutral"
                    />
                    <ShareCard
                        label="Tiendas"
                        icon={<Store className="size-5" aria-hidden />}
                        value={summary?.stores}
                        total={total}
                        tone="accent"
                    />
                    <ShareCard
                        label="Centros de distribución"
                        icon={<Warehouse className="size-5" aria-hidden />}
                        value={summary?.distribution}
                        total={total}
                        tone="info"
                    />
                </>
            }
            columns={columns}
            rowNumbers
            defaultHidden={['phone', 'created']}
            rows={list.rows}
            loading={list.loading}
            pager={list.pager}
            requiredFields={['id', 'name']}
            error={list.error}
            onRetry={list.retry}
            onQuery={setQuery}
            searchPlaceholder="Buscar por nombre, código o dirección…"
            empty="No hay sucursales que coincidan."
            cardIcon={Store}
            rowActions={
                canEdit || canDelete
                    ? (branch) => (
                          <>
                              {canEdit && (
                                  <RowAction
                                      label="Editar"
                                      tone="edit"
                                      onClick={() => openEdit(branch)}
                                  >
                                      <Pencil className="size-4" aria-hidden />
                                  </RowAction>
                              )}
                              {canDelete && (
                                  <RowAction
                                      label="Eliminar"
                                      tone="danger"
                                      onClick={() => askDelete(branch)}
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
                <BranchModal
                    branch={editing}
                    onClose={() => setEditing(undefined)}
                    onSaved={(message) => {
                        setEditing(undefined);
                        toast.success(message);
                        changed();
                    }}
                />
            )}
            {dialog}
        </ListPage>
    );
}
