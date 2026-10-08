import { useState } from 'react';
import { Dropdown } from '@/components/data/dropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { createBranch, updateBranch } from '@/features/config/company/company-api';
import type { BranchKind, ManagedBranch } from '@/features/config/company/company-api';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';

const KIND_OPTIONS = [
    { value: 'store', label: 'Tienda (vende al público)' },
    { value: 'distribution', label: 'Centro de distribución (no vende)' },
];

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activa' },
    { value: 'inactive', label: 'Inactiva' },
];

const CODE = /^[A-Za-z0-9][A-Za-z0-9-]{0,9}$/;
const PHONE = /^[0-9+()\-\s]{6,20}$/;

type BranchModalProps = {
    /** null = sucursal nueva. */
    branch: ManagedBranch | null;
    onClose: () => void;
    onSaved: (message: string) => void;
};

/** Crear o editar una sucursal. */
export function BranchModal({ branch, onClose, onSaved }: BranchModalProps) {
    const [code, setCode] = useState(branch?.code ?? '');
    const [name, setName] = useState(branch?.name ?? '');
    const [kind, setKind] = useState<BranchKind>(branch?.kind ?? 'store');
    const [sunat, setSunat] = useState(branch?.sunat_code ?? '');
    const [phone, setPhone] = useState(branch?.phone ?? '');
    const [address, setAddress] = useState(branch?.address ?? '');
    const [active, setActive] = useState(branch?.active ?? true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const toast = useToast();

    const save = async () => {
        const next: Record<string, string> = {};

        if (!CODE.test(code.trim()))
            next.code = 'Usa letras, números y guiones (hasta 10 caracteres).';
        if (!name.trim()) next.name = 'Escribe el nombre de la sucursal.';
        if (sunat.trim() && !/^\d{4}$/.test(sunat.trim()))
            next.sunat_code = 'Son 4 dígitos (ejemplo: 0001).';
        if (phone.trim() && !PHONE.test(phone.trim()))
            next.phone = 'El teléfono no es válido.';

        setErrors(next);

        if (Object.keys(next).length > 0) {
            return;
        }

        const payload = {
            code: code.trim(),
            name: name.trim(),
            kind,
            sunat_code: sunat.trim(),
            phone: phone.trim(),
            address: address.trim(),
            active,
        };

        setSaving(true);

        try {
            if (branch) {
                await updateBranch(branch.id, payload);
                onSaved('Sucursal actualizada.');
            } else {
                await createBranch(payload);
                onSaved('Sucursal creada.');
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
                    error instanceof Error ? error.message : 'No se pudo guardar la sucursal.',
                );
            }

            setSaving(false);
        }
    };

    return (
        <Modal
            open
            title={branch ? 'Editar sucursal' : 'Nueva sucursal'}
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
                <Input
                    label="Nombre"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    error={errors.name}
                    className="sm:col-span-2"
                    autoFocus
                />
                <Input
                    label="Código"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    error={errors.code}
                    maxLength={10}
                    placeholder="C01"
                />
                <Dropdown
                    label="Tipo"
                    value={kind}
                    onChange={(value) => setKind(value as BranchKind)}
                    options={KIND_OPTIONS}
                    error={errors.kind}
                />
                <Input
                    label="Establecimiento SUNAT"
                    value={sunat}
                    onChange={(event) => setSunat(event.target.value)}
                    error={errors.sunat_code}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0001"
                />
                <Input
                    label="Teléfono"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    error={errors.phone}
                    inputMode="tel"
                />
                <Input
                    label="Dirección"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    error={errors.address}
                    className="sm:col-span-2"
                />
                {branch && (
                    <Dropdown
                        label="Estado"
                        value={active ? 'active' : 'inactive'}
                        onChange={(value) => setActive(value === 'active')}
                        options={STATUS_OPTIONS}
                    />
                )}
            </div>

            <p className="mt-4 text-xs text-ink-muted">
                {kind === 'distribution'
                    ? 'Un centro de distribución abastece a las tiendas: no aparece como sucursal de venta.'
                    : 'El código de establecimiento SUNAT (0000 es el domicilio fiscal) identifica a esta sucursal en los comprobantes electrónicos.'}
            </p>
        </Modal>
    );
}
