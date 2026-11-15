<?php

namespace Modules\Academic\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Academic\Exceptions\ClassException;
use Modules\Academic\Services\GradeWindowService;

/** API: /api/v1/academic/grade-windows — chỉ Quản trị/Ban giám hiệu được thao tác. */
class GradeWindowController extends Controller
{
    use ApiResponse;

    public function __construct(private GradeWindowService $service) {}

    private function run(callable $fn, string $message = 'OK'): \Illuminate\Http\JsonResponse
    {
        try {
            return $this->success($fn(), $message);
        } catch (ClassException $e) {
            return $this->error($e->getMessage(), $e->getCode() ?: 422);
        }
    }

    private function uid(Request $r): ?int
    {
        return $r->user()?->id;
    }

    public function overview(Request $r)
    {
        $r->validate(['school_year_id' => 'required|integer']);
        return $this->run(fn () => $this->service->overview($r->integer('school_year_id')));
    }

    public function open(Request $r)
    {
        $d = $r->validate([
            'school_year_id' => 'required|integer', 'semester' => 'required|integer|in:1,2',
            'closes_at' => 'nullable|date', 'note' => 'nullable|string|max:255',
        ]);
        return $this->run(fn () => $this->service->open($d['school_year_id'], $d['semester'], $d['closes_at'] ?? null, $d['note'] ?? null, $this->uid($r)), 'Đã mở kỳ nhập điểm');
    }

    public function close(Request $r)
    {
        $d = $r->validate([
            'school_year_id' => 'required|integer', 'semester' => 'required|integer|in:1,2', 'note' => 'nullable|string|max:255',
        ]);
        return $this->run(fn () => $this->service->close($d['school_year_id'], $d['semester'], $d['note'] ?? null, $this->uid($r)), 'Đã khóa kỳ nhập điểm');
    }

    public function addException(Request $r)
    {
        $d = $r->validate([
            'school_year_id' => 'required|integer', 'semester' => 'required|integer|in:1,2',
            'class_id' => 'required|integer', 'subject_id' => 'nullable|integer', 'expires_at' => 'nullable|date',
        ]);
        return $this->run(fn () => $this->service->addException($d['school_year_id'], $d['semester'], $d['class_id'], $d['subject_id'] ?? null, $d['expires_at'] ?? null, $this->uid($r)), 'Đã thêm ngoại lệ mở điểm');
    }

    public function removeException(Request $r, int $id)
    {
        $d = $r->validate(['school_year_id' => 'required|integer', 'semester' => 'required|integer|in:1,2']);
        return $this->run(fn () => $this->service->removeException($d['school_year_id'], $d['semester'], $id, $this->uid($r)), 'Đã gỡ ngoại lệ');
    }

    public function activity(Request $r)
    {
        $r->validate(['school_year_id' => 'required|integer']);
        return $this->run(fn () => $this->service->activity($r->integer('school_year_id')));
    }
}
