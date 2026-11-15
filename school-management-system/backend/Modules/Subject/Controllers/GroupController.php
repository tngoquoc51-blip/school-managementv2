<?php

namespace Modules\Subject\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Modules\Subject\Support\Audit;

class GroupController extends Controller
{
    use ApiResponse;

    public function index()
    {
        $groups = DB::table('sm_subj_groups as g')->leftJoin('sm_teachers as h', 'h.id', '=', 'g.head_teacher_id')
            ->orderBy('g.sort_order')->orderBy('g.id')
            ->selectRaw('g.*, h.full_name as head_name,
                (SELECT COUNT(*) FROM sm_subjects s WHERE s.group_id = g.id) as subjects_count,
                (SELECT COUNT(*) FROM sm_teachers t JOIN sm_subjects s2 ON s2.id = t.main_subject_id WHERE s2.group_id = g.id) as teachers_count')
            ->get();
        $subjects = DB::table('sm_subjects')->orderBy('sort_order')->get(['id', 'code', 'name', 'color', 'group_id', 'status']);
        $groups = $groups->map(function ($g) use ($subjects) {
            $g->subjects = $subjects->where('group_id', $g->id)->values();

            return $g;
        });

        return $this->success(['groups' => $groups, 'ungrouped' => $subjects->whereNull('group_id')->values()]);
    }

    private function rules(?int $id): array
    {
        return [
            'code' => ['required', 'regex:/^[A-Z0-9_-]{1,12}$/', Rule::unique('sm_subj_groups', 'code')->ignore($id)],
            'name' => 'required|string|max:80',
            'head_teacher_id' => 'nullable|integer|exists:sm_teachers,id',
            'description' => 'nullable|string|max:300',
            'subject_ids' => 'nullable|array',
            'subject_ids.*' => 'integer|exists:sm_subjects,id',
        ];
    }

    private function save(Request $r, ?int $id)
    {
        $r->merge(['code' => strtoupper(trim((string) $r->input('code')))]);
        $d = $r->validate($this->rules($id), [
            'code.regex' => 'Mã tổ chỉ gồm chữ HOA, số, - hoặc _', 'code.unique' => 'Mã tổ đã tồn tại', 'name.required' => 'Vui lòng nhập tên tổ',
        ]);
        DB::transaction(function () use ($d, &$id) {
            $row = ['code' => $d['code'], 'name' => $d['name'], 'head_teacher_id' => $d['head_teacher_id'] ?? null, 'description' => $d['description'] ?? null];
            if ($id) {
                DB::table('sm_subj_groups')->where('id', $id)->update($row);
            } else {
                $id = DB::table('sm_subj_groups')->insertGetId($row + ['sort_order' => (int) DB::table('sm_subj_groups')->max('sort_order') + 1, 'created_at' => now()]);
            }
            if (array_key_exists('subject_ids', $d)) {
                DB::table('sm_subjects')->where('group_id', $id)->update(['group_id' => null]);
                if ($d['subject_ids']) {
                    DB::table('sm_subjects')->whereIn('id', $d['subject_ids'])->update(['group_id' => $id]);
                }
            }
            Audit::log('group', "Lưu tổ bộ môn {$d['code']} - {$d['name']}");
        });

        return $id;
    }

    public function store(Request $r)
    {
        $this->save($r, null);

        return $this->success(null, 'Đã tạo tổ bộ môn', 201);
    }

    public function update(Request $r, int $id)
    {
        if (! DB::table('sm_subj_groups')->where('id', $id)->exists()) {
            return $this->error('Không tìm thấy tổ bộ môn', 404);
        }
        $this->save($r, $id);

        return $this->success(null, 'Đã cập nhật tổ bộ môn');
    }

    public function destroy(int $id)
    {
        $g = DB::table('sm_subj_groups')->find($id);
        if (! $g) {
            return $this->error('Không tìm thấy tổ bộ môn', 404);
        }
        DB::transaction(function () use ($id, $g) {
            DB::table('sm_subjects')->where('group_id', $id)->update(['group_id' => null]);
            DB::table('sm_subj_groups')->where('id', $id)->delete();
            Audit::log('group_delete', "Xóa tổ bộ môn {$g->code} - {$g->name}");
        });

        return $this->success(null, 'Đã xóa tổ bộ môn (các môn chuyển sang "Chưa phân tổ")');
    }
}
