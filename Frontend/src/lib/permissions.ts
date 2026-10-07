import { apiGet } from '@/lib/api';

/** Lo que puede hacer el usuario: las acciones del catálogo del backend. */
export type Access = {
    superuser: boolean;
    /** Códigos completos: "erp.catalog.products.edit". "ver" ya viene incluido. */
    actions: ReadonlySet<string>;
};

type AccessResponse = { superuser: boolean; permissions: string[] };

export async function fetchAccess(): Promise<Access> {
    const data = await apiGet<AccessResponse>('/permissions/me');

    return { superuser: data.superuser, actions: new Set(data.permissions) };
}
