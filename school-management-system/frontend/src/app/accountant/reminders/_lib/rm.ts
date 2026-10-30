// Kiểu dữ liệu + hàm dùng chung của trang Nhắc nợ phụ huynh (/api/kt/reminders/*). Dùng chung phiên đăng nhập với các trang Kế toán khác.
export { api, KtError, qs, vnd, vndShort, fmtDate, downloadCsv } from '../../periods/_lib/api';
export { BUCKET_COLOR, BUCKET_SHORT, BUCKET_TONE } from '../../debts/_lib/db';

export type Template = {
    id: number; code: string; name: string; level: number; level_label: string; subject: string; body: string;
    active: boolean; system: boolean; used: number; updated_by: string; updated_at: string | null;
};
export type Settings = { gap_days: number; school_name: string; contact: string; payment_info: string; payment_info_effective: string };
export type Channel = { key: string; label: string; hint: string; instant: boolean };
export type RMeta = {
    templates: Template[]; channels: Channel[]; levels: { key: number; label: string }[]; placeholders: { key: string; label: string }[]; settings: Settings;
    years: { id: number; label: string; is_current: boolean }[]; periods: { id: number; code: string; name: string; year_id: number }[];
    classes: { id: number; name: string; grade: number }[]; grades: number[]; buckets: { key: string; label: string }[]; today: string;
};
export type Recent = { count: number; last_at: string; last_level: number; last_channel: string; last_status: string; days_since: number };
export type SugItem = {
    id: number; code: string; name: string; class: string | null; grade: number | null; balance: number; overdue: number; max_days: number; open_invoices: number;
    bucket: string | null; oldest_due: string | null; paid_pct: number; level: number; eligible: boolean; reminder: Recent | null; promise: { date: string; amount: number } | null; next_in: number;
};
export type SugRes = {
    items: SugItem[]; total: number; page: number; pages: number; per_page: number; gap_days: number; filtered_balance: number;
    summary: { debtors: number; eligible: number; never: number; balance: number; by_level: Record<string, number> };
};
export type BatchRow = {
    id: number; name: string; channel: string; channel_label: string; level: number; level_label: string; by: string; at: string; total: number; queued: number; sent: number;
    read: number; cancelled: number; amount: number; paid: number; note: string | null; status: 'queued' | 'done' | 'cancelled';
};
export type BatchesRes = { items: BatchRow[]; total: number; page: number; pages: number; per_page: number };
export type RemItem = {
    id: number; student: { id: number; code: string; name: string; class: string | null }; subject: string; body: string; status: 'queued' | 'sent' | 'read' | 'cancelled';
    debt_amount: number; overdue_days: number; sent_at: string | null; read_at: string | null; paid: boolean; balance: number;
};
export type BatchRes = { batch: BatchRow & { subject: string; body: string }; items: RemItem[]; total: number; page: number; pages: number; per_page: number };
export type PreviewItem = { student: { id: number; code: string; name: string }; subject: string; body: string };
export type SendRes = { batch_id: number; created: number; instant: boolean; skipped: { id: number; code: string; name: string; reason: string; detail: string }[]; skipped_count: number };
export type StatsRes = {
    days: number; from: string; to: string; total: number; students: number; paid_after: number; paid_rate: number; inapp: number; read: number; read_rate: number; queued_all: number;
    by_channel: { key: string; label: string; count: number }[]; by_level: { key: number; label: string; count: number }[]; series: { date: string; count: number }[];
};

export const LEVEL_TONE: Record<number, string> = { 1: 'info', 2: 'warn', 3: 'err' };
export const STATUS: Record<string, [string, string]> = { queued: ['Chờ gửi', 'warn'], sent: ['Đã gửi', 'info'], read: ['Đã đọc', 'ok'], cancelled: ['Đã thu hồi', 'mut'] };
export const BATCH_STATUS: Record<string, [string, string]> = { queued: ['Còn tin chờ gửi', 'warn'], done: ['Hoàn tất', 'ok'], cancelled: ['Đã thu hồi', 'mut'] };
export const CHANNEL_ICON: Record<string, string> = { inapp: '◉', sms: '✉', zalo: '☏', print: '⎙' };
export const SKIP_LABEL: Record<string, string> = { recent: 'Mới nhắc gần đây', no_debt: 'Không còn nợ', unknown: 'Không rõ học sinh', too_long: 'Nội dung quá dài' };