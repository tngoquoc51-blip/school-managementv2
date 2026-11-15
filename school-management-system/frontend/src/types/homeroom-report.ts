export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived';
export type ReportType = 'weekly' | 'monthly' | 'semester' | 'yearly' | 'custom';

export interface HomeroomReport {
    id: number;
    class_id: number;
    class_name: string;
    teacher_id: number;
    teacher_name: string;
    report_type: ReportType;
    title: string;
    period_start: string | null;
    period_end: string | null;
    academic_year: string;
    semester: number;
    status: ReportStatus;
    summary: {
        total_students: number;
        avg_score: number;
        attendance_rate: number;
        good_conduct: number;
        violations: number;
        need_attention: number;
    };
    content?: string;
    submitted_at?: string | null;
    created_at: string;
    updated_at: string;
}

export interface SmartAlert {
    student_id: number;
    student_name: string;
    type: 'attendance' | 'academic' | 'conduct' | 'violation';
    message: string;
    level: 'warning' | 'danger';
}

export interface ReportSection {
    key: string;
    title: string;
    data: any;
    note?: string;
}