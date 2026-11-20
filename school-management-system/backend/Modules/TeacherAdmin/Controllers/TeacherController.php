<?php

namespace Modules\TeacherAdmin\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\TeacherAdmin\Requests\TeacherRequest;
use Modules\TeacherAdmin\Services\TeacherService;
use Modules\TeacherAdmin\Support\Audit;

class TeacherController extends Controller
{
    use ApiResponse;

    public function __construct(private TeacherService $svc) {}

    private function year(Request $r): int
    {
        return Audit::yearId($r->integer('school_year_id') ?: null);
    }

    public function meta(Request $r)
    {
        return $this->success($this->svc->meta($this->year($r)));
    }

    public function index(Request $r)
    {
        return $this->success($this->svc->list($r->all(), $this->year($r)));
    }

    public function show(Request $r, int $id)
    {
        $d = $this->svc->show($id, $this->year($r));

        return $d ? $this->success($d) : $this->error('Không tìm thấy giáo viên', 404);
    }

    public function store(TeacherRequest $r)
    {
        return $this->success(['id' => $this->svc->create($r->validated())], 'Đã thêm giáo viên', 201);
    }

    public function update(TeacherRequest $r, int $id)
    {
        return $this->svc->update($id, $r->validated()) ? $this->success(['id' => $id], 'Đã cập nhật') : $this->error('Không tìm thấy giáo viên', 404);
    }

    public function destroy(int $id)
    {
        [$ok, $msg] = $this->svc->delete($id);

        return $ok ? $this->success(null, $msg) : $this->error($msg, 422);
    }

    public function bulk(Request $r)
    {
        $d = $r->validate(['ids' => 'required|array|min:1', 'ids.*' => 'integer', 'action' => 'required|string', 'value' => 'nullable|string']);

        return $this->success($this->svc->bulk($d['ids'], $d['action'], $d['value'] ?? null), 'Đã thực hiện');
    }

    public function export()
    {
        return $this->success($this->svc->export());
    }

    public function import(Request $r)
    {
        $d = $r->validate(['rows' => 'required|array|min:1|max:2000', 'dry_run' => 'boolean']);

        return $this->success($this->svc->import($d['rows'], (bool) ($d['dry_run'] ?? false)));
    }

    public function addCert(Request $r, int $id)
    {
        $d = $r->validate(['name' => 'required|string|max:120', 'issuer' => 'nullable|string|max:120', 'issued_at' => 'nullable|date', 'expires_at' => 'nullable|date']);

        return $this->success(['id' => $this->svc->addCert($id, $d)], 'Đã thêm chứng chỉ', 201);
    }

    public function deleteCert(int $id)
    {
        return $this->svc->deleteCert($id) ? $this->success(null, 'Đã xóa chứng chỉ') : $this->error('Không tìm thấy', 404);
    }

    public function audit(Request $r)
    {
        return $this->success($this->svc->audit($r->integer('teacher_id') ?: null, min(300, max(10, $r->integer('limit') ?: 100))));
    }
}
