import { ShieldCheck, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
    fetchPersonAccess,
    savePersonAccess,
    searchPersons,
} from '@/features/config/permissions/access-api';
import type { AccessPerson, PersonAccess } from '@/features/config/permissions/access-api';
import { PermissionTree } from '@/features/config/roles/permission-tree';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useToast } from '@/hooks/use-toast';
import {
    compact,
    difference,
    effective,
    expand,
    sameSet,
    screenCodes,
} from '@/lib/permission-tree';
import type { CatalogNode } from '@/lib/permission-tree';
import { cn } from '@/lib/utils';

type PanelProps = {
    tree: CatalogNode[];
    /** Las pestañas de la pantalla, que van entre la cabecera y el contenido. */
    tabs: ReactNode;
    canAssign: boolean;
    /** Quien está usando la pantalla: nadie cambia sus propios permisos. */
    currentUserId?: number;
};

/** Pestaña "Por persona": elegir a alguien y ajustar lo suyo por encima de sus roles. */
export function PersonAccessPanel({ tree, tabs, canAssign, currentUserId }: PanelProps) {
    const [personId, setPersonId] = useState<number | null>(null);
    const [access, setAccess] = useState<PersonAccess | null>(null);

    const load = (id: number) => {
        fetchPersonAccess(id)
            .then(setAccess)
            .catch(() => setAccess(null));
    };

    const choose = (person: AccessPerson) => {
        setPersonId(person.id);
        setAccess(null);
        load(person.id);
    };

    const picker = <PersonPicker selectedId={personId} onChoose={choose} />;

    return (
        <div className="space-y-5">
            {access ? (
                <PersonEditor
                    picker={picker}
                    // Al guardar, el editor arranca de nuevo con lo guardado.
                    key={`${access.person.id}:${access.allow.join(',')}|${access.deny.join(',')}`}
                    access={access}
                    tree={tree}
                    tabs={tabs}
                    canAssign={canAssign && access.person.id !== currentUserId}
                    isSelf={access.person.id === currentUserId}
                    onSaved={() => load(access.person.id)}
                />
            ) : (
                <>
                    <PageHeader
                        icon={<UserRound className="size-5" aria-hidden />}
                        title="Accesos por persona"
                        description={
                            personId
                                ? 'Cargando accesos…'
                                : 'Elige a alguien para ver y ajustar sus accesos.'
                        }
                    />
                    {tabs}
                    {picker}
                </>
            )}
        </div>
    );
}

function PersonPicker({
    selectedId,
    onChoose,
}: {
    selectedId: number | null;
    onChoose: (person: AccessPerson) => void;
}) {
    const [term, setTerm] = useState('');
    const debounced = useDebouncedValue(term.trim(), 300);
    const [results, setResults] = useState<AccessPerson[] | null>(null);

    useEffect(() => {
        let alive = true;

        searchPersons(debounced)
            .then((found) => alive && setResults(found))
            .catch(() => alive && setResults([]));

        return () => {
            alive = false;
        };
    }, [debounced]);

    return (
        <section className="space-y-2">
            <Input
                label="Persona"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Buscar por nombre, correo o código…"
            />

            <ul className="max-h-60 divide-y divide-line overflow-y-auto rounded-field border border-line bg-white">
                {results === null && (
                    <li className="px-3 py-3 text-sm text-ink-muted">Buscando…</li>
                )}
                {results?.length === 0 && (
                    <li className="px-3 py-3 text-sm text-ink-muted">
                        No hay personas que coincidan.
                    </li>
                )}
                {results?.map((person) => (
                    <li key={person.id}>
                        <button
                            type="button"
                            onClick={() => onChoose(person)}
                            aria-pressed={person.id === selectedId}
                            className={cn(
                                'flex w-full items-center gap-3 px-3 py-2 text-left text-sm outline-none hover:bg-accent-soft focus-visible:bg-accent-soft',
                                person.id === selectedId && 'bg-accent-soft',
                            )}
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-ink">
                                    {person.name}
                                </span>
                                <span className="block truncate text-xs text-ink-muted">
                                    {person.code} · {person.email}
                                </span>
                            </span>
                            <span className="flex shrink-0 flex-wrap justify-end gap-1">
                                {person.roles.length === 0 ? (
                                    <Badge tone="warning">Sin roles</Badge>
                                ) : (
                                    person.roles.map((role) => (
                                        <Badge key={role} tone={person.is_admin ? 'info' : 'neutral'}>
                                            {role}
                                        </Badge>
                                    ))
                                )}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function PersonEditor({
    access,
    tree,
    tabs,
    picker,
    canAssign,
    isSelf,
    onSaved,
}: {
    access: PersonAccess;
    tree: CatalogNode[];
    tabs: ReactNode;
    /** El buscador de personas, justo debajo de las pestañas. */
    picker: ReactNode;
    canAssign: boolean;
    isSelf: boolean;
    onSaved: () => void;
}) {
    const toast = useToast();
    const fromRoles = useMemo(() => expand(access.role_permissions, tree), [access, tree]);
    const initial = useMemo(
        () => effective(access.role_permissions, access.allow, access.deny, tree),
        [access, tree],
    );
    const [selected, setSelected] = useState(initial);
    const [saving, setSaving] = useState(false);

    const { person } = access;
    const screens = screenCodes(tree);
    const enabled = screens.filter((code) => selected.has(code)).length;
    const dirty = !sameSet(selected, initial);
    const readOnly = person.is_admin || !canAssign;

    // Lo que se le da es lo marcado que sus roles no dan; lo que se le quita,
    // lo que sus roles dan y quedó sin marcar.
    const save = async () => {
        setSaving(true);

        try {
            await savePersonAccess(
                person.id,
                compact(difference(selected, fromRoles), tree),
                compact(difference(fromRoles, selected), tree),
            );
            toast.success('Accesos de la persona actualizados.');
            onSaved();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo guardar.');
            setSaving(false);
        }
    };

    const detail = person.is_admin
        ? 'Es administrador: tiene acceso total y no se le puede restringir.'
        : isSelf
          ? 'No puedes cambiar tus propios accesos: pídeselo a otro administrador.'
          : `${access.roles.length === 0 ? 'Sin roles.' : `Roles: ${access.roles.map((role) => role.name).join(', ')}.`} El escudo marca lo que recibe de sus roles.`;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={<UserRound className="size-5" aria-hidden />}
                title={`Accesos de ${person.name}`}
                description={`${enabled} de ${screens.length} pantallas habilitadas. ${detail}`}
                actions={
                    !readOnly && (
                        <>
                            <Button
                                variant="secondary"
                                disabled={!dirty || saving}
                                onClick={() => setSelected(initial)}
                            >
                                Restablecer
                            </Button>
                            <Button disabled={!dirty} loading={saving} onClick={() => void save()}>
                                {saving ? 'Guardando…' : 'Guardar'}
                            </Button>
                        </>
                    )
                }
            />

            {tabs}

            {picker}

            <div className="flex items-center gap-2 text-xs text-ink-muted">
                <ShieldCheck className="size-3.5" aria-hidden />
                Desmarcar algo que viene de un rol se lo quita a esta persona sin cambiar el rol.
            </div>

            <PermissionTree
                tree={tree}
                selected={selected}
                onChange={setSelected}
                readOnly={readOnly}
                inherited={fromRoles}
            />
        </div>
    );
}
