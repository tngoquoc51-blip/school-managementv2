import axios from 'axios';
import type {
    AlertsData, Facets, FinanceData, Filters, LogDetail, LogRow, Me, Overview, Paged, RuleRow,
    SecurityData, SessionsData, SettingsData, Mini,
} from './types';

/**
 * Địa chỉ API tự nhận biết — KHÔNG phải cấu hình lại khi đưa lên server:
 *  - Có biến NEXT_PUBLIC_API_URL  → dùng đúng giá trị đó.
 *  - Chạy ở localhost            → http://localhost:8000/api/v1 (Laragon / artisan serve).
 *  - Chạy trên domain của trường → /api/v1 (cùng tên miền, Nginx chuyển tiếp sang Laravel).
 */
function apiBase(): string {
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
    if (typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return '/api/v1';
    return 'http://localhost:8000/api/v1';
}

const TOKEN_KEYS = ['logs_token', 'token', 'access_token', 'auth_token', 'bgh_token', 'jwt', 'authToken'];

/** Lấy token đăng nhập: thử các tên khoá thường gặp, rồi tới bất kỳ khoá nào chứa chữ "token". */
/** Token Nhật ký lưu thêm trong cookie: trang đăng nhập khác có xoá localStorage cũng không mất phiên. */
function readCookieToken(): string | null {
    try {
        const m = document.cookie.match(/(?:^|;\s*)logs_token=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : null;
    } catch { return null; }
}
export function saveLogsToken(token: string) {
    try { localStorage.setItem('logs_token', token); } catch {}
    try { document.cookie = `logs_token=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 12}; SameSite=Lax`; } catch {}
}
export function clearLogsToken() {
    try { localStorage.removeItem('logs_token'); } catch {}
    try { document.cookie = 'logs_token=; path=/; max-age=0; SameSite=Lax'; } catch {}
}

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    const cand: string[] = [];
    const add = (v: string | null) => { if (v) cand.push(v.replace(/^"|"$/g, '')); };
    add(readCookieToken());
    try {
        for (const k of TOKEN_KEYS) add(localStorage.getItem(k));
        for (const store of [localStorage, sessionStorage]) {
            for (let i = 0; i < store.length; i++) {
                const k = store.key(i) || '';
                if (/token/i.test(k)) add(store.getItem(k));
            }
        }
    } catch {}
    // Bỏ token giả của đăng nhập demo; ưu tiên token Sanctum thật (dạng "76|abc...")
    const real = cand.filter((t) => t && !/^demo/i.test(t));
    return real.find((t) => /^\d+\|/.test(t)) || real[0] || null;
}

/** Đăng nhập thật (Sanctum) ngay trong trang Nhật ký; lưu token vào khoá riêng `logs_token`. */
export async function loginForLogs(email: string, password: string) {
    const res = await axios.post(apiBase() + '/auth/login', { email, password }, { headers: { Accept: 'application/json' } });
    const { token, user, roles } = res.data || {};
    if (!token) throw new Error('Máy chủ không trả về token');
    saveLogsToken(token);
    if (user) localStorage.setItem('user', JSON.stringify(user));
    if (roles) localStorage.setItem('roles', JSON.stringify(roles));
    return { token, user, roles };
}

/** Thông tin chẩn đoán (chỉ tên khoá, KHÔNG có giá trị token) để hiển thị khi lỗi. */
export function debugInfo() {
    let local: string[] = [], session: string[] = [];
    try { local = Object.keys(localStorage); session = Object.keys(sessionStorage); } catch {}
    return { api: apiBase(), local, session };
}

const api = axios.create();
api.interceptors.request.use((config) => {
    config.baseURL = apiBase();
    const t = getToken();
    if (t) config.headers.Authorization = `Bearer ${t}`;
    config.headers.Accept = 'application/json';
    return config;
});

const BASE = '/logs';

function clean(params?: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
}

async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const res = await api.get(BASE + url, { params: clean(params) });
    return res.data.data as T;
}

async function send<T = unknown>(method: 'post' | 'put' | 'delete', url: string, body?: unknown): Promise<T> {
    const res = await api.request({ method, url: BASE + url, data: body });
    return res.data.data as T;
}

export function errorMessage(e: any): string {
    return e?.response?.data?.message || e?.response?.data?.errors && Object.values(e.response.data.errors).flat().join(' ')
        || (e?.message === 'Network Error' ? 'Không kết nối được máy chủ API' : e?.message) || 'Có lỗi xảy ra';
}

export const logsApi = {
    me: () => get<Me>('/me'),
    overview: (range: string) => get<Overview>('/overview', { range }),
    facets: () => get<Facets>('/facets'),
    list: (f: Filters, page: number, per_page: number) => get<Paged<LogRow>>('/activities', { ...f, page, per_page }),
    detail: (id: number) => get<LogDetail>(`/activities/${id}`),
    security: () => get<SecurityData>('/security'),
    sessions: () => get<SessionsData>('/sessions'),
    finance: () => get<FinanceData>('/finance'),
    alerts: (status: string, page = 1) => get<AlertsData>('/alerts', { status, page, per_page: 20 }),
    rules: () => get<RuleRow[]>('/alert-rules'),
    settings: () => get<SettingsData>('/settings'),

    ackAlert: (id: number) => send('post', `/alerts/${id}/ack`, {}),
    resolveAlert: (id: number, note: string) => send('post', `/alerts/${id}/resolve`, { note }),
    updateRule: (id: number, body: Partial<RuleRow>) => send<RuleRow>('put', `/alert-rules/${id}`, body),
    revokeSession: (type: string, id: number) => send('delete', `/sessions/${type}/${id}`),
    purgeExpired: () => send<{ deleted: number }>('post', '/sessions/purge-expired', {}),
    unlock: (type: string, id: number) => send('post', `/accounts/${type}/${id}/unlock`, {}),
    saveSettings: (body: Record<string, unknown>) => send<Record<string, string>>('put', '/settings', body),
    purgeLogs: () => send<{ deleted: number }>('post', '/settings/purge', { confirm: 'XOA' }),
    importLegacy: () => send<Record<string, number>>('post', '/settings/import-legacy', {}),
    verify: () => send<{ ok: boolean; checked: number; unchained: number; first_broken_id: number | null; verified_at: string }>('post', '/verify', {}),

    /** Tải CSV có kèm token (axios, vì cần header Authorization). */
    async exportCsv(f: Filters) {
        const res = await api.get(BASE + '/export', { params: clean(f), responseType: 'blob' });
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        const cd = String(res.headers['content-disposition'] || '');
        a.download = /filename="?([^";]+)"?/.exec(cd)?.[1] || 'nhat-ky.csv';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    },
};

export type { Mini };