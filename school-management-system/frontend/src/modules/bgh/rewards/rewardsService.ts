import type {
    Award, AwardsOverview, AwardType, ClassDetail, Criterion, Meta, OverviewData, Paged, Period, RankItem, Range, RecordRow, LogRow, StudentHit,
} from './types';

/** Tìm token đăng nhập nhân viên (gv/login) trong localStorage / sessionStorage */
const TOKEN_KEYS = ['gv_token', 'staff_token', 'sm_staff_token', 'token', 'access_token', 'auth_token', 'authToken'];
export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    for (const st of [window.localStorage, window.sessionStorage]) {
        for (const k of TOKEN_KEYS) {
            const v = st.getItem(k);
            if (v && v.length >= 20) return v.replace(/^"|"$/g, '');
        }
        for (let i = 0; i < st.length; i++) {
            const k = st.key(i) || '';
            const v = st.getItem(k) || '';
            if (/token/i.test(k) && v.length >= 20 && !v.includes(' ') && !v.startsWith('{')) return v.replace(/^"|"$/g, '');
        }
    }
    return null;
}

/** Địa chỉ API: <NEXT_PUBLIC_API_URL>/gv/rewards  (Laravel tự nhận cả /api lẫn /api/v1) */
function base(): string {
    let b = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
    if (!/\/api(\/v1)?$/.test(b)) b += '/api';
    return b + '/gv/rewards';
}

/** Bỏ các tham số rỗng trước khi gửi */
const clean = (p: Record<string, any>) =>
    Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== ''));

async function call<T>(method: string, url: string, params?: Record<string, any>, body?: any): Promise<T> {
    const qs = params ? new URLSearchParams(clean(params) as Record<string, string>).toString() : '';
    let res: Response;
    try {
        res = await fetch(base() + url + (qs ? '?' + qs : ''), {
            method,
            headers: {
                Accept: 'application/json',
                ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw { response: { status: 0, data: { message: 'Không kết nối được máy chủ. Hãy kiểm tra Laragon và địa chỉ API.' } } };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { response: { status: res.status, data } };
    return data as T;
}

const get = <T,>(url: string, params: Record<string, any> = {}) => call<T>('GET', url, params);
const send = <T = { message: string }>(method: 'post' | 'put' | 'patch' | 'delete', url: string, body?: any) =>
    call<T>(method.toUpperCase(), url, undefined, body ?? (method === 'delete' ? undefined : {}));

export const rewardsApi = {
    meta: (year_id?: number) => get<Meta>('/meta', { year_id }),
    overview: (year_id: number, date: string) => get<OverviewData>('/overview', { year_id, date }),
    ranking: (year_id: number, period: Period, date: string, grade?: number) =>
        get<{ range: Range; items: RankItem[] }>('/ranking', { year_id, period, date, grade }),
    classDetail: (id: number, period: Period, date: string) => get<ClassDetail>(`/classes/${id}`, { period, date }),

    records: (p: Record<string, any>) => get<Paged<RecordRow>>('/records', p),
    addRecord: (b: Record<string, any>) => send<{ message: string; count: number; points: number }>('post', '/records', b),
    delRecord: (id: number) => send('delete', `/records/${id}`),

    criteria: () => get<Criterion[]>('/criteria'),
    saveCriterion: (b: Record<string, any>, id?: number) => (id ? send('put', `/criteria/${id}`, b) : send('post', '/criteria', b)),
    toggleCriterion: (id: number) => send('patch', `/criteria/${id}/toggle`),
    delCriterion: (id: number) => send('delete', `/criteria/${id}`),

    awards: (p: Record<string, any>) =>
        get<{ counts: { pending: number; approved: number; rejected: number }; page: Paged<Award> }>('/awards', p),
    addAward: (b: Record<string, any>) => send('post', '/awards', b),
    reviewAward: (id: number, decision: 'approve' | 'reject', note?: string) =>
        send('patch', `/awards/${id}/review`, { decision, note }),
    delAward: (id: number) => send('delete', `/awards/${id}`),

    awardsOverview: (year_id: number, kind?: string) => get<AwardsOverview>('/awards/overview', { year_id, kind }),
    awardTypes: () => get<AwardType[]>('/award-types'),
    saveAwardType: (b: Record<string, any>, id?: number) => (id ? send('put', `/award-types/${id}`, b) : send('post', '/award-types', b)),
    toggleAwardType: (id: number) => send('patch', `/award-types/${id}/toggle`),
    delAwardType: (id: number) => send('delete', `/award-types/${id}`),

    logs: (p: Record<string, any>) => get<Paged<LogRow>>('/logs', p),
    students: (q: string, year_id: number) => get<StudentHit[]>('/students/search', { q, year_id }),
};

/** Lấy thông báo lỗi dễ hiểu từ phản hồi Laravel */
export function errMsg(e: any): string {
    const d = e?.response?.data;
    if (d?.errors) {
        const first = Object.values(d.errors)[0] as string[];
        return first?.[0] || d.message;
    }
    if (e?.response?.status === 403) return d?.message || 'Bạn không có quyền thực hiện thao tác này.';
    return d?.message || e?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
}