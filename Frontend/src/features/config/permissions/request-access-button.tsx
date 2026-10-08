import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { requestAccess } from '@/features/config/permissions/access-api';
import { useToast } from '@/hooks/use-toast';

type RequestAccessButtonProps = {
    /** La acción que se pide: "erp.catalog.products.view". */
    permission: string;
    /** Nombre de la pantalla, para el texto del formulario. */
    screen: string;
};

/**
 * "Solicitar acceso": se muestra en la pantalla a la que la persona no puede
 * entrar. Abre un formulario con el motivo; quien administra accesos lo ve en
 * Permisos por sistema › Solicitudes.
 */
export function RequestAccessButton({ permission, screen }: RequestAccessButtonProps) {
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [sent, setSent] = useState(false);

    const send = async () => {
        setSaving(true);

        try {
            await requestAccess(permission, reason.trim());
            toast.success('Solicitud enviada. Un administrador la revisará.');
            setSent(true);
            setOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Button onClick={() => setOpen(true)} disabled={sent}>
                <KeyRound className="size-4" aria-hidden />
                {sent ? 'Solicitud enviada' : 'Solicitar acceso'}
            </Button>

            {open && (
                <Modal
                    open
                    title="Solicitar acceso"
                    description={screen}
                    onClose={() => setOpen(false)}
                    footer={
                        <>
                            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                            <Button size="sm" loading={saving} onClick={() => void send()}>
                                {saving ? 'Enviando…' : 'Enviar solicitud'}
                            </Button>
                        </>
                    }
                >
                    <Input
                        label="¿Para qué lo necesitas? (opcional)"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        maxLength={200}
                        placeholder="Necesito consultar los precios para atender a un cliente"
                        autoFocus
                    />
                </Modal>
            )}
        </>
    );
}
