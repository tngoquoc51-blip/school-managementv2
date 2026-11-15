<?php

namespace Modules\Catalog\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class RoomResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'room_type' => $this->room_type,
            'building' => $this->building,
            'floor' => $this->floor,
            'capacity' => $this->capacity,
            'facilities' => $this->facilities,
            'status' => $this->status,
            'sort_order' => $this->sort_order,
            'is_system' => $this->is_system,
            'is_active' => $this->is_active,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
