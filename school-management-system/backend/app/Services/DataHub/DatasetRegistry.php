<?php

namespace App\Services\DataHub;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Đọc cấu hình config/data_hub.php và đối chiếu với CSDL thật. */
class DatasetRegistry
{
    public function all(): array
    {
        return (array) config('data_hub.datasets', []);
    }

    public function get(string $id): array
    {
        $d = $this->all()[$id] ?? null;
        if (! $d) {
            abort(404, 'Không tìm thấy loại dữ liệu này.');
        }
        $d['id'] = $id;
        return $d;
    }

    public function exists(array $d): bool
    {
        return Schema::hasTable($d['table']);
    }

    public function tableColumns(array $d): array
    {
        return $this->exists($d) ? Schema::getColumnListing($d['table']) : [];
    }

    /** Các trường có cột thật trong bảng. */
    public function usableFields(array $d): array
    {
        $cols = $this->tableColumns($d);
        return array_filter($d['fields'], fn ($f, $k) => in_array($k, $cols, true), ARRAY_FILTER_USE_BOTH);
    }

    public function missingFields(array $d): array
    {
        $cols = $this->tableColumns($d);
        return array_values(array_diff(array_keys($d['fields']), $cols));
    }

    public function count(array $d): ?int
    {
        if (! $this->exists($d)) {
            return null;
        }
        $q = DB::table($d['table']);
        if (Schema::hasColumn($d['table'], 'deleted_at')) {
            $q->whereNull('deleted_at');
        }
        return $q->count();
    }

    /** Thông tin gửi cho giao diện. */
    public function meta(string $id): array
    {
        $d = $this->get($id);
        $usable = $this->usableFields($d);
        $fields = [];
        foreach ($d['fields'] as $k => $f) {
            $fields[] = [
                'key'      => $k,
                'label'    => $f['label'],
                'type'     => $f['type'] ?? 'text',
                'required' => in_array('required', $f['rules'] ?? [], true),
                'aliases'  => $f['aliases'] ?? [],
                'usable'   => isset($usable[$k]),
                'sensitive' => in_array($k, $d['sensitive'] ?? [], true),
                'lookup'   => isset($f['lookup']),
            ];
        }

        return [
            'id' => $id, 'title' => $d['title'], 'noun' => $d['noun'], 'icon' => $d['icon'] ?? 'folder',
            'table_exists' => $this->exists($d), 'count' => $this->count($d),
            'upsert' => $d['upsert'], 'fields' => $fields,
            'missing' => $this->missingFields($d),
            'has_account' => isset($d['account']) && Schema::hasColumn($d['table'], $d['account']['password'] ?? ''),
        ];
    }
}
