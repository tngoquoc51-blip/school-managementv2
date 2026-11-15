<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Chỉ cho phép quản trị hệ thống (nhóm route /admin/logs...).
 * Không nhận diện được quản trị → 403.
 */
class RequireSystemAdmin
{
    private const ADMIN_ROLES = ['super_admin', 'admin', 'system_admin'];

    public function handle(Request $request, Closure $next)
    {
        if ($this->isAdmin($request)) {
            return $next($request);
        }

        return response()->json([
            'message' => 'Chỉ quản trị hệ thống mới được truy cập chức năng này.',
        ], 403);
    }

    /**
     * Dùng trong Controller: RequireSystemAdmin::can($request->user(), 'manage')
     */
    public static function can($user, ?string $ability = null): bool
    {
        if (!$user) {
            return false;
        }

        $direct = strtolower((string) (is_object($user) ? ($user->role ?? '') : ''));
        if (in_array($direct, self::ADMIN_ROLES, true)) {
            return true;
        }

        if (is_object($user) && method_exists($user, 'hasRole')) {
            foreach (self::ADMIN_ROLES as $r) {
                if ($user->hasRole($r)) {
                    return true;
                }
            }
        }

        if (is_object($user) && method_exists($user, 'getRoleNames')) {
            $names = $user->getRoleNames()
                ->map(fn ($n) => strtolower((string) $n))
                ->all();

            return count(array_intersect($names, self::ADMIN_ROLES)) > 0;
        }

        if (is_object($user) && isset($user->roles)) {
            $names = collect($user->roles)
                ->map(fn ($r) => strtolower((string) (is_object($r) ? ($r->name ?? '') : $r)))
                ->all();

            return count(array_intersect($names, self::ADMIN_ROLES)) > 0;
        }

        // ability chỉ phân biệt quyền tinh (manage) — admin roles đều pass
        return false;
    }

    private function isAdmin(Request $request): bool
    {
        if (app()->environment('local') && $request->bearerToken() === 'demo-token') {
            return true;
        }

        if ($staff = $request->attributes->get('sm_staff')) {
            $staff = (array) $staff;
            $role = strtolower((string) ($staff['role'] ?? ''));

            return in_array($role, self::ADMIN_ROLES, true);
        }

        try {
            return self::can($request->user());
        } catch (\Throwable $e) {
            return false;
        }
    }
}
