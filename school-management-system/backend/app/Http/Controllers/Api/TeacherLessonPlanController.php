<?php

namespace App\Http\Controllers\Api;

use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\LessonPlan\Services\LessonPlanService;

/**
 * Kế hoạch bài dạy (tài khoản Giáo viên bộ môn, role = teacher). Dùng cùng cơ chế StaffToken với TeacherPortalController.
 * Tên hàm có tiền tố lp để không trùng với các hàm của lớp cha.
 */
class TeacherLessonPlanController extends LessonAttendanceStaffController
{
    private function lpSvc(): LessonPlanService
    {
        return app(LessonPlanService::class);
    }

    private function lpCtx(Request $r): array
    {
        $st = $this->staff($r);
        abort_unless($st->role === 'teacher' && (int) ($st->teacher_id ?? 0) > 0, 403, 'Kế hoạch bài dạy dành cho tài khoản Giáo viên bộ môn. Hãy đăng nhập đúng cổng bằng tài khoản giảng dạy.');
        $tid = (int) $st->teacher_id;
        $year = DB::table('sm_school_years')->where('is_current', 1)->value('id');
        abort_unless($year, 404, 'Chưa có năm học hiện tại.');
        return ['id' => $tid, 'name' => DB::table('sm_teachers')->where('id', $tid)->value('full_name') ?: 'Giáo viên', 'year_id' => (int) $year];
    }

    private function lpRun(callable $fn)
    {
        try { return $fn(); } catch (DomainException $e) { abort(422, $e->getMessage()); }
    }

    private const ITEM_RULES = [
        'title' => 'required|string|max:200', 'week_no' => 'sometimes|integer|between:1,40', 'periods' => 'sometimes|integer|between:1,6',
        'planned_date' => 'nullable|date_format:Y-m-d',
        'objectives_knowledge' => 'nullable|string|max:5000', 'objectives_competence' => 'nullable|string|max:5000', 'objectives_quality' => 'nullable|string|max:5000',
        'equipment' => 'nullable|string|max:5000', 'act_start' => 'nullable|string|max:8000', 'act_learn' => 'nullable|string|max:8000',
        'act_practice' => 'nullable|string|max:8000', 'act_apply' => 'nullable|string|max:8000', 'assessment' => 'nullable|string|max:5000', 'notes' => 'nullable|string|max:5000',
    ];

    public function lpOverview(Request $r) { return response()->json(['data' => $this->lpSvc()->overview($this->lpCtx($r))]); }

    public function lpList(Request $r)
    {
        return response()->json(['data' => $this->lpSvc()->list($this->lpCtx($r), $r->only(['class_subject_id', 'semester', 'status']))]);
    }

    public function lpShow(Request $r, int $id)
    {
        $d = $this->lpSvc()->detail($this->lpCtx($r), $id);
        abort_unless($d, 404, 'Không tìm thấy kế hoạch của bạn.');
        return response()->json(['data' => $d]);
    }

    public function lpStore(Request $r)
    {
        $tc = $this->lpCtx($r);
        $d = $r->validate(['class_subject_id' => 'required|integer', 'semester' => 'required|in:1,2', 'title' => 'required|string|max:180', 'description' => 'nullable|string|max:3000']);
        $id = $this->lpRun(fn () => $this->lpSvc()->create($tc, $d));
        return response()->json(['data' => $this->lpSvc()->detail($tc, $id)], 201);
    }

    public function lpUpdate(Request $r, int $id)
    {
        $tc = $this->lpCtx($r);
        $d = $r->validate(['title' => 'sometimes|required|string|max:180', 'description' => 'nullable|string|max:3000']);
        abort_unless($this->lpRun(fn () => $this->lpSvc()->updateHeader($tc, $id, $d)), 404, 'Không tìm thấy kế hoạch của bạn.');
        return response()->json(['data' => $this->lpSvc()->detail($tc, $id)]);
    }

    public function lpDelete(Request $r, int $id)
    {
        abort_unless($this->lpRun(fn () => $this->lpSvc()->remove($this->lpCtx($r), $id)), 404, 'Không tìm thấy kế hoạch của bạn.');
        return response()->json(['data' => ['ok' => true]]);
    }

    public function lpSubmit(Request $r, int $id)
    {
        $tc = $this->lpCtx($r);
        abort_unless($this->lpRun(fn () => $this->lpSvc()->submit($tc, $id)), 404, 'Không tìm thấy kế hoạch của bạn.');
        return response()->json(['data' => $this->lpSvc()->detail($tc, $id)]);
    }

    public function lpReopen(Request $r, int $id)
    {
        $tc = $this->lpCtx($r);
        $d = $r->validate(['note' => 'nullable|string|max:500']);
        abort_unless($this->lpRun(fn () => $this->lpSvc()->reopen($tc, $id, $d['note'] ?? null)), 404, 'Không tìm thấy kế hoạch của bạn.');
        return response()->json(['data' => $this->lpSvc()->detail($tc, $id)]);
    }

    public function lpClone(Request $r, int $id)
    {
        $tc = $this->lpCtx($r);
        $d = $r->validate(['targets' => 'required|array|min:1|max:20', 'targets.*' => 'integer']);
        $res = $this->lpRun(fn () => $this->lpSvc()->clone($tc, $id, $d['targets']));
        abort_unless($res, 404, 'Không tìm thấy kế hoạch của bạn.');
        return response()->json(['data' => $res], 201);
    }

    public function lpItemStore(Request $r, int $id)
    {
        $tc = $this->lpCtx($r);
        $d = $r->validate(self::ITEM_RULES);
        $item = $this->lpRun(fn () => $this->lpSvc()->addItem($tc, $id, $d));
        abort_unless($item, 404, 'Không tìm thấy kế hoạch của bạn.');
        return response()->json(['data' => $item], 201);
    }

    public function lpItemUpdate(Request $r, int $itemId)
    {
        $tc = $this->lpCtx($r);
        $rules = self::ITEM_RULES;
        $rules['title'] = 'sometimes|required|string|max:200';
        $d = $r->validate($rules);
        $item = $this->lpRun(fn () => $this->lpSvc()->updateItem($tc, $itemId, $d));
        abort_unless($item, 404, 'Không tìm thấy bài học của bạn.');
        return response()->json(['data' => $item]);
    }

    public function lpItemDelete(Request $r, int $itemId)
    {
        abort_unless($this->lpRun(fn () => $this->lpSvc()->removeItem($this->lpCtx($r), $itemId)), 404, 'Không tìm thấy bài học của bạn.');
        return response()->json(['data' => ['ok' => true]]);
    }

    public function lpReorder(Request $r, int $id)
    {
        $tc = $this->lpCtx($r);
        $d = $r->validate(['ids' => 'required|array|min:1', 'ids.*' => 'integer']);
        $res = $this->lpRun(fn () => $this->lpSvc()->reorder($tc, $id, $d['ids']));
        abort_if($res === null, 404, 'Không tìm thấy kế hoạch của bạn.');
        return response()->json(['data' => ['ok' => true]]);
    }

    public function lpTaught(Request $r, int $itemId)
    {
        $tc = $this->lpCtx($r);
        $d = $r->validate(['taught' => 'required|boolean', 'date' => 'nullable|date_format:Y-m-d']);
        $item = $this->lpRun(fn () => $this->lpSvc()->markTaught($tc, $itemId, (bool) $d['taught'], $d['date'] ?? null));
        abort_unless($item, 404, 'Không tìm thấy bài học của bạn.');
        return response()->json(['data' => $item]);
    }
}
