<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\FeeDebtRepo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Công nợ học phí cho Kế toán (prefix /api/kt/debts, cần token nhân viên – middleware FeeStaffToken).
 *   GET  debts/meta · debts · debts/overview · debts/promises · debts/students/{id}
 *   POST debts/notes · debts/notes/{id}/resolve
 */
class FeeDebtController extends Controller
{
    private function repo(): FeeDebtRepo
    {
        return new FeeDebtRepo(DB::connection()->getPdo());
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

    public function index(Request $r)
    {
        return response()->json(['data' => $this->repo()->index($r->query())]);
    }

    public function overview(Request $r)
    {
        return response()->json(['data' => $this->repo()->overview($r->query())]);
    }

    public function promises(Request $r)
    {
        return response()->json(['data' => $this->repo()->promises($r->query())]);
    }

    public function student(int $id)
    {
        $d = $this->repo()->student($id);
        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy học sinh.'], 404);
    }

    public function addNote(Request $r)
    {
        return $this->out($this->repo()->addNote($this->staff($r), $r->all()));
    }

    public function resolve(Request $r, int $id)
    {
        return $this->out($this->repo()->resolve($this->staff($r), $id, (string) $r->input('result', '')));
    }
}
