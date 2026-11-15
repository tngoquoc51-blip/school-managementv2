<?php

namespace Modules\Catalog\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Môn học (theo CTGDPT 2018). */
class Subject extends CatalogModel
{
    protected $table = 'cat_subjects';

    protected $casts = [
        'is_system' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'department_id' => 'integer',
        'periods_per_week' => 'float',
        'coefficient' => 'float',
        'applicable_grades' => 'array',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }
}
