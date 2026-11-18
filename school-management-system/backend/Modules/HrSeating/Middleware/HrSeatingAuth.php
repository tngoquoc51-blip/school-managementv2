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
        if (! $token) {
            return $this->deny('Chưa đăng nhập', 401);
        }

        $staff = DB::selectOne(
            'SELECT a.id, a.username, a.full_name, a.role, a.status
             FROM sm_staff_tokens t JOIN sm_staff_accounts a ON a.id = t.staff_id
             WHERE t.token_hash = ? AND t.expires_at > NOW() LIMIT 1', [hash('sha256', $token)]);
        if (! $staff || $staff->status !== 'active') {
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
