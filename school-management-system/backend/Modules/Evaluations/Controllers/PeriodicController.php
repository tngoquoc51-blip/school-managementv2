<?php

namespace Modules\Evaluations\Controllers;

use Illuminate\Http\Request;
use Modules\Evaluations\Support\EvalAudit;

class PeriodicController extends BaseController
{
    public function index(Request $r)
    {
        [$y, $s] = $this->period($r);
        $rows = $this->repo->periodic($y, $s, $r->query());
        $counts = ['all' => count($rows), 'none' => 0, 'draft' => 0, 'submitted' => 0, 'approved' => 0];
        foreach ($rows as $x) $counts[$x['status']] = ($counts[$x['status']] ?? 0) + 1;
        if ($st = $r->query('status')) $rows = array_values(array_filter($rows, fn ($x) => $x['status'] === $st));
        return $this->success(['year' => $y, 'semester' => $s, 'items' => $rows, 'counts' => $counts, 'settings' => $this->repo->settings()]);
    }

    private function num($v): ?float
    {
        $v = $this->nullable($v);
        return $v === null ? null : (float) $v;
    }

    /** Lưu điểm các thành phần; điểm dự giờ luôn tự tính từ phiếu đã nộp. */
    public function save(Request $r, int $teacherId)
    {
        [$y, $s] = $this->period($r);
        if (! $this->repo->teacherExists($teacherId)) return $this->error('Không tìm thấy giáo viên', 404);
        $row = $this->repo->periodicRow($y, $s, $teacherId);
        if ($row && $row['status'] === 'approved') return $this->error('Bản đánh giá đã được phê duyệt, cần mở lại trước khi sửa', 409);
        if ($e = $this->check($r->all(), [
            'score_professional' => 'nullable|numeric|min:0|max:100', 'score_results' => 'nullable|numeric|min:0|max:100',
            'score_conduct' => 'nullable|numeric|min:0|max:100', 'score_innovation' => 'nullable|numeric|min:0|max:100', 'comment' => 'nullable|max:2000',
        ], ['max' => ':attribute không vượt quá :max'])) return $e;

        $stat = $this->repo->observationStats($teacherId, $y, $s);
        $d = [
            'obs_count' => $stat['count'], 'score_observation' => $stat['avg'],
            'score_professional' => $this->num($r->input('score_professional')), 'score_results' => $this->num($r->input('score_results')),
            'score_conduct' => $this->num($r->input('score_conduct')), 'score_innovation' => $this->num($r->input('score_innovation')),
            'comment' => $this->nullable($r->input('comment')),
        ];
        $t = $this->scoring->periodicTotal(['observation' => $d['score_observation'], 'professional' => $d['score_professional'], 'results' => $d['score_results'],
            'conduct' => $d['score_conduct'], 'innovation' => $d['score_innovation']], $this->repo->settings());
        $d['total_score'] = $t['total']; $d['rating'] = $t['rating'];
        $id = $this->repo->savePeriodic($y, $s, $teacherId, $d);
        $name = $this->repo->teacherName($teacherId);
        EvalAudit::log('periodic.save', 'ev_periodic', $id, $name, "Lưu đánh giá định kỳ {$name} (HK{$s}): " . ($t['total'] ?? '—') . ' điểm', $row ? array_intersect_key($row, $d) : null, $d);
        return $this->success($this->repo->periodicById($id) + ['complete' => $t['complete']], 'Đã lưu đánh giá');
    }

    /** Tạo bản nháp cho mọi giáo viên chưa có, điền sẵn điểm dự giờ. */
    public function generate(Request $r)
    {
        [$y, $s] = $this->period($r);
        $n = 0; $refreshed = 0;
        foreach ($this->repo->periodic($y, $s) as $x) {
            $stat = $this->repo->observationStats((int) $x['teacher_id'], $y, $s);
            if ($x['status'] === 'none') {
                $t = $this->scoring->periodicTotal(['observation' => $stat['avg']], $this->repo->settings());
                $this->repo->savePeriodic($y, $s, (int) $x['teacher_id'], ['obs_count' => $stat['count'], 'score_observation' => $stat['avg'], 'total_score' => null, 'rating' => null]);
                $n++;
            } elseif ($x['status'] === 'draft') {
                $comp = ['observation' => $stat['avg'], 'professional' => $x['score_professional'], 'results' => $x['score_results'], 'conduct' => $x['score_conduct'], 'innovation' => $x['score_innovation']];
                $t = $this->scoring->periodicTotal($comp, $this->repo->settings());
                $this->repo->savePeriodic($y, $s, (int) $x['teacher_id'], ['obs_count' => $stat['count'], 'score_observation' => $stat['avg'], 'total_score' => $t['total'], 'rating' => $t['rating']]);
                $refreshed++;
            }
        }
        EvalAudit::log('periodic.generate', 'ev_periodic', null, "HK{$s}", "Khởi tạo bảng đánh giá định kỳ HK{$s}: tạo mới {$n}, cập nhật điểm dự giờ {$refreshed}");
        return $this->success(['created' => $n, 'refreshed' => $refreshed], "Đã tạo {$n} bản đánh giá, cập nhật {$refreshed} bản");
    }

    public function submit(Request $r, int $id)
    {
        $p = $this->repo->periodicById($id);
        if (! $p) return $this->error('Không tìm thấy bản đánh giá', 404);
        if ($p['status'] !== 'draft') return $this->error('Bản đánh giá không ở trạng thái nháp', 409);
        foreach (['score_observation' => 'điểm dự giờ', 'score_professional' => 'chuyên môn', 'score_results' => 'kết quả giảng dạy', 'score_conduct' => 'phẩm chất', 'score_innovation' => 'đổi mới'] as $k => $lbl) {
            if ($p[$k] === null) return $this->error("Còn thiếu thành phần \"$lbl\" — cần đủ 5 thành phần mới trình duyệt", 422);
        }
        $this->repo->setPeriodicStatus($id, 'submitted');
        EvalAudit::log('periodic.submit', 'ev_periodic', $id, $p['teacher_name'], "Trình duyệt đánh giá định kỳ {$p['teacher_name']}", ['status' => 'draft'], ['status' => 'submitted']);
        return $this->success($this->repo->periodicById($id), 'Đã trình duyệt');
    }

    public function approve(Request $r, int $id)
    {
        if (! ($this->me($r)['can_admin'] ?? false)) return $this->error('Chỉ Hiệu trưởng / Quản trị mới được phê duyệt', 403);
        $p = $this->repo->periodicById($id);
        if (! $p) return $this->error('Không tìm thấy bản đánh giá', 404);
        if ($p['status'] !== 'submitted') return $this->error('Bản đánh giá chưa được trình duyệt', 409);
        $this->repo->setPeriodicStatus($id, 'approved', $this->name($r));
        EvalAudit::log('periodic.approve', 'ev_periodic', $id, $p['teacher_name'], "Phê duyệt đánh giá định kỳ {$p['teacher_name']}: {$p['total_score']} điểm ({$p['rating']})",
            ['status' => 'submitted'], ['status' => 'approved'], 'notice');
        return $this->success($this->repo->periodicById($id), 'Đã phê duyệt');
    }

    public function reopen(Request $r, int $id)
    {
        $p = $this->repo->periodicById($id);
        if (! $p) return $this->error('Không tìm thấy bản đánh giá', 404);
        if ($p['status'] === 'draft') return $this->error('Bản đánh giá đang ở trạng thái nháp', 409);
        if ($p['status'] === 'approved' && ! ($this->me($r)['can_admin'] ?? false)) return $this->error('Chỉ Hiệu trưởng / Quản trị mới được mở lại bản đã duyệt', 403);
        if ($e = $this->check($r->all(), ['reason' => 'required|max:300'])) return $e;
        $this->repo->setPeriodicStatus($id, 'draft');
        EvalAudit::log('periodic.reopen', 'ev_periodic', $id, $p['teacher_name'], "Mở lại đánh giá định kỳ {$p['teacher_name']}", ['status' => $p['status']], ['status' => 'draft', 'reason' => $r->input('reason')], 'notice');
        return $this->success($this->repo->periodicById($id), 'Đã mở lại');
    }

    public function export(Request $r)
    {
        [$y, $s] = $this->period($r);
        $rt = ['excellent' => 'Tốt', 'good' => 'Khá', 'pass' => 'Đạt', 'fail' => 'Chưa đạt'];
        $st = ['none' => 'Chưa lập', 'draft' => 'Nháp', 'submitted' => 'Chờ duyệt', 'approved' => 'Đã duyệt'];
        $out = fopen('php://temp', 'w+'); fwrite($out, "\xEF\xBB\xBF");
        fputcsv($out, ['Mã GV', 'Giáo viên', 'Tổ/Môn', 'Số phiếu dự giờ', 'Điểm dự giờ', 'Chuyên môn', 'Kết quả giảng dạy', 'Phẩm chất', 'Đổi mới', 'Tổng', 'Xếp loại', 'Trạng thái']);
        foreach ($this->repo->periodic($y, $s) as $x) {
            fputcsv($out, [$x['code'], $x['full_name'], $x['subject_name'], $x['obs_count'], $x['obs_avg'], $x['score_professional'], $x['score_results'], $x['score_conduct'], $x['score_innovation'], $x['total_score'], $rt[$x['rating']] ?? '', $st[$x['status']] ?? $x['status']]);
        }
        rewind($out); $csv = stream_get_contents($out); fclose($out);
        EvalAudit::log('export', 'ev_periodic', null, "HK{$s}", "Xuất bảng đánh giá định kỳ HK{$s}");
        return response($csv, 200, ['Content-Type' => 'text/csv; charset=UTF-8', 'Content-Disposition' => 'attachment; filename="danh-gia-dinh-ky-hk' . $s . '.csv"']);
    }
}
