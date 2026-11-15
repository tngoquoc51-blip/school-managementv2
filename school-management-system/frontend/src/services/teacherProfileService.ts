import api from '@/services/api';
import type { ActivityPage, ChangeRequest, LoginEntry, Overview, Qualification, Session, Settings, Teaching } from '@/modules/teacher/profile/types';

const B = '/gv/teacher/profile';
const unwrap = <T,>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

/** Lấy thông báo lỗi + lỗi theo từng trường từ response Laravel */
export function apiError(e: any): { message: string; fields: Record<string, string> } {
    const d = e?.response?.data;
    const fields: Record<string, string> = {};
    if (d?.errors) Object.entries(d.errors).forEach(([k, v]) => (fields[k] = Array.isArray(v) ? String(v[0]) : String(v)));
    const first = Object.values(fields)[0];
    return { message: first || d?.message || (e?.code === 'ERR_NETWORK' ? 'Không kết nối được máy chủ.' : 'Đã có lỗi xảy ra.'), fields };
}

export const profileApi = {
    overview: () => unwrap<Overview>(api.get(`${B}/overview`)),
    teaching: () => unwrap<Teaching>(api.get(`${B}/teaching`)),
    updateInfo: (body: Record<string, unknown>) => unwrap<Overview>(api.put(`${B}/info`, body)),
    uploadAvatar: (file: File) => { const f = new FormData(); f.append('avatar', file); return unwrap<{ avatar: string }>(api.post(`${B}/avatar`, f)); },

    qualifications: () => unwrap<Qualification[]>(api.get(`${B}/qualifications`)),
    saveQualification: (body: Partial<Qualification>, id?: number) => unwrap<Qualification>(id ? api.put(`${B}/qualifications/${id}`, body) : api.post(`${B}/qualifications`, body)),
    deleteQualification: (id: number) => api.delete(`${B}/qualifications/${id}`),

    requests: () => unwrap<ChangeRequest[]>(api.get(`${B}/requests`)),
    createRequest: (body: { field_key: string; new_value: string; reason: string }) => unwrap<ChangeRequest>(api.post(`${B}/requests`, body)),
    cancelRequest: (id: number) => api.delete(`${B}/requests/${id}`),

    changePassword: (body: { current_password: string; password: string; password_confirmation: string }) => api.post(`${B}/password`, body),
    sessions: () => unwrap<Session[]>(api.get(`${B}/sessions`)),
    revokeSession: (id: number) => api.delete(`${B}/sessions/${id}`),
    revokeOthers: () => api.delete(`${B}/sessions`),
    loginHistory: () => unwrap<LoginEntry[]>(api.get(`${B}/login-history`)),

    settings: () => unwrap<Settings>(api.get(`${B}/settings`)),
    updateSettings: (body: Partial<Settings>) => unwrap<Settings>(api.put(`${B}/settings`, body)),
    activity: (page = 1) => unwrap<ActivityPage>(api.get(`${B}/activity`, { params: { page } })),
};