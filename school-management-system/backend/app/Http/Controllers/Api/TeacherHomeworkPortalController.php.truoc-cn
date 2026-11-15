<?php

namespace App\Http\Controllers\Api;

use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Modules\TeacherPortal\Requests\GradeSubmissionRequest;
use Modules\TeacherPortal\Requests\StoreHomeworkRequest;
use Modules\TeacherPortal\Services\TeacherHomeworkService;

/**
 * Bài tập phía giáo viên. Dùng cùng cơ chế đăng nhập với TeacherPortalController:
 * StaffToken -> tài khoản nhân sự (sm_staff_accounts) có role = teacher và teacher_id.
 * Tên hàm có tiền tố hw để không trùng với các hàm của lớp cha.
 */
class TeacherHomeworkPortalController extends LessonAttendanceStaffController
{
    private function hwSvc(): TeacherHomeworkService
    {
        return app(TeacherHomeworkService::class);
    }

    /** Ngữ cảnh giáo viên: chỉ làm việc trên lớp và môn được phân công trong năm học hiện tại. */
    private function hwCtx(Request $r): array
    {
        $st = $this->staff($r);
        abort_unless($st->role === 'teacher' && (int) ($st->teacher_id ?? 0) > 0, 403, 'Tài khoản này chưa được liên kết với giáo viên.');
        $tid = (int) $st->teacher_id;
        $year = DB::table('sm_school_years')->where('is_current', 1)->value('id');
        abort_unless($year, 404, 'Chưa có năm học hiện tại.');
        return ['id' => $tid, 'name' => DB::table('sm_teachers')->where('id', $tid)->value('full_name') ?: 'Giáo viên', 'year_id' => (int) $year];
    }

    public function hwList(Request $r)
    {
        $per = max(1, min(50, (int) $r->query('per_page', 15)));
        $res = $this->hwSvc()->list($this->hwCtx($r), $r->only(['class_subject_id', 'status', 'q']), max(1, (int) $r->query('page', 1)), $per);
        return response()->json(['data' => $res['items'], 'meta' => $res['meta']]);
    }

    public function hwShow(Request $r, int $id)
    {
        $h = $this->hwSvc()->find($this->hwCtx($r), $id);
        abort_unless($h, 404, 'Không tìm thấy bài tập của bạn.');
        return response()->json(['data' => $h]);
    }

    public function hwStore(StoreHomeworkRequest $req)
    {
        $tc = $this->hwCtx($req);
        try {
            $id = $this->hwSvc()->create($tc, $req->validated());
        } catch (DomainException $e) {
            abort(403, $e->getMessage());
        }
        return response()->json(['data' => $this->hwSvc()->find($tc, $id)], 201);
    }

    public function hwUpdate(StoreHomeworkRequest $req, int $id)
    {
        $tc = $this->hwCtx($req);
        $data = $req->validated();
        unset($data['class_subject_id']); // không đổi lớp/môn của bài đã giao
        abort_unless($this->hwSvc()->update($tc, $id, $data), 404, 'Không tìm thấy bài tập của bạn.');
        return response()->json(['data' => $this->hwSvc()->find($tc, $id)]);
    }

    public function hwDelete(Request $r, int $id)
    {
        $res = $this->hwSvc()->remove($this->hwCtx($r), $id);
        abort_if($res === null, 404, 'Không tìm thấy bài tập của bạn.');
        return response()->json(['data' => ['result' => $res], 'message' => $res === 'hidden'
            ? 'Bài đã có học sinh nộp nên được chuyển sang bản nháp (ẩn khỏi học sinh).' : 'Đã xóa bài tập.']);
    }

    public function hwSubmissions(Request $r, int $id)
    {
        $res = $this->hwSvc()->submissions($this->hwCtx($r), $id);
        abort_unless($res, 404, 'Không tìm thấy bài tập của bạn.');
        return response()->json(['data' => $res]);
    }

    public function hwGrade(GradeSubmissionRequest $req, int $submissionId)
    {
        try {
            $res = $this->hwSvc()->grade($this->hwCtx($req), $submissionId, $req->input('action'), $req->input('score'), $req->input('feedback'));
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }
        abort_unless($res, 404, 'Không tìm thấy bài nộp thuộc lớp bạn dạy.');
        return response()->json(['data' => $res]);
    }

    public function hwComments(Request $r, int $id)
    {
        $res = $this->hwSvc()->comments($this->hwCtx($r), $id);
        abort_if($res === null, 404, 'Không tìm thấy bài tập của bạn.');
        return response()->json(['data' => $res]);
    }

    public function hwReply(Request $r, int $id)
    {
        $body = trim((string) $r->validate(['body' => 'required|string|min:2|max:1000'])['body']);
        $res = $this->hwSvc()->reply($this->hwCtx($r), $id, $body);
        abort_unless($res, 404, 'Không tìm thấy bài tập của bạn.');
        return response()->json(['data' => $res], 201);
    }

    public function hwDownload(Request $r, int $file)
    {
        $row = $this->hwSvc()->ownedFile($this->hwCtx($r), $file);
        abort_unless($row && Storage::disk('local')->exists($row->path), 404, 'Không tìm thấy tệp.');
        return Storage::disk('local')->download($row->path, $row->original_name);
    }
}
