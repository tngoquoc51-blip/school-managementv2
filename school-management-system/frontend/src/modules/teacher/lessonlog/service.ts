import { errMsg, getToken } from '@/modules/bgh/rewards/rewardsService';
import type {
    AttendanceData, Entry, LogRow, Meta, Note, OverviewData, Paged, ProgressData, ReviewRow, SchoolData, SlotDetail, WeekData,
} from './types';

export { errMsg, getToken };

/** <NEXT_PUBLIC_API_URL>/gv/lesson-log  (Laravel nhận cả /api lẫn /api/v1) */
function base(): string {
    let b = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
    if (!/\/api(\/v1)?$/.test(b)) b += '/api';
    return b + '/gv/lesson-log';
}

async function call<T>(method: string, url: string, params?: Record<string, any>, body?: any): Promise<T> {
    const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    const qs = new URLSearchParams(clean as Record<string, string>).toString();
    let res: Response;
    try {
        res = await fetch(base() + url + (qs ? '?' + qs : ''), {
            method,
            headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw { response: { status: 0, data: { message: 'Không kết nối được máy chủ. Hãy kiểm tra Laragon và địa chỉ API.' } } };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { response: { status: res.status, data } };
    return data as T;
}

const get = <T,>(u: string, p: Record<string, any> = {}) => call<T>('GET', u, p);
const post = <T = { message: string }>(u: string, b: any = {}) => call<T>('POST', u, undefined, b);

export const logApi = {
    meta: (year_id?: number) => get<Meta>('/meta', { year_id }),
    week: (class_id: number, date: string) => get<WeekData>('/week', { class_id, date }),
    slot: (class_id: number, date: string, period: number) => get<SlotDetail>('/slot', { class_id, date, period }),
    saveEntry: (b: Record<string, any>) => post<{ message: string; entry: Entry }>('/entries', b),
    deleteEntry: (id: number) => call<{ message: string }>('DELETE', `/entries/${id}`),
    overview: (class_id: number, date: string) => get<OverviewData>('/overview', { class_id, date }),
    progress: (class_id: number, date: string, subject_id?: number) => get<ProgressData>('/progress', { class_id, date, subject_id }),
    attendance: (class_id: number, from: string, to: string) => get<AttendanceData>('/attendance', { class_id, from, to }),
    studentAtt: (class_id: number, student_id: number, from: string, to: string) =>
        get<{ data: { att_date: string; period: number; status: string; note: string | null; subject_name: string | null }[] }>('/attendance/student', { class_id, student_id, from, to }),
    roster: (class_id: number) => get<{ data: { id: number; code: string; full_name: string }[] }>('/roster', { class_id }),
    notes: (p: Record<string, any>) => get<{ data: Note[] }>('/notes', p),
    addNote: (b: Record<string, any>) => post<{ message: string; links: string[] }>('/notes', b),
    delNote: (id: number) => call<{ message: string }>('DELETE', `/notes/${id}`),
    reviews: (class_id: number, date: string) => get<{ semester: { name: string }; data: ReviewRow[] }>('/reviews', { class_id, date }),
    sign: (b: Record<string, any>) => post('/reviews/sign', b),
    reopen: (b: Record<string, any>) => post('/reviews/reopen', b),
    decide: (b: Record<string, any>) => post('/reviews/decide', b),
    school: (date: string, year_id?: number) => get<SchoolData>('/school', { date, year_id }),
    logs: (class_id: number, page = 1) => get<Paged<LogRow>>('/logs', { class_id, page }),
};