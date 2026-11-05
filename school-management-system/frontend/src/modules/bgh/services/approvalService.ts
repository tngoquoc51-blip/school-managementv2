/* Gọi API bằng fetch + token nhân sự (StaffToken). Không phụ thuộc services/api.ts. */

// Nếu trang đăng nhập BGH lưu token dưới tên khác, điền đúng tên key vào đây (xem Application → Local Storage trong DevTools).
const TOKEN_KEY = '';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

export type ApType = 'profile' | 'leave' | 'dispute';
export type ApStatus = 'pending' | 'approved' | 'rejected';
export interface Approval { type: ApType; id: number; student_id: number; student_name: string; student_code: string; title: string; detail: string; status: ApStatus; note: string | null; created_at: string }
export interface ApStats { pending: Record<ApType, number>; approved_today: number; rejected_today: number }
export interface ApLog { id: number; type: ApType; ref_id: number; action: 'approve' | 'reject'; note: string | null; actor_name: string; student_name: string | null; created_at: string }

const clean = (v: string | null) => (v ? v.replace(/^"|"$/g, '') : '');

/** Duyệt đệ quy JSON, gom mọi chuỗi nằm ở khóa có chữ "token" (vd. user.token, roles[0].token). */
function collect(node: unknown, out: string[], keyHint = ''): void {
    if (typeof node === 'string') { if (/token/i.test(keyHint) && node.length > 5) out.push(node); return; }
    if (Array.isArray(node)) { node.forEach((x) => collect(x, out, keyHint)); return; }
    if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => collect(v, out, k));
}

/** Danh sách token ứng viên: thử lần lượt cho tới khi backend chấp nhận. */
function candidates(): string[] {
    if (typeof window === 'undefined') return [];
    const out: string[] = [];
    for (const s of [localStorage, sessionStorage]) {
        if (TOKEN_KEY) { const v = clean(s.getItem(TOKEN_KEY)); if (v) out.push(v); continue; }
        for (let i = 0; i < s.length; i++) {
            const k = s.key(i) ?? '';
            const raw = s.getItem(k) ?? '';
            if (/token/i.test(k) && clean(raw).length > 5 && !raw.trim().startsWith('{') && !raw.trim().startsWith('[')) out.push(clean(raw));
            if (raw.trim().startsWith('{') || raw.trim().startsWith('[')) { try { collect(JSON.parse(raw), out); } catch { /* bỏ qua */ } }
        }
    }
    return Array.from(new Set(out));
}

let working = '';

export class ApiError extends Error {
    constructor(message: string, public status: number) { super(message); }
}

async function req<T>(path: string, init?: RequestInit & { params?: Record<string, string | number> }): Promise<T> {
    const qs = init?.params ? '?' + new URLSearchParams(Object.entries(init.params).map(([k, v]) => [k, String(v)])).toString() : '';
    const tokens = Array.from(new Set([working, ...candidates()].filter(Boolean)));
    let last: { res: Response; json: any } | null = null;
    for (const tk of tokens.length ? tokens : ['']) {
        const res = await fetch(`${BASE}/gv/approvals${path}${qs}`, {
            method: init?.method ?? 'GET',
            body: init?.body,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        });
        const json = await res.json().catch(() => ({}));
        last = { res, json };
        if (res.status !== 401) { if (res.ok) working = tk; break; }
    }
    const { res, json } = last!;
    if (!res.ok) {
        const e = json?.errors ? (Object.values(json.errors).flat() as string[]).join(' ') : json?.message;
        throw new ApiError(e || 'Có lỗi xảy ra, vui lòng thử lại.', res.status);
    }
    return json as T;
}

export interface Delegation { id: number; from_date: string; to_date: string; note: string | null; other_name: string; other_role: string; state: 'active' | 'scheduled' | 'expired' | 'revoked' }
export interface StaffOpt { id: number; full_name: string; role: string }
export interface Report {
    days: number; avg_hours: number | null;
    daily: { d: string; ok: string; bad: string }[];
    by_type: { type: ApType; ok: string; bad: string }[];
    top: { actor_name: string; c: string }[];
}
const post = <T,>(p: string, body?: object) => req<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const approvalApi = {
    delegations: () => req<{ data: { given: Delegation[]; received: Delegation[]; staff: StaffOpt[] } }>('/delegations').then((r) => r.data),
    createDelegation: (b: { delegate_id: number; from_date: string; to_date: string; note: string }) => post<{ message: string }>('/delegations', b).then((r) => r.message),
    revokeDelegation: (id: number) => post<{ message: string }>(`/delegations/${id}/revoke`).then((r) => r.message),
    report: (days: number) => req<{ data: Report }>('/report', { params: { days } }).then((r) => r.data),
    list: (p: { status: string; type: string; q: string; page: number }) => req<{ data: Approval[]; has_more: boolean }>('', { params: p }),
    stats: () => req<{ data: ApStats }>('/stats').then((r) => r.data),
    history: () => req<{ data: ApLog[] }>('/history').then((r) => r.data),
    decide: (type: ApType, id: number, action: 'approve' | 'reject', note: string) =>
        req<{ message: string }>(`/${type}/${id}/decide`, { method: 'POST', body: JSON.stringify({ action, note }) }).then((r) => r.message),
    bulk: (items: { type: ApType; id: number }[], action: 'approve' | 'reject', note: string) =>
        req<{ message: string }>('/bulk', { method: 'POST', body: JSON.stringify({ items, action, note }) }).then((r) => r.message),
};