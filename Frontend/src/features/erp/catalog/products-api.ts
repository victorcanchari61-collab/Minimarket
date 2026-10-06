import type { TableQuery } from '@/components/data/data-table';
import type { Page } from '@/lib/api';
import { apiDelete, apiGet, apiPost, apiPut, getPage } from '@/lib/api';

export type ProductStatus = 'active' | 'inactive';

export type Product = {
    id: number;
    sku: string;
    name: string;
    category_id: number | null;
    category: string | null;
    unit_id: number;
    unit: string;
    /** Texto exacto ("24.90"): el dinero nunca pasa por número decimal. */
    price: string;
    status: ProductStatus;
    status_label: string;
};

export type ProductPayload = {
    sku: string;
    name: string;
    category_id: number | null;
    unit_id: number;
    price: string;
    status: ProductStatus;
};

export type Category = { id: number; name: string };
export type Unit = { id: number; name: string; abbreviation: string };
export type ProductSummary = {
    active: number;
    inactive: number;
    categories: number;
};

/**
 * Traduce lo que pide la tabla (búsqueda, orden, filtros) a los parámetros de
 * GET /api/catalog/products. El servidor devuelve 20 filas y un cursor.
 */
export function fetchProductsPage(
    query: TableQuery,
    cursor?: string,
): Promise<Page<Product>> {
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
            case 'sku':
            case 'name':
                params[filter.column] = filter.value;
                break;
            case 'category':
                params.category_id = filter.value;
                break;
            case 'status':
                params.status = filter.value;
                break;
        }
    }

    return getPage<Product>('/catalog/products', params);
}

export const fetchProductSummary = () =>
    apiGet<ProductSummary>('/catalog/products/summary');

export const fetchCategories = () => apiGet<Category[]>('/catalog/categories');

export const fetchUnits = () => apiGet<Unit[]>('/catalog/units');

export const createProduct = (payload: ProductPayload) =>
    apiPost<Product>('/catalog/products', payload);

export const updateProduct = (id: number, payload: ProductPayload) =>
    apiPut<Product>(`/catalog/products/${id}`, payload);

export const deleteProduct = (id: number) =>
    apiDelete(`/catalog/products/${id}`);
