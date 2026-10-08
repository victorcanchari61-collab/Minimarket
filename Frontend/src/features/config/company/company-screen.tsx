import { Building2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { fetchCompany, updateCompany } from '@/features/config/company/company-api';
import type { Company } from '@/features/config/company/company-api';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';

type Form = {
    ruc: string;
    legal_name: string;
    trade_name: string;
    fiscal_address: string;
    phone: string;
    email: string;
};

const toForm = (company: Company): Form => ({
    ruc: company.ruc,
    legal_name: company.legal_name,
    trade_name: company.trade_name,
    fiscal_address: company.fiscal_address,
    phone: company.phone,
    email: company.email,
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Configuraciones › Empresa y sucursales › Datos de la empresa. */
export default function CompanyScreen() {
    const toast = useToast();
    const { can } = usePermissions();
    const canEdit = can('config.company.info.edit');

    const [saved, setSaved] = useState<Form | null>(null);
    const [form, setForm] = useState<Form | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchCompany()
            .then((company) => {
                setSaved(toForm(company));
                setForm(toForm(company));
            })
            .catch(() => undefined);
    }, []);

    if (!form || !saved) {
        return <p className="text-sm text-ink-muted">Cargando datos de la empresa…</p>;
    }

    const dirty = (Object.keys(form) as (keyof Form)[]).some(
        (key) => form[key] !== saved[key],
    );

    const set = (key: keyof Form) => (event: { target: { value: string } }) =>
        setForm({ ...form, [key]: event.target.value });

    const save = async () => {
        const next: Record<string, string> = {};

        if (!form.legal_name.trim()) next.legal_name = 'Escribe la razón social.';
        if (form.ruc.trim() && !/^\d{11}$/.test(form.ruc.trim()))
            next.ruc = 'El RUC tiene 11 dígitos.';
        if (form.email.trim() && !EMAIL.test(form.email.trim()))
            next.email = 'Escribe un correo válido.';

        setErrors(next);

        if (Object.keys(next).length > 0) {
            return;
        }

        setSaving(true);

        try {
            const company = await updateCompany(form);
            setSaved(toForm(company));
            setForm(toForm(company));
            toast.success('Datos de la empresa actualizados.');
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
                    error instanceof Error ? error.message : 'No se pudo guardar.',
                );
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            <PageHeader
                icon={<Building2 className="size-5" aria-hidden />}
                title="Datos de la empresa"
                description="Lo que sale en los comprobantes y documentos"
                actions={
                    canEdit && (
                        <>
                            <Button
                                variant="secondary"
                                disabled={!dirty || saving}
                                onClick={() => {
                                    setForm(saved);
                                    setErrors({});
                                }}
                            >
                                Restablecer
                            </Button>
                            <Button
                                disabled={!dirty}
                                loading={saving}
                                onClick={() => void save()}
                            >
                                {saving ? 'Guardando…' : 'Guardar'}
                            </Button>
                        </>
                    )
                }
            />

            <section className="rounded-panel border border-line bg-white p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                        label="RUC"
                        value={form.ruc}
                        onChange={set('ruc')}
                        error={errors.ruc}
                        disabled={!canEdit}
                        inputMode="numeric"
                        maxLength={11}
                        placeholder="20123456789"
                    />
                    <Input
                        label="Razón social"
                        value={form.legal_name}
                        onChange={set('legal_name')}
                        error={errors.legal_name}
                        disabled={!canEdit}
                    />
                    <Input
                        label="Nombre comercial"
                        value={form.trade_name}
                        onChange={set('trade_name')}
                        error={errors.trade_name}
                        disabled={!canEdit}
                        placeholder="Cómo te conocen tus clientes"
                    />
                    <Input
                        label="Teléfono"
                        value={form.phone}
                        onChange={set('phone')}
                        error={errors.phone}
                        disabled={!canEdit}
                        inputMode="tel"
                    />
                    <Input
                        label="Dirección fiscal"
                        value={form.fiscal_address}
                        onChange={set('fiscal_address')}
                        error={errors.fiscal_address}
                        disabled={!canEdit}
                        className="sm:col-span-2"
                    />
                    <Input
                        label="Correo"
                        type="email"
                        value={form.email}
                        onChange={set('email')}
                        error={errors.email}
                        disabled={!canEdit}
                        className="sm:col-span-2"
                    />
                </div>

                <p className="mt-4 text-xs text-ink-muted">
                    El RUC se valida con su dígito verificador. Los establecimientos
                    anexos de SUNAT se registran en cada sucursal.
                </p>
            </section>
        </div>
    );
}
