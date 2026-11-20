<?php

use Illuminate\Support\Facades\Route;
use Modules\Setting\Controllers\{AuditLogController, BackupController, SchoolYearController, SessionController, SettingController};
use Modules\Setting\Middleware\AdminOnly;

// Prefix tự động: /api/v1/setting  (đã có auth:sanctum từ ModuleLoader) — chỉ super_admin
Route::middleware(AdminOnly::class)->group(function () {
    Route::get('overview', [SettingController::class, 'overview']);
    Route::get('groups/{group}', [SettingController::class, 'show']);
    Route::put('groups/{group}', [SettingController::class, 'update']);
    Route::post('mail/test', [SettingController::class, 'mailTest']);
    Route::post('maintenance', [SettingController::class, 'maintenance']);
    Route::post('cache/clear', [SettingController::class, 'clearCache']);

    Route::get('school-years', [SchoolYearController::class, 'index']);
    Route::post('school-years', [SchoolYearController::class, 'store']);
    Route::put('school-years/{id}', [SchoolYearController::class, 'update']);
    Route::delete('school-years/{id}', [SchoolYearController::class, 'destroy']);
    Route::post('school-years/{id}/set-current', [SchoolYearController::class, 'setCurrent']);
    Route::post('semesters', [SchoolYearController::class, 'storeSemester']);
    Route::put('semesters/{id}', [SchoolYearController::class, 'updateSemester']);
    Route::delete('semesters/{id}', [SchoolYearController::class, 'destroySemester']);
    Route::post('semesters/{id}/set-current', [SchoolYearController::class, 'setCurrentSemester']);

    Route::get('backups', [BackupController::class, 'index']);
    Route::post('backups', [BackupController::class, 'store']);
    Route::put('backup-settings', [BackupController::class, 'updateSettings']);
    Route::get('backups/{id}/download', [BackupController::class, 'download']);
    Route::post('backups/{id}/restore', [BackupController::class, 'restore']);
    Route::delete('backups/{id}', [BackupController::class, 'destroy']);

    Route::get('audit-logs/meta', [AuditLogController::class, 'meta']);
    Route::get('audit-logs/export', [AuditLogController::class, 'export']);
    Route::get('audit-logs', [AuditLogController::class, 'index']);
    Route::get('audit-logs/{id}', [AuditLogController::class, 'show']);

    Route::get('sessions', [SessionController::class, 'index']);
    Route::post('sessions/revoke-all', [SessionController::class, 'revokeAll']);
    Route::delete('sessions/{id}', [SessionController::class, 'destroy']);
});
