import type { TableQuery } from '@/components/data/data-table';
import type { Page } from '@/lib/api';
import { apiDelete, apiGet, apiPost, apiPut, getPage } from '@/lib/api';

// --- Datos de la empresa ---------------------------------------------------

export type Company = {
    id: number;
    ruc: string;
    legal_name: string;
    trade_name: string;
    fiscal_address: string;
    phone: string;
    email: string;
    updated_at: string;
};

export type CompanyPayload = Omit<Company, 'id' | 'updated_at'>;

export const fetchCompany = () => apiGet<Company>('/company');

export const updateCompany = (payload: CompanyPayload) =>
    apiPut<Company>('/company', payload);

// --- Sucursales ------------------------------------------------------------

export type BranchKind = 'store' | 'distribution';

export type ManagedBranch = {
    id: number;
    code: string;
    name: string;
    address: string;
    phone: string;
    /** Establecimiento anexo de SUNAT (4 dígitos); vacío si no tiene. */
    sunat_code: string;
    kind: BranchKind;
    kind_label: string;
    active: boolean;
    warehouses: number;
    users: number;
    created_at: string;
};

export type BranchPayload = {
    code: string;
    name: string;
    address: string;
    phone: string;
    sunat_code: string;
    kind: BranchKind;
    active: boolean;
};

export type BranchSummary = {
    active: number;
    inactive: number;
    stores: number;
    distribution: number;
};

/**
 * Traduce lo que pide la tabla (búsqueda, orden, filtros) a GET /api/branches.
 * El servidor devuelve 20 filas y un cursor.
 */
export function fetchBranchesPage(
    query: TableQuery,
    cursor?: string,
): Promise<Page<ManagedBranch>> {
    const search = query.search.trim();

    const params: Record<string, string | number | undefined> = {
        // El servidor exige 2 caracteres como mínimo para buscar.
        search: search.length >= 2 ? search : undefined,
        fields: query.fields.join(','),
        sort: query.sort?.column,
        direction: query.sort?.direction,
        cursor,
    };

    for (const filter of query.filters) {
        if (filter.column === 'kind') params.kind = filter.value;
        if (filter.column === 'status') params.status = filter.value;
    }

    return getPage<ManagedBranch>('/branches', params);
}

export const fetchBranchDetail = (id: number) =>
    apiGet<ManagedBranch>(`/branches/${id}`);

export const fetchBranchSummary = () => apiGet<BranchSummary>('/branches/summary');

export const createBranch = (payload: BranchPayload) =>
    apiPost<ManagedBranch>('/branches', payload);

export const updateBranch = (id: number, payload: BranchPayload) =>
    apiPut<ManagedBranch>(`/branches/${id}`, payload);

export const deleteBranch = (id: number) => apiDelete(`/branches/${id}`);

// --- Almacenes -------------------------------------------------------------

export type Warehouse = {
    id: number;
    branch_id: number;
    branch_name: string;
    code: string;
    name: string;
    address: string;
    active: boolean;
    created_at: string;
};

export type WarehousePayload = {
    branch_id: number;
    code: string;
    name: string;
    address: string;
    active: boolean;
};

export type WarehouseSummary = {
    active: number;
    inactive: number;
    /** Sucursales activas que todavía no tienen almacén. */
    branches_without: number;
};

export type BranchOption = { id: number; code: string; name: string };

/** Traduce lo que pide la tabla a GET /api/warehouses (20 filas y un cursor). */
export function fetchWarehousesPage(
    query: TableQuery,
    cursor?: string,
): Promise<Page<Warehouse>> {
    const search = query.search.trim();

    const params: Record<string, string | number | undefined> = {
        search: search.length >= 2 ? search : undefined,
        fields: query.fields.join(','),
        sort: query.sort?.column,
        direction: query.sort?.direction,
        cursor,
    };

    for (const filter of query.filters) {
        if (filter.column === 'branch') params.branch_id = filter.value;
        if (filter.column === 'status') params.status = filter.value;
    }

    return getPage<Warehouse>('/warehouses', params);
}

export const fetchWarehouseDetail = (id: number) =>
    apiGet<Warehouse>(`/warehouses/${id}`);

export const fetchWarehouseSummary = () =>
    apiGet<WarehouseSummary>('/warehouses/summary');

export const fetchWarehouseBranches = () =>
    apiGet<BranchOption[]>('/warehouses/branches');

export const createWarehouse = (payload: WarehousePayload) =>
    apiPost<Warehouse>('/warehouses', payload);

export const updateWarehouse = (id: number, payload: WarehousePayload) =>
    apiPut<Warehouse>(`/warehouses/${id}`, payload);

export const deleteWarehouse = (id: number) => apiDelete(`/warehouses/${id}`);
