export type TabKey = 'overview' | 'events' | 'security' | 'audit' | 'alerts' | 'storage';
export type Level = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical';
export type Range = '1h' | '24h' | '7d' | '30d' | '90d' | 'all';

export interface LogEvent {
    id: number;
    occurred_at: string;
    level: Level;
    level_no: number;
    category: string;
    action: string;
    actor: { type: string | null; id: number | null; name: string | null };
    subject: { type: string | null; id: string | null };
    summary: string;
    ip_address: string | null;
    http_method: string | null;
    route: string | null;
    status_code: number | null;
    duration_ms: number | null;
    request_id: string | null;
    source: string;
    pinned: boolean;
    has_diff: boolean;
}

export interface DiffRow {
    key: string;
    type: 'added' | 'removed' | 'changed';
    before: unknown;
    after: unknown;
}

export interface EventDetail {
    event: LogEvent & {
        user_agent: string | null;
        old_values: Record<string, unknown> | null;
        new_values: Record<string, unknown> | null;
        meta: Record<string, unknown> | null;
        pin_note: string | null;
        diff: DiffRow[];
    };
    related: { same_request: LogEvent[]; same_actor: LogEvent[]; same_ip: LogEvent[] };
}

export interface Paged<T> {
    items: T[];
    meta: { total: number; current_page: number; per_page: number; last_page: number };
}

export interface EventFilters {
    range: Range;
    from: string;
    to: string;
    level: Level[];
    category: string[];
    action: string;
    actor: string;
    ip: string;
    status: string;
    source: string;
    q: string;
    pinned: boolean;
    request_id: string;
    subject_type: string;
    subject_id: string;
    sort: 'occurred_at' | 'level_no' | 'duration_ms';
    dir: 'asc' | 'desc';
    page: number;
    per_page: number;
}

export interface Meta {
    levels: { key: Level; no: number }[];
    categories: { key: string; label: string }[];
    actions: { action: string; count: number }[];
    sources: string[];
    can_manage: boolean;
    total: number;
}

export interface Kpi {
    value: number;
    previous: number;
    delta: number | null;
}

export interface Overview {
    range: '24h' | '7d' | '30d';
    kpis: Record<'total' | 'errors' | 'warnings' | 'failed_logins' | 'actors' | 'ips' | 'critical' | 'logins', Kpi>;
    series: { t: string; ok: number; warning: number; error: number }[];
    by_category: { key: string; label: string; count: number; issues: number }[];
    by_level: { key: Level; count: number }[];
    top_actors: { type: string | null; id: number | null; name: string | null; count: number; issues: number }[];
    top_ips: { ip: string; count: number; failed: number }[];
    heatmap: number[][];
    anomalies: { kind: string; scope: string; label: string; current: number; baseline: number; z: number }[];
    health: { score: number; grade: string; parts: { key: string; label: string; penalty: number; detail: string }[] };
    open_incidents: { warning: number; error: number; critical: number };
    api: { count: number; avg_ms: number; p95_ms: number } | null;
    sources: { source: string; count: number; last_at: string | null }[];
    recent_severe: LogEvent[];
    generated_at: string;
}

export interface MiniEvent {
    id: number;
    occurred_at: string;
    actor_name: string | null;
    actor_type: string | null;
    ip: string | null;
}

export interface Security {
    summary: { failed_24h: number; success_24h: number; exports_7d: number; denied_24h: number };
    failed_timeline: { t: string; count: number }[];
    suspicious_ips: { ip: string; failed: number; success: number; targets: number; last_at: string | null; ok_after_fail: boolean }[];
    off_hours_logins: MiniEvent[];
    new_ip_logins: MiniEvent[];
    locked_accounts: { id: number; username: string; full_name: string; role: string | null; failed_attempts: number; locked_until: string | null; is_locked: boolean }[];
}

export interface AuditItem extends LogEvent {
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    changes: DiffRow[];
}

export interface AuditData extends Paged<AuditItem> {
    tables: { table: string; count: number }[];
}

export interface SavedView {
    id: number;
    name: string;
    filters: Partial<EventFilters>;
    shared: boolean;
    mine: boolean;
}

export interface Rule {
    id: number;
    name: string;
    description: string | null;
    category: string | null;
    action_pattern: string | null;
    min_level: Level;
    threshold: number;
    window_minutes: number;
    cooldown_minutes: number;
    severity: 'warning' | 'error' | 'critical';
    enabled: boolean;
    last_triggered_at: string | null;
    open_incidents?: number;
    matching_now?: number;
}

export type RuleInput = Omit<Rule, 'id' | 'last_triggered_at' | 'open_incidents' | 'matching_now'>;

export interface Incident {
    id: number;
    rule_id: number | null;
    rule_name: string | null;
    status: 'open' | 'acknowledged' | 'resolved';
    severity: 'warning' | 'error' | 'critical';
    title: string;
    detail: string | null;
    matched_count: number;
    last_log_id: number | null;
    triggered_at: string;
    acknowledged_by: string | null;
    acknowledged_at: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    note: string | null;
}

export interface IncidentList extends Paged<Incident> {
    counts: { open: number; acknowledged: number; resolved: number };
}

export interface StorageInfo {
    levels: { level: Level; no: number; count: number; oldest: string | null; newest: string | null; retention_days: number; expired: number }[];
    total: number;
    expired_total: number;
    bytes: number;
    pins: number;
    retention: Record<Level, number>;
}

export interface PurgeResult {
    dry_run: boolean;
    total: number;
    detail: { level: Level; days: number; matched: number; deleted: number }[];
}