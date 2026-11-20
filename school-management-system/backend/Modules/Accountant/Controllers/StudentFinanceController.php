<?php

namespace Modules\Accountant\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Accountant\Services\FinanceService as F;

class StudentFinanceController extends BaseController
{
    private const SORTS = [
        'name' => 't.full_name', 'code' => 't.code', 'class' => 't.class_name', 'debt' => 't.debt_amount',
        'overdue' => 't.overdue_amount', 'paid' => 't.paid_amount', 'total' => 't.total_amount',
        'days' => 't.max_overdue_days',
    ];

    /** Điều kiện lọc dùng chung cho danh sách / KPI / xuất Excel. */
    private function filters(Request $r, bool $withStatus): array
    {
        $where = ['1=1'];
        $bind = [];
        if ($g = (int) $r->query('grade')) {
            $where[] = 't.grade = ?';
            $bind[] = $g;
        }
        if ($c = (int) $r->query('class_id')) {
            $where[] = 't.class_id = ?';
            $bind[] = $c;
        }
        if ($q = trim((string) $r->query('q'))) {
            $where[] = '(t.full_name LIKE ? OR t.code LIKE ?)';
            $bind[] = "%{$q}%";
            $bind[] = "%{$q}%";
        }
        if ($withStatus && ($st = $r->query('status')) && $st !== 'all') {
            if (in_array($st, ['overdue', 'debt', 'paid', 'none'], true)) {
                $where[] = 't.fin_status = ?';
                $bind[] = $st;
            } elseif ($st === 'owing') {
                $where[] = 't.debt_amount > 0';
            } elseif ($st === 'waiver') {
                $where[] = 't.waiver_count > 0';
            } elseif ($st === 'pending') {
                $where[] = 't.pending_count > 0';
            } elseif ($st === 'promise') {
                $where[] = 't.open_promises > 0';
            }
        }
        return [implode(' AND ', $where), $bind];
    }

    private function yearId(Request $r): int
    {
        return (int) ($r->query('year_id') ?: F::currentYearId());
    }

    private function cast(object $r): array
    {
        $total = (int) $r->total_amount;
        $paid = F::money($r->paid_amount);
        return [
            'id' => (int) $r->id, 'code' => $r->code, 'full_name' => $r->full_name, 'gender' => $r->gender,
            'birth_date' => $r->birth_date, 'class_id' => (int) $r->class_id, 'class_name' => $r->class_name,
            'grade' => (int) $r->grade, 'invoice_count' => (int) $r->invoice_count, 'total' => $total,
            'discount' => F::money($r->discount_amount), 'paid' => $paid, 'debt' => F::money($r->debt_amount),
            'overdue' => F::money($r->overdue_amount), 'open_invoices' => (int) $r->open_invoices,
            'next_due' => $r->next_due, 'max_overdue_days' => (int) $r->max_overdue_days,
            'pending_count' => (int) $r->pending_count, 'waiver_count' => (int) $r->waiver_count,
            'waiver_percent' => (int) $r->waiver_percent, 'open_promises' => (int) $r->open_promises,
            'fin_status' => $r->fin_status,
            'rate' => $total > 0 ? round(min($paid / $total, 1) * 100, 1) : 0,
        ];
    }

    public function index(Request $request)
    {
        $y = $this->yearId($request);
        $sort = self::SORTS[$request->query('sort', 'name')] ?? 't.full_name';
        $dir = strtolower($request->query('dir', 'asc')) === 'desc' ? 'DESC' : 'ASC';
        $per = max(5, min(100, (int) $request->query('per_page', 20)));
        $page = max(1, (int) $request->query('page', 1));
        $base = F::summarySql($y);

        [$w, $b] = $this->filters($request, true);
        $total = (int) DB::selectOne("SELECT COUNT(*) AS n FROM ({$base}) t WHERE {$w}", $b)->n;
        $rows = DB::select(
            "SELECT t.* FROM ({$base}) t WHERE {$w} ORDER BY {$sort} {$dir}, t.id ASC LIMIT {$per} OFFSET " . (($page - 1) * $per),
            $b
        );

        // KPI theo phạm vi (năm/khối/lớp/tìm kiếm), không phụ thuộc bộ lọc trạng thái
        [$w2, $b2] = $this->filters($request, false);
        $k = DB::selectOne(
            "SELECT COUNT(*) AS students,
                    SUM(t.total_amount) AS total, SUM(t.paid_amount) AS paid, SUM(t.debt_amount) AS debt,
                    SUM(t.overdue_amount) AS overdue,
                    SUM(t.fin_status = 'paid') AS paid_students, SUM(t.fin_status = 'debt') AS debt_students,
                    SUM(t.fin_status = 'overdue') AS overdue_students, SUM(t.fin_status = 'none') AS none_students,
                    SUM(t.waiver_count > 0) AS waiver_students, SUM(t.pending_count) AS pending_payments
             FROM ({$base}) t WHERE {$w2}",
            $b2
        );
        $tot = F::money($k->total);
        $kpi = [
            'students' => (int) $k->students, 'total' => $tot, 'paid' => F::money($k->paid),
            'debt' => F::money($k->debt), 'overdue' => F::money($k->overdue),
            'rate' => $tot > 0 ? round(F::money($k->paid) / $tot * 100, 1) : 0,
            'paid_students' => (int) $k->paid_students, 'debt_students' => (int) $k->debt_students,
            'overdue_students' => (int) $k->overdue_students, 'none_students' => (int) $k->none_students,
            'waiver_students' => (int) $k->waiver_students, 'pending_payments' => (int) $k->pending_payments,
        ];

        return $this->ok([
            'items' => array_map(fn ($r) => $this->cast($r), $rows),
            'meta' => ['page' => $page, 'per_page' => $per, 'total' => $total, 'last_page' => (int) max(1, ceil($total / $per))],
            'kpi' => $kpi,
            'year_id' => $y,
        ]);
    }

    /** Xuất CSV (mở được bằng Excel, có BOM UTF-8). */
    public function export(Request $request)
    {
        $y = $this->yearId($request);
        $sort = self::SORTS[$request->query('sort', 'class')] ?? 't.class_name';
        [$w, $b] = $this->filters($request, true);
        $rows = DB::select("SELECT t.* FROM (" . F::summarySql($y) . ") t WHERE {$w} ORDER BY {$sort}, t.full_name", $b);
        $label = DB::table('sm_school_years')->where('id', $y)->value('label');
        $labels = ['paid' => 'Đã đủ', 'debt' => 'Còn nợ', 'overdue' => 'Quá hạn', 'none' => 'Chưa có hóa đơn'];

        return response()->streamDownload(function () use ($rows, $labels) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Mã HS', 'Họ tên', 'Lớp', 'Tổng phải thu', 'Đã thu', 'Còn nợ', 'Quá hạn', 'Số ngày quá hạn', 'Tỷ lệ thu (%)', 'Trạng thái', 'Miễn giảm (%)']);
            foreach ($rows as $r) {
                $c = $this->cast($r);
                fputcsv($out, [$c['code'], $c['full_name'], $c['class_name'], $c['total'], $c['paid'], $c['debt'],
                    $c['overdue'], $c['max_overdue_days'], $c['rate'], $labels[$c['fin_status']] ?? '', $c['waiver_percent']]);
            }
            fclose($out);
        }, 'ho-so-tai-chinh-hoc-sinh-' . preg_replace('/[^0-9]/', '', (string) $label) . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function show(Request $request, int $id)
    {
        $st = F::findStudent($id);
        $y = $this->yearId($request);
        $all = F::invoiceRows($id);
        $cur = array_values(array_filter($all, fn ($i) => $i['school_year_id'] === $y));
        $class = F::classOf($id, $y);

        $p = DB::table('sm_student_profiles')->where('student_id', $id)->first();
        $profile = $p ? [
            'ethnicity' => $p->ethnicity, 'religion' => $p->religion, 'birth_place' => $p->birth_place,
            'hometown' => $p->hometown,
            'permanent_address' => F::decrypt($p->permanent_address), 'current_address' => F::decrypt($p->current_address),
            'phone' => F::decrypt($p->phone),
            'father_name' => $p->father_name, 'father_job' => $p->father_job, 'father_phone' => F::decrypt($p->father_phone),
            'mother_name' => $p->mother_name, 'mother_job' => $p->mother_job, 'mother_phone' => F::decrypt($p->mother_phone),
            'guardian_name' => $p->guardian_name, 'guardian_relation' => $p->guardian_relation,
            'guardian_phone' => F::decrypt($p->guardian_phone),
        ] : null;

        $acc = DB::table('sm_accounts')->where('student_id', $id)
            ->first(['username', 'email', 'status', 'last_login_at']);

        // tổng hợp theo từng năm học
        $byYear = [];
        foreach ($all as $i) {
            $byYear[$i['school_year_id']][] = $i;
        }
        $years = [];
        foreach ($byYear as $yid => $list) {
            $s = F::summarize($list);
            $c = F::classOf($id, (int) $yid);
            $years[] = ['year_id' => (int) $yid, 'label' => $list[0]['year_label'], 'class_name' => $c->name ?? null,
                'invoice_count' => $s['invoice_count'], 'total' => $s['total'], 'paid' => $s['paid'], 'debt' => $s['debt'],
                'overdue' => $s['overdue'], 'rate' => $s['rate'], 'fin_status' => $s['fin_status']];
        }
        usort($years, fn ($a, $b) => $b['year_id'] <=> $a['year_id']);

        $today = F::today();
        $counts = [
            'pending_payments' => DB::table('sm_payments')->where('student_id', $id)->where('status', 'pending')->count(),
            'open_disputes' => DB::table('sm_invoice_disputes')->where('student_id', $id)->where('status', 'open')->count(),
            'open_promises' => DB::table('sm_debt_notes')->where('student_id', $id)->where('kind', 'promise')->where('status', 'open')->count(),
            'late_promises' => DB::table('sm_debt_notes')->where('student_id', $id)->where('kind', 'promise')->where('status', 'open')->where('promise_date', '<', $today)->count(),
            'waivers' => DB::table('sm_fee_waivers')->where('student_id', $id)->where('school_year_id', $y)->count(),
            'reminders' => DB::table('sm_reminders')->where('student_id', $id)->count(),
        ];

        return $this->ok([
            'student' => ['id' => (int) $st->id, 'code' => $st->code, 'full_name' => $st->full_name, 'gender' => $st->gender,
                'birth_date' => $st->birth_date, 'admission_year' => (int) $st->admission_year],
            'class' => $class ? ['id' => (int) $class->id, 'name' => $class->name, 'grade' => (int) $class->grade] : null,
            'year_id' => $y,
            'profile' => $profile,
            'account' => $acc,
            'summary' => F::summarize($cur),
            'all_time' => F::summarize($all),
            'years' => $years,
            'counts' => $counts,
            'waiver_percent' => (int) DB::table('sm_fee_waivers')->where('student_id', $id)->where('school_year_id', $y)->max('percent'),
        ]);
    }

    public function invoices(Request $request, int $id)
    {
        F::findStudent($id);
        $y = $request->query('year_id') === 'all' ? null : $this->yearId($request);
        return $this->ok(F::invoiceRows($id, $y));
    }

    public function invoice(int $id)
    {
        $v = DB::table('sm_invoices')->where('id', $id)->first();
        if (! $v) {
            return $this->fail('Không tìm thấy hóa đơn.', 404);
        }
        $row = collect(F::invoiceRows((int) $v->student_id))->firstWhere('id', $id);
        $lines = DB::table('sm_invoice_lines as l')->leftJoin('sm_fee_items as f', 'f.id', '=', 'l.fee_item_id')
            ->where('l.invoice_id', $id)->orderBy('l.id')
            ->get(['l.id', 'l.description', 'l.quantity', 'l.unit_price', 'l.discount', 'l.amount', 'f.category']);
        $payments = DB::table('sm_payments')->where('invoice_id', $id)->orderByDesc('id')
            ->get(['id', 'receipt_code', 'amount', 'method', 'reference', 'status', 'paid_at', 'confirmed_by', 'reject_reason']);
        $disputes = DB::table('sm_invoice_disputes')->where('invoice_id', $id)->orderByDesc('id')->get();
        $st = DB::table('sm_students')->where('id', $v->student_id)->first(['id', 'code', 'full_name']);

        return $this->ok([
            'invoice' => $row, 'student' => $st, 'lines' => $lines, 'payments' => $payments, 'disputes' => $disputes,
        ]);
    }

    public function wallet(int $id)
    {
        $st = F::findStudent($id);
        $code = strtolower($st->code);
        $w = DB::table('sm_wallets')->whereRaw('LOWER(student_code) = ?', [$code])->first();
        $tx = DB::table('sm_wallet_tx')->whereRaw('LOWER(student_code) = ?', [$code])->orderByDesc('id')->limit(50)
            ->get(['id', 'type', 'amount', 'method', 'status', 'gateway_ref', 'title', 'created_at']);
        return $this->ok([
            'has_wallet' => (bool) $w,
            'balance' => $w ? (int) $w->balance : 0,
            'updated_at' => $w->updated_at ?? null,
            'transactions' => $tx,
        ]);
    }

    /** Dòng thời gian hợp nhất mọi hoạt động tài chính của học sinh. */
    public function timeline(int $id)
    {
        F::findStudent($id);
        $ev = [];

        foreach (DB::table('sm_invoices')->where('student_id', $id)->get(['id', 'code', 'title', 'total', 'issue_date', 'status']) as $r) {
            $ev[] = ['type' => 'invoice', 'at' => $r->issue_date . ' 00:00:00', 'title' => 'Phát hành hóa đơn ' . $r->code,
                'detail' => $r->title, 'amount' => (int) $r->total, 'actor' => null];
        }
        $actions = ['collect' => 'Thu tiền', 'confirm' => 'Xác nhận phiếu thu', 'reject' => 'Từ chối phiếu thu', 'void' => 'Hủy phiếu thu'];
        foreach (DB::table('sm_payment_log as l')->join('sm_payments as p', 'p.id', '=', 'l.payment_id')
                     ->where('p.student_id', $id)->orderByDesc('l.id')->limit(150)
                     ->get(['l.action', 'l.detail', 'l.actor', 'l.created_at', 'p.receipt_code', 'p.amount']) as $r) {
            $ev[] = ['type' => 'payment', 'at' => $r->created_at, 'title' => ($actions[$r->action] ?? $r->action) . ' ' . $r->receipt_code,
                'detail' => $r->detail, 'amount' => (int) $r->amount, 'actor' => $r->actor];
        }
        // phiếu thu cũ chưa có log
        $logged = DB::table('sm_payment_log')->pluck('payment_id')->unique()->flip();
        foreach (DB::table('sm_payments')->where('student_id', $id)->get(['id', 'receipt_code', 'amount', 'method', 'paid_at', 'status', 'confirmed_by']) as $r) {
            if (! isset($logged[$r->id])) {
                $ev[] = ['type' => 'payment', 'at' => $r->paid_at, 'title' => 'Phiếu thu ' . $r->receipt_code . ' (' . $r->status . ')',
                    'detail' => 'Hình thức: ' . $r->method, 'amount' => (int) $r->amount, 'actor' => $r->confirmed_by];
            }
        }
        foreach (DB::table('sm_debt_notes')->where('student_id', $id)->get() as $r) {
            $label = ['note' => 'Ghi chú', 'contact' => 'Liên hệ phụ huynh', 'promise' => 'Hẹn trả tiền'][$r->kind] ?? $r->kind;
            $ev[] = ['type' => 'note', 'at' => $r->created_at, 'title' => $label, 'detail' => $r->note,
                'amount' => $r->promise_amount ? (int) $r->promise_amount : null, 'actor' => $r->created_by];
        }
        foreach (DB::table('sm_reminders')->where('student_id', $id)->get() as $r) {
            $ev[] = ['type' => 'reminder', 'at' => $r->created_at, 'title' => 'Nhắc nợ cấp ' . $r->level . ' (' . $r->channel . ')',
                'detail' => $r->subject, 'amount' => (int) $r->debt_amount, 'actor' => $r->created_by];
        }
        foreach (DB::table('sm_invoice_disputes')->where('student_id', $id)->get() as $r) {
            $ev[] = ['type' => 'dispute', 'at' => $r->created_at, 'title' => 'Khiếu nại hóa đơn', 'detail' => $r->message, 'amount' => null, 'actor' => 'Phụ huynh / học sinh'];
            if ($r->replied_at) {
                $ev[] = ['type' => 'dispute', 'at' => $r->replied_at, 'title' => 'Đã trả lời khiếu nại', 'detail' => $r->reply, 'amount' => null, 'actor' => $r->replied_by];
            }
        }
        foreach (DB::table('sm_fee_waivers')->where('student_id', $id)->get() as $r) {
            $ev[] = ['type' => 'waiver', 'at' => $r->created_at, 'title' => 'Miễn giảm ' . $r->percent . '%: ' . $r->label,
                'detail' => $r->note, 'amount' => null, 'actor' => $r->approved_by];
        }

        usort($ev, fn ($a, $b) => strcmp((string) $b['at'], (string) $a['at']));
        return $this->ok(array_slice($ev, 0, 200));
    }
}
