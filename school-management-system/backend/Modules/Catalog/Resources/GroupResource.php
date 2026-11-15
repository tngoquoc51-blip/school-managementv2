<?php

namespace Modules\Catalog\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class GroupResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'icon' => $this->icon,
            'color' => $this->color,
            'sort_order' => $this->sort_order,
            'is_system' => $this->is_system,
            'is_active' => $this->is_active,
            'items_count' => $this->whenCounted('items'),
            'active_items_count' => $this->when(isset($this->active_items_count), fn () => (int) $this->active_items_count),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
