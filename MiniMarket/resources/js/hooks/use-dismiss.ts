import { useEffect, useRef } from 'react';

/** Cierra un popover o panel al hacer clic fuera o con Escape. */
export function useDismiss<E extends HTMLElement = HTMLDivElement>(
    onDismiss: () => void,
) {
    const ref = useRef<E>(null);

    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            const target = event.target as Node;

            if (ref.current?.contains(target)) {
                return;
            }

            // Un modal o un panel flotante (la lista de un desplegable, el
            // calendario) se montan fuera de `ref`: sin esta excepción, un
            // clic dentro de uno abierto desde este widget parecería "de
            // afuera" y lo cerraría de inmediato.
            if (
                target instanceof Element &&
                target.closest('[role="dialog"], [data-floating-panel]')
            ) {
                return;
            }

            onDismiss();
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onDismiss();
            }
        };

        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);

        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [onDismiss]);

    return ref;
}
