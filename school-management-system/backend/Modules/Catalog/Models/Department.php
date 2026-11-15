<?php

namespace Modules\Catalog\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/** Tổ chuyên môn. */
class Department extends CatalogModel
{
    protected $table = 'cat_departments';

    protected $casts = ['is_system' => 'boolean', 'is_active' => 'boolean', 'sort_order' => 'integer'];

    public function subjects(): HasMany
    {
        return $this->hasMany(Subject::class, 'department_id');
    }
}
