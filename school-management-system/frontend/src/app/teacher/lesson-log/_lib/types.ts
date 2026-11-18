export interface Meta {
    classes: { id: number; name: string }[];
    subjects: string[];
    periods: { n: number; start: string; end: string; session: 'morning' | 'afternoon' }[];
    teachers: { id: number; name: string }[];
    ratings: Record<string, string>;
    absence_types: Record<string, string>;
    me: { id: number; name: string; role: string; is_admin: boolean; homeroom_class_ids: number[] };
    year: { id: number; label: string | null } | null;
    edit_days: number;
    links: { label: string; url: string }[];
    today: string;
}
export interface Cell {
    id: number; period: number; lesson_date: string; subject_name: string; title: string | null; teacher_id: number | null; teacher_name: string | null;
    status: string; rating: string | null; absent: number; late: number; mine: boolean;
}
export interface WeekData {
    class: { id: number; name: string | null }; week_start: string; week_end: string;
    days: { date: string; label: string; is_today: boolean }[];
    cells: Record<string, Record<string, Cell>>;
    week: { status: 'open' | 'confirmed'; confirmed_name?: string | null; confirmed_at?: string | null; note?: string | null };
    summary: { entries: number; signed: number; confirmed: number; drafts: number; absent: number; late: number };
    can_confirm: boolean;
}
export interface Log {
    id: number; class_id: number; class_name: string; subject_name: string; lesson_date: string; period: number; teacher_id: number | null; teacher_name: string | null;
    lesson_no: number | null; title: string | null; content: string | null; equipment: string | null; homework: string | null; rating: string | null;
    total_students: number; absent_excused: number; absent_unexcused: number; late_count: number; absent: number;
    discipline_note: string | null; remark: string | null; homeroom_note: string | null; status: string; signed_at: string | null; confirmed_at: string | null;
}
export interface Absence { id: number; student_id: number; student_name: string; student_code: string | null; type: string; reason: string | null }
export interface Ev { id: number; type: string; message: string; actor_name: string | null; created_at: string }
export interface Perms { can_edit: boolean; can_sign: boolean; can_unsign: boolean; can_reopen: boolean; can_delete: boolean; can_note: boolean; week_locked: boolean; mine: boolean }
export interface Detail { log: Log; absences: Absence[]; events: Ev[]; perms: Perms }
export interface Student { id: number; code: string | null; name: string }
export interface Stats {
    from: string; to: string;
    kpi: { entries: number; signed: number; confirmed: number; drafts: number; overdue_drafts: number; sign_rate: number; absent: number; unexcused: number; late: number };
    by_rating: { key: string; label: string; count: number }[];
    by_subject: { subject: string; count: number; good_rate: number }[];
    by_teacher: { teacher_id: number; name: string; entries: number; signed: number; drafts: number }[];
    by_weekday: { label: string; absent: number; late: number }[];
    top_absent: { student_id: number; name: string; code: string | null; class_name: string; count: number; unexcused: number }[];
    pending_weeks: { class_id: number; class_name: string; week_start: string; entries: number; drafts: number }[];
    recent: { id: number; log_id: number; type: string; message: string; actor_name: string | null; created_at: string; class_name: string; subject_name: string; period: number }[];
}
export interface ListFilters { q: string; class_id: string; subject: string; status: string; rating: string; teacher_id: string; from: string; to: string; page: number }

export const STATUS_LABEL: Record<string, string> = { draft: 'Nháp', signed: 'Đã ký sổ', confirmed: 'GVCN đã xác nhận' };
export const STATUS_TONE: Record<string, 'ok' | 'warn' | 'err' | 'mut' | 'pri' | 'sky' | 'vio'> = { draft: 'warn', signed: 'pri', confirmed: 'ok' };
export const RATING_TONE: Record<string, 'ok' | 'warn' | 'err' | 'mut' | 'pri' | 'sky' | 'vio'> = { good: 'ok', fair: 'pri', pass: 'warn', poor: 'err' };