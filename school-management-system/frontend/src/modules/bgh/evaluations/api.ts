import axios from 'axios';
import { getToken } from '../logs/api';
import type {
    Action, Lookups, Me, Obs, ObsDetail, Overview, Paged, PeriodicRow, Plan, Report, RubricFull, Settings, TeacherProfile, TeacherRow,
} from './types';

function apiBase(): string {
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
    if (typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return '/api/v1';
    return 'http://localhost:8000/api/v1';
}

const http = axios.create();
http.interceptors.request.use((c) => {
    c.baseURL = apiBase();
    const t = getToken();
    if (t) c.headers.Authorization = `Bearer ${t}`;
    c.headers.Accept = 'application/json';
    return c;
});

const B = '/evaluations';
type P = Record<string, unknown>;
const clean = (p?: P) => Object.fromEntries(Object.entries(p || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const get = async <T>(u: string, p?: P) => (await http.get(B + u, { params: clean(p) })).data.data as T;
const send = async <T = unknown>(m: 'post' | 'put' | 'delete', u: string, body?: unknown) => (await http.request({ method: m, url: B + u, data: body })).data.data as T;

async function download(u: string, p: P) {
    const res = await http.get(B + u, { params: clean(p), responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = /filename="?([^";]+)"?/.exec(String(res.headers['content-disposition'] || ''))?.[1] || 'du-lieu.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export interface Per { year?: number; semester: number }

export const evApi = {
    me: () => get<Me>('/me'),
    lookups: () => get<Lookups>('/lookups'),
    overview: (p: Per) => get<Overview>('/overview', { ...p }),
    slots: (teacher_id: number, date: string) => get<{ period: number; class_id: number; class_name: string; subject_id: number; subject_name: string }[]>('/slots', { teacher_id, date }),
    report: (p: Per) => get<Report>('/report', { ...p }),
    teachers: (p: P) => get<{ items: TeacherRow[]; min_required: number; total: number }>('/teachers', p),
    teacher: (id: number) => get<TeacherProfile>(`/teachers/${id}`),

    plans: (p: P) => get<Paged<Plan>>('/plans', p),
    savePlan: (id: number | null, b: P) => (id ? send<Plan>('put', `/plans/${id}`, b) : send<Plan>('post', '/plans', b)),
    postponePlan: (id: number, b: P) => send<Plan>('post', `/plans/${id}/postpone`, b),
    cancelPlan: (id: number, reason: string) => send<Plan>('post', `/plans/${id}/cancel`, { reason }),
    startPlan: (id: number) => send<{ observation_id: number; code: string; existing: boolean }>('post', `/plans/${id}/start`, {}),
    deletePlan: (id: number) => send('delete', `/plans/${id}`),

    observations: (p: P) => get<Paged<Obs>>('/observations', p),
    observation: (id: number) => get<ObsDetail>(`/observations/${id}`),
    createObservation: (b: P) => send<ObsDetail>('post', '/observations', b),
    saveObservation: (id: number, b: P) => send<ObsDetail>('put', `/observations/${id}`, b),
    obsAction: (id: number, act: 'submit' | 'acknowledge' | 'dispute' | 'reopen' | 'close', b: P = {}) => send<ObsDetail>('post', `/observations/${id}/${act}`, b),
    deleteObservation: (id: number) => send('delete', `/observations/${id}`),
    exportObservations: (p: P) => download('/observations/export', p),

    periodic: (p: P) => get<{ year: number; semester: number; items: PeriodicRow[]; counts: Record<string, number>; settings: Settings }>('/periodic', p),
    generatePeriodic: (p: Per) => send<{ created: number; refreshed: number }>('post', `/periodic/generate?semester=${p.semester}${p.year ? '&year=' + p.year : ''}`, {}),
    savePeriodic: (teacherId: number, p: Per, b: P) => send<PeriodicRow>('put', `/periodic/teacher/${teacherId}?semester=${p.semester}${p.year ? '&year=' + p.year : ''}`, b),
    periodicAct: (id: number, act: 'submit' | 'approve' | 'reopen', b: P = {}) => send<PeriodicRow>('post', `/periodic/${id}/${act}`, b),
    exportPeriodic: (p: P) => download('/periodic/export', p),

    rubrics: () => get<RubricFull[]>('/rubrics'),
    rubric: (id: number) => get<RubricFull>(`/rubrics/${id}`),
    saveRubric: (id: number | null, b: P) => (id ? send<RubricFull>('put', `/rubrics/${id}`, b) : send<RubricFull>('post', '/rubrics', b)),
    toggleRubric: (id: number) => send<RubricFull>('post', `/rubrics/${id}/toggle`, {}),
    deleteRubric: (id: number) => send('delete', `/rubrics/${id}`),

    actions: (p: P) => get<Paged<Action>>('/actions', p),
    saveAction: (id: number | null, b: P) => (id ? send<Action>('put', `/actions/${id}`, b) : send<Action>('post', '/actions', b)),
    actionStatus: (id: number, status: string, result_note?: string) => send<Action>('post', `/actions/${id}/status`, { status, result_note }),
    deleteAction: (id: number) => send('delete', `/actions/${id}`),

    settings: () => get<{ settings: Settings; rubrics: RubricFull[] }>('/settings'),
    saveSettings: (settings: Partial<Settings>) => send<{ settings: Settings; changed: string[] }>('put', '/settings', { settings }),
};

export { errorMessage } from '../logs/api';