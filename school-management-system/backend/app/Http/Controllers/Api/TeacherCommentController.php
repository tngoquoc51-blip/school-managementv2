<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\TeacherCommentService;
use Illuminate\Http\Request;

/** Nhận xét học sinh – cổng Giáo viên. Đường dẫn: /api/gv/teacher/comments/... (routes/profile.php) */
class TeacherCommentController extends Controller
{
    public function __construct(private TeacherCommentService $svc) {}

    private function out($data = null, string $msg = 'OK', int $code = 200)
    {
        return response()->json(['success' => true, 'message' => $msg, 'data' => $data], $code);
    }

    private function itemRules(string $p = ''): array
    {
        return [
            $p . 'student_id' => ['required', 'integer'], $p . 'class_subject_id' => ['required', 'integer'],
            $p . 'semester' => ['required', 'integer', 'in:1,2'], $p . 'kind' => ['required', 'in:midterm,final,monthly'], $p . 'period' => ['nullable', 'string', 'max:7'],
            $p . 'rating' => ['required', 'in:excellent,good,fair,weak'], $p . 'content' => ['required', 'string', 'min:3', 'max:1000'],
            $p . 'tags' => ['nullable', 'array'], $p . 'tags.*' => ['string', 'max:20'], $p . 'status' => ['nullable', 'in:draft,published'],
        ];
    }

    private const MSG = ['content.required' => 'Vui lòng nhập nội dung nhận xét.', 'content.min' => 'Nhận xét cần tối thiểu 3 ký tự.', 'content.max' => 'Nhận xét tối đa 1000 ký tự.', 'rating.required' => 'Vui lòng chọn mức đánh giá.'];

    public function meta(Request $r) { return $this->out($this->svc->meta($this->svc->staff($r))); }

    public function overview(Request $r)
    {
        return $this->out($this->svc->overview($this->svc->staff($r), (int) $r->query('semester', 1), (string) $r->query('kind', 'midterm'), $r->query('period')));
    }

    public function roster(Request $r)
    {
        $d = $r->validate(['class_subject_id' => ['required', 'integer'], 'semester' => ['required', 'in:1,2'], 'kind' => ['required', 'in:midterm,final,monthly'], 'period' => ['nullable', 'string', 'max:7']]);

        return $this->out($this->svc->rosterOut($this->svc->staff($r), (int) $d['class_subject_id'], (int) $d['semester'], $d['kind'], $d['period'] ?? null));
    }

    public function save(Request $r)
    {
        $d = $r->validate($this->itemRules(), self::MSG);

        return $this->out($this->svc->save($this->svc->staff($r), $d), 'Đã lưu nhận xét');
    }

    public function bulk(Request $r)
    {
        $d = $r->validate(['items' => ['required', 'array', 'min:1', 'max:120']] + $this->itemRules('items.*.'), self::MSG);
        $n = $this->svc->saveMany($this->svc->staff($r), $d['items']);

        return $this->out(['saved' => $n], "Đã lưu {$n} nhận xét");
    }

    public function status(Request $r)
    {
        $d = $r->validate(['class_subject_id' => ['required', 'integer'], 'semester' => ['required', 'in:1,2'], 'kind' => ['required', 'in:midterm,final,monthly'], 'period' => ['nullable', 'string', 'max:7'], 'to' => ['required', 'in:draft,published']]);
        $n = $this->svc->setStatus($this->svc->staff($r), (int) $d['class_subject_id'], (int) $d['semester'], $d['kind'], $d['period'] ?? null, $d['to']);

        return $this->out(['changed' => $n], $d['to'] === 'published' ? "Đã công bố {$n} nhận xét" : "Đã thu hồi {$n} nhận xét");
    }

    public function destroy(Request $r, int $id)
    {
        $this->svc->remove($this->svc->staff($r), $id);

        return $this->out(null, 'Đã xóa nhận xét');
    }

    public function insights(Request $r)
    {
        return $this->out($this->svc->insights($this->svc->staff($r), (int) $r->query('class_subject_id'), (int) $r->query('semester', 1), (string) $r->query('kind', 'midterm'), $r->query('period')));
    }

    public function student(Request $r, int $id)
    {
        return $this->out($this->svc->student($this->svc->staff($r), $id, (int) $r->query('class_subject_id')));
    }

    private function hist(Request $r): array
    {
        return ['class_id' => (int) $r->query('class_id'), 'subject_id' => (int) $r->query('subject_id'), 'semester' => (int) $r->query('semester'), 'status' => (string) $r->query('status', ''), 'rating' => (string) $r->query('rating', ''), 'q' => trim((string) $r->query('q', ''))];
    }

    public function history(Request $r) { return $this->out($this->svc->history($this->svc->staff($r), $this->hist($r), min((int) $r->query('per_page', 15), 100))); }

    public function export(Request $r)
    {
        $rows = $this->svc->exportRows($this->svc->staff($r), $this->hist($r));
        $R = TeacherCommentService::RATINGS; $K = TeacherCommentService::KINDS;

        return response()->streamDownload(function () use ($rows, $R, $K) {
            $o = fopen('php://output', 'w');
            fwrite($o, "\xEF\xBB\xBF");
            fputcsv($o, ['Mã HS', 'Họ tên', 'Lớp', 'Môn', 'Học kỳ', 'Kỳ nhận xét', 'Mức đánh giá', 'Nội dung', 'Trạng thái', 'Cập nhật']);
            foreach ($rows as $x) {
                fputcsv($o, [$x->student_code, $x->student_name, $x->class_name, $x->subject_name, 'HK' . $x->semester, ($K[$x->kind] ?? $x->kind) . ' ' . $x->period, $R[$x->rating] ?? $x->rating, $x->content, $x->status === 'published' ? 'Đã công bố' : 'Bản nháp', $x->updated_at]);
            }
            fclose($o);
        }, 'nhan-xet-' . date('Ymd-His') . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function templates(Request $r) { return $this->out($this->svc->templates($this->svc->staff($r), (string) $r->query('rating', ''))); }

    private function tplRules(): array
    {
        return ['rating' => ['required', 'in:excellent,good,fair,weak,any'], 'title' => ['required', 'string', 'min:2', 'max:80'], 'body' => ['required', 'string', 'min:5', 'max:600']];
    }

    public function storeTemplate(Request $r) { return $this->out($this->svc->saveTemplate($this->svc->staff($r), $r->validate($this->tplRules())), 'Đã thêm mẫu', 201); }
    public function updateTemplate(Request $r, int $id) { return $this->out($this->svc->saveTemplate($this->svc->staff($r), $r->validate($this->tplRules()), $id), 'Đã cập nhật mẫu'); }

    public function destroyTemplate(Request $r, int $id)
    {
        $this->svc->deleteTemplate($this->svc->staff($r), $id);

        return $this->out(null, 'Đã xóa mẫu');
    }

    public function useTemplate(Request $r, int $id)
    {
        $this->svc->useTemplate($this->svc->staff($r), $id);

        return $this->out();
    }
}
