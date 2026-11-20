<?php

use Illuminate\Support\Facades\Route;
use Modules\TeacherExam\Controllers\TeacherExamController as C;
use Modules\TeacherExam\Middleware\ExamTeacherAuth;

// Nạp trong routes/api.php: prefix v1/gv/teacher/exams + middleware StaffToken.
Route::middleware(ExamTeacherAuth::class)->group(function () {
    Route::get('meta', [C::class, 'meta']);
    Route::get('overview', [C::class, 'overview']);
    Route::get('calendar', [C::class, 'calendar']);
    Route::get('activity', [C::class, 'activity']);

    Route::get('tests', [C::class, 'tests']);
    Route::post('tests', [C::class, 'storeTest']);
    Route::put('tests/{id}', [C::class, 'updateTest'])->whereNumber('id');
    Route::delete('tests/{id}', [C::class, 'destroyTest'])->whereNumber('id');
    Route::get('tests/{id}/sheet', [C::class, 'sheet'])->whereNumber('id');
    Route::put('tests/{id}/scores', [C::class, 'saveScores'])->whereNumber('id');
    Route::post('tests/{id}/status', [C::class, 'setStatus'])->whereNumber('id');
    Route::post('tests/{id}/sync', [C::class, 'sync'])->whereNumber('id');
    Route::get('tests/{id}/analytics', [C::class, 'analytics'])->whereNumber('id');
    Route::get('analytics/matrix', [C::class, 'matrix']);

    Route::get('questions', [C::class, 'questions']);
    Route::post('questions', [C::class, 'storeQuestion']);
    Route::put('questions/{id}', [C::class, 'updateQuestion'])->whereNumber('id');
    Route::delete('questions/{id}', [C::class, 'destroyQuestion'])->whereNumber('id');

    Route::post('papers/generate', [C::class, 'generatePaper']);
    Route::get('papers', [C::class, 'papers']);
    Route::post('papers', [C::class, 'storePaper']);
    Route::get('papers/{id}', [C::class, 'showPaper'])->whereNumber('id');
    Route::delete('papers/{id}', [C::class, 'destroyPaper'])->whereNumber('id');
});
