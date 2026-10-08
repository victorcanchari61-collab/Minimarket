import { Check, Inbox, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { ListPage } from '@/components/data/list-page';
import type { DataTableColumn } from '@/components/data/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { RowAction } from '@/components/ui/row-action';
import {
    approveRequest,
    fetchRequestsPage,
    rejectRequest,
} from '@/features/config/permissions/access-api';
import type {
    AccessRequest,
    RequestFilter,
    RequestStatus,
} from '@/features/config/permissions/access-api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePagedList } from '@/hooks/use-paged-list';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';
import { describe } from '@/lib/permission-tree';
import { cn } from '@/lib/utils';
import type { CatalogNode } from '@/lib/permission-tree';

const FILTERS: { value: RequestFilter; label: string }[] = [
    { value: 'pending', label: 'Pendientes' },
    { value: 'approved', label: 'Aprobadas' },
    { value: 'rejected', label: 'Rechazadas' },
    { value: 'all', label: 'Todas' },
];

const STATUS_TONE: Record<RequestStatus, 'warning' | 'success' | 'danger'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
};

const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : 'No se pudo completar la acción.';

type RequestsPanelProps = {
    tree: CatalogNode[];
    /** Las pestañas de la pantalla, que van entre la cabecera y la tabla. */
    tabs: ReactNode;
    canAssign: boolean;
    /** Avisa que cambió el número de pendientes (la cifra de la pestaña). */
    onChanged: () => void;
};

/** Pestaña "Solicitudes": quien se topó con una pantalla cerrada pide acceso, y aquí se resuelve. */
export function RequestsPanel({ tree, tabs, canAssign, onChanged }: RequestsPanelProps) {
    // Lo que hay que atender primero: las pendientes.
    const [filter, setFilter] = useState<RequestFilter>('pending');
    const list = usePagedList<AccessRequest, RequestFilter>({
        query: filter,
        fetchPage: fetchRequestsPage,
    });
    const toast = useToast();
    const { confirm, dialog } = useConfirm();
    const [rejecting, setRejecting] = useState<AccessRequest | null>(null);

    const resolved = () => {
        list.reload();
        onChanged();
    };

    const columns = useMemo<DataTableColumn<AccessRequest>[]>(
        () => [
            {
                key: 'user',
                label: 'Solicitante',
                searchable: false,
                filterable: false,
                width: 220,
                render: (request) => (
                    <span className="block min-w-0">
                        <span className="block truncate font-medium text-ink">
                            {request.user_name}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                            {request.user_code} · {request.user_email}
                        </span>
                    </span>
                ),
            },
            {
                key: 'permission',
                label: 'Pide acceso a',
                searchable: false,
                filterable: false,
                width: 300,
                render: (request) => describe(request.permission, tree),
            },
            {
                key: 'reason',
                label: 'Motivo',
                searchable: false,
                filterable: false,
                width: 240,
                render: (request) => request.reason || '—',
            },
            {
                key: 'created',
                label: 'Solicitada',
                searchable: false,
                filterable: false,
                width: 120,
                render: (request) => formatDate(request.created_at),
            },
            {
                key: 'status',
                label: 'Estado',
                searchable: false,
                filterable: false,
                width: 120,
                render: (request) => (
                    <Badge tone={STATUS_TONE[request.status]}>{request.status_label}</Badge>
                ),
            },
            {
                key: 'decided',
                label: 'Resuelta por',
                searchable: false,
                filterable: false,
                width: 200,
                render: (request) =>
                    request.decided_by_name
                        ? `${request.decided_by_name}${request.decided_at ? ` · ${formatDate(request.decided_at)}` : ''}`
                        : '—',
            },
        ],
        [tree],
    );

    const askApprove = (request: AccessRequest) =>
        confirm({
            title: 'Aprobar solicitud',
            message: `${request.user_name} recibirá acceso a: ${describe(request.permission, tree)}.`,
            confirmLabel: 'Aprobar',
            action: async () => {
                try {
                    await approveRequest(request.id);
                    toast.success('Solicitud aprobada: la persona ya tiene el acceso.');
                    resolved();
                } catch (error) {
                    toast.error(messageOf(error));
                    resolved();
                }
            },
        });

    return (
        <ListPage<AccessRequest>
            icon={<Inbox className="size-5" aria-hidden />}
            title="Solicitudes de acceso"
            description="Lo que la gente pide al toparse con una pantalla cerrada"
            banner={
                <div className="space-y-4">
                    {tabs}
                    <div role="group" aria-label="Estado" className="flex flex-wrap gap-2">
                        {FILTERS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={filter === option.value}
                                onClick={() => setFilter(option.value)}
                                className={cn(
                                    'rounded-full border px-3 py-1 text-[13px] font-medium outline-none focus-visible:ring-4 focus-visible:ring-accent-ring',
                                    filter === option.value
                                        ? 'border-accent bg-accent-soft text-accent-ink'
                                        : 'border-line bg-white text-ink-muted hover:text-ink',
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            }
            columns={columns}
            rows={list.rows}
            loading={list.loading}
            pager={list.pager}
            error={list.error}
            onRetry={list.retry}
            // El estado se elige con los botones de arriba; la tabla no filtra por su cuenta.
            onQuery={() => undefined}
            toolbar={false}
            empty={
                filter === 'pending'
                    ? 'No hay solicitudes pendientes.'
                    : 'No hay solicitudes con ese estado.'
            }
            cardIcon={Inbox}
            rowActions={
                canAssign
                    ? (request) =>
                          request.status === 'pending' ? (
                              <>
                                  <RowAction
                                      label="Aprobar"
                                      tone="success"
                                      onClick={() => askApprove(request)}
                                  >
                                      <Check className="size-4" aria-hidden />
                                  </RowAction>
                                  <RowAction
                                      label="Rechazar"
                                      tone="danger"
                                      onClick={() => setRejecting(request)}
                                  >
                                      <X className="size-4" aria-hidden />
                                  </RowAction>
                              </>
                          ) : null
                    : undefined
            }
        >
            {rejecting && (
                <RejectModal
                    request={rejecting}
                    onClose={() => setRejecting(null)}
                    onDone={() => {
                        setRejecting(null);
                        resolved();
                    }}
                />
            )}
            {dialog}
        </ListPage>
    );
}

function RejectModal({
    request,
    onClose,
    onDone,
}: {
    request: AccessRequest;
    onClose: () => void;
    onDone: () => void;
}) {
    const toast = useToast();
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const reject = async () => {
        setSaving(true);

        try {
            await rejectRequest(request.id, note.trim());
            toast.success('Solicitud rechazada.');
            onDone();
        } catch (error) {
            toast.error(messageOf(error));
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            title="Rechazar solicitud"
            description={request.user_name}
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button size="sm" loading={saving} onClick={() => void reject()}>
                        {saving ? 'Rechazando…' : 'Rechazar'}
                    </Button>
                </>
            }
        >
            <Input
                label="Motivo del rechazo (opcional)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={200}
                autoFocus
            />
        </Modal>
    );
}
