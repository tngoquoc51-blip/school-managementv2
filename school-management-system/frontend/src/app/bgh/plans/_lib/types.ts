export interface Plan {
    id: number; code: string; title: string; level: string; category: string; school_year: string | null; term: string | null;
    parent_id: number | null; owner_name: string | null; department: string | null; start_date: string | null; end_date: string | null;
    status: string; priority: string; progress: number; budget: number | null; spent: number;
    objectives: string | null; content: string | null; result: string | null;
    submitted_at: string | null; approved_at: string | null; approval_note: string | null; completed_at: string | null; updated_at: string;
    tasks_total: number; tasks_done: number; children_count: number; is_late: boolean; days_left: number | null;
}
export interface Task {
    id: number; plan_id: number; title: string; description: string | null; assignee_name: string | null;
    start_date: string | null; due_date: string | null; status: string; priority: string; weight: number; completed_at: string | null;
}
export interface Link { id: number; kind: string; label: string; url: string | null }
export interface Activity { id: number; plan_id: number; type: string; message: string; user_name: string | null; created_at: string; plan_title?: string }
export interface MiniPlan { id: number; code: string; title: string; status: string; priority: string; progress: number; start_date: string | null; end_date: string | null; owner_name: string | null; category: string }
export interface Detail {
    plan: Plan; parent: { id: number; code: string; title: string } | null;
    children: { id: number; code: string; title: string; status: string; progress: number; start_date: string | null; end_date: string | null; level: string }[];
    tasks: Task[]; links: Link[]; activities: Activity[];
}
export interface Template { key: string; title: string; desc: string; level: string; category: string; duration_days: number; tasks: number }
export interface Options {
    levels: Record<string, string>; categories: Record<string, string>; statuses: Record<string, string>; priorities: Record<string, string>;
    task_statuses: Record<string, string>; transitions: Record<string, string[]>; templates: Template[];
    link_targets: { kind: string; label: string; url: string }[]; school_years: string[]; current_year: string; owners: string[];
}
export interface Summary { total: number; by_status: Record<string, number>; late: number; avg_progress: number; budget: number; spent: number }
export interface Stats {
    total: number; avg_progress: number; budget: number; spent: number; by_status: Record<string, number>;
    by_category: { key: string; label: string; count: number; progress: number }[];
    late: MiniPlan[]; soon: MiniPlan[]; pending: MiniPlan[];
    tasks: { overdue: number; due_week: number; blocked: number; done_month: number };
    months: { label: string; year: number; count: number }[]; recent: Activity[];
}
export interface Filters {
    q: string; status: string; level: string; category: string; school_year: string; priority: string; owner: string; view: string;
    sort: string; dir: 'asc' | 'desc'; page: number;
}

export const STATUS_ORDER = ['draft', 'pending', 'approved', 'running', 'paused', 'completed', 'rejected', 'cancelled'];
export const STATUS_TONE: Record<string, 'ok' | 'warn' | 'err' | 'mut' | 'pri' | 'vio' | 'sky'> = {
    draft: 'mut', pending: 'warn', approved: 'sky', running: 'pri', paused: 'vio', completed: 'ok', rejected: 'err', cancelled: 'mut',
};
export const STATUS_COLOR: Record<string, string> = {
    draft: '#94a3b8', pending: '#f59e0b', approved: '#14b8a6', running: '#0284c7', paused: '#8b5cf6', completed: '#10b981', rejected: '#ef4444', cancelled: '#cbd5e1',
};
export const PRIORITY_TONE: Record<string, 'ok' | 'warn' | 'err' | 'mut' | 'pri' | 'sky'> = { low: 'mut', normal: 'sky', high: 'warn', urgent: 'err' };
export const TASK_TONE: Record<string, 'ok' | 'warn' | 'err' | 'mut' | 'pri'> = { todo: 'mut', doing: 'pri', review: 'warn', done: 'ok', blocked: 'err' };