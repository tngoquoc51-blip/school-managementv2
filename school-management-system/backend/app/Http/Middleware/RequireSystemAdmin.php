<?php

namespace App\Http\Middleware;

use App\Support\AuditLogger;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Phân quyền trang Nhật ký hệ thống (đọc theo vai trò Spatie trong bảng roles / model_has_roles):
 *   :read   → super_admin, admin, principal, vice_principal   (xem nhật ký, ghim, lưu bộ lọc)
 *   :manage → super_admin, admin                               (quy tắc cảnh báo, dọn dẹp, mở khóa, cài đặt)
 * Dùng:  ->middleware(RequireSystemAdmin::class . ':manage')
 */
class RequireSystemAdmin
{
    public const MANAGE = ['super_admin', 'admin'];
    public const READ = ['super_admin', 'admin', 'principal', 'vice_principal'];

    public function handle(Request $request, Closure $next, string $level = 'read'): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Bạn chưa đăng nhập hoặc phiên đã hết hạn.'], 401);
        }

        if (! self::can($user, $level)) {
            AuditLogger::log([
                'level' => 'warning', 'category' => 'security', 'action' => 'security.access_denied',
                'actor_type' => 'admin', 'actor_id' => $user->id, 'actor_name' => $user->name ?? null,
                'summary' => 'Bị từ chối truy cập Nhật ký hệ thống (' . $level . '): ' . $request->method() . ' ' . $request->path(),
                'status_code' => 403, 'skip_alerts' => false,
            ], $request);

            return response()->json(['success' => false, 'message' => 'Bạn không có quyền thực hiện thao tác này.'], 403);
        }

        return $next($request);
    }

    public static function can(object $user, string $level = 'read'): bool
    {
        return (bool) array_intersect(self::roles($user), $level === 'manage' ? self::MANAGE : self::READ);
    }

    /** Hỗ trợ cả hai kiểu model_type đang tồn tại trong database của dự án. */
    public static function roles(object $user): array
    {
        return DB::table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('model_has_roles.model_id', $user->id)
            ->whereIn('model_has_roles.model_type', array_unique([get_class($user), 'App\\Models\\User', 'Modules\\User\\Models\\User']))
            ->pluck('roles.name')->all();
    }
}
