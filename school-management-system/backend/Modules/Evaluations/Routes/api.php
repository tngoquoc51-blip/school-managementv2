<?php

use Illuminate\Support\Facades\Route;
use Modules\Evaluations\Controllers\ActionController;
use Modules\Evaluations\Controllers\ObservationController;
use Modules\Evaluations\Controllers\OverviewController;
use Modules\Evaluations\Controllers\PeriodicController;
use Modules\Evaluations\Controllers\PlanController;
use Modules\Evaluations\Controllers\RubricController;
use Modules\Evaluations\Controllers\SettingsController;
use Modules\Logs\Middleware\BghAccess;

// Prefix: /api/v1/evaluations (khai báo trong routes/api.php)
// Chỉ Ban Giám hiệu / Quản trị (cùng cơ chế xác thực với Nhật ký hệ thống).
Route::middleware(BghAccess::class)->group(function () {
    Route::get('me', [OverviewController::class, 'profile']);
    Route::get('lookups', [OverviewController::class, 'lookups']);
    Route::get('overview', [OverviewController::class, 'overview']);
    Route::get('slots', [OverviewController::class, 'slots']);
    Route::get('report', [OverviewController::class, 'report']);
    Route::get('teachers', [OverviewController::class, 'teachers']);
    Route::get('teachers/{id}', [OverviewController::class, 'teacher'])->whereNumber('id');

    Route::get('plans', [PlanController::class, 'index']);
    Route::post('plans', [PlanController::class, 'store']);
    Route::put('plans/{id}', [PlanController::class, 'update'])->whereNumber('id');
    Route::post('plans/{id}/postpone', [PlanController::class, 'postpone'])->whereNumber('id');
    Route::post('plans/{id}/cancel', [PlanController::class, 'cancel'])->whereNumber('id');
    Route::post('plans/{id}/start', [PlanController::class, 'start'])->whereNumber('id');
    Route::delete('plans/{id}', [PlanController::class, 'destroy'])->whereNumber('id');

    Route::get('observations', [ObservationController::class, 'index']);
    Route::get('observations/export', [ObservationController::class, 'export']);
    Route::post('observations', [ObservationController::class, 'store']);
    Route::get('observations/{id}', [ObservationController::class, 'show'])->whereNumber('id');
    Route::put('observations/{id}', [ObservationController::class, 'update'])->whereNumber('id');
    Route::post('observations/{id}/submit', [ObservationController::class, 'submit'])->whereNumber('id');
    Route::post('observations/{id}/acknowledge', [ObservationController::class, 'acknowledge'])->whereNumber('id');
    Route::post('observations/{id}/dispute', [ObservationController::class, 'dispute'])->whereNumber('id');
    Route::post('observations/{id}/reopen', [ObservationController::class, 'reopen'])->whereNumber('id');
    Route::post('observations/{id}/close', [ObservationController::class, 'close'])->whereNumber('id');
    Route::delete('observations/{id}', [ObservationController::class, 'destroy'])->whereNumber('id');

    Route::get('periodic', [PeriodicController::class, 'index']);
    Route::get('periodic/export', [PeriodicController::class, 'export']);
    Route::post('periodic/generate', [PeriodicController::class, 'generate']);
    Route::put('periodic/teacher/{teacherId}', [PeriodicController::class, 'save'])->whereNumber('teacherId');
    Route::post('periodic/{id}/submit', [PeriodicController::class, 'submit'])->whereNumber('id');
    Route::post('periodic/{id}/approve', [PeriodicController::class, 'approve'])->whereNumber('id');
    Route::post('periodic/{id}/reopen', [PeriodicController::class, 'reopen'])->whereNumber('id');

    Route::get('rubrics', [RubricController::class, 'index']);
    Route::post('rubrics', [RubricController::class, 'store']);
    Route::get('rubrics/{id}', [RubricController::class, 'show'])->whereNumber('id');
    Route::put('rubrics/{id}', [RubricController::class, 'update'])->whereNumber('id');
    Route::post('rubrics/{id}/toggle', [RubricController::class, 'toggle'])->whereNumber('id');
    Route::delete('rubrics/{id}', [RubricController::class, 'destroy'])->whereNumber('id');

    Route::get('actions', [ActionController::class, 'index']);
    Route::post('actions', [ActionController::class, 'store']);
    Route::put('actions/{id}', [ActionController::class, 'update'])->whereNumber('id');
    Route::post('actions/{id}/status', [ActionController::class, 'status'])->whereNumber('id');
    Route::delete('actions/{id}', [ActionController::class, 'destroy'])->whereNumber('id');

    Route::get('settings', [SettingsController::class, 'show']);
    Route::put('settings', [SettingsController::class, 'update']);
});
