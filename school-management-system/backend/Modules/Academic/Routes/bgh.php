<?php

// File này được nạp từ Routes/api.php bằng: require __DIR__ . '/bgh.php';
// (nên tự mang prefix /api/v1/academic và middleware 'api' của ModuleLoader)

use Illuminate\Support\Facades\Route;
use Modules\Academic\Controllers\BghCatalogController;
use Modules\Academic\Controllers\BghExamController;
use Modules\Academic\Controllers\BghOverviewController;
use Modules\Academic\Controllers\BghResultsController;
use Modules\Academic\Controllers\BghTimetableController;
use Modules\Academic\Controllers\BghWorkflowController;
use Modules\Academic\Middleware\EnsureBghAccess;

/*
|--------------------------------------------------------------------------
| Chuyên môn – Ban Giám hiệu   (/api/v1/academic/bgh/...)
| Yêu cầu đăng nhập Sanctum + vai trò principal | vice_principal | super_admin
|--------------------------------------------------------------------------
*/
Route::prefix('bgh')->middleware(['auth:sanctum', EnsureBghAccess::class])->group(function () {
    Route::get('meta', [BghOverviewController::class, 'meta']);
    Route::get('overview', [BghOverviewController::class, 'overview']);

    // Môn học, tổ chuyên môn, giáo viên, phân công
    Route::get('subjects', [BghCatalogController::class, 'subjects']);
    Route::get('subjects/{id}', [BghCatalogController::class, 'subject'])->whereNumber('id');
    Route::get('groups', [BghCatalogController::class, 'groups']);
    Route::put('groups/{id}/head', [BghCatalogController::class, 'setGroupHead'])->whereNumber('id');
    Route::get('teachers', [BghCatalogController::class, 'teachers']);
    Route::get('teachers/{id}', [BghCatalogController::class, 'teacher'])->whereNumber('id');
    Route::put('assignments/{id}', [BghCatalogController::class, 'reassign'])->whereNumber('id');

    // Thời khóa biểu
    Route::get('timetable', [BghTimetableController::class, 'grid']);
    Route::get('timetable/conflicts', [BghTimetableController::class, 'conflicts']);
    Route::post('timetable/swap', [BghTimetableController::class, 'swap']);

    // Kỳ thi & lịch thi
    Route::get('exams', [BghExamController::class, 'periods']);
    Route::get('exams/{period}/schedule', [BghExamController::class, 'schedule'])->whereNumber('period');
    Route::post('exams/{period}/schedule', [BghExamController::class, 'save'])->whereNumber('period');
    Route::delete('exams/schedule/{id}', [BghExamController::class, 'destroy'])->whereNumber('id');

    // Kết quả học tập
    Route::get('results', [BghResultsController::class, 'overview']);
    Route::get('results/class/{id}', [BghResultsController::class, 'classDetail'])->whereNumber('id');

    // Giáo án, dự giờ, phê duyệt, thông báo
    Route::get('lesson-plans', [BghWorkflowController::class, 'lessonPlans']);
    Route::post('lesson-plans/{id}/review', [BghWorkflowController::class, 'reviewPlan'])->whereNumber('id');
    Route::get('observations', [BghWorkflowController::class, 'observations']);
    Route::post('observations', [BghWorkflowController::class, 'createObservation']);
    Route::get('requests', [BghWorkflowController::class, 'requests']);
    Route::post('requests/{id}/decide', [BghWorkflowController::class, 'decide'])->whereNumber('id');
    Route::get('notifications', [BghWorkflowController::class, 'notifications']);
    Route::post('notifications/read', [BghWorkflowController::class, 'markRead']);
});
