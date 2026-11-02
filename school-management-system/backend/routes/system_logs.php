<?php

/*
 | ROUTE NHẬT KÝ HỆ THỐNG
 | Thêm ĐÚNG MỘT dòng này vào backend/routes/api.php, đặt TRÊN đoạn "Tự nhận cả /api/xxx lẫn /api/v1/xxx"
 | (vì route bắt-mọi-đường-dẫn ở cuối file sẽ chặn mất nếu đặt dưới):
 |
 |     require __DIR__ . '/system_logs.php';
 |
 | Đăng ký cả /api/admin/logs lẫn /api/v1/admin/logs giống cách bạn đã làm với admin/profile.
 */

use App\Http\Controllers\Api\Admin\SystemLogAlertController;
use App\Http\Controllers\Api\Admin\SystemLogController;
use App\Http\Middleware\RequireSystemAdmin;
use Illuminate\Support\Facades\Route;

foreach (['admin/logs', 'v1/admin/logs'] as $logsPrefix) {
    Route::prefix($logsPrefix)->middleware('auth:sanctum')->group(function () {

        // ---- ĐỌC (super_admin, admin, principal, vice_principal) ----
        Route::middleware(RequireSystemAdmin::class . ':read')->group(function () {
            Route::get('meta', [SystemLogController::class, 'meta']);
            Route::get('overview', [SystemLogController::class, 'overview']);
            Route::get('events', [SystemLogController::class, 'events']);
            Route::get('events/stream', [SystemLogController::class, 'stream']);
            Route::get('events/export', [SystemLogController::class, 'export'])->middleware('throttle:10,1');
            Route::get('events/{id}', [SystemLogController::class, 'event'])->whereNumber('id');
            Route::post('events/{id}/pin', [SystemLogController::class, 'pin'])->whereNumber('id');
            Route::delete('events/{id}/pin', [SystemLogController::class, 'unpin'])->whereNumber('id');
            Route::get('security', [SystemLogController::class, 'security']);
            Route::get('audit', [SystemLogController::class, 'audit']);
            Route::get('views', [SystemLogController::class, 'views']);
            Route::post('views', [SystemLogController::class, 'saveView']);
            Route::delete('views/{id}', [SystemLogController::class, 'deleteView'])->whereNumber('id');
            Route::get('storage', [SystemLogController::class, 'storage']);
            Route::get('rules', [SystemLogAlertController::class, 'rules']);
            Route::get('incidents', [SystemLogAlertController::class, 'incidents']);
        });

        // ---- QUẢN LÝ (super_admin, admin) ----
        Route::middleware(RequireSystemAdmin::class . ':manage')->group(function () {
            Route::post('rules', [SystemLogAlertController::class, 'store']);
            Route::put('rules/{id}', [SystemLogAlertController::class, 'update'])->whereNumber('id');
            Route::delete('rules/{id}', [SystemLogAlertController::class, 'destroy'])->whereNumber('id');
            Route::post('rules/test', [SystemLogAlertController::class, 'test']);
            Route::post('rules/evaluate', [SystemLogAlertController::class, 'evaluate'])->middleware('throttle:20,1');
            Route::post('incidents/{id}/acknowledge', [SystemLogAlertController::class, 'acknowledge'])->whereNumber('id');
            Route::post('incidents/{id}/resolve', [SystemLogAlertController::class, 'resolve'])->whereNumber('id');
            Route::post('security/accounts/{id}/unlock', [SystemLogController::class, 'unlock'])->whereNumber('id');
            Route::put('storage/retention', [SystemLogController::class, 'updateRetention']);
            Route::post('storage/purge', [SystemLogController::class, 'purge'])->middleware('throttle:6,1');
            Route::post('test-event', [SystemLogController::class, 'testEvent'])->middleware('throttle:30,1');
            Route::post('sync', [SystemLogController::class, 'sync'])->middleware('throttle:20,1');
        });
    });
}
