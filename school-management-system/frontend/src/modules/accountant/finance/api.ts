import axios, { AxiosError } from 'axios';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '') + '/accountant';
export const TOKEN_KEY = 'fx_token';

export const http = axios.create({ baseURL: BASE, headers: { Accept: 'application/json' }, timeout: 30000 });

export function getToken(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t: string | null) {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* bỏ qua */ }
}

http.interceptors.request.use((cfg) => {
    const t = getToken();
    if (t) cfg.headers.Authorization = `Bearer ${t}`;
    return cfg;
});
http.interceptors.response.use(
    (r) => r,
    (err: AxiosError) => {
        if (err.response?.status === 401 && typeof window !== 'undefined') {
            setToken(null);
            window.dispatchEvent(new Event('fx:unauth'));
        }
        return Promise.reject(err);
    }
);

/** Lấy thông báo lỗi dễ hiểu từ phản hồi API. */
export function errMsg(e: unknown): string {
    const ax = e as AxiosError<{ message?: string }>;
    if (ax?.response?.data?.message) return ax.response.data.message;
    if (ax?.code === 'ERR_NETWORK') return 'Không kết nối được máy chủ API. Hãy kiểm tra Laragon (Apache/MySQL) và địa chỉ NEXT_PUBLIC_API_URL.';
    if (ax?.code === 'ECONNABORTED') return 'Máy chủ phản hồi quá lâu, vui lòng thử lại.';
    return (e as Error)?.message || 'Có lỗi xảy ra.';
}

interface Envelope<T> { success: boolean; message: string; data: T }
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const clean: Record<string, unknown> = {};
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') clean[k] = v; });
    return (await http.get<Envelope<T>>(url, { params: clean })).data.data;
}
export async function send<T = unknown>(method: 'post' | 'put' | 'delete', url: string, body?: unknown): Promise<{ data: T; message: string }> {
    const r = await http.request<Envelope<T>>({ method, url, data: body });
    return { data: r.data.data, message: r.data.message };
}

export async function downloadCsv(params: Record<string, unknown>, fallbackName: string) {
    const clean: Record<string, unknown> = {};
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') clean[k] = v; });
    const r = await http.get('/students/export', { params: clean, responseType: 'blob' });
    const cd = String(r.headers['content-disposition'] || '');
    const m = /filename="?([^";]+)"?/.exec(cd);
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement('a');
    a.href = url; a.download = m?.[1] || fallbackName; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}