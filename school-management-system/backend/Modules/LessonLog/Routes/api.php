<?php

use Illuminate\Support\Facades\Route;
use Modules\LessonLog\Controllers\LogbookController;
use Modules\LessonLog\Controllers\NoteController;
use Modules\LessonLog\Controllers\ReviewController;
use Modules\LessonLog\Middleware\LessonLogAccess as Access;

// Nạp từ routes/api.php với prefix: gv/lesson-log   (token nhân sự hoặc Sanctum, kiểm tra trong LessonLogAccess)
Route::group([], function () {
    Route::middleware(Access::class . ':view')->group(function () {
        Route::get('meta', [LogbookController::class, 'meta']);
        Route::get('week', [LogbookController::class, 'week']);
        Route::get('slot', [LogbookController::class, 'slot']);
        Route::post('entries', [LogbookController::class, 'saveEntry']);
        Route::delete('entries/{id}', [LogbookController::class, 'deleteEntry'])->whereNumber('id');
        Route::get('overview', [LogbookController::class, 'overview']);
        Route::get('progress', [LogbookController::class, 'progress']);
        Route::get('attendance', [LogbookController::class, 'attendance']);
        Route::get('attendance/student', [LogbookController::class, 'studentAttendance']);
        Route::get('roster', [LogbookController::class, 'roster']);
        Route::get('logs', [LogbookController::class, 'logs']);

        Route::get('notes', [NoteController::class, 'index']);
        Route::post('notes', [NoteController::class, 'store']);
        Route::delete('notes/{id}', [NoteController::class, 'destroy'])->whereNumber('id');

        Route::get('reviews', [ReviewController::class, 'index']);
        Route::post('reviews/sign', [ReviewController::class, 'sign']);
        Route::post('reviews/reopen', [ReviewController::class, 'reopen']);
    });

    Route::middleware(Access::class . ':bgh')->group(function () {
        Route::post('reviews/decide', [ReviewController::class, 'decide']);
        Route::get('school', [ReviewController::class, 'school']);
    });
});
