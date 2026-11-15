<?php

namespace Modules\Academic\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Academic\Support\Bgh;
use Symfony\Component\HttpFoundation\Response;

/**
 * Dùng SAU auth:sanctum. Chỉ cho phép Hiệu trưởng / Phó hiệu trưởng / Quản trị hệ thống.
 * Đọc vai trò trực tiếp từ bảng Spatie (model_has_roles) nên không phụ thuộc trait HasRoles.
 */
class EnsureBghAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Chưa đăng nhập'], 401);
        }

        $rows = DB::select(
            'SELECT r.name FROM model_has_roles mr JOIN roles r ON r.id = mr.role_id WHERE mr.model_id = ? AND mr.model_type IN (?, ?)',
            [$user->getKey(), get_class($user), 'App\\Models\\User']
        );
        $roles = array_map(fn ($r) => $r->name, $rows);

        if (! array_intersect($roles, Bgh::ROLES)) {
            return response()->json(['success' => false, 'message' => 'Bạn không có quyền truy cập khu vực Ban Giám hiệu'], 403);
        }

        return $next($request);
    }
}
