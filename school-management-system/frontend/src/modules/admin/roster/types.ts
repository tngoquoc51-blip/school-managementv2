import type { Meta } from '@/modules/admin/categories/types';

export type { Meta };

export interface Year { id: number; label: string; is_current: boolean; status: string; start_date: string; end_date: string }
export type Gender = 'Nam' | 'Nữ';
export type AccStatus = 'active' | 'inactive' | 'locked' | 'pending' | null;

export interface StudentRow {
    id: number; code: string; full_name: string; gender: Gender; birth_date: string; admission_year: number;
    class_id: number | null; class_name: string | null; grade: number | null;
    account_id: number | null; username: string | null; account_status: AccStatus;
}

export interface ClassRow {
    id: number; school_year_id: number; grade: number; name: string;
    homeroom_teacher_id: number | null; homeroom_name: string | null; homeroom_code: string | null;
    students: number; male: number; female: number; subjects: number; capacity: number;
    size_state: 'ok' | 'over' | 'under' | 'empty';
    year_label?: string;
}

export interface ClassStudent { id: number; code: string; full_name: string; gender: Gender; birth_date: string; account_id: number | null; account_status: AccStatus }
export interface ClassSubject { id: number; subject_id: number; code: string; name: string; periods_per_week: number; teacher_id: number | null; teacher_name: string | null; slots: number }
export interface ClassDetail { class: ClassRow; students: ClassStudent[]; subjects: ClassSubject[] }

export interface Teacher { id: number; code: string; full_name: string; gender: string; subject: string | null; homeroom_of: string | null }
export interface SubjectLite { id: number; code: string; name: string; periods_per_week: number }

export interface StudentProfile {
    exists: boolean;
    [key: string]: string | number | boolean | null | undefined;
}

export interface StudentDetail {
    student: { id: number; code: string; full_name: string; gender: Gender; birth_date: string; admission_year: number; created_at: string };
    current_class: { school_year_id: number; year_label: string; class_id: number; class_name: string; grade: number } | null;
    enrollments: { school_year_id: number; year_label: string; class_id: number; class_name: string; grade: number }[];
    account: { id: number; username: string; email: string; status: string; last_login_at: string | null; must_change_password: boolean; password_changed_at: string | null; failed_attempts: number } | null;
    profile: StudentProfile;
    grades: { rows: { subject: string; hk1?: number | string | null; hk2?: number | string | null }[]; avg_hk1: number | null; avg_hk2: number | null };
    conduct: { year_label: string; hk1: string; hk2: string; year_result: string }[];
    invoices: { count: number; total: number };
    revealed: boolean;
}

export interface RosterOverview {
    year_id: number;
    totals: { students: number; enrolled: number; unplaced: number; classes: number };
    gender: { male: number; female: number };
    by_grade: { grade: number; classes: number; students: number }[];
    accounts: { missing: number; not_active: number };
    class_size: { over: number; under: number; empty: number; average: number; max: number; min: number };
    conduct: { label: string; count: number }[];
    warnings: { level: 'warning' | 'info'; message: string; target: 'students' | 'classes'; filter: string; count: number }[];
    recent: { id: number; entity: string; entity_label: string | null; action: string; user_name: string | null; created_at: string }[];
}

export interface AutoAssignResult { assigned: number; classes: { id: number; name: string; n: number; added: number }[] }
export interface BulkEnrollResult { processed: number; unchanged: number; skipped: { id: number; reason: string }[]; class_size: number; over_capacity: boolean }