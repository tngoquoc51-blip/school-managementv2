import type { AxiosResponse } from 'axios';
import api from '@/services/api';
import type { Envelope, Paged } from '@/modules/admin/categories/types';
import type {
    AutoAssignResult, BulkEnrollResult, ClassDetail, ClassRow, RosterOverview, StudentDetail, StudentRow, SubjectLite, Teacher, Year,
} from './types';

const unwrap = <T,>(r: AxiosResponse<Envelope<T>>): T => r.data.data;
const clean = (p: Record<string, unknown>) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== '' && v !== null));

async function download(url: string, params: Record<string, unknown>, fallback: string) {
    const res = await api.get(url, { params: clean(params), responseType: 'blob' });
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers['content-disposition'] ?? ''));
    const href = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = m ? decodeURIComponent(m[1]) : fallback;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
}

export interface ClassInput { school_year_id?: number; grade: number; name: string; homeroom_teacher_id: number | null }
export interface StudentInput {
    full_name: string; gender: string; birth_date: string; admission_year: number; code?: string; class_id?: number | null;
    school_year_id?: number; create_account?: boolean;
}

export const rosterApi = {
    years: async () => unwrap<Year[]>(await api.get('/roster/years')),
    overview: async (year_id?: number) => unwrap<RosterOverview>(await api.get('/roster/overview', { params: clean({ year_id }) })),
    lookups: async (year_id?: number) => unwrap<{ teachers: Teacher[]; subjects: SubjectLite[] }>(await api.get('/roster/lookups', { params: clean({ year_id }) })),

    classes: async (params: Record<string, unknown>) => unwrap<{ year_id: number; items: ClassRow[] }>(await api.get('/roster/classes', { params: clean(params) })),
    classDetail: async (id: number) => unwrap<ClassDetail>(await api.get(`/roster/classes/${id}`)),
    createClass: async (b: ClassInput) => unwrap<ClassDetail>(await api.post('/roster/classes', b)),
    updateClass: async (id: number, b: ClassInput) => unwrap<ClassDetail>(await api.put(`/roster/classes/${id}`, b)),
    deleteClass: async (id: number) => unwrap<null>(await api.delete(`/roster/classes/${id}`)),
    setSubjectTeacher: async (id: number, subjectId: number, teacher_id: number) => unwrap<ClassDetail>(await api.put(`/roster/classes/${id}/subjects/${subjectId}`, { teacher_id })),
    removeSubject: async (id: number, subjectId: number) => unwrap<ClassDetail>(await api.delete(`/roster/classes/${id}/subjects/${subjectId}`)),
    exportClass: (id: number) => download(`/roster/classes/${id}/export`, {}, 'danh_sach_lop.csv'),

    students: async (params: Record<string, unknown>) => unwrap<Paged<StudentRow>>(await api.get('/roster/students', { params: clean(params) })),
    student: async (id: number, year_id?: number, reveal = false) => unwrap<StudentDetail>(await api.get(`/roster/students/${id}`, { params: clean({ year_id, reveal: reveal ? 1 : undefined }) })),
    createStudent: async (b: StudentInput) => unwrap<{ id: number; code: string; temporary_password: string | null; username: string | null }>(await api.post('/roster/students', b)),
    updateStudent: async (id: number, b: Record<string, unknown>) => unwrap<null>(await api.put(`/roster/students/${id}`, b)),
    deleteStudent: async (id: number) => unwrap<null>(await api.delete(`/roster/students/${id}`)),
    enroll: async (id: number, class_id: number, year_id: number) => unwrap<{ result: string }>(await api.post(`/roster/students/${id}/enroll`, { class_id, year_id })),
    unenroll: async (id: number, year_id: number) => unwrap<null>(await api.delete(`/roster/students/${id}/enroll`, { params: { year_id } })),
    bulkEnroll: async (student_ids: number[], class_id: number, year_id: number) => unwrap<BulkEnrollResult>(await api.post('/roster/students/bulk-enroll', { student_ids, class_id, year_id })),
    autoAssign: async (year_id: number, grade: number, student_ids?: number[]) => unwrap<AutoAssignResult>(await api.post('/roster/students/auto-assign', { year_id, grade, student_ids })),
    exportStudents: (params: Record<string, unknown>) => download('/roster/students/export', params, 'hoc_sinh.csv'),
};