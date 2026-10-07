import type { TableQuery } from '@/components/data/data-table';
import type { Page } from '@/lib/api';
import { apiDelete, apiGet, apiPost, apiPut, getPage } from '@/lib/api';

export type UserStatus = 'active' | 'inactive';

export type UserRole = { id: number; name: string };

export type SystemUser = {
    id: number;
    name: string;
    email: string;
    status: UserStatus;
    status_label: string;
    roles: UserRole[];
    created_at: string;
};

export type UserPayload = {
    name: string;
    email: string;
    status: UserStatus;
    role_ids: number[];
};

export type NewUserPayload = UserPayload & { password: string };

export type UserSummary = { active: number; inactive: number };

/**
 * Traduce lo que pide la tabla (búsqueda, orden, filtros) a los parámetros de
 * GET /api/users. El servidor devuelve 20 filas y un cursor.
 */
export function fetchUsersPage(
    query: TableQuery,
    cursor?: string,
): Promise<Page<SystemUser>> {
    const search = query.search.trim();

    const params: Record<string, string | number | undefined> = {
        // El servidor exige 2 caracteres como mínimo para buscar.
        search: search.length >= 2 ? search : undefined,
        sort: query.sort?.column,
        direction: query.sort?.direction,
        cursor,
    };

    for (const filter of query.filters) {
        switch (filter.column) {
            case 'roles':
                params.role_id = filter.value;
                break;
            case 'status':
                params.status = filter.value;
                break;
            case 'name':
            case 'email':
                // El servidor busca en nombre y correo a la vez.
                params.search = filter.value.length >= 2 ? filter.value : undefined;
                break;
        }
    }

    return getPage<SystemUser>('/users', params);
}

export const fetchUserSummary = () => apiGet<UserSummary>('/users/summary');

export const fetchRoles = () => apiGet<UserRole[]>('/users/roles');

export const createUser = (payload: NewUserPayload) =>
    apiPost<SystemUser>('/users', payload);

export const updateUser = (id: number, payload: UserPayload) =>
    apiPut<SystemUser>(`/users/${id}`, payload);

export const resetUserPassword = (id: number, password: string) =>
    apiPut<{ message: string }>(`/users/${id}/password`, { password });

export const deleteUser = (id: number) => apiDelete(`/users/${id}`);
