export type Rating = 'tot' | 'kha' | 'tb' | 'yeu';
export type View = 'school' | 'overview' | 'week' | 'progress' | 'attendance' | 'notes' | 'reviews' | 'logs';
export type Paged<T> = { data: T[]; current_page: number; last_page: number; total: number };

export interface ClassItem { id: number; name: string; grade: number; room: string | null; homeroom_name: string | null; is_mine: boolean; can_write: boolean }
export interface Criterion { id: number; code: string; name: string; category: string; type: 'plus' | 'minus'; default_points: number | string }
export interface Meta {
    year: { id: number; label: string; start_date: string; end_date: string };
    years: { id: number; label: string }[];
    classes: ClassItem[];
    me: { name: string; role: string; teacher_id: number | null; is_bgh: boolean; teacher_name: string | null; homeroom_class_id: number | null };
    periods: { id: number; start_time: string; end_time: string }[];
    ratings: Record<string, string>; days: Record<string, string>; default_date: string; today: string; criteria: Criterion[];
}

export interface Att { total: number; present: number; late: number; excused: number; unexcused: number }
export interface Entry {
    id: number; entry_date: string; period: number; lesson_no: number | null; lesson_title: string; content: string | null; homework: string | null;
    equipment: string | null; rating: Rating | null; discipline_note: string | null; status: 'draft' | 'submitted'; created_by_name: string | null; updated_at: string | null;
}
export interface Slot {
    date: string; weekday: number; period: number; class_subject_id: number; subject_id: number; subject_name: string; subject_code: string;
    teacher_id: number; teacher_name: string | null; entry: Entry | null; att: Att | null; state: 'done' | 'draft' | 'missing' | 'future'; can_write: boolean;
}
export interface WeekStats { total: number; due: number; filled: number; missing: number; rate: number | null; avg_rating: number | null; excused: number; unexcused: number; late: number }
export interface Review {
    status: 'open' | 'signed' | 'approved' | 'returned'; homeroom_comment: string | null; signed_by_name: string | null; signed_at: string | null;
    bgh_note: string | null; bgh_by_name: string | null; bgh_at: string | null;
}
export interface WeekData {
    class: { id: number; name: string; grade: number; room: string | null; homeroom_name: string | null };
    week: { start: string; end: string; iso: number; label: string; prev: string; next: string; is_current: boolean };
    days: { weekday: number; label: string; date: string; is_today: boolean }[];
    slots: Slot[]; review: Review | null; locked: boolean; stats: WeekStats; is_homeroom: boolean;
}
export interface SlotDetail { absent: { id: number; code: string; full_name: string; status: string; note: string | null }[]; summary: Att | null }

export interface OverviewData {
    stats: WeekStats; review: Review | null;
    by_subject: { subject_id: number; name: string; teacher_name: string | null; due: number; filled: number }[];
    todo: { date: string; weekday: number; period: number; subject_name: string; teacher_name: string | null; mine: boolean }[]; todo_total: number;
    absent: { id: number; code: string; full_name: string; n: number; unexcused: number; excused: number; late: number }[];
    notes: { praise: number; violation: number; note: number };
    trend: { label: string; start: string; filled: number; due: number; rate: number | null; avg_rating: number | null }[];
    recent: { id: number; user_name: string; action: string; description: string; created_at: string }[];
    week: { start: string; end: string; label: string };
}
export interface ProgressData {
    semester: { no: number; name: string; start: string; end: string; weeks: number };
    subjects: { subject_id: number; name: string; code: string; teacher_name: string | null; per_week: number; planned: number; logged: number; rate: number | null; last_date: string | null; last_no: number | null; last_title: string | null; avg_rating: number | null }[];
    lessons: { id: number; entry_date: string; period: number; lesson_no: number | null; lesson_title: string; homework: string | null; rating: Rating | null; teacher_name: string | null }[] | null;
}
export interface AttendanceData {
    from: string; to: string; summary: Att & { rate: number | null };
    students: { id: number; code: string; full_name: string; total: number; late: number; excused: number; unexcused: number }[];
    daily: { d: string; total: number; present: number; late: number; excused: number; unexcused: number }[];
}
export interface Note {
    id: number; note_date: string; period: number | null; kind: 'praise' | 'violation' | 'note'; content: string; student_id: number | null;
    student_name: string | null; student_code: string | null; emu_record_id: number | null; award_id: number | null; created_by_name: string | null;
}
export interface ReviewRow {
    week_start: string; iso: number; label: string; total: number; filled: number; rate: number | null; avg_rating: number | null;
    status: Review['status']; homeroom_comment: string | null; signed_by_name: string | null; signed_at: string | null; bgh_note: string | null; bgh_by_name: string | null;
}
export interface SchoolData {
    week: { start: string; end: string; label: string };
    summary: { classes: number; signed: number; approved: number; pending: number; avg_rate: number | null };
    data: { id: number; name: string; grade: number; homeroom_name: string | null; total: number; filled: number; rate: number | null; unexcused: number; excused: number; praise: number; violation: number; status: Review['status'] }[];
}
export interface LogRow { id: number; user_name: string; action: string; description: string; created_at: string }

export interface ViewProps {
    meta: Meta; classId: number; date: string; rev: number; isHomeroom: boolean;
    setDate: (d: string) => void; setClass: (id: number) => void; go: (v: View) => void;
    openEntry: (s: EntryTarget) => void; openNote: () => void; changed: () => void;
}
export interface EntryTarget { date: string; period: number; subject_name: string; teacher_name: string | null; entry: Entry | null; can_write: boolean; att?: Att | null }