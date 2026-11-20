<?php

namespace Modules\Roster\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Roster\Services\RosterSupport;
use Modules\Roster\Services\StudentService;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StudentController extends Controller
{
    use ApiResponse;

    private const FILTERS = ['search', 'class_id', 'grade', 'gender', 'placement', 'account', 'admission_year', 'sort', 'dir'];

    public function __construct(private StudentService $service, private RosterSupport $support) {}

    private function year(Request $r): int
    {
        return $this->support->resolveYear($r->integer('year_id') ?: null);
    }

    public function index(Request $request): JsonResponse
    {
        $page = $this->service->paginate($this->year($request), $request->only(self::FILTERS), max(5, min((int) $request->query('per_page', 15), 100)));

        return $this->success([
            'items' => $page->getCollection()->values()->all(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $reveal = $request->boolean('reveal');
        if ($reveal) {
            $this->service->auditReveal($id);
        }

        return $this->success($this->service->show($id, $this->year($request), $reveal));
    }

    public function store(Request $request): JsonResponse
    {
        $d = $request->validate([
            'full_name' => 'required|string|max:80', 'gender' => 'required|in:Nam,Nữ', 'birth_date' => 'required|date|before:today',
            'admission_year' => 'required|integer|between:2000,2100', 'code' => 'nullable|string|max:12', 'class_id' => 'nullable|integer',
            'school_year_id' => 'nullable|integer', 'create_account' => 'boolean',
        ]);

        return $this->success($this->service->create($d), 'Đã thêm học sinh ' . $d['full_name'], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $d = $request->validate([
            'full_name' => 'required|string|max:80', 'gender' => 'required|in:Nam,Nữ', 'birth_date' => 'required|date|before:today', 'admission_year' => 'required|integer|between:2000,2100',
            'profile' => 'nullable|array', 'profile.*' => 'nullable', 'pii' => 'nullable|array', 'pii.*' => 'nullable|string|max:1000',
        ]);
        $this->service->update($id, $d);

        return $this->success(null, 'Đã lưu hồ sơ học sinh');
    }

    public function destroy(int $id): JsonResponse
    {
        $this->service->delete($id);

        return $this->success(null, 'Đã xóa học sinh');
    }

    public function enroll(Request $request, int $id): JsonResponse
    {
        $d = $request->validate(['class_id' => 'required|integer', 'year_id' => 'required|integer']);
        $r = $this->service->enroll($id, (int) $d['class_id'], (int) $d['year_id']);

        return $this->success(['result' => $r], ['same' => 'Học sinh đã ở lớp này', 'enrolled' => 'Đã xếp lớp', 'transferred' => 'Đã chuyển lớp'][$r]);
    }

    public function unenroll(Request $request, int $id): JsonResponse
    {
        $this->service->unenroll($id, $this->year($request));

        return $this->success(null, 'Đã gỡ học sinh khỏi lớp');
    }

    public function bulkEnroll(Request $request): JsonResponse
    {
        $d = $request->validate(['student_ids' => 'required|array|min:1|max:500', 'student_ids.*' => 'integer', 'class_id' => 'required|integer', 'year_id' => 'required|integer']);
        $r = $this->service->bulkEnroll($d['student_ids'], (int) $d['class_id'], (int) $d['year_id']);

        return $this->success($r, "Đã xếp {$r['processed']} học sinh" . ($r['skipped'] ? ', bỏ qua ' . count($r['skipped']) : ''));
    }

    public function autoAssign(Request $request): JsonResponse
    {
        $d = $request->validate(['year_id' => 'required|integer', 'grade' => 'required|integer|between:10,12', 'student_ids' => 'nullable|array', 'student_ids.*' => 'integer']);
        $r = $this->service->autoAssign((int) $d['year_id'], (int) $d['grade'], $d['student_ids'] ?? null);

        return $this->success($r, "Đã xếp tự động {$r['assigned']} học sinh vào khối {$d['grade']}");
    }

    public function export(Request $request): StreamedResponse
    {
        $rows = $this->service->export($this->year($request), $request->only(self::FILTERS));

        return response()->streamDownload(function () use ($rows) {
            $o = fopen('php://output', 'w');
            fwrite($o, "\xEF\xBB\xBF");
            fputcsv($o, ['Mã HS', 'Họ tên', 'Giới tính', 'Ngày sinh', 'Khóa', 'Lớp', 'Tên đăng nhập', 'Trạng thái tài khoản']);
            foreach ($rows as $r) {
                fputcsv($o, [$r['code'], $r['full_name'], $r['gender'], $r['birth_date'], $r['admission_year'], $r['class_name'], $r['username'], $r['account_status']]);
            }
            fclose($o);
        }, 'hoc_sinh_' . date('Ymd_His') . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
