<?php

namespace Modules\Logs\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Logs\Support\AuditLogger;
use Modules\Logs\Support\Clock;

/**
 * Xác thực người dùng rồi chỉ cho Ban Giám hiệu / Quản trị xem nhật ký.
 * Hỗ trợ 3 kiểu token (thử lần lượt):
 *   1) Laravel Sanctum  — đăng nhập qua /auth/login (users + vai trò Spatie)  ← trang đăng nhập BGH hiện tại
 *   2) AcademicRepo::authenticate — token nhân viên khu Giáo vụ (/gv/login)
 *   3) Bảng sm_staff_tokens (token_hash = sha256)
 */
class BghAccess
{
    public const READ_ROLES  = ['principal', 'vice_principal', 'super_admin'];
    public const ADMIN_ROLES = ['principal', 'super_admin'];

    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken() ?: $request->query('access_token');
        if (! $token) {
            return $this->deny(401, 'Chưa đăng nhập');
        }

        $diag = [];
        $who = $this->viaSanctum($diag)
            ?? $this->viaSanctumToken($token, $diag)
            ?? $this->viaAcademicRepo($token, $diag)
            ?? $this->viaTokenTable($token, $diag);

        if (! $who) {
            // "chẩn đoán" chỉ nêu kết quả từng cách xác thực, không chứa token
            return $this->deny(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn (' . implode('; ', $diag) . ')');
        }

        if (! array_intersect($who['roles'], self::READ_ROLES)) {
            AuditLogger::log([
                'module' => 'security', 'action' => 'access.denied', 'severity' => 'warning', 'status' => 'denied',
                'actor_type' => 'staff', 'actor_id' => $who['id'], 'actor_name' => $who['full_name'], 'actor_role' => $who['roles'][0] ?? null,
                'summary' => "{$who['full_name']} (" . implode(',', $who['roles']) . ') cố truy cập Nhật ký hệ thống',
            ]);
            return $this->deny(403, 'Chỉ Ban Giám hiệu mới được xem nhật ký hệ thống (vai trò hiện có: ' . (implode(', ', $who['roles']) ?: 'không có') . ')');
        }

        $roles = array_values(array_intersect(self::READ_ROLES, $who['roles']));
        $role  = in_array('principal', $roles, true) ? 'principal' : (in_array('super_admin', $roles, true) ? 'super_admin' : $roles[0]);

        $request->attributes->set('log_actor', [
            'id' => $who['id'], 'username' => $who['username'], 'full_name' => $who['full_name'],
            'role' => $role, 'token_id' => $who['token_id'] ?? null, 'token_kind' => $who['token_kind'] ?? 'staff',
            'can_admin' => (bool) array_intersect(self::ADMIN_ROLES, $roles),
        ]);
        $request->attributes->set('log_request_id', (string) Str::uuid());

        return $next($request);
    }

    /** Sanctum: đăng nhập qua /auth/login (bảng users + Spatie roles). */
    private function viaSanctum(array &$diag): ?array
    {
        try {
            $user = Auth::guard('sanctum')->user();
        } catch (\Throwable $e) {
            $diag[] = 'Sanctum lỗi: ' . class_basename($e);
            return null;
        }
        if (! $user) {
            $diag[] = 'Sanctum: không khớp';
            return null;
        }

        $roles = [];
        if (method_exists($user, 'getRoleNames')) {
            $roles = $user->getRoleNames()->all();
        }
        foreach (['role', 'role_name', 'role_code'] as $attr) {
            if (! empty($user->{$attr}) && is_string($user->{$attr})) {
                $roles[] = $user->{$attr};
            }
        }

        $tokenId = null;
        try { $tokenId = $user->currentAccessToken()?->id; } catch (\Throwable $e) {}

        return [
            'id' => (int) $user->getAuthIdentifier(),
            'username' => (string) ($user->email ?? $user->username ?? ''),
            'full_name' => (string) ($user->name ?? $user->full_name ?? $user->email ?? ''),
            'roles' => array_values(array_unique($roles)),
            'token_id' => $tokenId ? (int) $tokenId : null, 'token_kind' => 'user',
        ];
    }

    /** Tra thẳng personal_access_tokens (không phụ thuộc guard / request nội bộ). */
    private function viaSanctumToken(string $token, array &$diag): ?array
    {
        try {
            $pat = \Laravel\Sanctum\PersonalAccessToken::findToken($token);
        } catch (\Throwable $e) {
            $diag[] = 'PAT lỗi: ' . class_basename($e);
            return null;
        }
        if (! $pat) {
            $diag[] = 'PAT: không tìm thấy token';
            return null;
        }
        if ($pat->expires_at && $pat->expires_at->isPast()) {
            $diag[] = 'PAT: token hết hạn';
            return null;
        }
        $user = $pat->tokenable;
        if (! $user) {
            $diag[] = 'PAT: không có user';
            return null;
        }

        $roles = method_exists($user, 'getRoleNames') ? $user->getRoleNames()->all() : [];
        foreach (['role', 'role_name', 'role_code'] as $attr) {
            if (! empty($user->{$attr}) && is_string($user->{$attr})) {
                $roles[] = $user->{$attr};
            }
        }

        return [
            'id' => (int) $user->getAuthIdentifier(),
            'username' => (string) ($user->email ?? $user->username ?? ''),
            'full_name' => (string) ($user->name ?? $user->full_name ?? $user->email ?? ''),
            'roles' => array_values(array_unique($roles)),
            'token_id' => (int) $pat->id, 'token_kind' => 'user',
        ];
    }

    /** Token nhân viên khu Giáo vụ (cùng cơ chế middleware StaffToken). */
    private function viaAcademicRepo(string $token, array &$diag): ?array
    {
        $repo = '\\App\\Support\\AcademicRepo';
        if (! class_exists($repo)) {
            $diag[] = 'AcademicRepo: không có';
            return null;
        }
        try {
            $staff = (new $repo(DB::connection()->getPdo()))->authenticate($token);
        } catch (\Throwable $e) {
            $diag[] = 'AcademicRepo lỗi: ' . class_basename($e);
            return null;
        }
        if (! $staff) {
            $diag[] = 'AcademicRepo: không khớp';
            return null;
        }

        $s = is_array($staff) ? $staff : (array) json_decode(json_encode($staff), true);
        $id = $s['id'] ?? $s['staff_id'] ?? null;
        $role = $s['role'] ?? $s['role_code'] ?? $s['role_name'] ?? null;
        if ($id === null || ! $role) {
            $diag[] = 'AcademicRepo trả về khoá: ' . implode(',', array_keys($s));
            return null;
        }

        return [
            'id' => (int) $id,
            'username' => (string) ($s['username'] ?? ''),
            'full_name' => (string) ($s['full_name'] ?? $s['name'] ?? $s['username'] ?? ''),
            'roles' => [(string) $role],
            'token_id' => $this->tokenId($token),
        ];
    }

    private function viaTokenTable(string $token, array &$diag): ?array
    {
        try {
            $row = DB::table('sm_staff_tokens as t')
                ->join('sm_staff_accounts as a', 'a.id', '=', 't.staff_id')
                ->where('t.token_hash', hash('sha256', $token))
                ->where('t.expires_at', '>', Clock::nowSql())
                ->where('a.status', 'active')
                ->first(['a.id', 'a.username', 'a.full_name', 'a.role', 't.id as token_id']);
        } catch (\Throwable $e) {
            $diag[] = 'sm_staff_tokens lỗi: ' . class_basename($e);
            return null;
        }
        if (! $row) {
            $diag[] = 'sm_staff_tokens: không khớp';
            return null;
        }

        return ['id' => (int) $row->id, 'username' => $row->username, 'full_name' => $row->full_name,
            'roles' => [$row->role], 'token_id' => (int) $row->token_id];
    }

    private function tokenId(string $token): ?int
    {
        try {
            $id = DB::table('sm_staff_tokens')->where('token_hash', hash('sha256', $token))->value('id');
            return $id ? (int) $id : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function deny(int $code, string $msg)
    {
        return response()->json(['success' => false, 'message' => $msg, 'errors' => null], $code);
    }
}
