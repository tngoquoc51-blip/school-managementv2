export type ViewKey = 'overview' | 'calendar' | 'tests' | 'analytics' | 'bank' | 'papers';

export interface Assignment { cs_id: number; class_id: number; class_name: string; grade: number; subject_id: number; subject_name: string }
export interface KindDef { key: string; label: string; columns: string[]; minutes: number }
export interface Band { key: string; label: string; color: string; min?: number; count?: number }

export interface Meta {
    teacher: { id: number; code: string; full_name: string; main_subject: string | null };
    is_admin: boolean;
    school_year: { id: number; label: string; start_date: string; end_date: string };
    semesters: { code: number; name: string; start_date: string; end_date: string; is_current: boolean }[];
    current_semester: number;
    assignments: Assignment[];
    subjects: { id: number; name: string }[];
    kinds: KindDef[];
    columns: Record<string, string>;
    statuses: Record<string, string>;
    bands: Band[];
    today: string;
}

export type TestStatus = 'draft' | 'scheduled' | 'grading' | 'done';

export interface TestRow {
    id: number; title: string; kind: string; grade_column: string; test_date: string; start_time: string | null;
    duration_minutes: number; max_score: number; status: TestStatus; note: string | null; paper_id: number | null;
    synced_at: string | null; semester: number; class_id: number; class_name: string; grade: number;
    subject_id: number; subject_name: string; student_count: number; scored: number; absent: number; avg: number | null;
}

export interface SheetStudent { student_id: number; code: string; full_name: string; score: number | null; absent: boolean; note: string | null; current: number | null }
export interface Sheet { test: TestRow; students: SheetStudent[] }

export interface CalEvent {
    key: string; type: 'official' | 'test'; date: string; start_time: string | null; duration_minutes: number;
    title: string; sub: string | null; class_id: number; class_name: string; subject_id: number; subject_name: string;
    test_id: number | null; status: TestStatus | null;
}

export interface ActivityRow { id: number; action: string; summary: string; created_at: string }

export interface Overview {
    counts: { draft: number; scheduled: number; grading: number; done: number; total: number };
    need_grading: TestRow[]; upcoming_tests: TestRow[]; upcoming_official: CalEvent[]; past_official: CalEvent[];
    class_avgs: { class_id: number; class_name: string; subject_id: number; subject_name: string; avg: number; n: number; pass_rate: number | null }[];
    bands: Band[]; questions: number; papers: number; recent: TestRow[]; activity: ActivityRow[];
}

export interface Analytics {
    test: TestRow; count: number; absent: number; ungraded: number;
    avg: number | null; median: number | null; min: number | null; max: number | null; std: number | null; pass_rate: number | null;
    histogram: number[]; bands: Band[];
    top: { student_id: number; code: string; full_name: string; score10: number }[];
    bottom: { student_id: number; code: string; full_name: string; score10: number }[];
    below5: number;
    trend: { id: number; title: string; test_date: string; kind: string; avg: number; n: number }[];
}

export interface Matrix {
    tests: { id: number; title: string; test_date: string; kind: string }[];
    students: { student_id: number; code: string; full_name: string; cells: { v: number | null; absent: boolean }[]; avg: number | null }[];
    column_avg: (number | null)[];
}

export type QKind = 'mcq' | 'essay' | 'truefalse';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
    id: number; subject_id: number; subject_name: string | null; grade: number; kind: QKind; difficulty: Difficulty;
    topic: string | null; content: string; options: string[] | null; answer: string | null; points: number; is_active: boolean;
    created_at?: string;
}
export interface QuestionPage {
    items: Question[]; total: number; page: number; per_page: number; by_difficulty: { easy: number; medium: number; hard: number };
}

export interface PaperRow {
    id: number; title: string; grade: number; subject_id: number; subject_name: string; duration_minutes: number;
    total_points: number; question_count: number; used_in: number; created_at: string;
}
export interface PaperFull {
    id: number; title: string; subject_name: string; grade: number; duration_minutes: number; total_points: number;
    teacher_name: string; school_year: string; items: (Question & { position: number })[];
}
export interface Generated { items: Question[]; shortage: Partial<Record<Difficulty, number>>; total_points: number }

export interface TestFormState {
    id?: number; class_id: number; subject_id: number; title: string; kind: string; grade_column: string; test_date: string;
    start_time: string; duration_minutes: number; max_score: number; paper_id: number | null; note: string; status: 'draft' | 'scheduled';
}

export interface Ctx {
    meta: Meta; semester: number; tick: number; refresh: () => void;
    goto: (v: ViewKey) => void; openSheet: (id: number) => void;
    newTest: (preset?: Partial<TestFormState>) => void; editTest: (t: TestRow) => void;
    analyzeTest: (t: { class_id: number; subject_id: number; id: number }) => void;
}