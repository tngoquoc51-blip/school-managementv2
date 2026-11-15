<?php

namespace Modules\Evaluations\Controllers;

use Illuminate\Http\Request;
use Modules\Evaluations\Support\EvalAudit;

class ObservationController extends BaseController
{
    public function index(Request $r)
    {
        [$y, $s] = $this->period($r);
        $f = $r->query() + [];
        $f['year'] = $y; $f['semester'] = $s === 3 ? 0 : $s;
        return $this->success($this->repo->observations($f, max(1, (int) $r->query('page', 1)), (int) $r->query('per_page', 20)));
    }

    public function show(int $id)
    {
        $o = $this->repo->observation($id);
        if (! $o) return $this->error('Không tìm thấy phiếu dự giờ', 404);
        return $this->success($this->detail($o));
    }

    private function detail(array $o): array
    {
        $criteria = $this->repo->criteria((int) $o['rubric_id']);
        $scores = $this->repo->observationScores((int) $o['id']);
        return [
            'observation' => $o, 'criteria' => $criteria, 'scores' => (object) $scores,
            'history' => $this->repo->history('ev_observation', $o['id']),
            'actions' => $this->repo->actions(['observation_id' => $o['id']], 1, 50)['items'] ?? [],
            'settings' => $this->repo->settings(),
        ];
    }

    private function metaRules(): array
    {
        return [
            'teacher_id' => 'required|integer', 'observed_on' => 'required|date', 'period' => 'nullable|integer|min:1|max:10',
            'kind' => 'required|in:planned,surprise,thematic,followup', 'topic' => 'nullable|max:200',
            'class_id' => 'nullable|integer', 'subject_id' => 'nullable|integer',
            'students_present' => 'nullable|integer|min:0|max:200', 'duration_min' => 'nullable|integer|min:5|max:240',
            'strengths' => 'nullable|max:3000', 'weaknesses' => 'nullable|max:3000', 'suggestions' => 'nullable|max:3000',
        ];
    }

    /** Tạo phiếu độc lập (dự giờ đột xuất không có lịch). */
    public function store(Request $r)
    {
        if ($e = $this->check($r->all(), $this->metaRules() + ['rubric_id' => 'nullable|integer'])) return $e;
        $tid = (int) $r->input('teacher_id');
        if (! $this->repo->teacherExists($tid)) return $this->error('Giáo viên không tồn tại', 422);
        $date = $r->input('observed_on');
        $rid = (int) ($r->input('rubric_id') ?: ($this->repo->settings()['default_rubric_id'] ?? 1));
        if (! $this->repo->rubric($rid)) return $this->error('Mẫu phiếu không tồn tại', 422);
        $id = $this->repo->createObservation([
            'plan_id' => null, 'school_year_id' => $this->repo->currentYearId(), 'semester' => $this->semesterOf($date), 'teacher_id' => $tid,
            'class_id' => $this->nullable($r->input('class_id')), 'subject_id' => $this->nullable($r->input('subject_id')), 'rubric_id' => $rid,
            'observed_on' => $date, 'period' => $this->nullable($r->input('period')), 'kind' => $r->input('kind'), 'topic' => $this->nullable($r->input('topic')),
            'students_present' => $this->nullable($r->input('students_present')), 'duration_min' => $this->nullable($r->input('duration_min')) ?? 45,
            'observer_id' => $this->me($r)['id'] ?? null, 'observer_name' => $this->name($r),
        ]);
        $o = $this->repo->observation($id);
        EvalAudit::log('observation.create', 'ev_observation', $id, $o['code'], "Tạo phiếu dự giờ {$o['code']} - {$o['teacher_name']}", null, ['teacher_id' => $tid, 'observed_on' => $date]);
        return $this->success($this->detail($o), 'Đã tạo phiếu dự giờ', 201);
    }

    /** Lưu nháp: thông tin chung + điểm từng tiêu chí. Chỉ khi phiếu còn ở trạng thái nháp. */
    public function update(Request $r, int $id)
    {
        $o = $this->repo->observation($id);
        if (! $o) return $this->error('Không tìm thấy phiếu dự giờ', 404);
        if ($o['status'] !== 'draft') return $this->error('Phiếu đã nộp, cần "Mở lại" trước khi sửa', 409);
        if ($e = $this->check($r->all(), $this->metaRules() + ['scores' => 'nullable|array'])) return $e;

        $criteria = $this->repo->criteria((int) $o['rubric_id']);
        $byId = []; foreach ($criteria as $c) $byId[(int) $c['id']] = $c;
        $clean = []; $plain = [];
        foreach ((array) $r->input('scores', []) as $cid => $row) {
            $cid = (int) $cid;
            if (! isset($byId[$cid])) return $this->error("Tiêu chí #$cid không thuộc mẫu phiếu này", 422);
            $sc = is_array($row) ? ($row['score'] ?? null) : $row;
            if ($sc === null || $sc === '') continue;
            if (! $this->scoring->validScore($sc, (int) $byId[$cid]['max_score'])) {
                return $this->error("Điểm tiêu chí \"{$byId[$cid]['name']}\" phải từ 0 đến {$byId[$cid]['max_score']}", 422);
            }
            $clean[$cid] = ['score' => (int) $sc, 'comment' => is_array($row) ? $this->nullable(mb_substr((string) ($row['comment'] ?? ''), 0, 300)) : null];
            $plain[$cid] = (int) $sc;
        }
        $total = $this->scoring->observationScore($criteria, $plain);
        $rating = $this->scoring->rate($total, $this->repo->settings());
        $date = $r->input('observed_on');
        $this->repo->updateObservationMeta($id, [
            'teacher_id' => (int) $r->input('teacher_id'), 'class_id' => $this->nullable($r->input('class_id')), 'subject_id' => $this->nullable($r->input('subject_id')),
            'observed_on' => $date, 'period' => $this->nullable($r->input('period')), 'kind' => $r->input('kind'), 'topic' => $this->nullable($r->input('topic')),
            'students_present' => $this->nullable($r->input('students_present')), 'duration_min' => $this->nullable($r->input('duration_min')) ?? 45,
            'strengths' => $this->nullable($r->input('strengths')), 'weaknesses' => $this->nullable($r->input('weaknesses')), 'suggestions' => $this->nullable($r->input('suggestions')),
            'observer_name' => $o['observer_name'] ?: $this->name($r), 'semester' => $this->semesterOf($date), 'total_score' => $total, 'rating' => $rating,
        ]);
        if ($r->has('scores')) $this->repo->replaceScores($id, $clean);
        EvalAudit::log('observation.save', 'ev_observation', $id, $o['code'], "Lưu nháp phiếu {$o['code']} ({$o['teacher_name']}) · " . count($clean) . '/' . count($criteria) . ' tiêu chí',
            ['total_score' => $o['total_score']], ['total_score' => $total, 'rating' => $rating]);
        return $this->success($this->detail($this->repo->observation($id)), 'Đã lưu nháp');
    }

    public function submit(Request $r, int $id)
    {
        $o = $this->repo->observation($id);
        if (! $o) return $this->error('Không tìm thấy phiếu dự giờ', 404);
        if ($o['status'] !== 'draft') return $this->error('Phiếu không ở trạng thái nháp', 409);
        $criteria = $this->repo->criteria((int) $o['rubric_id']);
        $scores = $this->repo->observationScores($id);
        $missing = array_values(array_filter($criteria, fn ($c) => ! isset($scores[(int) $c['id']])));
        if ($missing) return $this->error('Còn ' . count($missing) . ' tiêu chí chưa chấm (vd: ' . $missing[0]['name'] . ')', 422);
        $plain = []; foreach ($scores as $cid => $row) $plain[$cid] = (int) $row['score'];
        $total = $this->scoring->observationScore($criteria, $plain, true);
        $rating = $this->scoring->rate($total, $this->repo->settings());
        $this->repo->setObservationStatus($id, 'submitted', ['total_score' => $total, 'rating' => $rating, 'submitted_at' => $this->repo->now()]);
        $this->repo->markPlanDone($o['plan_id'] ? (int) $o['plan_id'] : null);
        EvalAudit::log('observation.submit', 'ev_observation', $id, $o['code'], "Nộp phiếu {$o['code']} - {$o['teacher_name']}: {$total} điểm ({$rating})",
            ['status' => 'draft'], ['status' => 'submitted', 'total_score' => $total, 'rating' => $rating], $rating === 'fail' ? 'warning' : 'info');
        return $this->success($this->detail($this->repo->observation($id)), 'Đã nộp phiếu dự giờ');
    }

    public function acknowledge(Request $r, int $id)
    {
        $o = $this->repo->observation($id);
        if (! $o) return $this->error('Không tìm thấy phiếu dự giờ', 404);
        if (! in_array($o['status'], ['submitted', 'disputed'], true)) return $this->error('Phiếu chưa ở bước chờ giáo viên xác nhận', 409);
        if ($e = $this->check($r->all(), ['teacher_comment' => 'nullable|max:2000'])) return $e;
        $this->repo->setObservationStatus($id, 'acknowledged', ['teacher_comment' => $this->nullable($r->input('teacher_comment')), 'teacher_ack_at' => $this->repo->now()]);
        EvalAudit::log('observation.ack', 'ev_observation', $id, $o['code'], "Giáo viên {$o['teacher_name']} đã xác nhận phiếu {$o['code']}", ['status' => $o['status']], ['status' => 'acknowledged']);
        return $this->success($this->detail($this->repo->observation($id)), 'Đã ghi nhận giáo viên xác nhận');
    }

    public function dispute(Request $r, int $id)
    {
        $o = $this->repo->observation($id);
        if (! $o) return $this->error('Không tìm thấy phiếu dự giờ', 404);
        if ($o['status'] !== 'submitted') return $this->error('Chỉ ghi nhận phản hồi cho phiếu đang chờ xác nhận', 409);
        if ($e = $this->check($r->all(), ['teacher_comment' => 'required|max:2000'], ['teacher_comment.required' => 'Cần nhập nội dung phản hồi của giáo viên'])) return $e;
        $this->repo->setObservationStatus($id, 'disputed', ['teacher_comment' => trim($r->input('teacher_comment'))]);
        EvalAudit::log('observation.dispute', 'ev_observation', $id, $o['code'], "Giáo viên {$o['teacher_name']} phản hồi/khiếu nại phiếu {$o['code']}",
            ['status' => 'submitted'], ['status' => 'disputed', 'teacher_comment' => $r->input('teacher_comment')], 'notice');
        return $this->success($this->detail($this->repo->observation($id)), 'Đã ghi nhận phản hồi của giáo viên');
    }

    public function reopen(Request $r, int $id)
    {
        $o = $this->repo->observation($id);
        if (! $o) return $this->error('Không tìm thấy phiếu dự giờ', 404);
        if (! in_array($o['status'], ['submitted', 'disputed', 'acknowledged'], true)) return $this->error('Phiếu không thể mở lại ở trạng thái hiện tại', 409);
        if ($e = $this->check($r->all(), ['reason' => 'required|max:300'])) return $e;
        $this->repo->setObservationStatus($id, 'draft', ['teacher_ack_at' => null, 'submitted_at' => null]);
        EvalAudit::log('observation.reopen', 'ev_observation', $id, $o['code'], "Mở lại phiếu {$o['code']} để chỉnh sửa", ['status' => $o['status']], ['status' => 'draft', 'reason' => $r->input('reason')], 'notice');
        return $this->success($this->detail($this->repo->observation($id)), 'Đã mở lại phiếu');
    }

    public function close(Request $r, int $id)
    {
        $o = $this->repo->observation($id);
        if (! $o) return $this->error('Không tìm thấy phiếu dự giờ', 404);
        if (! in_array($o['status'], ['acknowledged', 'submitted'], true)) return $this->error('Chỉ chốt được phiếu đã nộp / đã xác nhận', 409);
        $this->repo->setObservationStatus($id, 'closed', ['closed_at' => $this->repo->now()]);
        EvalAudit::log('observation.close', 'ev_observation', $id, $o['code'], "Chốt phiếu {$o['code']} - {$o['teacher_name']}", ['status' => $o['status']], ['status' => 'closed']);
        return $this->success($this->detail($this->repo->observation($id)), 'Đã chốt phiếu');
    }

    public function destroy(Request $r, int $id)
    {
        $o = $this->repo->observation($id);
        if (! $o) return $this->error('Không tìm thấy phiếu dự giờ', 404);
        if ($o['status'] !== 'draft' && ! ($this->me($r)['can_admin'] ?? false)) return $this->error('Chỉ Hiệu trưởng / Quản trị mới được xoá phiếu đã nộp', 403);
        $this->repo->deleteObservation($id);
        if ($o['plan_id']) { $this->repo->setPlanStatus((int) $o['plan_id'], 'scheduled', null); }
        EvalAudit::log('observation.delete', 'ev_observation', $id, $o['code'], "Xoá phiếu dự giờ {$o['code']} - {$o['teacher_name']}", $o, null, 'warning');
        return $this->success(null, 'Đã xoá phiếu');
    }

    /** Xuất CSV (mở được bằng Excel, có BOM UTF-8). */
    public function export(Request $r)
    {
        [$y, $s] = $this->period($r);
        $f = $r->query() + []; $f['year'] = $y; $f['semester'] = $s === 3 ? 0 : $s;
        $rows = $this->repo->observations($f, 1, 1, true)['items'];
        $kinds = ['planned' => 'Theo kế hoạch', 'surprise' => 'Đột xuất', 'thematic' => 'Chuyên đề', 'followup' => 'Dự lại'];
        $ratings = ['excellent' => 'Tốt', 'good' => 'Khá', 'pass' => 'Đạt', 'fail' => 'Chưa đạt'];
        $out = fopen('php://temp', 'w+');
        fwrite($out, "\xEF\xBB\xBF");
        fputcsv($out, ['Mã phiếu', 'Ngày dự', 'Học kỳ', 'Giáo viên', 'Mã GV', 'Tổ/Môn', 'Lớp', 'Hình thức', 'Bài dạy', 'Người dự', 'Điểm', 'Xếp loại', 'Trạng thái']);
        foreach ($rows as $o) {
            fputcsv($out, [$o['code'], $o['observed_on'], $o['semester'], $o['teacher_name'], $o['teacher_code'], $o['subject_name'], $o['class_name'],
                $kinds[$o['kind']] ?? $o['kind'], $o['topic'], $o['observer_name'], $o['total_score'], $ratings[$o['rating']] ?? '', $o['status']]);
        }
        rewind($out); $csv = stream_get_contents($out); fclose($out);
        EvalAudit::log('export', 'ev_observation', null, null, 'Xuất danh sách phiếu dự giờ (' . count($rows) . ' phiếu)');
        return response($csv, 200, ['Content-Type' => 'text/csv; charset=UTF-8', 'Content-Disposition' => 'attachment; filename="du-gio-' . date('Ymd-His') . '.csv"']);
    }
}
