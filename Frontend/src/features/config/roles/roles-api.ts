import type { TableQuery } from '@/components/data/data-table';
import type { Page } from '@/lib/api';
import { apiDelete, apiGet, apiPost, apiPut, getPage } from '@/lib/api';
import type { CatalogNode } from '@/lib/permission-tree';

export type Role = {
    id: number;
    name: string;
    description: string;
    /** Rol del sistema (Administrador): se mira, no se edita. */
    is_system: boolean;
    user_count: number;
    /** Permisos como se guardan: "*", "erp", "pos.sales", "erp.catalog.products.edit"… */
    permissions: string[];
    created_at: string;
};

export type RolePayload = {
    name: string;
    description: string;
    permissions: string[];
};

/**
 * Traduce lo que pide la tabla (búsqueda y orden) a los parámetros de
 * GET /api/roles. El servidor devuelve 20 filas y un cursor.
 */
export function fetchRolesPage(
    query: TableQuery,
    cursor?: string,
): Promise<Page<Role>> {
    const search = query.search.trim();

    return getPage<Role>('/roles', {
        // El servidor exige 2 caracteres como mínimo para buscar.
        search: search.length >= 2 ? search : undefined,
        fields: query.fields.join(','),
        sort: query.sort?.column,
        direction: query.sort?.direction,
        cursor,
    });
}

export const fetchRoleDetail = (id: number) => apiGet<Role>(`/roles/${id}`);

export const fetchPermissionCatalog = () =>
    apiGet<CatalogNode[]>('/permissions/catalog');

export const createRole = (payload: RolePayload) =>
    apiPost<Role>('/roles', payload);

export const updateRole = (id: number, payload: RolePayload) =>
    apiPut<Role>(`/roles/${id}`, payload);

export const deleteRole = (id: number) => apiDelete(`/roles/${id}`);
