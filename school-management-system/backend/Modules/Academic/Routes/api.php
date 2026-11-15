<?php

use Illuminate\Support\Facades\Route;
use Modules\Academic\Controllers\ClassRoomController;
use Modules\Academic\Controllers\SmClassController;
use Modules\Academic\Middleware\AcademicStaff;
use Modules\Academic\Controllers\GradeWindowController;

// Prefix tự động: /api/v1/academic
Route::apiResource('classes', ClassRoomController::class);

// Quản lý lớp học (dữ liệu sm_*): /api/v1/academic/class-management
Route::prefix('class-management')
    ->middleware(['auth:sanctum', AcademicStaff::class])
    ->group(function () {
        Route::get('meta', [SmClassController::class, 'meta']);
        Route::get('stats', [SmClassController::class, 'stats']);
        Route::get('export', [SmClassController::class, 'export']);
        Route::post('bulk', [SmClassController::class, 'bulk']);
        Route::post('clone-year', [SmClassController::class, 'cloneYear']);

        Route::get('/', [SmClassController::class, 'index']);
        Route::post('/', [SmClassController::class, 'store']);

        Route::where(['id' => '[0-9]+', 'studentId' => '[0-9]+'])->group(function () {
            Route::get('{id}', [SmClassController::class, 'show']);
            Route::put('{id}', [SmClassController::class, 'update']);
            Route::delete('{id}', [SmClassController::class, 'destroy']);
            Route::put('{id}/homeroom', [SmClassController::class, 'homeroom']);

            Route::get('{id}/students', [SmClassController::class, 'students']);
            Route::post('{id}/students', [SmClassController::class, 'addStudents']);
            Route::get('{id}/students/available', [SmClassController::class, 'availableStudents']);
            Route::post('{id}/students/transfer', [SmClassController::class, 'transfer']);
            Route::delete('{id}/students/{studentId}', [SmClassController::class, 'removeStudent']);

            Route::get('{id}/subjects', [SmClassController::class, 'subjects']);
            Route::put('{id}/subjects', [SmClassController::class, 'saveSubjects']);
            Route::get('{id}/timetable', [SmClassController::class, 'timetable']);
            Route::put('{id}/timetable', [SmClassController::class, 'saveTimetable']);
            Route::get('{id}/activity', [SmClassController::class, 'activity']);
        });
    });

// Quản lý điểm — khóa/mở kỳ nhập điểm: /api/v1/academic/grade-windows
Route::prefix('grade-windows')
    ->middleware(['auth:sanctum', AcademicStaff::class])
    ->group(function () {
        Route::get('overview', [GradeWindowController::class, 'overview']);
        Route::post('open', [GradeWindowController::class, 'open']);
        Route::post('close', [GradeWindowController::class, 'close']);
        Route::post('exceptions', [GradeWindowController::class, 'addException']);
        Route::delete('exceptions/{id}', [GradeWindowController::class, 'removeException'])->whereNumber('id');
        Route::get('activity', [GradeWindowController::class, 'activity']);
    });
