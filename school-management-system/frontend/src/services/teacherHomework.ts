import api from '@/services/api';
import { cfg } from '@/services/teacherAttendance';

const d = (p: Promise<any>): Promise<any> =>
    p.then((r) => (r && typeof r === 'object' && 'status' in r && 'data' in r ? r.data : r));
const B = '/gv/teacher/homework';

export interface HomeworkBody {
    class_subject_id?: number; title?: string; description?: string | null; type?: string; priority?: string;
    max_score?: number; due_at?: string; allow_late?: boolean; status?: 'draft' | 'published';
}

export const teacherHomework = {
    list: (params: { class_subject_id?: number; status?: string; page?: number }) => d(api.get(B, { ...cfg(), params })),
    show: (id: number) => d(api.get(`${B}/${id}`, cfg())),
    create: (body: HomeworkBody) => d(api.post(B, body, cfg())),
    update: (id: number, body: HomeworkBody) => d(api.put(`${B}/${id}`, body, cfg())),
    remove: (id: number) => d(api.delete(`${B}/${id}`, cfg())),
    submissions: (id: number) => d(api.get(`${B}/${id}/submissions`, cfg())),
    grade: (submissionId: number, body: { action: 'grade' | 'return'; score?: number; feedback?: string }) =>
        d(api.post(`${B}/submissions/${submissionId}/grade`, body, cfg())),
    download: async (fileId: number, name: string) => {
        const r: any = await api.get(`${B}/files/${fileId}`, { ...cfg(), responseType: 'blob' });
        const blob: Blob = r?.data instanceof Blob ? r.data : r;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
    },
};

/** Thông báo lỗi dễ hiểu từ phản hồi của API (ưu tiên lỗi kiểm tra dữ liệu đầu tiên). */
export function errorMessage(e: unknown): string {
    const x = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
    const first = x?.errors ? Object.values(x.errors)[0]?.[0] : undefined;
    return first || x?.message || 'Không kết nối được máy chủ. Hãy thử lại sau ít phút.';
}