import { formatMoney } from '@/lib/format';

export interface PaymentFigure {
    label: string;
    amount: number;
    /** success: lo ya cobrado o pagado. pending: lo que falta. */
    tone?: 'normal' | 'success' | 'pending';
}

const TONES: Record<NonNullable<PaymentFigure['tone']>, string> = {
    normal: 'tone-neutral text-ink',
    success: 'tone-success text-(--tone-fg)',
    pending: 'tone-warning text-(--tone-fg)',
};

/**
 * Las cifras de un cobro o un pago en recuadros chicos, lado a lado: a cobrar,
 * cobrado, lo que queda. El mismo formato al convertir un pedido en venta y en
 * los pagos de cuentas por cobrar y por pagar.
 */
export function PaymentFigures({ figures }: { figures: PaymentFigure[] }) {
    return (
        <div
            className="grid gap-2 text-center sm:gap-3"
            style={{
                gridTemplateColumns: `repeat(${figures.length}, minmax(0, 1fr))`,
            }}
        >
            {figures.map((figure) => (
                <div
                    key={figure.label}
                    className="rounded-field border border-line px-2 py-2"
                >
                    <p className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                        {figure.label}
                    </p>
                    <p
                        className={`text-base font-semibold tabular-nums ${TONES[figure.tone ?? 'normal']}`}
                    >
                        {formatMoney(figure.amount)}
                    </p>
                </div>
            ))}
        </div>
    );
}
