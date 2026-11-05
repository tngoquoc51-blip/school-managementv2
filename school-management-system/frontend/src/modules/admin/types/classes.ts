export type ClassStatus = 'active' | 'paused' | 'closed';

export interface TeacherLite {
  id: number; code: string; full_name: string;
}
export interface SchoolClass {
  id: number; name: string; grade: number; school_year_id: number; school_year_label: string;
  homeroom_teacher: TeacherLite | null; room: string | null; capacity: number; status: ClassStatus; note: string | null;
  student_count: number; male_count: number; female_count: number; fill_percent: number;
}
export interface SchoolYear { id: number; label: string; is_current: number; status: string; start_date: string; end_date: string }
export interface MetaTeacher extends TeacherLite {
  main_subject_id: number; main_subject: string; homeroom_class_id: number | null; homeroom_class_name: string | null;
}
export interface Subject { id: number; code: string; name: string; kind: string; periods_per_week: number; sort_order: number }
export interface Period { id: number; start_time: string; end_time: string }
export interface ClassMeta {
  current_year_id: number; school_years: SchoolYear[]; grades: number[]; teachers: MetaTeacher[]; subjects: Subject[];
  periods: Period[]; weekdays: number[]; statuses: { value: ClassStatus; label: string }[];
}
export interface ClassStats {
  total_classes: number; total_students: number; avg_per_class: number; male: number; female: number;
  no_homeroom: number; full_classes: number; unassigned_students: number;
  by_grade: { grade: number; classes: number; students: number }[];
}
export interface Student {
  id: number; code: string; full_name: string; gender: string; birth_date: string; admission_year: number; conduct: string | null;
}
export interface ClassSubject {
  id: number; subject_id: number; subject_code: string; subject_name: string; periods_per_week: number;
  teacher_id: number; teacher_code: string; teacher_name: string;
}
export interface TimetableSlot {
  id: number; weekday: number; period: number; class_subject_id: number; subject_name: string; subject_code: string;
  teacher_name: string; teacher_id: number;
}
export interface TimetableData { slots: TimetableSlot[]; subjects: ClassSubject[]; periods: Period[]; weekdays: number[] }
export interface Activity { id: number; action: string; detail: string | null; created_at: string; user_name: string | null }
export interface Paginated<T> { items: T[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }
export interface ClassFormValues {
  school_year_id: number; grade: number; name: string; homeroom_teacher_id: number | null; room: string; capacity: number;
  status: ClassStatus; note: string;
}
