import api from '@/services/api';
import type {
    Appeal, AlertItem, Category, Commendation, DiscRecord, LogItem, Meta, Paged, ScoreInfo, Settings, StudentHit,
} from './types';

const B = '/discipline';
type P = Record<string, string | number | undefined | null>;
const clean = (p: P = {}) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v != null && v !== 0 && v !== '0'));
const get = <T,>(url: string, params?: P) => api.get<T>(B + url, { params: clean(params) }).then((r) => r.data);
const post = <T,>(url: string, body?: unknown) => api.post<T>(B + url, body).then((r) => r.data);

export const errMsg = (e: any): string => {
    const d = e?.response?.data;
    if (d?.errors) return Object.values(d.errors).flat()[0] as string;
    return d?.message || e?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
};

export const disciplineService = {
    meta: () => get<Meta>('/meta'),
    overview: (p: P) => get<any>('/overview', p),
    alerts: () => get<{ alerts: AlertItem[]; total: number }>('/alerts'),
    logs: (p: P) => get<Paged<LogItem>>('/logs', p),
    classReport: (p: P) => get<any[]>('/reports/classes', p),
    exportCsv: async (p: P) => {
        const r = await api.get(B + '/export', { params: clean(p), responseType: 'blob' });
        const url = URL.createObjectURL(r.data);
        const a = document.createElement('a'); a.href = url; a.download = `ky-luat-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
    },

    searchStudents: (q: string, p: P = {}) => get<StudentHit[]>('/students/search', { q, ...p }),
    studentProfile: (id: number, p: P) => get<any>(`/students/${id}/profile`, p),
    applyConduct: (id: number, body: { year_id: number; semester: number }) => post<any>(`/students/${id}/apply-conduct`, body),

    records: (p: P) => get<Paged<DiscRecord>>('/records', p),
    record: (id: number) => get<{ record: DiscRecord; logs: LogItem[]; appeals: Appeal[]; student_score: ScoreInfo; prior_count: number }>(`/records/${id}`),
    createRecord: (b: unknown) => post<any>('/records', b),
    updateRecord: (id: number, b: unknown) => api.put(`${B}/records/${id}`, b).then((r) => r.data),
    deleteRecord: (id: number) => api.delete(`${B}/records/${id}`).then((r) => r.data),
    review: (id: number, decision: 'approve' | 'reject', note?: string) => post<any>(`/records/${id}/review`, { decision, note }),
    resolve: (id: number, b: unknown) => post<any>(`/records/${id}/resolve`, b),
    cancel: (id: number, note: string) => post<any>(`/records/${id}/cancel`, { note }),

    commendations: (p: P) => get<Paged<Commendation>>('/commendations', p),
    createCommendation: (b: unknown) => post<any>('/commendations', b),
    reviewCommendation: (id: number, decision: 'approve' | 'reject', note?: string) => post<any>(`/commendations/${id}/review`, { decision, note }),

    appeals: (p: P) => get<Paged<Appeal>>('/appeals', p),
    createAppeal: (b: { record_id: number; reason: string }) => post<any>('/appeals', b),
    respondAppeal: (id: number, decision: 'accept' | 'reject', response: string) => post<any>(`/appeals/${id}/respond`, { decision, response }),

    categories: () => get<Category[]>('/categories'),
    saveCategory: (b: Partial<Category>) => (b.id ? api.put(`${B}/categories/${b.id}`, b).then((r) => r.data) : post<any>('/categories', b)),
    deleteCategory: (id: number) => api.delete(`${B}/categories/${id}`).then((r) => r.data),
    settings: () => get<Settings>('/settings'),
    saveSettings: (b: Settings) => api.put(`${B}/settings`, b).then((r) => r.data),
};