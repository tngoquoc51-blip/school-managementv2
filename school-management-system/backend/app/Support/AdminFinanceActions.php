<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/** Các thao tác ghi của Admin trên Học phí – Tài chính (luôn ghi nhật ký). */
class AdminFinanceActions
{
    public function confirmPayment(int $id, string $actor): void
    {
        DB::transaction(function () use ($id, $actor) {
            $p = DB::table('sm_payments')->where('id', $id)->lockForUpdate()->first();
            abort_unless($p, 404, 'Không tìm thấy phiếu thu.');
            abort_unless($p->status === 'pending', 422, 'Chỉ xác nhận được phiếu đang chờ xác nhận.');
            DB::table('sm_payments')->where('id', $id)->update(['status' => 'confirmed', 'confirmed_by' => $actor, 'confirmed_at' => now(), 'reject_reason' => null]);
            DB::table('sm_payment_log')->insert(['payment_id' => $id, 'action' => 'confirm', 'detail' => "Admin xác nhận phiếu {$p->receipt_code} ({$p->amount}đ)", 'actor' => $actor, 'created_at' => now()]);
        });
    }

    public function rejectPayment(int $id, string $reason, string $actor): void
    {
        DB::transaction(function () use ($id, $reason, $actor) {
            $p = DB::table('sm_payments')->where('id', $id)->lockForUpdate()->first();
            abort_unless($p, 404, 'Không tìm thấy phiếu thu.');
            abort_unless($p->status === 'pending', 422, 'Chỉ từ chối được phiếu đang chờ xác nhận.');
            DB::table('sm_payments')->where('id', $id)->update(['status' => 'rejected', 'confirmed_by' => $actor, 'confirmed_at' => now(), 'reject_reason' => mb_substr($reason, 0, 255)]);
            DB::table('sm_payment_log')->insert(['payment_id' => $id, 'action' => 'reject', 'detail' => mb_substr("Admin từ chối phiếu {$p->receipt_code}: {$reason}", 0, 500), 'actor' => $actor, 'created_at' => now()]);
        });
    }

    public function notes(int $studentId): array
    {
        return DB::table('sm_debt_notes')->where('student_id', $studentId)->orderByDesc('id')->limit(100)->get()->all();
    }

    public function addNote(int $studentId, array $d, string $actor): object
    {
        abort_unless(DB::table('sm_students')->where('id', $studentId)->exists(), 404, 'Không tìm thấy học sinh.');
        $isPromise = $d['kind'] === 'promise';
        abort_if($isPromise && empty($d['promise_date']), 422, 'Hẹn trả cần có ngày hẹn.');
        $id = DB::table('sm_debt_notes')->insertGetId([
            'student_id' => $studentId, 'kind' => $d['kind'], 'channel' => $d['channel'] ?? null, 'note' => $d['note'],
            'promise_date' => $isPromise ? $d['promise_date'] : null, 'promise_amount' => $isPromise ? ($d['promise_amount'] ?? null) : null,
            'status' => $isPromise ? 'open' : 'done', 'created_by' => $actor, 'created_at' => now(),
        ]);

        return DB::table('sm_debt_notes')->find($id);
    }

    public function resolveNote(int $id, string $status, string $actor): void
    {
        $n = DB::table('sm_debt_notes')->where('id', $id)->first();
        abort_unless($n, 404, 'Không tìm thấy ghi chú.');
        abort_unless($n->kind === 'promise' && $n->status === 'open', 422, 'Chỉ cập nhật được lịch hẹn đang mở.');
        DB::table('sm_debt_notes')->where('id', $id)->update(['status' => $status, 'resolved_by' => $actor, 'resolved_at' => now()]);
    }

    public function setPeriodStatus(int $id, string $to, string $actor): void
    {
        DB::transaction(function () use ($id, $to, $actor) {
            $p = DB::table('sm_fee_periods')->where('id', $id)->lockForUpdate()->first();
            abort_unless($p, 404, 'Không tìm thấy đợt thu.');
            abort_unless(in_array($p->status, ['open', 'closed'], true) && $p->status !== $to, 422, 'Chỉ chuyển qua lại giữa "đang thu" và "đã đóng".');
            $close = $to === 'closed';
            DB::table('sm_fee_periods')->where('id', $id)->update([
                'status' => $to, 'closed_at' => $close ? now() : null, 'closed_by' => $close ? $actor : null,
            ]);
            DB::table('sm_fee_period_log')->insert([
                'period_id' => $id, 'action' => $close ? 'close' : 'reopen', 'detail' => ($close ? 'Admin đóng đợt ' : 'Admin mở lại đợt ') . $p->code, 'actor' => $actor, 'created_at' => now(),
            ]);
        });
    }

    public function replyDispute(int $id, string $text, string $actor): void
    {
        $d = DB::table('sm_invoice_disputes')->where('id', $id)->first();
        abort_unless($d, 404, 'Không tìm thấy khiếu nại.');
        DB::table('sm_invoice_disputes')->where('id', $id)->update(['reply' => $text, 'status' => 'answered', 'replied_by' => $actor, 'replied_at' => now()]);
    }
}
