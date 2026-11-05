<?php

namespace Modules\Logs\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Logs\Support\AuditLogger;

/**
 * Ghi nhật ký TOÀN HỆ THỐNG vào sm_audit_logs (đăng ký 1 lần trong bootstrap/app.php):
 *   - đăng nhập thành công / thất bại (auth, gv, kt, hs)
 *   - mọi thao tác ghi: POST / PUT / PATCH / DELETE
 *   - lỗi máy chủ 5xx và truy cập bị từ chối 401 / 403
 * Không ghi: các request đọc (GET) thành công, chính API /logs, route alias, /health.
 * Không bao giờ làm hỏng request chính nếu ghi log lỗi.
 */
class AuditAll
{
    public function handle(Request $request, Closure $next)
    {
        $start = microtime(true);
        $response = $next($request);

        try {
            $this->record($request, $response, $start);
        } catch (\Throwable $e) {
            // bỏ qua: ghi log không được phá nghiệp vụ
        }

        return $response;
    }

    private function record(Request $r, $response, float $start): void
    {
        if ($r->isMethod('OPTIONS')) {
            return;
        }
        if ($r->route() && $r->route()->parameter('aliasPath') !== null) {
            return; // route bắt-tất-cả (alias /api ↔ /api/v1): lượt xử lý thật ở request con sẽ được ghi
        }

        $path = preg_replace('#^api/#', '', trim($r->path(), '/'));
        $path = preg_replace('#^v1/#', '', $path);
        if ($path === 'health' || preg_match('#^logs(/|$)#', $path)) {
            return;
        }

        $code = $response->getStatusCode();
        $write = in_array($r->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true);
        $isLogin = $r->isMethod('POST') && preg_match('#^(auth|gv|kt|hs)/login$#', $path);

        if (! ($write || $code >= 500 || in_array($code, [401, 403], true))) {
            return;
        }
        if ($code === 429) {
            return;
        }

        $module = $this->module($path);
        $ok = $code < 400;
        $status = $ok ? 'success' : (in_array($code, [401, 403], true) ? 'denied' : 'failed');

        $actor = $this->actor($r, $path, $response, $isLogin && $ok);
        $prefix = strtok($path, '/');
        $actorType = $actor['type'] ?? (in_array($prefix, ['hs']) ? 'student' : ($actor ? 'staff' : ($isLogin ? ($prefix === 'hs' ? 'student' : 'staff') : 'system')));

        $e = [
            'module' => $module,
            'actor_type' => $actorType,
            'actor_id' => $actor['id'] ?? null,
            'actor_name' => $actor['name'] ?? null,
            'actor_role' => $actor['role'] ?? null,
            'status' => $status,
            'duration_ms' => (int) round((microtime(true) - $start) * 1000),
        ];

        if ($isLogin) {
            $who = trim((string) ($r->input('email') ?: $r->input('username') ?: $r->input('code') ?: $r->input('login') ?: ''));
            $e += [
                'module' => 'auth',
                'action' => $ok ? 'login' : 'login_failed',
                'severity' => $ok ? 'info' : 'warning',
                'entity_type' => 'account',
                'entity_label' => $who !== '' ? mb_substr($who, 0, 160) : null,
                'summary' => $ok
                    ? 'Đăng nhập: ' . ($actor['name'] ?? $who ?: 'người dùng')
                    : 'Đăng nhập THẤT BẠI' . ($who !== '' ? ": {$who}" : '') . " (HTTP {$code})",
            ];
            if (! $ok && $actor === null) {
                $e['actor_name'] = $who !== '' ? mb_substr($who, 0, 120) : null;
            }
        } else {
            $norm = preg_replace('#/\d+#', '/{id}', $path);
            $verb = strtolower($r->method());
            $severity = $r->isMethod('DELETE') ? 'warning'
                : (! $ok ? ($code >= 500 ? 'warning' : 'notice')
                : (preg_match('#(void|reject|confirm|collect|reset-password|revoke|restore|purge|cleanup)#', $path) ? 'notice' : 'info'));

            $values = null;
            if ($write && ! $r->isMethod('DELETE')) {
                $in = $r->except(['_token', '_method']);
                $enc = json_encode($in, JSON_UNESCAPED_UNICODE);
                $values = ($enc !== false && strlen($enc) <= 4000) ? $in : ['_note' => 'nội dung quá dài, không lưu'];
            }

            $entityId = null;
            foreach (['id', 'student', 'code', 'batch', 'receiptNo'] as $p) {
                if ($r->route() && $r->route()->parameter($p) !== null) { $entityId = (string) $r->route()->parameter($p); break; }
            }

            $e += [
                'action' => $verb . ':' . $norm,
                'severity' => $severity,
                'entity_type' => explode('/', $norm)[1] ?? explode('/', $norm)[0] ?? null,
                'entity_id' => $entityId,
                'summary' => $r->method() . ' /' . $path . " → HTTP {$code}" . (isset($actor['name']) ? ' · ' . $actor['name'] : ''),
                'new_values' => $values,
            ];
        }

        AuditLogger::log($e);
    }

    private function module(string $p): string
    {
        $has = fn (string $re) => (bool) preg_match($re, $p);
        if ($has('#^(auth|gv|kt|hs)/(login|logout)#')) return 'auth';
        if ($has('#^(kt|accountant)(/|$)#') || $has('#(^|/)(fees|wallet|payments)(/|$)#')) return 'finance';
        if ($has('#notification|reminders#')) return 'notification';
        if ($has('#attendance#')) return 'attendance';
        if ($has('#(^|/)(grades|exams)(/|$)#')) return 'exam';
        if ($has('#(^|/)reports(/|$)#')) return 'report';
        if ($has('#^gv/students|^hs/(profile|change-password)|profile-requests#')) return 'student';
        if ($has('#^gv/teacher|homework#')) return 'teacher';
        if ($has('#^gv/(classes|assignments|timetable|promotion)#')) return 'academic';
        if ($has('#security|^admin/roles|^admin/users#')) return 'security';
        return 'system';
    }

    /** Xác định người thực hiện: token Sanctum → khu Giáo vụ (AcademicRepo) → kết quả đăng nhập. */
    private function actor(Request $r, string $path, $response, bool $loginOk): ?array
    {
        if ($loginOk) {
            $j = json_decode((string) $response->getContent(), true);
            $u = is_array($j) ? ($j['user'] ?? $j['data']['user'] ?? $j['staff'] ?? $j['data']['staff'] ?? $j['data'] ?? null) : null;
            if (is_array($u) && (isset($u['id']) || isset($u['name']) || isset($u['full_name']))) {
                $roles = $j['roles'] ?? $j['data']['roles'] ?? null;
                return ['id' => $u['id'] ?? null, 'name' => $u['name'] ?? $u['full_name'] ?? null,
                    'role' => is_array($roles) ? ($roles[0] ?? null) : ($u['role'] ?? null)];
            }
        }

        $token = $r->bearerToken();
        if (! $token) return null;

        if (str_contains($token, '|') && class_exists(\Laravel\Sanctum\PersonalAccessToken::class)) {
            $pat = \Laravel\Sanctum\PersonalAccessToken::findToken($token);
            $u = $pat?->tokenable;
            if ($u) {
                $role = method_exists($u, 'getRoleNames') ? ($u->getRoleNames()->first() ?: null) : null;
                return ['id' => (int) $u->getAuthIdentifier(), 'name' => $u->name ?? $u->email ?? null, 'role' => $role, 'type' => 'staff'];
            }
        }

        $repo = '\\App\\Support\\AcademicRepo';
        if (preg_match('#^(gv|kt)/#', $path) && class_exists($repo)) {
            $s = (new $repo(\Illuminate\Support\Facades\DB::connection()->getPdo()))->authenticate($token);
            if ($s) {
                $s = is_array($s) ? $s : (array) json_decode(json_encode($s), true);
                return ['id' => $s['id'] ?? $s['staff_id'] ?? null, 'name' => $s['full_name'] ?? $s['name'] ?? $s['username'] ?? null,
                    'role' => $s['role'] ?? $s['role_code'] ?? null, 'type' => 'staff'];
            }
        }

        return null;
    }
}
