<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Chỉ cho phép quản trị hệ thống (dùng cho nhóm route /admin/logs...).
 * Nguyên tắc an toàn: không nhận diện được quản trị thì TỪ CHỐI (403).
 */
class RequireSystemAdmin
{
    private const ADMIN_ROLES = ['super_admin', 'admin', 'system_admin'];

    public function handle(Request $request, Closure $next)
    {
        if ($this->isAdmin($request)) {
            return $next($request);
        }
        return response()->json(['message' => 'Chỉ quản trị hệ thống mới được truy cập chức năng này.'], 403);
    }

    private function isAdmin(Request $request): bool
    {
        // Môi trường local: cho phép demo-token (giống MonitorAccess)
        if (app()->environment('local') && $request->bearerToken() === 'demo-token') {
            return true;
        }

        // Nhân viên đăng nhập qua StaffToken (RequestMonitor đọc cùng thuộc tính 'sm_staff')
        if ($staff = $request->attributes->get('sm_staff')) {
            $staff = (array) $staff;
            return in_array($staff['role'] ?? '', self::ADMIN_ROLES, true);
        }

        // Tài khoản quản trị đăng nhập bằng Sanctum
        try {
            $user = $request->user();
            if ($user) {
                return in_array($user->role ?? '', self::ADMIN_ROLES, true);
            }
        } catch (\Throwable $e) {
            // chưa cấu hình guard → coi như không phải quản trị
        }
        return false;
    }
}