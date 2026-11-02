import api from '@/services/api';

/** Đường dẫn khu học sinh trong routes/api.php (alias v1 của hệ thống tự khớp cả /api lẫn /api/v1). */
const BASE = '/v1/hs/homework';

export type Status = 'todo' | 'overdue' | 'submitted' | 'graded' | 'returned';

export interface HomeworkItem {
    id: number; title: string; type: string; priority: string; max_score: number;
    assigned_at: string; due_at: string; allow_late: boolean;
    subject_id: number; subject: string; teacher: string;
    status: Status; is_late: boolean; score: number | null; submitted_at: string | null;
    starred: boolean; progress: number;
}
export interface Alert { id: string; kind: 'overdue' | 'soon' | 'graded' | 'returned'; text: string; homework_id: number }
export interface Summary {
    class: string | null;
    counts: Record<Status | 'total', number>;
    due_soon: number; avg_score: number | null; on_time_rate: number | null;
    by_subject: { subject_id: number; subject: string; total: number; done: number }[];
    alerts: Alert[];
}
export interface SubmissionFile { id: number; name: string; size_kb: number }
export interface Submission {
    status: 'submitted' | 'graded' | 'returned'; content: string | null; link_url: string | null;
    submitted_at: string; is_late: boolean; attempt: number; score: number | null;
    feedback: string | null; graded_at: string | null; files: SubmissionFile[];
}
export interface Detail extends HomeworkItem {
    description: string | null; notes: string | null;
    attachments: { id: number; name: string; url: string; size_kb: number | null }[];
    submission: Submission | null; can_submit: boolean; submit_block_reason: string | null; comments_count: number;
}
export interface Comment { id: number; author_type: 'student' | 'teacher'; author_name: string; body: string; created_at: string; mine: boolean }
export interface Meta { current_page: number; last_page: number; total: number; per_page: number }
export interface ListParams {
    status?: Status; subject_id?: number; q?: string; sort?: 'due' | 'newest' | 'subject';
    starred?: 1; page?: number; per_page?: number;
}
export interface StatePatch { starred?: boolean; progress?: number; notes?: string | null }

async function get<T>(url: string, params?: object): Promise<T> {
    const r = await api.get(url, { params });
    return r.data.data as T;
}

export const homeworkService = {
    summary: () => get<Summary>(`${BASE}/summary`),
    subjects: () => get<{ id: number; name: string }[]>(`${BASE}/subjects`),
    calendar: (month: string) => get<HomeworkItem[]>(`${BASE}/calendar`, { month }),
    list: async (params: ListParams) => {
        const r = await api.get(`${BASE}`, { params });
        return { items: r.data.data as HomeworkItem[], meta: r.data.meta as Meta };
    },
    detail: (id: number) => get<Detail>(`${BASE}/${id}`),
    submit: async (id: number, fd: FormData) =>
        (await api.post(`${BASE}/${id}/submit`, fd)).data.data as { submitted_at: string; is_late: boolean; attempt: number },
    saveState: async (id: number, body: StatePatch) =>
        (await api.put(`${BASE}/${id}/state`, body)).data.data as { starred: boolean; progress: number; notes: string | null },
    comments: (id: number) => get<Comment[]>(`${BASE}/${id}/comments`),
    addComment: async (id: number, body: string) => (await api.post(`${BASE}/${id}/comments`, { body })).data.data as Comment,
    download: async (fileId: number, name: string) => {
        const r = await api.get(`${BASE}/files/${fileId}`, { responseType: 'blob' });
        const url = URL.createObjectURL(r.data as Blob);
        const a = document.createElement('a');
        a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
    },
};

/** Lấy thông báo lỗi dễ hiểu từ phản hồi của API (ưu tiên lỗi kiểm tra dữ liệu đầu tiên). */
export function errorMessage(e: unknown): string {
    const d = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
    const first = d?.errors ? Object.values(d.errors)[0]?.[0] : undefined;
    return first || d?.message || 'Không kết nối được máy chủ. Hãy thử lại sau ít phút.';
}