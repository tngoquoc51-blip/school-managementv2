<?php

namespace Modules\Homework\Controllers;

use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Modules\Homework\Requests\StoreCommentRequest;
use Modules\Homework\Requests\SubmitHomeworkRequest;
use Modules\Homework\Requests\UpdateStateRequest;
use Modules\Homework\Services\HomeworkService;

class HomeworkController extends Controller
{
    public function __construct(private HomeworkService $svc) {}

    /** Ngữ cảnh học sinh đang đăng nhập (dựa trên middleware StudentToken có sẵn của dự án). */
    private function st(Request $r): array
    {
        if ($ctx = $r->attributes->get('sm_student')) return $ctx;

        $sid = $this->studentId($r);
        $name = DB::table('sm_students')->where('id', $sid)->value('full_name');
        abort_unless($name, 401, 'Không xác định được học sinh từ phiên đăng nhập.');
        $classId = DB::table('sm_enrollments as e')
            ->join('sm_school_years as y', 'y.id', '=', 'e.school_year_id')
            ->where('e.student_id', $sid)->where('y.is_current', 1)->value('e.class_id');
        abort_unless($classId, 403, 'Bạn chưa được xếp lớp trong năm học hiện tại.');

        $ctx = ['id' => $sid, 'account_id' => 0, 'class_id' => (int) $classId, 'name' => $name];
        $r->attributes->set('sm_student', $ctx);
        return $ctx;
    }

    private function studentId(Request $r): int
    {
        $a = $r->attributes->get('sm_account');
        $v = is_array($a) ? ($a['student_id'] ?? null) : (is_object($a) ? ($a->student_id ?? null) : null);
        if ($v) return (int) $v;

        if ($t = $r->attributes->get('sm_token') ?: $r->bearerToken()) {
            $row = DB::table('sm_api_tokens as t')->join('sm_accounts as a', 'a.id', '=', 't.account_id')
                ->where('t.token_hash', hash('sha256', $t))->first(['a.student_id']);
            if ($row && $row->student_id) return (int) $row->student_id;
        }
        abort(401, 'Không xác định được học sinh từ phiên đăng nhập.');
    }

    private function ok(mixed $data, array $meta = [], int $code = 200): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $data] + ($meta ? ['meta' => $meta] : []), $code);
    }

    private function fail(string $msg, int $code): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $msg], $code);
    }

    public function summary(Request $r) { return $this->ok($this->svc->summary($this->st($r))); }

    public function subjects(Request $r) { return $this->ok($this->svc->subjects($this->st($r))); }

    public function calendar(Request $r)
    {
        $m = (string) $r->query('month', now()->format('Y-m'));
        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $m)) return $this->fail('Tháng không hợp lệ (định dạng YYYY-MM).', 422);
        return $this->ok($this->svc->calendar($this->st($r), $m));
    }

    public function index(Request $r)
    {
        $per = max(1, min(50, (int) $r->query('per_page', 10)));
        $res = $this->svc->list($this->st($r), $r->only(['status', 'subject_id', 'q', 'sort', 'starred']), max(1, (int) $r->query('page', 1)), $per);
        return $this->ok($res['items'], $res['meta']);
    }

    public function show(Request $r, int $id)
    {
        $d = $this->svc->detail($this->st($r), $id);
        return $d ? $this->ok($d) : $this->fail('Không tìm thấy bài tập.', 404);
    }

    public function submit(SubmitHomeworkRequest $req, int $id)
    {
        try {
            $files = Arr::wrap($req->file('files', []));
            return $this->ok($this->svc->submit($this->st($req), $id, $req->input('content'), $req->input('link_url'), $files), [], 201);
        } catch (DomainException $e) {
            return $this->fail($e->getMessage(), 422);
        }
    }

    public function saveState(UpdateStateRequest $req, int $id)
    {
        $res = $this->svc->saveState($this->st($req), $id, $req->validated());
        return $res ? $this->ok($res) : $this->fail('Không tìm thấy bài tập.', 404);
    }

    public function comments(Request $r, int $id)
    {
        $res = $this->svc->comments($this->st($r), $id);
        return $res === null ? $this->fail('Không tìm thấy bài tập.', 404) : $this->ok($res);
    }

    public function addComment(StoreCommentRequest $req, int $id)
    {
        $res = $this->svc->addComment($this->st($req), $id, trim($req->input('body')));
        return $res ? $this->ok($res, [], 201) : $this->fail('Không tìm thấy bài tập.', 404);
    }

    public function download(Request $r, int $file)
    {
        $row = $this->svc->ownedFile($this->st($r), $file);
        if (!$row || !Storage::disk('local')->exists($row->path)) return $this->fail('Không tìm thấy tệp.', 404);
        return Storage::disk('local')->download($row->path, $row->original_name);
    }
}
