import api from '@/services/api';
import type { Filters, HistoryRow, InsightRow, Meta, Overview, Page, Roster, SaveItem, StudentDetail, Template } from '@/modules/teacher/comments/types';

const B = '/gv/teacher/comments';
type Params = Record<string, string | number | undefined>;
const unwrap = <T,>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export function apiError(e: any): { message: string; fields: Record<string, string> } {
    const d = e?.response?.data;
    const fields: Record<string, string> = {};
    if (d?.errors) Object.entries(d.errors).forEach(([k, v]) => (fields[k] = Array.isArray(v) ? String(v[0]) : String(v)));
    const first = Object.values(fields)[0];
    const status = e?.response?.status;
    const msg = status === 403 ? (d?.message || 'Bạn không có quyền thực hiện chức năng này.') : first || d?.message || (e?.code === 'ERR_NETWORK' ? 'Không kết nối được máy chủ.' : 'Đã có lỗi xảy ra.');
    return { message: msg, fields };
}

/** Tham số chung theo bộ lọc lớp–môn / học kỳ / kỳ nhận xét */
export const rp = (f: Filters): Params => ({ class_subject_id: f.cs, semester: f.semester, kind: f.kind, period: f.period });

export const cmtApi = {
    meta: () => unwrap<Meta>(api.get(`${B}/meta`)),
    overview: (f: Filters) => unwrap<Overview>(api.get(`${B}/overview`, { params: { semester: f.semester, kind: f.kind, period: f.period } })),
    roster: (f: Filters) => unwrap<Roster>(api.get(`${B}/roster`, { params: rp(f) })),
    insights: (f: Filters, all: boolean) => unwrap<InsightRow[]>(api.get(`${B}/insights`, { params: { ...rp(f), class_subject_id: all ? 0 : f.cs } })),
    student: (id: number, cs: number) => unwrap<StudentDetail>(api.get(`${B}/student/${id}`, { params: { class_subject_id: cs } })),
    history: (p: Params) => unwrap<Page<HistoryRow>>(api.get(`${B}/history`, { params: p })),
    exportCsv: async (p: Params) => {
        const r = await api.get(`${B}/export`, { params: p, responseType: 'blob' });
        const url = URL.createObjectURL(r.data as Blob);
        const a = document.createElement('a'); a.href = url; a.download = `nhan-xet-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    },

    save: (item: SaveItem) => api.put(`${B}/item`, item),
    bulk: (items: SaveItem[]) => api.post(`${B}/bulk`, { items }),
    setStatus: (f: Filters, to: 'draft' | 'published') => unwrap<{ changed: number }>(api.post(`${B}/status`, { ...rp(f), to })),
    remove: (id: number) => api.delete(`${B}/item/${id}`),

    templates: (rating = '') => unwrap<Template[]>(api.get(`${B}/templates`, { params: { rating } })),
    saveTemplate: (body: { rating: string; title: string; body: string }, id?: number) => (id ? api.put(`${B}/templates/${id}`, body) : api.post(`${B}/templates`, body)),
    deleteTemplate: (id: number) => api.delete(`${B}/templates/${id}`),
    useTemplate: (id: number) => api.post(`${B}/templates/${id}/use`).catch(() => undefined),
};