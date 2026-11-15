<?php

namespace Modules\Subject\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Subject\Requests\SubjectRequest;
use Modules\Subject\Services\SubjectService;
use Modules\Subject\Support\Audit;

class SubjectController extends Controller
{
    use ApiResponse;

    public function __construct(private SubjectService $svc) {}

    public function meta(Request $r)
    {
        return $this->success([
            'school_years' => DB::table('sm_school_years')->orderByDesc('id')->get(),
            'current_year_id' => Audit::currentYearId(),
            'groups' => DB::table('sm_subj_groups')->orderBy('sort_order')->get(),
            'teachers' => DB::table('sm_teachers')->orderBy('full_name')->get(['id', 'code', 'full_name', 'main_subject_id']),
            'config' => ['teacher_quota' => config('subject.teacher_quota'), 'pass_score' => config('subject.pass_score')],
        ]);
    }

    public function index(Request $r)
    {
        return $this->success($this->svc->list($r->all()));
    }

    public function show(Request $r, int $id)
    {
        $d = $this->svc->detail($id, $r->integer('school_year_id') ?: null);

        return $d ? $this->success($d) : $this->error('Không tìm thấy môn học', 404);
    }

    public function store(SubjectRequest $r)
    {
        $id = $this->svc->create($r->validated());

        return $this->success($this->svc->detail($id), 'Đã tạo môn học mới', 201);
    }

    public function update(SubjectRequest $r, int $id)
    {
        if (! DB::table('sm_subjects')->where('id', $id)->exists()) {
            return $this->error('Không tìm thấy môn học', 404);
        }
        $this->svc->update($id, $r->validated());

        return $this->success($this->svc->detail($id), 'Đã cập nhật môn học');
    }

    public function destroy(int $id)
    {
        $res = $this->svc->delete($id);
        if (! empty($res['missing'])) {
            return $this->error('Không tìm thấy môn học', 404);
        }
        if (! $res['ok']) {
            return $this->error('Môn học đang được sử dụng nên không thể xóa. Hãy chuyển sang "Ngừng sử dụng".', 409, $res['usage']);
        }

        return $this->success(null, 'Đã xóa môn học');
    }

    public function bulk(Request $r)
    {
        $d = $r->validate(['action' => 'required|in:activate,deactivate,delete', 'ids' => 'required|array|min:1', 'ids.*' => 'integer']);

        return $this->success($this->svc->bulk($d['action'], $d['ids']), 'Đã thực hiện thao tác hàng loạt');
    }

    public function duplicate(int $id)
    {
        $new = $this->svc->duplicate($id);

        return $new ? $this->success($this->svc->detail($new), 'Đã nhân bản môn học', 201) : $this->error('Không tìm thấy môn học', 404);
    }

    public function reorder(Request $r)
    {
        $d = $r->validate(['ids' => 'required|array|min:1', 'ids.*' => 'integer']);
        $this->svc->reorder($d['ids']);

        return $this->success(null, 'Đã lưu thứ tự hiển thị');
    }

    public function export()
    {
        return $this->success($this->svc->exportRows());
    }

    public function import(Request $r)
    {
        $d = $r->validate(['rows' => 'required|array|min:1|max:500', 'dry_run' => 'boolean']);

        return $this->success($this->svc->import($d['rows'], (bool) ($d['dry_run'] ?? true)));
    }

    public function curriculum(Request $r)
    {
        return $this->success($this->svc->curriculumAll());
    }

    public function saveCurriculum(Request $r, int $id)
    {
        $d = $r->validate([
            'rows' => 'required|array|min:1',
            'rows.*.grade' => 'required|in:10,11,12',
            'rows.*.periods_per_week' => 'required|integer|between:1,10',
            'rows.*.periods_total' => 'required|integer|between:1,700',
            'rows.*.tx_count' => 'required|integer|between:0,4',
            'rows.*.w_tx' => 'required|integer|between:1,5',
            'rows.*.w_gk' => 'required|integer|between:1,5',
            'rows.*.w_ck' => 'required|integer|between:1,5',
            'rows.*.is_required' => 'nullable|boolean',
        ]);
        if (! DB::table('sm_subjects')->where('id', $id)->exists()) {
            return $this->error('Không tìm thấy môn học', 404);
        }
        $this->svc->saveCurriculum($id, $d['rows']);

        return $this->success($this->svc->curriculumAll(), 'Đã lưu chương trình & hệ số điểm');
    }

    public function audit(Request $r)
    {
        $limit = min(max($r->integer('limit', 50), 10), 200);
        $q = DB::table('sm_subj_audit')->orderByDesc('id');
        if ($r->filled('action')) {
            $q->where('action', 'like', $r->input('action') . '%');
        }

        return $this->success($q->limit($limit)->get());
    }
}
