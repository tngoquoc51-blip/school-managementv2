/**
 * Bộ gọi API riêng cho trang Nhập/Xuất dữ liệu – KHÔNG phụ thuộc src/lib/adminApi.ts.
 * Địa chỉ API tự dò được (nút "Tự dò địa chỉ API") và nhớ trong localStorage.
 */
const ENV = process.env.NEXT_PUBLIC_API_URL || '';
const K_BASE = 'dh_api_base';
const K_PREFIX = 'dh_api_prefix';
const DEFAULT_BASE = 'http://127.0.0.1:8000/api/v1';

export const CANDIDATES: string[] = Array.from(new Set([
    ENV, 'http://127.0.0.1:8000/api/v1', 'http://127.0.0.1:8000/api', 'http://localhost:8000/api/v1', 'http://localhost:8000/api',
].filter(Boolean).map((s) => s.replace(/\/+$/, ''))));

export const getBase = (): string => {
    if (typeof window !== 'undefined') { const v = localStorage.getItem(K_BASE); if (v) return v; }
    return (ENV || DEFAULT_BASE).replace(/\/+$/, '');
};
export const getPrefix = (): string => {
    if (typeof window !== 'undefined') { const v = localStorage.getItem(K_PREFIX); if (v !== null) return v; }
    return process.env.NEXT_PUBLIC_ADMIN_PREFIX || '/admin';
};
export const setConn = (base: string, prefix: string) => {
    localStorage.setItem(K_BASE, base.replace(/\/+$/, ''));
    localStorage.setItem(K_PREFIX, prefix && !prefix.startsWith('/') ? `/${prefix}` : prefix);
};

export function readToken(): string | null {
    if (typeof window === 'undefined') return null;
    const clean = (v: string | null) => (v ? v.replace(/^"|"$/g, '') : null);
    for (const k of ['token', 'admin_token', 'access_token', 'auth_token', 'accessToken', 'jwt']) {
        const v = clean(localStorage.getItem(k) ?? sessionStorage.getItem(k));
        if (v) return v;
    }
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) as string;
        if (/token/i.test(k) && !/csrf|refresh|fcm|push/i.test(k)) {
            const v = clean(localStorage.getItem(k));
            if (v && v.length > 20) return v;
        }
    }
    try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        if (u?.token) return String(u.token);
    } catch { /* bỏ qua */ }
    return null;
}
export const hasToken = () => !!readToken();

export class DhError extends Error {
    status: number;
    url: string;
    constructor(message: string, status: number, url: string) {
        super(message);
        this.name = 'DhError';
        this.status = status;
        this.url = url;
    }
}

const hasVi = (s: string) => /[\u00C0-\u1EF9]/.test(s);
type Query = Record<string, string | number | boolean | null | undefined>;
export interface DhResult<T> { data: T; message?: string; meta?: Record<string, any> }

export const endpoint = (path: string) => `${getBase()}${getPrefix()}/${path.replace(/^\//, '')}`;

export async function adm<T = any>(
    path: string,
    opts: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; query?: Query } = {},
): Promise<DhResult<T>> {
    const qs = new URLSearchParams();
    Object.entries(opts.query ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, String(v)); });
    const url = endpoint(path) + (qs.toString() ? `?${qs}` : '');
    const token = readToken();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    let res: Response;
    try {
        res = await fetch(url, {
            method: opts.method ?? 'GET',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
            signal: ctrl.signal,
        });
    } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw new DhError('Máy chủ phản hồi quá chậm. Vui lòng thử lại.', 0, url);
        throw new DhError('Không kết nối được máy chủ API.', 0, url);
    } finally { clearTimeout(timer); }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const first = json?.errors ? (Object.values(json.errors as Record<string, string[]>)[0]?.[0] ?? '') : '';
        const msg: string = json?.message && hasVi(json.message) ? json.message : first;
        const fb = res.status === 401 ? 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Hãy đăng nhập lại.'
            : res.status === 403 ? 'Tài khoản không có quyền thực hiện thao tác này.'
                : res.status === 404 ? 'Máy chủ chưa có API này (sai địa chỉ/tiền tố hoặc chưa dán route).'
                    : res.status === 419 || res.status === 422 ? 'Dữ liệu gửi lên không hợp lệ.'
                        : res.status >= 500 ? 'Máy chủ gặp sự cố. Xem backend/storage/logs/laravel.log.' : 'Đã có lỗi xảy ra.';
        throw new DhError(msg || fb, res.status, url);
    }
    return { data: json.data as T, message: json.message, meta: json.meta };
}

/* ---------- dò địa chỉ API ---------- */
export interface ProbeRow { base: string; status: number | 'network'; ms: number }

export async function probe(): Promise<ProbeRow[]> {
    const token = readToken();
    const out: ProbeRow[] = [];
    for (const base of CANDIDATES) {
        const t0 = performance.now();
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        try {
            const res = await fetch(`${base}${getPrefix()}/data-hub/datasets`, {
                headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: ctrl.signal,
            });
            out.push({ base, status: res.status, ms: Math.round(performance.now() - t0) });
        } catch {
            out.push({ base, status: 'network', ms: Math.round(performance.now() - t0) });
        } finally { clearTimeout(timer); }
    }
    return out;
}

export const bestOf = (rows: ProbeRow[]): ProbeRow | null =>
    rows.find((r) => r.status === 200) ?? rows.find((r) => r.status === 401 || r.status === 403) ?? null;