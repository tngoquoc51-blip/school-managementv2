<?php

namespace Modules\Catalog\Repositories;

use Modules\Catalog\Models\CatalogItem;

class ItemRepository extends CatalogRepository
{
    protected array $searchable = ['code', 'name', 'short_name', 'description'];

    protected array $filterable = ['group_id' => 'group_id'];

    protected array $sortable = ['id', 'code', 'name', 'value', 'sort_order', 'is_active', 'created_at', 'updated_at'];

    public function __construct(CatalogItem $model)
    {
        parent::__construct($model);
    }
}
