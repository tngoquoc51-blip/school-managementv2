import api from '@/services/api';
import type {
  Activity, ClassFormValues, ClassMeta, ClassStats, ClassSubject, Paginated, SchoolClass, Student, TimetableData,
} from '../types/classes';

const B = '/academic/class-management';
const d = <T,>(p: Promise<{ data: { data: T } }>): Promise<T> => p.then((r) => r.data.data);

export interface ClassQuery {
  school_year_id?: number; grade?: number | ''; status?: string; q?: string; homeroom?: string;
  sort?: string; dir?: 'asc' | 'desc'; page?: number; per_page?: number;
}

/** Lấy thông điệp lỗi thân thiện từ response của Laravel. */
export function getErrorMessage(e: any, fallback = 'Đã xảy ra lỗi, vui lòng thử lại.'): string {
  const r = e?.response;
  if (!r) return e?.code === 'ERR_NETWORK' ? 'Không kết nối được máy chủ API.' : fallback;
  if (r.status === 401) return 'Phiên đăng nhập đã hết hạn.';
  const errs = r.data?.errors;
  if (errs && typeof errs === 'object') {
    const first = Object.values(errs)[0] as any;
    if (first) return Array.isArray(first) ? first[0] : String(first);
  }
  return r.data?.message || fallback;
}

export const classService = {
  meta: (yearId?: number) => d<ClassMeta>(api.get(`${B}/meta`, { params: { school_year_id: yearId } })),
  stats: (yearId: number) => d<ClassStats>(api.get(`${B}/stats`, { params: { school_year_id: yearId } })),
  list: (q: ClassQuery) => d<Paginated<SchoolClass>>(api.get(B, { params: q })),
  show: (id: number) => d<SchoolClass>(api.get(`${B}/${id}`)),
  create: (v: Partial<ClassFormValues>) => d<SchoolClass>(api.post(B, v)),
  update: (id: number, v: Partial<ClassFormValues>) => d<SchoolClass>(api.put(`${B}/${id}`, v)),
  remove: (id: number) => d<null>(api.delete(`${B}/${id}`)),
  setHomeroom: (id: number, teacherId: number | null) => d<SchoolClass>(api.put(`${B}/${id}/homeroom`, { teacher_id: teacherId })),
  bulk: (v: { school_year_id: number; grade: number; prefix: string; start: number; count: number; capacity: number }) =>
    d<{ created: string[]; skipped: string[] }>(api.post(`${B}/bulk`, v)),
  cloneYear: (v: { from_year_id: number; to_year_id: number; promote: boolean; copy_subjects: boolean }) =>
    d<{ classes_created: number; classes_skipped: number; students_moved: number; graduated: number }>(api.post(`${B}/clone-year`, v)),
  exportCsv: async (yearId: number) => {
    const r = await api.get(`${B}/export`, { params: { school_year_id: yearId }, responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url; a.download = 'danh-sach-lop-hoc.csv'; a.click();
    URL.revokeObjectURL(url);
  },

  students: (id: number, params: { q?: string; gender?: string } = {}) => d<Student[]>(api.get(`${B}/${id}/students`, { params })),
  availableStudents: (id: number, q?: string) => d<Student[]>(api.get(`${B}/${id}/students/available`, { params: { q } })),
  addStudents: (id: number, ids: number[]) => d<{ added: number; skipped: number }>(api.post(`${B}/${id}/students`, { student_ids: ids })),
  removeStudent: (id: number, sid: number) => d<null>(api.delete(`${B}/${id}/students/${sid}`)),
  transfer: (id: number, ids: number[], target: number) =>
    d<{ moved: number }>(api.post(`${B}/${id}/students/transfer`, { student_ids: ids, target_class_id: target })),

  subjects: (id: number) => d<ClassSubject[]>(api.get(`${B}/${id}/subjects`)),
  saveSubjects: (id: number, assignments: { subject_id: number; teacher_id: number }[]) =>
    d<ClassSubject[]>(api.put(`${B}/${id}/subjects`, { assignments })),
  timetable: (id: number) => d<TimetableData>(api.get(`${B}/${id}/timetable`)),
  saveTimetable: (id: number, slots: { weekday: number; period: number; class_subject_id: number | null }[]) =>
    d<TimetableData>(api.put(`${B}/${id}/timetable`, { slots })),
  activity: (id: number) => d<Activity[]>(api.get(`${B}/${id}/activity`)),
};
