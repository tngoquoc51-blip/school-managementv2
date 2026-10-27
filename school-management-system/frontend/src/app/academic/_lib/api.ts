// Gọi API Giáo vụ (/api/gv/*) — không dùng /api/v1/gv
const RAW = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
const BASE = RAW.replace(/\/v1\/?$/, '');

export type Staff = { id: number; username: string; name: string; role: string; role_label: string };

export const getToken = (): string | null => {
    try { return localStorage.getItem('gv_token'); } catch { return null; }
};
export const getStaff = (): Staff | null => {
    try { const s = localStorage.getItem('gv_user'); return s ? JSON.parse(s) : null; } catch { return null; }
};
export const saveSession = (token: string, staff: Staff) => {
    try { localStorage.setItem('gv_token', token); localStorage.setItem('gv_user', JSON.stringify(staff)); } catch {}
};
export const clearSession = () => {
    try { localStorage.removeItem('gv_token'); localStorage.removeItem('gv_user'); } catch {}
};

export class ApiError extends Error {
    status: number; errors?: Record<string, string>;
    constructor(m: string, status: number, errors?: Record<string, string>) { super(m); this.status = status; this.errors = errors; }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${BASE}/gv/${path}`, {
            method: opts.method || 'GET',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() ?? ''}` },
            body: opts.body ? JSON.stringify(opts.body) : undefined,
        });
    } catch {
        throw new ApiError('Không kết nối được máy chủ. Hãy kiểm tra backend đang chạy.', 0);
    }
    let json: any = null;
    try { json = await res.json(); } catch {}
    if (res.status === 401 && path !== 'login') {
        clearSession();
        if (typeof window !== 'undefined') window.location.href = '/login/academic';
    }
    if (!res.ok) throw new ApiError(json?.message || 'Có lỗi xảy ra, vui lòng thử lại.', res.status, json?.errors);
    return (json?.data ?? json) as T;
}

export const qs = (o: Record<string, string | number | null | undefined>) => {
    const p = new URLSearchParams();
    Object.entries(o).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') p.set(k, String(v)); });
    const s = p.toString();
    return s ? `?${s}` : '';
};