import api from '@/services/api';

export type Status = 'pending' | 'approved' | 'rejected' | 'returned' | 'cancelled';
export type Action = 'approve' | 'reject' | 'return' | 'forward';
export type Priority = 'normal' | 'high' | 'urgent';

export interface Row {
    id: number; code: string; type_code: string; type_name: string; icon: string; title: string;
    requester_kind: string; requester_name: string; requester_info: string | null; priority: Priority; status: Status;
    current_level: 'vice_principal' | 'principal'; due_at: string; due_min: number; created_at: string;
    decided_at: string | null; amount: number | null;
}
export interface Counts { todo: number; waiting: number; approved: number; rejected: number; returned: number; total: number; overdue: number }
export interface Me { id: number; role: string; name: string }
export interface Overview {
    me: Me; counts: Counts; approved_today: number; approval_rate: number | null; avg_hours: number | null;
    by_type: { code: string; name: string; icon: string; pending: number; total: number }[];
    recent: { id: number; action: string; actor_name: string; note: string | null; created_at: string; request_id: number; code: string; title: string }[];
}
export interface EventRow { id: number; actor_type: string; actor_name: string; action: string; note: string | null; created_at: string }
export interface Detail extends Row {
    description: string | null; payload: { label: string; value: string }[]; ref_table: string | null; ref_id: number | null;
    decision_note: string | null; decided_by_name: string | null; events: EventRow[];
    attachments: { id: number; name: string; url: string; size_kb: number | null }[]; can_decide: boolean; actions: Action[];
}
export interface TypeRow { code: string; name: string; description: string | null; icon: string; sla_hours: number; approver_role: string; is_active: number | boolean; pending: number; total: number }
export interface Delegation { id: number; from_date: string; to_date: string; reason: string | null; is_active: number; from_name: string; to_name: string; running: number }
export interface Report {
    from: string; to: string;
    summary: { total: number; approved: number; rejected: number; pending: number; overdue: number; approved_amount: number };
    by_type: { name: string; total: number; approved: number; rejected: number; returned: number; pending: number; avg_hours: number | null }[];
    by_approver: { name: string; role: string; decided: number; approved: number; rejected: number; returned: number }[];
    trend: { m: string; total: number; approved: number; rejected: number }[];
}

/** Token của cổng nhân sự: ưu tiên khóa "token" do trang đăng nhập lưu */
function staffToken(): string | null {
    if (typeof window === 'undefined') return null;
    const ok = (v: string | null) => (v && /^[A-Za-z0-9|._-]{20,300}$/.test(v) ? v : null);
    const direct = ok(window.localStorage.getItem('token')) || ok(window.sessionStorage.getItem('token'));
    if (direct) return direct;
    for (const st of [window.localStorage, window.sessionStorage]) {
        for (let i = 0; i < st.length; i++) {
            const k = st.key(i) as string;
            if (/token/i.test(k) && ok(st.getItem(k))) return st.getItem(k);
        }
    }
    return null;
}
const cfg = (extra?: object) => {
    const t = staffToken();
    return { timeout: 20000, ...(t ? { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } } : {}), ...extra };
};
const unwrap = (p: Promise<any>): Promise<any> =>
    p.then((r) => (r && typeof r === 'object' && 'status' in r && 'data' in r ? r.data : r));
const B = '/gv/approvals';

export const approvals = {
    overview: () => unwrap(api.get(`${B}/overview`, cfg())),
    list: (params: object) => unwrap(api.get(B, { ...cfg(), params })),
    show: (id: number) => unwrap(api.get(`${B}/${id}`, cfg())),
    decide: (id: number, body: { action: Action; note?: string }) => unwrap(api.post(`${B}/${id}/decide`, body, cfg())),
    comment: (id: number, note: string) => unwrap(api.post(`${B}/${id}/comment`, { note }, cfg())),
    bulk: (body: { ids: number[]; action: 'approve' | 'reject'; note?: string }) => unwrap(api.post(`${B}/bulk`, body, cfg())),
    templates: () => unwrap(api.get(`${B}/templates`, cfg())),
    sync: () => unwrap(api.post(`${B}/sync`, {}, cfg())),
    types: () => unwrap(api.get(`${B}/types`, cfg())),
    updateType: (code: string, body: { sla_hours?: number; approver_role?: string; is_active?: boolean }) => unwrap(api.put(`${B}/types/${code}`, body, cfg())),
    delegations: () => unwrap(api.get(`${B}/delegations`, cfg())),
    staff: () => unwrap(api.get(`${B}/staff`, cfg())),
    createDelegation: (body: { to_staff_id: number; from_date: string; to_date: string; reason?: string }) => unwrap(api.post(`${B}/delegations`, body, cfg())),
    revokeDelegation: (id: number) => unwrap(api.delete(`${B}/delegations/${id}`, cfg())),
    report: (params: { from: string; to: string }) => unwrap(api.get(`${B}/report`, { ...cfg(), params })),
    exportCsv: async (p: { from: string; to: string }) => {
        const r: any = await api.get(`${B}/export`, { ...cfg(), params: p, responseType: 'blob' });
        const blob: Blob = r?.data instanceof Blob ? r.data : r;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `phe-duyet-${p.from}-${p.to}.csv`; a.click();
        URL.revokeObjectURL(url);
    },
};

/** Thông báo lỗi dễ hiểu từ phản hồi của API */
export function errMsg(e: unknown): string {
    const x = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
    const first = x?.errors ? Object.values(x.errors)[0]?.[0] : undefined;
    return first || x?.message || 'Không kết nối được máy chủ. Hãy thử lại sau ít phút.';
}