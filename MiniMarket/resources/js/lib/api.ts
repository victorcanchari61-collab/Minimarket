const TOKEN_KEY = 'minimarket.token';

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
    constructor(
        message: string,
        readonly status: number,
        readonly errors: Record<string, string[]> = {},
    ) {
        super(message);
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
    const response = await fetch(`/api${path}`, {
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
