import api from '@/services/api';
import type { GradeActivity, GradeWindowsOverview, GradeWindow } from '../types/grades';

const B = '/academic/grade-windows';
const d = <T,>(p: Promise<{ data: { data: T } }>): Promise<T> => p.then((r) => r.data.data);

export const gradeService = {
    overview: (yearId: number) => d<GradeWindowsOverview>(api.get(`${B}/overview`, { params: { school_year_id: yearId } })),
    open: (yearId: number, semester: 1 | 2, closesAt: string | null, note: string | null) =>
        d<GradeWindow>(api.post(`${B}/open`, { school_year_id: yearId, semester, closes_at: closesAt, note })),
    close: (yearId: number, semester: 1 | 2, note: string | null) =>
        d<GradeWindow>(api.post(`${B}/close`, { school_year_id: yearId, semester, note })),
    addException: (yearId: number, semester: 1 | 2, classId: number, subjectId: number | null, expiresAt: string | null) =>
        d<GradeWindow>(api.post(`${B}/exceptions`, { school_year_id: yearId, semester, class_id: classId, subject_id: subjectId, expires_at: expiresAt })),
    removeException: (yearId: number, semester: 1 | 2, exceptionId: number) =>
        d<GradeWindow>(api.delete(`${B}/exceptions/${exceptionId}`, { params: { school_year_id: yearId, semester } })),
    activity: (yearId: number) => d<GradeActivity[]>(api.get(`${B}/activity`, { params: { school_year_id: yearId } })),
};