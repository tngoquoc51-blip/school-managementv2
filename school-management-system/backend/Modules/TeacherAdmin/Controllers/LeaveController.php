<?php

namespace Modules\TeacherAdmin\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\TeacherAdmin\Services\LeaveService;

class LeaveController extends Controller
{
    use ApiResponse;

    public function __construct(private LeaveService $svc) {}

    public function index(Request $r)
    {
        return $this->success($this->svc->list($r->all()));
    }

    public function store(Request $r)
    {
        $d = $r->validate([
            'teacher_id' => 'required|integer|exists:sm_teachers,id', 'leave_type' => 'nullable|in:sick,personal,maternity,training,other',
            'from_date' => 'required|date', 'to_date' => 'required|date', 'reason' => 'nullable|string|max:300',
        ]);
        [$ok, $msg, $id] = $this->svc->create($d);

        return $ok ? $this->success(['id' => $id], $msg, 201) : $this->error($msg, 422);
    }

    public function review(Request $r, int $id)
    {
        $d = $r->validate(['decision' => 'required|string', 'note' => 'nullable|string|max:300']);
        [$ok, $msg] = $this->svc->review($id, $d['decision'], $d['note'] ?? null);

        return $ok ? $this->success(null, $msg) : $this->error($msg, 422);
    }

    public function destroy(int $id)
    {
        return $this->svc->delete($id) ? $this->success(null, 'Đã xóa đơn') : $this->error('Không tìm thấy', 404);
    }

    public function coverage(int $id)
    {
        $d = $this->svc->coverage($id);

        return $d ? $this->success($d) : $this->error('Không tìm thấy đơn', 404);
    }

    public function substitute(Request $r, int $id)
    {
        $d = $r->validate(['lesson_date' => 'required|date', 'timetable_id' => 'required|integer', 'teacher_id' => 'required|integer']);
        [$ok, $msg] = $this->svc->assignSubstitute($id, $d['lesson_date'], $d['timetable_id'], $d['teacher_id']);

        return $ok ? $this->success(null, $msg) : $this->error($msg, 422);
    }

    public function unsubstitute(Request $r, int $id)
    {
        $d = $r->validate(['lesson_date' => 'required|date', 'timetable_id' => 'required|integer']);
        $this->svc->removeSubstitute($id, $d['lesson_date'], $d['timetable_id']);

        return $this->success(null, 'Đã hủy dạy thay');
    }

    public function auto(int $id)
    {
        [$ok, $msg, $n] = $this->svc->autoCover($id);

        return $ok ? $this->success(['assigned' => $n], $msg) : $this->error($msg, 422);
    }
}
