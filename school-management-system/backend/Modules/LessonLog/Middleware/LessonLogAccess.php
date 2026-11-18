<?php

namespace Modules\LessonLog\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Xác thực cho Sổ đầu bài. Nhận cả token nhân sự (sm_staff_tokens) và token Sanctum.
 * $request->user() → {id, name, role, roles[], teacher_id, is_bgh}
 *  - Giáo viên (có teacher_id): xem lớp chủ nhiệm + lớp mình dạy, ghi sổ tiết của mình / cả lớp chủ nhiệm.
 *  - Ban Giám hiệu / giáo vụ: xem mọi lớp, duyệt sổ tuần (không ghi thay giáo viên).
 */
class LessonLogAccess
{
    public const BGH = ['super_admin', 'principal', 'vice_principal', 'bgh', 'hieu_truong', 'pho_hieu_truong', 'academic'];

    private function viaStaffToken(string $token): ?object
    {
        $row = DB::table('sm_staff_tokens as t')
            ->join('sm_staff_accounts as a', 'a.id', '=', 't.staff_id')
            ->where('t.token_hash', hash('sha256', $token))->where('t.expires_at', '>', now()->toDateTimeString())
            ->where('a.status', 'active')->first(['a.id', 'a.full_name', 'a.role', 'a.teacher_id']);
        return $row ? $this->make($row->id, $row->full_name, [strtolower((string) $row->role)], $row->teacher_id) : null;
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
        $tid = DB::table('sm_teacher_users')->where('user_id', $u->id)->value('teacher_id');
        if (!$tid) {
            $login = $u->username ?? $u->email ?? null;
            $tid = $login ? DB::table('sm_staff_accounts')->where('username', $login)->value('teacher_id') : null;
        }
        return $this->make($u->id, (string) ($u->name ?? $u->email ?? 'Người dùng'), $roles, $tid);
    }

    private function make($id, string $name, array $roles, $teacherId): object
    {
        $roles = array_values(array_unique(array_filter($roles)));
        return (object) [
            'id' => (int) $id, 'name' => $name, 'role' => $roles[0] ?? '', 'roles' => $roles,
            'teacher_id' => $teacherId ? (int) $teacherId : null, 'is_bgh' => (bool) array_intersect($roles, self::BGH),
        ];
    }

    public function handle(Request $request, Closure $next, string $level = 'view')
    {
        $tk = $request->bearerToken();
        $user = $tk ? ($this->viaStaffToken($tk) ?? $this->viaSanctum($tk)) : null;
        if (!$user) {
            return response()->json(['message' => 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'], 401);
        }
        if (!$user->is_bgh && !$user->teacher_id) {
            return response()->json(['message' => 'Tài khoản chưa được gắn với hồ sơ giáo viên nên chưa dùng được Sổ đầu bài. Hãy liên hệ quản trị hệ thống.'], 403);
        }
        if ($level === 'bgh' && !$user->is_bgh) {
            return response()->json(['message' => 'Chức năng này chỉ dành cho Ban Giám hiệu.'], 403);
        }
        $request->setUserResolver(fn () => $user);
        return $next($request);
    }
}
