import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { TriCheckbox } from '@/components/ui/tri-checkbox';
import {
    actionsOf,
    setAction,
    setNode,
    stateOf,
} from '@/lib/permission-tree';
import type { CatalogNode } from '@/lib/permission-tree';
import { cn } from '@/lib/utils';

type PermissionTreeProps = {
    tree: CatalogNode[];
    /** Las acciones marcadas (códigos completos). */
    selected: Set<string>;
    onChange: (next: Set<string>) => void;
    /** Solo para mirar (el rol Administrador). */
    readOnly?: boolean;
};

/**
 * Los permisos como árbol con casillas: un sistema, un módulo, un submódulo o
 * una acción suelta. Marcar un nivel marca todo lo de adentro; la casilla
 * parcial avisa que hay algo marcado a medias.
 */
export function PermissionTree({
    tree,
    selected,
    onChange,
    readOnly,
}: PermissionTreeProps) {
    // Arrancan abiertos los sistemas que ya tienen algo marcado.
    const [open, setOpen] = useState<Set<string>>(
        () =>
            new Set(
                tree
                    .filter((system) => stateOf(system, selected) !== 'unchecked')
                    .map((system) => system.code),
            ),
    );

    const toggleOpen = (code: string) =>
        setOpen((current) => {
            const next = new Set(current);

            if (!next.delete(code)) {
                next.add(code);
            }

            return next;
        });

    const toggleNode = (node: CatalogNode) =>
        onChange(setNode(selected, node, stateOf(node, selected) !== 'checked'));

    return (
        <div className="space-y-2">
            {tree.map((system) => {
                const isOpen = open.has(system.code);
                const total = actionsOf(system).length;
                const picked = actionsOf(system).filter((code) =>
                    selected.has(code),
                ).length;

                return (
                    <section
                        key={system.code}
                        className="rounded-field border border-line bg-white"
                    >
                        <div className="flex items-center gap-2 px-3 py-2">
                            <button
                                type="button"
                                onClick={() => toggleOpen(system.code)}
                                aria-expanded={isOpen}
                                aria-label={`${isOpen ? 'Cerrar' : 'Abrir'} ${system.label}`}
                                className="grid size-6 shrink-0 place-items-center rounded-md text-ink-muted outline-none hover:bg-black/[0.05] focus-visible:ring-4 focus-visible:ring-accent-ring"
                            >
                                <ChevronDown
                                    className={cn(
                                        'size-4 transition-transform duration-200',
                                        !isOpen && '-rotate-90',
                                    )}
                                    aria-hidden
                                />
                            </button>
                            <TriCheckbox
                                state={stateOf(system, selected)}
                                label={system.label}
                                onChange={() => toggleNode(system)}
                                disabled={readOnly}
                                className="min-w-0 flex-1"
                                labelClassName="font-semibold text-ink"
                            />
                            <span className="text-xs text-ink-soft tabular-nums">
                                {picked} de {total}
                            </span>
                        </div>

                        {isOpen && (
                            <div className="space-y-3 border-t border-line px-3 py-3">
                                {(system.children ?? []).map((module) => (
                                    <div key={module.code}>
                                        <TriCheckbox
                                            state={stateOf(module, selected)}
                                            label={module.label}
                                            onChange={() => toggleNode(module)}
                                            disabled={readOnly}
                                            labelClassName="text-[13px] font-semibold text-ink"
                                        />

                                        <ul className="mt-1.5 ml-[26px] divide-y divide-line">
                                            {(module.children ?? []).map(
                                                (submodule) => (
                                                    <SubmoduleRow
                                                        key={submodule.code}
                                                        submodule={submodule}
                                                        selected={selected}
                                                        onChange={onChange}
                                                        readOnly={readOnly}
                                                    />
                                                ),
                                            )}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );
}

function SubmoduleRow({
    submodule,
    selected,
    onChange,
    readOnly,
}: {
    submodule: CatalogNode;
    selected: Set<string>;
    onChange: (next: Set<string>) => void;
    readOnly?: boolean;
}) {
    return (
        <li className="grid gap-x-4 gap-y-1.5 py-2 sm:grid-cols-[15rem_1fr]">
            <TriCheckbox
                state={stateOf(submodule, selected)}
                label={submodule.label}
                onChange={() =>
                    onChange(
                        setNode(
                            selected,
                            submodule,
                            stateOf(submodule, selected) !== 'checked',
                        ),
                    )
                }
                disabled={readOnly}
                labelClassName="text-ink"
            />

            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {(submodule.actions ?? []).map((action) => (
                    <TriCheckbox
                        key={action.code}
                        state={selected.has(action.code) ? 'checked' : 'unchecked'}
                        label={action.label}
                        onChange={() =>
                            onChange(
                                setAction(
                                    selected,
                                    submodule,
                                    action.code,
                                    !selected.has(action.code),
                                ),
                            )
                        }
                        disabled={readOnly}
                        labelClassName="text-[13px]"
                    />
                ))}
            </div>
        </li>
    );
}
