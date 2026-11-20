export type FinStatus = 'paid' | 'debt' | 'overdue' | 'none';

export interface Staff { id: number; username: string; full_name: string; role: string; can_write: boolean }
export interface SchoolYear { id: number; label: string; is_current: number }
export interface ClassItem { id: number; school_year_id: number; grade: number; name: string }
export interface Bank { bank_bin: string | null; bank_name: string | null; account_no: string | null; account_name: string | null; transfer_hint: string | null; demo_note: string | null }
export interface School { name: string; address: string; hotline: string; office: string; receipt_footer: string; receipt_accountant: string; receipt_treasurer: string }
export interface Template { id: number; code: string; name: string; level: number; subject: string; body: string }
export interface Meta {
    current_year_id: number; years: SchoolYear[]; classes: ClassItem[]; bank: Bank; school: School;
    waiver_kinds: Record<string, string>; payment_methods: { value: string; label: string }[]; templates: Template[]; today: string;
}

export interface StudentRow {
    id: number; code: string; full_name: string; gender: string; birth_date: string; class_id: number; class_name: string; grade: number;
    invoice_count: number; total: number; discount: number; paid: number; debt: number; overdue: number; open_invoices: number;
    next_due: string | null; max_overdue_days: number; pending_count: number; waiver_count: number; waiver_percent: number;
    open_promises: number; fin_status: FinStatus; rate: number;
}
export interface Kpi {
    students: number; total: number; paid: number; debt: number; overdue: number; rate: number; paid_students: number; debt_students: number;
    overdue_students: number; none_students: number; waiver_students: number; pending_payments: number;
}
export interface ListResp { items: StudentRow[]; meta: { page: number; per_page: number; total: number; last_page: number }; kpi: Kpi; year_id: number }

export interface Summary {
    invoice_count: number; total: number; discount: number; paid: number; debt: number; overdue: number; open_invoices: number;
    next_due: string | null; max_overdue_days: number; rate: number; fin_status: FinStatus;
}
export interface Profile {
    ethnicity: string | null; religion: string | null; birth_place: string | null; hometown: string | null; permanent_address: string | null;
    current_address: string | null; phone: string | null; father_name: string | null; father_job: string | null; father_phone: string | null;
    mother_name: string | null; mother_job: string | null; mother_phone: string | null; guardian_name: string | null;
    guardian_relation: string | null; guardian_phone: string | null;
}
export interface YearSummary { year_id: number; label: string; class_name: string | null; invoice_count: number; total: number; paid: number; debt: number; overdue: number; rate: number; fin_status: FinStatus }
export interface Detail {
    student: { id: number; code: string; full_name: string; gender: string; birth_date: string; admission_year: number };
    class: { id: number; name: string; grade: number } | null; year_id: number; profile: Profile | null;
    account: { username: string; email: string; status: string; last_login_at: string | null } | null;
    summary: Summary; all_time: Summary; years: YearSummary[]; waiver_percent: number;
    counts: { pending_payments: number; open_disputes: number; open_promises: number; late_promises: number; waivers: number; reminders: number };
}
export type InvoiceState = 'paid' | 'unpaid' | 'partial' | 'overdue' | 'cancelled';
export interface Invoice {
    id: number; code: string; student_id: number; school_year_id: number; year_label: string | null; term: string; title: string;
    issue_date: string; due_date: string; subtotal: number; discount: number; total: number; paid: number; pending: number;
    outstanding: number; payable: number; overdue_days: number; state: InvoiceState; status: string; note: string | null;
    open_disputes: number; pending_count: number;
}
export interface InvoiceLine { id: number; description: string; quantity: number; unit_price: number; discount: number; amount: number; category: string | null }
export interface Payment {
    id: number; receipt_code: string; invoice_id: number; invoice_code: string; invoice_title: string; amount: number; method: string;
    reference: string | null; payer_note: string | null; status: string; paid_at: string; confirmed_by: string | null; confirmed_at: string | null; reject_reason: string | null;
}
export interface InvoiceDetail { invoice: Invoice; student: { id: number; code: string; full_name: string }; lines: InvoiceLine[]; payments: Payment[]; disputes: Dispute[] }
export interface Waiver { id: number; school_year_id: number; year_label: string; kind: string; label: string; percent: number; note: string | null; approved_by: string | null; created_at: string }
export interface DebtNote {
    id: number; kind: 'note' | 'contact' | 'promise'; channel: string | null; note: string; promise_date: string | null; promise_amount: number | null;
    status: string; created_by: string; created_at: string; resolved_by: string | null; resolved_at: string | null; is_late: boolean;
}
export interface Reminder { id: number; level: number; channel: string; subject: string; body: string; debt_amount: number; overdue_days: number; status: string; created_by: string; created_at: string; sent_at: string | null; read_at: string | null }
export interface Dispute { id: number; invoice_id: number; invoice_code?: string; invoice_title?: string; message: string; status: string; reply: string | null; replied_by: string | null; created_at: string; replied_at: string | null }
export interface WalletTx { id: number; type: string; amount: number; method: string | null; status: string; gateway_ref: string | null; title: string | null; created_at: string }
export interface Wallet { has_wallet: boolean; balance: number; updated_at: string | null; transactions: WalletTx[] }
export interface TimelineEvent { type: 'invoice' | 'payment' | 'note' | 'reminder' | 'dispute' | 'waiver'; at: string; title: string; detail: string | null; amount: number | null; actor: string | null }
export interface Notice { key: string; type: string; level: 'danger' | 'warn' | 'info'; student_id: number; title: string; desc: string; at: string | null; tab: string }
export interface Notices { counts: { pending_payments: number; open_disputes: number; late_promises: number; overdue_students: number; total: number }; items: Notice[] }
export interface Receipt {
    payment: Payment & { student_id: number }; invoice: Invoice; student: { id: number; code: string; full_name: string }; class_name: string | null;
    school: { name: string; address: string; hotline: string; footer: string; accountant: string; treasurer: string };
}