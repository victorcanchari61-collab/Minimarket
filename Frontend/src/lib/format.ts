const MONEY = new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** 1240 → "S/ 1,240.00". Un solo formato de moneda para todo el sistema. */
export function formatMoney(amount: number | string): string {
    return `S/ ${MONEY.format(Number(amount))}`;
}

const DATE = new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

/** "2026-10-07T15:04:05Z" → "7 oct 2026". Un solo formato de fecha para todo el sistema. */
export function formatDate(value: string): string {
    return DATE.format(new Date(value));
}
