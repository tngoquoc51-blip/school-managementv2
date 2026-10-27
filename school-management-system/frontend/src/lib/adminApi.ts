/* Bo goi API Admin: GET/POST/PUT/DELETE toi {API}/admin/... */
const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api').replace(/\/v1\/?$/, '');
export const ADMIN_PREFIX = process.env.NEXT_PUBLIC_ADMIN_PREFIX || '/admin';

const TOKEN_KEYS = ['token', 'admin_token', 'access_token'];

export function readToken(): string | null {
    if (typeof window === 'undefined') return null;
    for (const k of TOKEN_KEYS) {
        const v = localStorage.getItem(k) ?? sessionStorage.getItem(k);
        if (v) return v;
    }
    return null;
}

export class AdmError extends Error {
    status: number;
    errors?: Record<string, string[]> | null;
    constructor(message: string, status: number, errors?: Record<string, string[]> | null) {
        super(message);
        this.name = 'AdmError';
        this.status = status;
        this.errors = errors;
    }
}

const hasVi = (s: string) => /[\u00C0-\u1EF9]/.test(s);

type Query = Record<string, string | number | boolean | null | undefined>;

export interface AdmResult<T> {
    data: T;
    message?: string;
    meta?: Record<string, unknown>;
}

export async function adm<T = any>(
    path: string,
    opts: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; query?: Query } = {},
): Promise<AdmResult<T>> {
    const qs = new URLSearchParams();
    Object.entries(opts.query ?? {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const url = `${BASE}${ADMIN_PREFIX}/${path.replace(/^\//, '')}${qs.toString() ? `?${qs}` : ''}`;
    const token = readToken();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let res: Response;
    try {
        res = await fetch(url, {
            method: opts.method ?? 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
            signal: ctrl.signal,
        });
    } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
            throw new AdmError('May chu phan hoi qua cham. Vui long thu lai.', 0);
        }
        throw new AdmError('Khong ket noi duoc may chu.', 0);
    } finally {
        clearTimeout(timer);
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const first = json?.errors
            ? (Object.values(json.errors as Record<string, string[]>)[0]?.[0] ?? '')
            : '';
        const msg: string = json?.message && hasVi(json.message) ? json.message : first;
        const fallback =
            res.status === 401
                ? 'Phien dang nhap khong hop le. Hay dang nhap lai.'
                : res.status === 403
                  ? 'Khong co quyen thuc hien thao tac nay.'
                  : res.status === 404
                    ? 'Chua co API nay o may chu (kiem tra route /admin).'
                    : res.status >= 500
                      ? 'May chu dang gap su co.'
                      : 'Da co loi xay ra.';
        throw new AdmError(msg || fallback, res.status, json?.errors ?? null);
    }
    return { data: json.data as T, message: json.message, meta: json.meta };
}
