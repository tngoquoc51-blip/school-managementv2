<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Báo cáo & truy vấn Học phí – Tài chính cho cổng Admin.
 * Đọc dữ liệu thật qua view sm_v_invoice_balance (xem backend/database/sql/admin_finance.sql).
 */
class AdminFinanceReports
{
    private const V = 'sm_v_invoice_balance';

    public function currentYear(): int
    {
        return (int) (DB::table('sm_school_years')->where('is_current', 1)->value('id') ?: DB::table('sm_school_years')->max('id'));
    }

    /** Bộ lọc chung của mọi màn hình */
    public function filters(Request $r): array
    {
        return [
            'year_id'    => (int) ($r->query('year_id') ?: $this->currentYear()),
            'period_id'  => (int) $r->query('period_id'),
            'grade'      => (int) $r->query('grade'),
            'class_id'   => (int) $r->query('class_id'),
            'term'       => (string) $r->query('term', ''),
            'pay_status' => (string) $r->query('pay_status', ''),
            'q'          => trim((string) $r->query('q', '')),
        ];
    }

    private function apply($q, array $f, string $a = 'v')
    {
        if ($f['year_id']) $q->where("$a.school_year_id", $f['year_id']);
        if ($f['period_id']) $q->where("$a.period_id", $f['period_id']);
        if ($f['grade']) $q->where("$a.grade", $f['grade']);
        if ($f['class_id']) $q->where("$a.class_id", $f['class_id']);
        if ($f['term'] !== '') $q->where("$a.term", $f['term']);
        if ($f['pay_status'] === 'overdue') {
            $q->where("$a.overdue_days", '>', 0);
        } elseif (in_array($f['pay_status'], ['paid', 'partial', 'unpaid'], true)) {
            $q->where("$a.pay_status", $f['pay_status']);
        }
        if ($f['q'] !== '') {
            $like = '%' . $f['q'] . '%';
            $q->where(fn ($w) => $w->where("$a.student_name", 'like', $like)->orWhere("$a.student_code", 'like', $like)->orWhere("$a.code", 'like', $like));
        }

        return $q;
    }

    private function inv(array $f)
    {
        return $this->apply(DB::table(self::V . ' as v')->where('v.status', 'issued'), $f);
    }

    private function pay(array $f)
    {
        return $this->apply(DB::table('sm_payments as p')->join(self::V . ' as v', 'v.id', '=', 'p.invoice_id'), $f);
    }

    private function pageOut($p): array
    {
        return ['data' => $p->items(), 'current_page' => $p->currentPage(), 'last_page' => $p->lastPage(), 'total' => $p->total(), 'per_page' => $p->perPage()];
    }

    /* ---------- danh mục lọc ---------- */

    public function meta(): array
    {
        return [
            'current_year_id' => $this->currentYear(),
            'years' => DB::table('sm_school_years')->orderByDesc('id')->get(['id', 'label', 'is_current']),
            'periods' => DB::table('sm_fee_periods')->orderByDesc('id')->get(['id', 'code', 'name', 'school_year_id', 'term', 'status']),
            'classes' => DB::table('sm_classes')->orderBy('grade')->orderBy('name')->get(['id', 'name', 'grade', 'school_year_id']),
        ];
    }

    /* ---------- tổng quan ---------- */

    public function overview(array $f): array
    {
        $t = $this->inv($f)->selectRaw(
            'COUNT(*) n, COALESCE(SUM(v.total),0) invoiced, COALESCE(SUM(v.paid),0) paid, COALESCE(SUM(v.remaining),0) remaining,
             COALESCE(SUM(v.discount),0) discount, COALESCE(SUM(v.overdue_days > 0),0) overdue_n,
             COALESCE(SUM(CASE WHEN v.overdue_days > 0 THEN v.remaining ELSE 0 END),0) overdue_amt,
             COUNT(DISTINCT CASE WHEN v.remaining > 0 THEN v.student_id END) debtors,
             COUNT(DISTINCT CASE WHEN v.overdue_days > 0 THEN v.student_id END) overdue_students'
        )->first();
        $invoiced = (int) $t->invoiced;
        $totals = [
            'n' => (int) $t->n, 'invoiced' => $invoiced, 'paid' => (int) $t->paid, 'remaining' => (int) $t->remaining, 'discount' => (int) $t->discount,
            'overdue_n' => (int) $t->overdue_n, 'overdue_amt' => (int) $t->overdue_amt, 'debtors' => (int) $t->debtors, 'overdue_students' => (int) $t->overdue_students,
            'rate' => $invoiced > 0 ? round($t->paid / $invoiced * 100, 1) : 0,
        ];

        $monthly = $this->pay($f)->where('p.status', 'confirmed')
            ->selectRaw("DATE_FORMAT(p.paid_at, '%Y-%m') ym, SUM(p.amount) amt, COUNT(*) n")->groupBy('ym')->orderBy('ym')->get()
            ->map(fn ($r) => ['ym' => $r->ym, 'amt' => (int) $r->amt, 'n' => (int) $r->n])->all();

        $byMethod = $this->pay($f)->where('p.status', 'confirmed')
            ->selectRaw('p.method, SUM(p.amount) amt, COUNT(*) n')->groupBy('p.method')->orderByDesc('amt')->get()
            ->map(fn ($r) => ['method' => $r->method, 'amt' => (int) $r->amt, 'n' => (int) $r->n])->all();

        $byGrade = $this->inv($f)->selectRaw('v.grade, SUM(v.total) invoiced, SUM(v.paid) paid, SUM(v.remaining) remaining')
            ->groupBy('v.grade')->orderBy('v.grade')->get()
            ->map(fn ($r) => ['grade' => $r->grade, 'invoiced' => (int) $r->invoiced, 'paid' => (int) $r->paid, 'remaining' => (int) $r->remaining])->all();

        $topClasses = $this->inv($f)->whereNotNull('v.class_id')
            ->selectRaw('v.class_id, v.class_name, v.grade, SUM(v.total) invoiced, SUM(v.remaining) remaining')
            ->groupBy('v.class_id', 'v.class_name', 'v.grade')->orderByDesc('remaining')->limit(8)->get()
            ->map(fn ($r) => ['class_id' => $r->class_id, 'class_name' => $r->class_name, 'grade' => $r->grade, 'invoiced' => (int) $r->invoiced, 'remaining' => (int) $r->remaining])->all();

        $byPeriod = $this->inv($f)->join('sm_fee_periods as fp', 'fp.id', '=', 'v.period_id')
            ->selectRaw('fp.id, fp.code, fp.name, fp.status, fp.due_date, SUM(v.total) invoiced, SUM(v.paid) paid, SUM(v.remaining) remaining')
            ->groupBy('fp.id', 'fp.code', 'fp.name', 'fp.status', 'fp.due_date')->orderBy('fp.id')->get()
            ->map(fn ($r) => ['id' => $r->id, 'code' => $r->code, 'name' => $r->name, 'status' => $r->status, 'due_date' => $r->due_date, 'invoiced' => (int) $r->invoiced, 'paid' => (int) $r->paid, 'remaining' => (int) $r->remaining])->all();

        $pend = $this->pay($f)->where('p.status', 'pending')->selectRaw('COUNT(*) n, COALESCE(SUM(p.amount),0) amt')->first();
        $disp = $this->apply(DB::table('sm_invoice_disputes as d')->join(self::V . ' as v', 'v.id', '=', 'd.invoice_id'), $f)->where('d.status', 'open')->count();

        return [
            'totals' => $totals, 'monthly' => $monthly, 'by_method' => $byMethod, 'by_grade' => $byGrade, 'top_classes' => $topClasses,
            'by_period' => $byPeriod, 'pending' => ['n' => (int) $pend->n, 'amt' => (int) $pend->amt], 'disputes_open' => (int) $disp,
        ];
    }

    /* ---------- hóa đơn ---------- */

    public function invoices(array $f, int $perPage, string $sort): array
    {
        $q = $this->inv($f);
        match ($sort) {
            'remaining' => $q->orderByDesc('v.remaining')->orderByDesc('v.id'),
            'overdue' => $q->orderByDesc('v.overdue_days')->orderByDesc('v.id'),
            default => $q->orderByDesc('v.issue_date')->orderByDesc('v.id'),
        };

        return $this->pageOut($q->paginate($perPage, ['v.*']));
    }

    public function invoice(int $id): array
    {
        $inv = DB::table(self::V)->where('id', $id)->first();
        abort_unless($inv, 404, 'Không tìm thấy hóa đơn.');

        return [
            'invoice' => $inv,
            'lines' => DB::table('sm_invoice_lines')->where('invoice_id', $id)->orderBy('id')->get(),
            'payments' => DB::table('sm_payments')->where('invoice_id', $id)->orderByDesc('paid_at')->get(),
            'disputes' => DB::table('sm_invoice_disputes')->where('invoice_id', $id)->orderByDesc('id')->get(),
        ];
    }

    /* ---------- thanh toán ---------- */

    public function payments(array $f, Request $r): array
    {
        $search = $f['q'];
        $f['q'] = '';
        $base = fn () => $this->pay($f)
            ->when($r->query('method'), fn ($q, $m) => $q->where('p.method', $m))
            ->when($r->query('from'), fn ($q, $d) => $q->whereDate('p.paid_at', '>=', $d))
            ->when($r->query('to'), fn ($q, $d) => $q->whereDate('p.paid_at', '<=', $d))
            ->when($search !== '', function ($q) use ($search) {
                $like = '%' . $search . '%';
                $q->where(fn ($w) => $w->where('v.student_name', 'like', $like)->orWhere('v.student_code', 'like', $like)
                    ->orWhere('p.receipt_code', 'like', $like)->orWhere('p.reference', 'like', $like));
            });

        $summary = $base()->selectRaw('p.status, COUNT(*) n, COALESCE(SUM(p.amount),0) amt')->groupBy('p.status')->get()
            ->mapWithKeys(fn ($x) => [$x->status => ['n' => (int) $x->n, 'amt' => (int) $x->amt]])->all();

        $q = $base()->when($r->query('status'), fn ($q, $s) => $q->where('p.status', $s))
            ->orderByRaw("p.status = 'pending' DESC")->orderByDesc('p.paid_at')->orderByDesc('p.id');
        $page = $q->paginate(min((int) $r->query('per_page', 20), 100), [
            'p.id', 'p.receipt_code', 'p.amount', 'p.method', 'p.reference', 'p.status', 'p.paid_at', 'p.confirmed_by', 'p.reject_reason',
            'v.code as invoice_code', 'v.title', 'v.student_code', 'v.student_name', 'v.class_name',
        ]);

        return $this->pageOut($page) + ['summary' => $summary];
    }

    /* ---------- công nợ ---------- */

    public function debtRows(array $f, int $minDays)
    {
        return $this->inv($f)->where('v.remaining', '>', 0)
            ->when($minDays > 0, fn ($q) => $q->where('v.overdue_days', '>=', $minDays))
            ->groupBy('v.student_id', 'v.student_code', 'v.student_name', 'v.class_name', 'v.grade')
            ->selectRaw(
                "v.student_id, v.student_code, v.student_name, v.class_name, v.grade, COUNT(*) invoices_n, SUM(v.remaining) debt, MAX(v.overdue_days) max_overdue,
                 (SELECT COUNT(*) FROM sm_debt_notes n WHERE n.student_id = v.student_id) notes_n,
                 (SELECT n2.promise_date FROM sm_debt_notes n2 WHERE n2.student_id = v.student_id AND n2.kind = 'promise' AND n2.status = 'open' ORDER BY n2.id DESC LIMIT 1) promise_date"
            )->orderByDesc('debt')->get();
    }

    public function debts(array $f, int $minDays, int $page, int $perPage): array
    {
        $rows = $this->debtRows($f, $minDays);
        $total = $rows->count();
        $items = $rows->forPage($page, $perPage)->values()->map(fn ($r) => [
            'student_id' => $r->student_id, 'student_code' => $r->student_code, 'student_name' => $r->student_name, 'class_name' => $r->class_name, 'grade' => $r->grade,
            'invoices_n' => (int) $r->invoices_n, 'debt' => (int) $r->debt, 'max_overdue' => (int) $r->max_overdue, 'notes_n' => (int) $r->notes_n, 'promise_date' => $r->promise_date,
        ])->all();

        return [
            'data' => $items, 'current_page' => $page, 'last_page' => max(1, (int) ceil($total / $perPage)), 'total' => $total, 'per_page' => $perPage,
            'summary' => ['students' => $total, 'debt' => (int) $rows->sum('debt'), 'over90' => $rows->where('max_overdue', '>=', 90)->count()],
        ];
    }

    /* ---------- đợt thu & khoản thu ---------- */

    public function periods(int $yearId): array
    {
        $periods = DB::table('sm_fee_periods')->when($yearId, fn ($q) => $q->where('school_year_id', $yearId))->orderByDesc('id')->get();
        $agg = DB::table(self::V . ' as v')->where('v.status', 'issued')->whereNotNull('v.period_id')
            ->selectRaw('v.period_id, COUNT(*) n, SUM(v.total) invoiced, SUM(v.paid) paid, SUM(v.remaining) remaining')->groupBy('v.period_id')->get()->keyBy('period_id');
        $items = DB::table('sm_fee_period_items as pi')->join('sm_fee_items as fi', 'fi.id', '=', 'pi.fee_item_id')
            ->get(['pi.period_id', 'fi.code', 'fi.name', 'fi.category', 'pi.amount'])->groupBy('period_id');

        return $periods->map(function ($p) use ($agg, $items) {
            $a = $agg[$p->id] ?? null;

            return [
                'id' => $p->id, 'code' => $p->code, 'name' => $p->name, 'term' => $p->term, 'grade' => $p->grade, 'status' => $p->status,
                'open_date' => $p->open_date, 'due_date' => $p->due_date, 'note' => $p->note, 'closed_at' => $p->closed_at, 'closed_by' => $p->closed_by,
                'invoices_n' => (int) ($a->n ?? 0), 'invoiced' => (int) ($a->invoiced ?? 0), 'paid' => (int) ($a->paid ?? 0), 'remaining' => (int) ($a->remaining ?? 0),
                'items' => ($items[$p->id] ?? collect())->values()->all(),
            ];
        })->all();
    }

    public function feeItems(): array
    {
        return DB::table('sm_fee_items')->orderBy('category')->orderBy('id')->get()->all();
    }

    /* ---------- miễn giảm ---------- */

    public function waivers(array $f, string $kind): array
    {
        $base = fn () => DB::table('sm_fee_waivers as w')->join('sm_students as s', 's.id', '=', 'w.student_id')
            ->leftJoin('sm_enrollments as e', fn ($j) => $j->on('e.student_id', '=', 'w.student_id')->on('e.school_year_id', '=', 'w.school_year_id'))
            ->leftJoin('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->when($f['year_id'], fn ($q, $y) => $q->where('w.school_year_id', $y))
            ->when($f['grade'], fn ($q, $g) => $q->where('c.grade', $g))
            ->when($f['q'] !== '', function ($q) use ($f) {
                $like = '%' . $f['q'] . '%';
                $q->where(fn ($w) => $w->where('s.full_name', 'like', $like)->orWhere('s.code', 'like', $like)->orWhere('w.label', 'like', $like));
            });
        $summary = $base()->selectRaw('w.kind, COUNT(*) n, ROUND(AVG(w.percent)) avg_percent')->groupBy('w.kind')->get()
            ->map(fn ($r) => ['kind' => $r->kind, 'n' => (int) $r->n, 'avg_percent' => (int) $r->avg_percent])->all();
        $rows = $base()->when($kind !== '', fn ($q) => $q->where('w.kind', $kind))->orderBy('c.grade')->orderBy('c.name')->orderBy('s.full_name')->limit(500)
            ->get(['w.id', 'w.kind', 'w.label', 'w.percent', 'w.note', 'w.approved_by', 'w.created_at', 's.code as student_code', 's.full_name as student_name', 'c.name as class_name', 'c.grade'])->all();

        return ['summary' => $summary, 'data' => $rows];
    }

    /* ---------- khiếu nại ---------- */

    public function disputes(array $f, string $status): array
    {
        return $this->apply(DB::table('sm_invoice_disputes as d')->join(self::V . ' as v', 'v.id', '=', 'd.invoice_id'), array_merge($f, ['q' => '', 'period_id' => 0, 'class_id' => 0]))
            ->when($status !== '', fn ($q) => $q->where('d.status', $status))
            ->orderByRaw("d.status = 'open' DESC")->orderByDesc('d.id')->limit(200)
            ->get(['d.id', 'd.invoice_id', 'd.message', 'd.status', 'd.reply', 'd.replied_by', 'd.created_at', 'd.replied_at', 'v.code as invoice_code', 'v.title', 'v.total', 'v.student_code', 'v.student_name', 'v.class_name'])->all();
    }

    /* ---------- nhật ký ---------- */

    public function audit(): array
    {
        $a = DB::table('sm_payment_log as l')->leftJoin('sm_payments as p', 'p.id', '=', 'l.payment_id')->orderByDesc('l.id')->limit(60)
            ->get(['l.created_at', 'l.action', 'l.detail', 'l.actor', 'p.receipt_code as ref'])
            ->map(fn ($r) => ['time' => $r->created_at, 'source' => 'Thanh toán', 'action' => $r->action, 'detail' => $r->detail, 'actor' => $r->actor, 'ref' => $r->ref]);
        $b = DB::table('sm_fee_period_log as l')->leftJoin('sm_fee_periods as fp', 'fp.id', '=', 'l.period_id')->orderByDesc('l.id')->limit(60)
            ->get(['l.created_at', 'l.action', 'l.detail', 'l.actor', 'fp.code as ref'])
            ->map(fn ($r) => ['time' => $r->created_at, 'source' => 'Đợt thu', 'action' => $r->action, 'detail' => $r->detail, 'actor' => $r->actor, 'ref' => $r->ref]);
        $c = DB::table('sm_fee_audit')->orderByDesc('id')->limit(60)->get(['created_at', 'action', 'detail', 'actor_id', 'fee_item_id'])
            ->map(fn ($r) => ['time' => $r->created_at, 'source' => 'Khoản thu', 'action' => $r->action, 'detail' => $r->detail, 'actor' => $r->actor_id ? ('#' . $r->actor_id) : '—', 'ref' => $r->fee_item_id ? ('#' . $r->fee_item_id) : null]);

        return $a->concat($b)->concat($c)->sortByDesc('time')->take(100)->values()->all();
    }
}
