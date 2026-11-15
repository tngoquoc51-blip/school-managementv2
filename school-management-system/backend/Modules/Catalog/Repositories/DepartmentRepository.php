<?php

namespace Modules\Catalog\Repositories;

use Illuminate\Database\Eloquent\Builder;
use Modules\Catalog\Models\Department;

class DepartmentRepository extends CatalogRepository
{
    protected array $searchable = ['code', 'name', 'head_name'];

    protected array $sortable = ['id', 'code', 'name', 'sort_order', 'is_active', 'created_at', 'updated_at', 'subjects_count'];

    public function __construct(Department $model)
    {
        parent::__construct($model);
    }

    protected function scope(Builder $q, array $filters): void
    {
        $q->withCount('subjects');
    }

    public function find(int $id)
    {
        return $this->model->newQuery()->withCount('subjects')->findOrFail($id);
    }
}
