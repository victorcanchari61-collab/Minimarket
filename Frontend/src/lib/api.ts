const TOKEN_KEY = 'minimarket.token';

/** Vacío = mismo origen (en desarrollo Vite reenvía /api a la API en Go). */
const API_URL: string = import.meta.env.VITE_API_URL ?? '';

export type ApiUser = {
    id: number;
    name: string;
    email: string;
    email_verified_at: string | null;
};

export type LoginResponse = {
    token: string;
    token_type: 'Bearer';
    user: ApiUser;
};

export class ApiError extends Error {
    status: number;
    errors: Record<string, string[]>;
    /** Código estable del backend (INSUFFICIENT_STOCK…): se decide por él, no por el texto. */
    code: string | undefined;

    constructor(
        message: string,
        status: number,
        errors: Record<string, string[]> = {},
        code?: string,
    ) {
        super(message);
        this.status = status;
        this.errors = errors;
        this.code = code;
    }
}

export function getToken(): string | null {
    try {
        return (
            window.localStorage.getItem(TOKEN_KEY) ??
            window.sessionStorage.getItem(TOKEN_KEY)
        );
    } catch {
        return null;
    }
}

/** Con "recordarme" el token sobrevive al cierre del navegador. */
function setToken(token: string | null, remember = true): void {
    try {
        window.localStorage.removeItem(TOKEN_KEY);
        window.sessionStorage.removeItem(TOKEN_KEY);

        if (token) {
            (remember ? window.localStorage : window.sessionStorage).setItem(
                TOKEN_KEY,
                token,
            );
        }
    } catch {
        // Sin almacenamiento disponible: la sesión dura solo esta pestaña.
    }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getToken();
    const response = await fetch(`${API_URL}/api${path}`, {
        ...init,
        headers: {
            Accept: 'application/json',
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new ApiError(
            data.message ?? 'No se pudo completar la solicitud.',
            response.status,
            data.errors,
            data.code,
        );
    }

    return data as T;
}

export async function login(
    email: string,
    password: string,
    remember = true,
): Promise<LoginResponse> {
    const data = await request<LoginResponse>('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });

    setToken(data.token, remember);

    return data;
}

export async function fetchUser(): Promise<ApiUser> {
    const { data } = await request<{ data: ApiUser }>('/user');

    return data;
}

export async function logout(): Promise<void> {
    try {
        await request('/logout', { method: 'POST' });
    } finally {
        setToken(null);
    }
}

export function clearToken(): void {
    setToken(null);
}

export type DemoCredentials = { email: string; password: string };

/** Credenciales de prueba: solo las ofrece la API en entorno local (si no, null). */
export async function fetchDemoCredentials(): Promise<DemoCredentials | null> {
    try {
        const { data } = await request<{ data: DemoCredentials }>(
            '/demo-credentials',
        );

        return data;
    } catch {
        return null;
    }
}

type Params = Record<string, string | number | undefined>;

function withQuery(path: string, params: Params = {}): string {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
            query.set(key, String(value));
        }
    }

    const text = query.toString();

    return text ? `${path}?${text}` : path;
}

/** Una página de un listado: las filas y el cursor de la siguiente (null = no hay más). */
export type Page<T> = { data: T[]; nextCursor: string | null };

export async function getPage<T>(path: string, params?: Params): Promise<Page<T>> {
    const body = await request<{
        data: T[];
        meta: { next_cursor: string | null };
    }>(withQuery(path, params));

    return { data: body.data, nextCursor: body.meta.next_cursor };
}

export async function apiGet<T>(path: string, params?: Params): Promise<T> {
    return (await request<{ data: T }>(withQuery(path, params))).data;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
    return (
        await request<{ data: T }>(path, {
            method: 'POST',
            body: JSON.stringify(body),
        })
    ).data;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
    return (
        await request<{ data: T }>(path, {
            method: 'PUT',
            body: JSON.stringify(body),
        })
    ).data;
}

export async function apiDelete(path: string): Promise<void> {
    await request(path, { method: 'DELETE' });
}
