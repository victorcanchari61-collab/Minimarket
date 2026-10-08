import type { TableQuery } from '@/components/data/data-table';
import type { Page } from '@/lib/api';
import { apiDelete, apiGet, apiPost, apiPut, getPage } from '@/lib/api';

// --- Terminales POS --------------------------------------------------------

export type Terminal = {
    id: number;
    branch_id: number;
    branch_name: string;
    warehouse_id: number | null;
    warehouse_name: string;
    code: string;
    name: string;
    active: boolean;
    /** Cuántas series de comprobantes usa. */
    series: number;
    created_at: string;
};

export type TerminalPayload = {
    branch_id: number;
    warehouse_id: number | null;
    code: string;
    name: string;
    active: boolean;
};

export type TerminalSummary = {
    active: number;
    inactive: number;
    /** Tiendas activas que todavía no tienen una caja activa. */
    stores_without: number;
};

export type BranchOption = { id: number; code: string; name: string };
export type WarehouseOption = { id: number; branch_id: number; name: string };

/** Traduce lo que pide la tabla a GET /api/terminals (20 filas y un cursor). */
export function fetchTerminalsPage(
    query: TableQuery,
    cursor?: string,
): Promise<Page<Terminal>> {
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

    return getPage<Terminal>('/terminals', params);
}

export const fetchTerminalDetail = (id: number) => apiGet<Terminal>(`/terminals/${id}`);

export const fetchTerminalSummary = () => apiGet<TerminalSummary>('/terminals/summary');

export const fetchTerminalBranches = () => apiGet<BranchOption[]>('/terminals/branches');

export const fetchTerminalWarehouses = () =>
    apiGet<WarehouseOption[]>('/terminals/warehouses');

export const createTerminal = (payload: TerminalPayload) =>
    apiPost<Terminal>('/terminals', payload);

export const updateTerminal = (id: number, payload: TerminalPayload) =>
    apiPut<Terminal>(`/terminals/${id}`, payload);

export const deleteTerminal = (id: number) => apiDelete(`/terminals/${id}`);

// --- Series de comprobantes ------------------------------------------------

export type DocumentType =
    | 'invoice'
    | 'receipt'
    | 'credit_note'
    | 'debit_note'
    | 'dispatch_guide';

/** Nombre de cada tipo y letras con las que puede empezar su serie (SUNAT). */
export const DOCUMENT_TYPES: { value: DocumentType; label: string; prefixes: string }[] = [
    { value: 'invoice', label: 'Factura', prefixes: 'F' },
    { value: 'receipt', label: 'Boleta de venta', prefixes: 'B' },
    { value: 'credit_note', label: 'Nota de crédito', prefixes: 'FB' },
    { value: 'debit_note', label: 'Nota de débito', prefixes: 'FB' },
    { value: 'dispatch_guide', label: 'Guía de remisión', prefixes: 'TV' },
];

export const documentTypeLabel = (type: string) =>
    DOCUMENT_TYPES.find((option) => option.value === type)?.label ?? type;

export type DocumentSeries = {
    id: number;
    branch_id: number;
    branch_name: string;
    terminal_id: number | null;
    terminal_name: string;
    document_type: DocumentType;
    series: string;
    /** El siguiente correlativo; lo mueve el sistema al emitir. */
    next_number: number;
    /** Ya emitió comprobantes: no cambia de tipo ni de código, solo se desactiva. */
    used: boolean;
    active: boolean;
    created_at: string;
};

export type SeriesPayload = {
    branch_id: number;
    terminal_id: number | null;
    document_type: DocumentType;
    series: string;
    /** Solo al crear: desde dónde sigue la numeración. */
    next_number?: number;
    active: boolean;
};

export type SeriesSummary = { active: number; inactive: number; used: number };

export type TerminalOption = { id: number; branch_id: number; code: string; name: string };

/** Traduce lo que pide la tabla a GET /api/document-series (20 filas y un cursor). */
export function fetchSeriesPage(
    query: TableQuery,
    cursor?: string,
): Promise<Page<DocumentSeries>> {
    const search = query.search.trim();

    const params: Record<string, string | number | undefined> = {
        search: search || undefined,
        fields: query.fields.join(','),
        sort: query.sort?.column,
        direction: query.sort?.direction,
        cursor,
    };

    for (const filter of query.filters) {
        if (filter.column === 'branch') params.branch_id = filter.value;
        if (filter.column === 'terminal') params.terminal_id = filter.value;
        if (filter.column === 'type') params.document_type = filter.value;
        if (filter.column === 'status') params.status = filter.value;
    }

    return getPage<DocumentSeries>('/document-series', params);
}

export const fetchSeriesDetail = (id: number) =>
    apiGet<DocumentSeries>(`/document-series/${id}`);

export const fetchSeriesSummary = () => apiGet<SeriesSummary>('/document-series/summary');

export const fetchSeriesBranches = () => apiGet<BranchOption[]>('/document-series/branches');

export const fetchSeriesTerminals = () =>
    apiGet<TerminalOption[]>('/document-series/terminals');

export const createSeries = (payload: SeriesPayload) =>
    apiPost<DocumentSeries>('/document-series', payload);

export const updateSeries = (id: number, payload: SeriesPayload) =>
    apiPut<DocumentSeries>(`/document-series/${id}`, payload);

export const deleteSeries = (id: number) => apiDelete(`/document-series/${id}`);
