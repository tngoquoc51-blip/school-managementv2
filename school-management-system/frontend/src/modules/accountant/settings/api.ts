/**
 * API Cài đặt Kế toán — gọi backend Laravel (Modules/Accountant).
 * Nếu trang đăng nhập của bạn lưu token ở khóa khác, thêm tên khóa vào TOKEN_KEYS.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const TOKEN_KEYS = ['token', 'kt_token', 'staff_token', 'accessToken', 'access_token'];

export class ApiError extends Error {
    status: number;
    errors?: Record<string, string[]>;
    constructor(message: string, status: number, errors?: Record<string, string[]>) {
        super(message);
        this.status = status;
        this.errors = errors;
    }
}

function token(): string | null {
    if (typeof window === 'undefined') return null;
    for (const k of TOKEN_KEYS) {
        const v = localStorage.getItem(k) ?? sessionStorage.getItem(k);
        if (v) return v;
    }
    return null;
}

async function call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${BASE}/accountant/settings/${path}`, {
            method,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new ApiError('Không kết nối được máy chủ. Kiểm tra backend (php artisan serve) và MySQL trong Laragon.', 0);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        if (res.status === 401 && typeof window !== 'undefined') {
            setTimeout(() => (window.location.href = '/login'), 1200);
        }
        const first = json?.errors ? (Object.values(json.errors)[0] as string[])?.[0] : undefined;
        throw new ApiError(first || json?.message || `Lỗi ${res.status}`, res.status, json?.errors);
    }
    return json as T;
}

export const SettingsApi = {
    overview: () => call('GET', 'overview'),
    feeSettings: () => call<{ data: Record<string, string> }>('GET', 'fee-settings'),
    saveFeeSettings: (d: Record<string, unknown>) => call('PUT', 'fee-settings', d),

    feeItems: (q = '', category = '') =>
        call<{ data: FeeItem[] }>('GET', `fee-items?q=${encodeURIComponent(q)}&category=${category}`),
    createFeeItem: (d: Partial<FeeItem>) => call('POST', 'fee-items', d),
    updateFeeItem: (id: number, d: Partial<FeeItem>) => call('PUT', `fee-items/${id}`, d),
    deleteFeeItem: (id: number) => call('DELETE', `fee-items/${id}`),

    templates: () => call<{ data: Template[] }>('GET', 'templates'),
    createTemplate: (d: Partial<Template>) => call('POST', 'templates', d),
    updateTemplate: (id: number, d: Partial<Template>) => call('PUT', `templates/${id}`, d),
    toggleTemplate: (id: number) => call('PATCH', `templates/${id}/toggle`),
    deleteTemplate: (id: number) => call('DELETE', `templates/${id}`),

    prefs: () => call<{ data: Prefs }>('GET', 'prefs'),
    savePrefs: (d: Partial<Prefs>) => call('PUT', 'prefs', d),

    changePassword: (d: { current_password: string; new_password: string }) => call('POST', 'password', d),
    sessions: () => call<{ data: Session[] }>('GET', 'sessions'),
    revokeSession: (id: number) => call('DELETE', `sessions/${id}`),
    revokeOthers: () => call('DELETE', 'sessions'),

    logs: (page = 1, area = '', q = '') =>
        call<{ data: LogRow[]; meta: { page: number; last_page: number; total: number } }>(
            'GET', `logs?page=${page}&area=${area}&q=${encodeURIComponent(q)}`),
};

export interface FeeItem {
    id: number; code: string; name: string; category: string; amount: number; unit: string;
    grade: number | null; is_mandatory: number | boolean; note: string | null; used_count?: number;
}
export interface Template {
    id: number; code: string; name: string; level: number; subject: string; body: string;
    is_active: number; is_system: number; updated_at?: string | null;
}
export interface Prefs {
    notify_new_payment: number; notify_overdue: number; notify_dispute: number; notify_wallet_topup: number;
    daily_digest: number; digest_time: string; overdue_after_days: number; density: string; landing_page: string;
}
export interface Session { id: number; created_at: string; expires_at: string; current: boolean }
export interface LogRow { id: number; staff_name: string; area: string; action: string; detail: string | null; ip: string | null; created_at: string }