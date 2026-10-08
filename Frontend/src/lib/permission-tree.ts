/**
 * El árbol de permisos como lo entrega GET /api/permissions/catalog:
 * sistema → módulo → submódulo → acciones. En la pantalla se marcan acciones
 * sueltas ("hojas"); al guardar se juntan en el nivel más alto posible, así lo
 * que se agregue después a un módulo entero queda incluido solo.
 */

export type CatalogAction = { code: string; label: string };

export type CatalogNode = {
    code: string;
    label: string;
    /** Sistema → módulos, módulo → submódulos. */
    children?: CatalogNode[];
    /** Solo los submódulos: "Ver" primero y luego las suyas. */
    actions?: CatalogAction[];
};

export type CheckState = 'checked' | 'unchecked' | 'mixed';

/** Los códigos de todas las acciones que cuelgan de un nodo. */
export function actionsOf(node: CatalogNode): string[] {
    if (node.actions) {
        return node.actions.map((action) => action.code);
    }

    return (node.children ?? []).flatMap(actionsOf);
}

function submodulesOf(node: CatalogNode): CatalogNode[] {
    return node.actions ? [node] : (node.children ?? []).flatMap(submodulesOf);
}

const covers = (rule: string, code: string) =>
    rule === '*' || rule === code || code.startsWith(`${rule}.`);

const viewOf = (submodule: CatalogNode) => `${submodule.code}.view`;

/**
 * De los permisos guardados en un rol ("erp", "pos.sales", "erp.catalog.products.edit")
 * a las acciones concretas que quedan marcadas. Cualquier acción deja marcado
 * también "Ver" de su submódulo.
 */
export function expand(rules: string[], tree: CatalogNode[]): Set<string> {
    const selected = new Set<string>();

    for (const system of tree) {
        for (const action of actionsOf(system)) {
            if (rules.some((rule) => covers(rule, action))) {
                selected.add(action);
            }
        }

        for (const submodule of submodulesOf(system)) {
            if (actionsOf(submodule).some((code) => selected.has(code))) {
                selected.add(viewOf(submodule));
            }
        }
    }

    return selected;
}

function pack(node: CatalogNode, selected: Set<string>): { full: boolean; codes: string[] } {
    if (node.actions) {
        const picked = actionsOf(node).filter((code) => selected.has(code));
        const full = picked.length === node.actions.length;

        return { full, codes: full ? [node.code] : picked };
    }

    const parts = (node.children ?? []).map((child) => pack(child, selected));
    const full = parts.length > 0 && parts.every((part) => part.full);

    return { full, codes: full ? [node.code] : parts.flatMap((part) => part.codes) };
}

/**
 * De las acciones marcadas a los permisos que se guardan: si un submódulo, un
 * módulo o un sistema está marcado entero, se guarda su código y no el de cada acción.
 */
export function compact(selected: Set<string>, tree: CatalogNode[]): string[] {
    return tree.flatMap((system) => pack(system, selected).codes);
}

export function stateOf(node: CatalogNode, selected: Set<string>): CheckState {
    const codes = actionsOf(node);
    const picked = codes.filter((code) => selected.has(code)).length;

    if (picked === 0) {
        return 'unchecked';
    }

    return picked === codes.length ? 'checked' : 'mixed';
}

/** Marca o desmarca todo lo que cuelga de un nodo. */
export function setNode(selected: Set<string>, node: CatalogNode, on: boolean): Set<string> {
    const next = new Set(selected);

    for (const code of actionsOf(node)) {
        if (on) {
            next.add(code);
        } else {
            next.delete(code);
        }
    }

    return next;
}

/**
 * Marca o desmarca una acción de un submódulo. Marcar cualquiera marca también
 * "Ver"; quitar "Ver" quita todas, porque no se puede actuar sobre lo que no se ve.
 */
export function setAction(
    selected: Set<string>,
    submodule: CatalogNode,
    code: string,
    on: boolean,
): Set<string> {
    const next = new Set(selected);

    if (on) {
        next.add(code);
        next.add(viewOf(submodule));

        return next;
    }

    if (code === viewOf(submodule)) {
        return setNode(next, submodule, false);
    }

    next.delete(code);

    return next;
}
