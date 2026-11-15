<?php

namespace Modules\Catalog\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'entity' => $this->entity,
            'entity_id' => $this->entity_id,
            'entity_label' => $this->entity_label,
            'action' => $this->action,
            'before' => $this->before,
            'after' => $this->after,
            'user_name' => $this->user_name,
            'ip' => $this->ip,
            'restored_at' => $this->restored_at?->toIso8601String(),
            'can_restore' => $this->action === 'delete' && ! $this->restored_at,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
