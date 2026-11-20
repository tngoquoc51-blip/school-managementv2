<?php

namespace Modules\Accountant\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Accountant\Services\FinanceService as F;

class DebtNoteController extends BaseController
{
    public function index(int $id)
    {
        F::findStudent($id);
        $today = F::today();
        $rows = DB::table('sm_debt_notes')->where('student_id', $id)->orderByDesc('id')->get()->map(function ($r) use ($today) {
            return [
                'id' => (int) $r->id, 'kind' => $r->kind, 'channel' => $r->channel, 'note' => $r->note,
                'promise_date' => $r->promise_date, 'promise_amount' => $r->promise_amount !== null ? (int) $r->promise_amount : null,
                'status' => $r->status, 'created_by' => $r->created_by, 'created_at' => $r->created_at,
                'resolved_by' => $r->resolved_by, 'resolved_at' => $r->resolved_at,
                'is_late' => $r->kind === 'promise' && $r->status === 'open' && $r->promise_date < $today,
            ];
        });
        return $this->ok($rows);
    }

    public function store(Request $request, int $id)
    {
        F::findStudent($id);
        $d = $this->validated($request, [
            'kind' => 'required|in:note,contact,promise',
            'channel' => 'nullable|in:phone,zalo,sms,direct,email,other',
            'note' => 'required|string|min:3|max:500',
            'promise_date' => 'nullable|date|required_if:kind,promise|after_or_equal:today',
            'promise_amount' => 'nullable|integer|min:1000|required_if:kind,promise',
        ], [
            'note.required' => 'Vui lòng nhập nội dung ghi chú.',
            'promise_date.required_if' => 'Vui lòng chọn ngày hẹn trả.',
            'promise_date.after_or_equal' => 'Ngày hẹn không được ở quá khứ.',
            'promise_amount.required_if' => 'Vui lòng nhập số tiền hẹn trả.',
        ]);
        $isPromise = $d['kind'] === 'promise';
        $nid = DB::table('sm_debt_notes')->insertGetId([
            'student_id' => $id, 'kind' => $d['kind'], 'channel' => $d['channel'] ?? null, 'note' => $d['note'],
            'promise_date' => $isPromise ? $d['promise_date'] : null,
            'promise_amount' => $isPromise ? $d['promise_amount'] : null,
            'status' => $isPromise ? 'open' : 'done',
            'created_by' => $this->actor($request), 'created_at' => now()->format('Y-m-d H:i:s'),
        ]);
        return $this->ok(['id' => $nid], $isPromise ? 'Đã ghi nhận lịch hẹn trả' : 'Đã lưu ghi chú', 201);
    }

    public function resolve(Request $request, int $id)
    {
        $d = $this->validated($request, ['status' => 'required|in:kept,broken,cancelled']);
        $n = DB::table('sm_debt_notes')->where('id', $id)->first();
        if (! $n || $n->kind !== 'promise') {
            return $this->fail('Không tìm thấy lịch hẹn.', 404);
        }
        if ($n->status !== 'open') {
            return $this->fail('Lịch hẹn này đã được xử lý.');
        }
        DB::table('sm_debt_notes')->where('id', $id)->update([
            'status' => $d['status'], 'resolved_by' => $this->actor($request), 'resolved_at' => now()->format('Y-m-d H:i:s'),
        ]);
        return $this->ok(null, 'Đã cập nhật lịch hẹn');
    }
}
