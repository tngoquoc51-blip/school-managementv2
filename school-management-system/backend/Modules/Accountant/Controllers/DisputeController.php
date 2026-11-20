<?php

namespace Modules\Accountant\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Accountant\Services\FinanceService as F;

class DisputeController extends BaseController
{
    public function index(int $id)
    {
        F::findStudent($id);
        return $this->ok(
            DB::table('sm_invoice_disputes as d')->join('sm_invoices as v', 'v.id', '=', 'd.invoice_id')
                ->where('d.student_id', $id)->orderByRaw("d.status = 'open' DESC")->orderByDesc('d.id')
                ->get(['d.id', 'd.invoice_id', 'v.code as invoice_code', 'v.title as invoice_title', 'd.message', 'd.status',
                    'd.reply', 'd.replied_by', 'd.created_at', 'd.replied_at'])
        );
    }

    public function reply(Request $request, int $id)
    {
        $d = $this->validated($request, ['reply' => 'required|string|min:3|max:1000'], ['reply.required' => 'Vui lòng nhập nội dung trả lời.']);
        $row = DB::table('sm_invoice_disputes')->where('id', $id)->first();
        if (! $row) {
            return $this->fail('Không tìm thấy khiếu nại.', 404);
        }
        DB::table('sm_invoice_disputes')->where('id', $id)->update([
            'status' => 'answered', 'reply' => $d['reply'], 'replied_by' => $this->actor($request),
            'replied_at' => now()->format('Y-m-d H:i:s'),
        ]);
        return $this->ok(null, 'Đã trả lời khiếu nại');
    }
}
