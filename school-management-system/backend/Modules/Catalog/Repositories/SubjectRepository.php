<?php

namespace Modules\Catalog\Repositories;

use Illuminate\Database\Eloquent\Builder;
use Modules\Catalog\Models\Subject;

class SubjectRepository extends CatalogRepository
{
    protected array $searchable = ['code', 'name', 'short_name'];

    protected array $filterable = [
        'department_id' => 'department_id',
        'subject_group' => 'subject_group',
        'kind' => 'kind',
        'grading_type' => 'grading_type',
    ];

    protected array $sortable = ['id', 'code', 'name', 'subject_group', 'periods_per_week', 'coefficient', 'kind', 'sort_order', 'is_active', 'created_at', 'updated_at'];

    public function __construct(Subject $model)
    {
        parent::__construct($model);
    }

    protected function scope(Builder $q, array $filters): void
    {
        $q->with('department:id,code,name');
    }

    public function find(int $id)
    {
        return $this->model->newQuery()->with('department:id,code,name')->findOrFail($id);
    }
}
