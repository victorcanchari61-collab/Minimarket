import type { ReactNode } from 'react';
import { formatMoney } from '@/lib/format';

export interface DocumentLineColumn<T> {
    key: string;
    label: string;
    render: (row: T) => ReactNode;
}

export interface DocumentLinesTableProps<T> {
    rows: T[];
    rowKey: (row: T) => string | number;
    title: (row: T) => string;
    subtitle: (row: T) => string;
    /** Un grupo por fila de la tarjeta móvil; en escritorio todas se ven como columnas. */
    groups: DocumentLineColumn<T>[][];
}

/**
 * La lista de productos de un documento: tabla en escritorio (como una factura
 * de verdad), tarjetas en móvil (una por producto, con sus datos en columnas).
 * Es la misma información, acomodada distinto según el ancho.
 */
export function DocumentLinesTable<T>({
    rows,
    rowKey,
    title,
    subtitle,
    groups,
}: DocumentLinesTableProps<T>) {
    const columns = groups.flat();

    return (
        <>
            <div className="hidden overflow-x-auto rounded-field border border-line sm:block">
                <table className="w-full text-[13px]">
                    <thead>
                        <tr className="border-b border-line bg-surface-alt text-left text-[10.5px] font-semibold tracking-wide text-ink-muted uppercase">
                            <th className="px-3 py-1.5">Producto</th>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className="px-3 py-1.5 text-right"
                                >
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={rowKey(row)}
                                className="border-b border-line last:border-0"
                            >
                                <td className="px-3 py-2">
                                    <p className="font-semibold text-ink">
                                        {title(row)}
                                    </p>
                                    <p className="text-[11px] text-ink-muted">
                                        {subtitle(row)}
                                    </p>
                                </td>
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className="px-3 py-2 text-right tabular-nums"
                                    >
                                        {column.render(row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-col gap-2 sm:hidden">
                {rows.map((row) => (
                    <div
                        key={rowKey(row)}
                        className="rounded-field border border-line p-2.5"
                    >
                        <p className="text-[13px] font-bold text-ink">
                            {title(row)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-muted">
                            {subtitle(row)}
                        </p>
                        {groups.map((group, index) => (
                            <div key={index} className="mt-1.5 flex gap-3">
                                {group.map((column) => (
                                    <div key={column.key} className="flex-1">
                                        <p className="text-[10px] text-ink-muted">
                                            {column.label}
                                        </p>
                                        <p className="text-[12.5px] font-bold text-ink tabular-nums">
                                            {column.render(row)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </>
    );
}

export interface PaymentSummaryLine {
    id: string | number;
    label: string;
    amount: number;
}

/** Los pagos (si los hay) y el total, como el pie plano de una factura: sin caja. */
export function DocumentSummary({
    payments,
    subtotal,
    breakdown,
    total,
}: {
    payments?: PaymentSummaryLine[];
    subtotal?: number;
    /** Líneas informativas entre el subtotal y el total: Op. gravada, IGV, Op. exonerada… */
    breakdown?: { label: string; amount: number }[];
    total: number;
}) {
    return (
        <div className="border-t border-line pt-2.5">
            {payments && payments.length > 0 && (
                <div className="mb-1.5 flex flex-col gap-1">
                    {payments.map((payment) => (
                        <div
                            key={payment.id}
                            className="flex items-center justify-between text-[13px]"
                        >
                            <span className="text-ink-muted">{payment.label}</span>
                            <span className="font-medium text-ink tabular-nums">
                                {formatMoney(payment.amount)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {subtotal != null && (
                <div className="flex items-center justify-between text-[13px] text-ink-muted">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatMoney(subtotal)}</span>
                </div>
            )}
            {breakdown && breakdown.length > 0 && (
                <div className="mb-1 flex flex-col gap-0.5">
                    {breakdown.map((line) => (
                        <div
                            key={line.label}
                            className="flex items-center justify-between text-[12.5px] text-ink-muted"
                        >
                            <span>{line.label}</span>
                            <span className="tabular-nums">
                                {formatMoney(line.amount)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Total</span>
                <span className="text-base font-bold text-accent tabular-nums">
                    {formatMoney(total)}
                </span>
            </div>
        </div>
    );
}
