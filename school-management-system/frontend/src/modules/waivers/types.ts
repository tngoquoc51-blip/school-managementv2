export type WStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Year { id: number; label: string; is_current: number }
export interface ClassRow { id: number; name: string; grade: number }

export interface WType {
    id: number; code: string; label: string; description: string | null; default_percent: number;
    applies_to: string; legal_basis: string | null; required_docs: string | null;
    is_active: number; sort_order: number; usage?: number;
}

export interface Meta {
    years: Year[]; current_year_id: number; types: WType[]; classes: ClassRow[];
    tuition_per_term: number; auto_apply: boolean; terms: string[]; can_approve: boolean; me: string;
}

export interface WRequest {
    id: number; code: string; student_id: number; school_year_id: number; type_id: number; kind: string; label: string;
    percent: number; terms: string; reason: string | null; proof_note: string | null; priority: 'normal' | 'high';
    status: WStatus; requested_by: string | null; requested_at: string; reviewed_by: string | null;
    reviewed_at: string | null; review_note: string | null; waiver_id: number | null;
    student_code: string; student_name: string; gender?: string; birth_date?: string; class_name: string | null; grade: number | null;
}

export interface WRecord {
    id: number; student_id: number; student_code: string; student_name: string; class_name: string | null; grade: number | null;
    kind: string; label: string; percent: number; terms: string; note: string | null; approved_by: string | null;
    status: 'active' | 'revoked'; valid_from: string | null; created_at: string; revoked_at: string | null;
    revoke_reason: string | null; estimate: number;
}

export interface Paged<T> { items: T[]; meta: { page: number; per_page: number; total: number; last_page: number } }

export interface Stats {
    requests: Record<WStatus, number>; active_count: number; students: number; enrolled: number; estimate: number;
    by_type: { kind: string; label: string; count: number; estimate: number }[];
    by_grade: { grade: number; students: number }[];
    trend: { m: string; status: string; c: number }[];
    pending_queue: { id: number; code: string; label: string; percent: number; priority: string; requested_at: string; student_name: string; student_code: string; class_name: string | null }[];
}

export interface StudentHit {
    id: number; code: string; full_name: string; gender: string; birth_date: string; class_name: string; grade: number;
    waivers: { label: string; percent: number }[]; pending: number;
}

export interface Impact {
    grade: number | null; capped: boolean;
    terms: { term: string; tuition: number; current_percent: number; projected_percent: number; current_discount: number; projected_discount: number; invoice: { code: string; total: number; paid: number } | null }[];
}

export interface InvoiceChange { invoice: string; term: string; old_total: number; new_total: number; paid: number; result: 'updated' | 'unchanged' | 'skipped_paid' | 'will_update' }

export interface LogRow { id: number; action: string; actor: string | null; detail: any; created_at: string; student_name: string | null; student_code: string | null; request_id: number | null }