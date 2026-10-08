import { CircleCheck, CircleOff, Monitor, Pencil, Plus, Store, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListPage } from '@/components/data/list-page';
import type { DataTableColumn, TableQuery } from '@/components/data/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RowAction } from '@/components/ui/row-action';
import { ShareCard } from '@/components/ui/share-card';
import { TerminalModal } from '@/features/config/terminals/terminal-modal';
import {
    deleteTerminal,
    fetchTerminalBranches,
    fetchTerminalDetail,
    fetchTerminalSummary,
    fetchTerminalWarehouses,
    fetchTerminalsPage,
} from '@/features/config/terminals/terminals-api';
import type {
    BranchOption,
    Terminal,
    TerminalSummary,
    WarehouseOption,
} from '@/features/config/terminals/terminals-api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePagedList } from '@/hooks/use-paged-list';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activa' },
    { value: 'inactive', label: 'Inactiva' },
];

const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : 'No se pudo completar la acción.';

/** Configuraciones › Terminales y series › Terminales POS, con datos reales de la API. */
export default function TerminalsScreen() {
    const [query, setQuery] = useState<TableQuery | null>(null);
    const list = usePagedList<Terminal, TableQuery>({
        query,
        fetchPage: fetchTerminalsPage,
    });
    const toast = useToast();
    const { confirm, dialog } = useConfirm();
    const { can } = usePermissions();
    const canCreate = can('config.terminals.pos_terminals.create');
    const canEdit = can('config.terminals.pos_terminals.edit');
    const canDelete = can('config.terminals.pos_terminals.delete');

    const [summary, setSummary] = useState<TerminalSummary | null>(null);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
    // undefined = cerrado · null = terminal nueva · Terminal = editando
    const [editing, setEditing] = useState<Terminal | null | undefined>(undefined);

    const loadSummary = useCallback(() => {
        fetchTerminalSummary()
            .then(setSummary)
            .catch(() => setSummary(null));
    }, []);

    useEffect(() => {
        loadSummary();
        fetchTerminalBranches().then(setBranches).catch(() => undefined);
        fetchTerminalWarehouses().then(setWarehouses).catch(() => undefined);
    }, [loadSummary]);

    const total = summary ? summary.active + summary.inactive : undefined;

    const columns = useMemo<DataTableColumn<Terminal>[]>(
        () => [
            {
                key: 'code',
                fields: ['code'],
                label: 'Código',
                sortable: true,
                filterable: false,
                width: 120,
                render: (terminal) => (
                    <span className="font-mono text-[13px] text-ink-muted">{terminal.code}</span>
                ),
            },
            {
                key: 'name',
                fields: ['name'],
                label: 'Terminal',
                sortable: true,
                filterable: false,
                width: 220,
                render: (terminal) => <span className="font-medium text-ink">{terminal.name}</span>,
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
                render: (terminal) => terminal.branch_name,
            },
            {
                key: 'warehouse',
                fields: ['warehouse_name'],
                label: 'Almacén',
                searchable: false,
                filterable: false,
                width: 200,
                render: (terminal) => terminal.warehouse_name || '—',
            },
            {
                key: 'series',
                fields: ['series'],
                label: 'Series',
                searchable: false,
                filterable: false,
                width: 100,
                render: (terminal) => terminal.series,
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
                render: (terminal) => (
                    <Badge tone={terminal.active ? 'success' : 'neutral'}>
                        {terminal.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                ),
            },
            {
                key: 'created',
                fields: ['created_at'],
                label: 'Creada',
                sortable: true,
                searchable: false,
                filterable: false,
                width: 120,
                render: (terminal) => formatDate(terminal.created_at),
            },
        ],
        [branches],
    );

    const refresh = () => {
        list.reload();
        loadSummary();
    };

    // La fila trae solo las columnas visibles: el formulario carga la terminal completa.
    const openEdit = (terminal: Terminal) =>
        fetchTerminalDetail(terminal.id)
            .then(setEditing)
            .catch((error) => toast.error(messageOf(error)));

    const askDelete = (terminal: Terminal) =>
        confirm({
            title: 'Eliminar terminal',
            message: `Se eliminará "${terminal.name}" de ${terminal.branch_name} y su código quedará libre.`,
            confirmLabel: 'Eliminar',
            tone: 'danger',
            action: async () => {
                try {
                    await deleteTerminal(terminal.id);
                    toast.success('Terminal eliminada.');
                    refresh();
                } catch (error) {
                    toast.error(messageOf(error));
                }
            },
        });

    return (
        <ListPage<Terminal>
            icon={<Monitor className="size-5" aria-hidden />}
            title="Terminales POS"
            description="Las cajas de cada tienda"
            actions={
                canCreate ? (
                    <Button onClick={() => setEditing(null)}>
                        <Plus className="size-4" aria-hidden />
                        Nueva terminal
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
                        label="Tiendas sin caja"
                        icon={<Store className="size-5" aria-hidden />}
                        value={summary?.stores_without}
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
            empty="No hay terminales que coincidan."
            cardIcon={Monitor}
            rowActions={
                canEdit || canDelete
                    ? (terminal) => (
                          <>
                              {canEdit && (
                                  <RowAction
                                      label="Editar"
                                      tone="edit"
                                      onClick={() => openEdit(terminal)}
                                  >
                                      <Pencil className="size-4" aria-hidden />
                                  </RowAction>
                              )}
                              {canDelete && (
                                  <RowAction
                                      label="Eliminar"
                                      tone="danger"
                                      onClick={() => askDelete(terminal)}
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
                <TerminalModal
                    terminal={editing}
                    branches={branches}
                    warehouses={warehouses}
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
