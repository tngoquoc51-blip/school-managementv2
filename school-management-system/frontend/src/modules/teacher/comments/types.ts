export type TabKey = 'overview' | 'write' | 'insights' | 'templates' | 'history';
export type Kind = 'midterm' | 'final' | 'monthly';

export interface Assignment { id: number; class_id: number; class_name: string; grade: number; subject_id: number; subject_name: string; subject_code: string }
export interface Meta { year_id: number; semester: number; semesters: { code: number; name: string }[]; assignments: Assignment[] }
export interface Filters { cs: number; semester: number; kind: Kind; period: string }

export interface Scores { tx1: number | null; tx2: number | null; tx3: number | null; tx4: number | null; gk: number | null; ck: number | null; tbm: number | null }
export interface Suggest { rating: string | null; text: string | null; trend: 'up' | 'down' | 'flat' | null }
export interface CommentRow { id: number; rating: string; content: string; tags: string | null; status: 'draft' | 'published'; updated_at: string; published_at: string | null; kind: string; period: string }
export interface RosterStudent { id: number; code: string; full_name: string; gender: string; scores: Scores; score: number | null; suggest: Suggest; comment: CommentRow | null }
export interface Roster { assignment: Assignment; period: string; students: RosterStudent[] }

export interface Overview {
    kpi: { students: number; written: number; draft: number; published: number };
    progress: { assignment: Assignment; students: number; written: number; published: number; draft: number }[];
    ratings: { rating: string; n: number }[];
    recent: { id: number; rating: string; content: string; status: string; kind: string; period: string; updated_at: string; student_name: string; student_code: string; class_name: string; subject_name: string }[];
}
export interface InsightRow {
    student: { id: number; code: string; full_name: string }; assignment: Assignment; score: number | null; scores: Scores; trend: string | null; reasons: string[]; severity: number; suggest: Suggest;
    comment: { id: number; rating: string; content: string; tags: string | null; status: string } | null;
}
export interface StudentDetail {
    student: { id: number; code: string; full_name: string; gender: string; birth_date: string };
    assignment: Assignment;
    grades: ({ semester: number; assessment: string | null } & Scores)[];
    comments: { id: number; semester: number; kind: string; period: string; rating: string; content: string; tags: string | null; status: string; updated_at: string }[];
}
export interface HistoryRow {
    id: number; student_id: number; class_id: number; subject_id: number; semester: number; kind: string; period: string; rating: string; content: string; tags: string | null; status: string; updated_at: string;
    student_code: string; student_name: string; class_name: string; subject_name: string;
}
export interface Page<T> { data: T[]; current_page: number; last_page: number; total: number; per_page: number }
export interface Template { id: number; teacher_id: number | null; rating: string; title: string; body: string; is_system: number; uses: number }
export interface SaveItem { student_id: number; class_subject_id: number; semester: number; kind: string; period: string; rating: string; content: string; tags: string[]; status: 'draft' | 'published' }