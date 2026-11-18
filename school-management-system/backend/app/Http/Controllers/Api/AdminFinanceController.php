<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Quản trị – TÀI CHÍNH & HỌC PHÍ (prefix admin/finance, middleware auth:sanctum + AdminAccess).
 * Đường dẫn thật: /api/admin/finance/...   (và /api/v1/admin/finance/...)
 *
 * Dùng lại dữ liệu học phí có sẵn: sm_invoices, sm_invoice_lines, sm_payments, sm_fee_items, sm_fee_waivers,
 * sm_fee_settings, sm_invoice_disputes. Bảng mới: sm_fin_expenses (sổ chi), sm_fin_audit (nhật ký thao tác).
 * Quy ước trạng thái hóa đơn (tính từ phiếu thu đã xác nhận): cancelled / paid / partial / unpaid; quá hạn = còn nợ và qua hạn nộp.
 */
class AdminFinanceController extends Controller
{
    private const TZ = 'Asia/Ho_Chi_Minh';
    public const CATEGORIES = ['tuition' => 'Học phí', 'insurance' => 'Bảo hiểm', 'fund' => 'Quỹ', 'service' => 'Dịch vụ', 'uniform' => 'Đồng phục', 'other' => 'Hoạt động khác'];
    public const METHODS = ['cash' => 'Tiền mặt', 'bank_transfer' => 'Chuyển khoản', 'card' => 'Thẻ (POS)', 'ewallet' => 'Ví điện tử'];
    public const TERMS = ['YEAR' => 'Đầu năm học', 'HK1' => 'Học kỳ 1', 'HK2' => 'Học kỳ 2'];
    public const EXP = ['facility' => 'Cơ sở vật chất', 'supplies' => 'Văn phòng phẩm - thiết bị', 'utility' => 'Điện nước - internet', 'event' => 'Hoạt động - sự kiện', 'salary' => 'Lương - phụ cấp', 'training' => 'Đào tạo - bồi dưỡng', 'other' => 'Khác'];
    private const SETTING_KEYS = ['bank_name', 'bank_short', 'bank_bin', 'account_no', 'account_name', 'transfer_hint', 'demo_note', 'office', 'hotline'];

    /* ---------- tiện ích ---------- */
    private function today(): string { return Carbon::now(self::TZ)->toDateString(); }
    private function nowUtc(): string { return now()->format('Y-m-d H:i:s'); }
    private function okDate($s): bool { return is_string($s) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $s) && date('Y-m-d', strtotime($s)) === $s; }
    private function like(string $q): string { return '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($q)) . '%'; }
    private function actor(Request $r): array { $u = $r->user(); return [$u->id ?? null, (string) ($u->name ?? $u->full_name ?? $u->email ?? 'admin')]; }

    private function yid(Request $r): int
    {
        $y = (int) $r->query('year_id', 0);
        if ($y > 0 && DB::table('sm_school_years')->where('id', $y)->exists()) return $y;
        return (int) (DB::table('sm_school_years')->where('is_current', 1)->value('id') ?: DB::table('sm_school_years')->max('id'));
    }

    private function audit(Request $r, string $action, ?string $entity = null, $id = null, ?string $detail = null): void
    {
        try {
            [$aid, $name] = $this->actor($r);
            DB::table('sm_fin_audit')->insert(['actor_id' => $aid, 'actor' => $name, 'action' => $action, 'entity' => $entity, 'entity_id' => $id, 'detail' => $detail ? mb_substr($detail, 0, 500) : null, 'ip' => $r->ip(), 'created_at' => $this->nowUtc()]);
        } catch (\Throwable $e) { /* chưa chạy SQL nhật ký thì bỏ qua */ }
    }

    /** [page, per, offset] – export=1 cho phép lấy tối đa 5000 dòng */
    private function pg(Request $r): array
    {
        $per = $r->boolean('export') ? min(5000, max(1, (int) $r->query('per', 5000))) : min(100, max(5, (int) $r->query('per', 20)));
        $page = max(1, (int) $r->query('page', 1));
        return [$page, $per, ($page - 1) * $per];
    }
    private function pm(int $total, int $page, int $per): array { return ['total' => $total, 'page' => $page, 'per' => $per, 'pages' => max(1, (int) ceil($total / max(1, $per)))]; }

    /** Hóa đơn của 1 năm học kèm số đã thu, còn nợ, trạng thái, số ngày quá hạn → derived table t */
    private function inv(int $yid): array
    {
        $today = $this->today();
        $sql = "SELECT x.*, CASE WHEN x.raw = 'cancelled' THEN 0 ELSE GREATEST(x.total - x.paid, 0) END AS balance,
              CASE WHEN x.raw = 'cancelled' THEN 'cancelled' WHEN x.total - x.paid <= 0 THEN 'paid' WHEN x.paid > 0 THEN 'partial' ELSE 'unpaid' END AS pstatus,
              CASE WHEN x.raw <> 'cancelled' AND x.total - x.paid > 0 AND DATE(x.due_date) < ? THEN DATEDIFF(?, DATE(x.due_date)) ELSE 0 END AS overdue_days
            FROM (SELECT i.id, i.code, i.title, i.term, i.school_year_id, i.student_id, i.issue_date, i.due_date, i.subtotal, i.discount, i.total, i.status AS raw,
                    s.code AS scode, s.full_name AS sname, e.class_id, c.name AS class_name, c.grade,
                    COALESCE(p.paid, 0) AS paid, COALESCE(p.pending, 0) AS pending
                  FROM sm_invoices i JOIN sm_students s ON s.id = i.student_id
                  LEFT JOIN (SELECT student_id, school_year_id, MIN(class_id) AS class_id FROM sm_enrollments GROUP BY student_id, school_year_id) e ON e.student_id = i.student_id AND e.school_year_id = i.school_year_id
                  LEFT JOIN sm_classes c ON c.id = e.class_id
                  LEFT JOIN (SELECT invoice_id, SUM(CASE WHEN status = 'confirmed' THEN amount ELSE 0 END) AS paid, SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending
                             FROM sm_payments GROUP BY invoice_id) p ON p.invoice_id = i.id
                  WHERE i.school_year_id = ?) x";
        return [$sql, [$today, $today, $yid]];
    }

    private function invRow($x): array
    {
        return ['id' => (int) $x->id, 'code' => $x->code, 'title' => $x->title, 'term' => $x->term, 'term_label' => self::TERMS[$x->term] ?? $x->term, 'student_id' => (int) $x->student_id,
            'scode' => $x->scode, 'sname' => $x->sname, 'class_id' => $x->class_id ? (int) $x->class_id : null, 'class_name' => $x->class_name, 'grade' => $x->grade ? (int) $x->grade : null,
            'issue_date' => $x->issue_date ? substr($x->issue_date, 0, 10) : null, 'due_date' => $x->due_date ? substr($x->due_date, 0, 10) : null,
            'subtotal' => (int) $x->subtotal, 'discount' => (int) $x->discount, 'total' => (int) $x->total, 'paid' => (int) $x->paid, 'pending' => (int) $x->pending,
            'balance' => (int) $x->balance, 'status' => $x->pstatus, 'overdue_days' => (int) $x->overdue_days];
    }

    /* ---------- 0. Danh mục dùng cho bộ lọc ---------- */
    public function meta(Request $r)
    {
        $yid = $this->yid($r);
        return response()->json([
            'years' => DB::table('sm_school_years')->orderByDesc('start_date')->get(['id', 'label', 'is_current'])->map(fn ($y) => ['id' => (int) $y->id, 'label' => $y->label, 'current' => (bool) $y->is_current]),
            'year_id' => $yid, 'today' => $this->today(),
            'classes' => DB::table('sm_classes')->where('school_year_id', $yid)->orderBy('grade')->orderBy('name')->get(['id', 'name', 'grade'])->map(fn ($c) => ['id' => (int) $c->id, 'name' => $c->name, 'grade' => (int) $c->grade]),
            'categories' => self::CATEGORIES, 'methods' => self::METHODS, 'terms' => self::TERMS, 'expense_categories' => self::EXP,
        ]);
    }

    /* ---------- 1. Tổng quan ---------- */
    public function overview(Request $r)
    {
        $yid = $this->yid($r); [$b, $bb] = $this->inv($yid);
        $today = $this->today(); $monthStart = Carbon::parse($today)->startOfMonth()->toDateString();
        $t = DB::selectOne("SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN pstatus <> 'cancelled' THEN total END),0) billed, COALESCE(SUM(CASE WHEN pstatus <> 'cancelled' THEN LEAST(paid,total) END),0) paid,
              COALESCE(SUM(balance),0) balance, COALESCE(SUM(CASE WHEN pstatus <> 'cancelled' THEN discount END),0) discount,
              COALESCE(SUM(pstatus = 'paid'),0) n_paid, COALESCE(SUM(pstatus = 'partial'),0) n_partial, COALESCE(SUM(pstatus = 'unpaid'),0) n_unpaid, COALESCE(SUM(pstatus = 'cancelled'),0) n_cancel,
              COALESCE(SUM(overdue_days > 0),0) n_overdue, COALESCE(SUM(CASE WHEN overdue_days > 0 THEN balance END),0) overdue_amt, COUNT(DISTINCT CASE WHEN balance > 0 THEN student_id END) debtors
            FROM ($b) t", $bb);
        $byGrade = DB::select("SELECT COALESCE(grade,0) grade, COUNT(*) n, SUM(total) billed, SUM(LEAST(paid,total)) paid FROM ($b) t WHERE pstatus <> 'cancelled' GROUP BY COALESCE(grade,0) ORDER BY 1", $bb);
        $byTerm = DB::select("SELECT term, COUNT(*) n, SUM(total) billed, SUM(LEAST(paid,total)) paid FROM ($b) t WHERE pstatus <> 'cancelled' GROUP BY term ORDER BY FIELD(term,'YEAR','HK1','HK2')", $bb);
        $byCat = DB::select("SELECT COALESCE(f.category,'other') cat, SUM(l.amount) amt FROM sm_invoice_lines l JOIN sm_invoices i ON i.id = l.invoice_id LEFT JOIN sm_fee_items f ON f.id = l.fee_item_id
              WHERE i.school_year_id = ? AND i.status <> 'cancelled' GROUP BY COALESCE(f.category,'other') ORDER BY amt DESC", [$yid]);
        $byMethod = DB::select("SELECT p.method, COUNT(*) n, SUM(p.amount) amt FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id WHERE p.status = 'confirmed' AND i.school_year_id = ? GROUP BY p.method ORDER BY amt DESC", [$yid]);

        $from = Carbon::parse($today)->subDays(29)->toDateString();
        $daily = []; foreach (DB::select("SELECT DATE(paid_at) d, SUM(amount) amt, COUNT(*) n FROM sm_payments WHERE status = 'confirmed' AND DATE(paid_at) BETWEEN ? AND ? GROUP BY DATE(paid_at)", [$from, $today]) as $x) $daily[$x->d] = $x;
        $series = []; for ($d = Carbon::parse($from); $d->toDateString() <= $today; $d->addDay()) { $k = $d->toDateString(); $series[] = ['date' => $k, 'amount' => (int) ($daily[$k]->amt ?? 0), 'count' => (int) ($daily[$k]->n ?? 0)]; }

        $col = fn ($a, $z) => (int) DB::table('sm_payments')->where('status', 'confirmed')->whereRaw('DATE(paid_at) BETWEEN ? AND ?', [$a, $z])->sum('amount');
        $pend = DB::selectOne("SELECT COUNT(*) n, COALESCE(SUM(amount),0) amt FROM sm_payments WHERE status = 'pending'");
        $disp = 0; try { $disp = (int) DB::table('sm_invoice_disputes')->where('status', 'open')->count(); } catch (\Throwable $e) { }
        $exMonth = 0; $exYear = 0;
        try {
            $exMonth = (int) DB::table('sm_fin_expenses')->where('status', 'approved')->whereBetween('spent_at', [$monthStart, $today])->sum('amount');
            $exYear = (int) DB::table('sm_fin_expenses')->where('status', 'approved')->where('school_year_id', $yid)->sum('amount');
        } catch (\Throwable $e) { }
        $recent = DB::select("SELECT p.id, p.receipt_code, p.amount, p.method, p.status, p.paid_at, s.full_name sname, s.code scode, i.code icode FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id JOIN sm_students s ON s.id = p.student_id ORDER BY p.id DESC LIMIT 8");
        $top = DB::select("SELECT class_name, COUNT(DISTINCT student_id) students, SUM(balance) balance FROM ($b) t WHERE balance > 0 AND class_name IS NOT NULL GROUP BY class_name ORDER BY balance DESC LIMIT 6", $bb);

        return response()->json([
            'year_id' => $yid, 'today' => $today,
            'totals' => ['invoices' => (int) $t->n, 'billed' => (int) $t->billed, 'paid' => (int) $t->paid, 'balance' => (int) $t->balance, 'discount' => (int) $t->discount, 'rate' => $t->billed > 0 ? round($t->paid * 100 / $t->billed, 1) : 0,
                'paid_n' => (int) $t->n_paid, 'partial_n' => (int) $t->n_partial, 'unpaid_n' => (int) $t->n_unpaid, 'cancel_n' => (int) $t->n_cancel, 'overdue_n' => (int) $t->n_overdue, 'overdue_amt' => (int) $t->overdue_amt, 'debtors' => (int) $t->debtors],
            'cash' => ['today' => $col($today, $today), 'month' => $col($monthStart, $today), 'expense_month' => $exMonth, 'expense_year' => $exYear, 'net_year' => (int) $t->paid - $exYear],
            'pending' => ['n' => (int) $pend->n, 'amount' => (int) $pend->amt], 'disputes_open' => $disp,
            'series' => $series,
            'by_grade' => array_map(fn ($x) => ['grade' => (int) $x->grade, 'n' => (int) $x->n, 'billed' => (int) $x->billed, 'paid' => (int) $x->paid], $byGrade),
            'by_term' => array_map(fn ($x) => ['term' => $x->term, 'label' => self::TERMS[$x->term] ?? $x->term, 'n' => (int) $x->n, 'billed' => (int) $x->billed, 'paid' => (int) $x->paid], $byTerm),
            'by_category' => array_map(fn ($x) => ['key' => $x->cat, 'label' => self::CATEGORIES[$x->cat] ?? $x->cat, 'amount' => (int) $x->amt], $byCat),
            'by_method' => array_map(fn ($x) => ['key' => $x->method, 'label' => self::METHODS[$x->method] ?? $x->method, 'n' => (int) $x->n, 'amount' => (int) $x->amt], $byMethod),
            'recent' => array_map(fn ($x) => ['id' => (int) $x->id, 'code' => $x->receipt_code, 'amount' => (int) $x->amount, 'method' => $x->method, 'method_label' => self::METHODS[$x->method] ?? $x->method, 'status' => $x->status, 'paid_at' => $x->paid_at, 'sname' => $x->sname, 'scode' => $x->scode, 'invoice' => $x->icode], $recent),
            'top_debt_classes' => array_map(fn ($x) => ['class_name' => $x->class_name, 'students' => (int) $x->students, 'balance' => (int) $x->balance], $top),
        ]);
    }

    /* ---------- 2. Hóa đơn ---------- */
    public function invoices(Request $r)
    {
        $yid = $this->yid($r); [$b, $bb] = $this->inv($yid); [$page, $per, $off] = $this->pg($r);
        $w = ['1=1']; $p = [];
        $st = $r->query('status');
        if ($st === 'overdue') $w[] = 'overdue_days > 0'; elseif (in_array($st, ['paid', 'partial', 'unpaid', 'cancelled'], true)) { $w[] = 'pstatus = ?'; $p[] = $st; }
        if (isset(self::TERMS[$r->query('term')])) { $w[] = 'term = ?'; $p[] = $r->query('term'); }
        if ($g = (int) $r->query('grade')) { $w[] = 'grade = ?'; $p[] = $g; }
        if ($c = (int) $r->query('class_id')) { $w[] = 'class_id = ?'; $p[] = $c; }
        if (($q = trim((string) $r->query('q', ''))) !== '') { $w[] = '(code LIKE ? OR sname LIKE ? OR scode LIKE ?)'; $l = $this->like($q); array_push($p, $l, $l, $l); }
        $where = implode(' AND ', $w);
        $order = ['due' => 'due_date ASC', 'balance' => 'balance DESC', 'total' => 'total DESC', 'new' => 'id DESC'][$r->query('sort', 'new')] ?? 'id DESC';
        $total = (int) DB::selectOne("SELECT COUNT(*) n FROM ($b) t WHERE $where", array_merge($bb, $p))->n;
        $sum = DB::selectOne("SELECT COALESCE(SUM(total),0) total, COALESCE(SUM(LEAST(paid,total)),0) paid, COALESCE(SUM(balance),0) balance FROM ($b) t WHERE $where AND pstatus <> 'cancelled'", array_merge($bb, $p));
        $rows = DB::select("SELECT * FROM ($b) t WHERE $where ORDER BY $order LIMIT $per OFFSET $off", array_merge($bb, $p));
        return response()->json(['meta' => $this->pm($total, $page, $per), 'sum' => ['total' => (int) $sum->total, 'paid' => (int) $sum->paid, 'balance' => (int) $sum->balance], 'data' => array_map(fn ($x) => $this->invRow($x), $rows)]);
    }

    public function invoice(Request $r, int $id)
    {
        $yid = (int) DB::table('sm_invoices')->where('id', $id)->value('school_year_id'); abort_unless($yid, 404, 'Không tìm thấy hóa đơn.');
        [$b, $bb] = $this->inv($yid);
        $x = DB::selectOne("SELECT * FROM ($b) t WHERE id = ?", array_merge($bb, [$id])); abort_unless($x, 404, 'Không tìm thấy hóa đơn.');
        $lines = DB::select('SELECT l.id, l.description, l.quantity, l.unit_price, l.discount, l.amount, f.category FROM sm_invoice_lines l LEFT JOIN sm_fee_items f ON f.id = l.fee_item_id WHERE l.invoice_id = ? ORDER BY l.id', [$id]);
        $pays = DB::select('SELECT id, receipt_code, amount, method, reference, payer_note, status, paid_at, confirmed_by, confirmed_at, reject_reason FROM sm_payments WHERE invoice_id = ? ORDER BY paid_at DESC, id DESC', [$id]);
        $disp = []; try { $disp = DB::select('SELECT id, message, status, reply, replied_by, created_at, replied_at FROM sm_invoice_disputes WHERE invoice_id = ? ORDER BY id DESC', [$id]); } catch (\Throwable $e) { }
        $wv = DB::select('SELECT id, label, percent, note, approved_by FROM sm_fee_waivers WHERE student_id = ? AND school_year_id = ?', [$x->student_id, $yid]);
        return response()->json(['data' => $this->invRow($x) + [
            'lines' => array_map(fn ($l) => ['id' => (int) $l->id, 'description' => $l->description, 'category' => $l->category, 'category_label' => self::CATEGORIES[$l->category ?? 'other'] ?? 'Khác', 'quantity' => (int) $l->quantity, 'unit_price' => (int) $l->unit_price, 'discount' => (int) $l->discount, 'amount' => (int) $l->amount], $lines),
            'payments' => array_map(fn ($p) => ['id' => (int) $p->id, 'code' => $p->receipt_code, 'amount' => (int) $p->amount, 'method' => $p->method, 'method_label' => self::METHODS[$p->method] ?? $p->method, 'reference' => $p->reference, 'note' => $p->payer_note, 'status' => $p->status, 'paid_at' => $p->paid_at, 'confirmed_by' => $p->confirmed_by, 'confirmed_at' => $p->confirmed_at, 'reject_reason' => $p->reject_reason], $pays),
            'disputes' => array_map(fn ($d) => ['id' => (int) $d->id, 'message' => $d->message, 'status' => $d->status, 'reply' => $d->reply, 'replied_by' => $d->replied_by, 'created_at' => $d->created_at, 'replied_at' => $d->replied_at], $disp),
            'waivers' => array_map(fn ($w) => ['id' => (int) $w->id, 'label' => $w->label, 'percent' => (float) $w->percent, 'note' => $w->note, 'approved_by' => $w->approved_by], $wv),
        ]]);
    }

    public function invoiceCancel(Request $r, int $id)
    {
        $d = $r->validate(['reason' => 'required|string|min:5|max:300']);
        $i = DB::table('sm_invoices')->where('id', $id)->first(); abort_unless($i, 404, 'Không tìm thấy hóa đơn.');
        abort_if($i->status === 'cancelled', 422, 'Hóa đơn này đã bị hủy.');
        abort_if(DB::table('sm_payments')->where('invoice_id', $id)->whereIn('status', ['confirmed', 'pending'])->exists(), 422, 'Hóa đơn đã có phiếu thu (đã xác nhận hoặc đang chờ). Hãy xử lý phiếu thu trước khi hủy hóa đơn.');
        DB::table('sm_invoices')->where('id', $id)->update(['status' => 'cancelled']);
        $this->audit($r, 'invoice.cancel', 'invoice', $id, "Hủy hóa đơn {$i->code}: " . $d['reason']);
        return response()->json(['message' => 'Đã hủy hóa đơn.']);
    }

    /* ---------- 3. Thanh toán ---------- */
    public function payments(Request $r)
    {
        $yid = $this->yid($r); [$page, $per, $off] = $this->pg($r);
        $w = ['i.school_year_id = ?']; $p = [$yid];
        $base = $w;
        if (in_array($r->query('status'), ['confirmed', 'pending', 'rejected', 'cancelled'], true)) { $w[] = 'p.status = ?'; $p[] = $r->query('status'); }
        if (isset(self::METHODS[$r->query('method')])) { $w[] = 'p.method = ?'; $p[] = $r->query('method'); }
        if ($this->okDate($r->query('from'))) { $w[] = 'DATE(p.paid_at) >= ?'; $p[] = $r->query('from'); }
        if ($this->okDate($r->query('to'))) { $w[] = 'DATE(p.paid_at) <= ?'; $p[] = $r->query('to'); }
        if (($q = trim((string) $r->query('q', ''))) !== '') { $w[] = '(p.receipt_code LIKE ? OR p.reference LIKE ? OR s.full_name LIKE ? OR s.code LIKE ? OR i.code LIKE ?)'; $l = $this->like($q); array_push($p, $l, $l, $l, $l, $l); }
        $where = implode(' AND ', $w);
        $from = "FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id JOIN sm_students s ON s.id = p.student_id";
        $total = (int) DB::selectOne("SELECT COUNT(*) n $from WHERE $where", $p)->n;
        $sum = DB::selectOne("SELECT COALESCE(SUM(CASE WHEN p.status='confirmed' THEN p.amount END),0) confirmed, COALESCE(SUM(CASE WHEN p.status='pending' THEN p.amount END),0) pending FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id JOIN sm_students s ON s.id = p.student_id WHERE $where", $p);
        $cnt = []; foreach (DB::select("SELECT p.status, COUNT(*) n FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id WHERE i.school_year_id = ? GROUP BY p.status", [$yid]) as $x) $cnt[$x->status] = (int) $x->n;
        $rows = DB::select("SELECT p.id, p.receipt_code, p.amount, p.method, p.reference, p.payer_note, p.status, p.paid_at, p.confirmed_by, p.confirmed_at, p.reject_reason, s.full_name sname, s.code scode, i.code icode, i.id invoice_id $from WHERE $where ORDER BY p.id DESC LIMIT $per OFFSET $off", $p);
        return response()->json(['meta' => $this->pm($total, $page, $per), 'counts' => $cnt, 'sum' => ['confirmed' => (int) $sum->confirmed, 'pending' => (int) $sum->pending],
            'data' => array_map(fn ($x) => ['id' => (int) $x->id, 'code' => $x->receipt_code, 'amount' => (int) $x->amount, 'method' => $x->method, 'method_label' => self::METHODS[$x->method] ?? $x->method, 'reference' => $x->reference, 'note' => $x->payer_note, 'status' => $x->status,
                'paid_at' => $x->paid_at, 'confirmed_by' => $x->confirmed_by, 'confirmed_at' => $x->confirmed_at, 'reject_reason' => $x->reject_reason, 'sname' => $x->sname, 'scode' => $x->scode, 'invoice' => $x->icode, 'invoice_id' => (int) $x->invoice_id], $rows)]);
    }

    /** Đối soát theo ngày + phát hiện bất thường */
    public function reconcile(Request $r)
    {
        $today = $this->today();
        $to = $this->okDate($r->query('to')) ? $r->query('to') : $today;
        $from = $this->okDate($r->query('from')) ? $r->query('from') : Carbon::parse($to)->startOfMonth()->toDateString();
        abort_if($from > $to, 422, 'Khoảng ngày không hợp lệ.');
        abort_if(Carbon::parse($from)->diffInDays(Carbon::parse($to)) > 400, 422, 'Chỉ đối soát tối đa 400 ngày một lần.');
        $days = [];
        foreach (DB::select("SELECT DATE(paid_at) d, method, COUNT(*) n, SUM(amount) amt FROM sm_payments WHERE status = 'confirmed' AND DATE(paid_at) BETWEEN ? AND ? GROUP BY DATE(paid_at), method", [$from, $to]) as $x) {
            $days[$x->d] ??= ['date' => $x->d, 'count' => 0, 'total' => 0, 'by' => []];
            $days[$x->d]['count'] += (int) $x->n; $days[$x->d]['total'] += (int) $x->amt; $days[$x->d]['by'][$x->method] = (int) $x->amt;
        }
        ksort($days);
        $by = []; foreach ($days as $d) foreach ($d['by'] as $m => $a) $by[$m] = ($by[$m] ?? 0) + $a;
        $pend = DB::selectOne("SELECT COUNT(*) n, COALESCE(SUM(amount),0) amt FROM sm_payments WHERE status = 'pending' AND DATE(paid_at) BETWEEN ? AND ?", [$from, $to]);
        $rej = DB::selectOne("SELECT COUNT(*) n, COALESCE(SUM(amount),0) amt FROM sm_payments WHERE status IN ('rejected','cancelled') AND DATE(paid_at) BETWEEN ? AND ?", [$from, $to]);
        $dupRef = DB::select("SELECT reference, COUNT(*) n, SUM(amount) amt FROM sm_payments WHERE reference IS NOT NULL AND reference <> '' AND status IN ('pending','confirmed') GROUP BY reference HAVING COUNT(*) > 1 ORDER BY n DESC LIMIT 20");
        $over = DB::select("SELECT i.id, i.code, i.total, SUM(p.amount) paid FROM sm_invoices i JOIN sm_payments p ON p.invoice_id = i.id AND p.status = 'confirmed' WHERE i.status <> 'cancelled' GROUP BY i.id, i.code, i.total HAVING SUM(p.amount) > i.total LIMIT 20");
        $stale = DB::select("SELECT p.id, p.receipt_code, p.amount, p.paid_at, s.full_name sname FROM sm_payments p JOIN sm_students s ON s.id = p.student_id WHERE p.status = 'pending' AND p.paid_at < ? ORDER BY p.paid_at LIMIT 20", [Carbon::parse($today)->subDays(3)->toDateString()]);
        return response()->json(['from' => $from, 'to' => $to, 'days' => array_values($days), 'by_method' => $by,
            'totals' => ['amount' => array_sum(array_column($days, 'total')), 'count' => array_sum(array_column($days, 'count')), 'pending_n' => (int) $pend->n, 'pending_amt' => (int) $pend->amt, 'rejected_n' => (int) $rej->n, 'rejected_amt' => (int) $rej->amt],
            'anomalies' => [
                'duplicate_reference' => array_map(fn ($x) => ['reference' => $x->reference, 'n' => (int) $x->n, 'amount' => (int) $x->amt], $dupRef),
                'overpaid' => array_map(fn ($x) => ['id' => (int) $x->id, 'code' => $x->code, 'total' => (int) $x->total, 'paid' => (int) $x->paid], $over),
                'stale_pending' => array_map(fn ($x) => ['id' => (int) $x->id, 'code' => $x->receipt_code, 'amount' => (int) $x->amount, 'paid_at' => $x->paid_at, 'sname' => $x->sname], $stale),
            ]]);
    }

    /* ---------- 4. Công nợ ---------- */
    public function debts(Request $r)
    {
        $yid = $this->yid($r); [$b, $bb] = $this->inv($yid); [$page, $per, $off] = $this->pg($r);
        $w = ['balance > 0']; $p = [];
        $bucket = $r->query('bucket');
        $bm = ['current' => 'overdue_days = 0', 'd30' => 'overdue_days BETWEEN 1 AND 30', 'd60' => 'overdue_days BETWEEN 31 AND 60', 'd90' => 'overdue_days BETWEEN 61 AND 90', 'd90p' => 'overdue_days > 90'];
        if (isset($bm[$bucket])) $w[] = $bm[$bucket];
        if ($g = (int) $r->query('grade')) { $w[] = 'grade = ?'; $p[] = $g; }
        if ($c = (int) $r->query('class_id')) { $w[] = 'class_id = ?'; $p[] = $c; }
        if (($q = trim((string) $r->query('q', ''))) !== '') { $w[] = '(code LIKE ? OR sname LIKE ? OR scode LIKE ?)'; $l = $this->like($q); array_push($p, $l, $l, $l); }
        $where = implode(' AND ', $w);
        $sumAll = DB::selectOne("SELECT COALESCE(SUM(overdue_days = 0),0) c0, COALESCE(SUM(CASE WHEN overdue_days = 0 THEN balance END),0) a0,
              COALESCE(SUM(overdue_days BETWEEN 1 AND 30),0) c1, COALESCE(SUM(CASE WHEN overdue_days BETWEEN 1 AND 30 THEN balance END),0) a1,
              COALESCE(SUM(overdue_days BETWEEN 31 AND 60),0) c2, COALESCE(SUM(CASE WHEN overdue_days BETWEEN 31 AND 60 THEN balance END),0) a2,
              COALESCE(SUM(overdue_days BETWEEN 61 AND 90),0) c3, COALESCE(SUM(CASE WHEN overdue_days BETWEEN 61 AND 90 THEN balance END),0) a3,
              COALESCE(SUM(overdue_days > 90),0) c4, COALESCE(SUM(CASE WHEN overdue_days > 90 THEN balance END),0) a4 FROM ($b) t WHERE balance > 0", $bb);
        $total = (int) DB::selectOne("SELECT COUNT(*) n FROM ($b) t WHERE $where", array_merge($bb, $p))->n;
        $order = ['balance' => 'balance DESC', 'days' => 'overdue_days DESC, balance DESC', 'name' => 'sname ASC'][$r->query('sort', 'days')] ?? 'overdue_days DESC, balance DESC';
        $rows = DB::select("SELECT * FROM ($b) t WHERE $where ORDER BY $order LIMIT $per OFFSET $off", array_merge($bb, $p));
        $byClass = DB::select("SELECT class_name, grade, COUNT(DISTINCT student_id) students, SUM(balance) balance FROM ($b) t WHERE balance > 0 AND class_name IS NOT NULL GROUP BY class_name, grade ORDER BY balance DESC LIMIT 12", $bb);
        $bk = [['key' => 'current', 'label' => 'Chưa đến hạn', 'n' => (int) $sumAll->c0, 'amount' => (int) $sumAll->a0], ['key' => 'd30', 'label' => 'Quá hạn 1–30 ngày', 'n' => (int) $sumAll->c1, 'amount' => (int) $sumAll->a1],
            ['key' => 'd60', 'label' => 'Quá hạn 31–60 ngày', 'n' => (int) $sumAll->c2, 'amount' => (int) $sumAll->a2], ['key' => 'd90', 'label' => 'Quá hạn 61–90 ngày', 'n' => (int) $sumAll->c3, 'amount' => (int) $sumAll->a3], ['key' => 'd90p', 'label' => 'Quá hạn trên 90 ngày', 'n' => (int) $sumAll->c4, 'amount' => (int) $sumAll->a4]];
        return response()->json(['meta' => $this->pm($total, $page, $per), 'buckets' => $bk, 'by_class' => array_map(fn ($x) => ['class_name' => $x->class_name, 'grade' => (int) $x->grade, 'students' => (int) $x->students, 'balance' => (int) $x->balance], $byClass),
            'data' => array_map(fn ($x) => $this->invRow($x), $rows)]);
    }

    /* ---------- 5. Khoản thu (danh mục) ---------- */
    private function itemRules(): array
    {
        return ['code' => 'required|string|max:30', 'name' => 'required|string|max:160', 'category' => 'required|in:' . implode(',', array_keys(self::CATEGORIES)), 'amount' => 'required|integer|min:0|max:1000000000',
            'unit' => 'nullable|string|max:20', 'grade' => 'nullable|integer|in:10,11,12', 'is_mandatory' => 'nullable|boolean', 'note' => 'nullable|string|max:500'];
    }
    public function items(Request $r)
    {
        $rows = DB::select("SELECT f.*, (SELECT COUNT(*) FROM sm_invoice_lines l WHERE l.fee_item_id = f.id) used FROM sm_fee_items f ORDER BY f.category, f.id");
        return response()->json(['data' => array_map(fn ($f) => ['id' => (int) $f->id, 'code' => $f->code, 'name' => $f->name, 'category' => $f->category, 'category_label' => self::CATEGORIES[$f->category] ?? $f->category, 'amount' => (int) $f->amount, 'unit' => $f->unit,
            'grade' => $f->grade ? (int) $f->grade : null, 'is_mandatory' => (bool) $f->is_mandatory, 'note' => $f->note, 'used' => (int) $f->used], $rows)]);
    }
    public function itemSave(Request $r, ?int $id = null)
    {
        $d = $r->validate($this->itemRules());
        abort_if(DB::table('sm_fee_items')->where('code', $d['code'])->when($id, fn ($q) => $q->where('id', '<>', $id))->exists(), 422, 'Mã khoản thu đã tồn tại.');
        $row = ['code' => trim($d['code']), 'name' => trim($d['name']), 'category' => $d['category'], 'amount' => $d['amount'], 'unit' => $d['unit'] ?? null, 'grade' => $d['grade'] ?? null, 'is_mandatory' => (int) ($d['is_mandatory'] ?? 0), 'note' => $d['note'] ?? null];
        if ($id) { abort_unless(DB::table('sm_fee_items')->where('id', $id)->exists(), 404, 'Không tìm thấy khoản thu.'); DB::table('sm_fee_items')->where('id', $id)->update($row); $this->audit($r, 'item.update', 'fee_item', $id, "{$row['code']} – {$row['name']} = {$row['amount']}"); return response()->json(['message' => 'Đã cập nhật khoản thu.']); }
        $nid = DB::table('sm_fee_items')->insertGetId($row); $this->audit($r, 'item.create', 'fee_item', $nid, "{$row['code']} – {$row['name']} = {$row['amount']}");
        return response()->json(['message' => 'Đã thêm khoản thu.', 'id' => $nid]);
    }
    public function itemDelete(Request $r, int $id)
    {
        $f = DB::table('sm_fee_items')->where('id', $id)->first(); abort_unless($f, 404, 'Không tìm thấy khoản thu.');
        abort_if(DB::table('sm_invoice_lines')->where('fee_item_id', $id)->exists(), 422, 'Khoản thu này đã được dùng trong hóa đơn nên không thể xóa.');
        DB::table('sm_fee_items')->where('id', $id)->delete(); $this->audit($r, 'item.delete', 'fee_item', $id, "{$f->code} – {$f->name}");
        return response()->json(['message' => 'Đã xóa khoản thu.']);
    }

    /* ---------- 6. Miễn giảm ---------- */
    public function waivers(Request $r)
    {
        $yid = $this->yid($r); $w = ['f.school_year_id = ?']; $p = [$yid];
        if (($q = trim((string) $r->query('q', ''))) !== '') { $w[] = '(s.full_name LIKE ? OR s.code LIKE ? OR f.label LIKE ?)'; $l = $this->like($q); array_push($p, $l, $l, $l); }
        $rows = DB::select("SELECT f.id, f.student_id, f.school_year_id, f.label, f.percent, f.note, f.approved_by, s.full_name sname, s.code scode, c.name class_name
            FROM sm_fee_waivers f JOIN sm_students s ON s.id = f.student_id
            LEFT JOIN sm_enrollments e ON e.student_id = f.student_id AND e.school_year_id = f.school_year_id LEFT JOIN sm_classes c ON c.id = e.class_id
            WHERE " . implode(' AND ', $w) . " GROUP BY f.id, f.student_id, f.school_year_id, f.label, f.percent, f.note, f.approved_by, s.full_name, s.code, c.name ORDER BY f.id DESC LIMIT 500", $p);
        return response()->json(['data' => array_map(fn ($x) => ['id' => (int) $x->id, 'student_id' => (int) $x->student_id, 'sname' => $x->sname, 'scode' => $x->scode, 'class_name' => $x->class_name, 'label' => $x->label, 'percent' => (float) $x->percent, 'note' => $x->note, 'approved_by' => $x->approved_by], $rows)]);
    }
    public function studentSearch(Request $r)
    {
        $q = trim((string) $r->query('q', '')); abort_if(mb_strlen($q) < 2, 422, 'Nhập ít nhất 2 ký tự để tìm học sinh.');
        $l = $this->like($q); $yid = $this->yid($r);
        $rows = DB::select("SELECT s.id, s.code, s.full_name, c.name class_name FROM sm_students s LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ? LEFT JOIN sm_classes c ON c.id = e.class_id
            WHERE s.full_name LIKE ? OR s.code LIKE ? GROUP BY s.id, s.code, s.full_name, c.name ORDER BY s.full_name LIMIT 15", [$yid, $l, $l]);
        return response()->json(['data' => array_map(fn ($x) => ['id' => (int) $x->id, 'code' => $x->code, 'name' => $x->full_name, 'class_name' => $x->class_name], $rows)]);
    }
    public function waiverSave(Request $r, ?int $id = null)
    {
        $d = $r->validate(['student_id' => 'required|integer', 'school_year_id' => 'required|integer', 'label' => 'required|string|max:160', 'percent' => 'required|numeric|min:1|max:100', 'note' => 'nullable|string|max:500']);
        abort_unless(DB::table('sm_students')->where('id', $d['student_id'])->exists(), 422, 'Không tìm thấy học sinh.');
        [, $name] = $this->actor($r);
        $row = ['student_id' => $d['student_id'], 'school_year_id' => $d['school_year_id'], 'label' => trim($d['label']), 'percent' => $d['percent'], 'note' => $d['note'] ?? null, 'approved_by' => $name];
        if ($id) { abort_unless(DB::table('sm_fee_waivers')->where('id', $id)->exists(), 404, 'Không tìm thấy miễn giảm.'); DB::table('sm_fee_waivers')->where('id', $id)->update($row); $this->audit($r, 'waiver.update', 'waiver', $id, "{$row['label']} {$row['percent']}%"); return response()->json(['message' => 'Đã cập nhật miễn giảm.']); }
        $nid = DB::table('sm_fee_waivers')->insertGetId($row); $this->audit($r, 'waiver.create', 'waiver', $nid, "HS #{$d['student_id']}: {$row['label']} {$row['percent']}%");
        return response()->json(['message' => 'Đã thêm miễn giảm. Áp dụng cho các hóa đơn phát hành sau.', 'id' => $nid]);
    }
    public function waiverDelete(Request $r, int $id)
    {
        $w = DB::table('sm_fee_waivers')->where('id', $id)->first(); abort_unless($w, 404, 'Không tìm thấy miễn giảm.');
        DB::table('sm_fee_waivers')->where('id', $id)->delete(); $this->audit($r, 'waiver.delete', 'waiver', $id, "{$w->label} {$w->percent}%");
        return response()->json(['message' => 'Đã xóa miễn giảm.']);
    }

    /* ---------- 7. Khiếu nại ---------- */
    public function disputes(Request $r)
    {
        $w = ['1=1']; $p = [];
        if ($r->query('status') === 'open') $w[] = "d.status = 'open'"; elseif ($r->query('status') === 'done') $w[] = "d.status <> 'open'";
        $cnt = ['open' => 0, 'done' => 0];
        try {
            foreach (DB::select("SELECT d.status = 'open' o, COUNT(*) n FROM sm_invoice_disputes d GROUP BY d.status = 'open'") as $x) $cnt[$x->o ? 'open' : 'done'] = (int) $x->n;
            $rows = DB::select("SELECT d.id, d.invoice_id, d.message, d.status, d.reply, d.replied_by, d.created_at, d.replied_at, s.full_name sname, s.code scode, i.code icode, i.total
                FROM sm_invoice_disputes d JOIN sm_students s ON s.id = d.student_id JOIN sm_invoices i ON i.id = d.invoice_id WHERE " . implode(' AND ', $w) . " ORDER BY (d.status = 'open') DESC, d.id DESC LIMIT 200", $p);
        } catch (\Throwable $e) { return response()->json(['counts' => $cnt, 'data' => []]); }
        return response()->json(['counts' => $cnt, 'data' => array_map(fn ($x) => ['id' => (int) $x->id, 'invoice_id' => (int) $x->invoice_id, 'invoice' => $x->icode, 'total' => (int) $x->total, 'sname' => $x->sname, 'scode' => $x->scode, 'message' => $x->message, 'status' => $x->status, 'reply' => $x->reply, 'replied_by' => $x->replied_by, 'created_at' => $x->created_at, 'replied_at' => $x->replied_at], $rows)]);
    }
    public function disputeReply(Request $r, int $id)
    {
        $d = $r->validate(['reply' => 'required|string|min:3|max:1000']);
        $x = DB::table('sm_invoice_disputes')->where('id', $id)->first(); abort_unless($x, 404, 'Không tìm thấy khiếu nại.');
        [, $name] = $this->actor($r);
        try { DB::table('sm_invoice_disputes')->where('id', $id)->update(['reply' => trim($d['reply']), 'replied_by' => $name, 'replied_at' => $this->nowUtc(), 'status' => 'replied']); }
        catch (\Throwable $e) { abort(422, 'Không ghi được trả lời (kiểm tra cột status của sm_invoice_disputes): ' . mb_substr($e->getMessage(), 0, 120)); }
        $this->audit($r, 'dispute.reply', 'dispute', $id, mb_substr($d['reply'], 0, 200));
        return response()->json(['message' => 'Đã trả lời khiếu nại. Học sinh sẽ thấy ở phần học phí.']);
    }

    /* ---------- 8. Sổ chi ---------- */
    public function expenses(Request $r)
    {
        $yid = $this->yid($r); [$page, $per, $off] = $this->pg($r);
        $w = ["status = 'approved'"]; $p = [];
        if (isset(self::EXP[$r->query('category')])) { $w[] = 'category = ?'; $p[] = $r->query('category'); }
        if ($this->okDate($r->query('from'))) { $w[] = 'spent_at >= ?'; $p[] = $r->query('from'); }
        if ($this->okDate($r->query('to'))) { $w[] = 'spent_at <= ?'; $p[] = $r->query('to'); }
        if (!$this->okDate($r->query('from')) && !$this->okDate($r->query('to'))) { $w[] = 'school_year_id = ?'; $p[] = $yid; }
        if (($q = trim((string) $r->query('q', ''))) !== '') { $w[] = '(title LIKE ? OR payee LIKE ? OR code LIKE ?)'; $l = $this->like($q); array_push($p, $l, $l, $l); }
        $where = implode(' AND ', $w);
        try {
            $total = (int) DB::selectOne("SELECT COUNT(*) n FROM sm_fin_expenses WHERE $where", $p)->n;
            $sum = (int) DB::selectOne("SELECT COALESCE(SUM(amount),0) a FROM sm_fin_expenses WHERE $where", $p)->a;
            $byCat = DB::select("SELECT category, SUM(amount) amt, COUNT(*) n FROM sm_fin_expenses WHERE $where GROUP BY category ORDER BY amt DESC", $p);
            $rows = DB::select("SELECT * FROM sm_fin_expenses WHERE $where ORDER BY spent_at DESC, id DESC LIMIT $per OFFSET $off", $p);
        } catch (\Throwable $e) { abort(500, 'Chưa có bảng sm_fin_expenses. Hãy chạy file F01-tai-chinh-hoc-phi.sql trong HeidiSQL.'); }
        return response()->json(['meta' => $this->pm($total, $page, $per), 'sum' => $sum, 'by_category' => array_map(fn ($x) => ['key' => $x->category, 'label' => self::EXP[$x->category] ?? $x->category, 'amount' => (int) $x->amt, 'n' => (int) $x->n], $byCat),
            'data' => array_map(fn ($x) => ['id' => (int) $x->id, 'code' => $x->code, 'category' => $x->category, 'category_label' => self::EXP[$x->category] ?? $x->category, 'title' => $x->title, 'amount' => (int) $x->amount, 'spent_at' => $x->spent_at, 'payee' => $x->payee, 'method' => $x->method, 'method_label' => self::METHODS[$x->method] ?? $x->method, 'note' => $x->note, 'created_by' => $x->created_by], $rows)]);
    }
    public function expenseSave(Request $r, ?int $id = null)
    {
        $d = $r->validate(['category' => 'required|in:' . implode(',', array_keys(self::EXP)), 'title' => 'required|string|max:200', 'amount' => 'required|integer|min:1|max:100000000000', 'spent_at' => 'required|date', 'payee' => 'nullable|string|max:160',
            'method' => 'required|in:' . implode(',', array_keys(self::METHODS)), 'note' => 'nullable|string|max:500']);
        $yid = (int) (DB::table('sm_school_years')->whereRaw('? BETWEEN start_date AND end_date', [$d['spent_at']])->value('id') ?: DB::table('sm_school_years')->where('is_current', 1)->value('id'));
        $row = ['category' => $d['category'], 'title' => trim($d['title']), 'amount' => $d['amount'], 'spent_at' => $d['spent_at'], 'payee' => $d['payee'] ?? null, 'method' => $d['method'], 'note' => $d['note'] ?? null, 'school_year_id' => $yid ?: null, 'updated_at' => $this->nowUtc()];
        if ($id) { abort_unless(DB::table('sm_fin_expenses')->where('id', $id)->exists(), 404, 'Không tìm thấy khoản chi.'); DB::table('sm_fin_expenses')->where('id', $id)->update($row); $this->audit($r, 'expense.update', 'expense', $id, "{$row['title']} {$row['amount']}"); return response()->json(['message' => 'Đã cập nhật khoản chi.']); }
        [, $name] = $this->actor($r);
        $nid = DB::table('sm_fin_expenses')->insertGetId($row + ['created_by' => $name, 'status' => 'approved', 'created_at' => $this->nowUtc()]);
        DB::table('sm_fin_expenses')->where('id', $nid)->update(['code' => 'PC' . date('ymd', strtotime($d['spent_at'])) . str_pad((string) $nid, 4, '0', STR_PAD_LEFT)]);
        $this->audit($r, 'expense.create', 'expense', $nid, "{$row['title']} {$row['amount']}");
        return response()->json(['message' => 'Đã ghi khoản chi.', 'id' => $nid]);
    }
    public function expenseDelete(Request $r, int $id)
    {
        $d = $r->validate(['reason' => 'required|string|min:3|max:300']);
        $x = DB::table('sm_fin_expenses')->where('id', $id)->where('status', 'approved')->first(); abort_unless($x, 404, 'Không tìm thấy khoản chi.');
        DB::table('sm_fin_expenses')->where('id', $id)->update(['status' => 'void', 'updated_at' => $this->nowUtc()]);
        $this->audit($r, 'expense.void', 'expense', $id, "Hủy {$x->code} {$x->title}: " . $d['reason']);
        return response()->json(['message' => 'Đã hủy khoản chi.']);
    }

    /* ---------- 9. Báo cáo ---------- */
    public function report(Request $r)
    {
        $yid = $this->yid($r); [$b, $bb] = $this->inv($yid);
        $byClass = DB::select("SELECT class_name, grade, COUNT(*) n, SUM(total) billed, SUM(LEAST(paid,total)) paid, SUM(balance) balance FROM ($b) t WHERE pstatus <> 'cancelled' AND class_name IS NOT NULL GROUP BY class_name, grade ORDER BY grade, class_name", $bb);
        $byTerm = DB::select("SELECT term, COUNT(*) n, SUM(total) billed, SUM(LEAST(paid,total)) paid, SUM(balance) balance, SUM(discount) discount FROM ($b) t WHERE pstatus <> 'cancelled' GROUP BY term ORDER BY FIELD(term,'YEAR','HK1','HK2')", $bb);
        $byCat = DB::select("SELECT COALESCE(f.category,'other') cat, SUM(l.amount) amt, COUNT(*) n FROM sm_invoice_lines l JOIN sm_invoices i ON i.id = l.invoice_id LEFT JOIN sm_fee_items f ON f.id = l.fee_item_id WHERE i.school_year_id = ? AND i.status <> 'cancelled' GROUP BY COALESCE(f.category,'other') ORDER BY amt DESC", [$yid]);
        $months = DB::select("SELECT DATE_FORMAT(p.paid_at,'%Y-%m') m, SUM(p.amount) amt, COUNT(*) n FROM sm_payments p WHERE p.status = 'confirmed' AND p.paid_at >= ? GROUP BY DATE_FORMAT(p.paid_at,'%Y-%m') ORDER BY m", [Carbon::parse($this->today())->subMonths(11)->startOfMonth()->toDateString()]);
        $exMonths = []; $years = [];
        try {
            foreach (DB::select("SELECT DATE_FORMAT(spent_at,'%Y-%m') m, SUM(amount) amt FROM sm_fin_expenses WHERE status = 'approved' AND spent_at >= ? GROUP BY DATE_FORMAT(spent_at,'%Y-%m')", [Carbon::parse($this->today())->subMonths(11)->startOfMonth()->toDateString()]) as $x) $exMonths[$x->m] = (int) $x->amt;
            foreach (DB::select("SELECT school_year_id y, SUM(amount) amt FROM sm_fin_expenses WHERE status = 'approved' GROUP BY school_year_id") as $x) $years[(int) $x->y] = (int) $x->amt;
        } catch (\Throwable $e) { }
        $cmp = [];
        foreach (DB::select("SELECT y.id, y.label, COALESCE(SUM(CASE WHEN i.status <> 'cancelled' THEN i.total END),0) billed,
              COALESCE((SELECT SUM(p.amount) FROM sm_payments p JOIN sm_invoices i2 ON i2.id = p.invoice_id WHERE p.status = 'confirmed' AND i2.school_year_id = y.id),0) paid
            FROM sm_school_years y LEFT JOIN sm_invoices i ON i.school_year_id = y.id GROUP BY y.id, y.label, y.start_date ORDER BY y.start_date DESC LIMIT 6") as $x)
            $cmp[] = ['id' => (int) $x->id, 'label' => $x->label, 'billed' => (int) $x->billed, 'paid' => (int) $x->paid, 'expense' => $years[(int) $x->id] ?? 0, 'rate' => $x->billed > 0 ? round($x->paid * 100 / $x->billed, 1) : 0];
        return response()->json(['year_id' => $yid,
            'by_class' => array_map(fn ($x) => ['class_name' => $x->class_name, 'grade' => (int) $x->grade, 'n' => (int) $x->n, 'billed' => (int) $x->billed, 'paid' => (int) $x->paid, 'balance' => (int) $x->balance], $byClass),
            'by_term' => array_map(fn ($x) => ['term' => $x->term, 'label' => self::TERMS[$x->term] ?? $x->term, 'n' => (int) $x->n, 'billed' => (int) $x->billed, 'paid' => (int) $x->paid, 'balance' => (int) $x->balance, 'discount' => (int) $x->discount], $byTerm),
            'by_category' => array_map(fn ($x) => ['key' => $x->cat, 'label' => self::CATEGORIES[$x->cat] ?? $x->cat, 'amount' => (int) $x->amt, 'lines' => (int) $x->n], $byCat),
            'months' => array_map(fn ($x) => ['month' => $x->m, 'income' => (int) $x->amt, 'count' => (int) $x->n, 'expense' => $exMonths[$x->m] ?? 0], $months),
            'compare' => $cmp]);
    }

    /* ---------- 10. Cài đặt thanh toán & nhật ký ---------- */
    public function settings()
    {
        $m = []; foreach (DB::select('SELECT skey, svalue FROM sm_fee_settings') as $x) $m[$x->skey] = $x->svalue;
        return response()->json(['data' => array_merge(array_fill_keys(self::SETTING_KEYS, ''), array_intersect_key($m, array_flip(self::SETTING_KEYS)))]);
    }
    public function settingsSave(Request $r)
    {
        $d = $r->validate(['data' => 'required|array']);
        $in = array_intersect_key($d['data'], array_flip(self::SETTING_KEYS)); $changed = [];
        foreach ($in as $k => $v) {
            $v = is_scalar($v) ? trim((string) $v) : ''; abort_if(mb_strlen($v) > 300, 422, "Giá trị '$k' quá dài (tối đa 300 ký tự).");
            if ($k === 'account_no' && $v !== '') abort_unless(preg_match('/^[0-9A-Za-z\- ]{4,30}$/', $v), 422, 'Số tài khoản không hợp lệ.');
            if ($k === 'bank_bin' && $v !== '') abort_unless(preg_match('/^\d{6}$/', $v), 422, 'Mã BIN ngân hàng gồm 6 chữ số.');
            if (DB::table('sm_fee_settings')->where('skey', $k)->exists()) DB::table('sm_fee_settings')->where('skey', $k)->update(['svalue' => $v]); else DB::table('sm_fee_settings')->insert(['skey' => $k, 'svalue' => $v]);
            $changed[] = $k;
        }
        $this->audit($r, 'settings.update', 'settings', null, 'Sửa: ' . implode(', ', $changed));
        return response()->json(['message' => 'Đã lưu cài đặt thanh toán.']);
    }
    public function audits(Request $r)
    {
        [$page, $per, $off] = $this->pg($r);
        try {
            $total = (int) DB::table('sm_fin_audit')->count();
            $rows = DB::table('sm_fin_audit')->orderByDesc('id')->offset($off)->limit($per)->get();
        } catch (\Throwable $e) { abort(500, 'Chưa có bảng sm_fin_audit. Hãy chạy file F01-tai-chinh-hoc-phi.sql trong HeidiSQL.'); }
        return response()->json(['meta' => $this->pm($total, $page, $per), 'data' => $rows->map(fn ($x) => ['id' => (int) $x->id, 'actor' => $x->actor, 'action' => $x->action, 'entity' => $x->entity, 'entity_id' => $x->entity_id, 'detail' => $x->detail, 'ip' => $x->ip, 'created_at' => $x->created_at])]);
    }
}
