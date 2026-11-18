/**
 * Bộ gọi API riêng cho trang Sổ đầu bài (Cổng Giáo viên) – không phụ thuộc file nào khác của dự án.
 * - Địa chỉ API tự dò được (nút "Tự dò địa chỉ API") và nhớ trong localStorage.
 * - Token: thử lần lượt các token tìm thấy trong trình duyệt; gặp 401 thì thử token kế tiếp (cuối cùng là
 *   "demo-token", chỉ có tác dụng khi backend APP_ENV=local). Token chạy được sẽ được nhớ cho lần sau.
 */
const ENV = process.env.NEXT_PUBLIC_API_URL || '';
const K_BASE = 'll_api_base';
const K_PREFIX = 'll_api_prefix';
const K_TOKEN = 'll_token_ok';
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
    return process.env.NEXT_PUBLIC_TEACHER_PREFIX || '/gv/teacher';
};
export const setConn = (base: string, prefix: string) => {
    localStorage.setItem(K_BASE, base.replace(/\/+$/, ''));
    localStorage.setItem(K_PREFIX, prefix && !prefix.startsWith('/') ? `/${prefix}` : prefix);
};

/** Danh sách token có thể dùng, theo thứ tự ưu tiên. */
export function tokenCandidates(): string[] {
    if (typeof window === 'undefined') return [];
    const out: string[] = [];
    const add = (v?: string | null) => {
        const t = (v ?? '').replace(/^"|"$/g, '').trim();
        if (t && !out.includes(t)) out.push(t);
    };
    try { add(sessionStorage.getItem(K_TOKEN)); } catch { /* bỏ qua */ }
    for (const k of ['staff_token', 'gv_token', 'bgh_token', 'sm_staff_token', 'token', 'access_token', 'admin_token', 'auth_token', 'accessToken', 'jwt']) {
        try { add(localStorage.getItem(k) ?? sessionStorage.getItem(k)); } catch { /* bỏ qua */ }
    }
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) as string;
            if (/token/i.test(k) && !/csrf|refresh|fcm|push|ll_token_ok/i.test(k)) {
                const v = localStorage.getItem(k);
                if (v && v.length > 8) add(v);
            }
        }
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        if (u?.token) add(String(u.token));
    } catch { /* bỏ qua */ }
    add('demo-token');
    return out;
}
export const hasToken = () => tokenCandidates().some((t) => t !== 'demo-token');

export class LlError extends Error {
    status: number;
    url: string;
    constructor(message: string, status: number, url: string) {
        super(message);
        this.name = 'LlError';
        this.status = status;
        this.url = url;
    }
}

const hasVi = (s: string) => /[\u00C0-\u1EF9]/.test(s);
type Query = Record<string, string | number | boolean | null | undefined>;
export interface LlResult<T> { data: T; message?: string; meta?: Record<string, any> }

export const endpoint = (path: string) => `${getBase()}${getPrefix()}/${path.replace(/^\//, '')}`;

async function send(url: string, method: string, body: unknown, token: string, ms: number): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, {
            method,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: ctrl.signal,
        });
    } finally { clearTimeout(timer); }
}

export async function adm<T = any>(
    path: string,
    opts: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; query?: Query } = {},
): Promise<LlResult<T>> {
    const qs = new URLSearchParams();
    Object.entries(opts.query ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, String(v)); });
    const url = endpoint(path) + (qs.toString() ? `?${qs}` : '');
    const tokens = tokenCandidates();
    const list = tokens.length ? tokens : [''];

    let res: Response | null = null;
    let used = '';
    for (const t of list) {
        try {
            res = await send(url, opts.method ?? 'GET', opts.body, t, 60000);
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') throw new LlError('Máy chủ phản hồi quá chậm. Vui lòng thử lại.', 0, url);
            throw new LlError('Không kết nối được máy chủ API.', 0, url);
        }
        used = t;
        if (res.status !== 401) break;   // 401 = token này không được nhận → thử token kế tiếp
    }
    const r = res as Response;
    if (r.ok && used) { try { sessionStorage.setItem(K_TOKEN, used); } catch { /* bỏ qua */ } }

    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
        const first = json?.errors ? (Object.values(json.errors as Record<string, string[]>)[0]?.[0] ?? '') : '';
        const msg: string = json?.message && hasVi(json.message) ? json.message : first;
        const fb = r.status === 401 ? 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Hãy đăng xuất rồi đăng nhập lại.'
            : r.status === 403 ? 'Tài khoản không có quyền thực hiện thao tác này.'
                : r.status === 404 ? 'Máy chủ chưa có API này (sai địa chỉ/tiền tố hoặc chưa dán route).'
                    : r.status === 419 || r.status === 422 ? 'Dữ liệu gửi lên không hợp lệ.'
                        : r.status >= 500 ? 'Máy chủ gặp sự cố. Xem backend/storage/logs/laravel.log.' : 'Đã có lỗi xảy ra.';
        throw new LlError(msg || fb, r.status, url);
    }
    return { data: json.data as T, message: json.message, meta: json.meta };
}

/* ---------- dò địa chỉ API ---------- */
export interface ProbeRow { base: string; status: number | 'network'; ms: number }

export async function probe(): Promise<ProbeRow[]> {
    const tokens = tokenCandidates();
    const list = tokens.length ? tokens : [''];
    const out: ProbeRow[] = [];
    for (const base of CANDIDATES) {
        const t0 = performance.now();
        let status: number | 'network' = 'network';
        for (const t of list) {
            try {
                const res = await send(`${base}${getPrefix()}/lesson-log/meta`, 'GET', undefined, t, 4000);
                status = res.status;
                if (res.status !== 401) break;
            } catch { status = 'network'; break; }
        }
        out.push({ base, status, ms: Math.round(performance.now() - t0) });
    }
    return out;
}

export const bestOf = (rows: ProbeRow[]): ProbeRow | null =>
    rows.find((r) => r.status === 200) ?? rows.find((r) => r.status === 401 || r.status === 403) ?? null;