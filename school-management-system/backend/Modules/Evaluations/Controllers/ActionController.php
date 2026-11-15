<?php

namespace Modules\Evaluations\Controllers;

use Illuminate\Http\Request;
use Modules\Evaluations\Support\EvalAudit;

class ActionController extends BaseController
{
    public function index(Request $r)
    {
        return $this->success($this->repo->actions($r->query(), max(1, (int) $r->query('page', 1)), (int) $r->query('per_page', 20)));
    }

    private function rules(): array
    {
        return ['title' => 'required|max:200', 'detail' => 'nullable|max:2000', 'priority' => 'required|in:low,normal,high', 'due_date' => 'nullable|date'];
    }

    public function store(Request $r)
    {
        if ($e = $this->check($r->all(), $this->rules() + ['teacher_id' => 'required|integer', 'observation_id' => 'nullable|integer'])) return $e;
        $tid = (int) $r->input('teacher_id');
        if (! $this->repo->teacherExists($tid)) return $this->error('Giáo viên không tồn tại', 422);
        $oid = $this->nullable($r->input('observation_id'));
        if ($oid && ! $this->repo->observation((int) $oid)) return $this->error('Phiếu dự giờ không tồn tại', 422);
        $id = $this->repo->createAction(['observation_id' => $oid ? (int) $oid : null, 'teacher_id' => $tid, 'title' => trim($r->input('title')), 'detail' => $this->nullable($r->input('detail')),
            'priority' => $r->input('priority'), 'due_date' => $this->nullable($r->input('due_date')), 'assigned_by' => $this->name($r)]);
        $t = $this->repo->teacherName($tid);
        EvalAudit::log('action.create', 'ev_action', $id, $t, "Giao kế hoạch cải tiến cho {$t}: " . $r->input('title'), null, $r->only(['title', 'priority', 'due_date', 'observation_id']));
        return $this->success($this->repo->action($id), 'Đã giao kế hoạch cải tiến', 201);
    }

    public function update(Request $r, int $id)
    {
        $old = $this->repo->action($id);
        if (! $old) return $this->error('Không tìm thấy kế hoạch', 404);
        if ($e = $this->check($r->all(), $this->rules())) return $e;
        $d = ['title' => trim($r->input('title')), 'detail' => $this->nullable($r->input('detail')), 'priority' => $r->input('priority'), 'due_date' => $this->nullable($r->input('due_date'))];
        $this->repo->updateAction($id, $d);
        EvalAudit::log('action.update', 'ev_action', $id, $old['teacher_name'], 'Sửa kế hoạch cải tiến: ' . $old['title'], array_intersect_key($old, $d), $d);
        return $this->success($this->repo->action($id), 'Đã cập nhật');
    }

    public function status(Request $r, int $id)
    {
        $old = $this->repo->action($id);
        if (! $old) return $this->error('Không tìm thấy kế hoạch', 404);
        if ($e = $this->check($r->all(), ['status' => 'required|in:open,in_progress,done,cancelled', 'result_note' => 'nullable|max:500'])) return $e;
        $to = $r->input('status');
        if ($to === 'done' && ! $this->nullable($r->input('result_note'))) return $this->error('Hãy ghi kết quả thực hiện khi hoàn thành', 422);
        $this->repo->setActionStatus($id, $to, $this->nullable($r->input('result_note')));
        EvalAudit::log('action.status', 'ev_action', $id, $old['teacher_name'], "Kế hoạch \"{$old['title']}\": {$old['status']} → {$to}", ['status' => $old['status']], ['status' => $to, 'result_note' => $r->input('result_note')]);
        return $this->success($this->repo->action($id), 'Đã cập nhật trạng thái');
    }

    public function destroy(Request $r, int $id)
    {
        $old = $this->repo->action($id);
        if (! $old) return $this->error('Không tìm thấy kế hoạch', 404);
        $this->repo->deleteAction($id);
        EvalAudit::log('action.delete', 'ev_action', $id, $old['teacher_name'], 'Xoá kế hoạch cải tiến: ' . $old['title'], $old, null, 'warning');
        return $this->success(null, 'Đã xoá kế hoạch');
    }
}
