<?php

namespace Modules\Setting\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Modules\Setting\Services\SettingService;

/** Khi bật chế độ bảo trì: chặn API với mọi người trừ super_admin (vẫn cho đăng nhập). */
class MaintenanceGuard
{
    public function handle(Request $request, Closure $next)
    {
        $on = Cache::remember('sys_maintenance_flag', 15, function () {
            try { return app(SettingService::class)->get('maintenance', 'maintenance_on', '0') === '1'; }
            catch (\Throwable) { return false; }
        });

        if ($on && ! $request->is('api/v1/auth/*') && ! $request->is('api/health')) {
            $user = $request->user('sanctum');
            if (! $user || ! $user->hasRole('super_admin')) {
                return response()->json([
                    'success' => false,
                    'maintenance' => true,
                    'message' => app(SettingService::class)->get('maintenance', 'maintenance_message', 'Hệ thống đang bảo trì.'),
                ], 503);
            }
        }
        return $next($request);
    }
}
