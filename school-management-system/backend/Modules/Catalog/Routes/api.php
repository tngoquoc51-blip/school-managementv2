<?php

use Illuminate\Support\Facades\Route;
use Modules\Catalog\Controllers\AuditLogController;
use Modules\Catalog\Controllers\DepartmentController;
use Modules\Catalog\Controllers\GroupController;
use Modules\Catalog\Controllers\ItemController;
use Modules\Catalog\Controllers\OverviewController;
use Modules\Catalog\Controllers\RoomController;
use Modules\Catalog\Controllers\SubjectController;
use Modules\Catalog\Controllers\UserDirectoryController;

// Prefix tự động: /api/v1/catalog
// Middleware lấy từ .env: CATALOG_MIDDLEWARE="auth:sanctum" (mặc định). Nhiều middleware ngăn cách bằng dấu |
//   vd: CATALOG_MIDDLEWARE="auth:sanctum|role:super_admin" khi đã đăng ký middleware 'role' của Spatie.
$middleware = array_filter(explode('|', (string) env('CATALOG_MIDDLEWARE', 'auth:sanctum')));

Route::middleware($middleware)->group(function () {
    Route::get('overview', [OverviewController::class, 'index']);

    Route::get('audit-logs', [AuditLogController::class, 'index']);
    Route::post('audit-logs/{id}/restore', [AuditLogController::class, 'restore'])->whereNumber('id');

    // CRUD chuẩn cho 4 danh mục có cấu trúc riêng. Route tĩnh (export, bulk) khai báo TRƯỚC {id}.
    foreach ([
        'groups' => GroupController::class,
        'subjects' => SubjectController::class,
        'departments' => DepartmentController::class,
        'rooms' => RoomController::class,
    ] as $uri => $controller) {
        Route::get("$uri/export", [$controller, 'export']);
        Route::post("$uri/bulk", [$controller, 'bulk']);
        Route::get($uri, [$controller, 'index']);
        Route::post($uri, [$controller, 'store']);
        Route::get("$uri/{id}", [$controller, 'show'])->whereNumber('id');
        Route::put("$uri/{id}", [$controller, 'update'])->whereNumber('id');
        Route::patch("$uri/{id}/toggle", [$controller, 'toggle'])->whereNumber('id');
        Route::delete("$uri/{id}", [$controller, 'destroy'])->whereNumber('id');
    }

    // Mục trong nhóm danh mục dùng chung
    Route::get('groups/{group}/items', [ItemController::class, 'listByGroup'])->whereNumber('group');
    Route::post('groups/{group}/items', [ItemController::class, 'store'])->whereNumber('group');
    Route::get('groups/{group}/items/export', [ItemController::class, 'exportGroup'])->whereNumber('group');
    Route::post('groups/{group}/items/import', [ItemController::class, 'import'])->whereNumber('group');
    Route::post('items/bulk', [ItemController::class, 'bulk']);
    Route::put('items/{id}', [ItemController::class, 'update'])->whereNumber('id');
    Route::patch('items/{id}/toggle', [ItemController::class, 'toggle'])->whereNumber('id');
    Route::delete('items/{id}', [ItemController::class, 'destroy'])->whereNumber('id');

    // Người dùng & chức năng toàn hệ thống (users + sm_staff_accounts + sm_accounts)
    Route::prefix('users')->group(function () {
        Route::get('summary', [UserDirectoryController::class, 'summary']);
        Route::get('export', [UserDirectoryController::class, 'export']);
        Route::get('roles', [UserDirectoryController::class, 'roles']);
        Route::put('roles/{id}/permissions', [UserDirectoryController::class, 'setRolePermissions'])->whereNumber('id');
        Route::post('bulk', [UserDirectoryController::class, 'bulk']);
        Route::get('/', [UserDirectoryController::class, 'index']);
        Route::patch('{type}/{id}/status', [UserDirectoryController::class, 'status'])->whereIn('type', ['web', 'staff', 'student'])->whereNumber('id');
        Route::post('{type}/{id}/reset-password', [UserDirectoryController::class, 'resetPassword'])->whereIn('type', ['web', 'staff', 'student'])->whereNumber('id');
        Route::put('{type}/{id}/roles', [UserDirectoryController::class, 'setRoles'])->whereIn('type', ['web', 'staff', 'student'])->whereNumber('id');
    });
});
