export type TabKey = 'overview' | 'invoices' | 'payments' | 'debts' | 'periods' | 'waivers' | 'disputes' | 'audit';

export interface Filters { year_id: number; period_id: number; grade: number }
export interface Meta {
    current_year_id: number;
    years: { id: number; label: string; is_current: number }[];
    periods: { id: number; code: string; name: string; school_year_id: number; term: string; status: string }[];
    classes: { id: number; name: string; grade: number; school_year_id: number }[];
}
export interface Page<T> { data: T[]; current_page: number; last_page: number; total: number; per_page: number }

export interface Overview {
    totals: { n: number; invoiced: number; paid: number; remaining: number; discount: number; overdue_n: number; overdue_amt: number; debtors: number; overdue_students: number; rate: number };
    monthly: { ym: string; amt: number; n: number }[];
    by_method: { method: string; amt: number; n: number }[];
    by_grade: { grade: number | null; invoiced: number; paid: number; remaining: number }[];
    top_classes: { class_id: number; class_name: string; grade: number; invoiced: number; remaining: number }[];
    by_period: { id: number; code: string; name: string; status: string; due_date: string; invoiced: number; paid: number; remaining: number }[];
    pending: { n: number; amt: number };
    disputes_open: number;
}

export interface InvoiceRow {
    id: number; code: string; student_id: number; student_code: string; student_name: string; class_name: string | null; grade: number | null; term: string; title: string;
    issue_date: string; due_date: string; subtotal: number; discount: number; total: number; paid: number; remaining: number; pay_status: string; overdue_days: number; period_id: number | null;
}
export interface InvoiceDetail {
    invoice: InvoiceRow;
    lines: { id: number; description: string; quantity: number; unit_price: number; discount: number; amount: number }[];
    payments: { id: number; receipt_code: string; amount: number; method: string; reference: string | null; status: string; paid_at: string; confirmed_by: string | null; reject_reason: string | null }[];
    disputes: { id: number; message: string; status: string; reply: string | null; created_at: string }[];
}

export interface PaymentRow {
    id: number; receipt_code: string; amount: number; method: string; reference: string | null; status: string; paid_at: string; confirmed_by: string | null; reject_reason: string | null;
    invoice_code: string; title: string; student_code: string; student_name: string; class_name: string | null;
}
export interface PaymentsPage extends Page<PaymentRow> { summary: Record<string, { n: number; amt: number }> }

export interface DebtRow { student_id: number; student_code: string; student_name: string; class_name: string | null; grade: number | null; invoices_n: number; debt: number; max_overdue: number; notes_n: number; promise_date: string | null }
export interface DebtsPage extends Page<DebtRow> { summary: { students: number; debt: number; over90: number } }
export interface DebtNote { id: number; kind: 'note' | 'contact' | 'promise'; channel: string | null; note: string; promise_date: string | null; promise_amount: number | null; status: string; created_by: string; created_at: string }

export interface PeriodRow {
    id: number; code: string; name: string; term: string; grade: number | null; status: string; open_date: string; due_date: string; note: string | null; closed_at: string | null; closed_by: string | null;
    invoices_n: number; invoiced: number; paid: number; remaining: number; items: { code: string; name: string; category: string; amount: number }[];
}
export interface FeeItem { id: number; code: string; name: string; category: string; amount: number; unit: string; grade: number | null; is_mandatory: number; note: string | null }

export interface WaiverRow { id: number; kind: string; label: string; percent: number; note: string | null; approved_by: string | null; created_at: string; student_code: string; student_name: string; class_name: string | null; grade: number | null }
export interface WaiversData { summary: { kind: string; n: number; avg_percent: number }[]; data: WaiverRow[] }

export interface DisputeRow { id: number; invoice_id: number; message: string; status: string; reply: string | null; replied_by: string | null; created_at: string; replied_at: string | null; invoice_code: string; title: string; total: number; student_code: string; student_name: string; class_name: string | null }
export interface AuditRow { time: string; source: string; action: string; detail: string | null; actor: string; ref: string | null }