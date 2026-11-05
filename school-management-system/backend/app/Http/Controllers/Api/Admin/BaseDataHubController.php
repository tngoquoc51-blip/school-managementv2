<?php

namespace App\Http\Controllers\Api\Admin;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

abstract class BaseDataHubController extends Controller
{
    protected function ok($data = null, string $message = 'OK', array $extra = [], int $code = 200): JsonResponse
    {
        return response()->json(array_merge(['success' => true, 'message' => $message, 'data' => $data], $extra), $code);
    }

    protected function run(callable $fn): JsonResponse
    {
        try {
            return $fn();
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => collect($e->errors())->flatten()->first() ?? 'Dữ liệu không hợp lệ.',
                'data'    => null,
                'errors'  => $e->errors(),
            ], 422);
        }
    }

    protected function uid(Request $r): ?int
    {
        return $r->user()?->getAuthIdentifier();
    }

    /** Gắn tên người thực hiện (nếu có bảng users). */
    protected function withUsers(array $rows, string $field = 'created_by'): array
    {
        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'name')) {
            return $rows;
        }
        $ids = array_values(array_unique(array_filter(array_map(fn ($r) => $r[$field] ?? null, $rows))));
        $names = $ids ? \Illuminate\Support\Facades\DB::table('users')->whereIn('id', $ids)->pluck('name', 'id')->all() : [];
        foreach ($rows as &$r) {
            $r['user_name'] = $names[$r[$field] ?? 0] ?? null;
        }
        return $rows;
    }
}
