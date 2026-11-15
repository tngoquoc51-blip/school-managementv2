<?php

namespace Modules\Catalog\Models;

/** Phòng học / phòng chức năng. */
class Room extends CatalogModel
{
    protected $table = 'cat_rooms';

    protected $casts = ['is_system' => 'boolean', 'is_active' => 'boolean', 'sort_order' => 'integer', 'floor' => 'integer', 'capacity' => 'integer'];
}
