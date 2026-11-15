<?php

namespace Modules\Rewards\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Modules\Rewards\Services\EmulationLogger;

/** Danh mục danh hiệu khen thưởng (kèm mức điểm thưởng thi đua mặc định) */
class AwardTypeController extends Controller
{
    private function rules(?int $id = null): array
    {
        return [
            'code' => ['required', 'string', 'max:12', Rule::unique('sm_rw_award_types', 'code')->ignore($id)],
            'name' => 'required|string|max:150',
            'level' => 'required|in:Lớp,Khối,Trường,Cấp trên',
            'target_type' => 'required|in:class,student,both',
            'bonus_points' => 'nullable|numeric|min:0|max:50',
            'description' => 'nullable|string|max:255',
            'sort_order' => 'nullable|integer|min:0|max:999',
        ];
    }

    private function payload(array $v): array
    {
        return [
            'code' => strtoupper($v['code']), 'name' => $v['name'], 'level' => $v['level'], 'target_type' => $v['target_type'],
            // Điểm thưởng chỉ có nghĩa với tập thể lớp
            'bonus_points' => $v['target_type'] === 'student' ? 0 : (float) ($v['bonus_points'] ?? 0),
            'description' => $v['description'] ?? null, 'sort_order' => $v['sort_order'] ?? 0,
        ];
    }

    public function index(): JsonResponse
    {
        return response()->json(
            DB::table('sm_rw_award_types as t')
                ->selectRaw('t.*, (SELECT COUNT(*) FROM sm_rw_awards a WHERE a.type_id = t.id) AS used')
                ->orderBy('t.sort_order')->orderBy('t.id')->get()
        );
    }

    public function store(Request $r): JsonResponse
    {
        $v = $r->validate($this->rules());
        $id = DB::table('sm_rw_award_types')->insertGetId($this->payload($v) + ['is_active' => 1, 'created_at' => now(), 'updated_at' => now()]);
        EmulationLogger::log($r->user(), 'award_type', "Thêm danh hiệu {$v['code']} · {$v['name']}");
        return response()->json(['message' => 'Đã thêm danh hiệu.', 'id' => $id], 201);
    }

    public function update(Request $r, int $id): JsonResponse
    {
        abort_if(!DB::table('sm_rw_award_types')->where('id', $id)->exists(), 404, 'Không tìm thấy danh hiệu.');
        $v = $r->validate($this->rules($id));
        DB::table('sm_rw_award_types')->where('id', $id)->update($this->payload($v) + ['updated_at' => now()]);
        EmulationLogger::log($r->user(), 'award_type', "Sửa danh hiệu {$v['code']} · {$v['name']}");
        return response()->json(['message' => 'Đã cập nhật danh hiệu.']);
    }

    public function toggle(Request $r, int $id): JsonResponse
    {
        $t = DB::table('sm_rw_award_types')->where('id', $id)->first();
        abort_if(!$t, 404, 'Không tìm thấy danh hiệu.');
        $next = $t->is_active ? 0 : 1;
        DB::table('sm_rw_award_types')->where('id', $id)->update(['is_active' => $next, 'updated_at' => now()]);
        EmulationLogger::log($r->user(), 'award_type', ($next ? 'Bật' : 'Tắt') . " danh hiệu {$t->code}");
        return response()->json(['message' => $next ? 'Đã bật danh hiệu.' : 'Đã ngừng áp dụng danh hiệu.']);
    }

    public function destroy(Request $r, int $id): JsonResponse
    {
        $t = DB::table('sm_rw_award_types')->where('id', $id)->first();
        abort_if(!$t, 404, 'Không tìm thấy danh hiệu.');
        if (DB::table('sm_rw_awards')->where('type_id', $id)->exists()) {
            return response()->json(['message' => 'Danh hiệu đã được dùng trong các đề xuất, hãy chuyển sang ngừng áp dụng.'], 409);
        }
        DB::table('sm_rw_award_types')->where('id', $id)->delete();
        EmulationLogger::log($r->user(), 'award_type', "Xóa danh hiệu {$t->code} · {$t->name}");
        return response()->json(['message' => 'Đã xóa danh hiệu.']);
    }
}
