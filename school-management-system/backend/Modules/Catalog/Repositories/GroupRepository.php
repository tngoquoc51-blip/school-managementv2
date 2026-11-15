<?php

namespace Modules\Catalog\Repositories;

use Illuminate\Database\Eloquent\Builder;
use Modules\Catalog\Models\CatalogGroup;

class GroupRepository extends CatalogRepository
{
    protected array $sortable = ['id', 'code', 'name', 'sort_order', 'is_active', 'created_at', 'updated_at', 'items_count'];

    public function __construct(CatalogGroup $model)
    {
        parent::__construct($model);
    }

    protected function scope(Builder $q, array $filters): void
    {
        $q->withCount(['items', 'items as active_items_count' => fn ($i) => $i->where('is_active', true)]);
    }

    public function find(int $id)
    {
        return $this->model->newQuery()->withCount(['items', 'items as active_items_count' => fn ($i) => $i->where('is_active', true)])->findOrFail($id);
    }
}
