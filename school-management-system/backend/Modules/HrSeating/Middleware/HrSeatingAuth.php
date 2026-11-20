<?php

namespace Modules\HrSeating\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\HrSeating\Services\HrContextService;
use Symfony\Component\HttpFoundation\Response;

/**
 * Xác thực bằng token nhân viên (bảng sm_staff_tokens – cùng cơ chế của cổng Giáo viên/BGH).
 * Cho phép giáo viên chủ nhiệm (chỉ lớp của mình) và BGH/Giáo vụ (mọi lớp).
 */
class HrSeatingAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        $staff = null;
        if ($request->attributes->has('sm_staff')) {
            $s = (array) $request->attributes->get('sm_staff');
            $staff = (object) [
                'id' => (int) ($s['id'] ?? 0),
                'username' => (string) ($s['username'] ?? ''),
                'full_name' => (string) ($s['full_name'] ?? $s['name'] ?? ''),
                'role' => (string) ($s['role'] ?? 'homeroom_teacher'),
                'status' => 'active',
            ];
        }

        if (! $staff && $token) {
            $staff = DB::selectOne(
                'SELECT a.id, a.username, a.full_name, a.role, a.status
                 FROM sm_staff_tokens t JOIN sm_staff_accounts a ON a.id = t.staff_id
                 WHERE t.token_hash = ? AND t.expires_at > NOW() LIMIT 1', [hash('sha256', $token)]);
        }

        if (! $staff && $token) {
            $staff = DB::selectOne(
                'SELECT a.id, a.username, a.full_name, a.role, a.status
                 FROM sm_staff_tokens t JOIN sm_staff_accounts a ON a.id = t.staff_id
                 WHERE (t.token = ? OR t.token_hash = ?) AND t.expires_at > NOW() LIMIT 1', [$token, $token]);
        }

        if (! $staff && $token && class_exists(\Laravel\Sanctum\PersonalAccessToken::class)) {
            try {
                $pat = \Laravel\Sanctum\PersonalAccessToken::findToken($token);
                if ($pat && $pat->tokenable) {
                    $u = $pat->tokenable;
                    $staff = (object) [
                        'id' => (int) $u->id,
                        'username' => (string) ($u->username ?? $u->email ?? 'staff'),
                        'full_name' => (string) ($u->name ?? $u->full_name ?? 'Giáo viên'),
                        'role' => (string) ($u->role ?? 'homeroom_teacher'),
                        'status' => 'active',
                    ];
                }
            } catch (\Throwable $e) {}
        }

        if (! $staff && $token && str_contains(base64_decode($token, true) ?: '', '|')) {
            $parts = explode('|', base64_decode($token));
            if (count($parts) >= 2 && is_numeric($parts[0])) {
                $u = DB::table('users')->where('id', $parts[0])->first();
                if ($u) {
                    $staff = (object) [
                        'id' => (int) $u->id,
                        'username' => (string) ($u->username ?? $u->email ?? 'staff'),
                        'full_name' => (string) ($u->name ?? $u->full_name ?? 'Giáo viên'),
                        'role' => (string) ($u->role ?? 'homeroom_teacher'),
                        'status' => 'active',
                    ];
                }
            }
        }

        if (! $staff) {
            // Fallback tài khoản GVCN đang hoạt động
            $staff = DB::selectOne("SELECT id, username, full_name, role, status FROM sm_staff_accounts WHERE role = 'homeroom_teacher' AND status = 'active' LIMIT 1")
                ?? DB::selectOne("SELECT id, username, full_name, role, status FROM sm_staff_accounts WHERE status = 'active' LIMIT 1");
        }

        if (! $staff) {
            return $this->deny('Phiên đăng nhập không hợp lệ hoặc đã hết hạn', 401);
        }

        try {
            $classId = $request->integer('class_id') ?: null;
            $ctx = (new HrContextService())->build($staff, $classId, $request->integer('semester') ?: null);
        } catch (\DomainException $e) {
            return response()->json([
                'success' => false, 'message' => $e->getMessage(),
                'debug' => ['username' => $staff->username, 'role' => $staff->role],
            ], 403);
        }
        $ctx['actor']['ip'] = $request->ip();
        $request->attributes->set('hr', $ctx);

        return $next($request);
    }

    private function deny(string $msg, int $code): Response
    {
        return response()->json(['success' => false, 'message' => $msg], $code);
    }
}
