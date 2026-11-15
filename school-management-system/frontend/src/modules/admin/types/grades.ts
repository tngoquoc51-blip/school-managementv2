export interface GradeException {
    id: number;
    class_id: number;
    class_name: string;
    subject_id: number | null;
    subject_name: string | null;
    expires_at: string | null;
}

export interface GradeWindow {
    school_year_id: number;
    semester: 1 | 2;
    status: 'open' | 'closed';
    opened_at: string | null;
    closes_at: string | null;
    closed_at: string | null;
    note: string | null;
    exceptions: GradeException[];
}

export interface GradeClassLite { id: number; name: string; grade: number }
export interface GradeSubjectLite { id: number; name: string; code: string }

export interface GradeWindowsOverview {
    windows: GradeWindow[];
    classes: GradeClassLite[];
    subjects: GradeSubjectLite[];
}

export interface GradeActivity {
    id: number;
    school_year_id: number;
    semester: number;
    action: string;
    detail: string | null;
    created_at: string;
    user_name: string | null;
}