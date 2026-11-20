export type Status = 'pending' | 'approved' | 'resolved' | 'rejected' | 'cancelled';
export type Rank = 'Tốt' | 'Khá' | 'Đạt' | 'Chưa đạt';

export interface Category {
    id: number; code: string; name: string; group_name: string; severity: number; points: number;
    suggested_action: string | null; is_active: number; used_count?: number;
}
export interface Settings {
    base_score: number; tot_min: number; kha_min: number; dat_min: number; warn_score: number;
    repeat_count: number; repeat_days: number; appeal_days: number;
}
export interface Meta {
    year_id: number; semester: number;
    years: { id: number; label: string; is_current: number }[];
    classes: { id: number; name: string; grade: number }[];
    categories: Category[]; settings: Settings;
    permissions: { approve: boolean; create: boolean };
}
export interface Scope { yearId: number; semester: number }

export interface DiscRecord {
    id: number; code: string; school_year_id: number; semester: number; student_id: number; class_id: number; category_id: number;
    occurred_at: string; location: string | null; description: string; evidence_note: string | null; points: number; status: Status;
    reported_by_name: string; reviewed_by_name: string | null; reviewed_at: string | null; review_note: string | null;
    action_type: string | null; action_note: string | null; action_date: string | null; parent_notified: number; resolved_at: string | null;
    created_at: string; student_code: string; student_name: string; gender?: string; birth_date?: string; class_name: string; grade: number;
    category_name: string; group_name: string; severity: number; suggested_action?: string | null;
}
export interface ScoreInfo { deduct: number; add: number; violations: number; commendations: number; score: number; rank: Rank }
export interface LogItem { id: number; kind: string; summary: string; actor_name: string; created_at: string }
export interface Appeal {
    id: number; record_id: number; reason: string; status: 'pending' | 'accepted' | 'rejected'; response: string | null;
    responded_by_name: string | null; responded_at: string | null; created_by_name: string; created_at: string;
    record_code?: string; points?: number; category_name?: string; student_name?: string; student_code?: string; class_name?: string; occurred_at?: string;
}
export interface Commendation {
    id: number; kind: string; title: string; description: string | null; points: number; awarded_date: string;
    status: 'pending' | 'approved' | 'rejected'; created_by_name: string; reviewed_by_name: string | null; review_note: string | null;
    student_id: number; student_code?: string; student_name?: string; class_name?: string;
}
export interface Paged<T> { data: T[]; current_page: number; last_page: number; total: number; per_page: number }
export interface StudentHit { id: number; code: string; full_name: string; gender: string; class_name: string; class_id: number; score: number; rank: Rank }
export interface AlertItem { key: string; level: 'info' | 'warn' | 'danger'; tab: string; count: number; title: string; message: string }

export interface TabProps {
    meta: Meta; scope: Scope; tick: number;
    refresh: () => void; goTab: (t: string, filter?: Record<string, string>) => void;
    openRecord: (id: number) => void; openStudent: (id: number) => void; newRecord: () => void;
    filter?: Record<string, string>;
}