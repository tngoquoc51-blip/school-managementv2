<?php

namespace App\Http\Controllers\Admin;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Mẫu ghép cột đã lưu của từng người dùng. */
class DataMappingController extends BaseDataHubController
{
    public function index(Request $r): JsonResponse
    {
        $rows = DB::table('admin_import_mappings')->where('user_id', $this->uid($r))
            ->when($r->filled('dataset'), fn ($q) => $q->where('dataset', $r->query('dataset')))
            ->orderBy('name')->get(['id', 'dataset', 'name', 'mapping'])
            ->map(fn ($m) => ['id' => (int) $m->id, 'dataset' => $m->dataset, 'name' => $m->name, 'mapping' => json_decode($m->mapping, true) ?: []])->all();

        return $this->ok($rows);
    }

    public function store(Request $r): JsonResponse
    {
        $v = $r->validate([
            'dataset' => ['required', 'string', 'max:40'],
            'name'    => ['required', 'string', 'max:100'],
            'mapping' => ['required', 'array', 'min:1'],
        ], ['name.required' => 'Vui lòng đặt tên cho mẫu ghép cột.']);

        $uid = $this->uid($r);
        $exists = DB::table('admin_import_mappings')->where(['user_id' => $uid, 'dataset' => $v['dataset'], 'name' => $v['name']])->exists();
        $row = ['mapping' => json_encode($v['mapping'], JSON_UNESCAPED_UNICODE), 'updated_at' => now()];
        if ($exists) {
            DB::table('admin_import_mappings')->where(['user_id' => $uid, 'dataset' => $v['dataset'], 'name' => $v['name']])->update($row);
        } else {
            DB::table('admin_import_mappings')->insert($row + ['user_id' => $uid, 'dataset' => $v['dataset'], 'name' => $v['name'], 'created_at' => now()]);
        }

        return $this->ok(null, $exists ? 'Đã cập nhật mẫu ghép cột.' : 'Đã lưu mẫu ghép cột.', [], 201);
    }

    public function destroy(Request $r, int $id): JsonResponse
    {
        DB::table('admin_import_mappings')->where(['id' => $id, 'user_id' => $this->uid($r)])->delete();

        return $this->ok(null, 'Đã xóa mẫu ghép cột.');
    }
}
