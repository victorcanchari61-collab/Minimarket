import { useState } from 'react';
import { Dropdown } from '@/components/data/dropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { createTerminal, updateTerminal } from '@/features/config/terminals/terminals-api';
import type {
    BranchOption,
    Terminal,
    WarehouseOption,
} from '@/features/config/terminals/terminals-api';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activa' },
    { value: 'inactive', label: 'Inactiva' },
];

const CODE = /^[A-Za-z0-9][A-Za-z0-9-]{0,14}$/;

type TerminalModalProps = {
    /** null = terminal nueva. */
    terminal: Terminal | null;
    branches: BranchOption[];
    warehouses: WarehouseOption[];
    onClose: () => void;
    onSaved: (message: string) => void;
};

/** Crear o editar una caja de una tienda. */
export function TerminalModal({
    terminal,
    branches,
    warehouses,
    onClose,
    onSaved,
}: TerminalModalProps) {
    const [branchId, setBranchId] = useState<number | string>(terminal?.branch_id ?? '');
    const [warehouseId, setWarehouseId] = useState<number | string>(
        terminal?.warehouse_id ?? '',
    );
    const [code, setCode] = useState(terminal?.code ?? '');
    const [name, setName] = useState(terminal?.name ?? '');
    const [active, setActive] = useState(terminal?.active ?? true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const toast = useToast();

    // El almacén de una caja es uno de su misma sucursal.
    const branchWarehouses = warehouses.filter((warehouse) => warehouse.branch_id === branchId);

    const save = async () => {
        const next: Record<string, string> = {};

        if (branchId === '') next.branch_id = 'Elige la sucursal.';
        if (!CODE.test(code.trim()))
            next.code = 'Usa letras, números y guiones (hasta 15 caracteres).';
        if (!name.trim()) next.name = 'Escribe el nombre de la terminal.';

        setErrors(next);

        if (Object.keys(next).length > 0) {
            return;
        }

        const payload = {
            branch_id: Number(branchId),
            warehouse_id: warehouseId === '' ? null : Number(warehouseId),
            code: code.trim(),
            name: name.trim(),
            active,
        };

        setSaving(true);

        try {
            if (terminal) {
                await updateTerminal(terminal.id, payload);
                onSaved('Terminal actualizada.');
            } else {
                await createTerminal(payload);
                onSaved('Terminal creada.');
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
                    error instanceof Error ? error.message : 'No se pudo guardar la terminal.',
                );
            }

            setSaving(false);
        }
    };

    return (
        <Modal
            open
            title={terminal ? 'Editar terminal' : 'Nueva terminal'}
            description="Configuraciones › Terminales y series"
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
                    onChange={(value) => {
                        setBranchId(value);
                        setWarehouseId('');
                    }}
                    placeholder="Elegir tienda"
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
                    placeholder="Caja principal"
                    autoFocus
                />
                <Input
                    label="Código"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    error={errors.code}
                    maxLength={15}
                    placeholder="CAJA-1"
                />
                <Dropdown
                    label="Almacén del que descuenta"
                    value={warehouseId}
                    onChange={setWarehouseId}
                    placeholder={branchId === '' ? 'Elige primero la sucursal' : 'Sin definir'}
                    error={errors.warehouse_id}
                    options={[
                        { value: '', label: 'Sin definir' },
                        ...branchWarehouses.map((warehouse) => ({
                            value: warehouse.id,
                            label: warehouse.name,
                        })),
                    ]}
                />
                {terminal && (
                    <Dropdown
                        label="Estado"
                        value={active ? 'active' : 'inactive'}
                        onChange={(value) => setActive(value === 'active')}
                        options={STATUS_OPTIONS}
                    />
                )}
            </div>

            <p className="mt-4 text-xs text-ink-muted">
                Solo las tiendas llevan cajas. El código es único dentro de la sucursal y las series
                de comprobantes se asignan a la terminal desde «Series de comprobantes».
            </p>
        </Modal>
    );
}
