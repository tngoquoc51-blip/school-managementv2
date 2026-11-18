import api from '@/services/api';
import type { AuditRow, DebtNote, DebtsPage, DisputeRow, FeeItem, InvoiceDetail, InvoiceRow, Meta, Overview, Page, PaymentsPage, PeriodRow, WaiversData } from '@/modules/admin/finance/types';

const B = '/admin/finance';
type Params = Record<string, string | number | undefined>;
const unwrap = <T,>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

/** Lấy thông báo lỗi + lỗi theo từng trường từ response Laravel */
export function apiError(e: any): { message: string; fields: Record<string, string> } {
    const d = e?.response?.data;
    const fields: Record<string, string> = {};
    if (d?.errors) Object.entries(d.errors).forEach(([k, v]) => (fields[k] = Array.isArray(v) ? String(v[0]) : String(v)));
    const first = Object.values(fields)[0];
    const status = e?.response?.status;
    const msg = status === 403 ? 'Bạn không có quyền truy cập chức năng này.' : first || d?.message || (e?.code === 'ERR_NETWORK' ? 'Không kết nối được máy chủ.' : 'Đã có lỗi xảy ra.');
    return { message: msg, fields };
}

export const finApi = {
    meta: () => unwrap<Meta>(api.get(`${B}/meta`)),
    overview: (p: Params) => unwrap<Overview>(api.get(`${B}/overview`, { params: p })),

    invoices: (p: Params) => unwrap<Page<InvoiceRow>>(api.get(`${B}/invoices`, { params: p })),
    invoice: (id: number) => unwrap<InvoiceDetail>(api.get(`${B}/invoices/${id}`)),

    payments: (p: Params) => unwrap<PaymentsPage>(api.get(`${B}/payments`, { params: p })),
    confirmPayment: (id: number) => api.post(`${B}/payments/${id}/confirm`),
    rejectPayment: (id: number, reason: string) => api.post(`${B}/payments/${id}/reject`, { reason }),

    debts: (p: Params) => unwrap<DebtsPage>(api.get(`${B}/debts`, { params: p })),
    exportDebts: async (p: Params) => {
        const r = await api.get(`${B}/debts/export`, { params: p, responseType: 'blob' });
        const url = URL.createObjectURL(r.data as Blob);
        const a = document.createElement('a'); a.href = url; a.download = `cong-no-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    },
    notes: (studentId: number) => unwrap<DebtNote[]>(api.get(`${B}/debts/${studentId}/notes`)),
    addNote: (studentId: number, body: Record<string, unknown>) => unwrap<DebtNote>(api.post(`${B}/debts/${studentId}/notes`, body)),
    resolveNote: (id: number, status: 'kept' | 'broken' | 'cancelled') => api.post(`${B}/debts/notes/${id}/resolve`, { status }),

    periods: (year_id: number) => unwrap<PeriodRow[]>(api.get(`${B}/periods`, { params: { year_id } })),
    setPeriodStatus: (id: number, status: 'open' | 'closed') => api.post(`${B}/periods/${id}/status`, { status }),
    feeItems: () => unwrap<FeeItem[]>(api.get(`${B}/fee-items`)),

    waivers: (p: Params) => unwrap<WaiversData>(api.get(`${B}/waivers`, { params: p })),
    disputes: (p: Params) => unwrap<DisputeRow[]>(api.get(`${B}/disputes`, { params: p })),
    replyDispute: (id: number, reply: string) => api.post(`${B}/disputes/${id}/reply`, { reply }),

    audit: () => unwrap<AuditRow[]>(api.get(`${B}/audit`)),
};