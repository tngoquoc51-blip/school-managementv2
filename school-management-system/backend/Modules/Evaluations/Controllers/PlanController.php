<?php

namespace Modules\Evaluations\Controllers;

use Illuminate\Http\Request;
use Modules\Evaluations\Support\EvalAudit;

class PlanController extends BaseController
{
    public function index(Request $r)
    {
        [$y, $s] = $this->period($r);
        $f = $r->query() + [];
        $f['year'] = $y; $f['semester'] = $s === 3 ? 0 : $s;
        return $this->success($this->repo->plans($f, max(1, (int) $r->query('page', 1)), (int) $r->query('per_page', 20)));
    }

    private function rules(): array
    {
        return [
            'teacher_id' => 'required|integer', 'plan_date' => 'required|date', 'period' => 'nullable|integer|min:1|max:10',
            'kind' => 'required|in:planned,surprise,thematic,followup', 'topic' => 'nullable|max:200',
            'class_id' => 'nullable|integer', 'subject_id' => 'nullable|integer', 'rubric_id' => 'nullable|integer',
            'observer_name' => 'nullable|max:120', 'note' => 'nullable|max:500',
        ];
    }

    private function payload(Request $r, array $base = []): array
    {
        $d = array_fill_keys(['teacher_id', 'plan_date', 'period', 'kind', 'topic', 'class_id', 'subject_id', 'rubric_id', 'observer_name', 'note'], null);
        foreach ($r->only(array_keys($d)) as $k => $v) $d[$k] = $this->nullable($v);
        $d['teacher_id'] = (int) $d['teacher_id'];
        foreach (['period', 'class_id', 'subject_id', 'rubric_id'] as $k) $d[$k] = isset($d[$k]) ? (int) $d[$k] : null;
        $d['semester'] = $this->semesterOf($d['plan_date']);
        $d['rubric_id'] = $d['rubric_id'] ?: (int) ($this->repo->settings()['default_rubric_id'] ?? 1);
        $d['observer_name'] = $d['observer_name'] ?: $this->name($r);
        return $d + $base;
    }

    public function store(Request $r)
    {
        if ($e = $this->check($r->all(), $this->rules())) return $e;
        $d = $this->payload($r);
        if (! $this->repo->teacherExists($d['teacher_id'])) return $this->error('Giáo viên không tồn tại', 422);
        if ($c = $this->repo->planConflict($d['teacher_id'], $d['plan_date'], $d['period'])) {
            return $this->error('Giáo viên này đã có lịch dự giờ cùng tiết (người dự: ' . ($c['observer_name'] ?: 'chưa rõ') . ')', 409);
        }
        $d += ['school_year_id' => $this->repo->currentYearId(), 'observer_id' => $this->me($r)['id'] ?? null, 'created_by' => $this->name($r)];
        $id = $this->repo->createPlan($d);
        $t = $this->repo->teacherName($d['teacher_id']);
        EvalAudit::log('plan.create', 'ev_plan', $id, $t, "Lên lịch dự giờ {$t} ngày " . date('d/m/Y', strtotime($d['plan_date'])), null, $d);
        return $this->success($this->repo->plan($id), 'Đã lên lịch dự giờ', 201);
    }

    public function update(Request $r, int $id)
    {
        $old = $this->repo->plan($id);
        if (! $old) return $this->error('Không tìm thấy lịch dự giờ', 404);
        if ($old['status'] !== 'scheduled') return $this->error('Chỉ sửa được lịch đang chờ thực hiện', 409);
        if ($e = $this->check($r->all(), $this->rules())) return $e;
        $d = $this->payload($r);
        if ($c = $this->repo->planConflict($d['teacher_id'], $d['plan_date'], $d['period'], $id)) {
            return $this->error('Giáo viên này đã có lịch dự giờ cùng tiết', 409);
        }
        $this->repo->updatePlan($id, $d);
        EvalAudit::log('plan.update', 'ev_plan', $id, $old['teacher_name'], 'Sửa lịch dự giờ ' . $old['teacher_name'],
            array_intersect_key($old, $d), $d);
        return $this->success($this->repo->plan($id), 'Đã cập nhật lịch');
    }

    public function postpone(Request $r, int $id)
    {
        $old = $this->repo->plan($id);
        if (! $old) return $this->error('Không tìm thấy lịch dự giờ', 404);
        if ($old['status'] !== 'scheduled') return $this->error('Chỉ dời được lịch đang chờ', 409);
        if ($e = $this->check($r->all(), ['plan_date' => 'required|date', 'period' => 'nullable|integer|min:1|max:10', 'reason' => 'required|max:300'])) return $e;
        $period = $this->nullable($r->input('period')); $period = $period !== null ? (int) $period : null;
        if ($this->repo->planConflict((int) $old['teacher_id'], $r->input('plan_date'), $period, $id)) return $this->error('Trùng lịch dự giờ khác của giáo viên', 409);
        $this->repo->postponePlan($id, $r->input('plan_date'), $period, trim($r->input('reason')));
        EvalAudit::log('plan.postpone', 'ev_plan', $id, $old['teacher_name'], "Dời lịch dự giờ {$old['teacher_name']}: {$old['plan_date']} → {$r->input('plan_date')}",
            ['plan_date' => $old['plan_date'], 'period' => $old['period']], ['plan_date' => $r->input('plan_date'), 'period' => $period, 'reason' => $r->input('reason')], 'notice');
        return $this->success($this->repo->plan($id), 'Đã dời lịch');
    }

    public function cancel(Request $r, int $id)
    {
        $old = $this->repo->plan($id);
        if (! $old) return $this->error('Không tìm thấy lịch dự giờ', 404);
        if ($old['status'] !== 'scheduled') return $this->error('Lịch này không còn ở trạng thái chờ', 409);
        if ($e = $this->check($r->all(), ['reason' => 'required|max:300'])) return $e;
        $this->repo->setPlanStatus($id, 'cancelled', trim($r->input('reason')));
        EvalAudit::log('plan.cancel', 'ev_plan', $id, $old['teacher_name'], "Huỷ lịch dự giờ {$old['teacher_name']} ({$old['plan_date']})",
            ['status' => 'scheduled'], ['status' => 'cancelled', 'reason' => $r->input('reason')], 'notice');
        return $this->success($this->repo->plan($id), 'Đã huỷ lịch');
    }

    public function destroy(Request $r, int $id)
    {
        $old = $this->repo->plan($id);
        if (! $old) return $this->error('Không tìm thấy lịch dự giờ', 404);
        if ($old['observation_id']) return $this->error('Lịch đã có phiếu dự giờ, không thể xoá', 409);
        $this->repo->deletePlan($id);
        EvalAudit::log('plan.delete', 'ev_plan', $id, $old['teacher_name'], "Xoá lịch dự giờ {$old['teacher_name']} ({$old['plan_date']})", $old, null, 'warning');
        return $this->success(null, 'Đã xoá lịch');
    }

    /** Bắt đầu phiếu dự giờ từ một lịch: tạo phiếu nháp và đánh dấu lịch đã thực hiện. */
    public function start(Request $r, int $id)
    {
        $p = $this->repo->plan($id);
        if (! $p) return $this->error('Không tìm thấy lịch dự giờ', 404);
        if ($ex = $this->repo->observationForPlan($id)) return $this->success(['observation_id' => (int) $ex['id'], 'code' => $ex['code'], 'existing' => true], 'Lịch này đã có phiếu');
        if ($p['status'] === 'cancelled') return $this->error('Lịch đã huỷ', 409);
        $obsId = $this->repo->createObservation([
            'plan_id' => $id, 'school_year_id' => $p['school_year_id'], 'semester' => $p['semester'], 'teacher_id' => $p['teacher_id'],
            'class_id' => $p['class_id'], 'subject_id' => $p['subject_id'], 'rubric_id' => $p['rubric_id'] ?: (int) ($this->repo->settings()['default_rubric_id'] ?? 1),
            'observed_on' => $p['plan_date'], 'period' => $p['period'], 'kind' => $p['kind'], 'topic' => $p['topic'],
            'students_present' => null, 'duration_min' => 45, 'observer_id' => $this->me($r)['id'] ?? null, 'observer_name' => $p['observer_name'] ?: $this->name($r),
        ]);
        $this->repo->markPlanDone($id);
        $o = $this->repo->observation($obsId);
        EvalAudit::log('observation.create', 'ev_observation', $obsId, $o['code'], "Mở phiếu dự giờ {$o['code']} cho {$p['teacher_name']}", null, ['plan_id' => $id]);
        return $this->success(['observation_id' => $obsId, 'code' => $o['code'], 'existing' => false], 'Đã tạo phiếu dự giờ', 201);
    }
}
