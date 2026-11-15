import type { ReactNode } from 'react';

export interface Envelope<T> {
    success: boolean;
    message: string;
    data: T;
    errors?: Record<string, string[]> | null;
}

export interface Meta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface Paged<T> {
    items: T[];
    meta: Meta;
}

export interface BaseRow {
    id: number;
    code: string;
    name: string;
    is_active: boolean;
    is_system: boolean;
    sort_order: number;
    updated_at?: string | null;
}

export interface CatalogGroup extends BaseRow {
    description: string | null;
    icon: string | null;
    color: string | null;
    items_count?: number;
    active_items_count?: number;
}

export interface CatalogItem extends BaseRow {
    group_id: number;
    short_name: string | null;
    value: string | null;
    description: string | null;
    color: string | null;
}

export interface Department extends BaseRow {
    description: string | null;
    head_name: string | null;
    phone: string | null;
    email: string | null;
    subjects_count?: number;
}

export interface Subject extends BaseRow {
    short_name: string | null;
    subject_group: string;
    department_id: number | null;
    department?: { id: number; code: string; name: string } | null;
    periods_per_week: number;
    coefficient: number;
    kind: string;
    grading_type: string;
    applicable_grades: number[];
    description: string | null;
    color: string | null;
}

export interface Room extends BaseRow {
    room_type: string;
    building: string | null;
    floor: number;
    capacity: number;
    facilities: string | null;
    status: string;
}

export interface AuditLog {
    id: number;
    entity: string;
    entity_id: number;
    entity_label: string | null;
    action: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    user_name: string | null;
    ip: string | null;
    restored_at: string | null;
    can_restore: boolean;
    created_at: string;
}

export interface BulkResult {
    action: 'activate' | 'deactivate' | 'delete';
    processed: number;
    skipped: { id: number; reason: string }[];
}

export interface ImportResult {
    created: number;
    updated: number;
    skipped: number;
    errors: { row: number; message: string }[];
}

export interface Overview {
    counts: Record<'groups' | 'items' | 'subjects' | 'departments' | 'rooms', { total: number; active: number }>;
    room_capacity: number;
    periods_per_week: number;
    subjects_by_group: { key: string; label: string; count: number }[];
    rooms_by_type: { key: string; label: string; count: number }[];
    top_groups: { id: number; code: string; name: string; color: string | null; items_count: number }[];
    warnings: { level: 'warning' | 'info'; message: string; tab: TabId; count: number }[];
    recent: { id: number; entity: string; entity_label: string | null; action: string; user_name: string | null; created_at: string }[];
}

export type TabId = 'overview' | 'users' | 'roles' | 'subjects' | 'departments' | 'rooms' | 'lookups' | 'audit';

export interface Option {
    value: string | number;
    label: string;
}

export type ListParams = {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    sort?: string;
    dir?: 'asc' | 'desc';
} & Record<string, string | number | undefined>;

export interface ResourceApi<T> {
    list: (params: ListParams) => Promise<Paged<T>>;
    create: (body: Record<string, unknown>) => Promise<T>;
    update: (id: number, body: Record<string, unknown>) => Promise<T>;
    toggle: (id: number) => Promise<T>;
    remove: (id: number, force?: boolean) => Promise<{ audit_id: number }>;
    bulk: (action: BulkResult['action'], ids: number[]) => Promise<BulkResult>;
    exportCsv: (params: ListParams) => Promise<void>;
}

export type FieldType = 'text' | 'number' | 'select' | 'textarea' | 'color' | 'switch' | 'multicheck';

export interface FieldDef {
    name: string;
    label: string;
    type: FieldType;
    required?: boolean;
    placeholder?: string;
    hint?: string;
    options?: Option[];
    span?: 1 | 2;
    min?: number;
    max?: number;
    step?: number;
    uppercase?: boolean;
    /** Không cho đổi mã khi sửa (mã đã được dùng làm khóa tham chiếu). */
    lockOnEdit?: boolean;
    /** Với mục hệ thống thì khóa trường này. */
    lockWhenSystem?: boolean;
}

export interface ColumnDef<T> {
    key: string;
    title: string;
    sortKey?: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    render: (row: T) => ReactNode;
}

export interface FilterDef {
    key: string;
    label: string;
    options: Option[];
}

export interface ResourceConfig<T extends BaseRow> {
    /** "môn học", "phòng học"... dùng trong câu thông báo. */
    singular: string;
    api: ResourceApi<T>;
    columns: ColumnDef<T>[];
    fields: FieldDef[];
    filters?: FilterDef[];
    /** Giá trị mặc định khi thêm mới. */
    defaults: Record<string, unknown>;
    searchPlaceholder: string;
    defaultSort?: { key: string; dir: 'asc' | 'desc' };
    /** Tiêu đề hiển thị của một dòng (dùng trong hộp xác nhận). */
    rowTitle: (row: T) => string;
    /** Câu cảnh báo thêm khi xóa (vd. "Các môn thuộc tổ này sẽ…"). */
    deleteNote?: (row: T) => string | null;
}

export type AccountType = 'web' | 'staff' | 'student';
export type AccountStatus = 'active' | 'pending' | 'locked' | 'inactive';

export interface UserRow {
    key: string;
    type: AccountType;
    type_label: string;
    id: number;
    name: string;
    username: string | null;
    email: string | null;
    phone: string | null;
    roles: string[];
    role_labels: string[];
    status: AccountStatus;
    locked_until: string | null;
    last_login_at: string | null;
    must_change_password: boolean;
    created_at: string | null;
    is_self: boolean;
}

export interface UserSummary {
    total: number;
    types: { key: AccountType; label: string; count: number }[];
    status: Record<AccountStatus, number>;
    logged_in_7d: number;
    must_change_password: number;
}

export interface RoleRow {
    id: number;
    name: string;
    label: string;
    users_count: number;
    permissions: string[];
    locked: boolean;
}

export interface UserBulkResult {
    action: 'lock' | 'unlock' | 'deactivate';
    processed: number;
    skipped: { key: string; reason: string }[];
}