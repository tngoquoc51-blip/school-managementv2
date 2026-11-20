<?php

namespace Modules\Accountant\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Accountant\Services\FinanceService as F;

class PaymentController extends BaseController
{
    public function index(Request $request, int $id)
    {
        F::findStudent($id);
        $q = DB::table('sm_payments as p')->join('sm_invoices as v', 'v.id', '=', 'p.invoice_id')
            ->where('p.student_id', $id)
            ->when($request->query('year_id') && $request->query('year_id') !== 'all',
                fn ($q) => $q->where('v.school_year_id', (int) $request->query('year_id')))
            ->when($request->query('status'), fn ($q, $s) => $q->where('p.status', $s))
            ->orderByDesc('p.paid_at')->orderByDesc('p.id')
            ->select('p.*', 'v.code as invoice_code', 'v.title as invoice_title');

        $rows = $q->get();
        $confirmed = $rows->where('status', 'confirmed')->sum('amount');
        return $this->ok([
            'items' => $rows->map(fn ($r) => [
                'id' => (int) $r->id, 'receipt_code' => $r->receipt_code, 'invoice_id' => (int) $r->invoice_id,
                'invoice_code' => $r->invoice_code, 'invoice_title' => $r->invoice_title, 'amount' => (int) $r->amount,
                'method' => $r->method, 'reference' => $r->reference, 'payer_note' => $r->payer_note, 'status' => $r->status,
                'paid_at' => $r->paid_at, 'confirmed_by' => $r->confirmed_by, 'confirmed_at' => $r->confirmed_at,
                'reject_reason' => $r->reject_reason,
            ])->values(),
            'total_confirmed' => (int) $confirmed,
            'count' => $rows->count(),
        ]);
    }

    /** Thu tiền trực tiếp tại quầy: phiếu được xác nhận ngay. */
    public function collect(Request $request, int $id)
    {
        F::findStudent($id);
        $data = $this->validated($request, [
            'invoice_id' => 'required|integer',
            'amount' => 'required|integer|min:1000|max:2000000000',
            'method' => 'required|in:cash,bank_transfer,card,ewallet',
            'reference' => 'nullable|string|max:60|required_unless:method,cash',
            'payer_note' => 'nullable|string|max:255',
            'paid_at' => 'nullable|date',
        ], [
            'amount.min' => 'Số tiền tối thiểu là 1.000đ.',
            'reference.required_unless' => 'Vui lòng nhập mã giao dịch / số tham chiếu cho hình thức không phải tiền mặt.',
        ]);
        $actor = $this->actor($request);

        $payment = DB::transaction(function () use ($id, $data, $actor) {
            $inv = DB::table('sm_invoices')->where('id', $data['invoice_id'])->lockForUpdate()->first();
            if (! $inv || (int) $inv->student_id !== $id) {
                $this->stop('Hóa đơn không thuộc học sinh này.');
            }
            if ($inv->status !== 'issued') {
                $this->stop('Hóa đơn đã bị hủy, không thể thu tiền.');
            }
            if (! empty($data['reference'])) {
                $dup = DB::table('sm_payments')->where('reference', $data['reference'])
                    ->whereIn('status', ['confirmed', 'pending'])->exists();
                if ($dup) {
                    $this->stop('Mã giao dịch "' . $data['reference'] . '" đã được ghi nhận trước đó.');
                }
            }
            $paid = (int) DB::table('sm_payments')->where('invoice_id', $inv->id)->where('status', 'confirmed')->sum('amount');
            $pending = (int) DB::table('sm_payments')->where('invoice_id', $inv->id)->where('status', 'pending')->sum('amount');
            $remain = (int) $inv->total - $paid - $pending;
            if ($remain <= 0) {
                $this->stop('Hóa đơn này đã được thanh toán đủ (hoặc đang chờ xác nhận đủ số tiền).');
            }
            if ($data['amount'] > $remain) {
                $this->stop('Số tiền vượt quá số còn phải thu (' . F::vnd($remain) . ').');
            }

            $now = now();
            $paidAt = ! empty($data['paid_at']) ? Carbon::parse($data['paid_at']) : $now;
            if ($paidAt->isFuture()) {
                $paidAt = $now;
            }
            $pid = DB::table('sm_payments')->insertGetId([
                'receipt_code' => 'TMP' . strtoupper(Str::random(12)),
                'invoice_id' => $inv->id,
                'student_id' => $id,
                'amount' => $data['amount'],
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'payer_note' => $data['payer_note'] ?? null,
                'status' => 'confirmed',
                'paid_at' => $paidAt->format('Y-m-d H:i:s'),
                'created_at' => $now->format('Y-m-d H:i:s'),
                'confirmed_by' => $actor,
                'confirmed_at' => $now->format('Y-m-d H:i:s'),
            ]);
            $code = 'PT' . $paidAt->format('y') . str_pad((string) $pid, 6, '0', STR_PAD_LEFT);
            DB::table('sm_payments')->where('id', $pid)->update(['receipt_code' => $code]);
            F::logPayment($pid, 'collect', 'Thu ' . F::vnd($data['amount']) . ' (' . $data['method'] . ') cho hóa đơn ' . $inv->code, $actor);

            return ['id' => $pid, 'receipt_code' => $code, 'invoice_code' => $inv->code];
        });

        return $this->ok($payment, 'Đã thu tiền, phiếu ' . $payment['receipt_code'], 201);
    }

    public function confirm(Request $request, int $id)
    {
        $actor = $this->actor($request);
        DB::transaction(function () use ($id, $actor) {
            $p = DB::table('sm_payments')->where('id', $id)->lockForUpdate()->first();
            if (! $p) {
                $this->stop('Không tìm thấy phiếu thu.', 404);
            }
            if ($p->status !== 'pending') {
                $this->stop('Chỉ xác nhận được phiếu đang chờ.');
            }
            $inv = DB::table('sm_invoices')->where('id', $p->invoice_id)->lockForUpdate()->first();
            $paid = (int) DB::table('sm_payments')->where('invoice_id', $p->invoice_id)->where('status', 'confirmed')->sum('amount');
            if ($inv->status !== 'issued' || $paid + (int) $p->amount > (int) $inv->total) {
                $this->stop('Xác nhận phiếu này sẽ làm số đã thu vượt tổng hóa đơn (hoặc hóa đơn đã hủy).');
            }
            DB::table('sm_payments')->where('id', $id)->update([
                'status' => 'confirmed', 'confirmed_by' => $actor, 'confirmed_at' => now()->format('Y-m-d H:i:s'),
            ]);
            F::logPayment($id, 'confirm', 'Xác nhận phiếu thu', $actor);
        });
        return $this->ok(null, 'Đã xác nhận phiếu thu');
    }

    public function reject(Request $request, int $id)
    {
        $data = $this->validated($request, ['reason' => 'required|string|min:3|max:255'], ['reason.required' => 'Vui lòng nhập lý do từ chối.']);
        $actor = $this->actor($request);
        DB::transaction(function () use ($id, $data, $actor) {
            $p = DB::table('sm_payments')->where('id', $id)->lockForUpdate()->first();
            if (! $p) {
                $this->stop('Không tìm thấy phiếu thu.', 404);
            }
            if ($p->status !== 'pending') {
                $this->stop('Chỉ từ chối được phiếu đang chờ.');
            }
            DB::table('sm_payments')->where('id', $id)->update(['status' => 'rejected', 'reject_reason' => $data['reason']]);
            F::logPayment($id, 'reject', $data['reason'], $actor);
        });
        return $this->ok(null, 'Đã từ chối phiếu thu');
    }

    public function void(Request $request, int $id)
    {
        $data = $this->validated($request, ['reason' => 'required|string|min:3|max:255'], ['reason.required' => 'Vui lòng nhập lý do hủy phiếu.']);
        $actor = $this->actor($request);
        DB::transaction(function () use ($id, $data, $actor) {
            $p = DB::table('sm_payments')->where('id', $id)->lockForUpdate()->first();
            if (! $p) {
                $this->stop('Không tìm thấy phiếu thu.', 404);
            }
            if ($p->status !== 'confirmed') {
                $this->stop('Chỉ hủy được phiếu đã xác nhận.');
            }
            DB::table('sm_payments')->where('id', $id)->update(['status' => 'cancelled', 'reject_reason' => $data['reason']]);
            F::logPayment($id, 'void', $data['reason'], $actor);
        });
        return $this->ok(null, 'Đã hủy phiếu thu, công nợ được tính lại');
    }

    /** Dữ liệu in biên lai. */
    public function receipt(int $id)
    {
        $p = DB::table('sm_payments')->where('id', $id)->first();
        if (! $p) {
            return $this->fail('Không tìm thấy phiếu thu.', 404);
        }
        $inv = DB::table('sm_invoices')->where('id', $p->invoice_id)->first();
        $st = DB::table('sm_students')->where('id', $p->student_id)->first(['id', 'code', 'full_name']);
        $class = F::classOf((int) $p->student_id, (int) $inv->school_year_id);
        $row = collect(F::invoiceRows((int) $p->student_id))->firstWhere('id', (int) $inv->id);
        $set = F::settings();

        return $this->ok([
            'payment' => $p, 'invoice' => $row, 'student' => $st, 'class_name' => $class->name ?? null,
            'school' => ['name' => $set['school_name'] ?? '', 'address' => $set['school_address'] ?? '', 'hotline' => $set['hotline'] ?? '',
                'footer' => $set['receipt_footer'] ?? '', 'accountant' => $set['receipt_accountant'] ?? 'Kế toán thu',
                'treasurer' => $set['receipt_treasurer'] ?? 'Thủ quỹ'],
        ]);
    }
}
