<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
        ->withMiddleware(function (Middleware $middleware) {
            // Nhật ký hệ thống: tự ghi đăng nhập, mọi thao tác ghi, lỗi 5xx và 401/403 của toàn bộ API
            $middleware->appendToGroup('api', \App\Http\Middleware\AuditApiRequests::class);

            // Nhật ký BGH (/bgh/logs): ghi vào sm_audit_logs theo từng người dùng thật
            $middleware->appendToGroup('api', \Modules\Logs\Middleware\AuditAll::class);

            // Giám sát hệ thống: số liệu request + nhật ký thao tác cho /admin/health
            $middleware->appendToGroup('api', \App\Http\Middleware\RequestMonitor::class);

            // [CÀI ĐẶT HỆ THỐNG] Chế độ bảo trì: chặn API với mọi người trừ super_admin
            $middleware->appendToGroup('api', \Modules\Setting\Middleware\MaintenanceGuard::class);

            // CHỈ bật dòng dưới nếu bạn thật sự truy cập API qua ngrok/proxy và muốn nhật ký ghi đúng IP người dùng
            // (không bật khi chạy thật mà không có proxy, vì sẽ cho phép giả mạo IP):
            // $middleware->trustProxies(at: '*');
        })
    ->withExceptions(function (Exceptions $exceptions) {
        // [CÀI ĐẶT HỆ THỐNG] API luôn trả JSON khi lỗi (401/422/404...) thay vì redirect
        $exceptions->shouldRenderJsonWhen(fn ($request, $e) => $request->is('api/*') || $request->expectsJson());
    })->create();
