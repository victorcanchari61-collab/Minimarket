import type { FilterType } from '@/components/data/data-table-filters';
import { DateRangePicker } from '@/components/data/date-range-picker';
import { Dropdown } from '@/components/data/dropdown';
import { Input } from '@/components/ui/input';

/**
 * El control de un filtro, según el tipo de columna. Es la pieza que se
 * repetiría casi igual en cada tipo de filtro de `FiltersButton`: mover el
 * "qué control corresponde a cada `filterType`" aquí hace que agregar un tipo
 * nuevo (o cambiarlo) se haga en un solo lugar.
 */
export interface FilterFieldProps {
    type: FilterType;
    /** Opciones del control cuando `type: 'select'`. */
    options?: { value: string; label: string }[];
    value: string;
    /** Solo para `type: 'date'`: el extremo superior del rango. */
    valueTo?: string;
    onChange: (value: string) => void;
    onChangeTo?: (value: string) => void;
    /** Solo para `type: 'text'`: Enter confirma, igual que un buscador. */
    onEnter?: () => void;
    textPlaceholder?: string;
}

export function FilterField({
    type,
    options = [],
    value,
    valueTo = '',
    onChange,
    onChangeTo,
    onEnter,
    textPlaceholder = 'Valor',
}: FilterFieldProps) {
    if (type === 'select') {
        return (
            <Dropdown
                size="sm"
                value={value}
                onChange={(next) => onChange(String(next))}
                placeholder="Todos"
                options={[{ value: '', label: 'Todos' }, ...options]}
            />
        );
    }

    if (type === 'date') {
        return (
            <DateRangePicker
                from={value}
                to={valueTo}
                onChange={(from, to) => {
                    onChange(from);
                    onChangeTo?.(to);
                }}
            />
        );
    }

    return (
        <Input
            size="sm"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && onEnter?.()}
            placeholder={textPlaceholder}
        />
    );
}
