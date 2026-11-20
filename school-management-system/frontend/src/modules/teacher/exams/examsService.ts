import api from '@/services/api';
import type {
    ActivityRow, Analytics, CalEvent, Generated, Matrix, Meta, Overview, PaperFull, PaperRow, QuestionPage, Question, Sheet, TestRow,
} from './types';

const BASE = '/gv/teacher/exams';

async function get<T>(url: string, params: Record<string, unknown> = {}): Promise<T> {
    const r = await api.get(`${BASE}/${url}`, { params });
    return r.data.data as T;
}
async function send<T>(method: 'post' | 'put' | 'delete', url: string, body?: unknown): Promise<T> {
    const r = await api.request({ method, url: `${BASE}/${url}`, data: body });
    return r.data.data as T;
}

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

export type TestPayload = {
    class_id?: number; subject_id?: number; title: string; kind: string; grade_column: string; test_date: string;
    start_time: string | null; duration_minutes: number; max_score: number; paper_id: number | null; note: string; status?: string;
};
export type QuestionPayload = {
    subject_id: number; grade: number; kind: string; difficulty: string; topic: string; content: string;
    options: string[]; answer: string; points: number; is_active: boolean;
};

export const examApi = {
    meta: () => get<Meta>('meta'),
    overview: (semester: number) => get<Overview>('overview', { semester }),
    calendar: (from: string, to: string) => get<CalEvent[]>('calendar', { from, to }),
    activity: () => get<ActivityRow[]>('activity'),

    tests: (f: Record<string, unknown>) => get<TestRow[]>('tests', f),
    createTest: (b: TestPayload) => send<{ id: number }>('post', 'tests', b),
    updateTest: (id: number, b: TestPayload) => send<null>('put', `tests/${id}`, b),
    deleteTest: (id: number) => send<null>('delete', `tests/${id}`),
    sheet: (id: number) => get<Sheet>(`tests/${id}/sheet`),
    saveScores: (id: number, rows: { student_id: number; score: number | null; absent: boolean; note?: string | null }[]) =>
        send<{ saved: number }>('put', `tests/${id}/scores`, { rows }),
    setStatus: (id: number, status: 'grading' | 'scheduled' | 'done') => send<null>('post', `tests/${id}/status`, { status }),
    sync: (id: number) => send<{ updated: number; inserted: number; column: string }>('post', `tests/${id}/sync`),
    analytics: (id: number) => get<Analytics>(`tests/${id}/analytics`),
    matrix: (classId: number, subjectId: number, semester: number) => get<Matrix>('analytics/matrix', { class_id: classId, subject_id: subjectId, semester }),

    questions: (f: Record<string, unknown>) => get<QuestionPage>('questions', f),
    createQuestion: (b: QuestionPayload) => send<{ id: number }>('post', 'questions', b),
    updateQuestion: (id: number, b: QuestionPayload) => send<null>('put', `questions/${id}`, b),
    deleteQuestion: (id: number) => send<null>('delete', `questions/${id}`),

    generate: (b: { subject_id: number; grade: number; matrix: Record<string, number>; kinds: string[]; topic?: string; exclude?: number[] }) =>
        send<Generated>('post', 'papers/generate', b),
    papers: () => get<PaperRow[]>('papers'),
    savePaper: (b: { title: string; subject_id: number; grade: number; duration_minutes: number; items: { question_id: number; points: number }[] }) =>
        send<{ id: number; total_points: number }>('post', 'papers', b),
    paper: (id: number) => get<PaperFull>(`papers/${id}`),
    deletePaper: (id: number) => send<null>('delete', `papers/${id}`),
};

export type { Question };