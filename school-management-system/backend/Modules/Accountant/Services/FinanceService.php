<?php

namespace Modules\Accountant\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Toàn bộ công thức tài chính dùng chung. Mọi số tiền là VND (số nguyên).
 *   Còn nợ (hóa đơn)  = max(tổng tiền - tổng phiếu thu "confirmed", 0)
 *   Quá hạn           = còn nợ > 0 và hạn nộp < hôm nay
 * Hóa đơn bị hủy (status = cancelled) và phiếu thu pending/rejected/cancelled không tính vào số đã thu.
 */
class FinanceService
{
    public static function today(): string
    {
        return now()->toDateString();
    }

    public static function money($v): int
    {
        return (int) round((float) $v);
    }

    public static function vnd($n): string
    {
        return number_format((float) $n, 0, ',', '.') . 'đ';
    }

    public static function currentYearId(): int
    {
        $id = DB::table('sm_school_years')->where('is_current', 1)->value('id');
        return (int) ($id ?: DB::table('sm_school_years')->max('id'));
    }

    public static function settings(): array
    {
        return DB::table('sm_fee_settings')->pluck('svalue', 'skey')->all();
    }

    /** Giải mã dữ liệu nhạy cảm (SĐT, địa chỉ). Sai APP_KEY thì trả null thay vì báo lỗi. */
    public static function decrypt(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! str_starts_with($value, 'eyJ')) {
            return $value; // không mã hóa
        }
        if (! filter_var(env('ACCOUNTANT_DECRYPT_PII', true), FILTER_VALIDATE_BOOLEAN)) {
            return null;
        }
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable $e) {
            return null;
        }
    }

    // ------------------------------------------------------------------
    // SQL tổng hợp theo từng học sinh trong 1 năm học (dùng cho danh sách + KPI)
    // ------------------------------------------------------------------
    public static function summarySql(int $y): string
    {
        $today = self::today();
        $out = "GREATEST(CAST(v.total AS SIGNED) - CAST(COALESCE(pp.paid,0) AS SIGNED), 0)";

        return "
SELECT s.id, s.code, s.full_name, s.gender, s.birth_date,
       c.id AS class_id, c.name AS class_name, c.grade,
       COALESCE(i.invoice_count,0)   AS invoice_count,
       COALESCE(i.total_amount,0)    AS total_amount,
       COALESCE(i.discount_amount,0) AS discount_amount,
       COALESCE(i.paid_amount,0)     AS paid_amount,
       COALESCE(i.debt_amount,0)     AS debt_amount,
       COALESCE(i.overdue_amount,0)  AS overdue_amount,
       COALESCE(i.open_invoices,0)   AS open_invoices,
       i.next_due, COALESCE(i.max_overdue_days,0) AS max_overdue_days,
       COALESCE(pe.pending_count,0)  AS pending_count,
       COALESCE(w.waiver_count,0)    AS waiver_count,
       COALESCE(w.waiver_percent,0)  AS waiver_percent,
       COALESCE(dn.open_promises,0)  AS open_promises,
       CASE WHEN COALESCE(i.invoice_count,0) = 0 THEN 'none'
            WHEN COALESCE(i.overdue_amount,0) > 0 THEN 'overdue'
            WHEN COALESCE(i.debt_amount,0) > 0 THEN 'debt'
            ELSE 'paid' END AS fin_status
FROM sm_students s
JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = {$y}
JOIN sm_classes c ON c.id = e.class_id
LEFT JOIN (
    SELECT v.student_id,
           COUNT(*) AS invoice_count,
           SUM(v.total) AS total_amount,
           SUM(v.discount) AS discount_amount,
           SUM(COALESCE(pp.paid,0)) AS paid_amount,
           SUM({$out}) AS debt_amount,
           SUM(CASE WHEN v.due_date < '{$today}' THEN {$out} ELSE 0 END) AS overdue_amount,
           SUM(CASE WHEN v.total > COALESCE(pp.paid,0) THEN 1 ELSE 0 END) AS open_invoices,
           MIN(CASE WHEN v.total > COALESCE(pp.paid,0) THEN v.due_date END) AS next_due,
           MAX(CASE WHEN v.due_date < '{$today}' AND v.total > COALESCE(pp.paid,0)
                    THEN DATEDIFF('{$today}', v.due_date) END) AS max_overdue_days
    FROM sm_invoices v
    LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM sm_payments
               WHERE status = 'confirmed' GROUP BY invoice_id) pp ON pp.invoice_id = v.id
    WHERE v.school_year_id = {$y} AND v.status = 'issued'
    GROUP BY v.student_id
) i ON i.student_id = s.id
LEFT JOIN (SELECT student_id, COUNT(*) AS pending_count FROM sm_payments
           WHERE status = 'pending' GROUP BY student_id) pe ON pe.student_id = s.id
LEFT JOIN (SELECT student_id, COUNT(*) AS waiver_count, MAX(percent) AS waiver_percent
           FROM sm_fee_waivers WHERE school_year_id = {$y} GROUP BY student_id) w ON w.student_id = s.id
LEFT JOIN (SELECT student_id, COUNT(*) AS open_promises FROM sm_debt_notes
           WHERE kind = 'promise' AND status = 'open' GROUP BY student_id) dn ON dn.student_id = s.id";
    }

    // ------------------------------------------------------------------
    // Hóa đơn của 1 học sinh (kèm đã thu / còn nợ / trạng thái)
    // ------------------------------------------------------------------
    public static function invoiceRows(int $studentId, ?int $yearId = null): array
    {
        $q = DB::table('sm_invoices as v')
            ->join('sm_school_years as y', 'y.id', '=', 'v.school_year_id')
            ->leftJoinSub(
                DB::table('sm_payments')->selectRaw('invoice_id, SUM(amount) AS paid')
                    ->where('status', 'confirmed')->groupBy('invoice_id'),
                'pp', 'pp.invoice_id', '=', 'v.id'
            )
            ->leftJoinSub(
                DB::table('sm_payments')->selectRaw('invoice_id, SUM(amount) AS pending, COUNT(*) AS pending_count')
                    ->where('status', 'pending')->groupBy('invoice_id'),
                'pe', 'pe.invoice_id', '=', 'v.id'
            )
            ->leftJoinSub(
                DB::table('sm_invoice_disputes')->selectRaw('invoice_id, COUNT(*) AS open_disputes')
                    ->where('status', 'open')->groupBy('invoice_id'),
                'dp', 'dp.invoice_id', '=', 'v.id'
            )
            ->where('v.student_id', $studentId)
            ->when($yearId, fn ($q) => $q->where('v.school_year_id', $yearId))
            ->orderByDesc('v.issue_date')->orderByDesc('v.id')
            ->selectRaw('v.*, y.label AS year_label, COALESCE(pp.paid,0) AS paid, COALESCE(pe.pending,0) AS pending,
                         COALESCE(pe.pending_count,0) AS pending_count, COALESCE(dp.open_disputes,0) AS open_disputes');

        return $q->get()->map(fn ($r) => self::decorateInvoice($r))->all();
    }

    public static function decorateInvoice(object $r): array
    {
        $total = (int) $r->total;
        $paid = self::money($r->paid);
        $pending = self::money($r->pending ?? 0);
        $outstanding = max($total - $paid, 0);
        $today = self::today();
        $overdueDays = ($r->status === 'issued' && $outstanding > 0 && $r->due_date < $today)
            ? (int) floor((strtotime($today) - strtotime($r->due_date)) / 86400) : 0;

        if ($r->status === 'cancelled') {
            $state = 'cancelled';
        } elseif ($outstanding === 0) {
            $state = 'paid';
        } elseif ($overdueDays > 0) {
            $state = 'overdue';
        } elseif ($paid > 0) {
            $state = 'partial';
        } else {
            $state = 'unpaid';
        }

        return [
            'id' => (int) $r->id,
            'code' => $r->code,
            'student_id' => (int) $r->student_id,
            'school_year_id' => (int) $r->school_year_id,
            'year_label' => $r->year_label ?? null,
            'term' => $r->term,
            'title' => $r->title,
            'issue_date' => $r->issue_date,
            'due_date' => $r->due_date,
            'subtotal' => (int) $r->subtotal,
            'discount' => (int) $r->discount,
            'total' => $total,
            'paid' => $paid,
            'pending' => $pending,
            'outstanding' => $r->status === 'cancelled' ? 0 : $outstanding,
            'payable' => $r->status === 'cancelled' ? 0 : max($outstanding - $pending, 0),
            'overdue_days' => $overdueDays,
            'state' => $state,
            'status' => $r->status,
            'note' => $r->note,
            'open_disputes' => (int) ($r->open_disputes ?? 0),
            'pending_count' => (int) ($r->pending_count ?? 0),
        ];
    }

    /** Gộp danh sách hóa đơn đã decorate thành số liệu tổng. */
    public static function summarize(array $invoices): array
    {
        $s = ['invoice_count' => 0, 'total' => 0, 'discount' => 0, 'paid' => 0, 'debt' => 0, 'overdue' => 0,
              'open_invoices' => 0, 'next_due' => null, 'max_overdue_days' => 0];
        foreach ($invoices as $i) {
            if ($i['status'] !== 'issued') {
                continue;
            }
            $s['invoice_count']++;
            $s['total'] += $i['total'];
            $s['discount'] += $i['discount'];
            $s['paid'] += $i['paid'];
            $s['debt'] += $i['outstanding'];
            if ($i['outstanding'] > 0) {
                $s['open_invoices']++;
                if ($s['next_due'] === null || $i['due_date'] < $s['next_due']) {
                    $s['next_due'] = $i['due_date'];
                }
                if ($i['overdue_days'] > 0) {
                    $s['overdue'] += $i['outstanding'];
                    $s['max_overdue_days'] = max($s['max_overdue_days'], $i['overdue_days']);
                }
            }
        }
        $s['rate'] = $s['total'] > 0 ? round(min($s['paid'] / $s['total'], 1) * 100, 1) : 0;
        $s['fin_status'] = $s['invoice_count'] === 0 ? 'none'
            : ($s['overdue'] > 0 ? 'overdue' : ($s['debt'] > 0 ? 'debt' : 'paid'));
        return $s;
    }

    public static function findStudent(int $id): object
    {
        $s = DB::table('sm_students')->where('id', $id)->first();
        if (! $s) {
            abort(response()->json(['success' => false, 'message' => 'Không tìm thấy học sinh.'], 404));
        }
        return $s;
    }

    /** Lớp của học sinh trong 1 năm học. */
    public static function classOf(int $studentId, int $yearId): ?object
    {
        return DB::table('sm_enrollments as e')->join('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->where('e.student_id', $studentId)->where('e.school_year_id', $yearId)
            ->select('c.id', 'c.name', 'c.grade')->first();
    }

    /** Nạp biến cho mẫu nhắc nợ. */
    public static function reminderContext(int $studentId, ?int $promiseId = null): array
    {
        $st = self::findStudent($studentId);
        $set = self::settings();
        $yearId = self::currentYearId();
        $class = self::classOf($studentId, $yearId);
        $invoices = array_values(array_filter(
            self::invoiceRows($studentId),
            fn ($i) => $i['status'] === 'issued' && $i['outstanding'] > 0
        ));
        $sum = self::summarize($invoices);
        $promise = DB::table('sm_debt_notes')->where('student_id', $studentId)->where('kind', 'promise')
            ->where('status', 'open')->orderBy('promise_date')->first();

        $pay = 'Chuyển khoản: ' . ($set['bank_name'] ?? '') . ', STK ' . ($set['account_no'] ?? '')
            . ' (' . ($set['account_name'] ?? '') . '). ' . ($set['transfer_hint'] ?? '');

        return [
            'ten_hs' => $st->full_name,
            'ma_hs' => $st->code,
            'lop' => $class->name ?? '-',
            'ten_truong' => $set['school_name'] ?? 'Nhà trường',
            'so_hoa_don' => (string) count($invoices),
            'so_tien_no' => self::vnd($sum['debt']),
            'han_nop' => $sum['next_due'] ? date('d/m/Y', strtotime($sum['next_due'])) : '-',
            'so_ngay_qua_han' => (string) $sum['max_overdue_days'],
            'tien_qua_han' => self::vnd($sum['overdue']),
            'thong_tin_thanh_toan' => trim($pay),
            'tien_hen' => $promise && $promise->promise_amount ? self::vnd($promise->promise_amount) : '-',
            'ngay_hen' => $promise && $promise->promise_date ? date('d/m/Y', strtotime($promise->promise_date)) : '-',
            'lien_he' => ($set['reminder_contact'] ?? 'Phòng Kế toán') . ' - ĐT ' . ($set['hotline'] ?? ''),
            '_debt' => $sum['debt'],
            '_overdue_days' => $sum['max_overdue_days'],
        ];
    }

    public static function render(string $tpl, array $ctx): string
    {
        foreach ($ctx as $k => $v) {
            if ($k[0] !== '_') {
                $tpl = str_replace('{' . $k . '}', (string) $v, $tpl);
            }
        }
        return $tpl;
    }

    public static function logPayment(int $paymentId, string $action, ?string $detail, string $actor): void
    {
        DB::table('sm_payment_log')->insert([
            'payment_id' => $paymentId,
            'action' => $action,
            'detail' => $detail ? mb_substr($detail, 0, 500) : null,
            'actor' => $actor,
            'created_at' => now()->format('Y-m-d H:i:s'),
        ]);
    }
}
