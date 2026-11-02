import api from '@/services/api';

// Token giáo viên: ưu tiên khoá có chữ teacher/staff/gv, sau đó khoá có chữ token
function staffToken(): string | null {
    if (typeof window === 'undefined') return null;
    const c: [number, string][] = [];
    for (const st of [window.localStorage, window.sessionStorage]) {
        for (let i = 0; i < st.length; i++) {
            const k = st.key(i) as string;
            let v: any = st.getItem(k) || '';
            try { const o = JSON.parse(v); v = o?.token ?? o?.access_token ?? o?.state?.token ?? v; } catch { /* không phải JSON */ }
            if (typeof v === 'string' && /^[A-Za-z0-9|._-]{20,300}$/.test(v)) c.push([/teacher|staff|gv|giao/i.test(k) ? 0 : /token/i.test(k) ? 1 : 2, v]);
        }
    }
    c.sort((a, b) => a[0] - b[0]);
    return c[0]?.[1] ?? null;
}
export const cfg = () => { const t = staffToken(); return { timeout: 15000, ...(t ? { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } } : {}) }; };
const d = (p: Promise<any>): Promise<any> =>
    p.then((r) => (r && typeof r === 'object' && 'status' in r && 'data' in r ? r.data : r));

const B = '/gv/attendance';
export const teacherAttendance = {
    lessons: (date: string) => d(api.get(`${B}/lessons`, { ...cfg(), params: { date } })),
    roster: (p: { class_subject_id: number; date: string; period: number }) => d(api.get(`${B}/roster`, { ...cfg(), params: p })),
    mark: (body: any) => d(api.post(`${B}/mark`, body, cfg())),
};