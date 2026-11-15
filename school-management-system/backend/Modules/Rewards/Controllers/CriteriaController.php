<?php

namespace Modules\Rewards\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Modules\Rewards\Services\EmulationLogger;

class CriteriaController extends Controller
{
    private function rules(?int $id = null): array
    {
        return [
            'code' => ['required', 'string', 'max:12', Rule::unique('sm_rw_criteria', 'code')->ignore($id)],
            'name' => 'required|string|max:150',
            'category' => 'required|in:nenep,hoctap,vesinh,laodong,phongtrao,khac',
            'type' => 'required|in:plus,minus',
            'default_points' => 'required|numeric|min:0.1|max:100',
            'description' => 'nullable|string|max:255',
            'sort_order' => 'nullable|integer|min:0|max:999',
        ];
    }

    private function payload(array $v): array
    {
        return [
            'code' => strtoupper($v['code']), 'name' => $v['name'], 'category' => $v['category'], 'type' => $v['type'],
            'default_points' => abs((float) $v['default_points']) * ($v['type'] === 'minus' ? -1 : 1),
            'description' => $v['description'] ?? null, 'sort_order' => $v['sort_order'] ?? 0,
        ];
    }

    public function index(): JsonResponse
    {
        return response()->json(
            DB::table('sm_rw_criteria as k')
                ->selectRaw('k.*, (SELECT COUNT(*) FROM sm_rw_records r WHERE r.criteria_id = k.id) AS used')
                ->orderBy('k.category')->orderBy('k.sort_order')->orderBy('k.id')->get()
        );
    }

    public function store(Request $r): JsonResponse
    {
        $v = $r->validate($this->rules());
        $id = DB::table('sm_rw_criteria')->insertGetId($this->payload($v) + ['is_active' => 1, 'created_at' => now(), 'updated_at' => now()]);
        EmulationLogger::log($r->user(), 'criteria', "Thêm tiêu chí {$v['code']} · {$v['name']}");
        return response()->json(['message' => 'Đã thêm tiêu chí.', 'id' => $id], 201);
    }

    public function update(Request $r, int $id): JsonResponse
    {
        abort_if(!DB::table('sm_rw_criteria')->where('id', $id)->exists(), 404, 'Không tìm thấy tiêu chí.');
        $v = $r->validate($this->rules($id));
        DB::table('sm_rw_criteria')->where('id', $id)->update($this->payload($v) + ['updated_at' => now()]);
        EmulationLogger::log($r->user(), 'criteria', "Sửa tiêu chí {$v['code']} · {$v['name']}");
        return response()->json(['message' => 'Đã cập nhật tiêu chí.']);
    }

    public function toggle(Request $r, int $id): JsonResponse
    {
        $k = DB::table('sm_rw_criteria')->where('id', $id)->first();
        abort_if(!$k, 404, 'Không tìm thấy tiêu chí.');
        $next = $k->is_active ? 0 : 1;
        DB::table('sm_rw_criteria')->where('id', $id)->update(['is_active' => $next, 'updated_at' => now()]);
        EmulationLogger::log($r->user(), 'criteria', ($next ? 'Bật' : 'Tắt') . " tiêu chí {$k->code} · {$k->name}");
        return response()->json(['message' => $next ? 'Đã bật áp dụng tiêu chí.' : 'Đã ngừng áp dụng tiêu chí.', 'is_active' => $next]);
    }

    public function destroy(Request $r, int $id): JsonResponse
    {
        $k = DB::table('sm_rw_criteria')->where('id', $id)->first();
        abort_if(!$k, 404, 'Không tìm thấy tiêu chí.');
        if (DB::table('sm_rw_records')->where('criteria_id', $id)->exists()) {
            return response()->json(['message' => 'Tiêu chí đã có dữ liệu chấm điểm, hãy chuyển sang "ngừng áp dụng" thay vì xóa.'], 409);
        }
        DB::table('sm_rw_criteria')->where('id', $id)->delete();
        EmulationLogger::log($r->user(), 'criteria', "Xóa tiêu chí {$k->code} · {$k->name}");
        return response()->json(['message' => 'Đã xóa tiêu chí.']);
    }
}
