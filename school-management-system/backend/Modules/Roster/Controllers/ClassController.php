<?php

namespace Modules\Roster\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Roster\Services\ClassService;
use Modules\Roster\Services\RosterSupport;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ClassController extends Controller
{
    use ApiResponse;

    public function __construct(private ClassService $service, private RosterSupport $support) {}

    private function rules(): array
    {
        return ['grade' => 'required|integer|between:10,12', 'name' => 'required|string|max:10', 'homeroom_teacher_id' => 'nullable|integer'];
    }

    public function index(Request $request): JsonResponse
    {
        $year = $this->support->resolveYear($request->integer('year_id') ?: null);

        return $this->success(['year_id' => $year, 'items' => $this->service->list($year, $request->only(['grade', 'search', 'filter']))]);
    }

    public function show(int $id): JsonResponse
    {
        return $this->success($this->service->show($id));
    }

    public function store(Request $request): JsonResponse
    {
        $d = $request->validate($this->rules() + ['school_year_id' => 'required|integer']);

        return $this->success($this->service->create($d), 'Đã tạo lớp ' . $d['name'], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return $this->success($this->service->update($id, $request->validate($this->rules())), 'Đã cập nhật lớp học');
    }

    public function destroy(int $id): JsonResponse
    {
        $this->service->delete($id);

        return $this->success(null, 'Đã xóa lớp học');
    }

    public function setSubject(Request $request, int $id, int $subjectId): JsonResponse
    {
        $d = $request->validate(['teacher_id' => 'required|integer']);

        return $this->success($this->service->setSubjectTeacher($id, $subjectId, (int) $d['teacher_id']), 'Đã cập nhật giáo viên bộ môn');
    }

    public function removeSubject(int $id, int $subjectId): JsonResponse
    {
        return $this->success($this->service->removeSubject($id, $subjectId), 'Đã gỡ môn khỏi lớp');
    }

    public function export(int $id): StreamedResponse
    {
        $r = $this->service->exportRoster($id);

        return response()->streamDownload(function () use ($r) {
            $o = fopen('php://output', 'w');
            fwrite($o, "\xEF\xBB\xBF");
            fputcsv($o, ['STT', 'Mã HS', 'Họ tên', 'Giới tính', 'Ngày sinh']);
            foreach ($r['rows'] as $i => $s) {
                fputcsv($o, [$i + 1, $s['code'], $s['full_name'], $s['gender'], $s['birth_date']]);
            }
            fclose($o);
        }, 'danh_sach_lop_' . $r['name'] . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
