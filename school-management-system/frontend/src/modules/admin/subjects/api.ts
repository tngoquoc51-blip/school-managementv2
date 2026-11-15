import api from '@/services/api';
import type * as T from './types';

const B = '/subject';
const d = <R,>(p: Promise<{ data: { data: R } }>): Promise<R> => p.then((r) => r.data.data);

export function errMsg(e: unknown): string {
    const x = e as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } }; message?: string };
    if (!x?.response) return 'Không kết nối được máy chủ. Kiểm tra Laragon (Apache/MySQL) và php artisan serve.';
    const errs = x.response.data?.errors;
    if (errs && typeof errs === 'object' && !Array.isArray(errs)) {
        const first = Object.values(errs)[0];
        if (Array.isArray(first) && first[0]) return first[0];
    }
    if (x.response.status === 401) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
    if (x.response.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
    return x.response.data?.message || x.message || 'Có lỗi xảy ra';
}
export function fieldErrors(e: unknown): Record<string, string> {
    const errs = (e as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors;
    const out: Record<string, string> = {};
    if (errs && typeof errs === 'object' && !Array.isArray(errs)) for (const k of Object.keys(errs)) if (Array.isArray(errs[k])) out[k] = errs[k][0];
    return out;
}
export function usageOf(e: unknown): T.SubjectDetail['usage'] | null {
    const u = (e as { response?: { data?: { errors?: unknown } } })?.response?.data?.errors;
    return u && typeof u === 'object' && 'class_subjects' in (u as object) ? (u as T.SubjectDetail['usage']) : null;
}
const q = (o: Record<string, unknown>) => ({ params: Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null)) });

export const subjectApi = {
    meta: () => d<T.Meta>(api.get(`${B}/meta`)),
    overview: (y: number) => d<T.Overview>(api.get(`${B}/overview`, q({ school_year_id: y }))),
    integrity: (y: number) => d<T.Integrity>(api.get(`${B}/integrity`, q({ school_year_id: y }))),
    analytics: (y: number, semester?: number) => d<T.Analytics>(api.get(`${B}/analytics`, q({ school_year_id: y, semester }))),
    list: (p: Record<string, unknown>) => d<T.Paged<T.Subject>>(api.get(`${B}/subjects`, q(p))),
    detail: (id: number, y: number) => d<T.SubjectDetail>(api.get(`${B}/subjects/${id}`, q({ school_year_id: y }))),
    create: (b: unknown) => d<T.SubjectDetail>(api.post(`${B}/subjects`, b)),
    update: (id: number, b: unknown) => d<T.SubjectDetail>(api.put(`${B}/subjects/${id}`, b)),
    remove: (id: number) => d<null>(api.delete(`${B}/subjects/${id}`)),
    bulk: (action: string, ids: number[]) => d<{ done: number; skipped: number[] }>(api.post(`${B}/subjects/bulk`, { action, ids })),
    duplicate: (id: number) => d<T.SubjectDetail>(api.post(`${B}/subjects/${id}/duplicate`)),
    reorder: (ids: number[]) => d<null>(api.post(`${B}/subjects/reorder`, { ids })),
    exportRows: () => d<Record<string, unknown>[]>(api.get(`${B}/subjects/export`)),
    importRows: (rows: unknown[], dry_run: boolean) => d<T.ImportReport>(api.post(`${B}/subjects/import`, { rows, dry_run })),
    groups: () => d<{ groups: T.Group[]; ungrouped: { id: number; code: string; name: string; color: string }[] }>(api.get(`${B}/groups`)),
    saveGroup: (id: number | null, b: unknown) => (id ? api.put(`${B}/groups/${id}`, b) : api.post(`${B}/groups`, b)).then((r) => r.data),
    removeGroup: (id: number) => api.delete(`${B}/groups/${id}`).then((r) => r.data),
    matrix: (y: number, grade?: number) => d<T.Matrix>(api.get(`${B}/assignments`, q({ school_year_id: y, grade }))),
    assign: (b: { class_id: number; subject_id: number; teacher_id: number }) => d<{ id: number; warnings: string[]; load: number; quota: number }>(api.put(`${B}/assignments`, b)),
    assignMany: (b: { subject_id: number; teacher_id: number; class_ids: number[] }) => d<{ assigned: number; errors: string[]; warnings: string[] }>(api.post(`${B}/assignments/bulk`, b)),
    unassign: (id: number, force = false) => d<{ removed_slots: number }>(api.delete(`${B}/assignments/${id}`, q({ force: force ? 1 : '' }))),
    auto: (y: number, grade: number | undefined, dry_run: boolean) => d<T.AutoPlan>(api.post(`${B}/assignments/auto`, { school_year_id: y, grade, dry_run })),
    copyAssign: (from_year_id: number, to_year_id: number) => d<{ copied: number }>(api.post(`${B}/assignments/copy`, { from_year_id, to_year_id })),
    workload: (y: number) => d<T.Workload>(api.get(`${B}/workload`, q({ school_year_id: y }))),
    curriculum: () => d<T.Curriculum[]>(api.get(`${B}/curriculum`)),
    saveCurriculum: (id: number, rows: T.Curriculum[]) => d<T.Curriculum[]>(api.put(`${B}/curriculum/${id}`, { rows })),
    audit: (action?: string) => d<T.AuditRow[]>(api.get(`${B}/audit`, q({ action, limit: 100 }))),
};