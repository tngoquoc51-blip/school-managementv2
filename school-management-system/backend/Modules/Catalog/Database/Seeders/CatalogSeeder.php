<?php

namespace Modules\Catalog\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Catalog\Models\CatalogGroup;
use Modules\Catalog\Models\CatalogItem;
use Modules\Catalog\Models\Department;
use Modules\Catalog\Models\Room;
use Modules\Catalog\Models\Subject;

/**
 * Nạp dữ liệu mẫu (đọc từ catalog_seed.json). Chạy lại nhiều lần an toàn: chỉ thêm cái còn thiếu,
 * không ghi đè dữ liệu bạn đã chỉnh.
 *
 *   php artisan db:seed --class="Modules\Catalog\Database\Seeders\CatalogSeeder"
 */
class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $data = json_decode(file_get_contents(__DIR__ . '/catalog_seed.json'), true, 512, JSON_THROW_ON_ERROR);

        foreach ($data['groups'] as $g) {
            $group = CatalogGroup::firstOrCreate(['code' => $g['code']], [
                'name' => $g['name'], 'description' => $g['description'], 'icon' => $g['icon'], 'color' => $g['color'],
                'is_system' => (bool) $g['is_system'], 'is_active' => true, 'sort_order' => CatalogGroup::max('sort_order') + 1,
            ]);

            foreach ($g['items'] as $i) {
                CatalogItem::firstOrCreate(['group_id' => $group->id, 'code' => $i['code']], [
                    'name' => $i['name'], 'short_name' => $i['short_name'] ?? null, 'value' => $i['value'] ?? null,
                    'color' => $i['color'] ?? null, 'sort_order' => $i['sort_order'], 'is_system' => (bool) $g['is_system'], 'is_active' => true,
                ]);
            }
        }

        $departments = [];
        foreach ($data['departments'] as $n => $d) {
            $departments[$d['code']] = Department::firstOrCreate(['code' => $d['code']], [
                'name' => $d['name'], 'description' => $d['description'], 'sort_order' => $n + 1, 'is_active' => true,
            ])->id;
        }

        foreach ($data['subjects'] as $s) {
            Subject::firstOrCreate(['code' => $s['code']], [
                'name' => $s['name'], 'short_name' => $s['short_name'], 'subject_group' => $s['subject_group'],
                'department_id' => $departments[$s['department']] ?? null, 'periods_per_week' => $s['periods_per_week'],
                'coefficient' => $s['coefficient'], 'kind' => $s['kind'], 'grading_type' => $s['grading_type'],
                'applicable_grades' => $s['applicable_grades'], 'color' => $s['color'], 'sort_order' => $s['sort_order'], 'is_active' => true,
            ]);
        }

        foreach ($data['rooms'] as $r) {
            Room::firstOrCreate(['code' => $r['code']], [
                'name' => $r['name'], 'room_type' => $r['room_type'], 'building' => $r['building'], 'floor' => $r['floor'],
                'capacity' => $r['capacity'], 'facilities' => $r['facilities'], 'status' => $r['status'],
                'sort_order' => $r['sort_order'], 'is_active' => true,
            ]);
        }
    }
}
