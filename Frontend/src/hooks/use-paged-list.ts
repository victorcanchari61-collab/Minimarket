import { useCallback, useEffect, useRef, useState } from 'react';

/** Filas por página: el servidor nunca devuelve más (internal/pagination). */
export const PAGE_SIZE = 20;

export type CursorPage<T> = { data: T[]; nextCursor: string | null };

/** Lo que necesita la tabla para pintar "Anterior / Siguiente". */
export type Pager = {
    /** Página actual, desde 1. */
    page: number;
    hasPrev: boolean;
    hasNext: boolean;
    /** Se está pidiendo otra página. */
    loading: boolean;
    onPrev: () => void;
    onNext: () => void;
    /** Cuántas filas hay antes de esta página (para seguir la numeración N°). */
    offset: number;
};

type Options<T, Q> = {
    /** Lo que se está consultando (búsqueda, orden, filtros, columnas). null = todavía no se pide nada. */
    query: Q | null;
    /** Debe ser estable (una función del módulo): si cambia, se vuelve a pedir la lista. */
    fetchPage: (query: Q, cursor?: string) => Promise<CursorPage<T>>;
};

type Loaded<T> = { rows: T[]; next: string | null };

type State<T, Q> = {
    /** La consulta a la que pertenecen las páginas de abajo. */
    query: Q | null;
    pages: Loaded<T>[];
    index: number;
    loadingPage: boolean;
    error?: string;
};

const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : 'No se pudo cargar la lista.';

/**
 * Lista por páginas de 20 filas, con cursor. Muestra UNA página a la vez:
 * `pager.onNext()` pide la siguiente (o vuelve a una que ya se vio, sin pedirla
 * otra vez) y `pager.onPrev()` regresa.
 *
 * - Al cambiar `query` se vuelve a la primera página y se descarta lo de la
 *   consulta anterior.
 * - `reload()` vuelve a pedir desde el principio (tras crear, editar o eliminar).
 * - Un fallo conserva la página que se estaba viendo; `retry()` lo reintenta.
 */
export function usePagedList<T, Q>({ query, fetchPage }: Options<T, Q>) {
    const [state, setState] = useState<State<T, Q>>({
        query: null,
        pages: [],
        index: 0,
        loadingPage: false,
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
                        pages: [{ rows: page.data, next: page.nextCursor }],
                        index: 0,
                        loadingPage: false,
                    });
                }
            })
            .catch((error: unknown) => {
                if (mine === token.current) {
                    setState({
                        query,
                        pages: [],
                        index: 0,
                        loadingPage: false,
                        error: messageOf(error),
                    });
                }
            });
    }, [query, fetchPage, attempt]);

    const current = state.pages[state.index];
    const cached = state.index < state.pages.length - 1;
    const hasNext = cached || (current?.next ?? null) !== null;

    const onNext = useCallback(() => {
        if (query === null || state.query !== query || state.loadingPage) {
            return;
        }

        if (state.index < state.pages.length - 1) {
            setState((previous) => ({ ...previous, index: previous.index + 1, error: undefined }));

            return;
        }

        const cursor = state.pages[state.index]?.next;

        if (!cursor) {
            return;
        }

        const mine = token.current;

        setState((previous) => ({ ...previous, loadingPage: true, error: undefined }));

        fetchPage(query, cursor)
            .then((page) => {
                if (mine !== token.current) {
                    return;
                }

                setState((previous) => ({
                    ...previous,
                    pages: [...previous.pages, { rows: page.data, next: page.nextCursor }],
                    index: previous.pages.length,
                    loadingPage: false,
                }));
            })
            .catch((error: unknown) => {
                if (mine === token.current) {
                    setState((previous) => ({
                        ...previous,
                        loadingPage: false,
                        error: messageOf(error),
                    }));
                }
            });
    }, [query, fetchPage, state.query, state.index, state.pages, state.loadingPage]);

    const onPrev = useCallback(() => {
        setState((previous) =>
            previous.index > 0 && !previous.loadingPage
                ? { ...previous, index: previous.index - 1, error: undefined }
                : previous,
        );
    }, []);

    /** Vuelve a pedir la primera página. */
    const reload = useCallback(() => {
        setState((previous) => ({ ...previous, query: null, error: undefined }));
        setAttempt((value) => value + 1);
    }, []);

    const retry = useCallback(() => {
        if (state.pages.length > 0) {
            onNext();

            return;
        }

        reload();
    }, [state.pages.length, onNext, reload]);

    const offset = state.pages
        .slice(0, state.index)
        .reduce((total, page) => total + page.rows.length, 0);

    return {
        rows: current?.rows ?? [],
        /** Primera carga de esta consulta. */
        loading: query !== null && state.query !== query,
        error: state.error,
        retry,
        reload,
        pager: {
            page: state.index + 1,
            hasPrev: state.index > 0,
            hasNext,
            loading: state.loadingPage,
            onPrev,
            onNext,
            offset,
        } satisfies Pager,
    };
}
