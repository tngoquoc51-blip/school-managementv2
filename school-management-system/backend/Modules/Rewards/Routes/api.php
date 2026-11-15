<?php

use Illuminate\Support\Facades\Route;
use Modules\Rewards\Controllers\AwardController;
use Modules\Rewards\Controllers\AwardTypeController;
use Modules\Rewards\Controllers\CriteriaController;
use Modules\Rewards\Controllers\EmulationController;
use Modules\Rewards\Middleware\EmulationAccess as Access;

// Nạp từ routes/api.php với prefix: gv/rewards  (đăng nhập bằng token nhân viên, kiểm tra trong EmulationAccess)
Route::group([], function () {

    // Cán bộ được phép xem / chấm điểm / đề xuất
    Route::middleware(Access::class . ':staff')->group(function () {
        Route::get('meta', [EmulationController::class, 'meta']);
        Route::get('overview', [EmulationController::class, 'overview']);
        Route::get('ranking', [EmulationController::class, 'ranking']);
        Route::get('classes/{id}', [EmulationController::class, 'classDetail'])->whereNumber('id');
        Route::get('records', [EmulationController::class, 'records']);
        Route::post('records', [EmulationController::class, 'storeRecord']);
        Route::delete('records/{id}', [EmulationController::class, 'destroyRecord'])->whereNumber('id');
        Route::get('logs', [EmulationController::class, 'logs']);
        Route::get('students/search', [EmulationController::class, 'students']);

        Route::get('criteria', [CriteriaController::class, 'index']);
        Route::get('awards/overview', [AwardController::class, 'overview']);
        Route::get('awards', [AwardController::class, 'index']);
        Route::get('award-types', [AwardTypeController::class, 'index']);
        Route::post('awards', [AwardController::class, 'store']);
        Route::delete('awards/{id}', [AwardController::class, 'destroy'])->whereNumber('id');
    });

    // Chỉ Ban Giám hiệu: quản lý tiêu chí + phê duyệt khen thưởng / kỷ luật
    Route::middleware(Access::class . ':review')->group(function () {
        Route::post('criteria', [CriteriaController::class, 'store']);
        Route::put('criteria/{id}', [CriteriaController::class, 'update'])->whereNumber('id');
        Route::patch('criteria/{id}/toggle', [CriteriaController::class, 'toggle'])->whereNumber('id');
        Route::delete('criteria/{id}', [CriteriaController::class, 'destroy'])->whereNumber('id');
        Route::patch('awards/{id}/review', [AwardController::class, 'review'])->whereNumber('id');
        Route::post('award-types', [AwardTypeController::class, 'store']);
        Route::put('award-types/{id}', [AwardTypeController::class, 'update'])->whereNumber('id');
        Route::patch('award-types/{id}/toggle', [AwardTypeController::class, 'toggle'])->whereNumber('id');
        Route::delete('award-types/{id}', [AwardTypeController::class, 'destroy'])->whereNumber('id');
    });
});
