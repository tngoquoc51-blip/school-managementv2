export type Severity = 'info' | 'notice' | 'warning' | 'critical';
export type Status = 'success' | 'failed' | 'denied';

export interface LogRow {
    id: number;
    occurred_at: string;
    actor_type: string;
    actor_id: number | null;
    actor_name: string | null;
    actor_role: string | null;
    module: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    entity_label: string | null;
    severity: Severity;
    status: Status;
    summary: string;
    ip: string | null;
    method: string | null;
    path: string | null;
}

export interface LogDetail {
    log: LogRow & {
        request_id: string | null;
        user_agent: string | null;
        duration_ms: number | null;
        old_values: Record<string, unknown> | null;
        new_values: Record<string, unknown> | null;
        meta: Record<string, unknown> | null;
        prev_hash: string | null;
        row_hash: string | null;
        src_table: string | null;
    };
    diff: { field: string; old: unknown; new: unknown; changed: boolean }[];
    related: { same_request: Mini[]; same_entity: Mini[]; same_actor: Mini[] };
}

export interface Mini {
    id: number;
    occurred_at: string;
    actor_name: string | null;
    module: string;
    action: string;
    severity: Severity;
    status: Status;
    summary: string;
}

export interface Paged<T> {
    items: T[];
    meta: { page: number; per_page: number; total: number; last_page: number };
}

export interface Overview {
    range: string;
    from: string;
    kpi: {
        total: number; prev_total: number; failed: number; warnings: number; criticals: number;
        actors: number; ips: number; open_alerts: number; active_sessions: number;
    };
    series: { label: string; total: number; failed: number; risky: number }[];
    by_module: { module: string; c: number }[];
    by_severity: { severity: Severity; c: number }[];
    by_status: { status: Status; c: number }[];
    top_actors: { actor_type: string; actor_id: number; actor_name: string; actor_role: string; c: number; failed: number }[];
    top_ips: { ip: string; c: number; failed: number; actors: number }[];
    heatmap: { dow: number; hr: number; c: number }[];
    latest_critical: Mini[];
}

export interface Facets {
    modules: { module: string; c: number }[];
    actions: { action: string; c: number }[];
    roles: { actor_role: string; c: number }[];
}

export interface SecurityData {
    summary: { failed_24h: number; denied_7d: number; pii_access_7d: number; locked: number };
    failed_series: { label: string; count: number }[];
    suspicious_ips: { ip: string; c: number; accounts: number; last_seen: string }[];
    locked_accounts: {
        id: number; username: string; full_name: string; role: string; account_type: 'staff' | 'student';
        failed_attempts: number; locked_until: string | null; last_login_at: string | null;
    }[];
    recent_events: (Mini & { ip: string | null })[];
}

export interface SessionRow {
    id: number; user_id: number; username: string; full_name: string; role: string;
    account_type: 'staff' | 'student' | 'user'; created_at: string; expires_at: string | null;
}

export interface SessionsData {
    staff: SessionRow[];
    students: SessionRow[];
    totals: { staff: number; students: number; expired_staff: number; expired_students: number };
}

export interface FinanceData {
    payments: {
        total: number; confirmed: number; pending: number; rejected: number; cancelled: number;
        amount_confirmed: number; amount_voided: number;
    };
    events_30d: number;
    by_action: { action: string; c: number }[];
    by_actor: { actor_name: string; c: number }[];
    recent: (Mini & { actor_role: string | null; entity_label: string | null; ip: string | null })[];
    periods: { id: number; name?: string; title?: string; status?: string }[];
}

export interface AlertRow {
    id: number; rule_id: number | null; rule_code: string | null; rule_name: string | null;
    severity: Severity; title: string; detail: string | null; ref_log_id: number | null;
    actor_label: string | null; ip: string | null; status: 'open' | 'ack' | 'resolved';
    created_at: string; ack_by: string | null; ack_at: string | null;
    resolved_by: string | null; resolved_at: string | null; resolve_note: string | null;
}

export interface AlertsData extends Paged<AlertRow> {
    counts: Partial<Record<'open' | 'ack' | 'resolved', number>>;
}

export interface RuleRow {
    id: number; code: string; name: string; description: string | null; rule_type: string;
    match_action: string | null; threshold: number; window_minutes: number; severity: Severity;
    enabled: number; updated_by: string | null; updated_at: string | null;
}

export interface SettingsData {
    settings: Record<string, string | null>;
    stats: { total: number; first_at: string | null; last_at: string | null };
}

export interface Me { id: number; name: string; role: string; can_admin: boolean }

export type Filters = Partial<Record<
    'q' | 'module' | 'severity' | 'status' | 'actor_type' | 'action' | 'actor_id' | 'actor_role' | 'ip' |
    'entity_type' | 'entity_id' | 'from' | 'to' | 'sort' | 'dir', string>>;