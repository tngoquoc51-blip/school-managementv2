export type ViewKey = 'overview' | 'scoring' | 'ranking' | 'awards' | 'criteria' | 'activity';

export interface Tier { key: string; label: string; min: number; color: string }

export interface Criterion {
    id: number; code: string; name: string; category: string; points: number;
    is_active: number | boolean; sort_order: number;
}

export interface AwardDef {
    id: number; code: string; name: string; level: 'class' | 'school' | 'district';
    description: string | null; auto_suggest: number | boolean;
    min_score: number | null; min_gpa: string | null; allowed_conduct: string | null;
    max_unexcused: number | null; min_plus_points: number | null;
}

export interface Meta {
    actor: { name: string; role: string; teacher_id: number | null; is_admin: boolean; can_review: boolean; can_edit_criteria: boolean };
    class: { id: number; name: string; grade: number; room: string | null; homeroom_teacher: string | null; student_count: number };
    classes: { id: number; name: string; grade: number }[] | null;
    school_year: { id: number; label: string; start_date: string; end_date: string };
    semesters: { code: number; name: string; start_date: string; end_date: string; is_current: boolean }[];
    current_semester: number;
    base_score: number;
    tiers: Tier[];
    categories: Record<string, string>;
    criteria: Criterion[];
    awards: AwardDef[];
}

export interface StudentRow {
    id: number; code: string; full_name: string; gender: string; birth_date: string;
    score: number; plus_points: number; minus_points: number; record_count: number;
    tier: string; tier_label: string; gpa: number | null; conduct: string | null;
    absences: { excused: number; unexcused: number; late: number }; rank: number;
}

export interface RecordRow {
    id: number; student_id: number; student_name: string; student_code: string;
    criterion_id: number; criterion_name: string; category: string; points: number;
    record_date: string; note: string | null; semester: number;
    created_by_name: string | null; created_at: string; voided_at: string | null;
}

export interface RecordPage { items: RecordRow[]; total: number; page: number; per_page: number }

export type ProposalStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled';

export interface Proposal {
    id: number; student_id: number; student_name: string; student_code: string;
    award_id: number; award_name: string; award_level: string; semester: number;
    reason: string | null; score: number | null; gpa: number | null; conduct: string | null;
    status: ProposalStatus; proposed_by_name: string | null; submitted_at: string | null;
    reviewed_by_name: string | null; reviewed_at: string | null; review_note: string | null;
    decision_no: string | null; created_at: string;
}

export interface SuggestionItem {
    student: StudentRow; award_id: number; award_name: string; award_level: string;
    checks: { label: string; value: string | number | null; ok: boolean }[]; already: boolean;
}

export interface Overview {
    class_avg: number;
    class_rank: { school: number | null; school_total: number; grade: number | null; grade_total: number };
    totals: {
        students: number; records: number; plus_points: number; minus_points: number; net_points: number;
        draft: number; submitted: number; approved: number; rejected: number;
    };
    tiers: { key: string; label: string; color: string; count: number }[];
    categories: { key: string; label: string; plus: number; minus: number }[];
    trend: { week: string; plus: number; minus: number; net: number }[];
    top_criteria: { id: number; name: string; points: number; count: number }[];
    top_students: StudentRow[];
    attention: StudentRow[];
    recent: RecordRow[];
}

export interface ClassRank {
    class_id: number; name: string; grade: number; students: number;
    avg_score: number; rank: number; grade_rank: number; is_mine: boolean;
}

export interface ActivityRow { id: number; actor_name: string | null; action: string; summary: string; created_at: string }

export interface StudentDetail {
    student: StudentRow;
    per_semester: { semester: number; score: number; gpa: number | null; conduct: string | null; rank: number }[];
    categories: { key: string; label: string; plus: number; minus: number }[];
    records: RecordRow[];
    proposals: Proposal[];
}

export interface Scope { classId: number | null; semester: number }

/** Dữ liệu dùng chung truyền cho mọi tab */
export interface Ctx {
    meta: Meta;
    scope: Scope;
    students: StudentRow[];
    overview: Overview | null;
    loading: boolean;
    tick: number;
    refresh: () => void;
    reloadMeta: () => void;
    openStudent: (id: number) => void;
    goto: (v: ViewKey) => void;
}