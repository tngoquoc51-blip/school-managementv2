export type Period = 'week' | 'month' | 'semester' | 'year';
export type Mode = 'reward' | 'discipline' | 'emulation';
export type View = 'home' | 'honor' | 'types' | 'overview' | 'ranking' | 'scoring' | 'awards' | 'criteria' | 'logs';

export interface Meta {
    year: { id: number; label: string; start_date: string; end_date: string };
    years: { id: number; label: string }[];
    classes: { id: number; name: string; grade: number }[];
    categories: Record<string, string>;
    default_date: string;
    can: { review: boolean };
}

export interface Range { from: string; to: string; label: string }

export interface RankItem {
    id: number; name: string; grade: number; homeroom: string | null;
    score: number; plus: number; minus: number; weeks: number; rank: number;
    prev_rank?: number | null; delta?: number | null;
}

export interface WeekPoint { label: string; from: string; avg: number; plus: number; minus: number }
export interface Cat { category: string; plus: number; minus: number }
export interface LogRow { id: number; user_name: string; action: string; description: string; created_at: string }

export interface OverviewData {
    range: Range;
    kpi: {
        avg: number; plus: number; minus: number; records: number; pending: number; approved: number;
        prev: { avg: number; plus: number; minus: number };
    };
    trend: WeekPoint[]; categories: Cat[];
    top: RankItem[]; bottom: RankItem[]; by_grade: RankItem[]; recent: LogRow[];
}

export interface Criterion {
    id: number; code: string; name: string; category: string; type: 'plus' | 'minus';
    default_points: number | string; description: string | null; is_active: number; sort_order?: number; used?: number;
}

export interface RecordRow {
    id: number; record_date: string; points: number | string; note: string | null;
    recorded_by_name: string | null; recorded_by?: number | null;
    criteria: string; category: string; class_name?: string; class_id?: number;
}

export interface Paged<T> { data: T[]; current_page: number; last_page: number; total: number }

export interface Award {
    type_id?: number | null; type_name?: string | null; bonus_points?: number | string; bonus_applied?: number;
    id: number; target_type: 'class' | 'student'; class_id: number | null; student_id: number | null;
    class_name: string | null; student_name: string | null; student_code: string | null;
    kind: 'khen_thuong' | 'nhac_nho' | 'ky_luat'; title: string; reason: string;
    level: string | null; period_label: string | null; status: 'pending' | 'approved' | 'rejected';
    proposed_by_name: string | null; reviewed_by_name: string | null; reviewed_at: string | null;
    review_note: string | null; created_at: string;
}

export interface ClassDetail {
    class: { id: number; name: string; grade: number; room: string | null; capacity: number; homeroom: string | null; students: number };
    range: Range;
    rank: { school: number | null; total: number; score: number; grade: number; grade_total: number };
    weekly: WeekPoint[]; categories: Cat[]; records: RecordRow[];
    awards: { id: number; kind: Award['kind']; title: string; status: Award['status']; created_at: string }[];
}

export interface StudentHit { id: number; code: string; full_name: string; class_id: number | null; class_name: string | null }

export interface ViewProps {
    mode: Mode; kinds: string;
    meta: Meta; yearId: number; date: string; period: Period; rev: number;
    openClass: (id: number) => void;
    openScore: (ids?: number[]) => void;
    openAward: (o?: { classId?: number }) => void;
    changed: () => void;
    go: (v: View) => void;
}

export interface AwardType {
    id: number; code: string; name: string; level: string; target_type: 'class' | 'student' | 'both';
    bonus_points: number | string; description: string | null; is_active: number; sort_order: number; used?: number;
}
export interface AwardsOverview {
    by_kind: { kd: string; n: number }[];
    kpi: { approved: number; pending: number; rejected: number; classes: number; students: number; bonus: number };
    by_month: { ym: string; label: string; n: number }[];
    by_level: { lv: string; n: number }[];
    top_classes: { id: number; name: string; n: number }[];
    recent: Award[]; pending: Award[];
}