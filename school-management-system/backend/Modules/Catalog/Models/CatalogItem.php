<?php

namespace Modules\Catalog\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Một mục trong nhóm danh mục dùng chung. */
class CatalogItem extends CatalogModel
{
    protected $table = 'cat_items';

    protected $casts = ['is_system' => 'boolean', 'is_active' => 'boolean', 'sort_order' => 'integer', 'group_id' => 'integer'];

    public function group(): BelongsTo
    {
        return $this->belongsTo(CatalogGroup::class, 'group_id');
    }
}
