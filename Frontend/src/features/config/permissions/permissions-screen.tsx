import { Inbox, ShieldCheck, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { PersonAccessPanel } from '@/features/config/permissions/person-access-panel';
import { RequestsPanel } from '@/features/config/permissions/requests-panel';
import { RoleAccessPanel } from '@/features/config/permissions/role-access-panel';
import { fetchPendingCount } from '@/features/config/permissions/access-api';
import { fetchPermissionCatalog } from '@/features/config/roles/roles-api';
import { useAuthUser } from '@/hooks/use-auth-user';
import { usePermissions } from '@/hooks/use-permissions';
import type { CatalogNode } from '@/lib/permission-tree';

type TabId = 'roles' | 'persons' | 'requests';

/**
 * Configuraciones › Roles y permisos › Permisos por sistema: los accesos vistos
 * por rol, por persona, y las solicitudes de acceso por resolver.
 */
export default function PermissionsScreen() {
    const { can } = usePermissions();
    const { user } = useAuthUser();
    const canAssign = can('config.roles.permissions.assign');

    const [tab, setTab] = useState<TabId>('roles');
    const [tree, setTree] = useState<CatalogNode[] | null>(null);
    const [pending, setPending] = useState<number | undefined>(undefined);

    const loadPending = useCallback(() => {
        fetchPendingCount()
            .then((summary) => setPending(summary.pending))
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        fetchPermissionCatalog().then(setTree).catch(() => undefined);
        loadPending();
    }, [loadPending]);

    const tabs = (
        <Tabs
            label="Accesos"
            active={tab}
            onChange={(id) => setTab(id as TabId)}
            items={[
                {
                    id: 'roles',
                    label: 'Por rol',
                    icon: <ShieldCheck className="size-4" aria-hidden />,
                },
                {
                    id: 'persons',
                    label: 'Por persona',
                    icon: <UserRound className="size-4" aria-hidden />,
                },
                {
                    id: 'requests',
                    label: 'Solicitudes',
                    icon: <Inbox className="size-4" aria-hidden />,
                    badge: pending ? pending : undefined,
                },
            ]}
        />
    );

    if (!tree) {
        return <p className="text-sm text-ink-muted">Cargando accesos…</p>;
    }

    if (tab === 'persons') {
        return (
            <PersonAccessPanel
                tree={tree}
                tabs={tabs}
                canAssign={canAssign}
                currentUserId={user?.id}
            />
        );
    }

    if (tab === 'requests') {
        return (
            <RequestsPanel
                tree={tree}
                tabs={tabs}
                canAssign={canAssign}
                onChanged={loadPending}
            />
        );
    }

    return <RoleAccessPanel tree={tree} tabs={tabs} canAssign={canAssign} />;
}
