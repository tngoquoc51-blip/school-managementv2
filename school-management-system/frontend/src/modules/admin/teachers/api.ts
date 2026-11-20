import api from '@/services/api';
import type * as T from './types';
export { errMsg, fieldErrors } from '../subjects/api';

const B = '/teacheradmin';
const d = <R,>(p: Promise<{ data: { data: R } }>): Promise<R> => p.then((r) => r.data.data);
const q = (o: Record<string, unknown>) => ({ params: Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null)) });

export const teacherApi = {
    meta: (y?: number) => d<T.Meta>(api.get(`${B}/meta`, q({ school_year_id: y }))),
    overview: (y: number) => d<T.Overview>(api.get(`${B}/overview`, q({ school_year_id: y }))),
    list: (p: Record<string, unknown>) => d<T.Teacher[]>(api.get(`${B}/teachers`, q(p))),
    detail: (id: number, y: number) => d<T.TeacherDetail>(api.get(`${B}/teachers/${id}`, q({ school_year_id: y }))),
    create: (b: unknown) => d<{ id: number }>(api.post(`${B}/teachers`, b)),
    update: (id: number, b: unknown) => d<{ id: number }>(api.put(`${B}/teachers/${id}`, b)),
    remove: (id: number) => d<null>(api.delete(`${B}/teachers/${id}`)),
    bulk: (ids: number[], action: string, value?: string) => d<{ affected: number; total: number }>(api.post(`${B}/teachers/bulk`, { ids, action, value })),
    exportRows: () => d<Record<string, unknown>[]>(api.get(`${B}/teachers/export`)),
    importRows: (rows: unknown[], dry_run: boolean) => d<T.ImportReport>(api.post(`${B}/teachers/import`, { rows, dry_run })),
    addCert: (id: number, b: unknown) => d<{ id: number }>(api.post(`${B}/teachers/${id}/certs`, b)),
    removeCert: (id: number) => d<null>(api.delete(`${B}/certs/${id}`)),
    schedule: (id: number, y: number) => d<T.ScheduleData>(api.get(`${B}/teachers/${id}/schedule`, q({ school_year_id: y }))),
    supply: (y: number) => d<{ subjects: T.SupplyRow[]; quota: number }>(api.get(`${B}/supply`, q({ school_year_id: y }))),
    performance: (y: number, semester?: number) => d<{ teachers: T.Perf[]; pass_score: number }>(api.get(`${B}/performance`, q({ school_year_id: y, semester }))),
    workload: (y: number) => d<T.Workload>(api.get(`${B}/workload`, q({ school_year_id: y }))),
    transfer: (class_subject_id: number, to_teacher_id: number) => d<null>(api.post(`${B}/workload/transfer`, { class_subject_id, to_teacher_id })),
    homeroom: (y: number) => d<T.HomeroomData>(api.get(`${B}/homeroom`, q({ school_year_id: y }))),
    setHomeroom: (class_id: number, teacher_id: number | null) => d<{ warnings: string[] }>(api.post(`${B}/homeroom`, { class_id, teacher_id })),
    conflicts: (y: number) => d<{ teacher_id: number; full_name: string; weekday: number; period: number; n: number }[]>(api.get(`${B}/conflicts`, q({ school_year_id: y }))),
    integrity: (y: number) => d<T.Integrity>(api.get(`${B}/integrity`, q({ school_year_id: y }))),
    audit: (teacher_id?: number) => d<T.AuditRow[]>(api.get(`${B}/audit`, q({ teacher_id, limit: 150 }))),
    leaves: (status?: string) => d<T.Leave[]>(api.get(`${B}/leaves`, q({ status }))),
    createLeave: (b: unknown) => d<{ id: number }>(api.post(`${B}/leaves`, b)),
    reviewLeave: (id: number, decision: string, note?: string) => d<null>(api.post(`${B}/leaves/${id}/review`, { decision, note })),
    removeLeave: (id: number) => d<null>(api.delete(`${B}/leaves/${id}`)),
    coverage: (id: number) => d<T.Coverage>(api.get(`${B}/leaves/${id}/coverage`)),
    substitute: (id: number, lesson_date: string, timetable_id: number, teacher_id: number) => d<null>(api.post(`${B}/leaves/${id}/substitute`, { lesson_date, timetable_id, teacher_id })),
    unsubstitute: (id: number, lesson_date: string, timetable_id: number) => d<null>(api.post(`${B}/leaves/${id}/unsubstitute`, { lesson_date, timetable_id })),
    autoCover: (id: number) => d<{ assigned: number }>(api.post(`${B}/leaves/${id}/auto`)),
};