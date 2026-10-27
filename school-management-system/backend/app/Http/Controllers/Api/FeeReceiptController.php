<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\FeeReceiptRepo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Sổ phiếu thu / biên lai cho Kế toán (prefix /api/kt/receipts, cần token nhân viên – middleware FeeStaffToken).
 *   GET  receipts/meta · receipts · receipts/stats
 *   POST receipts/print · receipts/reconcile · receipts/unreconcile
 * Xem chi tiết phiếu và hủy phiếu: GET /api/kt/cashier/payments/{id}, POST /api/kt/cashier/payments/{id}/void
 */
class FeeReceiptController extends Controller
{
    private function repo(): FeeReceiptRepo
    {
        return new FeeReceiptRepo(DB::connection()->getPdo());
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

    /** @return array<int,mixed> */
    private function ids(Request $r): array
    {
        $ids = $r->input('ids', []);
        return is_array($ids) ? $ids : [];
    }

    public function meta()
    {
        return response()->json(['data' => $this->repo()->meta()]);
    }

    public function index(Request $r)
    {
        return response()->json(['data' => $this->repo()->index($r->query(), $this->staff($r))]);
    }

    public function stats(Request $r)
    {
        return response()->json(['data' => $this->repo()->stats($r->query())]);
    }

    public function print(Request $r)
    {
        return $this->out($this->repo()->markPrinted($this->staff($r), $this->ids($r)));
    }

    public function reconcile(Request $r)
    {
        return $this->out($this->repo()->reconcile($this->staff($r), $this->ids($r), (string) $r->input('note', '')));
    }

    public function unreconcile(Request $r)
    {
        return $this->out($this->repo()->unreconcile($this->staff($r), $this->ids($r)));
    }
}
