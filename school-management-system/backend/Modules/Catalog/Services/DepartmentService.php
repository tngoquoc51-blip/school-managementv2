<?php

namespace Modules\Catalog\Services;

use Illuminate\Database\Eloquent\Model;
use Modules\Catalog\Exceptions\CatalogException;
use Modules\Catalog\Repositories\DepartmentRepository;

class DepartmentService extends CatalogService
{
    protected string $entity = 'department';

    public function __construct(DepartmentRepository $repository, AuditService $audit)
    {
        parent::__construct($repository, $audit);
    }

    protected function exportColumns(): array
    {
        return [
            'Mã tổ' => 'code',
            'Tên tổ' => 'name',
            'Tổ trưởng' => 'head_name',
            'Điện thoại' => 'phone',
            'Email' => 'email',
            'Số môn học' => 'subjects_count',
            'Trạng thái' => fn (Model $m) => $this->yesNo($m),
        ];
    }

    protected function assertDeletable(Model $model, bool $force): void
    {
        parent::assertDeletable($model, $force);

        $count = $model->subjects()->count();
        if ($count > 0) {
            throw new CatalogException("Tổ \"{$model->getAttribute('name')}\" đang có {$count} môn học. Hãy chuyển môn sang tổ khác trước khi xóa.", 409);
        }
    }
}
