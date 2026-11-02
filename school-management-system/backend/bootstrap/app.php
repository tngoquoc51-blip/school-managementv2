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

        // CHỈ bật dòng dưới nếu bạn thật sự truy cập API qua ngrok/proxy và muốn nhật ký ghi đúng IP người dùng
        // (không bật khi chạy thật mà không có proxy, vì sẽ cho phép giả mạo IP):
        // $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
