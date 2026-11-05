<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Cổng vào module Giám sát hệ thống (/gv/monitor).
 *  - Token nhân viên thật (sm_staff_tokens), vai trò: Hiệu trưởng, Phó hiệu trưởng hoặc Quản trị.
 *  - CHỈ khi APP_ENV=local: chấp nhận "demo-token" của cổng demo. Trên máy chủ thật token demo bị từ chối.
 * Gắn thông tin nhân viên vào thuộc tính 'sm_staff' để RequestMonitor ghi nhật ký đúng người.
 */
class MonitorAccess
{
    private const ROLES = ['super_admin', 'principal', 'vice_principal'];
    private const LABELS = ['super_admin' => 'Quản trị', 'principal' => 'Hiệu trưởng', 'vice_principal' => 'Phó hiệu trưởng'];

    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        if (!$token) {
            return $this->deny('Thiếu token đăng nhập.', 401);
        }

        if (app()->environment('local') && $token === 'demo-token') {
            $request->attributes->set('sm_staff', [
                'id' => 0, 'username' => 'demo', 'name' => 'Hiệu trưởng (demo)', 'role' => 'principal', 'role_label' => 'Hiệu trưởng',
            ]);
            return $next($request);
        }

        $row = DB::selectOne(
            'SELECT a.id, a.username, a.full_name, a.role
               FROM sm_staff_tokens t JOIN sm_staff_accounts a ON a.id = t.staff_id
              WHERE t.token_hash = ? AND t.expires_at > NOW() LIMIT 1',
            [hash('sha256', $token)]
        );
        if (!$row) {
            return $this->deny('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', 401);
        }

        $role = strtolower((string) $row->role);
        if (!in_array($role, self::ROLES, true)) {
            return $this->deny('Chỉ Hiệu trưởng, Phó hiệu trưởng hoặc Quản trị được truy cập.', 403);
        }

        $request->attributes->set('sm_staff', [
            'id' => (int) $row->id, 'username' => $row->username, 'name' => $row->full_name,
            'role' => $role, 'role_label' => self::LABELS[$role] ?? $role,
        ]);
        return $next($request);
    }

    private function deny(string $message, int $status)
    {
        return response()->json(['message' => $message], $status);
    }
}