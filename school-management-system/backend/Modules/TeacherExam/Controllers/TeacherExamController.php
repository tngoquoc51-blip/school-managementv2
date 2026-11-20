<?php

namespace Modules\TeacherExam\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\TeacherExam\Exceptions\ExamException;
use Modules\TeacherExam\Services\TeacherExamService;

class TeacherExamController extends Controller
{
    public function __construct(private TeacherExamService $svc) {}

    private function ok(mixed $data = null, string $message = 'OK', int $code = 200): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], $code);
    }

    /** Chạy một hành động trong ngữ cảnh giáo viên; ExamException -> JSON lỗi. */
    private function run(Request $r, callable $fn, string $message = 'OK', int $code = 200): JsonResponse
    {
        try {
            $ctx = $this->svc->context($r->attributes->get('exam_actor'), $r->integer('teacher_id') ?: null);

            return $this->ok($fn($ctx), $message, $code);
        } catch (ExamException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], $e->status);
        }
    }

    private function sem(Request $r): int
    {
        $s = (int) $r->query('semester', 0);

        return in_array($s, [0, 1, 2], true) ? $s : 0;
    }

    public function meta(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->meta($c));
    }

    public function overview(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->overview($c, $this->sem($r)));
    }

    public function calendar(Request $r)
    {
        $d = $r->validate(['from' => 'required|date_format:Y-m-d', 'to' => 'required|date_format:Y-m-d|after_or_equal:from']);

        return $this->run($r, fn ($c) => $this->svc->calendar($c, $d['from'], $d['to']));
    }

    public function activity(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->activity($c, $r->integer('limit', 40)));
    }

    /* ---------------- Bài kiểm tra ---------------- */

    public function tests(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->tests($c, $r->query()));
    }

    private function testRules(): array
    {
        return [
            'title' => 'required|string|max:150', 'kind' => 'required|in:tx15,tx45,gk,ck',
            'grade_column' => 'required|in:tx1,tx2,tx3,tx4,gk,ck', 'test_date' => 'required|date_format:Y-m-d',
            'start_time' => 'nullable|date_format:H:i', 'duration_minutes' => 'required|integer|between:5,240',
            'max_score' => 'required|numeric|between:1,100', 'paper_id' => 'nullable|integer', 'note' => 'nullable|string|max:255',
            'status' => 'nullable|in:draft,scheduled',
        ];
    }

    public function storeTest(Request $r)
    {
        $d = $r->validate($this->testRules() + ['class_id' => 'required|integer', 'subject_id' => 'required|integer']);

        return $this->run($r, fn ($c) => $this->svc->createTest($c, $d), 'Đã tạo bài kiểm tra', 201);
    }

    public function updateTest(Request $r, int $id)
    {
        $d = $r->validate($this->testRules());

        return $this->run($r, function ($c) use ($id, $d) {
            $this->svc->updateTest($c, $id, $d);

            return null;
        }, 'Đã cập nhật bài kiểm tra');
    }

    public function destroyTest(Request $r, int $id)
    {
        return $this->run($r, function ($c) use ($id) {
            $this->svc->deleteTest($c, $id);

            return null;
        }, 'Đã xóa bài kiểm tra');
    }

    public function sheet(Request $r, int $id)
    {
        return $this->run($r, fn ($c) => $this->svc->sheet($c, $id));
    }

    public function saveScores(Request $r, int $id)
    {
        $d = $r->validate([
            'rows' => 'required|array|min:1|max:80', 'rows.*.student_id' => 'required|integer',
            'rows.*.score' => 'nullable|numeric', 'rows.*.absent' => 'nullable|boolean', 'rows.*.note' => 'nullable|string|max:120',
        ]);

        return $this->run($r, fn ($c) => $this->svc->saveScores($c, $id, $d['rows']), 'Đã lưu điểm');
    }

    public function setStatus(Request $r, int $id)
    {
        $d = $r->validate(['status' => 'required|in:grading,scheduled,done']);

        return $this->run($r, function ($c) use ($id, $d) {
            $this->svc->setStatus($c, $id, $d['status']);

            return null;
        }, 'Đã cập nhật trạng thái');
    }

    public function sync(Request $r, int $id)
    {
        return $this->run($r, fn ($c) => $this->svc->sync($c, $id), 'Đã đồng bộ vào sổ điểm');
    }

    public function analytics(Request $r, int $id)
    {
        return $this->run($r, fn ($c) => $this->svc->analytics($c, $id));
    }

    public function matrix(Request $r)
    {
        $d = $r->validate(['class_id' => 'required|integer', 'subject_id' => 'required|integer']);

        return $this->run($r, fn ($c) => $this->svc->matrix($c, (int) $d['class_id'], (int) $d['subject_id'], $this->sem($r)));
    }

    /* ---------------- Ngân hàng câu hỏi ---------------- */

    private function questionRules(): array
    {
        return [
            'subject_id' => 'required|integer', 'grade' => 'required|integer|between:10,12', 'kind' => 'required|in:mcq,essay,truefalse',
            'difficulty' => 'required|in:easy,medium,hard', 'topic' => 'nullable|string|max:120', 'content' => 'required|string|max:5000',
            'options' => 'nullable|array|max:8', 'options.*' => 'nullable|string|max:500', 'answer' => 'nullable|string|max:2000',
            'points' => 'required|numeric|between:0.1,10', 'is_active' => 'nullable|boolean',
        ];
    }

    public function questions(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->questions($c, $r->query()));
    }

    public function storeQuestion(Request $r)
    {
        $d = $r->validate($this->questionRules());

        return $this->run($r, fn ($c) => $this->svc->createQuestion($c, $d), 'Đã thêm câu hỏi', 201);
    }

    public function updateQuestion(Request $r, int $id)
    {
        $d = $r->validate($this->questionRules());

        return $this->run($r, function ($c) use ($id, $d) {
            $this->svc->updateQuestion($c, $id, $d);

            return null;
        }, 'Đã cập nhật câu hỏi');
    }

    public function destroyQuestion(Request $r, int $id)
    {
        return $this->run($r, function ($c) use ($id) {
            $this->svc->deleteQuestion($c, $id);

            return null;
        }, 'Đã xóa câu hỏi');
    }

    /* ---------------- Đề kiểm tra ---------------- */

    public function generatePaper(Request $r)
    {
        $d = $r->validate([
            'subject_id' => 'required|integer', 'grade' => 'required|integer|between:10,12',
            'matrix' => 'required|array', 'matrix.easy' => 'nullable|integer|min:0|max:50', 'matrix.medium' => 'nullable|integer|min:0|max:50',
            'matrix.hard' => 'nullable|integer|min:0|max:50', 'kinds' => 'nullable|array', 'kinds.*' => 'in:mcq,essay,truefalse',
            'topic' => 'nullable|string|max:120', 'exclude' => 'nullable|array', 'exclude.*' => 'integer',
        ]);

        return $this->run($r, fn ($c) => $this->svc->generatePaper($c, $d));
    }

    public function papers(Request $r)
    {
        return $this->run($r, fn ($c) => $this->svc->papers($c));
    }

    public function storePaper(Request $r)
    {
        $d = $r->validate([
            'title' => 'required|string|max:150', 'subject_id' => 'required|integer', 'grade' => 'required|integer|between:10,12',
            'duration_minutes' => 'required|integer|between:5,240',
            'items' => 'required|array|min:1|max:100', 'items.*.question_id' => 'required|integer', 'items.*.points' => 'required|numeric|between:0.1,10',
        ]);

        return $this->run($r, fn ($c) => $this->svc->createPaper($c, $d), 'Đã lưu đề', 201);
    }

    public function showPaper(Request $r, int $id)
    {
        return $this->run($r, fn ($c) => $this->svc->paper($c, $id));
    }

    public function destroyPaper(Request $r, int $id)
    {
        return $this->run($r, function ($c) use ($id) {
            $this->svc->deletePaper($c, $id);

            return null;
        }, 'Đã xóa đề');
    }
}
