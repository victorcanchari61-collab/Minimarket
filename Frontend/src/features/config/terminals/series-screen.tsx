import { CircleCheck, CircleOff, Hash, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListPage } from '@/components/data/list-page';
import type { DataTableColumn, TableQuery } from '@/components/data/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RowAction } from '@/components/ui/row-action';
import { ShareCard } from '@/components/ui/share-card';
import { SeriesModal } from '@/features/config/terminals/series-modal';
import {
    DOCUMENT_TYPES,
    deleteSeries,
    documentTypeLabel,
    fetchSeriesBranches,
    fetchSeriesDetail,
    fetchSeriesPage,
    fetchSeriesSummary,
    fetchSeriesTerminals,
} from '@/features/config/terminals/terminals-api';
import type {
    BranchOption,
    DocumentSeries,
    SeriesSummary,
    TerminalOption,
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

/** Configuraciones › Terminales y series › Series de comprobantes, con datos reales de la API. */
export default function SeriesScreen() {
    const [query, setQuery] = useState<TableQuery | null>(null);
    const list = usePagedList<DocumentSeries, TableQuery>({
        query,
        fetchPage: fetchSeriesPage,
    });
    const toast = useToast();
    const { confirm, dialog } = useConfirm();
    const { can } = usePermissions();
    const canCreate = can('config.terminals.series.create');
    const canEdit = can('config.terminals.series.edit');
    const canDelete = can('config.terminals.series.delete');

    const [summary, setSummary] = useState<SeriesSummary | null>(null);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [terminals, setTerminals] = useState<TerminalOption[]>([]);
    // undefined = cerrado · null = serie nueva · DocumentSeries = editando
    const [editing, setEditing] = useState<DocumentSeries | null | undefined>(undefined);

    const loadSummary = useCallback(() => {
        fetchSeriesSummary()
            .then(setSummary)
            .catch(() => setSummary(null));
    }, []);

    useEffect(() => {
        loadSummary();
        fetchSeriesBranches().then(setBranches).catch(() => undefined);
        fetchSeriesTerminals().then(setTerminals).catch(() => undefined);
    }, [loadSummary]);

    const total = summary ? summary.active + summary.inactive : undefined;

    const columns = useMemo<DataTableColumn<DocumentSeries>[]>(
        () => [
            {
                key: 'series',
                fields: ['series'],
                label: 'Serie',
                sortable: true,
                filterable: false,
                width: 110,
                render: (item) => (
                    <span className="font-mono text-[13px] font-semibold text-ink">
                        {item.series}
                    </span>
                ),
            },
            {
                key: 'type',
                fields: ['document_type'],
                label: 'Comprobante',
                sortable: true,
                searchable: false,
                filterType: 'select',
                filterOptions: DOCUMENT_TYPES.map(({ value, label }) => ({ value, label })),
                width: 190,
                render: (item) => documentTypeLabel(item.document_type),
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
                width: 200,
                render: (item) => item.branch_name,
            },
            {
                key: 'terminal',
                fields: ['terminal_name'],
                label: 'Terminal',
                searchable: false,
                filterType: 'select',
                filterOptions: terminals.map((terminal) => ({
                    value: String(terminal.id),
                    label: `${terminal.name} · ${terminal.code}`,
                })),
                width: 180,
                render: (item) => item.terminal_name || 'Toda la sucursal',
            },
            {
                key: 'next',
                fields: ['next_number'],
                label: 'Siguiente número',
                searchable: false,
                filterable: false,
                width: 150,
                render: (item) => (
                    <span className="font-mono text-[13px] text-ink-muted">
                        {String(item.next_number).padStart(8, '0')}
                    </span>
                ),
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
                render: (item) => (
                    <Badge tone={item.active ? 'success' : 'neutral'}>
                        {item.active ? 'Activa' : 'Inactiva'}
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
                render: (item) => formatDate(item.created_at),
            },
        ],
        [branches, terminals],
    );

    const refresh = () => {
        list.reload();
        loadSummary();
    };

    // La fila trae solo las columnas visibles: el formulario carga la serie completa.
    const openEdit = (item: DocumentSeries) =>
        fetchSeriesDetail(item.id)
            .then(setEditing)
            .catch((error) => toast.error(messageOf(error)));

    const askDelete = (item: DocumentSeries) =>
        confirm({
            title: 'Eliminar serie',
            message: `Se eliminará la serie ${item.series} y su código quedará libre.`,
            confirmLabel: 'Eliminar',
            tone: 'danger',
            action: async () => {
                try {
                    await deleteSeries(item.id);
                    toast.success('Serie eliminada.');
                    refresh();
                } catch (error) {
                    toast.error(messageOf(error));
                }
            },
        });

    return (
        <ListPage<DocumentSeries>
            icon={<Hash className="size-5" aria-hidden />}
            title="Series de comprobantes"
            description="La numeración de facturas, boletas, notas y guías"
            actions={
                canCreate ? (
                    <Button onClick={() => setEditing(null)}>
                        <Plus className="size-4" aria-hidden />
                        Nueva serie
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
                        label="Ya emitieron"
                        icon={<Zap className="size-5" aria-hidden />}
                        value={summary?.used}
                        total={total}
                        tone="warning"
                    />
                </>
            }
            columns={columns}
            rowNumbers
            rows={list.rows}
            loading={list.loading}
            pager={list.pager}
            requiredFields={['id', 'series', 'used']}
            error={list.error}
            onRetry={list.retry}
            onQuery={setQuery}
            searchPlaceholder="Buscar por serie…"
            empty="No hay series que coincidan."
            cardIcon={Hash}
            rowActions={
                canEdit || canDelete
                    ? (item) => (
                          <>
                              {canEdit && (
                                  <RowAction
                                      label="Editar"
                                      tone="edit"
                                      onClick={() => openEdit(item)}
                                  >
                                      <Pencil className="size-4" aria-hidden />
                                  </RowAction>
                              )}
                              {canDelete && !item.used && (
                                  <RowAction
                                      label="Eliminar"
                                      tone="danger"
                                      onClick={() => askDelete(item)}
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
                <SeriesModal
                    series={editing}
                    branches={branches}
                    terminals={terminals}
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
