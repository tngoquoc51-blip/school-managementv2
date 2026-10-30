<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\FeeReminderRepo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Nhắc nợ phụ huynh cho Kế toán (prefix /api/kt/reminders, cần token nhân viên – middleware FeeStaffToken).
 *   GET  meta · suggestions · batches · batches/{id} · stats · templates · students/{id}
 *   POST preview · send · settings · templates · batches/{id}/mark-sent · batches/{id}/cancel · templates/{id}/toggle
 *   PUT  templates/{id}
 */
class FeeReminderController extends Controller
{
    private function repo(): FeeReminderRepo
    {
        return new FeeReminderRepo(DB::connection()->getPdo());
    }

    /** @return array<string,mixed> */
    private function staff(Request $r): array
    {
        return $r->attributes->get('kt_staff');
    }

    private function out(array $x)
    {
        if (!$x['ok']) {
            return response()->json(array_filter(['message' => $x['message'], 'errors' => $x['errors'] ?? null, 'skipped' => $x['skipped'] ?? null, 'skipped_count' => $x['skipped_count'] ?? null]), $x['status']);
        }
        return response()->json(['message' => $x['message'] ?? 'OK', 'data' => array_diff_key($x, ['ok' => 1, 'status' => 1, 'message' => 1])]);
    }

    public function meta()
    {
        return response()->json(['data' => $this->repo()->meta()]);
    }

    public function suggestions(Request $r)
    {
        return response()->json(['data' => $this->repo()->suggestions($r->query())]);
    }

    public function preview(Request $r)
    {
        return $this->out($this->repo()->preview($this->staff($r), $r->all()));
    }

    public function send(Request $r)
    {
        return $this->out($this->repo()->send($this->staff($r), $r->all()));
    }

    public function batches(Request $r)
    {
        return response()->json(['data' => $this->repo()->batches($r->query())]);
    }

    public function batch(Request $r, int $id)
    {
        $d = $this->repo()->batch($id, $r->query());
        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy đợt gửi.'], 404);
    }

    public function markSent(Request $r, int $id)
    {
        $ids = $r->input('ids', []);
        return $this->out($this->repo()->markSent($this->staff($r), $id, is_array($ids) ? $ids : []));
    }

    public function cancel(Request $r, int $id)
    {
        return $this->out($this->repo()->cancelBatch($this->staff($r), $id));
    }

    public function stats(Request $r)
    {
        return response()->json(['data' => $this->repo()->stats($r->query())]);
    }

    public function studentHistory(int $id)
    {
        return response()->json(['data' => $this->repo()->studentHistory($id)]);
    }

    public function templates()
    {
        return response()->json(['data' => $this->repo()->templates()]);
    }

    public function saveTemplate(Request $r, ?int $id = null)
    {
        return $this->out($this->repo()->saveTemplate($this->staff($r), $id, $r->all()));
    }

    public function toggleTemplate(Request $r, int $id)
    {
        return $this->out($this->repo()->toggleTemplate($this->staff($r), $id));
    }

    public function saveSettings(Request $r)
    {
        return $this->out($this->repo()->saveSettings($this->staff($r), $r->all()));
    }
}
