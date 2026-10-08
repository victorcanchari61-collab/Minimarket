import { useState } from 'react';
import { Dropdown } from '@/components/data/dropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
    createWarehouse,
    updateWarehouse,
} from '@/features/config/company/company-api';
import type { BranchOption, Warehouse } from '@/features/config/company/company-api';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
];

const CODE = /^[A-Za-z0-9][A-Za-z0-9-]{0,14}$/;

type WarehouseModalProps = {
    /** null = almacén nuevo. */
    warehouse: Warehouse | null;
    branches: BranchOption[];
    onClose: () => void;
    onSaved: (message: string) => void;
};

/** Crear o editar un almacén de una sucursal. */
export function WarehouseModal({ warehouse, branches, onClose, onSaved }: WarehouseModalProps) {
    const [branchId, setBranchId] = useState<number | string>(warehouse?.branch_id ?? '');
    const [code, setCode] = useState(warehouse?.code ?? '');
    const [name, setName] = useState(warehouse?.name ?? '');
    const [address, setAddress] = useState(warehouse?.address ?? '');
    const [active, setActive] = useState(warehouse?.active ?? true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const toast = useToast();

    const save = async () => {
        const next: Record<string, string> = {};

        if (branchId === '') next.branch_id = 'Elige la sucursal.';
        if (!CODE.test(code.trim()))
            next.code = 'Usa letras, números y guiones (hasta 15 caracteres).';
        if (!name.trim()) next.name = 'Escribe el nombre del almacén.';

        setErrors(next);

        if (Object.keys(next).length > 0) {
            return;
        }

        const payload = {
            branch_id: Number(branchId),
            code: code.trim(),
            name: name.trim(),
            address: address.trim(),
            active,
        };

        setSaving(true);

        try {
            if (warehouse) {
                await updateWarehouse(warehouse.id, payload);
                onSaved('Almacén actualizado.');
            } else {
                await createWarehouse(payload);
                onSaved('Almacén creado.');
            }
        } catch (error) {
            if (error instanceof ApiError && Object.keys(error.errors).length) {
                setErrors(
                    Object.fromEntries(
                        Object.entries(error.errors).map(([field, messages]) => [
                            field,
                            messages[0],
                        ]),
                    ),
                );
            } else {
                toast.error(
                    error instanceof Error ? error.message : 'No se pudo guardar el almacén.',
                );
            }

            setSaving(false);
        }
    };

    return (
        <Modal
            open
            title={warehouse ? 'Editar almacén' : 'Nuevo almacén'}
            description="Configuraciones › Empresa y sucursales"
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button size="sm" loading={saving} onClick={() => void save()}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Dropdown
                    label="Sucursal"
                    value={branchId}
                    onChange={setBranchId}
                    placeholder="Elegir sucursal"
                    error={errors.branch_id}
                    className="sm:col-span-2"
                    options={branches.map((branch) => ({
                        value: branch.id,
                        label: `${branch.name} (${branch.code})`,
                    }))}
                />
                <Input
                    label="Nombre"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    error={errors.name}
                    autoFocus
                />
                <Input
                    label="Código"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    error={errors.code}
                    maxLength={15}
                    placeholder="ALM-01"
                />
                <Input
                    label="Ubicación o referencia"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    error={errors.address}
                    className="sm:col-span-2"
                    placeholder="Trastienda, segundo piso, almacén externo…"
                />
                {warehouse && (
                    <Dropdown
                        label="Estado"
                        value={active ? 'active' : 'inactive'}
                        onChange={(value) => setActive(value === 'active')}
                        options={STATUS_OPTIONS}
                    />
                )}
            </div>

            <p className="mt-4 text-xs text-ink-muted">
                El código es único dentro de la sucursal: dos sucursales pueden tener su ALM-01.
            </p>
        </Modal>
    );
}
