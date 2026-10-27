// Kiểu dữ liệu + hàm dùng chung của trang Công nợ (/api/kt/debts/*). Dùng chung phiên đăng nhập với Đợt thu và Thu học phí.
export { api, KtError, qs, vnd, vndShort, fmtDate, downloadCsv } from '../../periods/_lib/api';

export type Promise_ = { id: number; date: string; amount: number; late: boolean };
export type Debtor = {
    id: number; code: string; name: string; class: string | null; class_id: number | null; grade: number | null;
    billed: number; paid: number; pending: number; balance: number; overdue: number; max_days: number; open_invoices: number; overdue_invoices: number; oldest_due: string | null;
    bucket: string | null; state: 'paid' | 'unpaid' | 'partial'; paid_pct: number;
    promise: Promise_ | null; last_note: { kind: string; text: string; at: string; by: string } | null; notes: number;
};
export type Aging = { key: string; label: string; count: number; amount: number };
export type Summary = {
    students: number; balance: number; overdue: number; overdue_students: number; unpaid: number; partial: number; pending: number; billed: number; paid: number;
    promise_open: number; promise_late: number; collect_pct: number;
};
export type ListRes = {
    items: Debtor[]; total: number; page: number; pages: number; per_page: number; filtered_balance: number;
    counts: { all: number; overdue: number; notdue: number; unpaid: number; partial: number }; summary: Summary; aging: Aging[];
};
export type DMeta = {
    years: { id: number; label: string; is_current: boolean }[];
    periods: { id: number; code: string; name: string; year_id: number }[];
    classes: { id: number; name: string; grade: number }[];
    grades: number[]; buckets: { key: string; label: string }[]; channels: { key: string; label: string }[]; today: string;
};
export type Group = { key: string; label: string; students: number; debtors: number; billed: number; paid: number; balance: number; overdue: number; paid_pct: number };
export type OverviewRes = {
    total: { billed: number; paid: number; balance: number; overdue: number; pending: number; debtors: number; students: number; overdue_students: number; collect_pct: number };
    aging: { key: string; label: string; invoices: number; amount: number }[];
    by_grade: Group[]; by_class: Group[];
    by_period: (Group & { year: string; invoices: number })[];
    top: { id: number; code: string; name: string; class: string | null; balance: number; overdue: number; max_days: number; bucket: string }[];
    promises: { open: number; late: number };
};
export type Note = {
    id: number; kind: 'note' | 'contact' | 'promise'; channel: string | null; channel_label: string | null; note: string;
    promise_date: string | null; promise_amount: number | null; status: string; by: string; at: string; resolved_by: string | null; resolved_at: string | null;
};
export type StudentRes = {
    student: { id: number; code: string; name: string; gender: string; birth_date: string; class: string | null; grade: number | null };
    summary: { billed: number; paid: number; pending: number; balance: number; overdue: number; max_days: number; open_invoices: number; state: string; bucket: string | null; paid_pct: number };
    invoices: { id: number; code: string; title: string; year: string; period: string | null; due_date: string; total: number; paid: number; pending: number; balance: number; days: number; bucket: string | null; state: 'paid' | 'partial' | 'unpaid' | 'overdue' }[];
    payments: { id: number; receipt_code: string; amount: number; method: string; at: string | null; invoice: string }[];
    notes: Note[];
};
export type PromiseRow = {
    id: number; student: { id: number; code: string; name: string; class: string | null }; date: string; amount: number; status: string; raw_status: string; balance: number;
    channel_label: string | null; note: string; by: string; at: string; days_left: number;
};
export type PromisesRes = { items: PromiseRow[]; total: number; page: number; pages: number; per_page: number; counts: { open: number; late: number } };

/** Màu theo tuổi nợ: từ xanh (chưa đến hạn) đến đỏ sẫm (trên 90 ngày) */
export const BUCKET_COLOR: Record<string, string> = { notdue: '#0ea5e9', d1_30: '#f59e0b', d31_60: '#f97316', d61_90: '#ef4444', d90p: '#991b1b' };
export const BUCKET_TONE: Record<string, string> = { notdue: 'info', d1_30: 'warn', d31_60: 'warn', d61_90: 'err', d90p: 'err' };
export const BUCKET_SHORT: Record<string, string> = { notdue: 'Chưa đến hạn', d1_30: '1–30 ngày', d31_60: '31–60 ngày', d61_90: '61–90 ngày', d90p: 'Trên 90 ngày' };
export const STATE_LABEL: Record<string, string> = { unpaid: 'Chưa đóng', partial: 'Đóng một phần', paid: 'Đã đóng đủ' };
export const INV_STATE: Record<string, [string, string]> = { paid: ['Đã đóng đủ', 'ok'], partial: ['Đóng một phần', 'info'], unpaid: ['Chưa đóng', 'warn'], overdue: ['Quá hạn', 'err'] };
export const PROMISE_STATE: Record<string, [string, string]> = {
    open: ['Còn hiệu lực', 'info'], late: ['Quá hẹn', 'err'], kept: ['Đã giữ lời', 'ok'], broken: ['Không giữ lời', 'err'], cancelled: ['Đã hủy', 'mut'], paid: ['Đã đóng đủ', 'ok'], done: ['', 'mut'],
};
export const KIND_LABEL: Record<string, string> = { note: 'Ghi chú', contact: 'Đã liên hệ', promise: 'Hẹn trả' };