<?php

use Illuminate\Support\Facades\Route;
use Modules\TeacherAdmin\Controllers\InsightController;
use Modules\TeacherAdmin\Controllers\LeaveController;
use Modules\TeacherAdmin\Controllers\TeacherController;

// Prefix tự động: /api/v1/teacheradmin (ModuleLoaderServiceProvider) — không cần sửa routes/api.php
Route::middleware(config('teacheradmin.middleware', ['auth:sanctum']))->group(function () {
Route::get('meta', [TeacherController::class, 'meta']);
Route::get('overview', [InsightController::class, 'overview']);
Route::get('supply', [InsightController::class, 'supply']);
Route::get('performance', [InsightController::class, 'performance']);
Route::get('integrity', [InsightController::class, 'integrity']);
Route::get('workload', [InsightController::class, 'workload']);
Route::post('workload/transfer', [InsightController::class, 'transfer']);
Route::get('homeroom', [InsightController::class, 'homeroom']);
Route::post('homeroom', [InsightController::class, 'setHomeroom']);
Route::get('conflicts', [InsightController::class, 'conflicts']);
Route::get('audit', [TeacherController::class, 'audit']);

Route::get('teachers/export', [TeacherController::class, 'export']);
Route::post('teachers/import', [TeacherController::class, 'import']);
Route::post('teachers/bulk', [TeacherController::class, 'bulk']);
Route::get('teachers', [TeacherController::class, 'index']);
Route::post('teachers', [TeacherController::class, 'store']);
Route::get('teachers/{id}', [TeacherController::class, 'show'])->whereNumber('id');
Route::put('teachers/{id}', [TeacherController::class, 'update'])->whereNumber('id');
Route::delete('teachers/{id}', [TeacherController::class, 'destroy'])->whereNumber('id');
Route::get('teachers/{id}/schedule', [InsightController::class, 'schedule'])->whereNumber('id');
Route::post('teachers/{id}/certs', [TeacherController::class, 'addCert'])->whereNumber('id');
Route::delete('certs/{id}', [TeacherController::class, 'deleteCert'])->whereNumber('id');

Route::get('leaves', [LeaveController::class, 'index']);
Route::post('leaves', [LeaveController::class, 'store']);
Route::post('leaves/{id}/review', [LeaveController::class, 'review'])->whereNumber('id');
Route::delete('leaves/{id}', [LeaveController::class, 'destroy'])->whereNumber('id');
Route::get('leaves/{id}/coverage', [LeaveController::class, 'coverage'])->whereNumber('id');
Route::post('leaves/{id}/substitute', [LeaveController::class, 'substitute'])->whereNumber('id');
Route::post('leaves/{id}/unsubstitute', [LeaveController::class, 'unsubstitute'])->whereNumber('id');
Route::post('leaves/{id}/auto', [LeaveController::class, 'auto'])->whereNumber('id');
});
