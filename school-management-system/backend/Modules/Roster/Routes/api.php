<?php

use Illuminate\Support\Facades\Route;
use Modules\Roster\Controllers\ClassController;
use Modules\Roster\Controllers\RosterController;
use Modules\Roster\Controllers\StudentController;

// Prefix tự động: /api/v1/roster — dùng chung middleware với module Catalog (CATALOG_MIDDLEWARE trong .env)
$middleware = array_filter(explode('|', (string) env('CATALOG_MIDDLEWARE', 'auth:sanctum')));

Route::middleware($middleware)->group(function () {
    Route::get('years', [RosterController::class, 'years']);
    Route::get('overview', [RosterController::class, 'overview']);
    Route::get('lookups', [RosterController::class, 'lookups']);

    Route::get('classes', [ClassController::class, 'index']);
    Route::post('classes', [ClassController::class, 'store']);
    Route::get('classes/{id}', [ClassController::class, 'show'])->whereNumber('id');
    Route::put('classes/{id}', [ClassController::class, 'update'])->whereNumber('id');
    Route::delete('classes/{id}', [ClassController::class, 'destroy'])->whereNumber('id');
    Route::get('classes/{id}/export', [ClassController::class, 'export'])->whereNumber('id');
    Route::put('classes/{id}/subjects/{subjectId}', [ClassController::class, 'setSubject'])->whereNumber(['id', 'subjectId']);
    Route::delete('classes/{id}/subjects/{subjectId}', [ClassController::class, 'removeSubject'])->whereNumber(['id', 'subjectId']);

    Route::get('students/export', [StudentController::class, 'export']);
    Route::post('students/bulk-enroll', [StudentController::class, 'bulkEnroll']);
    Route::post('students/auto-assign', [StudentController::class, 'autoAssign']);
    Route::get('students', [StudentController::class, 'index']);
    Route::post('students', [StudentController::class, 'store']);
    Route::get('students/{id}', [StudentController::class, 'show'])->whereNumber('id');
    Route::put('students/{id}', [StudentController::class, 'update'])->whereNumber('id');
    Route::delete('students/{id}', [StudentController::class, 'destroy'])->whereNumber('id');
    Route::post('students/{id}/enroll', [StudentController::class, 'enroll'])->whereNumber('id');
    Route::delete('students/{id}/enroll', [StudentController::class, 'unenroll'])->whereNumber('id');
});
