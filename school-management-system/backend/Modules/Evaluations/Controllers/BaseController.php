<?php

namespace Modules\Evaluations\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Validator;
use Modules\Evaluations\Repositories\EvalRepository;
use Modules\Evaluations\Services\ScoringService;

/** Lớp nền: lấy người thao tác (do BghAccess gắn vào request), kiểm tra dữ liệu, tham số năm/học kỳ. */
abstract class BaseController extends Controller
{
    use ApiResponse;

    public function __construct(protected EvalRepository $repo, protected ScoringService $scoring) {}

    protected function me(Request $r): array
    {
        return $r->attributes->get('log_actor') ?? ['id' => null, 'full_name' => 'Hệ thống', 'role' => null, 'can_admin' => false];
    }

    protected function name(Request $r): string
    {
        return (string) ($this->me($r)['full_name'] ?? 'Hệ thống');
    }

    /** @return array{0:int,1:int} [năm học, học kỳ 1|2|3] */
    protected function period(Request $r): array
    {
        $year = (int) $r->query('year', 0) ?: $this->repo->currentYearId();
        $sem = (int) $r->query('semester', 0);
        if (! in_array($sem, [1, 2, 3], true)) {
            $sem = (int) ($this->repo->settings()['current_semester'] ?? 1);
        }
        return [$year, $sem];
    }

    /** Trả null nếu hợp lệ, ngược lại trả response 422 với message đầu tiên. */
    protected function check(array $data, array $rules, array $messages = [])
    {
        $v = Validator::make($data, $rules, $messages + [
            'required' => ':attribute là bắt buộc', 'date' => ':attribute không đúng định dạng ngày',
            'in' => ':attribute không hợp lệ', 'max' => ':attribute quá dài', 'integer' => ':attribute phải là số nguyên',
            'numeric' => ':attribute phải là số', 'min' => ':attribute quá nhỏ',
        ], [
            'teacher_id' => 'Giáo viên', 'plan_date' => 'Ngày dự giờ', 'observed_on' => 'Ngày dự giờ', 'kind' => 'Hình thức',
            'title' => 'Tiêu đề', 'teacher_comment' => 'Phản hồi của giáo viên', 'priority' => 'Mức ưu tiên', 'description' => 'Mô tả', 'score_professional' => 'Điểm chuyên môn', 'score_results' => 'Điểm kết quả giảng dạy', 'score_conduct' => 'Điểm phẩm chất', 'score_innovation' => 'Điểm đổi mới', 'name' => 'Tên', 'code' => 'Mã', 'reason' => 'Lý do', 'due_date' => 'Hạn hoàn thành',
        ]);
        if ($v->fails()) {
            return $this->error($v->errors()->first(), 422);
        }
        return null;
    }

    protected function nullable($v)
    {
        $v = is_string($v) ? trim($v) : $v;
        return $v === '' ? null : $v;
    }

    protected function semesterOf(string $date): int
    {
        $m = (int) date('n', strtotime($date));
        return ($m >= 9 || $m === 1) ? 1 : 2;   // tháng 9-12 và 1: HK1; tháng 2-8: HK2
    }
}
