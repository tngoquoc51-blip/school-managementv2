<?php

namespace Modules\Accountant\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Xác thực Bearer token của nhân sự (bảng sm_staff_tokens, lưu sha256 của token).
 *   - mode "read" : accountant, principal, vice_principal, super_admin, admin
 *   - mode "write": accountant, super_admin, admin
 * Đặt ACCOUNTANT_AUTH=false trong .env để tắt kiểm tra khi chạy thử trên máy (KHÔNG dùng trên server thật).
 */
class StaffTokenAuth
{
    public const READ_ROLES  = ['accountant', 'principal', 'vice_principal', 'super_admin', 'admin'];
    public const WRITE_ROLES = ['accountant', 'super_admin', 'admin'];

    public function handle(Request $request, Closure $next, string $mode = 'read')
    {
        if (filter_var(env('ACCOUNTANT_AUTH', true), FILTER_VALIDATE_BOOLEAN) === false) {
            $request->attributes->set('staff', (object) [
                'id' => 0, 'username' => 'dev', 'full_name' => 'Kế toán (chế độ thử)', 'role' => 'accountant',
            ]);
            return $next($request);
        }

        $token = $request->bearerToken();
        if (! $token) {
            return $this->deny('Bạn chưa đăng nhập.', 401);
        }

        $staff = DB::table('sm_staff_tokens as t')
            ->join('sm_staff_accounts as a', 'a.id', '=', 't.staff_id')
            ->where('t.token_hash', hash('sha256', $token))
            ->where('t.expires_at', '>', now()->format('Y-m-d H:i:s'))
            ->select('a.id', 'a.username', 'a.full_name', 'a.role', 'a.status')
            ->first();

        if (! $staff || $staff->status !== 'active') {
            return $this->deny('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.', 401);
        }

        $allowed = $mode === 'write' ? self::WRITE_ROLES : self::READ_ROLES;
        if (! in_array($staff->role, $allowed, true)) {
            return $this->deny($mode === 'write'
                ? 'Tài khoản của bạn chỉ có quyền xem, không được thao tác này.'
                : 'Bạn không có quyền truy cập khu vực Kế toán.', 403);
        }

        $request->attributes->set('staff', $staff);
        return $next($request);
    }

    private function deny(string $message, int $status)
    {
        return response()->json(['success' => false, 'message' => $message], $status);
    }
}
