import api from '@/services/api';

const B = '/admin/profile';

// Token Sanctum có dạng "12|abcDEF..." — tự dò trong trình duyệt, không phụ thuộc tên khoá lưu trữ
const SANCTUM = /^\d+\|[A-Za-z0-9]{20,}$/;
function findToken(): string | null {
    if (typeof window === 'undefined') return null;
    for (const store of [window.localStorage, window.sessionStorage]) {
        for (let i = 0; i < store.length; i++) {
            const raw = store.getItem(store.key(i) as string) || '';
            if (SANCTUM.test(raw)) return raw;
            try {
                const o = JSON.parse(raw);
                const t = o?.token ?? o?.access_token ?? o?.state?.token;
                if (typeof t === 'string' && SANCTUM.test(t)) return t;
            } catch { /* không phải JSON */ }
        }
    }
    return null;
}
const cfg = () => {
    const t = findToken();
    return t ? { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } } : {};
};

// Chịu được cả axios (r.data) lẫn wrapper trả thẳng JSON
const d = (p: Promise<any>): Promise<any> =>
    p.then((r) => (r && typeof r === 'object' && 'status' in r && 'data' in r ? r.data : r));

export const adminProfile = {
    get: () => d(api.get(B, cfg())),
    update: (body: any) => d(api.put(B, body, cfg())),
    avatar: (file: File) => {
        const fd = new FormData();
        fd.append('avatar', file);
        return d(api.post(`${B}/avatar`, fd, cfg()));
    },
    preferences: (body: any) => d(api.put(`${B}/preferences`, body, cfg())),
    password: (body: any) => d(api.post(`${B}/password`, body, cfg())),
    sessions: () => d(api.get(`${B}/sessions`, cfg())),
    revokeOthers: () => d(api.post(`${B}/sessions/revoke-others`, {}, cfg())),
    revoke: (id: number) => d(api.delete(`${B}/sessions/${id}`, cfg())),
    activity: () => d(api.get(`${B}/activity`, cfg())),
    email: (body: any) => d(api.put(`${B}/email`, body, cfg())),
    notices: () => d(api.get(`${B}/notifications`, cfg())),
    readNotice: (id: number) => d(api.post(`${B}/notifications/${id}/read`, {}, cfg())),
    readAllNotices: () => d(api.post(`${B}/notifications/read-all`, {}, cfg())),
    deleteNotice: (id: number) => d(api.delete(`${B}/notifications/${id}`, cfg())),
};