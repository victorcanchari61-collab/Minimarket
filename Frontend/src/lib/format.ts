const MONEY = new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** 1240 → "S/ 1,240.00". Un solo formato de moneda para todo el sistema. */
export function formatMoney(amount: number | string): string {
    return `S/ ${MONEY.format(Number(amount))}`;
}
