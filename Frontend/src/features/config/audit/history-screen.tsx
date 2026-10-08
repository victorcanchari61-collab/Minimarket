import { Fingerprint, History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ListPage } from '@/components/data/list-page';
import type { DataTableColumn, TableQuery } from '@/components/data/data-table';
import { Badge } from '@/components/ui/badge';
import {
    ACTIONS,
    ENTITIES,
    actionOf,
    entityLabel,
    fetchHistoryPage,
    fetchHistoryUsers,
} from '@/features/config/audit/audit-api';
import type { AuditAction, AuditUser } from '@/features/config/audit/audit-api';
import { usePagedList } from '@/hooks/use-paged-list';

const WHEN = new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

/** Configuraciones › Auditoría › Historial de acciones: quién hizo qué y cuándo (solo lectura). */
export default function HistoryScreen() {
    const [query, setQuery] = useState<TableQuery | null>(null);
    const list = usePagedList<AuditAction, TableQuery>({
        query,
        fetchPage: fetchHistoryPage,
    });
    const [users, setUsers] = useState<AuditUser[]>([]);

    useEffect(() => {
        fetchHistoryUsers().then(setUsers).catch(() => undefined);
    }, []);

    const columns = useMemo<DataTableColumn<AuditAction>[]>(
        () => [
            {
                key: 'date',
                fields: ['at'],
                label: 'Fecha y hora',
                sortable: true,
                searchable: false,
                filterType: 'date',
                width: 180,
                render: (item) => (
                    <span className="whitespace-nowrap text-ink-muted">
                        {WHEN.format(new Date(item.at))}
                    </span>
                ),
            },
            {
                key: 'user',
                fields: ['user_name', 'user_email'],
                label: 'Persona',
                searchable: false,
                filterType: 'select',
                filterOptions: users.map((user) => ({
                    value: String(user.id),
                    label: user.name,
                })),
                width: 230,
                render: (item) => (
                    <div className="leading-tight">
                        <div className="font-medium text-ink">{item.user_name || '—'}</div>
                        <div className="text-xs text-ink-soft">{item.user_email}</div>
                    </div>
                ),
            },
            {
                key: 'action',
                fields: ['action'],
                label: 'Acción',
                searchable: false,
                filterType: 'select',
                filterOptions: ACTIONS.map(({ value, label }) => ({ value, label })),
                width: 190,
                render: (item) => {
                    const action = actionOf(item.action);

                    return <Badge tone={action.tone}>{action.label}</Badge>;
                },
            },
            {
                key: 'entity',
                fields: ['entity'],
                label: 'Sobre qué',
                searchable: false,
                filterType: 'select',
                filterOptions: ENTITIES,
                width: 200,
                render: (item) => entityLabel(item.entity),
            },
            {
                key: 'label',
                fields: ['label', 'entity_id'],
                label: 'Registro',
                searchable: false,
                filterable: false,
                width: 260,
                render: (item) => (
                    <div className="leading-tight">
                        <div className="text-ink">{item.label || '—'}</div>
                        {item.entity_id !== null && (
                            <div className="font-mono text-xs text-ink-soft">#{item.entity_id}</div>
                        )}
                    </div>
                ),
            },
            {
                key: 'ip',
                fields: ['ip'],
                label: 'Dirección IP',
                searchable: false,
                filterable: false,
                width: 150,
                render: (item) => (
                    <span className="font-mono text-[13px] text-ink-muted">{item.ip || '—'}</span>
                ),
            },
        ],
        [users],
    );

    return (
        <ListPage<AuditAction>
            icon={<History className="size-5" aria-hidden />}
            title="Historial de acciones"
            description="Quién hizo qué, cuándo y desde dónde. Por defecto se muestra el último mes."
            columns={columns}
            rowNumbers
            rows={list.rows}
            loading={list.loading}
            pager={list.pager}
            requiredFields={['id']}
            error={list.error}
            onRetry={list.retry}
            onQuery={setQuery}
            searchPlaceholder="Buscar por persona o nombre del registro…"
            empty="No hay acciones en este rango."
            cardIcon={Fingerprint}
            note="Solo se anota que algo pasó (quién, cuándo, sobre qué registro); nunca el contenido ni las contraseñas."
        />
    );
}
