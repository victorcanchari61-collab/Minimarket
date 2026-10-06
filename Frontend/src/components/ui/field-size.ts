/** sm 36px (tablas y barras) · md 40px (formularios) · lg 48px (login). */
export type FieldSize = 'sm' | 'md' | 'lg';

/** Altura de TODOS los campos y botones; salen de los tokens --height-field-* de index.css. */
export const FIELD_HEIGHT: Record<FieldSize, string> = {
    sm: 'h-[var(--height-field-sm)]',
    md: 'h-[var(--height-field-md)]',
    lg: 'h-[var(--height-field-lg)]',
};
