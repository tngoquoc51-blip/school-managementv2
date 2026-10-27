// Kiểu dữ liệu + hàm dùng chung của trang Phiếu thu (/api/kt/receipts/*). Dùng chung phiên đăng nhập với Đợt thu và Thu học phí.
export { api, KtError, qs, vnd, vndShort, fmtDate, downloadCsv, addDays } from '../../periods/_lib/api';
export { todayIso, initial, digits, group } from '../../collection/_lib/cash';

export type Receipt = {
    id: number; receipt_code: string; amount: number; method: string; method_label: string; reference: string | null; note: string | null;
    status: 'valid' | 'voided'; reason: string | null; paid_at: string | null; confirmed_at: string | null; day: string; cashier: string | null;
    student: { id: number; code: string; name: string; class: string | null; grade: number | null };
    invoice: { id: number; code: string; title: string };
    period: { id: number; code: string; name: string } | null;
    prints: number; recon: { by: string; at: string; note: string | null } | null; needs_recon: boolean; can_void: boolean;
};
export type Sum = { count: number; amount: number };
export type RegisterRes = {
    items: Receipt[]; total: number; page: number; pages: number; per_page: number; filtered_amount: number;
    summary: { valid: Sum; voided: Sum; recon: { todo: Sum; done: Sum }; by_method: { method: string; label: string; count: number; amount: number }[] };
};
export type RMeta = {
    years: { id: number; label: string; is_current: boolean }[];
    periods: { id: number; code: string; name: string; year_id: number; status: string }[];
    classes: { id: number; name: string; grade: number }[];
    cashiers: string[]; methods: { key: string; label: string; needs_ref: boolean }[]; grades: number[]; today: string;
};
export type Group = { key: string; label: string; count: number; amount: number; code?: string | null };
export type StatsRes = {
    days: number; from: string; to: string; total: number; count: number; avg_day: number; best_day: { date: string; amount: number; count: number } | null;
    series: { date: string; amount: number; count: number }[];
    by_method: Group[]; by_grade: Group[]; by_period: Group[]; by_cashier: Group[];
    month: { this: Sum; last: Sum; last_same: Sum };
    recon: { count: number; amount: number; done_count: number; done_amount: number };
    voided: Sum;
};

export const METHOD_TONE: Record<string, string> = { cash: 'ok', bank_transfer: 'info', card: 'warn', ewallet: 'info' };
const p2 = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
/** Khoảng ngày nhanh cho bộ lọc: hôm nay, 7 ngày, tháng này, tháng trước */
export function quickRange(k: 'today' | '7d' | 'month' | 'lastmonth'): [string, string] {
    const n = new Date();
    if (k === 'today') return [iso(n), iso(n)];
    if (k === '7d') { const f = new Date(); f.setDate(f.getDate() - 6); return [iso(f), iso(n)]; }
    if (k === 'month') return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(n)];
    return [iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), iso(new Date(n.getFullYear(), n.getMonth(), 0))];
}
export const changePct = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);