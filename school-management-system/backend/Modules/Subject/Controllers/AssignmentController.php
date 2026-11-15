<?php

namespace Modules\Subject\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Subject\Services\AssignmentService;
use Modules\Subject\Services\InsightService;
use Modules\Subject\Support\Audit;

class AssignmentController extends Controller
{
    use ApiResponse;

    public function __construct(private AssignmentService $svc, private InsightService $insight) {}

    private function year(Request $r): int
    {
        return Audit::currentYearId($r->integer('school_year_id') ?: null);
    }

    public function matrix(Request $r)
    {
        return $this->success($this->svc->matrix($this->year($r), $r->integer('grade') ?: null));
    }

    public function assign(Request $r)
    {
        $d = $r->validate(['class_id' => 'required|integer', 'subject_id' => 'required|integer', 'teacher_id' => 'required|integer']);
        $res = $this->svc->assign($d['class_id'], $d['subject_id'], $d['teacher_id']);

        return $res['ok'] ? $this->success($res, 'Đã lưu phân công') : $this->error($res['message'], 422);
    }

    public function assignMany(Request $r)
    {
        $d = $r->validate(['subject_id' => 'required|integer', 'teacher_id' => 'required|integer', 'class_ids' => 'required|array|min:1', 'class_ids.*' => 'integer']);

        return $this->success($this->svc->assignMany($d['subject_id'], $d['class_ids'], $d['teacher_id']), 'Đã phân công hàng loạt');
    }

    public function destroy(Request $r, int $id)
    {
        $res = $this->svc->unassign($id, $r->boolean('force'));
        if (! empty($res['missing'])) {
            return $this->error('Không tìm thấy phân công', 404);
        }

        return $res['ok'] ? $this->success($res, 'Đã gỡ phân công') : $this->error($res['message'], 409, $res);
    }

    public function auto(Request $r)
    {
        $d = $r->validate(['grade' => 'nullable|in:10,11,12', 'subject_id' => 'nullable|integer', 'dry_run' => 'boolean']);

        return $this->success($this->svc->auto($this->year($r), $d['grade'] ?? null, $d['subject_id'] ?? null, (bool) ($d['dry_run'] ?? true)));
    }

    public function copy(Request $r)
    {
        $d = $r->validate(['from_year_id' => 'required|integer|different:to_year_id', 'to_year_id' => 'required|integer']);

        return $this->success($this->svc->copyFromYear($d['from_year_id'], $d['to_year_id']), 'Đã sao chép phân công');
    }

    public function workload(Request $r)
    {
        return $this->success($this->insight->workload($this->year($r)));
    }
}
