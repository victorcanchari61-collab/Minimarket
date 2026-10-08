import type { Page } from '@/lib/api';
import { apiGet, apiPost, apiPut, getPage } from '@/lib/api';

export type AccessRole = {
    id: number;
    name: string;
    description: string;
    /** El rol Administrador: acceso total, no se edita. */
    is_system: boolean;
    user_count: number;
    permissions: string[];
};

export type AccessPerson = {
    id: number;
    code: string;
    name: string;
    email: string;
    active: boolean;
    is_admin: boolean;
    roles: string[];
};

/** Lo que puede una persona y de dónde le viene. */
export type PersonAccess = {
    person: AccessPerson;
    roles: { id: number; name: string }[];
    /** La unión de lo que dan sus roles. */
    role_permissions: string[];
    /** Lo que se le dio directamente. */
    allow: string[];
    /** Lo que se le quitó directamente. */
    deny: string[];
};

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export type AccessRequest = {
    id: number;
    user_id: number;
    user_code: string;
    user_name: string;
    user_email: string;
    /** Una acción concreta: "erp.catalog.products.view". */
    permission: string;
    reason: string;
    status: RequestStatus;
    status_label: string;
    decided_by_name: string;
    decided_at: string | null;
    decision_note: string;
    created_at: string;
};

export const fetchAccessRoles = () => apiGet<AccessRole[]>('/access/roles');

export const saveRolePermissions = (id: number, permissions: string[]) =>
    apiPut<unknown>(`/access/roles/${id}`, { permissions });

export const searchPersons = (search: string) =>
    apiGet<AccessPerson[]>('/access/users', { search: search || undefined });

export const fetchPersonAccess = (id: number) =>
    apiGet<PersonAccess>(`/access/users/${id}`);

export const savePersonAccess = (id: number, allow: string[], deny: string[]) =>
    apiPut<PersonAccess>(`/access/users/${id}`, { allow, deny });

/** Lo que se ve en la pestaña Solicitudes: un estado, o todas. */
export type RequestFilter = RequestStatus | 'all';

/** GET /api/access/requests: 20 por petición, de la más reciente a la más antigua. */
export function fetchRequestsPage(
    filter: RequestFilter,
    cursor?: string,
): Promise<Page<AccessRequest>> {
    return getPage<AccessRequest>('/access/requests', {
        status: filter === 'all' ? undefined : filter,
        cursor,
    });
}

export const fetchPendingCount = () =>
    apiGet<{ pending: number }>('/access/requests/summary');

export const approveRequest = (id: number) =>
    apiPost<AccessRequest>(`/access/requests/${id}/approve`, {});

export const rejectRequest = (id: number, note: string) =>
    apiPost<AccessRequest>(`/access/requests/${id}/reject`, { note });

/** Pide acceso a una acción (la hace quien se topa con una pantalla cerrada). */
export const requestAccess = (permission: string, reason: string) =>
    apiPost<AccessRequest>('/access/requests', { permission, reason });
