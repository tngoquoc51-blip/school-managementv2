<?php

namespace App\Http\Middleware;

use App\Support\AuditLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * TỰ ĐỘNG ghi nhật ký cho API (không cần sửa từng controller):
 *  - đăng nhập thành công / thất bại / bị giới hạn tốc độ (429)
 *  - mọi thao tác ghi (POST/PUT/PATCH/DELETE) thành công
 *  - mọi lỗi máy chủ (5xx) và truy cập bị từ chối (401/403)
 * KHÔNG lưu nội dung request (tránh lộ mật khẩu/dữ liệu cá nhân). Ghi SAU khi đã trả phản hồi (terminate)
 * nên không làm chậm người dùng.
 *
 * Đăng ký (Laravel 11/12) trong bootstrap/app.php:
 *   ->withMiddleware(function (Middleware $middleware) {
 *       $middleware->appendToGroup('api', \App\Http\Middleware\AuditApiRequests::class);
 *   })
 */
class AuditApiRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->attributes->set('audit_t0', microtime(true));

        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        try {
            $this->record($request, $response);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function record(Request $request, Response $response): void
    {
        $path = trim($request->path(), '/');
        $norm = preg_replace('#^(api/)?(v1/)?#', '', $path);
        $method = $request->method();
        $status = $response->getStatusCode();

        if ($method === 'OPTIONS' || $norm === 'health' || str_starts_with($norm, 'admin/logs')) {
            return;
        }

        $isWrite = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);
        $isLogin = $method === 'POST' && (bool) preg_match('#(^|/)login$#', $norm);
        $isLogout = $method === 'POST' && (bool) preg_match('#(^|/)logout$#', $norm);

        // quyết định có ghi hay không
        if (! $isWrite && $status < 500 && ! in_array($status, [401, 403], true)) {
            return;
        }

        $seg = explode('/', $norm)[0] ?? '';
        $category = match ($seg) {
            'kt', 'accountant' => 'finance', 'gv' => 'academic', 'hs', 'student' => 'student',
            'admin' => 'admin', 'auth' => 'auth', default => 'api',
        };
        $actorType = match ($seg) {
            'gv', 'kt', 'accountant' => 'staff', 'hs', 'student' => 'student', default => 'admin',
        };

        [$actorId, $actorName] = $this->actor($request, $response, $isLogin);

        // Route bắt-mọi-đường-dẫn ({aliasPath}) cuối routes/api.php: dùng chính đường dẫn thật (bỏ các số id) để tên hành động ổn định
        $routeUri = $request->route()?->uri() ?? '';
        $uri = str_contains($routeUri, '{aliasPath}')
            ? preg_replace('#/\d+(?=/|$)#', '', $norm)
            : preg_replace('#^(api/)?(v1/)?#', '', $routeUri !== '' ? $routeUri : $norm);
        $parts = array_values(array_filter(explode('/', $uri), fn ($p) => $p !== '' && ! str_starts_with($p, '{')));
        $action = mb_substr(implode('.', $parts) ?: 'request', 0, 80);

        $level = 'info';
        $summary = "{$method} /{$uri} → {$status}";

        if ($isLogin) {
            $category = 'auth';
            if ($status >= 200 && $status < 300) {
                $action = 'auth.login';
                $summary = 'Đăng nhập thành công';
            } elseif ($status === 429) {
                $action = 'auth.login_throttled';
                $level = 'warning';
                $summary = 'Đăng nhập bị giới hạn tốc độ (quá nhiều lần thử)';
            } elseif ($status >= 500) {
                $action = 'api.server_error';
                $level = 'error';
            } else {
                $action = 'auth.login_failed';
                $level = 'warning';
                $summary = "Đăng nhập thất bại (HTTP {$status})";
                $actorType = 'guest';
            }
        } elseif ($isLogout) {
            $category = 'auth';
            $action = 'auth.logout';
            $summary = 'Đăng xuất';
        } elseif ($status >= 500) {
            $level = 'error';
            $category = 'api';
            $action = 'api.server_error';
            $summary = "Lỗi máy chủ {$status}: {$method} /{$uri}";
        } elseif (in_array($status, [401, 403], true)) {
            $level = 'warning';
            $category = 'security';
            $action = 'security.access_denied';
            $summary = "Bị từ chối ({$status}): {$method} /{$uri}";
        } elseif ($status === 429) {
            $level = 'warning';
            $category = 'security';
            $action = 'security.rate_limited';
            $summary = "Vượt giới hạn tốc độ: {$method} /{$uri}";
        } elseif ($status >= 400) {
            $level = 'notice';
            $summary = "Yêu cầu không hợp lệ ({$status}): {$method} /{$uri}";
        }

        AuditLogger::log([
            'level' => $level, 'category' => $category, 'action' => $action,
            'actor_type' => $actorType, 'actor_id' => $actorId, 'actor_name' => $actorName,
            'summary' => $summary, 'http_method' => $method, 'route' => mb_substr('/' . $uri, 0, 190),
            'status_code' => $status, 'duration_ms' => (int) round((microtime(true) - (float) $request->attributes->get('audit_t0', microtime(true))) * 1000),
            'source' => 'middleware',
        ], $request);
    }

    /** @return array{0:?int,1:?string} */
    private function actor(Request $request, Response $response, bool $isLogin): array
    {
        try {
            $u = $request->user('sanctum') ?? $request->user();
        } catch (\Throwable) {
            $u = null;
        }
        // các middleware token tự viết của dự án (StaffToken / StudentToken / FeeStaffToken) thường gắn người dùng vào attributes
        if (! $u) {
            foreach (['staff', 'fee_staff', 'feeStaff', 'student', 'account', 'auth_user', 'user'] as $k) {
                if ($request->attributes->has($k) && ($v = $request->attributes->get($k))) {
                    $u = is_array($v) ? (object) $v : $v;
                    break;
                }
            }
        }
        if (! $u && $isLogin) {
            // đăng nhập thành công: lấy từ phản hồi; thất bại: chỉ lưu TÊN ĐĂNG NHẬP người dùng gõ (không lưu mật khẩu)
            $j = json_decode((string) $response->getContent(), true);
            $cand = is_array($j) ? ($j['user'] ?? $j['data']['user'] ?? $j['data'] ?? null) : null;
            if (is_array($cand)) {
                $u = (object) $cand;
            } else {
                $name = $request->input('username') ?? $request->input('email') ?? $request->input('code') ?? $request->input('student_code');

                return [null, is_string($name) ? mb_substr($name, 0, 120) : null];
            }
        }
        if (! $u) {
            return [null, null];
        }
        $id = $u->id ?? null;
        $name = $u->name ?? $u->full_name ?? $u->username ?? null;

        return [is_numeric($id) ? (int) $id : null, is_string($name) ? mb_substr($name, 0, 120) : null];
    }
}
