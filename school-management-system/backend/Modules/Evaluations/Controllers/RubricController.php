<?php

namespace Modules\Evaluations\Controllers;

use Illuminate\Http\Request;
use Modules\Evaluations\Support\EvalAudit;

class RubricController extends BaseController
{
    public function index()
    {
        return $this->success($this->repo->rubrics());
    }

    public function show(int $id)
    {
        $r = $this->repo->rubric($id);
        return $r ? $this->success($r) : $this->error('Không tìm thấy mẫu phiếu', 404);
    }

    private function criteria(Request $r)
    {
        $list = $r->input('criteria');
        if (! is_array($list) || ! count($list)) return [null, $this->error('Mẫu phiếu cần ít nhất 1 tiêu chí', 422)];
        $out = [];
        foreach ($list as $i => $c) {
            $n = $i + 1;
            $name = trim((string) ($c['name'] ?? '')); $group = trim((string) ($c['group_name'] ?? ''));
            $w = $c['weight'] ?? null; $max = (int) ($c['max_score'] ?? 4);
            if ($name === '' || $group === '') return [null, $this->error("Tiêu chí #$n thiếu tên hoặc nhóm", 422)];
            if (! is_numeric($w) || $w <= 0 || $w > 100) return [null, $this->error("Tiêu chí #$n: trọng số phải từ 0 đến 100", 422)];
            if ($max < 2 || $max > 10) return [null, $this->error("Tiêu chí #$n: thang điểm tối đa từ 2 đến 10", 422)];
            $out[] = ['group_name' => mb_substr($group, 0, 120), 'name' => mb_substr($name, 0, 200), 'description' => $this->nullable(mb_substr((string) ($c['description'] ?? ''), 0, 400)), 'weight' => (float) $w, 'max_score' => $max];
        }
        return [$out, null];
    }

    public function store(Request $r)
    {
        if ($e = $this->check($r->all(), ['code' => 'required|max:30|regex:/^[A-Za-z0-9_-]+$/', 'name' => 'required|max:160', 'description' => 'nullable|max:500'], ['regex' => 'Mã chỉ gồm chữ, số, gạch nối'])) return $e;
        if ($this->repo->rubricCodeExists($r->input('code'))) return $this->error('Mã mẫu phiếu đã tồn tại', 409);
        [$c, $err] = $this->criteria($r); if ($err) return $err;
        $id = $this->repo->saveRubric(null, ['code' => strtoupper($r->input('code')), 'name' => trim($r->input('name')), 'description' => $this->nullable($r->input('description'))], $c, $this->name($r));
        EvalAudit::log('rubric.create', 'ev_rubric', $id, $r->input('name'), 'Tạo mẫu phiếu dự giờ "' . $r->input('name') . '" (' . count($c) . ' tiêu chí)', null, ['criteria' => count($c)]);
        return $this->success($this->repo->rubric($id), 'Đã tạo mẫu phiếu', 201);
    }

    public function update(Request $r, int $id)
    {
        $old = $this->repo->rubric($id);
        if (! $old) return $this->error('Không tìm thấy mẫu phiếu', 404);
        if ($e = $this->check($r->all(), ['name' => 'required|max:160', 'description' => 'nullable|max:500'])) return $e;
        $c = null;
        if ($r->has('criteria')) {
            if ($old['used_count'] > 0) return $this->error("Mẫu này đã dùng cho {$old['used_count']} phiếu — không sửa tiêu chí để tránh làm sai điểm cũ. Hãy nhân bản thành mẫu mới.", 409);
            [$c, $err] = $this->criteria($r); if ($err) return $err;
        }
        $this->repo->saveRubric($id, ['name' => trim($r->input('name')), 'description' => $this->nullable($r->input('description'))], $c, $this->name($r));
        EvalAudit::log('rubric.update', 'ev_rubric', $id, $old['name'], 'Sửa mẫu phiếu "' . $old['name'] . '"', ['name' => $old['name']], ['name' => $r->input('name'), 'criteria' => $c ? count($c) : 'giữ nguyên']);
        return $this->success($this->repo->rubric($id), 'Đã cập nhật mẫu phiếu');
    }

    public function toggle(Request $r, int $id)
    {
        $old = $this->repo->rubric($id);
        if (! $old) return $this->error('Không tìm thấy mẫu phiếu', 404);
        $on = ! (bool) $old['is_active'];
        if (! $on && (int) ($this->repo->settings()['default_rubric_id'] ?? 0) === $id) return $this->error('Đây là mẫu mặc định, hãy chọn mẫu mặc định khác trong Cài đặt trước', 409);
        $this->repo->setRubricActive($id, $on);
        EvalAudit::log('rubric.toggle', 'ev_rubric', $id, $old['name'], ($on ? 'Bật' : 'Tắt') . ' mẫu phiếu "' . $old['name'] . '"', ['is_active' => (int) $old['is_active']], ['is_active' => (int) $on], 'notice');
        return $this->success($this->repo->rubric($id), $on ? 'Đã bật mẫu phiếu' : 'Đã tắt mẫu phiếu');
    }

    public function destroy(Request $r, int $id)
    {
        $old = $this->repo->rubric($id);
        if (! $old) return $this->error('Không tìm thấy mẫu phiếu', 404);
        if ($old['used_count'] > 0) return $this->error('Mẫu đã được dùng cho phiếu dự giờ, chỉ có thể tắt chứ không xoá', 409);
        if ((int) ($this->repo->settings()['default_rubric_id'] ?? 0) === $id) return $this->error('Không xoá được mẫu mặc định', 409);
        $this->repo->deleteRubric($id);
        EvalAudit::log('rubric.delete', 'ev_rubric', $id, $old['name'], 'Xoá mẫu phiếu "' . $old['name'] . '"', ['name' => $old['name']], null, 'warning');
        return $this->success(null, 'Đã xoá mẫu phiếu');
    }
}
