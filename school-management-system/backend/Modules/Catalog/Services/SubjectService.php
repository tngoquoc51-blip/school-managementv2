<?php

namespace Modules\Catalog\Services;

use Illuminate\Database\Eloquent\Model;
use Modules\Catalog\Repositories\SubjectRepository;

class SubjectService extends CatalogService
{
    public const GROUPS = ['natural' => 'Khoa học tự nhiên', 'social' => 'Khoa học xã hội', 'language' => 'Ngôn ngữ', 'math_tech' => 'Toán – Công nghệ – Tin', 'art' => 'Nghệ thuật', 'skill' => 'Giáo dục – Trải nghiệm', 'other' => 'Khác'];
    public const KINDS = ['required' => 'Bắt buộc', 'elective' => 'Lựa chọn', 'specialized' => 'Chuyên đề'];
    public const GRADING = ['score' => 'Tính điểm', 'comment' => 'Nhận xét'];

    protected string $entity = 'subject';

    public function __construct(SubjectRepository $repository, AuditService $audit)
    {
        parent::__construct($repository, $audit);
    }

    protected function exportColumns(): array
    {
        return [
            'Mã môn' => 'code',
            'Tên môn' => 'name',
            'Tên viết tắt' => 'short_name',
            'Nhóm môn' => fn (Model $m) => self::GROUPS[$m->subject_group] ?? $m->subject_group,
            'Tổ chuyên môn' => fn (Model $m) => $m->department?->name,
            'Số tiết/tuần' => 'periods_per_week',
            'Hệ số' => 'coefficient',
            'Tính chất' => fn (Model $m) => self::KINDS[$m->kind] ?? $m->kind,
            'Hình thức đánh giá' => fn (Model $m) => self::GRADING[$m->grading_type] ?? $m->grading_type,
            'Khối áp dụng' => fn (Model $m) => implode(', ', $m->applicable_grades ?? []),
            'Trạng thái' => fn (Model $m) => $this->yesNo($m),
        ];
    }
}
