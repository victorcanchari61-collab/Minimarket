import type { TableQuery } from '@/components/data/data-table';
import type { BadgeTone } from '@/components/ui/badge';
import type { Page } from '@/lib/api';
import { apiGet, getPage } from '@/lib/api';

export type AuditAction = {
    id: number;
    at: string;
    user_id: number | null;
    user_name: string;
    user_email: string;
    action: string;
    entity: string;
    entity_id: number | null;
    label: string;
    method: string;
    ip: string;
};

export type AuditUser = { id: number; name: string; email: string };

/** Cómo se lee cada acción del historial y de qué color es su etiqueta. */
export const ACTIONS: { value: string; label: string; tone: BadgeTone }[] = [
    { value: 'create', label: 'Creó', tone: 'success' },
    { value: 'update', label: 'Editó', tone: 'info' },
    { value: 'delete', label: 'Eliminó', tone: 'danger' },
    { value: 'approve', label: 'Aprobó', tone: 'success' },
    { value: 'reject', label: 'Rechazó', tone: 'warning' },
    { value: 'reset_password', label: 'Restableció contraseña', tone: 'warning' },
    { value: 'login', label: 'Inició sesión', tone: 'neutral' },
    { value: 'login_failed', label: 'Intento fallido', tone: 'danger' },
    { value: 'logout', label: 'Cerró sesión', tone: 'neutral' },
];

/** Los registros que se anotan, con el nombre que se les da en pantalla. */
export const ENTITIES: { value: string; label: string }[] = [
    { value: 'users', label: 'Usuario' },
    { value: 'roles', label: 'Rol' },
    { value: 'access/roles', label: 'Accesos de un rol' },
    { value: 'access/users', label: 'Accesos de una persona' },
    { value: 'access/requests', label: 'Solicitud de acceso' },
    { value: 'company', label: 'Datos de la empresa' },
    { value: 'branches', label: 'Sucursal' },
    { value: 'warehouses', label: 'Almacén' },
    { value: 'terminals', label: 'Terminal POS' },
    { value: 'document-series', label: 'Serie de comprobantes' },
    { value: 'catalog/products', label: 'Producto' },
    { value: 'session', label: 'Sesión' },
];

export const actionOf = (value: string) =>
    ACTIONS.find((action) => action.value === value) ?? { value, label: value, tone: 'neutral' as const };

export const entityLabel = (value: string) =>
    ENTITIES.find((entity) => entity.value === value)?.label ?? value;

/** Traduce lo que pide la tabla a GET /api/audit/history (20 filas y un cursor). */
export function fetchHistoryPage(
    query: TableQuery,
    cursor?: string,
): Promise<Page<AuditAction>> {
    const search = query.search.trim();

    const params: Record<string, string | number | undefined> = {
        search: search.length >= 2 ? search : undefined,
        fields: query.fields.join(','),
        // Solo se ordena por fecha; sin elegir, lo más reciente primero.
        direction: query.sort?.column === 'date' ? query.sort.direction : undefined,
        cursor,
    };

    for (const filter of query.filters) {
        if (filter.column === 'date') {
            params.from = filter.value || undefined;
            params.to = filter.valueTo || undefined;
        }

        if (filter.column === 'user') params.user_id = filter.value;
        if (filter.column === 'entity') params.entity = filter.value;
        if (filter.column === 'action') params.action = filter.value;
    }

    return getPage<AuditAction>('/audit/history', params);
}

export const fetchHistoryUsers = () => apiGet<AuditUser[]>('/audit/history/users');
