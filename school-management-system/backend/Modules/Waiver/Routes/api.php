<?php

use Illuminate\Support\Facades\Route;
use Modules\Waiver\Controllers\WaiverController;

// Tự động được nạp bởi ModuleLoaderServiceProvider với prefix: /api/v1/waiver
Route::middleware('auth:sanctum')->group(function () {
    Route::get('meta', [WaiverController::class, 'meta']);
    Route::get('stats', [WaiverController::class, 'stats']);

    // Đơn đề nghị
    Route::get('requests', [WaiverController::class, 'requests']);
    Route::post('requests', [WaiverController::class, 'createRequest']);
    Route::post('requests/bulk-approve', [WaiverController::class, 'bulkApprove']);
    Route::get('requests/{id}', [WaiverController::class, 'showRequest'])->whereNumber('id');
    Route::post('requests/{id}/approve', [WaiverController::class, 'approve'])->whereNumber('id');
    Route::post('requests/{id}/reject', [WaiverController::class, 'reject'])->whereNumber('id');
    Route::post('requests/{id}/cancel', [WaiverController::class, 'cancel'])->whereNumber('id');

    // Bản ghi đang áp dụng
    Route::get('records', [WaiverController::class, 'records']);
    Route::post('records/{id}/revoke', [WaiverController::class, 'revoke'])->whereNumber('id');
    Route::post('recalc', [WaiverController::class, 'recalc']);

    // Tra cứu + xem trước tác động lên học phí
    Route::get('students/search', [WaiverController::class, 'searchStudents']);
    Route::get('impact', [WaiverController::class, 'impact']);

    // Danh mục chính sách
    Route::get('types', [WaiverController::class, 'types']);
    Route::post('types', [WaiverController::class, 'saveType']);
    Route::put('types/{id}', [WaiverController::class, 'saveType'])->whereNumber('id');
    Route::patch('types/{id}/toggle', [WaiverController::class, 'toggleType'])->whereNumber('id');

    // Nhật ký + xuất file
    Route::get('logs', [WaiverController::class, 'logs']);
    Route::get('export', [WaiverController::class, 'export']);
});
