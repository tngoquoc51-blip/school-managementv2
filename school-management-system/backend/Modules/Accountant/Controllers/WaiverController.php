<?php

namespace Modules\Accountant\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Accountant\Services\FinanceService as F;

class WaiverController extends BaseController
{
    public function index(Request $request, int $id)
    {
        F::findStudent($id);
        $rows = DB::table('sm_fee_waivers as w')->join('sm_school_years as y', 'y.id', '=', 'w.school_year_id')
            ->where('w.student_id', $id)->orderByDesc('w.school_year_id')->orderByDesc('w.id')
            ->get(['w.id', 'w.school_year_id', 'y.label as year_label', 'w.kind', 'w.label', 'w.percent', 'w.note', 'w.approved_by', 'w.created_at']);
        return $this->ok($rows);
    }

    private function rules(): array
    {
        return [
            'school_year_id' => 'required|integer|exists:sm_school_years,id',
            'kind' => 'required|string|max:30|regex:/^[a-z0-9_]+$/',
            'label' => 'nullable|string|max:120',
            'percent' => 'required|integer|min:1|max:100',
            'note' => 'nullable|string|max:255',
        ];
    }

    public function store(Request $request, int $id)
    {
        F::findStudent($id);
        $d = $this->validated($request, $this->rules());
        $label = trim($d['label'] ?? '') ?: (MetaController::WAIVER_KINDS[$d['kind']] ?? $d['kind']);

        if (DB::table('sm_fee_waivers')->where('student_id', $id)->where('school_year_id', $d['school_year_id'])->where('kind', $d['kind'])->exists()) {
            return $this->fail('Học sinh đã có diện miễn giảm này trong năm học đã chọn.');
        }
        $wid = DB::table('sm_fee_waivers')->insertGetId([
            'student_id' => $id, 'school_year_id' => $d['school_year_id'], 'kind' => $d['kind'], 'label' => $label,
            'percent' => $d['percent'], 'note' => $d['note'] ?? null, 'approved_by' => $this->actor($request),
            'created_at' => now()->format('Y-m-d H:i:s'),
        ]);
        return $this->ok(['id' => $wid], 'Đã thêm diện miễn giảm', 201);
    }

    public function update(Request $request, int $id)
    {
        $w = DB::table('sm_fee_waivers')->where('id', $id)->first();
        if (! $w) {
            return $this->fail('Không tìm thấy diện miễn giảm.', 404);
        }
        $d = $this->validated($request, [
            'label' => 'required|string|max:120', 'percent' => 'required|integer|min:1|max:100', 'note' => 'nullable|string|max:255',
        ]);
        DB::table('sm_fee_waivers')->where('id', $id)->update([
            'label' => $d['label'], 'percent' => $d['percent'], 'note' => $d['note'] ?? null, 'approved_by' => $this->actor($request),
        ]);
        return $this->ok(null, 'Đã cập nhật miễn giảm');
    }

    public function destroy(int $id)
    {
        if (! DB::table('sm_fee_waivers')->where('id', $id)->delete()) {
            return $this->fail('Không tìm thấy diện miễn giảm.', 404);
        }
        return $this->ok(null, 'Đã xóa diện miễn giảm');
    }
}
