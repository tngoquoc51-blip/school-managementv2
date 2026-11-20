<?php

namespace Modules\TeacherAdmin\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\TeacherAdmin\Services\InsightService;
use Modules\TeacherAdmin\Services\ScheduleService;
use Modules\TeacherAdmin\Services\WorkloadService;
use Modules\TeacherAdmin\Support\Audit;

class InsightController extends Controller
{
    use ApiResponse;

    public function __construct(private InsightService $svc, private WorkloadService $load, private ScheduleService $sched) {}

    private function year(Request $r): int
    {
        return Audit::yearId($r->integer('school_year_id') ?: null);
    }

    public function overview(Request $r)
    {
        return $this->success($this->svc->overview($this->year($r)));
    }

    public function supply(Request $r)
    {
        return $this->success($this->svc->supply($this->year($r)));
    }

    public function performance(Request $r)
    {
        return $this->success($this->svc->performance($this->year($r), $r->integer('semester') ?: null));
    }

    public function integrity(Request $r)
    {
        return $this->success($this->svc->integrity($this->year($r)));
    }

    public function workload(Request $r)
    {
        $y = $this->year($r);

        return $this->success(['workload' => $this->load->overview($y), 'suggestions' => $this->load->suggestions($y)]);
    }

    public function transfer(Request $r)
    {
        $d = $r->validate(['class_subject_id' => 'required|integer', 'to_teacher_id' => 'required|integer']);
        [$ok, $msg] = $this->load->applyTransfer($d['class_subject_id'], $d['to_teacher_id']);

        return $ok ? $this->success(null, $msg) : $this->error($msg, 422);
    }

    public function homeroom(Request $r)
    {
        return $this->success($this->load->homeroom($this->year($r)));
    }

    public function setHomeroom(Request $r)
    {
        $d = $r->validate(['class_id' => 'required|integer', 'teacher_id' => 'nullable|integer']);
        [$ok, $msg, $warn] = $this->load->setHomeroom($d['class_id'], $d['teacher_id'] ?? null);

        return $ok ? $this->success(['warnings' => $warn], $msg) : $this->error($msg, 422);
    }

    public function schedule(Request $r, int $id)
    {
        return $this->success($this->sched->week($id, $this->year($r)));
    }

    public function conflicts(Request $r)
    {
        return $this->success($this->sched->conflicts($this->year($r)));
    }
}
