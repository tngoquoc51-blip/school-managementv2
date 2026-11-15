<?php

namespace Modules\Catalog\Repositories;

use Modules\Catalog\Models\Room;

class RoomRepository extends CatalogRepository
{
    protected array $searchable = ['code', 'name', 'building', 'facilities'];

    protected array $filterable = ['room_type' => 'room_type', 'building' => 'building', 'room_status' => 'status'];

    protected array $sortable = ['id', 'code', 'name', 'room_type', 'building', 'floor', 'capacity', 'status', 'sort_order', 'is_active', 'created_at', 'updated_at'];

    public function __construct(Room $model)
    {
        parent::__construct($model);
    }
}
