<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\FeePeriodRepo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Đợt thu / Kỳ thu học phí cho Kế toán (prefix /api/kt).
 *   POST login · POST logout · GET me · GET meta
 *   GET periods · POST periods · GET periods/{id} · PUT periods/{id} · GET periods/{id}/edit
 *   POST periods/preview · POST periods/{id}/preview · GET periods/{id}/invoices · GET periods/{id}/debtors
 *   POST periods/{id}/issue · /extend · /close · /reopen · /cancel
 */
class FeePeriodController extends Controller
{
    private function repo(): FeePeriodRepo
    {
        return new FeePeriodRepo(DB::connection()->getPdo());
    }

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

    public function login(Request $r)
    {
        $x = $this->repo()->login((string) $r->input('username', ''), (string) $r->input('password', ''));
        return $x['ok'] ? response()->json(['data' => ['token' => $x['token'], 'expires_at' => $x['expires_at'], 'staff' => $x['staff']]]) : response()->json(['message' => $x['message']], $x['status']);
    }

    public function logout(Request $r)
    {
        $this->repo()->logout((string) $r->attributes->get('kt_token'));
        return response()->json(['message' => 'Đã đăng xuất.']);
    }

    public function me(Request $r)
    {
        return response()->json(['data' => $this->staff($r)]);
    }

    public function meta()
    {
        return response()->json(['data' => $this->repo()->meta()]);
    }

    public function index(Request $r)
    {
        return response()->json(['data' => $this->repo()->index($r->query())]);
    }

    public function show(Request $r, int $id)
    {
        $d = $this->repo()->show($id, $this->staff($r));
        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy đợt thu.'], 404);
    }

    public function invoices(Request $r, int $id)
    {
        $d = $this->repo()->invoices($id, $r->query());
        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy đợt thu.'], 404);
    }

    public function debtors(int $id)
    {
        $d = $this->repo()->debtors($id);
        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy đợt thu.'], 404);
    }

    public function edit(int $id)
    {
        $d = $this->repo()->editData($id);
        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy đợt thu.'], 404);
    }

    public function preview(Request $r)
    {
        $x = $this->repo()->preview($r->all());
        return $x['ok'] ? response()->json(['data' => $x['data']]) : response()->json(array_filter(['message' => $x['message'], 'errors' => $x['errors'] ?? null]), $x['status']);
    }

    public function previewPeriod(int $id)
    {
        $x = $this->repo()->preview(['period_id' => $id]);
        return $x['ok'] ? response()->json(['data' => $x['data']]) : response()->json(['message' => $x['message']], $x['status']);
    }

    public function store(Request $r)
    {
        return $this->out($this->repo()->create($r->all(), $this->staff($r)));
    }

    public function update(Request $r, int $id)
    {
        return $this->out($this->repo()->update($id, $r->all(), $this->staff($r)));
    }

    public function issue(Request $r, int $id)
    {
        return $this->out($this->repo()->issue($id, $this->staff($r)));
    }

    public function extend(Request $r, int $id)
    {
        return $this->out($this->repo()->extend($id, (string) $r->input('due_date', ''), (string) $r->input('reason', ''), $this->staff($r)));
    }

    public function close(Request $r, int $id)
    {
        return $this->out($this->repo()->close($id, $this->staff($r)));
    }

    public function reopen(Request $r, int $id)
    {
        return $this->out($this->repo()->reopen($id, $this->staff($r)));
    }

    public function cancel(Request $r, int $id)
    {
        return $this->out($this->repo()->cancel($id, (string) $r->input('reason', ''), $this->staff($r)));
    }
}
