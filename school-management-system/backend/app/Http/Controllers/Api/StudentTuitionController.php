<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\FeeRepo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Học phí của học sinh (cần đăng nhập, prefix /api/hs/fees)
 *   GET  fees/summary · GET fees/invoices · GET fees/invoices/{id} · GET fees/payments · GET fees/receipts/{id} · GET fees/catalog
 *   POST fees/invoices/{id}/declare · POST fees/invoices/{id}/dispute · POST fees/payments/{id}/cancel
 */
class StudentTuitionController extends Controller
{
    private function repo(): FeeRepo
    {
        return new FeeRepo(DB::connection()->getPdo());
    }

    private function sid(Request $r): int
    {
        return (int) $r->attributes->get('sm_account')['student_id'];
    }

    private function out(array $r)
    {
        return $r['ok'] ? response()->json(['message' => $r['message'], 'data' => ['payment_id' => $r['payment_id'] ?? null]]) : response()->json(['message' => $r['message']], $r['status']);
    }

    public function summary(Request $r)
    {
        return response()->json(['data' => $this->repo()->summary($this->sid($r))]);
    }

    public function invoices(Request $r)
    {
        return response()->json(['data' => $this->repo()->invoices($this->sid($r), $r->query())]);
    }

    public function invoice(Request $r, int $id)
    {
        $d = $this->repo()->invoice($this->sid($r), $id);
        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy hóa đơn.'], 404);
    }

    public function payments(Request $r)
    {
        return response()->json(['data' => $this->repo()->payments($this->sid($r), $r->query())]);
    }

    public function receipt(Request $r, int $id)
    {
        $d = $this->repo()->receipt($this->sid($r), $id);
        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy biên lai.'], 404);
    }

    public function catalog(Request $r)
    {
        return response()->json(['data' => $this->repo()->catalog($this->sid($r))]);
    }

    public function declare(Request $r, int $id)
    {
        return $this->out($this->repo()->declare($this->sid($r), $id, (int) $r->input('amount', 0), (string) $r->input('method', ''), $r->input('reference'), $r->input('paid_at'), $r->input('note')));
    }

    public function dispute(Request $r, int $id)
    {
        return $this->out($this->repo()->dispute($this->sid($r), $id, (string) $r->input('message', '')));
    }

    public function cancelPayment(Request $r, int $id)
    {
        return $this->out($this->repo()->cancelPending($this->sid($r), $id));
    }
}
