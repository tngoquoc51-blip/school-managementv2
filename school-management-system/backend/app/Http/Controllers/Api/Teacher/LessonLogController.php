<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Services\LessonLog\LessonLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** API Sổ đầu bài – nằm trong nhóm route gv/teacher/lesson-log (middleware StaffToken). */
class LessonLogController extends Controller
{
    public function __construct(private LessonLogService $svc) {}

    private function actor(Request $r): array
    {
        $p = (array) ($r->attributes->get('staff') ?? $r->attributes->get('sm_staff') ?? []);
        abort_unless($p, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
        $a = ['id' => (int) ($p['id'] ?? 0), 'name' => (string) ($p['full_name'] ?? $p['name'] ?? 'Giáo viên'), 'role' => strtolower((string) ($p['role'] ?? ''))];
        abort_unless($this->svc->allowed($a), 403, 'Vai trò hiện tại không được dùng Sổ đầu bài.');

        return $a;
    }

    private function ok($data = null, string $message = 'OK', array $extra = [], int $code = 200): JsonResponse
    {
        return response()->json(array_merge(['data' => $data, 'message' => $message], $extra), $code);
    }

    private function run(callable $fn): JsonResponse
    {
        try {
            return $fn();
        } catch (ValidationException $e) {
            return response()->json(['message' => collect($e->errors())->flatten()->first() ?? 'Dữ liệu không hợp lệ.', 'errors' => $e->errors()], 422);
        }
    }

    private function rules(bool $create): array
    {
        $r = [
            'subject_name' => [$create ? 'required' : 'sometimes', 'string', 'max:120'],
            'lesson_no' => ['nullable', 'integer', 'min:1', 'max:999'], 'title' => ['nullable', 'string', 'max:255'],
            'content' => ['nullable', 'string', 'max:5000'], 'equipment' => ['nullable', 'string', 'max:255'], 'homework' => ['nullable', 'string', 'max:2000'],
            'rating' => ['nullable', Rule::in(array_keys(config('lesson_log.ratings')))], 'remark' => ['nullable', 'string', 'max:2000'],
            'discipline_note' => ['nullable', 'string', 'max:2000'], 'absences' => ['sometimes', 'array', 'max:200'],
            'absences.*.student_id' => ['required', 'integer'], 'absences.*.type' => ['required', 'string'], 'absences.*.reason' => ['nullable', 'string', 'max:255'],
        ];
        if ($create) {
            $r += ['class_id' => ['required', 'integer'], 'lesson_date' => ['required', 'date'], 'period' => ['required', 'integer', 'between:1,12']];
        }

        return $r;
    }

    private const MSG = ['subject_name.required' => 'Vui lòng chọn môn học.', 'class_id.required' => 'Vui lòng chọn lớp.', 'lesson_date.required' => 'Vui lòng chọn ngày.', 'period.required' => 'Vui lòng chọn tiết.'];

    public function meta(Request $r): JsonResponse
    {
        return $this->ok($this->svc->meta($this->actor($r)));
    }

    public function students(Request $r): JsonResponse
    {
        $this->actor($r);
        $v = $r->validate(['class_id' => 'required|integer']);

        return $this->ok($this->svc->roster((int) $v['class_id']));
    }

    public function week(Request $r): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate(['class_id' => 'required|integer', 'date' => 'nullable|date']);

        return $this->ok($this->svc->week((int) $v['class_id'], $v['date'] ?? now()->toDateString(), $a));
    }

    public function index(Request $r): JsonResponse
    {
        $a = $this->actor($r);
        $res = $this->svc->list($r->only(['class_id', 'teacher_id', 'subject', 'status', 'rating', 'from', 'to', 'q', 'page', 'per_page']) + ['mine' => $r->boolean('mine'), 'all' => $r->boolean('all')], $a);

        return $this->ok($res['rows'], 'OK', ['meta' => $res['meta']]);
    }

    public function stats(Request $r): JsonResponse
    {
        $a = $this->actor($r);

        return $this->ok($this->svc->stats($r->only(['from', 'to', 'class_id']) + ['mine' => $r->boolean('mine')], $a));
    }

    public function show(Request $r, int $id): JsonResponse
    {
        $d = $this->svc->show($id, $this->actor($r));

        return $d ? $this->ok($d) : response()->json(['message' => 'Không tìm thấy bản ghi.'], 404);
    }

    public function store(Request $r): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate($this->rules(true), self::MSG);

        return $this->run(fn () => $this->ok(['id' => $this->svc->store($v, $a)], 'Đã ghi sổ tiết học.', [], 201));
    }

    public function update(Request $r, int $id): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate($this->rules(false), self::MSG);

        return $this->run(function () use ($id, $v, $a) {
            $this->svc->update($id, $v, $a);

            return $this->ok(null, 'Đã lưu thay đổi.');
        });
    }

    public function destroy(Request $r, int $id): JsonResponse
    {
        $a = $this->actor($r);

        return $this->run(function () use ($id, $a) {
            $this->svc->destroy($id, $a);

            return $this->ok(null, 'Đã xóa bản ghi.');
        });
    }

    public function sign(Request $r, int $id): JsonResponse
    {
        $a = $this->actor($r);

        return $this->run(function () use ($id, $a) {
            $this->svc->sign($id, $a);

            return $this->ok(null, 'Đã ký sổ.');
        });
    }

    public function unsign(Request $r, int $id): JsonResponse
    {
        $a = $this->actor($r);

        return $this->run(function () use ($id, $a) {
            $this->svc->unsign($id, $a);

            return $this->ok(null, 'Đã hủy ký sổ.');
        });
    }

    public function reopen(Request $r, int $id): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate(['reason' => 'required|string|max:255'], ['reason.required' => 'Vui lòng nhập lý do mở lại.']);

        return $this->run(function () use ($id, $v, $a) {
            $this->svc->reopen($id, $v['reason'], $a);

            return $this->ok(null, 'Đã mở lại để chỉnh sửa.');
        });
    }

    public function comment(Request $r, int $id): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate(['body' => 'required|string|max:1000'], ['body.required' => 'Vui lòng nhập nội dung.']);

        return $this->run(function () use ($id, $v, $a) {
            $this->svc->comment($id, $v['body'], $a);

            return $this->ok(null, 'Đã gửi ý kiến.', [], 201);
        });
    }

    public function homeroomNote(Request $r, int $id): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate(['note' => 'nullable|string|max:1000']);

        return $this->run(function () use ($id, $v, $a) {
            $this->svc->homeroomNote($id, $v['note'] ?? null, $a);

            return $this->ok(null, 'Đã ghi ý kiến chủ nhiệm.');
        });
    }

    public function confirmWeek(Request $r): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate(['class_id' => 'required|integer', 'date' => 'required|date', 'note' => 'nullable|string|max:500', 'force' => 'nullable|boolean']);

        return $this->run(fn () => $this->ok($this->svc->confirmWeek((int) $v['class_id'], $v['date'], $v['note'] ?? null, (bool) ($v['force'] ?? false), $a), 'Đã xác nhận sổ tuần.'));
    }

    public function reopenWeek(Request $r): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate(['class_id' => 'required|integer', 'date' => 'required|date']);

        return $this->run(fn () => $this->ok(['reopened' => $this->svc->reopenWeek((int) $v['class_id'], $v['date'], $a)], 'Đã mở lại sổ tuần.'));
    }

    public function export(Request $r)
    {
        $a = $this->actor($r);
        $rows = $this->svc->list($r->only(['class_id', 'teacher_id', 'subject', 'status', 'from', 'to', 'q']) + ['mine' => $r->boolean('mine'), 'all' => true], $a)['rows'];
        $st = ['draft' => 'Nháp', 'signed' => 'Đã ký', 'confirmed' => 'GVCN đã xác nhận'];
        $rt = (array) config('lesson_log.ratings');

        return response()->streamDownload(function () use ($rows, $st, $rt) {
            $o = fopen('php://output', 'w');
            fwrite($o, "\xEF\xBB\xBF");
            fputcsv($o, ['Ngày', 'Tiết', 'Lớp', 'Môn', 'Tiết PPCT', 'Tên bài', 'Nội dung', 'Giáo viên', 'Xếp loại', 'Sĩ số', 'Vắng có phép', 'Vắng không phép', 'Đi muộn', 'Vi phạm', 'Nhận xét', 'Ý kiến GVCN', 'Trạng thái']);
            foreach ($rows as $x) {
                fputcsv($o, [$x['lesson_date'], $x['period'], $x['class_name'], $x['subject_name'], $x['lesson_no'], $x['title'], $x['content'], $x['teacher_name'], $rt[$x['rating']] ?? '', $x['total_students'],
                    $x['absent_excused'], $x['absent_unexcused'], $x['late_count'], $x['discipline_note'], $x['remark'], $x['homeroom_note'], $st[$x['status']] ?? $x['status']]);
            }
            fclose($o);
        }, 'so-dau-bai_' . now()->format('Ymd') . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
