/**
 * Qué presentaciones de un producto se pueden elegir según para qué se usa.
 *
 * Cada presentación dice si "se compra" y si "se vende" — la unidad base
 * también: hay productos que solo salen por caja y no por unidad suelta. Sin
 * esto los selectores ofrecían siempre la unidad base, y se podía armar un
 * pedido por unidades de algo que no se vende así.
 *
 * La unidad base se representa con el valor 0 en los selectores (no tiene una
 * presentación propia en la línea del documento); las demás, con su id.
 */

/** Para qué se elige la presentación. Sin uso (ajustes, transferencias...) valen todas las activas. */
export type PresentationUsage = 'sale' | 'purchase';

export interface UsablePresentation {
    id: number;
    name: string;
    /** A cuántas unidades base equivale (la base vale 1). */
    factor: number;
    isBase: boolean;
    active: boolean;
    /** Si no vienen, no excluyen a la presentación. */
    isPurchase?: boolean;
    isSale?: boolean;
}

export interface UsableProduct {
    baseUnit: string;
    presentations: UsablePresentation[];
}

export interface PresentationOption {
    value: number;
    label: string;
    /** A cuántas unidades base equivale (la base es 1): con esto se convierte un stock a esa unidad. */
    factor: number;
    note?: string;
    detail?: string;
}

/** Si esa presentación sirve para ese uso. Un dato que no viene (undefined) no la excluye. */
function isEnabled(
    presentation: UsablePresentation,
    usage?: PresentationUsage,
): boolean {
    if (!presentation.active) {
        return false;
    }

    if (usage === 'sale') {
        return presentation.isSale !== false;
    }

    if (usage === 'purchase') {
        return presentation.isPurchase !== false;
    }

    return true;
}

/**
 * Si la unidad base se puede elegir. Es la presentación de factor 1; si el
 * producto no la trae en su lista, no hay nada que la apague y se ofrece,
 * como siempre.
 */
export function isBaseUnitEnabled(
    product: UsableProduct,
    usage?: PresentationUsage,
): boolean {
    const bases = product.presentations.filter((p) => p.isBase);

    return bases.length === 0 || bases.some((p) => isEnabled(p, usage));
}

/** Las opciones de un selector de unidad, con la base primero si corresponde. */
export function presentationOptions(
    product: UsableProduct,
    usage?: PresentationUsage,
    /**
     * La que ya tiene una línea guardada. Si el producto dejó de venderse así
     * después, se sigue mostrando (marcada) en vez de quedar el selector en
     * blanco: quien edita ve qué pasó y la cambia.
     */
    current?: number,
): PresentationOption[] {
    const options: PresentationOption[] = [];

    if (isBaseUnitEnabled(product, usage)) {
        options.push({
            value: 0,
            label: product.baseUnit,
            factor: 1,
            note: 'unidad base',
        });
    }

    for (const presentation of product.presentations) {
        if (presentation.isBase || !isEnabled(presentation, usage)) {
            continue;
        }

        options.push({
            value: presentation.id,
            label: presentation.name,
            factor: presentation.factor,
            detail: `${presentation.factor} ${product.baseUnit}`,
        });
    }

    if (current !== undefined && !options.some((o) => o.value === current)) {
        const saved = product.presentations.find((p) => p.id === current);

        options.push({
            value: current,
            label: saved?.name ?? product.baseUnit,
            factor: saved?.factor ?? 1,
            note:
                usage === 'purchase'
                    ? 'ya no se compra así'
                    : usage === 'sale'
                      ? 'ya no se vende así'
                      : 'no disponible',
        });
    }

    return options;
}

/**
 * La unidad con la que arranca una línea nueva: la MÁS GRANDE que se puede
 * usar (el saco de 50 kg antes que la bolsa o el kilo). Casi todo sale por
 * saco o caja y de todos modos se puede cambiar; arrancar por la unidad suelta
 * obligaba a cambiarla en cada línea. Null cuando el producto no se puede usar
 * en ninguna presentación para ese uso.
 */
export function initialPresentation(
    product: UsableProduct,
    usage?: PresentationUsage,
): number | null {
    const options = presentationOptions(product, usage);

    if (options.length === 0) {
        return null;
    }

    // A igualdad de tamaño gana la primera (la base va antes que las presentaciones).
    return options.reduce((largest, o) =>
        o.factor > largest.factor ? o : largest,
    ).value;
}

/** Igual que `initialPresentation`, para cuando se cambia el producto de una fila y solo se tiene su id. */
export function initialPresentationOf(
    products: (UsableProduct & { id: number })[],
    productId: number,
    usage?: PresentationUsage,
): number {
    const product = products.find((p) => p.id === productId);

    return product ? (initialPresentation(product, usage) ?? 0) : 0;
}
