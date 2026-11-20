import api from '@/services/api';
import type { Impact, InvoiceChange, LogRow, Meta, Paged, Stats, StudentHit, WRecord, WRequest, WType } from './types';

const B = '/waiver';
const get = async <T,>(url: string, params?: object): Promise<T> => (await api.get(B + url, { params })).data.data;
const post = async <T,>(url: string, body?: object): Promise<T> => (await api.post(B + url, body)).data.data;

/** Lấy thông báo lỗi dễ đọc từ phản hồi của Laravel */
export function errMsg(e: any): string {
    const d = e?.response?.data;
    const first = d?.errors && (Object.values(d.errors)[0] as any)?.[0];
    return first || d?.message || e?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
}

const clean = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));

export const wApi = {
    meta: () => get<Meta>('/meta'),
    stats: (school_year_id: number) => get<Stats>('/stats', { school_year_id }),

    requests: (f: Record<string, any>) => get<Paged<WRequest>>('/requests', clean(f)),
    request: (id: number) => get<{ request: WRequest; history: LogRow[]; active_waivers: { id: number; label: string; percent: number; terms: string }[]; impact: Impact }>(`/requests/${id}`),
    createRequest: (b: object) => post<{ id: number; code: string; approved: boolean; invoices: InvoiceChange[] | null }>('/requests', b),
    approve: (id: number, note?: string, apply_invoices?: boolean) => post<{ waiver_id: number; invoices: InvoiceChange[] | null }>(`/requests/${id}/approve`, { note, apply_invoices }),
    reject: (id: number, note: string) => post(`/requests/${id}/reject`, { note }),
    cancel: (id: number) => post(`/requests/${id}/cancel`),
    bulkApprove: (ids: number[], note?: string) => post<{ approved: number; errors: string[] }>('/requests/bulk-approve', { ids, note }),

    records: (f: Record<string, any>) => get<Paged<WRecord>>('/records', clean(f)),
    revoke: (id: number, reason: string) => post<{ invoices: InvoiceChange[] | null }>(`/records/${id}/revoke`, { reason }),
    recalc: (student_id: number, school_year_id: number, apply: boolean) => post<InvoiceChange[]>('/recalc', { student_id, school_year_id, apply }),

    searchStudents: (q: string, school_year_id: number) => get<StudentHit[]>('/students/search', { q, school_year_id }),
    impact: (student_id: number, school_year_id: number, percent: number, terms: string[]) =>
        get<Impact>('/impact', { student_id, school_year_id, percent, terms }),

    types: () => get<WType[]>('/types'),
    saveType: (t: Partial<WType>) => (t.id ? api.put(`${B}/types/${t.id}`, t) : api.post(`${B}/types`, t)).then((r) => r.data.data),
    toggleType: (id: number) => api.patch(`${B}/types/${id}/toggle`).then((r) => r.data.data as { is_active: number }),

    logs: (f: Record<string, any>) => get<Paged<LogRow>>('/logs', clean(f)),

    /** Tải CSV (cần gửi kèm token nên dùng blob) */
    async exportCsv(what: 'records' | 'requests', school_year_id: number) {
        const res = await api.get(`${B}/export`, { params: { what, school_year_id }, responseType: 'blob' });
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url; a.download = `mien-giam-hoc-phi-${what}.csv`; a.click();
        URL.revokeObjectURL(url);
    },
};