export type Mode = 'insert' | 'upsert' | 'update';

export interface FieldMeta {
    key: string;
    label: string;
    type: string;
    required: boolean;
    aliases: string[];
    usable: boolean;
    sensitive: boolean;
    lookup: boolean;
}

export interface Dataset {
    id: string;
    title: string;
    noun: string;
    icon: string;
    table_exists: boolean;
    count: number | null;
    upsert: string;
    fields: FieldMeta[];
    missing: string[];
    has_account: boolean;
}

export interface Limits {
    chunk: number;
    total: number;
    undo_days: number;
}

export interface RowIssue {
    n: number;
    action: 'insert' | 'update' | null;
    errors: string[];
}

export interface Batch {
    id: number;
    dataset: string;
    filename: string | null;
    mode: Mode;
    total: number;
    processed: number;
    inserted: number;
    updated: number;
    unchanged: number;
    failed: number;
    status: 'running' | 'completed' | 'completed_with_errors' | 'cancelled' | 'undone';
    created_by: number | null;
    user_name?: string | null;
    started_at: string | null;
    finished_at: string | null;
    undone_at: string | null;
    created_at: string;
    errors?: { row: number; message: string }[];
    options?: Record<string, unknown>;
    can_undo?: boolean;
}

export interface ExportLog {
    id: number;
    dataset: string;
    format: string;
    rows_count: number;
    columns: string[];
    filters: Record<string, unknown>;
    masked: boolean;
    ip: string | null;
    created_by: number | null;
    user_name?: string | null;
    created_at: string;
}

export interface Overview {
    imports_total: number;
    imports_month: number;
    rows_imported_month: number;
    exports_month: number;
    running: number;
    recent_imports: Batch[];
    recent_exports: ExportLog[];
}

export interface SavedMapping {
    id: number;
    dataset: string;
    name: string;
    mapping: Record<string, string>;
}

export const STATUS_LABEL: Record<string, string> = {
    running: 'Đang chạy',
    completed: 'Hoàn tất',
    completed_with_errors: 'Hoàn tất (có lỗi)',
    cancelled: 'Đã hủy giữa chừng',
    undone: 'Đã hoàn tác',
};

export const MODE_LABEL: Record<Mode, string> = {
    insert: 'Chỉ thêm mới',
    upsert: 'Thêm mới & cập nhật',
    update: 'Chỉ cập nhật',
};