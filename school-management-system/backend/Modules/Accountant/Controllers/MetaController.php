<?php

namespace Modules\Accountant\Controllers;

use Illuminate\Support\Facades\DB;
use Modules\Accountant\Services\FinanceService as F;

class MetaController extends BaseController
{
    public const WAIVER_KINDS = [
        'policy_family'  => 'Con thương binh, liệt sĩ',
        'poor_household' => 'Hộ nghèo',
        'near_poor'      => 'Hộ cận nghèo',
        'ethnic_minority' => 'Dân tộc thiểu số vùng khó khăn',
        'orphan'         => 'Mồ côi / khuyết tật',
        'sibling'        => 'Anh chị em cùng học tại trường',
        'merit'          => 'Học sinh giỏi, thành tích xuất sắc',
        'other'          => 'Khác (ghi rõ trong ghi chú)',
    ];

    public function index()
    {
        $years = DB::table('sm_school_years')->orderByDesc('id')
            ->get(['id', 'label', 'start_date', 'end_date', 'is_current', 'status']);
        $classes = DB::table('sm_classes')->orderBy('school_year_id')->orderBy('grade')->orderBy('name')
            ->get(['id', 'school_year_id', 'grade', 'name']);

        $set = F::settings();
        $bank = [
            'bank_bin' => $set['bank_bin'] ?? null,
            'bank_name' => $set['bank_name'] ?? null,
            'bank_short' => $set['bank_short'] ?? null,
            'account_no' => $set['account_no'] ?? null,
            'account_name' => $set['account_name'] ?? null,
            'transfer_hint' => $set['transfer_hint'] ?? null,
            'demo_note' => $set['demo_note'] ?? null,
        ];
        $school = [
            'name' => $set['school_name'] ?? 'TRƯỜNG THPT',
            'address' => $set['school_address'] ?? '',
            'hotline' => $set['hotline'] ?? '',
            'office' => $set['office'] ?? '',
            'receipt_footer' => $set['receipt_footer'] ?? '',
            'receipt_accountant' => $set['receipt_accountant'] ?? 'Kế toán thu',
            'receipt_treasurer' => $set['receipt_treasurer'] ?? 'Thủ quỹ',
        ];

        $kinds = self::WAIVER_KINDS;
        foreach (DB::table('sm_fee_waivers')->select('kind', 'label')->distinct()->get() as $k) {
            if (! isset($kinds[$k->kind])) {
                $kinds[$k->kind] = $k->label;
            }
        }

        return $this->ok([
            'current_year_id' => F::currentYearId(),
            'years' => $years,
            'classes' => $classes,
            'bank' => $bank,
            'school' => $school,
            'waiver_kinds' => $kinds,
            'payment_methods' => [
                ['value' => 'cash', 'label' => 'Tiền mặt'],
                ['value' => 'bank_transfer', 'label' => 'Chuyển khoản'],
                ['value' => 'card', 'label' => 'Thẻ'],
                ['value' => 'ewallet', 'label' => 'Ví điện tử'],
            ],
            'templates' => DB::table('sm_reminder_templates')->where('is_active', 1)->orderBy('level')
                ->get(['id', 'code', 'name', 'level', 'subject', 'body']),
            'today' => F::today(),
        ]);
    }

    /** Chuông thông báo: việc kế toán cần xử lý ngay. */
    public function notifications()
    {
        $y = F::currentYearId();
        $today = F::today();
        $items = [];

        $pending = DB::table('sm_payments as p')->join('sm_students as s', 's.id', '=', 'p.student_id')
            ->join('sm_invoices as v', 'v.id', '=', 'p.invoice_id')
            ->where('p.status', 'pending')->orderByDesc('p.id')->limit(6)
            ->get(['p.id', 'p.amount', 'p.created_at', 'p.receipt_code', 's.id as sid', 's.full_name', 's.code']);
        $pendingTotal = DB::table('sm_payments')->where('status', 'pending')->count();
        foreach ($pending as $r) {
            $items[] = ['key' => 'pay' . $r->id, 'type' => 'payment', 'level' => 'warn', 'student_id' => (int) $r->sid,
                'title' => 'Phiếu thu chờ xác nhận ' . $r->receipt_code,
                'desc' => $r->full_name . ' (' . $r->code . ') · ' . F::vnd($r->amount), 'at' => $r->created_at, 'tab' => 'payments'];
        }

        $disputeTotal = DB::table('sm_invoice_disputes')->where('status', 'open')->count();
        $disp = DB::table('sm_invoice_disputes as d')->join('sm_students as s', 's.id', '=', 'd.student_id')
            ->where('d.status', 'open')->orderByDesc('d.id')->limit(5)
            ->get(['d.id', 'd.message', 'd.created_at', 's.id as sid', 's.full_name', 's.code']);
        foreach ($disp as $r) {
            $items[] = ['key' => 'dis' . $r->id, 'type' => 'dispute', 'level' => 'info', 'student_id' => (int) $r->sid,
                'title' => 'Khiếu nại hóa đơn chưa trả lời',
                'desc' => $r->full_name . ': ' . mb_substr($r->message, 0, 70), 'at' => $r->created_at, 'tab' => 'disputes'];
        }

        $lateQ = DB::table('sm_debt_notes as n')->join('sm_students as s', 's.id', '=', 'n.student_id')
            ->where('n.kind', 'promise')->where('n.status', 'open')->where('n.promise_date', '<', $today);
        $lateTotal = (clone $lateQ)->count();
        foreach ($lateQ->orderBy('n.promise_date')->limit(5)
                     ->get(['n.id', 'n.promise_date', 'n.promise_amount', 's.id as sid', 's.full_name', 's.code']) as $r) {
            $items[] = ['key' => 'pro' . $r->id, 'type' => 'promise', 'level' => 'danger', 'student_id' => (int) $r->sid,
                'title' => 'Lỡ hẹn trả tiền ' . date('d/m', strtotime($r->promise_date)),
                'desc' => $r->full_name . ' (' . $r->code . ')' . ($r->promise_amount ? ' · hẹn ' . F::vnd($r->promise_amount) : ''),
                'at' => $r->promise_date . ' 00:00:00', 'tab' => 'debt'];
        }

        $od = DB::select("SELECT t.id, t.full_name, t.code, t.overdue_amount, t.max_overdue_days FROM ("
            . F::summarySql($y) . ") t WHERE t.overdue_amount > 0 ORDER BY t.overdue_amount DESC LIMIT 5");
        $odTotal = DB::selectOne("SELECT COUNT(*) AS n FROM (" . F::summarySql($y) . ") t WHERE t.overdue_amount > 0")->n;
        foreach ($od as $r) {
            $items[] = ['key' => 'od' . $r->id, 'type' => 'overdue', 'level' => 'danger', 'student_id' => (int) $r->id,
                'title' => 'Nợ quá hạn ' . (int) $r->max_overdue_days . ' ngày',
                'desc' => $r->full_name . ' (' . $r->code . ') · ' . F::vnd($r->overdue_amount), 'at' => null, 'tab' => 'invoices'];
        }

        return $this->ok([
            'counts' => [
                'pending_payments' => (int) $pendingTotal,
                'open_disputes' => (int) $disputeTotal,
                'late_promises' => (int) $lateTotal,
                'overdue_students' => (int) $odTotal,
                'total' => (int) ($pendingTotal + $disputeTotal + $lateTotal + $odTotal),
            ],
            'items' => $items,
        ]);
    }
}
