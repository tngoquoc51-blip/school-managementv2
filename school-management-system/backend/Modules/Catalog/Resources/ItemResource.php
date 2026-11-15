<?php

namespace Modules\Catalog\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ItemResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'group_id' => $this->group_id,
            'code' => $this->code,
            'name' => $this->name,
            'short_name' => $this->short_name,
            'value' => $this->value,
            'description' => $this->description,
            'color' => $this->color,
            'sort_order' => $this->sort_order,
            'is_system' => $this->is_system,
            'is_active' => $this->is_active,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
