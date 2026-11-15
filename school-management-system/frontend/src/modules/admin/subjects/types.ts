export type Kind = 'score' | 'pass';
export type Category = 'required' | 'elective' | 'topic';
export type Status = 'active' | 'inactive';

export interface Subject {
    id: number; code: string; name: string; kind: Kind; category: Category;
    periods_per_week: number; sort_order: number; group_id: number | null;
    group_name?: string | null; group_code?: string | null;
    color: string; grades: number[]; description: string | null; status: Status;
    classes_count?: number; teachers_count?: number; specialist_count?: number;
    updated_at?: string | null;
}
export interface Curriculum {
    id?: number; subject_id: number; grade: number; periods_per_week: number; periods_total: number;
    tx_count: number; w_tx: number; w_gk: number; w_ck: number; is_required: number | boolean;
    code?: string; name?: string; color?: string; kind?: Kind;
}
export interface SubjectDetail extends Subject {
    curriculum: Curriculum[];
    assignments: { id: number; class_id: number; class_name: string; grade: number; teacher_id: number; teacher_code: string; teacher_name: string }[];
    specialists: { id: number; code: string; full_name: string; gender: string }[];
    usage: { class_subjects: number; timetable: number; grades: number; teachers: number };
    stats: { semester: number; n: number; avg: number }[];
}
export interface SchoolYear { id: number; label: string; is_current: number; status: string }
export interface Teacher { id: number; code: string; full_name: string; main_subject_id: number }
export interface Group {
    id: number; code: string; name: string; head_teacher_id: number | null; head_name?: string | null;
    description: string | null; subjects_count?: number; teachers_count?: number;
    subjects?: { id: number; code: string; name: string; color: string; status: Status }[];
}
export interface Meta {
    school_years: SchoolYear[]; current_year_id: number; groups: Group[]; teachers: Teacher[];
    config: { teacher_quota: number; pass_score: number };
}
export interface Paged<T> { items: T[]; meta: { page: number; per_page: number; total: number; last_page: number; school_year_id: number } }
export interface Overview {
    school_year_id: number;
    totals: { subjects: number; active: number; inactive: number; score: number; pass: number; periods_per_week: number; groups: number; teachers: number; classes: number; assigned: number; expected: number; coverage: number };
    by_group: { id: number | null; name: string; total: number; periods: number }[];
    by_category: Record<Category, number>;
    top_subjects: { id: number; code: string; name: string; color: string; n: number }[];
    recent: AuditRow[];
}
export interface AuditRow { id: number; subject_id: number | null; action: string; summary: string; actor: string | null; ip?: string | null; created_at: string }
export interface Issue { key: string; severity: 'error' | 'warning' | 'info'; title: string; hint: string; count: number; items: string[] }
export interface Integrity { issues: Issue[]; health: number; total: number }
export interface MatrixClass { id: number; name: string; grade: number; homeroom_name: string | null; homeroom_teacher_id: number | null }
export interface MatrixSubject { id: number; code: string; name: string; color: string; kind: Kind; periods_per_week: number; grades: number[] }
export interface Cell { id: number; class_id: number; subject_id: number; teacher_id: number; teacher_name: string; teacher_code: string; main_subject_id: number }
export interface Matrix {
    classes: MatrixClass[]; subjects: MatrixSubject[]; cells: Cell[]; teachers: Teacher[];
    load: Record<string, { periods: number; slots: number; homeroom: boolean }>;
}
export interface TeacherLoad {
    id: number; code: string; full_name: string; gender: string; main_subject_id: number; main_subject: string | null;
    periods: number; quota: number; homeroom: boolean; classes: number; subjects: string[]; class_names: string[]; status: 'over' | 'ok' | 'under';
}
export interface Workload { teachers: TeacherLoad[]; summary: { total: number; over: number; under: number; avg_periods: number; quota: number } }
export interface AnalyticsRow { id: number; code: string; name: string; color: string; kind: Kind; n: number; avg: number | null; pass_rate: number | null; dist: number[]; by_grade: Record<string, number | null> }
export interface Analytics { subjects: AnalyticsRow[]; buckets: string[]; pass_score: number }
export interface AutoPlan { plan: { class_id: number; class: string; subject_id: number; subject: string; teacher_id: number; teacher: string }[]; count: number; skipped: { class: string; subject: string; reason: string }[]; applied: boolean }
export interface ImportReport { rows: { line: number; code: string; name: string; action: 'create' | 'update' | 'error'; error: string | null }[]; valid: number; errors: number; applied: boolean }

export type TabKey = 'overview' | 'list' | 'groups' | 'assign' | 'workload' | 'curriculum' | 'analytics' | 'integrity' | 'audit';