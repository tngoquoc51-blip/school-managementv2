<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SchoolYearController extends Controller
{
    private function yearsTable(): string
    {
        return Schema::hasTable('sm_school_years') ? 'sm_school_years' : 'school_years';
    }

    private function hasSemesters(): bool
    {
        return Schema::hasTable('sm_semesters');
    }

    /** GET /api/admin/school-years */
    public function index()
    {
        $t = $this->yearsTable();
        $years = DB::table($t)->orderByDesc('start_date')->orderByDesc('id')->get();

        $data = $years->map(function ($y) {
            $semesters = [];
            if ($this->hasSemesters()) {
                $semesters = DB::table('sm_semesters')
                    ->where('school_year_id', $y->id)
                    ->orderBy('code')
                    ->get()
                    ->map(fn ($s) => [
                        'id'         => (int) $s->id,
                        'code'       => (int) $s->code,
                        'name'       => $s->name,
                        'start_date' => $s->start_date,
                        'end_date'   => $s->end_date,
                        'is_current' => (int) ($s->is_current ?? 0) === 1,
                        'status'     => $s->status ?? 'upcoming',
                    ]);
            }

            return [
                'id'         => (int) $y->id,
                'label'      => $y->label ?? ($y->name ?? ''),
                'start_date' => $y->start_date ?? null,
                'end_date'   => $y->end_date ?? null,
                'is_current' => (int) ($y->is_current ?? 0) === 1,
                'status'     => $y->status ?? ((int) ($y->is_current ?? 0) === 1 ? 'active' : 'draft'),
                'note'       => $y->note ?? null,
                'semesters'  => $semesters,
            ];
        });

        $current = $data->firstWhere('is_current', true);

        return response()->json([
            'success' => true,
            'data'    => [
                'years'   => $data->values(),
                'current' => $current,
                'stats'   => [
                    'total'   => $data->count(),
                    'active'  => $data->where('status', 'active')->count(),
                    'draft'   => $data->where('status', 'draft')->count(),
                    'closed'  => $data->where('status', 'closed')->count(),
                ],
            ],
        ]);
    }

    /** POST /api/admin/school-years */
    public function store(Request $request)
    {
        $label = trim((string) $request->input('label', ''));
        if ($label === '' || !preg_match('/^\d{4}-\d{4}$/', $label)) {
            return response()->json(['success' => false, 'message' => 'Nhãn năm học dạng 2025-2026'], 422);
        }

        $t = $this->yearsTable();
        if (DB::table($t)->where('label', $label)->exists()) {
            return response()->json(['success' => false, 'message' => 'Năm học đã tồn tại'], 422);
        }

        $id = DB::table($t)->insertGetId([
            'label'      => $label,
            'start_date' => $request->input('start_date'),
            'end_date'   => $request->input('end_date'),
            'is_current' => 0,
            'status'     => $request->input('status', 'draft'),
            'note'       => $request->input('note'),
        ]);

        if ($this->hasSemesters()) {
            DB::table('sm_semesters')->insert([
                ['school_year_id' => $id, 'code' => 1, 'name' => 'Học kỳ 1', 'is_current' => 0, 'status' => 'upcoming'],
                ['school_year_id' => $id, 'code' => 2, 'name' => 'Học kỳ 2', 'is_current' => 0, 'status' => 'upcoming'],
            ]);
        }

        return response()->json(['success' => true, 'data' => ['id' => $id], 'message' => 'Đã tạo năm học']);
    }

    /** PUT /api/admin/school-years/{id} */
    public function update(Request $request, int $id)
    {
        $t = $this->yearsTable();
        $row = DB::table($t)->where('id', $id)->first();
        if (!$row) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy'], 404);
        }

        $upd = array_filter([
            'label'      => $request->input('label'),
            'start_date' => $request->input('start_date'),
            'end_date'   => $request->input('end_date'),
            'status'     => $request->input('status'),
            'note'       => $request->input('note'),
        ], fn ($v) => $v !== null);

        if ($upd) {
            DB::table($t)->where('id', $id)->update($upd);
        }

        return response()->json(['success' => true, 'message' => 'Đã cập nhật']);
    }

    /** POST /api/admin/school-years/{id}/set-current */
    public function setCurrent(int $id)
    {
        $t = $this->yearsTable();
        if (!DB::table($t)->where('id', $id)->exists()) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy'], 404);
        }

        DB::transaction(function () use ($t, $id) {
            DB::table($t)->update(['is_current' => 0]);
            DB::table($t)->where('id', $id)->update(['is_current' => 1, 'status' => 'active']);
        });

        return response()->json(['success' => true, 'message' => 'Đã đặt năm học hiện tại']);
    }

    /** PUT /api/admin/semesters/{id} */
    public function updateSemester(Request $request, int $id)
    {
        if (!$this->hasSemesters()) {
            return response()->json(['success' => false, 'message' => 'Chưa có bảng học kỳ'], 404);
        }
        $row = DB::table('sm_semesters')->where('id', $id)->first();
        if (!$row) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy học kỳ'], 404);
        }

        $upd = array_filter([
            'name'       => $request->input('name'),
            'start_date' => $request->input('start_date'),
            'end_date'   => $request->input('end_date'),
            'status'     => $request->input('status'),
        ], fn ($v) => $v !== null);

        if ($request->boolean('is_current')) {
            DB::table('sm_semesters')->where('school_year_id', $row->school_year_id)->update(['is_current' => 0]);
            $upd['is_current'] = 1;
            $upd['status'] = $upd['status'] ?? 'active';
        }

        if ($upd) {
            DB::table('sm_semesters')->where('id', $id)->update($upd);
        }

        return response()->json(['success' => true, 'message' => 'Đã cập nhật học kỳ']);
    }
}
