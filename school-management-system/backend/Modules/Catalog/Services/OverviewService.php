<?php

namespace Modules\Catalog\Services;

use Modules\Catalog\Models\AuditLog;
use Modules\Catalog\Models\CatalogGroup;
use Modules\Catalog\Models\CatalogItem;
use Modules\Catalog\Models\Department;
use Modules\Catalog\Models\Room;
use Modules\Catalog\Models\Subject;

/** Số liệu tổng quan + cảnh báo chất lượng dữ liệu cho trang Danh mục. */
class OverviewService
{
    public function summary(): array
    {
        $count = fn (string $model) => [
            'total' => $model::query()->count(),
            'active' => $model::query()->where('is_active', true)->count(),
        ];

        $warnings = [];
        $add = function (int $n, string $level, string $msg, string $tab) use (&$warnings) {
            if ($n > 0) {
                $warnings[] = ['level' => $level, 'message' => str_replace(':n', (string) $n, $msg), 'tab' => $tab, 'count' => $n];
            }
        };

        $add(Subject::where('is_active', true)->whereNull('department_id')->count(), 'warning', ':n môn học đang dùng chưa gán tổ chuyên môn', 'subjects');
        $add(Department::where('is_active', true)->whereDoesntHave('subjects', fn ($q) => $q->where('is_active', true))->count(), 'info', ':n tổ chuyên môn chưa có môn học nào', 'departments');
        $add(Room::where('status', 'maintenance')->count(), 'warning', ':n phòng đang bảo trì', 'rooms');
        $add(Room::where('is_active', true)->where('capacity', '<=', 0)->count(), 'warning', ':n phòng chưa khai báo sức chứa', 'rooms');
        $add(CatalogGroup::where('is_active', true)->doesntHave('items')->count(), 'info', ':n nhóm danh mục chưa có mục nào', 'lookups');
        $add(Subject::where('is_active', true)->where('kind', 'required')->where('grading_type', 'score')->where('coefficient', '<=', 0)->count(), 'warning', ':n môn tính điểm có hệ số bằng 0', 'subjects');

        return [
            'counts' => [
                'groups' => $count(CatalogGroup::class),
                'items' => $count(CatalogItem::class),
                'subjects' => $count(Subject::class),
                'departments' => $count(Department::class),
                'rooms' => $count(Room::class),
            ],
            'room_capacity' => (int) Room::where('is_active', true)->sum('capacity'),
            'periods_per_week' => (float) Subject::where('is_active', true)->where('kind', 'required')->sum('periods_per_week'),
            'subjects_by_group' => $this->distribution(Subject::query(), 'subject_group', SubjectService::GROUPS),
            'rooms_by_type' => $this->distribution(Room::query(), 'room_type', RoomService::TYPES),
            'top_groups' => CatalogGroup::query()->withCount('items')->orderByDesc('items_count')->limit(6)->get(['id', 'code', 'name', 'color'])
                ->map(fn ($g) => ['id' => $g->id, 'code' => $g->code, 'name' => $g->name, 'color' => $g->color, 'items_count' => $g->items_count])->all(),
            'warnings' => $warnings,
            'recent' => AuditLog::query()->orderByDesc('id')->limit(8)->get()->map(fn ($l) => [
                'id' => $l->id, 'entity' => $l->entity, 'entity_label' => $l->entity_label, 'action' => $l->action,
                'user_name' => $l->user_name, 'created_at' => $l->created_at?->toIso8601String(),
            ])->all(),
        ];
    }

    private function distribution($query, string $column, array $labels): array
    {
        return $query->selectRaw("{$column} as k, count(*) as c")->groupBy($column)->orderByDesc('c')->get()
            ->map(fn ($r) => ['key' => $r->k, 'label' => $labels[$r->k] ?? $r->k, 'count' => (int) $r->c])->all();
    }
}
