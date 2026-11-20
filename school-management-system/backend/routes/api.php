<?php

use Illuminate\Http\Request;
use App\Http\Controllers\Api\AccountantController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\StudentPortalController;
use App\Http\Controllers\Api\StudentApiController;
use App\Http\Controllers\Api\StudentTuitionController;
use App\Http\Controllers\Api\AcademicApiController;
use App\Http\Controllers\Api\FeePeriodController;
use App\Http\Controllers\Api\FeeCashierController;
use App\Http\Controllers\Api\FeeReceiptController;
use App\Http\Controllers\Api\FeeDebtController;
use App\Http\Controllers\Api\FeeReminderController;
use App\Http\Controllers\Api\PublicSiteController;
use App\Http\Controllers\Api\GvWebsiteController;
use App\Http\Controllers\Api\GvContactController;
use App\Http\Controllers\Api\GvMonitorController;
use App\Http\Controllers\Api\GvNoticeController;
use App\Http\Controllers\Api\GvAttendanceController;
use App\Http\Controllers\Api\StudentReminderController;
use App\Http\Middleware\FeeStaffToken;
use App\Http\Middleware\StaffToken;
use App\Http\Middleware\MonitorAccess;
use App\Http\Middleware\NoticeAccess;
use App\Http\Controllers\Api\StudentWalletController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Student\StudentGradeController;
use App\Http\Middleware\StudentToken;
use App\Http\Controllers\Api\GvNotificationController;
use App\Http\Controllers\Api\Admin\RoleController;
use App\Http\Controllers\Api\Admin\SchoolYearController;
use App\Http\Controllers\Api\Admin\AdminProfileController;
use App\Http\Controllers\Api\Admin\AdminNotificationController;
use App\Http\Controllers\Api\Admin\AdminDataCheckController;
use App\Http\Controllers\Accountant\DebtController;
use App\Http\Controllers\Api\Admin\BackupController;
use App\Http\Controllers\Api\BghApprovalHubController;
use Modules\Attendance\Controllers\AttendanceController;
use Modules\Attendance\Controllers\StudentAttendanceController;
use App\Http\Controllers\Api\StudentAttendancePortalController;
use App\Http\Controllers\Api\LessonAttendanceStaffController;
use App\Http\Controllers\Api\TeacherPortalController;
use Modules\Homework\Controllers\HomeworkController;
use App\Http\Controllers\Api\TeacherHomeworkPortalController;
use App\Http\Controllers\Api\Admin\DataExportController;
use App\Http\Controllers\Api\Admin\DataHubController;
use App\Http\Controllers\Api\Admin\DataImportController;
use App\Http\Controllers\Api\Admin\DataMappingController;
use Illuminate\Support\Facades\Route;
use Modules\Logs\Controllers\AlertController;
use Modules\Logs\Controllers\LogController;
use Modules\Logs\Controllers\SecurityController;
use Modules\Logs\Controllers\SettingsController;
use Modules\Academic\Controllers\ClassRoomController;
use Modules\Academic\Controllers\SmClassController;
use Modules\Academic\Controllers\GradeWindowController;
use Modules\Academic\Middleware\AcademicStaff;
use App\Http\Controllers\Api\Bgh\PlanController;
use App\Http\Controllers\Api\Bgh\PlanExtraController;
use App\Http\Controllers\Api\Bgh\PlanTaskController;
use App\Http\Controllers\Api\Admin\AdminSubjectController;
use Modules\Logs\Middleware\BghAccess;
use App\Http\Controllers\Api\TeacherAttendanceController;
use App\Http\Controllers\Api\TeacherTimetableController;
use Modules\Teacher\Controllers\TeacherController;
use Modules\Subject\Controllers\AssignmentController;
use Modules\Subject\Controllers\GroupController;
use Modules\Subject\Controllers\InsightController;
use Modules\Subject\Controllers\SubjectController;
use App\Http\Controllers\Api\HomeroomAwardController;
use App\Http\Controllers\Api\HomeroomReportController;
use App\Http\Controllers\Api\Admin\AdminFinanceController as C;
use App\Http\Middleware\AdminAccess;
use App\Http\Controllers\Api\AdminFinanceController;
use App\Http\Controllers\Api\Teacher\LessonLogController;
use App\Http\Controllers\Api\BghApprovalCenterController;
use App\Http\Controllers\Api\TeacherNotificationController;
use App\Http\Controllers\Api\ObservationController;
use App\Http\Controllers\Api\TeacherLessonPlanController;
use App\Http\Controllers\Api\LessonPlanReviewController;
use Modules\Discipline\Controllers\DisciplineController;
Route::get('/health', fn () => response()->json(['status' => 'ok']));

// Đăng nhập hệ thống (Sanctum / admin…)
Route::post('/auth/login', [AuthController::class, 'login']);
// Alias cho frontend gọi /api/v1/...
Route::prefix('v1')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::post('gv/login', [AcademicApiController::class, 'login'])->middleware('throttle:20,1');
    Route::post('kt/login', [FeePeriodController::class, 'login'])->middleware('throttle:20,1');
});

// Website công khai của trường (không cần đăng nhập)
Route::prefix('public')->group(function () {
    Route::get('overview', [PublicSiteController::class, 'overview']);
    Route::get('news', [PublicSiteController::class, 'news']);
    Route::get('events', [PublicSiteController::class, 'events']);
    Route::get('news/{slug}', [PublicSiteController::class, 'newsOne'])->where('slug', '[a-z0-9\-]+');
    Route::post('admissions', [PublicSiteController::class, 'admit'])->middleware('throttle:20,1');
    Route::post('admissions/lookup', [PublicSiteController::class, 'lookup'])->middleware('throttle:20,1');
    Route::post('contact', [PublicSiteController::class, 'contact'])->middleware('throttle:20,1');
    // Thông báo hệ thống (banner) – công khai
    Route::get('announcements', [GvMonitorController::class, 'publicAnnouncements'])->middleware('throttle:120,1');
    // Thông báo của Ban Giám hiệu cho các cổng Giáo viên / Học sinh / Phụ huynh
    Route::get('notices', [GvNoticeController::class, 'feed'])->middleware('throttle:120,1');
    Route::post('notices/{id}/read', [GvNoticeController::class, 'markRead'])->whereNumber('id')->middleware('throttle:60,1');
});

// Kế toán
Route::prefix('v1/accountant')->group(function () {
    Route::get('/dashboard', [AccountantController::class, 'dashboard']);

    // Danh mục khoản thu
    Route::get('/fees', [AccountantController::class, 'fees']);
    Route::post('/fees', [AccountantController::class, 'storeFee']);
    Route::put('/fees/{id}', [AccountantController::class, 'updateFee'])->whereNumber('id');
    Route::patch('/fees/{id}/status', [AccountantController::class, 'toggleFeeStatus'])->whereNumber('id');
    Route::post('/fees/generate-debts', [AccountantController::class, 'generateDebts']);
    Route::get('/fees/export', [AccountantController::class, 'exportFees']);

    // Công nợ (DebtController)
    Route::prefix('debts')->controller(DebtController::class)->group(function () {
        Route::get('/', 'index');
        Route::get('options', 'options');
        Route::get('classes', 'classes');
        Route::post('reminders', 'bulkReminder');
        Route::post('payments/{receiptNo}/void', 'voidPayment');
        Route::get('{student}', 'show')->whereNumber('student');
        Route::post('{student}/payments', 'recordPayment')->whereNumber('student');
        Route::post('{student}/events', 'storeEvent')->whereNumber('student');
        Route::post('{student}/extend', 'extend')->whereNumber('student');
        Route::post('{student}/plans', 'storePlan')->whereNumber('student');
    });

    // Phiếu thu · báo cáo · tìm HS
    Route::get('/receipts', [AccountantController::class, 'receipts']);
    Route::get('/reports', [AccountantController::class, 'reports']);
    Route::get('/students/search', [AccountantController::class, 'searchStudent']);

    // Cài đặt kế toán (module Accountant: /api/v1/accountant/settings/...)
    require base_path('Modules/Accountant/Routes/api.php');
});

//    Controller tự kiểm tra token và vai trò quản trị. URL: /api/v1/admin/subjects...
Route::prefix('admin/subjects')->controller(AdminSubjectController::class)->group(function () {
    Route::get('/', 'index');
    Route::get('stats', 'stats');
    Route::get('meta', 'meta');
    Route::post('/', 'store')->middleware('throttle:60,1');
    Route::get('{id}', 'show')->whereNumber('id');
    Route::put('{id}', 'update')->whereNumber('id');
    Route::delete('{id}', 'destroy')->whereNumber('id');
    Route::post('{id}/toggle', 'toggle')->whereNumber('id');
    Route::post('{id}/assign', 'assign')->whereNumber('id');
    Route::put('{id}/assign/{csid}', 'reassign')->whereNumber('id')->whereNumber('csid');
    Route::delete('{id}/assign/{csid}', 'unassign')->whereNumber('id')->whereNumber('csid');
});
// ===== Module Môn học (admin/subjects) → /api/v1/subject/... =====
Route::prefix('v1/subject')
    ->middleware(['auth:sanctum', \App\Http\Middleware\AdminAccess::class])
    ->group(function () {
        Route::get('meta', [SubjectController::class, 'meta']);

        // Môn học
        Route::get('subjects/export', [SubjectController::class, 'export']);
        Route::post('subjects/import', [SubjectController::class, 'import']);
        Route::post('subjects/bulk', [SubjectController::class, 'bulk']);
        Route::post('subjects/reorder', [SubjectController::class, 'reorder']);
        Route::post('subjects/{id}/duplicate', [SubjectController::class, 'duplicate'])->whereNumber('id');
        Route::get('subjects', [SubjectController::class, 'index']);
        Route::post('subjects', [SubjectController::class, 'store']);
        Route::get('subjects/{id}', [SubjectController::class, 'show'])->whereNumber('id');
        Route::put('subjects/{id}', [SubjectController::class, 'update'])->whereNumber('id');
        Route::delete('subjects/{id}', [SubjectController::class, 'destroy'])->whereNumber('id');

        // Tổ bộ môn
        Route::get('groups', [GroupController::class, 'index']);
        Route::post('groups', [GroupController::class, 'store']);
        Route::put('groups/{id}', [GroupController::class, 'update'])->whereNumber('id');
        Route::delete('groups/{id}', [GroupController::class, 'destroy'])->whereNumber('id');

        // Phân công giảng dạy
        Route::get('assignments', [AssignmentController::class, 'matrix']);
        Route::put('assignments', [AssignmentController::class, 'assign']);
        Route::post('assignments/bulk', [AssignmentController::class, 'assignMany']);
        Route::post('assignments/auto', [AssignmentController::class, 'auto']);
        Route::post('assignments/copy', [AssignmentController::class, 'copy']);
        Route::delete('assignments/{id}', [AssignmentController::class, 'destroy'])->whereNumber('id');
        Route::get('workload', [AssignmentController::class, 'workload']);

        // Chương trình & hệ số điểm
        Route::get('curriculum', [SubjectController::class, 'curriculum']);
        Route::put('curriculum/{id}', [SubjectController::class, 'saveCurriculum'])->whereNumber('id');

        // Tổng quan, kiểm tra toàn vẹn, thống kê, nhật ký
        Route::get('overview', [InsightController::class, 'overview']);
        Route::get('integrity', [InsightController::class, 'integrity']);
        Route::get('analytics', [InsightController::class, 'analytics']);
                Route::get('audit', [SubjectController::class, 'audit']);
            });

        // ===== Module Giáo viên (admin/teachers) → /api/v1/teacheradmin/... =====
        Route::prefix('v1/teacheradmin')
            ->group(base_path('Modules/TeacherAdmin/Routes/api.php'));

        // Quản trị tài khoản + vai trò
        Route::prefix('admin')->middleware(['auth:sanctum', \App\Http\Middleware\AdminAccess::class])->group(function () {
            Route::get('/users', [UserController::class, 'index']);

    // Context cho sidebar / phân quyền
    Route::get('/context', function () {
        return response()->json([
            'ok' => true,
            'role' => 'super_admin',
            'permissions' => ['*'],
            'school_year' => '2025-2026',
            'semester' => 1,
        ]);
    });

    // Vai trò & phân quyền
    Route::get('/roles', [\App\Http\Controllers\Api\Admin\RoleController::class, 'index']);
    Route::get('/roles/{id}', [\App\Http\Controllers\Api\Admin\RoleController::class, 'show'])->whereNumber('id');
    Route::post('/roles', [\App\Http\Controllers\Api\Admin\RoleController::class, 'store']);
    Route::put('/roles/{id}/permissions', [\App\Http\Controllers\Api\Admin\RoleController::class, 'syncPermissions'])->whereNumber('id');
    Route::delete('/roles/{id}', [\App\Http\Controllers\Api\Admin\RoleController::class, 'destroy'])->whereNumber('id');

    Route::get('/school-years', [SchoolYearController::class, 'index']);
    Route::post('/school-years', [SchoolYearController::class, 'store']);
    Route::put('/school-years/{id}', [SchoolYearController::class, 'update']);
    Route::post('/school-years/{id}/set-current', [SchoolYearController::class, 'setCurrent']);
    Route::put('/semesters/{id}', [SchoolYearController::class, 'updateSemester']);
    Route::get('/backups', [BackupController::class, 'index']);
    Route::post('/backups', [BackupController::class, 'store']);
    Route::get('/backups/{id}/download', [BackupController::class, 'download']);
    Route::delete('/backups/{id}', [BackupController::class, 'destroy']);
    Route::post('/backups/{id}/restore', [BackupController::class, 'restore']);
    Route::put('/backups/settings', [BackupController::class, 'updateSettings']);
});

Route::prefix('admin/data-hub')->middleware(['auth:sanctum', \App\Http\Middleware\AdminAccess::class])->group(function () {
    Route::get('datasets', [DataHubController::class, 'datasets']);
    Route::get('overview', [DataHubController::class, 'overview']);

    // nhập
    Route::post('import/validate', [DataImportController::class, 'validateRows']);
    Route::post('import/start', [DataImportController::class, 'start']);
    Route::post('import/{batch}/chunk', [DataImportController::class, 'chunk'])->whereNumber('batch');
    Route::post('import/{batch}/finish', [DataImportController::class, 'finish'])->whereNumber('batch');
    Route::get('import/batches', [DataImportController::class, 'batches']);
    Route::get('import/batches/{batch}', [DataImportController::class, 'show'])->whereNumber('batch');
    Route::post('import/batches/{batch}/undo', [DataImportController::class, 'undo'])->whereNumber('batch');

    // xuất
    Route::get('export/rows', [DataExportController::class, 'rows']);
    Route::post('export/log', [DataExportController::class, 'log']);
    Route::get('export/logs', [DataExportController::class, 'logs']);

    // mẫu ghép cột
    Route::get('mappings', [DataMappingController::class, 'index']);
    Route::post('mappings', [DataMappingController::class, 'store']);
    Route::delete('mappings/{id}', [DataMappingController::class, 'destroy'])->whereNumber('id');
});

// ===== Dự giờ & Đánh giá giáo viên (/api/v1/evaluations/...) =====
Route::prefix('v1/evaluations')->group(function () {
    require base_path('Modules/Evaluations/Routes/api.php');
});

// Cổng học sinh cũ (Sanctum)
Route::middleware('auth:sanctum')->prefix('student')->group(function () {
    Route::get('/me', [StudentPortalController::class, 'me']);
    Route::get('/dashboard', [StudentPortalController::class, 'dashboard']);
    Route::get('/schedule', [StudentPortalController::class, 'schedule']);
    Route::get('/exams', [StudentPortalController::class, 'exams']);
    Route::get('/grades', [StudentPortalController::class, 'grades']);
});

// ===== Học sinh DB thật (sm_*) =====
Route::prefix('v1/hs')->group(function () {
    Route::post('login', [StudentApiController::class, 'login'])->middleware('throttle:20,1');

    Route::post('forgot-password', [StudentApiController::class, 'forgotPassword'])->middleware('throttle:6,1');
    Route::post('forgot-password/verify', [StudentApiController::class, 'forgotVerify'])->middleware('throttle:12,1');
    Route::post('forgot-password/reset', [StudentApiController::class, 'forgotReset'])->middleware('throttle:12,1');

    // Callback cổng thanh toán (không cần token HS – verify chữ ký)
    Route::post('wallet/momo/ipn', [StudentWalletController::class, 'momoIpn']);
    Route::get('wallet/vnpay/return', [StudentWalletController::class, 'vnpayReturn']);

    Route::middleware(StudentToken::class)->group(function () {
        Route::post('logout', [StudentApiController::class, 'logout']);
        Route::get('me', [StudentApiController::class, 'me']);
        Route::get('schedule', [StudentApiController::class, 'schedule']);
        Route::get('classmates', [StudentApiController::class, 'classmates']);
        Route::get('exams', [StudentApiController::class, 'exams']);
        Route::get('grades', [StudentApiController::class, 'grades']);
        Route::post('change-password', [StudentApiController::class, 'changePassword']);
        Route::get('security', [StudentApiController::class, 'security']);
        Route::post('security/revoke-others', [StudentApiController::class, 'revokeOthers']);
        Route::post('security/sessions/{id}/revoke', [StudentApiController::class, 'revokeSession'])->whereNumber('id');

        // Hồ sơ cá nhân
        Route::get('profile', [StudentApiController::class, 'profile']);
        Route::put('profile/contact', [StudentApiController::class, 'updateContact']);
        Route::put('profile/name', [StudentApiController::class, 'updateName'])->middleware('throttle:10,1');
        Route::post('profile/requests', [StudentApiController::class, 'createProfileRequest'])->middleware('throttle:20,1');
        Route::post('profile/requests/{id}/cancel', [StudentApiController::class, 'cancelProfileRequest'])->whereNumber('id');

        // Học phí của học sinh
        Route::get('fees/summary', [StudentTuitionController::class, 'summary']);
        Route::get('fees/catalog', [StudentTuitionController::class, 'catalog']);
        Route::get('fees/invoices', [StudentTuitionController::class, 'invoices']);
        Route::get('fees/invoices/{id}', [StudentTuitionController::class, 'invoice'])->whereNumber('id');
        Route::post('fees/invoices/{id}/declare', [StudentTuitionController::class, 'declare'])->whereNumber('id')->middleware('throttle:20,1');
        Route::post('fees/invoices/{id}/dispute', [StudentTuitionController::class, 'dispute'])->whereNumber('id')->middleware('throttle:10,1');
        Route::get('fees/payments', [StudentTuitionController::class, 'payments']);
        Route::post('fees/payments/{id}/cancel', [StudentTuitionController::class, 'cancelPayment'])->whereNumber('id');
        Route::get('fees/receipts/{id}', [StudentTuitionController::class, 'receipt'])->whereNumber('id');
        Route::get('fees/reminders', [StudentReminderController::class, 'index']);
        Route::post('fees/reminders/read-all', [StudentReminderController::class, 'readAll']);
        Route::post('fees/reminders/{id}/read', [StudentReminderController::class, 'read'])->whereNumber('id');

        // Thông báo / badge
        Route::get('notifications/badges', [NotificationController::class, 'badges']);
        Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::post('notifications/read-module', [NotificationController::class, 'readModule']);
        Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'markRead'])->whereNumber('id');

        Route::get('attendance', [StudentAttendancePortalController::class, 'overview']);
        Route::get('attendance/records', [StudentAttendancePortalController::class, 'records']);
        Route::get('attendance/leaves', [StudentAttendancePortalController::class, 'leaves']);
        Route::post('attendance/leaves', [StudentAttendancePortalController::class, 'storeLeave'])->middleware('throttle:10,1');
        Route::post('attendance/leaves/{id}/cancel', [StudentAttendancePortalController::class, 'cancelLeave'])->whereNumber('id');
        Route::get('attendance/subjects', [StudentAttendancePortalController::class, 'subjects']);
        Route::get('attendance/subjects/{id}', [StudentAttendancePortalController::class, 'subject'])->whereNumber('id');

        // Bài tập
        Route::prefix('homework')->group(function () {
            Route::get('summary', [HomeworkController::class, 'summary']);
            Route::get('subjects', [HomeworkController::class, 'subjects']);
            Route::get('calendar', [HomeworkController::class, 'calendar']);
            Route::get('files/{file}', [HomeworkController::class, 'download'])->whereNumber('file');

            Route::get('/', [HomeworkController::class, 'index']);
            Route::get('{id}', [HomeworkController::class, 'show'])->whereNumber('id');
            Route::post('{id}/submit', [HomeworkController::class, 'submit'])->whereNumber('id')->middleware('throttle:20,1');
            Route::put('{id}/state', [HomeworkController::class, 'saveState'])->whereNumber('id');
            Route::get('{id}/comments', [HomeworkController::class, 'comments'])->whereNumber('id');
            Route::post('{id}/comments', [HomeworkController::class, 'addComment'])->whereNumber('id')->middleware('throttle:20,1');
        });

        // Ví học phí
        Route::get('wallet/balance', [StudentWalletController::class, 'balance']);
        Route::get('wallet/transactions', [StudentWalletController::class, 'transactions']);
        Route::post('wallet/topup', [StudentWalletController::class, 'topup']);
    });
});

Route::prefix('v1/logs')->middleware(BghAccess::class)->group(function () {
    Route::get('me', [LogController::class, 'me']);
    Route::get('overview', [LogController::class, 'overview']);
    Route::get('facets', [LogController::class, 'facets']);
    Route::get('finance', [LogController::class, 'finance']);
    Route::get('export', [LogController::class, 'export']);
    Route::post('verify', [LogController::class, 'verify']);

    Route::get('security', [SecurityController::class, 'overview']);
    Route::get('sessions', [SecurityController::class, 'sessions']);
    Route::post('sessions/purge-expired', [SecurityController::class, 'purgeExpired']);
    Route::delete('sessions/{type}/{id}', [SecurityController::class, 'revoke'])->whereNumber('id');
    Route::post('accounts/{type}/{id}/unlock', [SecurityController::class, 'unlock'])->whereNumber('id');

    Route::get('alerts', [AlertController::class, 'index']);
    Route::post('alerts/{id}/ack', [AlertController::class, 'acknowledge'])->whereNumber('id');
    Route::post('alerts/{id}/resolve', [AlertController::class, 'resolve'])->whereNumber('id');
    Route::get('alert-rules', [AlertController::class, 'rules']);
    Route::put('alert-rules/{id}', [AlertController::class, 'updateRule'])->whereNumber('id');

    Route::get('settings', [SettingsController::class, 'show']);
    Route::put('settings', [SettingsController::class, 'update']);
    Route::post('settings/purge', [SettingsController::class, 'purge']);
    Route::post('settings/import-legacy', [SettingsController::class, 'importLegacy']);

    Route::get('activities', [LogController::class, 'index']);
    Route::get('activities/{id}', [LogController::class, 'show'])->whereNumber('id');
});
        // ========== PHÊ DUYỆT (Ban giám hiệu) – hộp phê duyệt thống nhất ==========
        Route::prefix('approvals')->withoutMiddleware([StaffToken::class])->controller(BghApprovalCenterController::class)->group(function () {
            Route::get('overview', 'overview');
            Route::get('templates', 'templates');
            Route::get('types', 'types');
            Route::put('types/{code}', 'updateType')->where('code', '[a-z_]+');
            Route::get('delegations', 'delegations');
            Route::post('delegations', 'createDelegation');
            Route::delete('delegations/{id}', 'revokeDelegation')->whereNumber('id');
            Route::get('staff', 'staff');
            Route::post('sync', 'sync')->middleware('throttle:60,1');
            Route::get('report', 'report');
            Route::get('export', 'export');
            Route::post('bulk', 'bulk')->middleware('throttle:30,1');
            Route::get('/', 'list');
            Route::get('{id}', 'show')->whereNumber('id');
            Route::post('{id}/decide', 'decide')->whereNumber('id')->middleware('throttle:60,1');
            Route::post('{id}/comment', 'comment')->whereNumber('id')->middleware('throttle:60,1');
        });
// ===== Khu Giáo vụ / Ban giám hiệu =====
Route::prefix('gv')->group(function () {
    Route::post('login', [AcademicApiController::class, 'login'])->middleware('throttle:20,1');

    Route::middleware(StaffToken::class)->group(function () {
        Route::post('logout', [AcademicApiController::class, 'logout']);
        Route::get('me', [AcademicApiController::class, 'me']);
        Route::get('dashboard', [AcademicApiController::class, 'dashboard']);

        Route::get('students', [AcademicApiController::class, 'students']);
        Route::get('students/{code}', [AcademicApiController::class, 'studentDetail']);
        Route::put('students/{code}', [AcademicApiController::class, 'updateStudent']);
        Route::post('students/{code}/reset-password', [AcademicApiController::class, 'resetStudentPassword'])->middleware('throttle:30,1');

        Route::get('profile-requests', [AcademicApiController::class, 'requests']);
        Route::post('profile-requests/{id}/review', [AcademicApiController::class, 'reviewRequest']);

        Route::get('classes', [AcademicApiController::class, 'classes']);
        Route::get('classes/{id}', [AcademicApiController::class, 'classDetail']);
        Route::get('assignments', [AcademicApiController::class, 'assignments']);
        Route::put('assignments/{id}', [AcademicApiController::class, 'updateAssignment']);
        Route::get('timetable', [AcademicApiController::class, 'timetable']);
        Route::get('exams', [AcademicApiController::class, 'exams']);
        Route::get('grades', [AcademicApiController::class, 'grades']);
        Route::get('promotion', [AcademicApiController::class, 'promotion']);
        Route::get('reports', [AcademicApiController::class, 'reports']);



        // ========== THÔNG BÁO GIÁO VỤ ==========
        Route::get('notifications', [GvNotificationController::class, 'index']);
        Route::post('notifications', [GvNotificationController::class, 'store']);
        Route::post('notifications/read-all', [GvNotificationController::class, 'readAll']);
        Route::post('notifications/{id}/read', [GvNotificationController::class, 'read'])->whereNumber('id');
        Route::delete('notifications/{id}', [GvNotificationController::class, 'destroy'])->whereNumber('id');

        // ========== QUẢN LÝ WEBSITE (tuyển sinh, liên hệ, tin tức) ==========
        Route::prefix('website')->group(function () {
            Route::get('summary', [GvWebsiteController::class, 'summary']);
            Route::get('admissions', [GvWebsiteController::class, 'admissions']);
            Route::get('admissions/export', [GvWebsiteController::class, 'admissionsExport']);
            Route::put('admissions/{id}', [GvWebsiteController::class, 'admissionUpdate'])->whereNumber('id');
            Route::delete('admissions/{id}', [GvWebsiteController::class, 'admissionDelete'])->whereNumber('id');
            Route::get('contacts', [GvWebsiteController::class, 'contacts']);
            Route::put('contacts/{id}', [GvWebsiteController::class, 'contactUpdate'])->whereNumber('id');
            Route::delete('contacts/{id}', [GvWebsiteController::class, 'contactDelete'])->whereNumber('id');
            Route::get('news', [GvWebsiteController::class, 'news']);
            Route::post('news', [GvWebsiteController::class, 'newsStore']);
            Route::get('news/{id}', [GvWebsiteController::class, 'newsOne'])->whereNumber('id');
            Route::put('news/{id}', [GvWebsiteController::class, 'newsUpdate'])->whereNumber('id');
            Route::post('news/{id}/toggle', [GvWebsiteController::class, 'newsToggle'])->whereNumber('id');
            Route::delete('news/{id}', [GvWebsiteController::class, 'newsDelete'])->whereNumber('id');

            // Module Liên hệ & Hỗ trợ
            Route::get('staff', [GvContactController::class, 'staff']);
            Route::get('inbox/overview', [GvContactController::class, 'overview']);
            Route::get('inbox/report', [GvContactController::class, 'report']);
            Route::get('inbox/export', [GvContactController::class, 'inboxExport']);
            Route::post('inbox/bulk', [GvContactController::class, 'bulk'])->middleware('throttle:60,1');
            Route::get('inbox/settings', [GvContactController::class, 'settings']);
            Route::put('inbox/settings', [GvContactController::class, 'settingsUpdate']);
            Route::get('inbox/templates', [GvContactController::class, 'templates']);
            Route::post('inbox/templates', [GvContactController::class, 'templateStore']);
            Route::put('inbox/templates/{id}', [GvContactController::class, 'templateUpdate'])->whereNumber('id');
            Route::delete('inbox/templates/{id}', [GvContactController::class, 'templateDestroy'])->whereNumber('id');
            Route::get('inbox', [GvContactController::class, 'inbox']);
            Route::get('inbox/{id}', [GvContactController::class, 'show'])->whereNumber('id');
            Route::put('inbox/{id}', [GvContactController::class, 'update'])->whereNumber('id');
            Route::post('inbox/{id}/events', [GvContactController::class, 'addEvent'])->whereNumber('id')->middleware('throttle:60,1');
            Route::delete('inbox/{id}', [GvContactController::class, 'destroy'])->whereNumber('id');
        });
        // Duyệt kế hoạch bài dạy (Ban giám hiệu)
        Route::prefix('lesson-plans/review')->group(function () {
            Route::get('/', [LessonPlanReviewController::class, 'rvList']);
            Route::get('{id}', [LessonPlanReviewController::class, 'rvShow'])->whereNumber('id');
            Route::post('{id}/decide', [LessonPlanReviewController::class, 'rvDecide'])->whereNumber('id')->middleware('throttle:60,1');
        });
        // ========== ĐIỂM DANH TỪNG TIẾT ==========
        Route::get('attendance/lessons', [LessonAttendanceStaffController::class, 'lessons']);
        Route::get('attendance/roster', [LessonAttendanceStaffController::class, 'roster']);
        Route::post('attendance/mark', [LessonAttendanceStaffController::class, 'mark'])->middleware('throttle:60,1');

        // ========== CỔNG GIÁO VIÊN: lớp & môn của tôi, lớp chủ nhiệm, duyệt đơn xin nghỉ ==========
        Route::prefix('teacher')->group(function () {
                    // Kế hoạch bài dạy
                    Route::prefix('lesson-plans')->group(function () {
                        Route::get('overview', [TeacherLessonPlanController::class, 'lpOverview']);
                        Route::put('items/{itemId}', [TeacherLessonPlanController::class, 'lpItemUpdate'])->whereNumber('itemId');
                        Route::delete('items/{itemId}', [TeacherLessonPlanController::class, 'lpItemDelete'])->whereNumber('itemId');
                        Route::post('items/{itemId}/taught', [TeacherLessonPlanController::class, 'lpTaught'])->whereNumber('itemId');
                        Route::get('/', [TeacherLessonPlanController::class, 'lpList']);
                        Route::post('/', [TeacherLessonPlanController::class, 'lpStore'])->middleware('throttle:30,1');
                        Route::get('{id}', [TeacherLessonPlanController::class, 'lpShow'])->whereNumber('id');
                        Route::put('{id}', [TeacherLessonPlanController::class, 'lpUpdate'])->whereNumber('id');
                        Route::delete('{id}', [TeacherLessonPlanController::class, 'lpDelete'])->whereNumber('id');
                        Route::post('{id}/submit', [TeacherLessonPlanController::class, 'lpSubmit'])->whereNumber('id');
                        Route::post('{id}/reopen', [TeacherLessonPlanController::class, 'lpReopen'])->whereNumber('id');
                        Route::post('{id}/clone', [TeacherLessonPlanController::class, 'lpClone'])->whereNumber('id');
                        Route::post('{id}/items', [TeacherLessonPlanController::class, 'lpItemStore'])->whereNumber('id');
                        Route::post('{id}/reorder', [TeacherLessonPlanController::class, 'lpReorder'])->whereNumber('id');
                    });
            Route::get('me', [TeacherPortalController::class, 'profile']);
            Route::get('assignments', [TeacherPortalController::class, 'assignments']);
            Route::get('assignments/{id}', [TeacherPortalController::class, 'assignment'])->whereNumber('id');
            Route::get('homeroom', [TeacherPortalController::class, 'homeroom']);
            Route::get('homeroom/dashboard', [TeacherPortalController::class, 'dashboard']);
            Route::get('homeroom/students/{id}', [TeacherPortalController::class, 'student'])->whereNumber('id');
            Route::get('homeroom/leaves', [TeacherPortalController::class, 'leaves']);
            Route::post('homeroom/leaves/{id}/review', [TeacherPortalController::class, 'reviewLeave'])->whereNumber('id')->middleware('throttle:60,1');

            // Sổ đầu bài – URL: /api/gv/teacher/lesson-log/...
            Route::prefix('lesson-log')->controller(LessonLogController::class)->group(function () {
                Route::get('meta', 'meta');
                Route::get('students', 'students');
                Route::get('week', 'week');
                Route::get('stats', 'stats');
                Route::get('export', 'export');
                Route::post('week/confirm', 'confirmWeek')->middleware('throttle:30,1');
                Route::post('week/reopen', 'reopenWeek')->middleware('throttle:30,1');

                Route::get('/', 'index');
                Route::post('/', 'store')->middleware('throttle:120,1');
                Route::get('{id}', 'show')->whereNumber('id');
                Route::put('{id}', 'update')->whereNumber('id');
                Route::delete('{id}', 'destroy')->whereNumber('id');
                Route::post('{id}/sign', 'sign')->whereNumber('id');
                Route::post('{id}/unsign', 'unsign')->whereNumber('id');
                Route::post('{id}/reopen', 'reopen')->whereNumber('id');
                Route::post('{id}/comment', 'comment')->whereNumber('id')->middleware('throttle:60,1');
                Route::put('{id}/homeroom-note', 'homeroomNote')->whereNumber('id');
            });

            // Alias Sổ đầu bài cho GVCN: /api/gv/teacher/homeroom/lesson-log/...
            Route::prefix('homeroom/lesson-log')->controller(LessonLogController::class)->group(function () {
                Route::get('meta', 'meta');
                Route::get('students', 'students');
                Route::get('week', 'week');
                Route::get('stats', 'stats');
                Route::get('export', 'export');
                Route::post('week/confirm', 'confirmWeek')->middleware('throttle:30,1');
                Route::post('week/reopen', 'reopenWeek')->middleware('throttle:30,1');
                Route::get('/', 'index');
                Route::post('/', 'store')->middleware('throttle:120,1');
                Route::get('{id}', 'show')->whereNumber('id');
                Route::put('{id}', 'update')->whereNumber('id');
                Route::delete('{id}', 'destroy')->whereNumber('id');
                Route::post('{id}/sign', 'sign')->whereNumber('id');
                Route::post('{id}/unsign', 'unsign')->whereNumber('id');
                Route::post('{id}/reopen', 'reopen')->whereNumber('id');
                Route::post('{id}/comment', 'comment')->whereNumber('id')->middleware('throttle:60,1');
                Route::put('{id}/homeroom-note', 'homeroomNote')->whereNumber('id');
            });

Route::prefix('nt')->controller(TeacherNotificationController::class)->group(function () {
            Route::get('overview', 'overview');
            Route::get('feed', 'index');
            Route::post('state', 'state');
            Route::post('read-all', 'readAll');
            Route::get('prefs', 'prefs');
            Route::put('prefs', 'prefsSave');
            Route::get('reminders', 'reminders');
            Route::post('reminders', 'reminderSave');
            Route::put('reminders/{id}', 'reminderSave')->whereNumber('id');
            Route::post('reminders/{id}/done', 'reminderDone')->whereNumber('id');
            Route::delete('reminders/{id}', 'reminderDelete')->whereNumber('id');
            Route::get('classes', 'classes');
            Route::get('outbox', 'outbox');
            Route::post('outbox', 'outboxSend');
            Route::get('outbox/{id}', 'outboxShow')->whereNumber('id');
            Route::post('outbox/{id}/cancel', 'outboxCancel')->whereNumber('id');
            Route::get('published', 'published');
            Route::post('publish', 'publish');
            Route::post('published/{id}/revoke', 'revoke')->whereNumber('id');
            Route::get('teachers', 'teachers');
        });

// Dự giờ & đánh giá tiết dạy: /api/gv/teacher/ob/...
Route::prefix('ob')->controller(ObservationController::class)->group(function () {
            Route::get('meta', 'meta');
            Route::get('teachers', 'teachers');
            Route::get('slots', 'slots');
            Route::get('overview', 'overview');
            Route::get('sessions', 'sessions');
            Route::post('sessions', 'sessionStore')->middleware('throttle:60,1');
            Route::get('sessions/{id}', 'sessionShow')->whereNumber('id');
            Route::put('sessions/{id}', 'sessionUpdate')->whereNumber('id');
            Route::post('sessions/{id}/respond', 'sessionRespond')->whereNumber('id');
            Route::post('sessions/{id}/cancel', 'sessionCancel')->whereNumber('id');
            Route::post('sessions/{id}/comments', 'commentAdd')->whereNumber('id')->middleware('throttle:60,1');
            Route::get('sessions/{id}/form', 'evalForm')->whereNumber('id');
            Route::put('sessions/{id}/eval', 'evalSave')->whereNumber('id')->middleware('throttle:120,1');
            Route::get('evals/{id}/show', 'evalShow')->whereNumber('id');
            Route::post('evals/{id}/ack', 'evalAck')->whereNumber('id');
            Route::get('results', 'results');
            Route::get('actions', 'actions');
            Route::post('actions', 'actionSave');
            Route::put('actions/{id}', 'actionSave')->whereNumber('id');
            Route::delete('actions/{id}', 'actionDelete')->whereNumber('id');
            Route::get('settings', 'settings');
            Route::put('settings', 'settingsSave');
            Route::get('templates', 'templates');
            Route::post('templates', 'templateSave');
            Route::get('templates/{id}', 'templateShow')->whereNumber('id');
            Route::put('templates/{id}', 'templateSave')->whereNumber('id');
            Route::post('templates/{id}/default', 'templateDefault')->whereNumber('id');
            Route::get('report', 'report');
        });

// Điểm danh từng tiết: nộp & khóa gửi về nhà trường
Route::prefix('att')->group(function () {
    Route::get('today', [TeacherAttendanceController::class, 'overview']); // frontend gọi /att/today
    Route::get('overview', [TeacherAttendanceController::class, 'overview']);
    Route::get('missing', [TeacherAttendanceController::class, 'missing']);
    Route::get('week', [TeacherAttendanceController::class, 'week']);
    Route::get('roster', [TeacherAttendanceController::class, 'roster']);
    Route::post('save', [TeacherAttendanceController::class, 'save'])->middleware('throttle:60,1');
    Route::post('submit', [TeacherAttendanceController::class, 'submit'])->middleware('throttle:60,1');
    Route::post('reopen-request', [TeacherAttendanceController::class, 'reopenRequest'])->middleware('throttle:20,1');
    Route::get('history', [TeacherAttendanceController::class, 'history']);
    Route::get('stats', [TeacherAttendanceController::class, 'stats']);
    Route::get('student/{id}', [TeacherAttendanceController::class, 'student'])->whereNumber('id');
    Route::get('homeroom', [TeacherAttendanceController::class, 'homeroom']);
});

 Route::prefix('tt')->group(function () {
                Route::get('overview', [TeacherTimetableController::class, 'overview']);
                Route::get('week', [TeacherTimetableController::class, 'week']);
                Route::get('classes', [TeacherTimetableController::class, 'classes']);
                Route::get('class/{id}', [TeacherTimetableController::class, 'classTable'])->whereNumber('id');
                Route::get('load', [TeacherTimetableController::class, 'load']);
                Route::get('suggest', [TeacherTimetableController::class, 'suggest']);
                Route::get('notes', [TeacherTimetableController::class, 'notes']);
                Route::post('notes', [TeacherTimetableController::class, 'noteSave'])->middleware('throttle:60,1');
                Route::delete('notes/{id}', [TeacherTimetableController::class, 'noteDelete'])->whereNumber('id');
                Route::get('requests', [TeacherTimetableController::class, 'requests']);
                Route::post('requests', [TeacherTimetableController::class, 'requestCreate'])->middleware('throttle:20,1');
                Route::post('requests/{id}/cancel', [TeacherTimetableController::class, 'requestCancel'])->whereNumber('id');
                Route::post('requests/{id}/review', [TeacherTimetableController::class, 'requestReview'])->whereNumber('id');
            });

            // Bài tập (giáo viên giao bài, xem bài nộp, chấm điểm)
            Route::prefix('homework')->group(function () {
                Route::get('/', [TeacherHomeworkPortalController::class, 'hwList']);
                Route::post('/', [TeacherHomeworkPortalController::class, 'hwStore'])->middleware('throttle:30,1');
                Route::get('files/{file}', [TeacherHomeworkPortalController::class, 'hwDownload'])->whereNumber('file');
                Route::post('submissions/{submissionId}/grade', [TeacherHomeworkPortalController::class, 'hwGrade'])->whereNumber('submissionId');
                Route::get('{id}', [TeacherHomeworkPortalController::class, 'hwShow'])->whereNumber('id');
                Route::put('{id}', [TeacherHomeworkPortalController::class, 'hwUpdate'])->whereNumber('id');
                Route::delete('{id}', [TeacherHomeworkPortalController::class, 'hwDelete'])->whereNumber('id');
                Route::get('{id}/submissions', [TeacherHomeworkPortalController::class, 'hwSubmissions'])->whereNumber('id');
                Route::get('{id}/comments', [TeacherHomeworkPortalController::class, 'hwComments'])->whereNumber('id');
                Route::post('{id}/comments', [TeacherHomeworkPortalController::class, 'hwReply'])->whereNumber('id')->middleware('throttle:30,1');
            });
        });

        Route::prefix('homeroom/awards')->group(function () {
            Route::get('overview', [HomeroomAwardController::class, 'overview']);
            Route::get('types', [HomeroomAwardController::class, 'types']);
            Route::get('periods', [HomeroomAwardController::class, 'periods']);
            Route::get('students', [HomeroomAwardController::class, 'students']);
            Route::get('nominations', [HomeroomAwardController::class, 'index']);
            Route::post('nominations', [HomeroomAwardController::class, 'store']);
            Route::post('nominations/{id}/submit', [HomeroomAwardController::class, 'submit'])->whereNumber('id');
            Route::delete('nominations/{id}', [HomeroomAwardController::class, 'destroy'])->whereNumber('id');
        });

        // ========== PHÊ DUYỆT (Ban giám hiệu) ==========
        Route::prefix('approvals')->middleware(StaffToken::class)->group(function () {
            Route::get('overview', [BghApprovalHubController::class, 'overview']);
            Route::get('templates', [BghApprovalHubController::class, 'templates']);
            Route::get('types', [BghApprovalHubController::class, 'types']);
            Route::put('types/{code}', [BghApprovalHubController::class, 'updateType'])->where('code', '[a-z_]+');
            Route::get('delegations', [BghApprovalHubController::class, 'delegations']);
            Route::post('delegations', [BghApprovalHubController::class, 'createDelegation'])->middleware('throttle:20,1');
            Route::delete('delegations/{id}', [BghApprovalHubController::class, 'revokeDelegation'])->whereNumber('id');
            Route::get('staff', [BghApprovalHubController::class, 'staff']);
            Route::post('sync', [BghApprovalHubController::class, 'sync'])->middleware('throttle:30,1');
            Route::get('report', [BghApprovalHubController::class, 'report']);
            Route::get('export', [BghApprovalHubController::class, 'export']);
            Route::post('bulk', [BghApprovalHubController::class, 'bulk'])->middleware('throttle:30,1');
            Route::get('/', [BghApprovalHubController::class, 'list']);
            Route::get('{id}', [BghApprovalHubController::class, 'show'])->whereNumber('id');
            Route::post('{id}/decide', [BghApprovalHubController::class, 'decide'])->whereNumber('id')->middleware('throttle:60,1');
            Route::post('{id}/comment', [BghApprovalHubController::class, 'comment'])->whereNumber('id')->middleware('throttle:60,1');
        });
        // ========== HỒ SƠ CỦA TÔI ==========
        Route::put('profile/contact', [AcademicApiController::class, 'updateContact']);
        Route::post('change-password', [AcademicApiController::class, 'changePassword']);
        Route::get('security', [AcademicApiController::class, 'security']);
        Route::post('security/revoke-others', [AcademicApiController::class, 'revokeOthers']);
        Route::post('security/sessions/{id}/revoke', [AcademicApiController::class, 'revokeSession'])->whereNumber('id');
        Route::get('activity', [AcademicApiController::class, 'activity']);
    });
});

// ===== Giám sát hệ thống (Quản trị): token nhân viên thật, hoặc demo-token khi APP_ENV=local =====
Route::prefix('gv/monitor')->middleware(MonitorAccess::class)->group(function () {
        Route::get('overview', [GvMonitorController::class, 'overview']);
        Route::get('checks', [GvMonitorController::class, 'checks']);
        Route::post('checks/run', [GvMonitorController::class, 'runNow'])->middleware('throttle:30,1');
        Route::get('logs', [GvMonitorController::class, 'logs']);
        Route::get('logs/export', [GvMonitorController::class, 'logsExport']);
        Route::post('logs/purge', [GvMonitorController::class, 'logsPurge']);
        Route::get('logs/{id}', [GvMonitorController::class, 'logOne'])->whereNumber('id');
        Route::get('app-log', [GvMonitorController::class, 'appLog']);
        Route::post('app-log/clear', [GvMonitorController::class, 'appLogClear']);
        Route::get('performance', [GvMonitorController::class, 'performance']);
        Route::get('database', [GvMonitorController::class, 'database']);
        Route::get('database/counts', [GvMonitorController::class, 'tableCount'])->middleware('throttle:10,1');
        Route::post('database/analyze', [GvMonitorController::class, 'analyze'])->middleware('throttle:20,1');
        Route::post('database/cleanup', [GvMonitorController::class, 'cleanup']);
        Route::get('sessions', [GvMonitorController::class, 'sessions']);
        Route::post('sessions/revoke-all', [GvMonitorController::class, 'revokeAll']);
        Route::post('sessions/{type}/{id}/revoke', [GvMonitorController::class, 'revoke'])->whereNumber('id');
        Route::get('security', [GvMonitorController::class, 'security']);
        Route::post('accounts/{type}/{id}/unlock', [GvMonitorController::class, 'unlock'])->whereNumber('id');
        Route::get('alerts', [GvMonitorController::class, 'alerts']);
        Route::post('alerts/{id}', [GvMonitorController::class, 'alertAct'])->whereNumber('id');
        Route::put('rules/{id}', [GvMonitorController::class, 'ruleUpdate'])->whereNumber('id');
        Route::get('announcements', [GvMonitorController::class, 'announcements']);
        Route::post('announcements', [GvMonitorController::class, 'annStore']);
        Route::put('announcements/{id}', [GvMonitorController::class, 'annUpdate'])->whereNumber('id');
        Route::post('announcements/{id}/toggle', [GvMonitorController::class, 'annToggle'])->whereNumber('id');
        Route::delete('announcements/{id}', [GvMonitorController::class, 'annDestroy'])->whereNumber('id');
        Route::get('settings', [GvMonitorController::class, 'settings']);
        Route::put('settings', [GvMonitorController::class, 'settingsUpdate']);
});

// ===== Thông báo của Ban Giám hiệu: token nhân viên (HT / PHT / Quản trị), hoặc demo-token khi APP_ENV=local =====
Route::prefix('gv/notices')->middleware(NoticeAccess::class)->group(function () {
    Route::get('overview', [GvNoticeController::class, 'overview']);
    Route::get('meta', [GvNoticeController::class, 'meta']);
    Route::get('stats', [GvNoticeController::class, 'stats']);
    Route::post('audience', [GvNoticeController::class, 'audiencePreview']);
    Route::get('settings', [GvNoticeController::class, 'settingsGet']);
    Route::put('settings', [GvNoticeController::class, 'settingsUpdate']);
    Route::get('templates', [GvNoticeController::class, 'templates']);
    Route::post('templates', [GvNoticeController::class, 'templateStore']);
    Route::put('templates/{id}', [GvNoticeController::class, 'templateUpdate'])->whereNumber('id');
    Route::delete('templates/{id}', [GvNoticeController::class, 'templateDelete'])->whereNumber('id');
    Route::get('lessons', [GvAttendanceController::class, 'lessonsIndex']);
    Route::post('lessons/reopen', [GvAttendanceController::class, 'lessonReopen'])->middleware('throttle:60,1');
    Route::post('templates/{id}/use', [GvNoticeController::class, 'templateUse'])->whereNumber('id');
    Route::get('/', [GvNoticeController::class, 'index']);
    Route::post('/', [GvNoticeController::class, 'store'])->middleware('throttle:60,1');
    Route::get('{id}', [GvNoticeController::class, 'show'])->whereNumber('id');
    Route::put('{id}', [GvNoticeController::class, 'update'])->whereNumber('id');
    Route::delete('{id}', [GvNoticeController::class, 'destroy'])->whereNumber('id');
    Route::post('{id}/action', [GvNoticeController::class, 'act'])->whereNumber('id')->middleware('throttle:60,1');
    Route::get('{id}/reads', [GvNoticeController::class, 'reads'])->whereNumber('id');
    Route::get('{id}/unread', [GvNoticeController::class, 'unread'])->whereNumber('id');
    Route::get('{id}/export', [GvNoticeController::class, 'export'])->whereNumber('id');
});

// ===== Chuyên cần của Ban Giám hiệu (/bgh/attendance): cùng quyền với Thông báo (HT / PHT / Quản trị) =====
Route::prefix('gv/ca')->middleware(NoticeAccess::class)->group(function () {
    Route::get('meta', [GvAttendanceController::class, 'meta']);
    Route::get('overview', [GvAttendanceController::class, 'overview']);
    Route::get('day', [GvAttendanceController::class, 'day']);
    Route::post('mark', [GvAttendanceController::class, 'mark'])->middleware('throttle:60,1');
    Route::post('day/clear', [GvAttendanceController::class, 'dayClear'])->middleware('throttle:30,1');
    Route::get('classes', [GvAttendanceController::class, 'classesIndex']);
    Route::get('students', [GvAttendanceController::class, 'studentsIndex']);
    Route::get('students/lookup', [GvAttendanceController::class, 'studentLookup']);
    Route::get('students/{id}', [GvAttendanceController::class, 'studentShow'])->whereNumber('id');
    Route::get('leaves', [GvAttendanceController::class, 'leavesIndex']);
    Route::post('leaves', [GvAttendanceController::class, 'leaveStore'])->middleware('throttle:60,1');
    Route::post('leaves/{id}/action', [GvAttendanceController::class, 'leaveAction'])->whereNumber('id')->middleware('throttle:60,1');
    Route::get('alerts', [GvAttendanceController::class, 'alerts']);
    Route::get('cases', [GvAttendanceController::class, 'casesIndex']);
    Route::post('cases', [GvAttendanceController::class, 'caseStore'])->middleware('throttle:60,1');
    Route::put('cases/{id}', [GvAttendanceController::class, 'caseUpdate'])->whereNumber('id');
    Route::get('report', [GvAttendanceController::class, 'report']);
    Route::get('report/export', [GvAttendanceController::class, 'export']);
    Route::get('history', [GvAttendanceController::class, 'history']);
    Route::get('settings', [GvAttendanceController::class, 'settingsGet']);
    Route::put('settings', [GvAttendanceController::class, 'settingsUpdate']);
});

// ===== Kế hoạch của Ban Giám hiệu (/bgh/plans): cùng quyền với Thông báo (HT / PHT / Quản trị) =====
Route::prefix('gv/plans')->middleware(NoticeAccess::class)->group(function () {
    Route::get('/', [PlanController::class, 'index']);
    Route::get('stats', [PlanController::class, 'stats']);
    Route::get('options', [PlanController::class, 'options']);
    Route::post('from-template', [PlanController::class, 'fromTemplate']);
    Route::post('/', [PlanController::class, 'store']);

    // nhiệm vụ / liên kết theo id của chính nó (đặt trước các route {id})
    Route::put('tasks/{task}', [PlanTaskController::class, 'update'])->whereNumber('task');
    Route::delete('tasks/{task}', [PlanTaskController::class, 'destroy'])->whereNumber('task');
    Route::delete('links/{link}', [PlanExtraController::class, 'deleteLink'])->whereNumber('link');

    Route::get('{id}', [PlanController::class, 'show'])->whereNumber('id');
    Route::put('{id}', [PlanController::class, 'update'])->whereNumber('id');
    Route::delete('{id}', [PlanController::class, 'destroy'])->whereNumber('id');
    Route::post('{id}/transition', [PlanController::class, 'transition'])->whereNumber('id');
    Route::post('{id}/duplicate', [PlanController::class, 'duplicate'])->whereNumber('id');
    Route::post('{id}/tasks', [PlanTaskController::class, 'store'])->whereNumber('id');
    Route::post('{id}/comments', [PlanExtraController::class, 'comment'])->whereNumber('id');
    Route::post('{id}/links', [PlanExtraController::class, 'addLink'])->whereNumber('id');
});

// ===== Khu Kế toán: Đợt thu / Kỳ thu =====
// ===== Thi đua của Ban Giám hiệu (/bgh/rewards): /api/gv/rewards/... =====
Route::prefix('gv/rewards')->group(base_path('Modules/Rewards/Routes/api.php'));
// ===== Sổ đầu bài (GVCN): /api/gv/lesson-log/... =====
Route::prefix('gv/lesson-log')->group(base_path('Modules/LessonLog/Routes/api.php'));
Route::prefix('kt')->group(function () {
    Route::post('login', [FeePeriodController::class, 'login'])->middleware('throttle:20,1');

    Route::middleware(FeeStaffToken::class)->group(function () {
        Route::post('logout', [FeePeriodController::class, 'logout']);
        Route::get('me', [FeePeriodController::class, 'me']);
        Route::get('meta', [FeePeriodController::class, 'meta']);

        Route::get('periods', [FeePeriodController::class, 'index']);
        Route::post('periods', [FeePeriodController::class, 'store'])->middleware('throttle:30,1');
        Route::post('periods/preview', [FeePeriodController::class, 'preview'])->middleware('throttle:60,1');
        Route::get('periods/{id}', [FeePeriodController::class, 'show'])->whereNumber('id');
        Route::put('periods/{id}', [FeePeriodController::class, 'update'])->whereNumber('id');
        Route::get('periods/{id}/edit', [FeePeriodController::class, 'edit'])->whereNumber('id');
        Route::get('periods/{id}/invoices', [FeePeriodController::class, 'invoices'])->whereNumber('id');
        Route::get('periods/{id}/debtors', [FeePeriodController::class, 'debtors'])->whereNumber('id');
        Route::post('periods/{id}/preview', [FeePeriodController::class, 'previewPeriod'])->whereNumber('id');
        Route::post('periods/{id}/issue', [FeePeriodController::class, 'issue'])->whereNumber('id')->middleware('throttle:10,1');
        Route::post('periods/{id}/extend', [FeePeriodController::class, 'extend'])->whereNumber('id');
        Route::post('periods/{id}/close', [FeePeriodController::class, 'close'])->whereNumber('id');
        Route::post('periods/{id}/reopen', [FeePeriodController::class, 'reopen'])->whereNumber('id');
        Route::post('periods/{id}/cancel', [FeePeriodController::class, 'cancel'])->whereNumber('id');

        // ----- Quầy thu học phí -----
        Route::prefix('cashier')->group(function () {
            Route::get('meta', [FeeCashierController::class, 'meta']);
            Route::get('overview', [FeeCashierController::class, 'overview']);
            Route::get('students', [FeeCashierController::class, 'students']);
            Route::get('students/{id}', [FeeCashierController::class, 'student'])->whereNumber('id');
            Route::post('collect', [FeeCashierController::class, 'collect'])->middleware('throttle:60,1');
            Route::get('pending', [FeeCashierController::class, 'pending']);
            Route::post('payments/bulk-confirm', [FeeCashierController::class, 'bulkConfirm'])->middleware('throttle:20,1');
            Route::get('payments', [FeeCashierController::class, 'payments']);
            Route::get('payments/{id}', [FeeCashierController::class, 'receipt'])->whereNumber('id');
            Route::post('payments/{id}/confirm', [FeeCashierController::class, 'confirm'])->whereNumber('id');
            Route::post('payments/{id}/reject', [FeeCashierController::class, 'reject'])->whereNumber('id');
            Route::post('payments/{id}/void', [FeeCashierController::class, 'void'])->whereNumber('id');
            Route::get('daily', [FeeCashierController::class, 'daily']);
            Route::get('disputes', [FeeCashierController::class, 'disputes']);
            Route::post('disputes/{id}/reply', [FeeCashierController::class, 'replyDispute'])->whereNumber('id');
        });

        // ----- Phiếu thu / Biên lai -----
        Route::prefix('receipts')->group(function () {
            Route::get('meta', [FeeReceiptController::class, 'meta']);
            Route::get('stats', [FeeReceiptController::class, 'stats']);
            Route::get('', [FeeReceiptController::class, 'index']);
            Route::post('print', [FeeReceiptController::class, 'print'])->middleware('throttle:60,1');
            Route::post('reconcile', [FeeReceiptController::class, 'reconcile'])->middleware('throttle:30,1');
            Route::post('unreconcile', [FeeReceiptController::class, 'unreconcile'])->middleware('throttle:30,1');
        });

        // ----- Công nợ học phí -----
        Route::prefix('debts')->group(function () {
            Route::get('meta', [FeeDebtController::class, 'meta']);
            Route::get('overview', [FeeDebtController::class, 'overview']);
            Route::get('promises', [FeeDebtController::class, 'promises']);
            Route::get('', [FeeDebtController::class, 'index']);
            Route::get('students/{id}', [FeeDebtController::class, 'student'])->whereNumber('id');
            Route::post('notes', [FeeDebtController::class, 'addNote'])->middleware('throttle:60,1');
            Route::post('notes/{id}/resolve', [FeeDebtController::class, 'resolve'])->whereNumber('id')->middleware('throttle:60,1');
        });

        // ----- Nhắc nợ phụ huynh -----
        Route::prefix('reminders')->group(function () {
            Route::get('meta', [FeeReminderController::class, 'meta']);
            Route::get('suggestions', [FeeReminderController::class, 'suggestions']);
            Route::get('batches', [FeeReminderController::class, 'batches']);
            Route::get('batches/{id}', [FeeReminderController::class, 'batch'])->whereNumber('id');
            Route::get('stats', [FeeReminderController::class, 'stats']);
            Route::get('templates', [FeeReminderController::class, 'templates']);
            Route::get('students/{id}', [FeeReminderController::class, 'studentHistory'])->whereNumber('id');
            Route::post('preview', [FeeReminderController::class, 'preview']);
            Route::post('send', [FeeReminderController::class, 'send']);
            Route::post('settings', [FeeReminderController::class, 'saveSettings']);
            Route::post('templates', [FeeReminderController::class, 'saveTemplate']);
            Route::put('templates/{id}', [FeeReminderController::class, 'saveTemplate'])->whereNumber('id');
            Route::post('templates/{id}/toggle', [FeeReminderController::class, 'toggleTemplate'])->whereNumber('id');
            Route::post('batches/{id}/mark-sent', [FeeReminderController::class, 'markSent'])->whereNumber('id');
            Route::post('batches/{id}/cancel', [FeeReminderController::class, 'cancel'])->whereNumber('id');
        });
    });
});

/* ===== (ĐÃ TẮT) Khối finance cũ – trùng đường dẫn với khối mới bên dưới =====
// /api/admin/finance/...  – Học phí & Tài chính (cổng Admin). Nạp từ routes/api.php.
Route::prefix('admin/finance')->middleware(['auth:sanctum', AdminAccess::class])->group(function () {
    Route::get('meta', [C::class, 'meta']);
    Route::get('overview', [C::class, 'overview']);

    Route::get('invoices', [C::class, 'invoices']);
    Route::get('invoices/{id}', [C::class, 'invoice'])->whereNumber('id');

    Route::get('payments', [C::class, 'payments']);
    Route::post('payments/{id}/confirm', [C::class, 'confirmPayment'])->whereNumber('id');
    Route::post('payments/{id}/reject', [C::class, 'rejectPayment'])->whereNumber('id');

    Route::get('debts', [C::class, 'debts']);
    Route::get('debts/export', [C::class, 'exportDebts']);
    Route::get('debts/{studentId}/notes', [C::class, 'notes'])->whereNumber('studentId');
    Route::post('debts/{studentId}/notes', [C::class, 'addNote'])->whereNumber('studentId');
    Route::post('debts/notes/{id}/resolve', [C::class, 'resolveNote'])->whereNumber('id');

    Route::get('periods', [C::class, 'periods']);
    Route::post('periods/{id}/status', [C::class, 'setPeriodStatus'])->whereNumber('id');
    Route::get('fee-items', [C::class, 'feeItems']);

    Route::get('waivers', [C::class, 'waivers']);
    Route::get('disputes', [C::class, 'disputes']);
    Route::post('disputes/{id}/reply', [C::class, 'replyDispute'])->whereNumber('id');

    Route::get('audit', [C::class, 'audit']);
});
===== hết khối cũ ===== */

// ===== Admin: Thông tin cá nhân + Hộp thư (THÊM MỚI) =====
// Đăng ký cả /api/admin/profile lẫn /api/v1/admin/profile
foreach (['admin/profile', 'v1/admin/profile'] as $profilePrefix) {
    Route::middleware('auth:sanctum')->prefix($profilePrefix)->group(function () {
        Route::get('/', [AdminProfileController::class, 'show']);
        Route::put('/', [AdminProfileController::class, 'update']);
        Route::put('email', [AdminProfileController::class, 'email'])->middleware('throttle:6,1');
        Route::post('avatar', [AdminProfileController::class, 'avatar'])->middleware('throttle:10,1');
        Route::put('preferences', [AdminProfileController::class, 'preferences']);
        Route::post('password', [AdminProfileController::class, 'password'])->middleware('throttle:6,1');
        Route::get('sessions', [AdminProfileController::class, 'sessions']);
        Route::post('sessions/revoke-others', [AdminProfileController::class, 'revokeOthers']);
        Route::delete('sessions/{id}', [AdminProfileController::class, 'revoke'])->whereNumber('id');
        Route::get('activity', [AdminProfileController::class, 'activity']);

        Route::get('notifications', [AdminNotificationController::class, 'index']);
        Route::post('notifications/read-all', [AdminNotificationController::class, 'readAll']);
        Route::post('notifications/{id}/read', [AdminNotificationController::class, 'read'])->whereNumber('id');
        Route::delete('notifications/{id}', [AdminNotificationController::class, 'destroy'])->whereNumber('id');
    });
}

// Quản lý lớp học (dữ liệu sm_*): /api/v1/academic/class-management
Route::prefix('v1/academic/class-management')
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
 Route::prefix('v1/academic/grade-windows')
     ->middleware(['auth:sanctum', AcademicStaff::class])
     ->group(function () {
         Route::get('overview', [GradeWindowController::class, 'overview']);
         Route::post('open', [GradeWindowController::class, 'open']);
         Route::post('close', [GradeWindowController::class, 'close']);
         Route::post('exceptions', [GradeWindowController::class, 'addException']);
         Route::delete('exceptions/{id}', [GradeWindowController::class, 'removeException'])->whereNumber('id');
         Route::get('activity', [GradeWindowController::class, 'activity']);
     });

 // Prefix tự động: /api/v1/teacher
 Route::apiResource('teachers', TeacherController::class);

// Hồ sơ cá nhân giáo viên
require __DIR__ . '/profile.php';

// ===== Admin: Kiểm tra dữ liệu =====
foreach (['admin/checks', 'v1/admin/checks'] as $checksPrefix) {
    Route::middleware('auth:sanctum')->prefix($checksPrefix)->group(function () {
        Route::get('/', [AdminDataCheckController::class, 'index']);
        Route::post('run', [AdminDataCheckController::class, 'run'])->middleware('throttle:10,1');
        Route::get('{code}', [AdminDataCheckController::class, 'detail'])->where('code', '[a-z_]+')->middleware('throttle:60,1');
    });
}

// ===== Admin: Tài chính & Học phí (/api/admin/finance và /api/v1/admin/finance) =====
foreach (['admin/finance', 'v1/admin/finance'] as $financePrefix) {
    Route::middleware(['auth:sanctum', \App\Http\Middleware\AdminAccess::class])->prefix($financePrefix)->controller(AdminFinanceController::class)->group(function () {
        Route::get('meta', 'meta');
        Route::get('overview', 'overview');

        Route::get('invoices', 'invoices');
        Route::get('invoices/{id}', 'invoice')->whereNumber('id');
        Route::post('invoices/{id}/cancel', 'invoiceCancel')->whereNumber('id')->middleware('throttle:30,1');
        Route::post('invoices/{id}/pay', 'invoicePay')->whereNumber('id')->middleware('throttle:30,1');

        Route::get('payments', 'payments');
                Route::post('payments/{id}/confirm', 'paymentConfirm')->whereNumber('id')->middleware('throttle:30,1');
                Route::post('payments/{id}/reject', 'paymentReject')->whereNumber('id')->middleware('throttle:30,1');
        Route::get('reconcile', 'reconcile');
        Route::get('debts', 'debts');

        Route::get('items', 'items');
        Route::post('items', 'itemSave')->middleware('throttle:60,1');
        Route::put('items/{id}', 'itemSave')->whereNumber('id');
        Route::delete('items/{id}', 'itemDelete')->whereNumber('id');

        Route::get('students/search', 'studentSearch');
        Route::get('waivers', 'waivers');
        Route::post('waivers', 'waiverSave')->middleware('throttle:60,1');
        Route::put('waivers/{id}', 'waiverSave')->whereNumber('id');
        Route::delete('waivers/{id}', 'waiverDelete')->whereNumber('id');

        Route::get('disputes', 'disputes');
        Route::post('disputes/{id}/reply', 'disputeReply')->whereNumber('id')->middleware('throttle:60,1');

        Route::get('expenses', 'expenses');
        Route::post('expenses', 'expenseSave')->middleware('throttle:60,1');
        Route::put('expenses/{id}', 'expenseSave')->whereNumber('id');
        Route::delete('expenses/{id}', 'expenseDelete')->whereNumber('id');

        Route::get('report', 'report');
        Route::get('settings', 'settings');
        Route::put('settings', 'settingsSave');
        Route::get('audit', 'audits');
    });
}

// ===== Admin: Nhật ký hệ thống (/admin/logs) =====
require __DIR__ . '/system_logs.php';

// ===== Cổng Giáo viên chủ nhiệm (frontend gọi /api/teacher/homeroom/...) =====
Route::prefix('teacher')->middleware(StaffToken::class)->group(function () {
    Route::get('homeroom/dashboard', [TeacherPortalController::class, 'dashboard']);
    Route::get('homeroom/students/{id}', [TeacherPortalController::class, 'student'])->whereNumber('id');
    Route::get('homeroom', [TeacherPortalController::class, 'homeroom']);
    Route::get('homeroom/leaves', [TeacherPortalController::class, 'leaves']);
    Route::post('homeroom/leaves/{id}/review', [TeacherPortalController::class, 'reviewLeave'])
        ->whereNumber('id')
        ->middleware('throttle:60,1');

    // Sổ đầu bài – URL: /api/teacher/lesson-log và /api/teacher/homeroom/lesson-log
    Route::prefix('lesson-log')->controller(LessonLogController::class)->group(function () {
        Route::get('meta', 'meta');
        Route::get('students', 'students');
        Route::get('week', 'week');
        Route::get('stats', 'stats');
        Route::get('export', 'export');
        Route::post('week/confirm', 'confirmWeek')->middleware('throttle:30,1');
        Route::post('week/reopen', 'reopenWeek')->middleware('throttle:30,1');
        Route::get('/', 'index');
        Route::post('/', 'store')->middleware('throttle:120,1');
        Route::get('{id}', 'show')->whereNumber('id');
        Route::put('{id}', 'update')->whereNumber('id');
        Route::delete('{id}', 'destroy')->whereNumber('id');
        Route::post('{id}/sign', 'sign')->whereNumber('id');
        Route::post('{id}/unsign', 'unsign')->whereNumber('id');
        Route::post('{id}/reopen', 'reopen')->whereNumber('id');
        Route::post('{id}/comment', 'comment')->whereNumber('id')->middleware('throttle:60,1');
        Route::put('{id}/homeroom-note', 'homeroomNote')->whereNumber('id');
    });
    Route::prefix('homeroom/lesson-log')->controller(LessonLogController::class)->group(function () {
        Route::get('meta', 'meta');
        Route::get('students', 'students');
        Route::get('week', 'week');
        Route::get('stats', 'stats');
        Route::get('export', 'export');
        Route::post('week/confirm', 'confirmWeek')->middleware('throttle:30,1');
        Route::post('week/reopen', 'reopenWeek')->middleware('throttle:30,1');
        Route::get('/', 'index');
        Route::post('/', 'store')->middleware('throttle:120,1');
        Route::get('{id}', 'show')->whereNumber('id');
        Route::put('{id}', 'update')->whereNumber('id');
        Route::delete('{id}', 'destroy')->whereNumber('id');
        Route::post('{id}/sign', 'sign')->whereNumber('id');
        Route::post('{id}/unsign', 'unsign')->whereNumber('id');
        Route::post('{id}/reopen', 'reopen')->whereNumber('id');
        Route::post('{id}/comment', 'comment')->whereNumber('id')->middleware('throttle:60,1');
        Route::put('{id}/homeroom-note', 'homeroomNote')->whereNumber('id');
    });
});

// Alias thêm /api/v1/teacher/...
Route::prefix('v1/teacher')->middleware(StaffToken::class)->group(function () {
    Route::get('homeroom/dashboard', [TeacherPortalController::class, 'dashboard']);
    Route::get('homeroom/students/{id}', [TeacherPortalController::class, 'student'])->whereNumber('id');
    Route::get('homeroom', [TeacherPortalController::class, 'homeroom']);
    Route::get('homeroom/leaves', [TeacherPortalController::class, 'leaves']);
    Route::post('homeroom/leaves/{id}/review', [TeacherPortalController::class, 'reviewLeave'])
        ->whereNumber('id')
        ->middleware('throttle:60,1');

    // Sổ đầu bài – URL: /api/teacher/lesson-log và /api/teacher/homeroom/lesson-log
    Route::prefix('lesson-log')->controller(LessonLogController::class)->group(function () {
        Route::get('meta', 'meta');
        Route::get('students', 'students');
        Route::get('week', 'week');
        Route::get('stats', 'stats');
        Route::get('export', 'export');
        Route::post('week/confirm', 'confirmWeek')->middleware('throttle:30,1');
        Route::post('week/reopen', 'reopenWeek')->middleware('throttle:30,1');
        Route::get('/', 'index');
        Route::post('/', 'store')->middleware('throttle:120,1');
        Route::get('{id}', 'show')->whereNumber('id');
        Route::put('{id}', 'update')->whereNumber('id');
        Route::delete('{id}', 'destroy')->whereNumber('id');
        Route::post('{id}/sign', 'sign')->whereNumber('id');
        Route::post('{id}/unsign', 'unsign')->whereNumber('id');
        Route::post('{id}/reopen', 'reopen')->whereNumber('id');
        Route::post('{id}/comment', 'comment')->whereNumber('id')->middleware('throttle:60,1');
        Route::put('{id}/homeroom-note', 'homeroomNote')->whereNumber('id');
    });
    Route::prefix('homeroom/lesson-log')->controller(LessonLogController::class)->group(function () {
        Route::get('meta', 'meta');
        Route::get('students', 'students');
        Route::get('week', 'week');
        Route::get('stats', 'stats');
        Route::get('export', 'export');
        Route::post('week/confirm', 'confirmWeek')->middleware('throttle:30,1');
        Route::post('week/reopen', 'reopenWeek')->middleware('throttle:30,1');
        Route::get('/', 'index');
        Route::post('/', 'store')->middleware('throttle:120,1');
        Route::get('{id}', 'show')->whereNumber('id');
        Route::put('{id}', 'update')->whereNumber('id');
        Route::delete('{id}', 'destroy')->whereNumber('id');
        Route::post('{id}/sign', 'sign')->whereNumber('id');
        Route::post('{id}/unsign', 'unsign')->whereNumber('id');
        Route::post('{id}/reopen', 'reopen')->whereNumber('id');
        Route::post('{id}/comment', 'comment')->whereNumber('id')->middleware('throttle:60,1');
        Route::put('{id}/homeroom-note', 'homeroomNote')->whereNumber('id');
    });
});

// ===== THÊM MỚI: Xét thi đua – Khen thưởng (GVCN) =====
Route::prefix('v1/homeroom/awards')->group(function () {
    Route::get('overview', [HomeroomAwardController::class, 'overview']);
    Route::get('types', [HomeroomAwardController::class, 'types']);
    Route::get('periods', [HomeroomAwardController::class, 'periods']);
    Route::get('students', [HomeroomAwardController::class, 'students']);
    Route::get('nominations', [HomeroomAwardController::class, 'index']);
    Route::post('nominations', [HomeroomAwardController::class, 'store']);
    Route::put('nominations/{id}', [HomeroomAwardController::class, 'update'])->whereNumber('id');
    Route::post('nominations/{id}/submit', [HomeroomAwardController::class, 'submit'])->whereNumber('id');
    Route::delete('nominations/{id}', [HomeroomAwardController::class, 'destroy'])->whereNumber('id');
});

// ===== THÊM MỚI: Báo cáo Lớp Chủ nhiệm (GVCN) =====
Route::prefix('v1/homeroom/reports')->middleware(StaffToken::class)->group(function () {
    Route::get('/',                [HomeroomReportController::class, 'index']);
    Route::post('/',               [HomeroomReportController::class, 'store']);
    Route::get('/alerts',          [HomeroomReportController::class, 'smartAlerts']);
    Route::get('/class/{classId}/summary', [HomeroomReportController::class, 'classSummary'])->whereNumber('classId');

    Route::get('/{id}',            [HomeroomReportController::class, 'show'])->whereNumber('id');
    Route::put('/{id}',            [HomeroomReportController::class, 'update'])->whereNumber('id');
    Route::post('/{id}/submit',    [HomeroomReportController::class, 'submit'])->whereNumber('id');
    Route::get('/{id}/export/{format}', [HomeroomReportController::class, 'export'])
        ->whereNumber('id')
        ->where('format', 'pdf|excel');
});

// ===== THÊM MỚI: Thi đua - Khen thưởng (module Emulation) =====
Route::prefix('v1/homeroom/emulation')->middleware(StaffToken::class)
    ->group(base_path('Modules/Emulation/Routes/api.php'));

    // ===== THÊM MỚI: Kiểm tra (Giáo viên bộ môn): /api/v1/gv/teacher/exams/... =====
    Route::prefix('v1/gv/teacher/exams')->middleware(StaffToken::class)
        ->group(base_path('Modules/TeacherExam/Routes/api.php'));

// ===== Danh mục hệ thống (Catalog): /api/v1/catalog/... =====
Route::prefix('v1/catalog')->group(base_path('Modules/Catalog/Routes/api.php'));

// ===== Cài đặt hệ thống (Admin Settings): /api/v1/setting/... =====
Route::prefix('v1/setting')->middleware(['auth:sanctum'])->group(base_path('Modules/Setting/Routes/api.php'));

// ===== Sơ đồ & Sĩ số lớp (GVCN / BGH): /api/v1/homeroom/seating/... =====
Route::prefix('v1')->group(base_path('Modules/HrSeating/Routes/seating.php'));
Route::group([], base_path('Modules/HrSeating/Routes/seating.php'));
Route::prefix('gv')->group(base_path('Modules/HrSeating/Routes/seating.php'));
Route::prefix('v1/gv')->group(base_path('Modules/HrSeating/Routes/seating.php'));

// ========== KỶ LUẬT (Ban giám hiệu) ==========

Route::prefix('discipline')->middleware('auth:sanctum')->group(function () {
    Route::get('meta', [DisciplineController::class, 'meta']);
    Route::get('overview', [DisciplineController::class, 'overview']);
    Route::get('alerts', [DisciplineController::class, 'alerts']);

    Route::get('records', [DisciplineController::class, 'records']);
    Route::post('records', [DisciplineController::class, 'store']);
    Route::get('records/{id}', [DisciplineController::class, 'show'])->whereNumber('id');
    Route::put('records/{id}', [DisciplineController::class, 'update'])->whereNumber('id');
    Route::delete('records/{id}', [DisciplineController::class, 'destroy'])->whereNumber('id');
    Route::post('records/{id}/review', [DisciplineController::class, 'review'])->whereNumber('id');
    Route::post('records/{id}/resolve', [DisciplineController::class, 'resolve'])->whereNumber('id');
    Route::post('records/{id}/cancel', [DisciplineController::class, 'cancel'])->whereNumber('id');

    Route::get('students/search', [DisciplineController::class, 'studentSearch']);
    Route::get('students/{id}', [DisciplineController::class, 'studentProfile'])->whereNumber('id');
    Route::post('students/{id}/apply-conduct', [DisciplineController::class, 'applyConduct'])->whereNumber('id');

    Route::get('commendations', [DisciplineController::class, 'commendations']);
    Route::post('commendations', [DisciplineController::class, 'commendationStore']);
    Route::post('commendations/{id}/review', [DisciplineController::class, 'commendationReview'])->whereNumber('id');

    Route::get('appeals', [DisciplineController::class, 'appeals']);
    Route::post('appeals', [DisciplineController::class, 'appealStore']);
    Route::post('appeals/{id}/respond', [DisciplineController::class, 'appealRespond'])->whereNumber('id');

    Route::get('categories', [DisciplineController::class, 'categories']);
    Route::post('categories', [DisciplineController::class, 'categoryStore']);
    Route::put('categories/{id}', [DisciplineController::class, 'categoryUpdate'])->whereNumber('id');
    Route::delete('categories/{id}', [DisciplineController::class, 'categoryDestroy'])->whereNumber('id');

    Route::get('settings', [DisciplineController::class, 'settings']);
    Route::put('settings', [DisciplineController::class, 'settingsUpdate']);

    Route::get('reports/classes', [DisciplineController::class, 'classReport']);
    Route::get('logs', [DisciplineController::class, 'logs']);
    Route::get('export', [DisciplineController::class, 'export']);
});

// ===== Tự nhận cả /api/xxx lẫn /api/v1/xxx =====
// ===== Module Roster – Học sinh / Lớp học (admin) =====
// Frontend: /api/roster/... và /api/v1/roster/...
Route::prefix('roster')->group(base_path('Modules/Roster/Routes/api.php'));
Route::prefix('v1/roster')->group(base_path('Modules/Roster/Routes/api.php'));
// Dùng Route::any (mọi phương thức GET/POST/PUT/DELETE) và đặt CUỐI file. Frontend gọi thiếu hoặc thừa "/v1" thì vẫn chạy, không còn lỗi "The route ... could not be found".
Route::any('{aliasPath}', function (Request $r) {
    $rest = preg_replace('#^api/#', '', ltrim($r->path(), '/'));
    if ($r->headers->has('X-Api-Alias')) {
        return response()->json(['message' => 'The route api/' . $rest . ' could not be found.'], 404);
    }
    $target = preg_match('#^v1(/|$)#', $rest) ? preg_replace('#^v1/?#', '', $rest) : 'v1/' . $rest;
    $qs = $r->getQueryString();
    $sub = Request::create(
        '/api/' . $target . ($qs ? '?' . $qs : ''),
        $r->method(),
        $r->isMethod('GET') ? [] : $r->request->all(),
        $r->cookies->all(),
        $r->allFiles(),
        [],
        $r->getContent()
    );
    $sub->headers->replace($r->headers->all());
    $sub->headers->set('X-Api-Alias', '1');
    return app()->handle($sub);
})->where('aliasPath', '.*');
// ===== Điểm danh GV bộ môn – frontend /teacher/attendance =====
// Khớp URL frontend: /api/v1/gv/teacher/att/...
Route::prefix('v1/gv/teacher/att')->middleware(StaffToken::class)->group(function () {
    Route::get('today', [TeacherAttendanceController::class, 'overview']);
    // "today" = overview ngày hiện tại (frontend đang gọi endpoint này)
    Route::get('today',        [TeacherAttendanceController::class, 'overview']);
    Route::get('overview',     [TeacherAttendanceController::class, 'overview']);
    Route::get('missing',      [TeacherAttendanceController::class, 'missing']);
    Route::get('week',         [TeacherAttendanceController::class, 'week']);
    Route::get('roster',       [TeacherAttendanceController::class, 'roster']);
    Route::post('save',        [TeacherAttendanceController::class, 'save'])->middleware('throttle:60,1');
    Route::post('submit',      [TeacherAttendanceController::class, 'submit'])->middleware('throttle:30,1');
    Route::post('reopen',      [TeacherAttendanceController::class, 'reopenRequest'])->middleware('throttle:20,1');
    Route::get('history',      [TeacherAttendanceController::class, 'history']);
    Route::get('stats',        [TeacherAttendanceController::class, 'stats']);
    Route::get('student/{id}', [TeacherAttendanceController::class, 'student'])->whereNumber('id');
    Route::get('homeroom',     [TeacherAttendanceController::class, 'homeroom']);
});
