<?php

namespace App\Http\Controllers\Api;

use DomainException;
use Illuminate\Http\Request;
use Modules\LessonPlan\Services\LessonPlanService;

/** Duyệt kế hoạch bài dạy: Hiệu trưởng, Phó hiệu trưởng, quản trị. Tên hàm có tiền tố rv. */
class LessonPlanReviewController extends LessonAttendanceStaffController
{
    private function rvSvc(): LessonPlanService
    {
        return app(LessonPlanService::class);
    }

    private function rvMe(Request $r): array
    {
        $st = $this->staff($r);
        abort_unless(in_array($st->role, ['principal', 'vice_principal', 'super_admin'], true), 403, 'Chỉ Ban giám hiệu mới duyệt được kế hoạch bài dạy.');
        return ['id' => (int) $st->id, 'name' => (string) ($st->full_name ?? $st->name ?? $st->username ?? 'Ban giám hiệu')];
    }

    public function rvList(Request $r)
    {
        $this->rvMe($r);
        return response()->json(['data' => $this->rvSvc()->reviewList($r->only(['status', 'q']))]);
    }

    public function rvShow(Request $r, int $id)
    {
        $this->rvMe($r);
        $d = $this->rvSvc()->reviewDetail($id);
        abort_unless($d, 404, 'Không tìm thấy kế hoạch.');
        return response()->json(['data' => $d]);
    }

    public function rvDecide(Request $r, int $id)
    {
        $me = $this->rvMe($r);
        $d = $r->validate(['action' => 'required|in:approve,return', 'note' => 'nullable|string|max:1000']);
        try {
            abort_unless($this->rvSvc()->review($me, $id, $d['action'], $d['note'] ?? null), 404, 'Không tìm thấy kế hoạch.');
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }
        return response()->json(['data' => $this->rvSvc()->reviewDetail($id)]);
    }
}
