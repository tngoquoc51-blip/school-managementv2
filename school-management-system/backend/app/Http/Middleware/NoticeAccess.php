<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Cổng vào API Thông báo Ban Giám hiệu (đặt tên NoticeAccess để không trùng Modules\Logs\Middleware\BghAccess) (/api/gv/notices/*).
 *  - Token nhân viên thật (StaffToken) và vai trò phải là: Hiệu trưởng, Phó hiệu trưởng hoặc Quản trị.
 *  - CHỈ khi APP_ENV=local: chấp nhận "demo-token" của cổng demo (vai Hiệu trưởng) để không phải đăng nhập lần 2.
 *    Trên máy chủ thật token demo bị từ chối.
 */
class NoticeAccess
{
    private const ROLES = ['super_admin', 'principal', 'vice_principal'];

    public function handle(Request $request, Closure $next)
    {
        if ($request->bearerToken() === 'demo-token' && config('app.env') === 'local') {
            $request->attributes->set('sm_staff', [
                'id' => 0, 'username' => 'bgh_demo', 'name' => 'Hiệu trưởng (demo)',
                'role' => 'principal', 'role_label' => 'Hiệu trưởng',
            ]);
            return $next($request);
        }

        $resp = app(StaffToken::class)->handle($request, function ($req) use ($next) {
            $role = (string) (((array) $req->attributes->get('sm_staff'))['role'] ?? '');
            if (!in_array($role, self::ROLES, true)) {
                return response()->json(['message' => 'Chức năng này chỉ dành cho Ban Giám hiệu.'], 403);
            }
            return $next($req);
        });
        return $resp;
    }
}
