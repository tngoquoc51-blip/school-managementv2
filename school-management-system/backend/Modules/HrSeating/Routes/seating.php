<?php

use Illuminate\Support\Facades\Route;
use Modules\HrSeating\Controllers\HrGroupController;
use Modules\HrSeating\Controllers\HrLayoutController;
use Modules\HrSeating\Controllers\HrSeatingController;
use Modules\HrSeating\Middleware\HrSeatingAuth;

/*
|--------------------------------------------------------------------------
| Sơ đồ & Sĩ số lớp – Cổng giáo viên chủ nhiệm   (/api/v1/homeroom/seating/...)
| Xác thực bằng token nhân viên; GVCN chỉ thấy lớp của mình, BGH/Giáo vụ chọn được mọi lớp (?class_id=).
|--------------------------------------------------------------------------
*/
Route::prefix('homeroom/seating')->middleware(HrSeatingAuth::class)->group(function () {
    Route::get('meta', [HrSeatingController::class, 'meta']);
    Route::get('overview', [HrSeatingController::class, 'overview']);
    Route::get('roster', [HrSeatingController::class, 'roster']);
    Route::get('events', [HrSeatingController::class, 'events']);

    Route::get('layouts', [HrLayoutController::class, 'index']);
    Route::post('layouts', [HrLayoutController::class, 'store']);
    Route::get('layouts/{id}', [HrLayoutController::class, 'show'])->whereNumber('id');
    Route::put('layouts/{id}', [HrLayoutController::class, 'update'])->whereNumber('id');
    Route::delete('layouts/{id}', [HrLayoutController::class, 'destroy'])->whereNumber('id');
    Route::put('layouts/{id}/seats', [HrLayoutController::class, 'saveSeats'])->whereNumber('id');
    Route::post('layouts/{id}/duplicate', [HrLayoutController::class, 'duplicate'])->whereNumber('id');
    Route::post('layouts/{id}/publish', [HrLayoutController::class, 'publish'])->whereNumber('id');
    Route::get('layouts/{id}/check', [HrLayoutController::class, 'check'])->whereNumber('id');
    Route::post('layouts/{id}/auto', [HrLayoutController::class, 'auto'])->whereNumber('id');
    Route::post('layouts/{id}/rotate', [HrLayoutController::class, 'rotate'])->whereNumber('id');

    Route::get('groups', [HrGroupController::class, 'groups']);
    Route::put('groups', [HrGroupController::class, 'saveGroups']);
    Route::post('groups/auto', [HrGroupController::class, 'autoSplit']);
    Route::get('officers', [HrGroupController::class, 'officers']);
    Route::put('officers', [HrGroupController::class, 'saveOfficers']);
    Route::put('flags/{studentId}', [HrGroupController::class, 'saveFlag'])->whereNumber('studentId');
});
