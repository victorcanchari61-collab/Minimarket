import {
    CircleCheck,
    CircleOff,
    Pencil,
    Plus,
    Store,
    Trash2,
    Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListPage } from '@/components/data/list-page';
import type { DataTableColumn, TableQuery } from '@/components/data/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RowAction } from '@/components/ui/row-action';
import { ShareCard } from '@/components/ui/share-card';
import {
    deleteWarehouse,
    fetchWarehouseDetail,
    fetchWarehouseBranches,
    fetchWarehouseSummary,
    fetchWarehousesPage,
} from '@/features/config/company/company-api';
import type {
    BranchOption,
    Warehouse,
    WarehouseSummary,
} from '@/features/config/company/company-api';
import { WarehouseModal } from '@/features/config/company/warehouse-modal';
import { useConfirm } from '@/hooks/use-confirm';
import { usePagedList } from '@/hooks/use-paged-list';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
];

const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : 'No se pudo completar la acción.';

/** Configuraciones › Empresa y sucursales › Almacenes, con datos reales de la API. */
export default function WarehousesScreen() {
    const [query, setQuery] = useState<TableQuery | null>(null);
    const list = usePagedList<Warehouse, TableQuery>({
        query,
        fetchPage: fetchWarehousesPage,
    });
    const toast = useToast();
    const { confirm, dialog } = useConfirm();
    const { can } = usePermissions();
    const canCreate = can('config.company.warehouses.create');
    const canEdit = can('config.company.warehouses.edit');
    const canDelete = can('config.company.warehouses.delete');

    const [summary, setSummary] = useState<WarehouseSummary | null>(null);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    // undefined = cerrado · null = almacén nuevo · Warehouse = editando
    const [editing, setEditing] = useState<Warehouse | null | undefined>(undefined);

    const loadSummary = useCallback(() => {
        fetchWarehouseSummary()
            .then(setSummary)
            .catch(() => setSummary(null));
    }, []);

    useEffect(() => {
        loadSummary();
        fetchWarehouseBranches().then(setBranches).catch(() => undefined);
    }, [loadSummary]);

    // Todos los almacenes están activos o inactivos: de ahí sale el total.
    const total = summary ? summary.active + summary.inactive : undefined;

    const columns = useMemo<DataTableColumn<Warehouse>[]>(
        () => [
            {
                key: 'code',
                fields: ['code'],
                label: 'Código',
                sortable: true,
                filterable: false,
                width: 110,
                render: (warehouse) => (
                    <span className="font-mono text-[13px] text-ink-muted">{warehouse.code}</span>
                ),
            },
            {
                key: 'name',
                fields: ['name'],
                label: 'Almacén',
                sortable: true,
                filterable: false,
                width: 240,
                render: (warehouse) => (
                    <span className="font-medium text-ink">{warehouse.name}</span>
                ),
            },
            {
                key: 'branch',
                fields: ['branch_name'],
                label: 'Sucursal',
                searchable: false,
                filterType: 'select',
                filterOptions: branches.map((branch) => ({
                    value: String(branch.id),
                    label: branch.name,
                })),
                width: 220,
                render: (warehouse) => warehouse.branch_name,
            },
            {
                key: 'address',
                fields: ['address'],
                label: 'Ubicación',
                searchable: false,
                filterable: false,
                width: 260,
                render: (warehouse) => warehouse.address || '—',
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
                render: (warehouse) => (
                    <Badge tone={warehouse.active ? 'success' : 'neutral'}>
                        {warehouse.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                ),
            },
            {
                key: 'created',
                fields: ['created_at'],
                label: 'Creado',
                sortable: true,
                searchable: false,
                filterable: false,
                width: 120,
                render: (warehouse) => formatDate(warehouse.created_at),
            },
        ],
        [branches],
    );

    const refresh = () => {
        list.reload();
        loadSummary();
    };

    // La fila trae solo las columnas visibles: el formulario carga el almacén completo.
    const openEdit = (warehouse: Warehouse) =>
        fetchWarehouseDetail(warehouse.id)
            .then(setEditing)
            .catch((error) => toast.error(messageOf(error)));

    const askDelete = (warehouse: Warehouse) =>
        confirm({
            title: 'Eliminar almacén',
            message: `Se eliminará "${warehouse.name}" de ${warehouse.branch_name} y su código quedará libre.`,
            confirmLabel: 'Eliminar',
            tone: 'danger',
            action: async () => {
                try {
                    await deleteWarehouse(warehouse.id);
                    toast.success('Almacén eliminado.');
                    refresh();
                } catch (error) {
                    toast.error(messageOf(error));
                }
            },
        });

    return (
        <ListPage<Warehouse>
            icon={<WarehouseIcon className="size-5" aria-hidden />}
            title="Almacenes"
            description="Dónde se guarda la mercadería de cada sucursal"
            actions={
                canCreate ? (
                    <Button onClick={() => setEditing(null)}>
                        <Plus className="size-4" aria-hidden />
                        Nuevo almacén
                    </Button>
                ) : undefined
            }
            stats={
                <>
                    <ShareCard
                        label="Activos"
                        icon={<CircleCheck className="size-5" aria-hidden />}
                        value={summary?.active}
                        total={total}
                        tone="success"
                    />
                    <ShareCard
                        label="Inactivos"
                        icon={<CircleOff className="size-5" aria-hidden />}
                        value={summary?.inactive}
                        total={total}
                        tone="neutral"
                    />
                    <ShareCard
                        label="Sucursales sin almacén"
                        icon={<Store className="size-5" aria-hidden />}
                        value={summary?.branches_without}
                        total={summary && branches.length > 0 ? branches.length : undefined}
                        tone="warning"
                    />
                </>
            }
            columns={columns}
            rowNumbers
            rows={list.rows}
            loading={list.loading}
            pager={list.pager}
            requiredFields={['id', 'name', 'branch_name']}
            error={list.error}
            onRetry={list.retry}
            onQuery={setQuery}
            searchPlaceholder="Buscar por nombre o código…"
            empty="No hay almacenes que coincidan."
            cardIcon={WarehouseIcon}
            rowActions={
                canEdit || canDelete
                    ? (warehouse) => (
                          <>
                              {canEdit && (
                                  <RowAction
                                      label="Editar"
                                      tone="edit"
                                      onClick={() => openEdit(warehouse)}
                                  >
                                      <Pencil className="size-4" aria-hidden />
                                  </RowAction>
                              )}
                              {canDelete && (
                                  <RowAction
                                      label="Eliminar"
                                      tone="danger"
                                      onClick={() => askDelete(warehouse)}
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
                <WarehouseModal
                    warehouse={editing}
                    branches={branches}
                    onClose={() => setEditing(undefined)}
                    onSaved={(message) => {
                        setEditing(undefined);
                        toast.success(message);
                        refresh();
                    }}
                />
            )}
            {dialog}
        </ListPage>
    );
}
