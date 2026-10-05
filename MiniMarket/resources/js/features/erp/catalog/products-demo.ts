/**
 * Datos de EJEMPLO para ver la pantalla de Productos antes de que exista la
 * API. Imita el contrato real de un listado: 20 filas por petición y un cursor
 * para pedir las siguientes. Se reemplaza por `GET /api/catalog/products`.
 */

import type { TableQuery } from '@/components/data/data-table';

export type Product = {
    id: number;
    sku: string;
    name: string;
    category: string;
    unit: string;
    stock: number;
    price: number;
    status: 'active' | 'inactive';
};

export type ProductQuery = TableQuery;

const PAGE_SIZE = 20;

const CATEGORIES = [
    'Abarrotes',
    'Bebidas',
    'Lácteos',
    'Limpieza',
    'Snacks',
    'Panadería',
];

const NAMES: Record<string, [string, string][]> = {
    Abarrotes: [
        ['Arroz extra 5 kg', 'Saco'],
        ['Azúcar rubia 1 kg', 'Bolsa'],
        ['Aceite vegetal 1 L', 'Botella'],
        ['Fideo spaghetti 500 g', 'Bolsa'],
        ['Lenteja bebé 500 g', 'Bolsa'],
        ['Sal de mesa 1 kg', 'Bolsa'],
        ['Atún en aceite 170 g', 'Lata'],
    ],
    Bebidas: [
        ['Gaseosa cola 2.5 L', 'Botella'],
        ['Agua sin gas 625 ml', 'Botella'],
        ['Jugo de naranja 1 L', 'Caja'],
        ['Cerveza rubia 355 ml', 'Lata'],
        ['Té helado 500 ml', 'Botella'],
    ],
    Lácteos: [
        ['Leche evaporada 400 g', 'Lata'],
        ['Yogur natural 1 L', 'Botella'],
        ['Queso fresco 250 g', 'Unidad'],
        ['Mantequilla 200 g', 'Barra'],
    ],
    Limpieza: [
        ['Detergente 900 g', 'Bolsa'],
        ['Lejía 1 L', 'Botella'],
        ['Papel higiénico x4', 'Paquete'],
        ['Jabón de tocador', 'Unidad'],
    ],
    Snacks: [
        ['Papas fritas 150 g', 'Bolsa'],
        ['Galletas de soda', 'Paquete'],
        ['Chocolate en barra', 'Unidad'],
        ['Maní salado 100 g', 'Bolsa'],
    ],
    Panadería: [
        ['Pan de molde blanco', 'Bolsa'],
        ['Pan integral', 'Bolsa'],
        ['Bizcocho vainilla', 'Unidad'],
    ],
};

const PRODUCTS: Product[] = Array.from({ length: 160 }, (_, index) => {
    const id = index + 1;
    const category = CATEGORIES[index % CATEGORIES.length];
    const options = NAMES[category];
    const [base, unit] =
        options[Math.floor(index / CATEGORIES.length) % options.length];
    const variant = Math.floor(index / (CATEGORIES.length * 3)) + 1;

    return {
        id,
        sku: `SKU-${String(100000 + id * 7)}`,
        name: variant > 1 ? `${base} · Lote ${variant}` : base,
        category,
        unit,
        stock: (id * 37) % 240,
        price: Math.round((2 + ((id * 53) % 4200) / 100) * 100) / 100,
        status: id % 11 === 0 ? 'inactive' : 'active',
    };
});

const normalize = (text: string) =>
    text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();

function matches(product: Product, query: ProductQuery): boolean {
    if (query.search) {
        const needle = normalize(query.search);
        const haystack = normalize(
            `${product.name} ${product.sku} ${product.category}`,
        );

        if (!haystack.includes(needle)) {
            return false;
        }
    }

    return query.filters.every((filter) => {
        const raw = product[filter.column as keyof Product];
        const value = normalize(String(raw));
        const wanted = normalize(filter.value);

        if (filter.operator === 'equals') {
            return value === wanted;
        }

        if (filter.operator === 'between') {
            const number = Number(raw);

            return (
                (!filter.value || number >= Number(filter.value)) &&
                (!filter.valueTo || number <= Number(filter.valueTo))
            );
        }

        return value.includes(wanted);
    });
}

function compare(a: Product, b: Product, query: ProductQuery): number {
    if (!query.sort) {
        return a.id - b.id;
    }

    const x = a[query.sort.column as keyof Product];
    const y = b[query.sort.column as keyof Product];
    const order =
        typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y), 'es');

    return query.sort.direction === 'asc' ? order : -order;
}

/** Entrega una página de 20 con un retardo corto, como lo haría la red. */
export function fetchProductsPage(
    query: ProductQuery,
    cursor?: string,
): Promise<{ data: Product[]; nextCursor: string | null }> {
    return new Promise((resolve) => {
        window.setTimeout(() => {
            const rows = PRODUCTS.filter((product) =>
                matches(product, query),
            ).sort((a, b) => compare(a, b, query));
            const offset = cursor ? Number(cursor) : 0;
            const data = rows.slice(offset, offset + PAGE_SIZE);
            const next = offset + PAGE_SIZE;

            resolve({
                data,
                nextCursor: next < rows.length ? String(next) : null,
            });
        }, 350);
    });
}

/** Cifras de la cabecera de la pantalla (también de ejemplo). */
export function productStats() {
    const active = PRODUCTS.filter((product) => product.status === 'active');

    return {
        total: PRODUCTS.length,
        active: active.length,
        lowStock: active.filter((product) => product.stock < 20).length,
        categories: new Set(PRODUCTS.map((product) => product.category)).size,
    };
}

export const PRODUCT_CATEGORIES = CATEGORIES;
