<?php

namespace Modules\Catalog\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/** Nhóm danh mục dùng chung (Dân tộc, Tôn giáo, Lý do vắng...). */
class CatalogGroup extends CatalogModel
{
    protected $table = 'cat_groups';

    protected $casts = ['is_system' => 'boolean', 'is_active' => 'boolean', 'sort_order' => 'integer'];

    public function items(): HasMany
    {
        return $this->hasMany(CatalogItem::class, 'group_id');
    }
}
