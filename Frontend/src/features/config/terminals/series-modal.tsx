import { useState } from 'react';
import { Dropdown } from '@/components/data/dropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
    DOCUMENT_TYPES,
    createSeries,
    updateSeries,
} from '@/features/config/terminals/terminals-api';
import type {
    BranchOption,
    DocumentSeries,
    DocumentType,
    TerminalOption,
} from '@/features/config/terminals/terminals-api';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activa' },
    { value: 'inactive', label: 'Inactiva' },
];

type SeriesModalProps = {
    /** null = serie nueva. */
    series: DocumentSeries | null;
    branches: BranchOption[];
    terminals: TerminalOption[];
    onClose: () => void;
    onSaved: (message: string) => void;
};

/** Crear o editar la serie de un tipo de comprobante. */
export function SeriesModal({ series, branches, terminals, onClose, onSaved }: SeriesModalProps) {
    const [branchId, setBranchId] = useState<number | string>(series?.branch_id ?? '');
    const [terminalId, setTerminalId] = useState<number | string>(series?.terminal_id ?? '');
    const [type, setType] = useState<DocumentType | ''>(series?.document_type ?? '');
    const [code, setCode] = useState(series?.series ?? '');
    const [nextNumber, setNextNumber] = useState('1');
    const [active, setActive] = useState(series?.active ?? true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const toast = useToast();

    // Una serie que ya emitió comprobantes no cambia de tipo, de código ni de sucursal.
    const locked = series?.used ?? false;
    const prefixes = DOCUMENT_TYPES.find((option) => option.value === type)?.prefixes;
    const branchTerminals = terminals.filter((terminal) => terminal.branch_id === branchId);

    const save = async () => {
        const next: Record<string, string> = {};

        if (branchId === '') next.branch_id = 'Elige la sucursal.';
        if (type === '') next.document_type = 'Elige el tipo de comprobante.';
        if (!/^[A-Za-z0-9]{4}$/.test(code.trim()))
            next.series = 'La serie tiene 4 caracteres: letras o números (por ejemplo F001).';
        else if (prefixes && !prefixes.includes(code.trim().charAt(0).toUpperCase()))
            next.series = `Este tipo lleva una serie que empieza con ${prefixes.split('').join(' o ')}.`;

        const first = Number(nextNumber);

        if (!series && (!Number.isInteger(first) || first < 1))
            next.next_number = 'Escribe un número desde 1.';

        setErrors(next);

        if (Object.keys(next).length > 0 || type === '') {
            return;
        }

        const payload = {
            branch_id: Number(branchId),
            terminal_id: terminalId === '' ? null : Number(terminalId),
            document_type: type,
            series: code.trim().toUpperCase(),
            ...(series ? {} : { next_number: first }),
            active,
        };

        setSaving(true);

        try {
            if (series) {
                await updateSeries(series.id, payload);
                onSaved('Serie actualizada.');
            } else {
                await createSeries(payload);
                onSaved('Serie creada.');
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
                    error instanceof Error ? error.message : 'No se pudo guardar la serie.',
                );
            }

            setSaving(false);
        }
    };

    return (
        <Modal
            open
            title={series ? 'Editar serie' : 'Nueva serie'}
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
                    label="Tipo de comprobante"
                    value={type}
                    onChange={(value) => setType(value as DocumentType)}
                    placeholder="Elegir tipo"
                    error={errors.document_type}
                    disabled={locked}
                    options={DOCUMENT_TYPES.map((option) => ({
                        value: option.value,
                        label: option.label,
                    }))}
                />
                <Input
                    label="Serie"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    error={errors.series}
                    maxLength={4}
                    placeholder={prefixes ? `${prefixes.charAt(0)}001` : 'F001'}
                    disabled={locked}
                    className="font-mono"
                />
                <Dropdown
                    label="Sucursal"
                    value={branchId}
                    onChange={(value) => {
                        setBranchId(value);
                        setTerminalId('');
                    }}
                    placeholder="Elegir sucursal"
                    error={errors.branch_id}
                    disabled={locked}
                    options={branches.map((branch) => ({
                        value: branch.id,
                        label: `${branch.name} (${branch.code})`,
                    }))}
                />
                <Dropdown
                    label="Terminal"
                    value={terminalId}
                    onChange={setTerminalId}
                    placeholder={branchId === '' ? 'Elige primero la sucursal' : 'Toda la sucursal'}
                    error={errors.terminal_id}
                    options={[
                        { value: '', label: 'Toda la sucursal' },
                        ...branchTerminals.map((terminal) => ({
                            value: terminal.id,
                            label: `${terminal.name} (${terminal.code})`,
                        })),
                    ]}
                />
                {series ? (
                    <>
                        <Input
                            label="Siguiente número"
                            value={String(series.next_number).padStart(8, '0')}
                            disabled
                            readOnly
                        />
                        <Dropdown
                            label="Estado"
                            value={active ? 'active' : 'inactive'}
                            onChange={(value) => setActive(value === 'active')}
                            options={STATUS_OPTIONS}
                        />
                    </>
                ) : (
                    <Input
                        label="Empieza en el número"
                        value={nextNumber}
                        onChange={(event) => setNextNumber(event.target.value.replace(/\D/g, ''))}
                        error={errors.next_number}
                        inputMode="numeric"
                        maxLength={8}
                    />
                )}
            </div>

            <p className="mt-4 text-xs text-ink-muted">
                {locked
                    ? 'Esta serie ya emitió comprobantes: no se puede cambiar su tipo, su código ni su sucursal. Si ya no se usa, desactívala.'
                    : 'La serie son 4 caracteres: F… para facturas, B… para boletas, T… o V… para guías. Si ya venías numerando con otro sistema, indica desde qué número continuar; después lo mueve el sistema al emitir.'}
            </p>
        </Modal>
    );
}
