// Kiểu dữ liệu + hàm dùng chung của trang Thu học phí (/api/kt/cashier/*). Dùng chung phiên đăng nhập với trang Đợt thu.
export { api, KtError, qs, vnd, vndShort, fmtDate, fmtDateTime, downloadCsv, addDays } from '../../periods/_lib/api';

export type Method = { key: string; label: string; needs_ref: boolean };
export type Meta = {
    year: { id: number; label: string };
    classes: { id: number; name: string; grade: number }[];
    methods: Method[];
    cashiers: string[];
    limits: { min_amount: number; max_total: number; backdate_days: number };
    today: string;
    pay_info: { bank_short: string; bank_bin: string; account_no: string; account_name: string; demo_note: string | null };
};

export type StudentRow = {
    id: number; code: string; name: string; class: string | null; grade: number | null;
    balance: number; overdue: number; pending: number; paid: number; billed: number; open_invoices: number; max_days: number;
    state: 'none' | 'overdue' | 'owing' | 'paid';
};

export type PayRow = {
    id: number; receipt_code: string; amount: number; method: string; method_label: string; reference: string | null; note: string | null;
    status: 'confirmed' | 'pending' | 'rejected' | 'voided' | 'cancelled'; paid_at: string | null; paid_iso: string; confirmed_by: string | null; confirmed_at: string | null;
    reason: string | null; wait_days: number; can_void: boolean;
    student: { id: number; code: string; name: string; class: string | null };
    invoice: { id: number; code: string; title: string; total?: number; balance?: number };
};

export type InvLine = { description: string; quantity: number; unit_price: number; discount: number; amount: number };
export type Invoice = {
    id: number; code: string; title: string; term: string; term_label: string; year: string; current_year: boolean;
    period: { id: number; name: string; status: string } | null;
    issue_date: string | null; due_date: string | null; due_iso: string; subtotal: number; discount: number; total: number; paid: number; pending: number;
    balance: number; collectable: number; status: 'paid' | 'partial' | 'unpaid'; overdue: boolean; overdue_days: number; lines: InvLine[];
};
export type Dispute = { id: number; invoice_id: number; invoice_code: string; message: string; status: 'open' | 'answered'; reply: string | null; replied_by: string | null; created_at: string | null; replied_at: string | null };
export type StudentDetail = {
    student: { id: number; code: string; name: string; gender: string; birth_date: string | null; class: string | null; grade: number | null; year: string };
    totals: { billed: number; paid: number; pending: number; balance: number; overdue: number; collectable: number };
    invoices: Invoice[];
    waivers: { id: number; year: string; label: string; percent: number; approved_by: string | null }[];
    recent_payments: PayRow[];
    disputes: Dispute[];
};

export type Overview = {
    today: { date: string; amount: number; count: number; by_method: { method: string; label: string; count: number; amount: number }[] };
    month: { amount: number; count: number };
    pending: { count: number; amount: number; oldest_days: number };
    disputes_open: number;
    debt: { balance: number; overdue: number; students: number; overdue_students: number };
    top_debtors: { id: number; code: string; name: string; class: string | null; grade: number | null; overdue: number; balance: number; max_days: number }[];
    recent: PayRow[];
};

export const STATE: Record<string, { label: string; tone: string }> = {
    overdue: { label: 'Quá hạn', tone: 'err' },
    owing: { label: 'Còn nợ', tone: 'warn' },
    paid: { label: 'Đã đóng đủ', tone: 'ok' },
    none: { label: 'Chưa có hóa đơn', tone: 'mut' },
};
export const PAY_STATUS: Record<string, { label: string; tone: string }> = {
    confirmed: { label: 'Đã thu', tone: 'ok' },
    pending: { label: 'Chờ xác nhận', tone: 'warn' },
    rejected: { label: 'Đã từ chối', tone: 'err' },
    voided: { label: 'Đã hủy phiếu', tone: 'mut' },
    cancelled: { label: 'Học sinh đã hủy', tone: 'mut' },
};

const p2 = (n: number) => String(n).padStart(2, '0');
/** Giá trị cho <input type="datetime-local"> của thời điểm hiện tại */
export const nowInput = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
export const initial = (name: string) => (name.trim().split(/\s+/).pop() || '?').charAt(0).toUpperCase();
/** "2026-10-25T09:30" -> "2026-10-25 09:30:00" */
export const toServerTime = (v: string) => (v ? v.replace('T', ' ') + ':00' : '');
export const digits = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;
export const group = (n: number) => (n ? n.toLocaleString('vi-VN') : '');