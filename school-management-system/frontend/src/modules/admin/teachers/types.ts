export type TabKey = 'overview' | 'list' | 'supply' | 'homeroom' | 'workload' | 'schedule' | 'leaves' | 'integrity' | 'audit';
export type Degree = 'bachelor' | 'master' | 'doctor' | 'other';
export type Contract = 'permanent' | 'contract' | 'probation' | 'part_time';
export type TStatus = 'active' | 'leave' | 'inactive' | 'retired';
export type LoadStatus = 'over' | 'ok' | 'under';

export interface SubjectLite { id: number; code: string; name: string; color: string; kind: 'score' | 'pass' }
export interface ClassLite { id: number; name: string; grade: number; homeroom_teacher_id: number | null }
export interface Meta {
    years: { id: number; label: string; is_current: number }[];
    subjects: SubjectLite[]; classes: ClassLite[]; quota: number; reduction: number;
    degrees: Record<Degree, string>; contracts: Record<Contract, string>; statuses: Record<TStatus, string>;
}
export interface Teacher {
    id: number; code: string; full_name: string; gender: string | null; main_subject_id: number | null;
    birth_date: string | null; phone: string | null; email: string | null; address: string | null;
    degree: Degree; position: string; hire_date: string | null; contract: Contract; status: TStatus; note: string | null;
    main_subject?: string | null; main_color?: string | null;
    subjects: { id: number; name: string; color: string; is_main: number }[];
    homeroom_class: string | null; periods: number; classes: number; quota: number; load_status: LoadStatus;
}
export interface Cert { id: number; name: string; issuer: string | null; issued_at: string | null; expires_at: string | null }
export interface Leave {
    id: number; teacher_id: number; full_name: string; code: string; leave_type: string; from_date: string; to_date: string; reason: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled'; review_note: string | null; reviewed_by: string | null; days: number; lessons: number; covered: number;
}
export interface TeacherDetail extends Omit<Teacher, 'subjects'> {
    subject_ids: number[]; certs: Cert[]; leaves: Leave[]; students: number;
    assignments: { id: number; class_name: string; grade: number; subject_name: string; color: string; periods: number }[];
}
export interface AuditRow { id: number; teacher_id: number | null; action: string; summary: string; actor: string | null; created_at: string }
export interface Overview {
    total: number; active: number; homeroom: number; classes: number; on_leave_today: number; pending_leaves: number;
    by_status: Record<string, number>; by_degree: Record<string, number>; by_contract: Record<string, number>; by_gender: Record<string, number>;
    by_subject: { name: string | null; color: string | null; n: number }[]; age_buckets: Record<string, number>;
    workload: { total: number; over: number; under: number; avg: number; quota: number };
    top_load: WLRow[]; upcoming_certs: { id: number; name: string; expires_at: string; full_name: string; teacher_id: number }[]; recent: AuditRow[];
}
export interface WLRow {
    id: number; code: string; full_name: string; main_subject: string | null; main_subject_id: number | null; periods: number; quota: number;
    homeroom: boolean; classes: string[]; subjects: string[]; status: LoadStatus;
}
export interface Suggestion {
    class_subject_id: number; from_id: number; from: string; to_id: number; to: string; subject: string; class_name: string; periods: number; from_after: number; to_after: number;
}
export interface Workload { workload: { teachers: WLRow[]; summary: Overview['workload'] }; suggestions: Suggestion[] }
export interface SupplyRow { id: number; code: string; name: string; color: string; kind: string; periods: number; classes: number; teachers: number; qualified: number; need_fte: number; gap: number; status: 'short' | 'ok' | 'surplus' | 'none' }
export interface HomeroomData {
    classes: { id: number; name: string; grade: number; homeroom_teacher_id: number | null; teacher: string | null; teacher_code: string | null; students: number; teaches_class: boolean; teacher_periods: number | null }[];
    free_teachers: { id: number; code: string; full_name: string; main_subject_id: number | null }[];
}
export interface ScheduleData { cells: Record<string, { id: number; class_name: string; subject: string; color: string }[]>; per_day: Record<string, number>; total: number; conflicts: string[] }
export interface Perf { id: number; full_name: string; code: string; n: number; avg: number; pass_rate: number | null }
export interface Issue { key: string; severity: 'error' | 'warning' | 'info'; title: string; hint: string; count: number; items: { id: number | null; label: string }[] }
export interface Integrity { issues: Issue[]; health: number; total: number }
export interface Coverage {
    leave: Leave;
    lessons: { key: string; lesson_date: string; timetable_id: number; weekday: number; period: number; class_name: string; subject: string; substitute_id: number | null; substitute: string | null;
        candidates: { id: number; code: string; full_name: string; same_subject: boolean }[] }[];
}
export interface ImportReport { created: number; updated: number; errors: string[] }