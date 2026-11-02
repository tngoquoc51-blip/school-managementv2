import api from '@/services/api';

// Token học sinh: ưu tiên khoá có chữ student/hs, sau đó khoá có chữ token
function studentToken(): string | null {
    if (typeof window === 'undefined') return null;
    const c: [number, string][] = [];
    for (const st of [window.localStorage, window.sessionStorage]) {
        for (let i = 0; i < st.length; i++) {
            const k = st.key(i) as string;
            let v: any = st.getItem(k) || '';
            try { const o = JSON.parse(v); v = o?.token ?? o?.access_token ?? o?.state?.token ?? v; } catch { /* không phải JSON */ }
            if (typeof v === 'string' && /^[A-Za-z0-9|._-]{20,300}$/.test(v)) c.push([/student|^hs|_hs|hs_/i.test(k) ? 0 : /token/i.test(k) ? 1 : 2, v]);
        }
    }
    c.sort((a, b) => a[0] - b[0]);
    return c[0]?.[1] ?? null;
}
const cfg = () => { const t = studentToken(); return t ? { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } } : {}; };
const d = (p: Promise<any>): Promise<any> =>
    p.then((r) => (r && typeof r === 'object' && 'status' in r && 'data' in r ? r.data : r));

const B = '/v1/hs/attendance';
const T = { timeout: 15000 }; // quá 15 giây coi như lỗi kết nối
export const studentAttendance = {
    overview: (params?: any) => d(api.get(B, { ...T, ...cfg(), params })),
    month: (m: string) => d(api.get(`${B}/records`, { ...T, ...cfg(), params: { m } })),
    issues: (params?: any) => d(api.get(`${B}/records`, { ...T, ...cfg(), params: { issues: 1, ...params } })),
    subjects: (params?: any) => d(api.get(`${B}/subjects`, { ...T, ...cfg(), params })),
    subject: (id: number, params?: any) => d(api.get(`${B}/subjects/${id}`, { ...T, ...cfg(), params })),
    leaves: () => d(api.get(`${B}/leaves`, cfg())),
    sendLeave: (body: any) => d(api.post(`${B}/leaves`, body, cfg())),
    cancelLeave: (id: number) => d(api.post(`${B}/leaves/${id}/cancel`, {}, cfg())),
};