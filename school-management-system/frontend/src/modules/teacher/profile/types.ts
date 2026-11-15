export type TabKey = 'overview' | 'personal' | 'teaching' | 'qualifications' | 'requests' | 'security' | 'settings' | 'activity';

export interface Teacher { id: number; code: string; full_name: string; gender: string; main_subject_id: number; subject_name?: string | null }
export interface Profile {
    gender: string | null; birth_date: string | null; id_number: string | null; address: string | null; job_title: string | null; department: string | null;
    joined_at: string | null; bio: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null; emergency_contact_relation: string | null;
    email: string | null; ethnicity: string | null; religion: string | null; hometown: string | null; degree_level: string | null; major: string | null; career_start_year: number | null;
}
export interface HomeroomClass { id: number; name: string; grade: number; room: string | null; capacity: number; students: number; male: number; female: number; pending_leaves: number }
export interface Overview {
    user: { id: number; name: string; email: string; username: string | null; phone: string | null; avatar: string | null; status: string };
    teacher: Teacher | null;
    profile: Profile | null;
    homeroom_detail: HomeroomClass[];
    stats: { teaching_classes: number; periods_per_week: number; homeroom: string[]; qualifications: number; years_of_service: number | null };
    completion: { percent: number; missing: { key: string; label: string; tab: TabKey }[] };
}
export interface Teaching {
    classes: { class_subject_id: number; class_id: number; class_name: string; grade: number; room: string | null; capacity: number; subject_name: string }[];
    slots: { weekday: number; period: number; class_name: string; room: string | null; subject_name: string }[];
    periods: { id: number; start_time: string; end_time: string }[];
    homeroom: { id: number; name: string; grade: number; room: string | null; capacity: number }[];
}
export type QualType = 'degree' | 'certificate' | 'training' | 'award';
export interface Qualification { id: number; type: QualType; title: string; organization: string | null; issued_year: number | null; expires_at: string | null; note: string | null }
export interface ChangeRequest { id: number; field_key: string; old_value: string | null; new_value: string; reason: string; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; review_note: string | null; reviewed_by: string | null; reviewed_at: string | null; created_at: string }
export interface Session { id: number; name: string; last_used_at: string | null; created_at: string; expires_at?: string | null; current: boolean }
export interface LoginEntry { id: number; status: string; ip_address: string | null; device: string | null; browser: string | null; platform: string | null; created_at: string }
export interface Settings {
    theme: 'light' | 'dark' | 'system'; language: 'vi' | 'en'; timezone: string; date_format: string; density: 'comfortable' | 'compact';
    notification_prefs: Record<'email' | 'push' | 'grades' | 'attendance' | 'system' | 'security', boolean>; password_changed_at: string | null;
}
export interface ActivityPage { data: { id: number; action: string; description: string; ip_address: string | null; created_at: string }[]; current_page: number; last_page: number; total: number }