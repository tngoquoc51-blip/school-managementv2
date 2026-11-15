import api from '@/services/api';
import type {
    ActivityRow, ClassRank, Meta, Overview, Proposal, RecordPage, Scope, StudentDetail, StudentRow, SuggestionItem,
} from './types';

const qs = (s: Scope, extra: Record<string, unknown> = {}) => ({
    class_id: s.classId ?? undefined, semester: s.semester, ...extra,
});

async function get<T>(url: string, params: Record<string, unknown>): Promise<T> {
    const r = await api.get(`/homeroom/emulation/${url}`, { params });
    return r.data.data as T;
}
async function send<T>(method: 'post' | 'put' | 'delete', url: string, s: Scope, body?: unknown): Promise<T> {
    const r = await api.request({ method, url: `/homeroom/emulation/${url}`, data: body, params: { class_id: s.classId ?? undefined } });
    return r.data.data as T;
}

/** Lấy thông báo lỗi thân thiện từ phản hồi của Laravel */
export function errMsg(e: any): string {
    const d = e?.response?.data;
    if (d?.errors && typeof d.errors === 'object') {
        const first = Object.values(d.errors as Record<string, string[]>)[0];
        if (first?.[0]) return first[0];
    }
    if (d?.message) return d.message;
    if (e?.code === 'ERR_NETWORK') return 'Không kết nối được máy chủ API. Hãy kiểm tra Laragon đang chạy.';
    return e?.message || 'Đã có lỗi xảy ra.';
}

export const emuApi = {
    meta: (s: Scope) => get<Meta>('meta', qs(s)),
    overview: (s: Scope) => get<Overview>('overview', qs(s)),
    students: (s: Scope) => get<StudentRow[]>('students', qs(s)),
    student: (s: Scope, id: number) => get<StudentDetail>(`students/${id}`, qs(s)),
    classRanking: (s: Scope) => get<ClassRank[]>('class-ranking', qs(s)),
    activity: (s: Scope, limit = 60) => get<ActivityRow[]>('activity', qs(s, { limit })),

    records: (s: Scope, f: Record<string, unknown>) => get<RecordPage>('records', qs(s, f)),
    addRecords: (s: Scope, body: { student_ids: number[]; criterion_id: number; points?: number | null; record_date: string; note?: string }) =>
        send<{ created: number; points: number; semester: number }>('post', 'records', s, body),
    voidRecord: (s: Scope, id: number) => send<null>('delete', `records/${id}`, s),
    restoreRecord: (s: Scope, id: number) => send<null>('post', `records/${id}/restore`, s),

    suggestions: (s: Scope) => get<SuggestionItem[]>('suggestions', qs(s)),
    proposals: (s: Scope) => get<Proposal[]>('proposals', qs(s)),
    addProposals: (s: Scope, items: { student_id: number; award_id: number; reason?: string }[]) =>
        send<{ created: number; skipped: number }>('post', 'proposals', s, { semester: s.semester, items }),
    editProposal: (s: Scope, id: number, reason: string) => send<null>('put', `proposals/${id}`, s, { reason }),
    submitProposals: (s: Scope, ids: number[]) => send<{ submitted: number }>('post', 'proposals/submit', s, { ids }),
    cancelProposal: (s: Scope, id: number) => send<null>('post', `proposals/${id}/cancel`, s),
    deleteProposal: (s: Scope, id: number) => send<null>('delete', `proposals/${id}`, s),
    review: (s: Scope, id: number, body: { decision: 'approved' | 'rejected'; note?: string; decision_no?: string }) =>
        send<null>('post', `proposals/${id}/review`, s, body),

    saveCriterion: (s: Scope, id: number | null, body: { name: string; category: string; points: number; is_active: boolean }) =>
        send<null>(id ? 'put' : 'post', id ? `criteria/${id}` : 'criteria', s, body),
};