<?php

namespace Modules\Emulation\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;
use Modules\Emulation\Exceptions\EmuException;
use Modules\Emulation\Services\EmulationService;

class EmulationController extends Controller
{
    public function __construct(private EmulationService $svc) {}

    private function success(mixed $data = null, string $message = 'OK', int $code = 200): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], $code);
    }

    private function error(string $message, int $code = 422): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message], $code);
    }

    /** Chạy 1 hành động trong ngữ cảnh lớp, tự đổi EmuException thành JSON. */
    private function run(Request $r, callable $fn, string $message = 'OK', int $code = 200): JsonResponse
    {
        try {
            $ctx = $this->svc->context($r->attributes->get('emu_actor'), $r->integer('class_id') ?: null);

            return $this->success($fn($ctx), $message, $code);
        } catch (EmuException $e) {
            return $this->error($e->getMessage(), $e->status);
        }
    }

    private function sem(Request $r): int
    {
        return in_array((int) $r->query('semester', 0), [0, 1, 2], true) ? (int) $r->query('semester', 0) : 0;
    }

    public function meta(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->meta($c));
    }

    public function overview(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->overview($c, $this->sem($r)));
    }

    public function students(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->studentRows($c, $this->sem($r)));
    }

    public function student(Request $r, int $id)
    {
        return $this->run($r, fn ($c) => $this->svc->student($c, $id, $this->sem($r)));
    }

    public function classRanking(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->classRanking($c, $this->sem($r)));
    }

    public function activity(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->activity($c, $r->integer('limit', 60)));
    }

    public function records(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->records($c, $r->query()));
    }

    public function storeRecords(Request $r)
    {
        $d = $r->validate([
            'student_ids' => 'required|array|min:1|max:60', 'student_ids.*' => 'integer',
            'criterion_id' => 'required|integer', 'points' => 'nullable|integer',
            'record_date' => 'required|date_format:Y-m-d', 'note' => 'nullable|string|max:255',
        ]);

        return $this->run($r, fn ($c) => $this->svc->createRecords($c, $d), 'Đã ghi nhận điểm thi đua', 201);
    }

    public function voidRecord(Request $r, int $id)
    {
        return $this->run($r, function ($c) use ($id) {
            $this->svc->voidRecord($c, $id);

            return null;
        }, 'Đã thu hồi bản ghi');
    }

    public function restoreRecord(Request $r, int $id)
    {
        return $this->run($r, function ($c) use ($id) {
            $this->svc->restoreRecord($c, $id);

            return null;
        }, 'Đã khôi phục bản ghi');
    }

    public function suggestions(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->suggestions($c, $this->sem($r)));
    }

    public function proposals(Request $r)
    {
        $sem = $r->has('semester') ? $this->sem($r) : -1;

        return $this->run($r, fn ($c) => $this->svc->proposals($c, $sem, $r->query('status')));
    }

    public function storeProposals(Request $r)
    {
        $d = $r->validate([
            'semester' => 'required|integer|in:0,1,2',
            'items' => 'required|array|min:1|max:200', 'items.*.student_id' => 'required|integer',
            'items.*.award_id' => 'required|integer', 'items.*.reason' => 'nullable|string|max:500',
        ]);

        return $this->run($r, fn ($c) => $this->svc->createProposals($c, (int) $d['semester'], $d['items']), 'Đã lập đề xuất', 201);
    }

    public function updateProposal(Request $r, int $id)
    {
        $d = $r->validate(['reason' => 'required|string|max:500']);

        return $this->run($r, function ($c) use ($id, $d) {
            $this->svc->updateProposal($c, $id, $d['reason']);

            return null;
        }, 'Đã cập nhật đề xuất');
    }

    public function submitProposals(Request $r)
    {
        $d = $r->validate(['ids' => 'required|array|min:1', 'ids.*' => 'integer']);

        return $this->run($r, fn ($c) => ['submitted' => $this->svc->submitProposals($c, $d['ids'])], 'Đã gửi Ban giám hiệu');
    }

    public function cancelProposal(Request $r, int $id)
    {
        return $this->run($r, function ($c) use ($id) {
            $this->svc->cancelProposal($c, $id);

            return null;
        }, 'Đã hủy đề xuất');
    }

    public function destroyProposal(Request $r, int $id)
    {
        return $this->run($r, function ($c) use ($id) {
            $this->svc->destroyProposal($c, $id);

            return null;
        }, 'Đã xóa đề xuất');
    }

    public function reviewProposal(Request $r, int $id)
    {
        $d = $r->validate([
            'decision' => 'required|in:approved,rejected', 'note' => 'nullable|string|max:255', 'decision_no' => 'nullable|string|max:40',
        ]);

        return $this->run($r, function ($c) use ($id, $d) {
            $this->svc->reviewProposal($c, $id, $d['decision'], $d['note'] ?? null, $d['decision_no'] ?? null);

            return null;
        }, 'Đã xử lý đề xuất');
    }

    public function storeCriterion(Request $r)
    {
        return $this->saveCriterion($r, null);
    }

    public function updateCriterion(Request $r, int $id)
    {
        return $this->saveCriterion($r, $id);
    }

    private function saveCriterion(Request $r, ?int $id)
    {
        $d = $r->validate([
            'name' => 'required|string|max:160', 'category' => 'required|in:discipline,study,movement,hygiene,attendance',
            'points' => 'required|integer|not_in:0|between:-50,50', 'is_active' => 'nullable|boolean',
        ]);

        return $this->run($r, function ($c) use ($id, $d) {
            $this->svc->saveCriterion($c, $id, $d);

            return null;
        }, 'Đã lưu tiêu chí');
    }
}
