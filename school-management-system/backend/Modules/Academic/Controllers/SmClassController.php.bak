<?php

namespace Modules\Academic\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Academic\Exceptions\ClassException;
use Modules\Academic\Requests\SaveSmClassRequest;
use Modules\Academic\Services\SmClassService;

/** API quản lý lớp học: /api/v1/academic/class-management */
class SmClassController extends Controller
{
    use ApiResponse;

    public function __construct(private SmClassService $service) {}

    /** Bọc xử lý, chuyển ClassException thành JSON lỗi chuẩn. */
    private function run(callable $fn, string $message = 'OK', int $code = 200): JsonResponse
    {
        try {
            return $this->success($fn(), $message, $code);
        } catch (ClassException $e) {
            return $this->error($e->getMessage(), $e->getCode() ?: 422, $e->errors);
        }
    }

    private function uid(Request $r): ?int
    {
        return $r->user()?->id;
    }

    public function meta(Request $r)
    {
        return $this->run(fn () => $this->service->meta($r->integer('school_year_id') ?: null));
    }

    public function stats(Request $r)
    {
        $r->validate(['school_year_id' => 'required|integer']);
        return $this->run(fn () => $this->service->stats($r->integer('school_year_id')));
    }

    public function index(Request $r)
    {
        return $this->run(fn () => $this->service->list(
            $r->only(['school_year_id', 'grade', 'status', 'q', 'homeroom', 'sort', 'dir']), paginate_limit(12)
        ));
    }

    public function store(SaveSmClassRequest $r)
    {
        return $this->run(fn () => $this->service->create($r->validated(), $this->uid($r)), 'Tạo lớp học thành công', 201);
    }

    public function show(int $id)
    {
        return $this->run(fn () => $this->service->show($id));
    }

    public function update(SaveSmClassRequest $r, int $id)
    {
        return $this->run(fn () => $this->service->update($id, $r->validated(), $this->uid($r)), 'Cập nhật lớp học thành công');
    }

    public function destroy(Request $r, int $id)
    {
        return $this->run(function () use ($r, $id) {
            $this->service->delete($id, $this->uid($r));
            return null;
        }, 'Đã xóa lớp học');
    }

    public function homeroom(Request $r, int $id)
    {
        $d = $r->validate(['teacher_id' => 'nullable|integer|exists:sm_teachers,id']);
        return $this->run(fn () => $this->service->assignHomeroom($id, $d['teacher_id'] ?? null, $this->uid($r)), 'Đã cập nhật giáo viên chủ nhiệm');
    }

    public function bulk(Request $r)
    {
        $d = $r->validate([
            'school_year_id' => 'required|integer|exists:sm_school_years,id',
            'grade'          => 'required|integer|in:10,11,12',
            'prefix'         => 'required|string|max:3',
            'start'          => 'required|integer|min:1|max:50',
            'count'          => 'required|integer|min:1|max:20',
            'capacity'       => 'required|integer|between:10,60',
        ]);
        return $this->run(fn () => $this->service->bulkCreate($d, $this->uid($r)), 'Đã tạo lớp hàng loạt', 201);
    }

    public function cloneYear(Request $r)
    {
        $d = $r->validate([
            'from_year_id'  => 'required|integer|exists:sm_school_years,id',
            'to_year_id'    => 'required|integer|exists:sm_school_years,id',
            'promote'       => 'boolean',
            'copy_subjects' => 'boolean',
        ]);
        return $this->run(fn () => $this->service->cloneYear($d, $this->uid($r)), 'Đã sao chép cơ cấu lớp');
    }

    public function export(Request $r)
    {
        $r->validate(['school_year_id' => 'required|integer']);
        $rows = $this->service->exportRows($r->integer('school_year_id'));

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM để Excel đọc đúng tiếng Việt
            foreach ($rows as $row) {
                fputcsv($out, $row);
            }
            fclose($out);
        }, 'danh-sach-lop-hoc.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /* ----- Học sinh ----- */

    public function students(Request $r, int $id)
    {
        return $this->run(fn () => $this->service->students($id, $r->only(['q', 'gender'])));
    }

    public function availableStudents(Request $r, int $id)
    {
        return $this->run(fn () => $this->service->availableStudents($id, $r->query('q')));
    }

    public function addStudents(Request $r, int $id)
    {
        $d = $r->validate(['student_ids' => 'required|array|min:1|max:100', 'student_ids.*' => 'integer|exists:sm_students,id']);
        return $this->run(fn () => $this->service->addStudents($id, $d['student_ids'], $this->uid($r)), 'Đã thêm học sinh vào lớp');
    }

    public function removeStudent(Request $r, int $id, int $studentId)
    {
        return $this->run(function () use ($r, $id, $studentId) {
            $this->service->removeStudent($id, $studentId, $this->uid($r));
            return null;
        }, 'Đã xóa học sinh khỏi lớp');
    }

    public function transfer(Request $r, int $id)
    {
        $d = $r->validate([
            'student_ids'     => 'required|array|min:1',
            'student_ids.*'   => 'integer',
            'target_class_id' => 'required|integer|exists:sm_classes,id',
        ]);
        return $this->run(fn () => $this->service->transferStudents($id, $d['student_ids'], (int) $d['target_class_id'], $this->uid($r)), 'Đã chuyển lớp');
    }

    /* ----- Môn học / TKB / nhật ký ----- */

    public function subjects(int $id)
    {
        return $this->run(fn () => $this->service->subjects($id));
    }

    public function saveSubjects(Request $r, int $id)
    {
        $d = $r->validate([
            'assignments'                => 'present|array',
            'assignments.*.subject_id'   => 'required|integer|exists:sm_subjects,id',
            'assignments.*.teacher_id'   => 'required|integer|exists:sm_teachers,id',
        ]);
        return $this->run(fn () => $this->service->saveSubjects($id, $d['assignments'], $this->uid($r)), 'Đã lưu phân công môn học');
    }

    public function timetable(int $id)
    {
        return $this->run(fn () => $this->service->timetable($id));
    }

    public function saveTimetable(Request $r, int $id)
    {
        $d = $r->validate([
            'slots'                    => 'required|array|min:1',
            'slots.*.weekday'          => 'required|integer|between:2,7',
            'slots.*.period'           => 'required|integer|between:1,10',
            'slots.*.class_subject_id' => 'nullable|integer',
        ]);
        return $this->run(fn () => $this->service->saveTimetable($id, $d['slots'], $this->uid($r)), 'Đã lưu thời khóa biểu');
    }

    public function activity(int $id)
    {
        return $this->run(fn () => $this->service->activity($id));
    }
}
