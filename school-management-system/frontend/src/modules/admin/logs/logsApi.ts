import type {
    AuditData, EventDetail, EventFilters, Incident, IncidentList, LogEvent, Meta, Overview, Paged, PurgeResult,
    Rule, RuleInput, SavedView, Security, StorageInfo,
} from './types';

/** Địa chỉ API: lấy từ NEXT_PUBLIC_API_URL (giống @/services/api của dự án). */
const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '');
const ROOT = `${BASE}/admin/logs`;

export class ApiError extends Error {
    status: number;
    errors: Record<string, string[]>;
    constructor(message: string, status: number, errors: Record<string, string[]> = {}) {
        super(message);
        this.status = status;
        this.errors = errors;
    }
}

/** Token đăng nhập: dự án lưu ở localStorage['token'] (xem @/services/api). */
function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        for (const k of ['token', 'access_token', 'auth_token', 'admin_token']) {
            const v = window.localStorage.getItem(k);
            if (v) return v;
        }
    } catch { /* bỏ qua */ }
    return null;
}

type Query = Record<string, string | number | boolean | null | undefined | string[]>;

function buildUrl(path: string, query?: Query): string {
    const url = new URL(ROOT + path);
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v === undefined || v === null || v === '' || v === false) continue;
            url.searchParams.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v));
        }
    }
    return url.toString();
}

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
        res = await fetch(buildUrl(path, opts.query), { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: opts.signal });
    } catch (e) {
        if ((e as Error).name === 'AbortError') throw e;
        throw new ApiError('Không kết nối được máy chủ. Hãy kiểm tra backend (php artisan serve) đang chạy ở cổng 8000.', 0);
    }

    let json: { success?: boolean; message?: string; data?: T; errors?: Record<string, string[]> } | null = null;
    try { json = await res.json(); } catch { /* không phải JSON */ }

    if (!res.ok) {
        const first = json?.errors ? Object.values(json.errors)[0]?.[0] : undefined;
        throw new ApiError(first || json?.message || `Lỗi ${res.status}`, res.status, json?.errors);
    }
    return (json?.data ?? null) as T;
}

/** Bộ lọc → tham số truy vấn. */
export function filterQuery(f: Partial<EventFilters>): Query {
    return {
        range: f.from ? undefined : f.range, from: f.from, to: f.to, level: f.level, category: f.category,
        action: f.action, actor: f.actor, ip: f.ip, status: f.status, source: f.source, q: f.q, pinned: f.pinned,
        request_id: f.request_id, subject_type: f.subject_type, subject_id: f.subject_id,
        sort: f.sort, dir: f.dir, page: f.page, per_page: f.per_page,
    };
}

async function download(path: string, query: Query, fallbackName: string): Promise<void> {
    const token = getToken();
    const res = await fetch(buildUrl(path, query), { headers: { Authorization: token ? `Bearer ${token}` : '', Accept: '*/*' } });
    if (!res.ok) throw new ApiError(`Không xuất được tệp (lỗi ${res.status}).`, res.status);
    const cd = res.headers.get('content-disposition') || '';
    const name = /filename="?([^";]+)"?/i.exec(cd)?.[1] || fallbackName;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const logsApi = {
    meta: () => request<Meta>('GET', '/meta'),
    overview: (range: string) => request<Overview>('GET', '/overview', { query: { range } }),
    events: (f: Partial<EventFilters>, signal?: AbortSignal) => request<Paged<LogEvent>>('GET', '/events', { query: filterQuery(f), signal }),
    event: (id: number) => request<EventDetail>('GET', `/events/${id}`),
    stream: (afterId: number, f: Partial<EventFilters>) => request<{ items: LogEvent[]; last_id: number }>('GET', '/events/stream', { query: { ...filterQuery({ ...f, page: undefined, per_page: undefined, sort: undefined, dir: undefined }), after_id: afterId } }),
    exportEvents: (format: 'csv' | 'json', f: Partial<EventFilters>) => download('/events/export', { ...filterQuery({ ...f, page: undefined, per_page: undefined }), format }, `nhat-ky-he-thong.${format}`),
    pin: (id: number, note: string | null) => request<null>('POST', `/events/${id}/pin`, { body: { note } }),
    unpin: (id: number) => request<null>('DELETE', `/events/${id}/pin`),

    security: () => request<Security>('GET', '/security'),
    unlock: (id: number) => request<null>('POST', `/security/accounts/${id}/unlock`),
    audit: (f: Partial<EventFilters>) => request<AuditData>('GET', '/audit', { query: filterQuery(f) }),

    views: () => request<SavedView[]>('GET', '/views'),
    saveView: (name: string, filters: Partial<EventFilters>, shared: boolean) => request<SavedView[]>('POST', '/views', { body: { name, filters, shared } }),
    deleteView: (id: number) => request<null>('DELETE', `/views/${id}`),

    rules: () => request<Rule[]>('GET', '/rules'),
    createRule: (r: RuleInput) => request<Rule>('POST', '/rules', { body: r }),
    updateRule: (id: number, r: RuleInput) => request<Rule>('PUT', `/rules/${id}`, { body: r }),
    deleteRule: (id: number) => request<null>('DELETE', `/rules/${id}`),
    testRule: (r: RuleInput) => request<{ matching: number; would_trigger: boolean; threshold: number }>('POST', '/rules/test', { body: r }),
    evaluate: () => request<{ opened: number }>('POST', '/rules/evaluate'),
    incidents: (q: { status?: string; page?: number; per_page?: number }) => request<IncidentList>('GET', '/incidents', { query: q }),
    acknowledge: (id: number) => request<null>('POST', `/incidents/${id}/acknowledge`),
    resolve: (id: number, note: string | null) => request<null>('POST', `/incidents/${id}/resolve`, { body: { note } }),

    storage: () => request<StorageInfo>('GET', '/storage'),
    saveRetention: (days: Record<string, number>) => request<Record<string, number>>('PUT', '/storage/retention', { body: { days } }),
    purge: (dryRun: boolean, confirm?: string) => request<PurgeResult>('POST', '/storage/purge', { body: { dry_run: dryRun, confirm } }),
    testEvent: (level: string) => request<{ id: number }>('POST', '/test-event', { body: { level } }),
    sync: () => request<{ imported: number }>('POST', '/sync'),
};

export type { Incident };