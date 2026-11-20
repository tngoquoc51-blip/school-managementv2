<?php

namespace Modules\Setting\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Setting\Services\SettingService;

/** Năm học & học kỳ — dùng bảng sm_school_years, sm_semesters có sẵn. */
class SchoolYearController extends Controller
{
    use ApiResponse;

    public function __construct(private SettingService $svc) {}

    public function index()
    {
        $years = DB::table('sm_school_years')->orderByDesc('start_date')->get();
        $sems = DB::table('sm_semesters')->orderBy('code')->get()->groupBy('school_year_id');
        foreach ($years as $y) $y->semesters = $sems->get($y->id, collect())->values();
        return $this->success($years);
    }

    private function yearRules(): array
    {
        return ['label' => 'required|string|max:20', 'start_date' => 'required|date', 'end_date' => 'required|date|after:start_date', 'status' => 'required|in:draft,active,closed'];
    }

    public function store(Request $r)
    {
        $d = $r->validate($this->yearRules());
        $id = DB::table('sm_school_years')->insertGetId($d + ['is_current' => 0]);
        $this->svc->audit($r->user(), 'schoolyear.create', 'Tạo năm học ' . $d['label'], ['entity_type' => 'school_year', 'entity_id' => $id, 'entity_label' => $d['label']]);
        return $this->success(DB::table('sm_school_years')->find($id), 'Đã tạo năm học', 201);
    }

    public function update(Request $r, int $id)
    {
        $d = $r->validate($this->yearRules());
        if (! DB::table('sm_school_years')->where('id', $id)->exists()) return $this->error('Không tìm thấy', 404);
        DB::table('sm_school_years')->where('id', $id)->update($d);
        $this->svc->audit($r->user(), 'schoolyear.update', 'Sửa năm học ' . $d['label'], ['entity_type' => 'school_year', 'entity_id' => $id, 'entity_label' => $d['label']]);
        return $this->success(null, 'Đã cập nhật');
    }

    public function destroy(Request $r, int $id)
    {
        $y = DB::table('sm_school_years')->find($id);
        if (! $y) return $this->error('Không tìm thấy', 404);
        if ($y->is_current) return $this->error('Không thể xóa năm học đang hiện hành', 409);
        try {
            DB::transaction(function () use ($id) {
                DB::table('sm_semesters')->where('school_year_id', $id)->delete();
                DB::table('sm_school_years')->where('id', $id)->delete();
            });
        } catch (\Throwable) {
            return $this->error('Năm học đã có dữ liệu liên quan (lớp, điểm, ...) nên không thể xóa. Hãy chuyển sang trạng thái "Đã đóng".', 409);
        }
        $this->svc->audit($r->user(), 'schoolyear.delete', 'Xóa năm học ' . $y->label, ['severity' => 'warning', 'entity_type' => 'school_year', 'entity_id' => $id]);
        return $this->success(null, 'Đã xóa năm học');
    }

    /** Đặt làm năm học hiện hành (đồng bộ sm_system_settings.current_school_year_label) */
    public function setCurrent(Request $r, int $id)
    {
        $y = DB::table('sm_school_years')->find($id);
        if (! $y) return $this->error('Không tìm thấy', 404);
        DB::transaction(function () use ($id, $y) {
            DB::table('sm_school_years')->where('is_current', 1)->update(['is_current' => 0, 'status' => 'closed']);
            DB::table('sm_school_years')->where('id', $id)->update(['is_current' => 1, 'status' => 'active']);
            DB::table('sm_system_settings')->updateOrInsert(['setting_key' => 'current_school_year_label'], ['setting_value' => str_replace(' ', '', str_replace('–', '-', $y->label))]);
        });
        $this->svc->audit($r->user(), 'schoolyear.set_current', 'Đặt năm học hiện hành: ' . $y->label, ['severity' => 'warning', 'entity_type' => 'school_year', 'entity_id' => $id, 'entity_label' => $y->label]);
        return $this->success(null, 'Đã đặt ' . $y->label . ' là năm học hiện hành');
    }

    private function semRules(): array
    {
        return ['school_year_id' => 'required|integer|exists:sm_school_years,id', 'code' => 'required|integer|in:1,2', 'name' => 'required|string|max:40',
                'start_date' => 'required|date', 'end_date' => 'required|date|after:start_date', 'status' => 'required|in:upcoming,active,closed'];
    }

    public function storeSemester(Request $r)
    {
        $d = $r->validate($this->semRules());
        if (DB::table('sm_semesters')->where('school_year_id', $d['school_year_id'])->where('code', $d['code'])->exists())
            return $this->error('Năm học này đã có học kỳ ' . $d['code'], 422, ['code' => ['Đã tồn tại']]);
        $id = DB::table('sm_semesters')->insertGetId($d + ['is_current' => 0]);
        $this->svc->audit($r->user(), 'semester.create', 'Tạo ' . $d['name'], ['entity_type' => 'semester', 'entity_id' => $id]);
        return $this->success(['id' => $id], 'Đã tạo học kỳ', 201);
    }

    public function updateSemester(Request $r, int $id)
    {
        $d = $r->validate($this->semRules());
        $dup = DB::table('sm_semesters')->where('school_year_id', $d['school_year_id'])->where('code', $d['code'])->where('id', '!=', $id)->exists();
        if ($dup) return $this->error('Năm học này đã có học kỳ ' . $d['code'], 422, ['code' => ['Đã tồn tại']]);
        DB::table('sm_semesters')->where('id', $id)->update($d);
        $this->svc->audit($r->user(), 'semester.update', 'Sửa ' . $d['name'], ['entity_type' => 'semester', 'entity_id' => $id]);
        return $this->success(null, 'Đã cập nhật học kỳ');
    }

    public function destroySemester(Request $r, int $id)
    {
        $s = DB::table('sm_semesters')->find($id);
        if (! $s) return $this->error('Không tìm thấy', 404);
        if ($s->is_current) return $this->error('Không thể xóa học kỳ hiện hành', 409);
        try { DB::table('sm_semesters')->where('id', $id)->delete(); }
        catch (\Throwable) { return $this->error('Học kỳ đã có dữ liệu liên quan nên không thể xóa', 409); }
        $this->svc->audit($r->user(), 'semester.delete', 'Xóa ' . $s->name, ['severity' => 'warning', 'entity_type' => 'semester', 'entity_id' => $id]);
        return $this->success(null, 'Đã xóa học kỳ');
    }

    public function setCurrentSemester(Request $r, int $id)
    {
        $s = DB::table('sm_semesters')->find($id);
        if (! $s) return $this->error('Không tìm thấy', 404);
        DB::transaction(function () use ($id) {
            DB::table('sm_semesters')->where('is_current', 1)->update(['is_current' => 0, 'status' => 'closed']);
            DB::table('sm_semesters')->where('id', $id)->update(['is_current' => 1, 'status' => 'active']);
        });
        $this->svc->audit($r->user(), 'semester.set_current', 'Đặt học kỳ hiện hành: ' . $s->name, ['severity' => 'warning', 'entity_type' => 'semester', 'entity_id' => $id]);
        return $this->success(null, 'Đã đặt ' . $s->name . ' là học kỳ hiện hành');
    }
}
