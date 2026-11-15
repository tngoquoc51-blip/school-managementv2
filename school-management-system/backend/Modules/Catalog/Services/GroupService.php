<?php

namespace Modules\Catalog\Services;

use Illuminate\Database\Eloquent\Model;
use Modules\Catalog\Exceptions\CatalogException;
use Modules\Catalog\Repositories\GroupRepository;

class GroupService extends CatalogService
{
    protected string $entity = 'group';

    public function __construct(GroupRepository $repository, AuditService $audit)
    {
        parent::__construct($repository, $audit);
    }

    protected function exportColumns(): array
    {
        return [
            'Mã nhóm' => 'code',
            'Tên nhóm' => 'name',
            'Mô tả' => 'description',
            'Số mục' => 'items_count',
            'Thứ tự' => 'sort_order',
            'Trạng thái' => fn (Model $m) => $this->yesNo($m),
        ];
    }

    protected function assertDeletable(Model $model, bool $force): void
    {
        parent::assertDeletable($model, $force);

        $count = $model->items()->count();
        if ($count > 0 && ! $force) {
            throw new CatalogException("Nhóm \"{$model->getAttribute('name')}\" còn {$count} mục. Xóa nhóm sẽ xóa luôn các mục này (vẫn khôi phục được từ nhật ký).", 409, ['items_count' => $count]);
        }
    }

    /** Lưu kèm toàn bộ mục để khôi phục nhóm là lấy lại được cả danh sách. */
    protected function deleteSnapshot(Model $model): array
    {
        $snapshot = $this->snapshot($model);
        $snapshot['items'] = $model->items()->get()->map(fn ($i) => array_diff_key($i->attributesToArray(), ['created_at' => 1, 'updated_at' => 1]))->all();

        return $snapshot;
    }
}
