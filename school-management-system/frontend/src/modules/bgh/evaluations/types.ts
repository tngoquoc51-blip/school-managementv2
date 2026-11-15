export type Rating = 'excellent' | 'good' | 'pass' | 'fail';
export type Kind = 'planned' | 'surprise' | 'thematic' | 'followup';
export type PlanStatus = 'scheduled' | 'done' | 'cancelled';
export type ObsStatus = 'draft' | 'submitted' | 'acknowledged' | 'disputed' | 'closed';
export type ActStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export interface Teacher { id: number; code: string; full_name: string; gender: string; main_subject_id: number; subject_name: string | null }
export interface Subject { id: number; code: string; name: string }
export interface Klass { id: number; grade: number; name: string }
export interface RubricMini { id: number; code: string; name: string; is_active: number; criteria_count: number }
export interface Lookups {
    year: { id: number; label: string } | null;
    years: { id: number; label: string; is_current: number }[];
    teachers: Teacher[]; subjects: Subject[]; classes: Klass[];
    assignments: { class_id: number; subject_id: number; teacher_id: number }[];
    periods: { id: number; start_time: string; end_time: string }[];
    rubrics: RubricMini[];
}
export interface Settings {
    min_obs_per_semester: string; rating_excellent: string; rating_good: string; rating_pass: string;
    weight_observation: string; weight_professional: string; weight_results: string; weight_conduct: string; weight_innovation: string;
    remind_days_before: string; default_rubric_id: string; current_semester: string;
}
export interface Me { user: { id: number | null; full_name: string; role: string | null; can_admin: boolean }; settings: Settings }

export interface Paged<T> { items: T[]; total: number; page: number; per_page: number; last_page: number; counts: Record<string, number> }

export interface Plan {
    id: number; school_year_id: number; semester: number; teacher_id: number; teacher_code: string; teacher_name: string;
    class_id: number | null; class_name: string | null; subject_id: number | null; subject_name: string | null;
    plan_date: string; period: number | null; kind: Kind; topic: string | null; rubric_id: number | null; rubric_name: string | null;
    observer_name: string | null; status: PlanStatus; note: string | null; cancel_reason: string | null; postponed_count: number;
    observation_id: number | null; observation_status: ObsStatus | null; overdue: boolean;
}

export interface Obs {
    id: number; code: string; plan_id: number | null; semester: number; teacher_id: number; teacher_code: string; teacher_name: string; dept_name: string | null;
    class_id: number | null; class_name: string | null; subject_id: number | null; subject_name: string | null;
    rubric_id: number; rubric_name: string | null; rubric_code: string | null;
    observed_on: string; period: number | null; kind: Kind; topic: string | null; students_present: number | null; duration_min: number | null;
    total_score: string | null; rating: Rating | null; strengths: string | null; weaknesses: string | null; suggestions: string | null;
    status: ObsStatus; teacher_comment: string | null; teacher_ack_at: string | null; observer_name: string | null; submitted_at: string | null; closed_at: string | null;
}
export interface Criterion { id: number; rubric_id: number; group_name: string; name: string; description: string | null; weight: string; max_score: number; sort_order: number }
export interface HistoryRow { id: number; occurred_at: string; actor_name: string | null; action: string; summary: string; severity: string; status: string }
export interface Action {
    id: number; observation_id: number | null; teacher_id: number; teacher_name: string; teacher_code?: string; observation_code?: string | null;
    title: string; detail: string | null; priority: 'low' | 'normal' | 'high'; due_date: string | null; status: ActStatus;
    result_note: string | null; assigned_by: string | null; completed_at: string | null; overdue?: boolean; created_at: string;
}
export interface ObsDetail {
    observation: Obs; criteria: Criterion[]; scores: Record<string, { score: number; comment: string | null }>;
    history: HistoryRow[]; actions: Action[]; settings: Settings;
}

export interface Overview {
    year: number; semester: number;
    kpi: {
        plans_total: number; plans_done: number; plans_scheduled: number; plans_cancelled: number; plans_overdue: number; plans_next7: number;
        obs_total: number; obs_avg: number | null; obs_drafts: number; obs_pending_ack: number; obs_disputed: number;
        teachers_total: number; teachers_covered: number; teachers_below_min: number; min_required: number; actions_open: number; actions_overdue: number;
    };
    ratings: Record<Rating, number>;
    monthly: { m: string; c: string; a: string | null }[];
    by_subject: { id: number | null; name: string | null; c: string; a: string | null }[];
    top: TeacherAgg[]; bottom: TeacherAgg[];
    upcoming: PlanMini[]; overdue: PlanMini[];
    follow_up: { id: number; code: string; observed_on: string; total_score: string; rating: Rating; teacher_name: string; subject_name: string | null }[];
}
export interface TeacherAgg { id: number; code: string; full_name: string; subject_name: string | null; c: string; a: string | null }
export interface PlanMini { id: number; plan_date: string; period: number | null; kind: Kind; topic: string | null; observer_name: string | null; status: string; teacher_id: number; teacher_name: string; subject_name: string | null; class_name: string | null }

export interface TeacherRow {
    id: number; code: string; full_name: string; gender: string; main_subject_id: number; subject_name: string | null;
    obs_count: string; obs_avg: string | null; last_rating: Rating | null; last_date: string | null; upcoming: string; open_actions: string;
}
export interface TeacherProfile {
    teacher: Teacher | null; classes: { class_name: string; subject_name: string }[];
    observations: Pick<Obs, 'id' | 'code' | 'observed_on' | 'semester' | 'kind' | 'topic' | 'total_score' | 'rating' | 'status' | 'observer_name' | 'subject_name' | 'class_name'>[];
    groups: { group_name: string; pct: string; n: string }[];
    plans: { id: number; plan_date: string; period: number | null; kind: Kind; topic: string | null; status: string; observer_name: string | null }[];
    actions: Action[];
    periodic: PeriodicRow[];
}
export interface PeriodicRow {
    teacher_id?: number; code?: string; full_name?: string; subject_name?: string | null; obs_count: string | number; obs_avg?: string | null;
    id: number | null; score_observation?: string | null; score_professional: string | null; score_results: string | null; score_conduct: string | null; score_innovation: string | null;
    total_score: string | null; rating: Rating | null; comment: string | null; status: 'none' | 'draft' | 'submitted' | 'approved'; approved_by: string | null; approved_at: string | null;
    semester?: number; school_year_id?: number;
}
export interface RubricFull {
    id: number; code: string; name: string; description: string | null; is_active: number; criteria_count?: number; weight_sum?: string; used_count: number;
    criteria?: Criterion[];
}
export interface Report {
    year: number; semester: number;
    by_dept: { id: number | null; name: string | null; c: string; a: string | null; excellent: string; good: string; pass_: string; fail_: string; teachers: string; teacher_total: number }[];
    observers: { name: string; c: string; a: string | null }[];
    weakest_criteria: { id: number; name: string; group_name: string; pct: string; n: string }[];
    kinds: { kind: Kind; c: string; a: string | null }[];
}