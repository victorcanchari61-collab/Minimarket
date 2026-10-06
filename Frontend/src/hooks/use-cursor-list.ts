import { useCallback, useEffect, useRef, useState } from 'react';

export type CursorPage<T> = { data: T[]; nextCursor: string | null };

type Options<T, Q> = {
    /** Lo que se está consultando (búsqueda, orden, filtros). null = todavía no se pide nada. */
    query: Q | null;
    /** Debe ser estable (una función del módulo): si cambia, se vuelve a pedir la lista. */
    fetchPage: (query: Q, cursor?: string) => Promise<CursorPage<T>>;
};

type State<T, Q> = {
    /** La consulta a la que pertenecen las filas de abajo. */
    query: Q | null;
    rows: T[];
    cursor: string | null;
    loadingMore: boolean;
    error?: string;
};

const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : 'No se pudo cargar la lista.';

/**
 * Lista paginada por cursor: la primera petición trae las primeras 20 filas y
 * `loadMore()` pide las siguientes 20 (lo dispara el scroll al final).
 *
 * - Al cambiar `query` se reinicia la lista y se descarta lo que venga de la
 *   consulta anterior.
 * - No repite filas aunque el cursor se solape.
 * - Un fallo conserva lo ya cargado y se reintenta con `retry()`.
 */
export function useCursorList<T extends { id: number | string }, Q>({
    query,
    fetchPage,
}: Options<T, Q>) {
    const [state, setState] = useState<State<T, Q>>({
        query: null,
        rows: [],
        cursor: null,
        loadingMore: false,
    });
    const [attempt, setAttempt] = useState(0);
    const token = useRef(0);

    useEffect(() => {
        if (query === null) {
            return;
        }

        const mine = ++token.current;

        fetchPage(query)
            .then((page) => {
                if (mine === token.current) {
                    setState({
                        query,
                        rows: page.data,
                        cursor: page.nextCursor,
                        loadingMore: false,
                    });
                }
            })
            .catch((error: unknown) => {
                if (mine === token.current) {
                    setState({
                        query,
                        rows: [],
                        cursor: null,
                        loadingMore: false,
                        error: messageOf(error),
                    });
                }
            });
    }, [query, fetchPage, attempt]);

    const loadMore = useCallback(() => {
        if (
            query === null ||
            state.query !== query ||
            state.cursor === null ||
            state.loadingMore
        ) {
            return;
        }

        const mine = token.current;

        setState((current) => ({
            ...current,
            loadingMore: true,
            error: undefined,
        }));

        fetchPage(query, state.cursor)
            .then((page) => {
                if (mine !== token.current) {
                    return;
                }

                setState((current) => {
                    const known = new Set(current.rows.map((row) => row.id));

                    return {
                        ...current,
                        rows: [
                            ...current.rows,
                            ...page.data.filter((row) => !known.has(row.id)),
                        ],
                        cursor: page.nextCursor,
                        loadingMore: false,
                    };
                });
            })
            .catch((error: unknown) => {
                if (mine === token.current) {
                    setState((current) => ({
                        ...current,
                        loadingMore: false,
                        error: messageOf(error),
                    }));
                }
            });
    }, [query, fetchPage, state.query, state.cursor, state.loadingMore]);

    const retry = useCallback(() => {
        if (state.rows.length > 0) {
            loadMore();

            return;
        }

        setState((current) => ({ ...current, query: null, error: undefined }));
        setAttempt((value) => value + 1);
    }, [state.rows.length, loadMore]);

    /** Vuelve a pedir la primera página (tras crear, editar o eliminar). */
    const reload = useCallback(() => {
        setState((current) => ({ ...current, query: null, error: undefined }));
        setAttempt((value) => value + 1);
    }, []);

    return {
        rows: state.rows,
        /** Primera carga de esta consulta. */
        loading: query !== null && state.query !== query,
        loadingMore: state.loadingMore,
        hasMore: state.cursor !== null,
        error: state.error,
        loadMore,
        retry,
        reload,
    };
}
