<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\FeeCashierRepo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Quầy thu học phí cho Kế toán (prefix /api/kt/cashier, cần token nhân viên – middleware FeeStaffToken).
 *   GET meta · overview · students · students/{id} · pending · payments · payments/{id} · payments/{id}/log · daily · disputes
 *   POST collect · payments/{id}/confirm · payments/{id}/reject · payments/{id}/void · payments/bulk-confirm · disputes/{id}/reply
 */
class FeeCashierController extends Controller
{
    private function repo(): FeeCashierRepo
    {
        return new FeeCashierRepo(DB::connection()->getPdo());
    }

    /** @return array<string,mixed> */
    private function staff(Request $r): array
    {
        return $r->attributes->get('kt_staff');
    }

    private function out(array $x)
    {
        if (!$x['ok']) {
            return response()->json(array_filter(['message' => $x['message'], 'errors' => $x['errors'] ?? null]), $x['status']);
        }
        return response()->json(['message' => $x['message'] ?? 'OK', 'data' => array_diff_key($x, ['ok' => 1, 'status' => 1, 'message' => 1])]);
    }

    public function meta()
    {
        return response()->json(['data' => $this->repo()->meta()]);
    }

    public function overview()
    {
        return response()->json(['data' => $this->repo()->overview()]);
    }

    public function students(Request $r)
    {
        return response()->json(['data' => $this->repo()->students($r->query())]);
    }

    public function student(int $id)
    {
        $d = $this->repo()->student($id);
        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy học sinh.'], 404);
    }

    public function collect(Request $r)
    {
        return $this->out($this->repo()->collect($this->staff($r), $r->all()));
    }

    public function pending(Request $r)
    {
        return response()->json(['data' => $this->repo()->pending($r->query())]);
    }

    public function confirm(Request $r, int $id)
    {
        return $this->out($this->repo()->confirm($this->staff($r), $id));
    }

    public function reject(Request $r, int $id)
    {
        return $this->out($this->repo()->reject($this->staff($r), $id, (string) $r->input('reason', '')));
    }

    public function bulkConfirm(Request $r)
    {
        $ids = $r->input('ids', []);
        return $this->out($this->repo()->bulkConfirm($this->staff($r), is_array($ids) ? $ids : []));
    }

    public function payments(Request $r)
    {
        return response()->json(['data' => $this->repo()->payments($r->query(), $this->staff($r))]);
    }

    public function receipt(int $id)
    {
        $d = $this->repo()->receipt($id);
        return $d ? response()->json(['data' => $d + ['log' => $this->repo()->paymentLog($id)]]) : response()->json(['message' => 'Không tìm thấy phiếu thu.'], 404);
    }

    public function void(Request $r, int $id)
    {
        return $this->out($this->repo()->void($this->staff($r), $id, (string) $r->input('reason', '')));
    }

    public function daily(Request $r)
    {
        return response()->json(['data' => $this->repo()->daily($r->query('date'), $this->staff($r))]);
    }

    public function disputes(Request $r)
    {
        return response()->json(['data' => $this->repo()->disputes($r->query())]);
    }

    public function replyDispute(Request $r, int $id)
    {
        return $this->out($this->repo()->replyDispute($this->staff($r), $id, (string) $r->input('reply', '')));
    }
}
