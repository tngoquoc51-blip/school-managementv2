<?php

namespace Modules\Logs\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Logs\Support\AuditLogger;

/**
 * Tự động ghi nhật ký mọi request ghi dữ liệu (POST/PUT/PATCH/DELETE).
 * Gắn vào route group của module bất kỳ:
 *
 *   Route::middleware(\Modules\Logs\Middleware\AuditWrites::class.':finance')->group(...)
 *
 * Tham số sau dấu ":" là tên module (auth|student|teacher|academic|exam|attendance|finance|...).
 */
class AuditWrites
{
    public function handle(Request $request, Closure $next, string $module = 'system')
    {
        $start = microtime(true);
        $response = $next($request);

        if (in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $code = $response->getStatusCode();
            $status = $code < 400 ? 'success' : (in_array($code, [401, 403], true) ? 'denied' : 'failed');

            AuditLogger::log([
                'module'      => $module,
                'action'      => strtolower($request->method()) . ':' . trim($request->path(), '/'),
                'status'      => $status,
                'severity'    => $request->isMethod('DELETE') ? 'warning' : ($status === 'success' ? 'info' : 'notice'),
                'summary'     => $request->method() . ' /' . $request->path() . " → HTTP {$code}",
                'new_values'  => $request->isMethod('DELETE') ? null : $request->except(['_token']),
                'duration_ms' => (int) round((microtime(true) - $start) * 1000),
            ]);
        }

        return $response;
    }
}
