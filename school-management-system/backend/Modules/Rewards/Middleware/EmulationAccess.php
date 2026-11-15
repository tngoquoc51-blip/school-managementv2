<?php

namespace Modules\Rewards\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Nhận diện người dùng giống BghApprovalController:
 *   1) token nhân sự (sm_staff_tokens + sm_staff_accounts, băm sha256)
 *   2) token Sanctum (bảng users + vai trò Spatie) – dùng cho tài khoản đăng nhập kiểu "hệ thống"
 * Sau khi qua middleware, $request->user() là object {id, name, role, roles[], username}.
 */
class EmulationAccess
{
    /** Cùng danh sách vai trò với màn Phê duyệt của BGH */
    public const REVIEW = ['super_admin', 'principal', 'vice_principal', 'bgh', 'hieu_truong', 'pho_hieu_truong'];

    /** Xem, chấm điểm, đề xuất: BGH + giáo vụ */
    public const STAFF = ['super_admin', 'principal', 'vice_principal', 'bgh', 'hieu_truong', 'pho_hieu_truong', 'academic'];

    public static function can($user, string $level = 'staff'): bool
    {
        if (!$user) {
            return false;
        }
        $roles = $user->roles ?? [$user->role ?? ''];
        return (bool) array_intersect($roles, $level === 'review' ? self::REVIEW : self::STAFF);
    }

    private function viaStaffToken(string $token): ?object
    {
        $row = DB::table('sm_staff_tokens as t')
            ->join('sm_staff_accounts as a', 'a.id', '=', 't.staff_id')
            ->where('t.token_hash', hash('sha256', $token))
            ->where('t.expires_at', '>', now())
            ->where('a.status', 'active')
            ->first(['a.id', 'a.full_name', 'a.role', 'a.username']);
        if (!$row) {
            return null;
        }
        $role = strtolower((string) $row->role);
        return (object) ['id' => (int) $row->id, 'name' => $row->full_name, 'role' => $role, 'roles' => [$role], 'username' => $row->username];
    }

    private function viaSanctum(string $token): ?object
    {
        if (!class_exists(\Laravel\Sanctum\PersonalAccessToken::class)) {
            return null;
        }
        $u = \Laravel\Sanctum\PersonalAccessToken::findToken($token)?->tokenable;
        if (!$u) {
            return null;
        }
        $roles = [];
        if (method_exists($u, 'getRoleNames')) {
            $roles = $u->getRoleNames()->map(fn ($x) => strtolower((string) $x))->all();
        }
        if (is_string($u->role ?? null)) {
            $roles[] = strtolower($u->role);
        }
        $roles = array_values(array_unique($roles));
        return (object) [
            'id' => (int) $u->id, 'name' => (string) ($u->name ?? $u->email ?? 'Người dùng'),
            'role' => $roles[0] ?? '', 'roles' => $roles, 'username' => $u->username ?? $u->email ?? null,
        ];
    }

    public function handle(Request $request, Closure $next, string $level = 'staff')
    {
        $token = $request->bearerToken();
        $user = $token ? ($this->viaStaffToken($token) ?? $this->viaSanctum($token)) : null;

        if (!$user) {
            return response()->json(['message' => 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'], 401);
        }
        if (!self::can($user, $level)) {
            $have = implode(', ', $user->roles ?: ['không xác định']);
            return response()->json([
                'message' => ($level === 'review'
                    ? 'Chỉ Ban Giám hiệu mới có quyền thực hiện thao tác này.'
                    : 'Bạn không có quyền truy cập phân hệ này.') . " (vai trò hiện tại: $have)",
            ], 403);
        }
        $request->setUserResolver(fn () => $user);
        return $next($request);
    }
}
