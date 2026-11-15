<?php

namespace Modules\Catalog\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class DepartmentResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'head_name' => $this->head_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'sort_order' => $this->sort_order,
            'subjects_count' => $this->whenCounted('subjects'),
            'is_system' => $this->is_system,
            'is_active' => $this->is_active,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
