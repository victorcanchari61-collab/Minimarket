import { useEffect, useRef } from 'react';

type Options = {
    /** Hay otra página por pedir. */
    hasMore: boolean;
    /** Ya hay una petición en curso: no se dispara otra. */
    loading: boolean;
    onLoadMore: () => void;
    /** Contenedor con scroll propio (un modal, una tabla); sin él se observa la ventana. */
    root?: React.RefObject<HTMLElement | null>;
    /** Qué tan antes de llegar al final se pide la siguiente página. */
    rootMargin?: string;
};

/**
 * Scroll infinito: devuelve la ref de un elemento centinela que se coloca al
 * final de la lista. Cuando se hace visible pide las siguientes 20 filas.
 */
export function useInfiniteScroll<E extends HTMLElement = HTMLDivElement>({
    hasMore,
    loading,
    onLoadMore,
    root,
    rootMargin = '200px',
}: Options) {
    const sentinelRef = useRef<E>(null);
    const loadMoreRef = useRef(onLoadMore);

    useEffect(() => {
        loadMoreRef.current = onLoadMore;
    });

    useEffect(() => {
        const sentinel = sentinelRef.current;

        if (!sentinel || !hasMore || loading) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    loadMoreRef.current();
                }
            },
            { root: root?.current ?? null, rootMargin },
        );

        observer.observe(sentinel);

        return () => observer.disconnect();
    }, [hasMore, loading, root, rootMargin]);

    return sentinelRef;
}
