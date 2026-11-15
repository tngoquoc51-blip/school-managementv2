/**
 * LỚP GỌI API DÙNG CHUNG cho mọi trang (BGH, Admin, Kế hoạch, Phê duyệt, Môn học…).
 * Mục tiêu: chỉ MỘT chỗ quyết định (1) địa chỉ API và (2) token đăng nhập, để không trang nào tự đoán nữa.
 *
 *  - Địa chỉ API: lấy từ NEXT_PUBLIC_API_URL. Khuyến nghị đặt "/api/v1" (cùng domain, Next/nginx chuyển tiếp
 *    sang Laravel) → không lỗi CORS, không phải đoán cổng, chạy giống hệt ở máy dev và server.
 *  - Token: dò trong localStorage / sessionStorage (key có chữ "token" hoặc nằm trong JSON "user"…),
 *    thử lần lượt và nhớ token được chấp nhận. Chấp nhận cả token ngắn (vd. "demo-token" khi APP_ENV=local).
 */
const ENV = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
export const API_BASE = ENV || '/api/v1';

/** Nếu trang đăng nhập lưu token ở key lạ, điền tên key vào đây (nếu để trống sẽ tự dò). */
const TOKEN_KEY = '';

export class ApiError extends Error {
    constructor(message: string, public status: number) { super(message); }
}

const clean = (v: string | null) => (v ? v.replace(/^"|"$/g, '') : '');

function collect(node: unknown, out: string[], hint = ''): void {
    if (typeof node === 'string') { if (/token/i.test(hint) && node.length > 5) out.push(node); return; }
    if (Array.isArray(node)) { node.forEach((x) => collect(x, out, hint)); return; }
    if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => collect(v, out, k));
}

/** Danh sách token ứng viên (ưu tiên key "token"). */
export function authTokens(): string[] {
    if (typeof window === 'undefined') return [];
    const out: string[] = [];
    for (const s of [localStorage, sessionStorage]) {
        if (TOKEN_KEY) { const v = clean(s.getItem(TOKEN_KEY)); if (v) out.push(v); continue; }
        const first = clean(s.getItem('token')); if (first.length > 5) out.push(first);
        for (let i = 0; i < s.length; i++) {
            const k = s.key(i) ?? ''; const raw = s.getItem(k) ?? '';
            if (/^[{[]/.test(raw.trim())) { try { collect(JSON.parse(raw), out); } catch { /* bỏ qua */ } }
            else if (/token/i.test(k) && clean(raw).length > 5) out.push(clean(raw));
        }
    }
    return Array.from(new Set(out));
}

let working = '';

export interface ApiOptions { method?: string; body?: unknown; params?: Record<string, string | number | undefined>; signal?: AbortSignal }

/** Gọi API: tự gắn token, tự thử token khác khi gặp 401, thông báo lỗi tiếng Việt rõ ràng. */
export async function apiFetch<T = unknown>(path: string, opt: ApiOptions = {}): Promise<T> {
    const qs = opt.params
        ? '?' + new URLSearchParams(Object.entries(opt.params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()
        : '';
    const candidates = Array.from(new Set([working, ...authTokens()].filter(Boolean)));
    let last: { res: Response; json: any } | null = null;

    for (const tk of candidates.length ? candidates : ['']) {
        const res = await fetch(`${API_BASE}${path}${qs}`, {
            method: opt.method ?? 'GET',
            body: opt.body === undefined ? undefined : JSON.stringify(opt.body),
            signal: opt.signal,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
        });
        const json = await res.json().catch(() => ({}));
        last = { res, json };
        if (res.status !== 401) { if (res.ok) working = tk; break; }
    }

    const { res, json } = last!;
    if (!res.ok) {
        if (res.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired'));
        const detail = json?.errors ? (Object.values(json.errors).flat() as string[]).join(' ') : json?.message;
        throw new ApiError(
            detail || (res.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Có lỗi xảy ra, vui lòng thử lại.'),
            res.status,
        );
    }
    return json as T;
}