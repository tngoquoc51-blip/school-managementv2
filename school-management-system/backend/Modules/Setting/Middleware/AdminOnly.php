<?php

namespace Modules\Setting\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Setting\Services\SettingService;

/** Chỉ super_admin; nếu có danh sách IP cho phép (Cài đặt > Bảo mật) thì kiểm tra thêm. */
class AdminOnly
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if (! $user || ! $user->hasRole('super_admin')) {
            return response()->json(['success' => false, 'message' => 'Bạn không có quyền truy cập khu vực Cài đặt hệ thống.'], 403);
        }

        $list = (string) app(SettingService::class)->get('security', 'admin_ip_whitelist', '');
        $allowed = array_filter(array_map('trim', preg_split('/[\s,;]+/', $list) ?: []));
        if ($allowed) {
            $allowed = array_merge($allowed, ['127.0.0.1', '::1']); // luôn cho phép localhost để không tự khóa mình
            if (! in_array($request->ip(), $allowed, true)) {
                return response()->json(['success' => false, 'message' => 'IP ' . $request->ip() . ' không nằm trong danh sách được phép.'], 403);
            }
        }
        return $next($request);
    }
}
