/* Gọi API môn học bằng fetch + token đăng nhập admin (tự dò trong localStorage / sessionStorage). */
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

export interface Subject {
    id: number; code: string; name: string; kind: string; periods_per_week: number; sort_order: number;
    department: string; description: string; color: string; is_active: number | string;
    classes_count?: number | string; teachers_count?: number | string; main_teachers?: number | string;
}
export interface SubjectStats { total: number; active: number; periods: number; unassigned: number; departments: { name: string; c: number | string }[] }
export interface Assignment { id: number; class_id: number; class_name: string; grade: number; teacher_id: number; teacher_name: string; slots: number | string }
export interface SubjectDetail { subject: Subject; assignments: Assignment[] }
export interface ClassOpt { id: number; name: string; grade: number }
export interface TeacherOpt { id: number; code: string; full_name: string; main_subject_id: number }
export interface SubjectForm { code: string; name: string; kind: string; periods_per_week: number; sort_order: number; department: string; description: string; color: string; is_active: boolean }

export class ApiError extends Error { constructor(m: string, public status: number) { super(m); } }

const clean = (v: string | null) => (v ? v.replace(/^"|"$/g, '') : '');
function collect(node: unknown, out: string[], hint = ''): void {
    if (typeof node === 'string') { if (/token/i.test(hint) && node.length > 5) out.push(node); return; }
    if (Array.isArray(node)) { node.forEach((x) => collect(x, out, hint)); return; }
    if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => collect(v, out, k));
}
function tokens(): string[] {
    if (typeof window === 'undefined') return [];
    const out: string[] = [];
    for (const s of [localStorage, sessionStorage]) {
        for (let i = 0; i < s.length; i++) {
            const k = s.key(i) ?? ''; const raw = s.getItem(k) ?? '';
            if (/token/i.test(k) && !/^[{[]/.test(raw.trim()) && clean(raw).length > 5) out.push(clean(raw));
            else if (/^[{[]/.test(raw.trim())) { try { collect(JSON.parse(raw), out); } catch { /* bỏ qua */ } }
        }
    }
    return Array.from(new Set(out));
}
let working = '';

async function call<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    let last: { res: Response; json: any } | null = null;
    for (const tk of Array.from(new Set([working, ...tokens()].filter(Boolean))).concat(working || tokens().length ? [] : [''])) {
        const res = await fetch(`${BASE}/admin/subjects${path}${qs}`, {
            method, body: body === undefined ? undefined : JSON.stringify(body),
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

export const subjectApi = {
    list: (p: { q: string; dept: string; status: string }) => call<{ data: Subject[] }>('GET', '', undefined, p).then((r) => r.data),
    stats: () => call<{ data: SubjectStats }>('GET', '/stats').then((r) => r.data),
    meta: () => call<{ data: { classes: ClassOpt[]; teachers: TeacherOpt[] } }>('GET', '/meta').then((r) => r.data),
    show: (id: number) => call<{ data: SubjectDetail }>('GET', `/${id}`).then((r) => r.data),
    create: (b: SubjectForm) => call<{ message: string }>('POST', '', b).then((r) => r.message),
    update: (id: number, b: SubjectForm) => call<{ message: string }>('PUT', `/${id}`, b).then((r) => r.message),
    remove: (id: number) => call<{ message: string }>('DELETE', `/${id}`).then((r) => r.message),
    toggle: (id: number) => call<{ message: string }>('POST', `/${id}/toggle`).then((r) => r.message),
    assign: (id: number, class_id: number, teacher_id: number) => call<{ message: string }>('POST', `/${id}/assign`, { class_id, teacher_id }).then((r) => r.message),
    reassign: (id: number, csid: number, teacher_id: number) => call<{ message: string }>('PUT', `/${id}/assign/${csid}`, { teacher_id }).then((r) => r.message),
    unassign: (id: number, csid: number) => call<{ message: string }>('DELETE', `/${id}/assign/${csid}`).then((r) => r.message),
};