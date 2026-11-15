<?php

namespace Modules\Catalog\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class SubjectResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'short_name' => $this->short_name,
            'subject_group' => $this->subject_group,
            'department_id' => $this->department_id,
            'department' => $this->whenLoaded('department', fn () => $this->department
                ? ['id' => $this->department->id, 'code' => $this->department->code, 'name' => $this->department->name]
                : null),
            'periods_per_week' => $this->periods_per_week,
            'coefficient' => $this->coefficient,
            'kind' => $this->kind,
            'grading_type' => $this->grading_type,
            'applicable_grades' => $this->applicable_grades ?? [],
            'description' => $this->description,
            'color' => $this->color,
            'sort_order' => $this->sort_order,
            'is_system' => $this->is_system,
            'is_active' => $this->is_active,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
