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
use App\Http\Controllers\Api\StudentReminderController;
use App\Http\Middleware\FeeStaffToken;
use App\Http\Middleware\StaffToken;
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
use Modules\Attendance\Controllers\AttendanceController;
use Modules\Attendance\Controllers\StudentAttendanceController;
use App\Http\Controllers\Api\StudentAttendancePortalController;
use App\Http\Controllers\Api\LessonAttendanceStaffController;
use App\Http\Controllers\Api\TeacherPortalController;
use Modules\Homework\Controllers\HomeworkController;
use App\Http\Controllers\Api\TeacherHomeworkPortalController;
use App\Http\Controllers\Admin\DataExportController;
use App\Http\Controllers\Admin\DataHubController;
use App\Http\Controllers\Admin\DataImportController;
use App\Http\Controllers\Admin\DataMappingController;
use Illuminate\Support\Facades\Route;

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
});
// Quản trị tài khoản + vai trò
Route::prefix('admin')->group(function () {
    Route::get('/users', [UserController::class, 'index']);

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

Route::prefix('data-hub')->group(function () {
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

        // ========== ĐIỂM DANH TỪNG TIẾT ==========
        Route::get('attendance/lessons', [LessonAttendanceStaffController::class, 'lessons']);
        Route::get('attendance/roster', [LessonAttendanceStaffController::class, 'roster']);
        Route::post('attendance/mark', [LessonAttendanceStaffController::class, 'mark'])->middleware('throttle:60,1');

        // ========== CỔNG GIÁO VIÊN: lớp & môn của tôi, lớp chủ nhiệm, duyệt đơn xin nghỉ ==========
        Route::prefix('teacher')->group(function () {
            Route::get('me', [TeacherPortalController::class, 'profile']);
            Route::get('assignments', [TeacherPortalController::class, 'assignments']);
            Route::get('assignments/{id}', [TeacherPortalController::class, 'assignment'])->whereNumber('id');
            Route::get('homeroom', [TeacherPortalController::class, 'homeroom']);
            Route::get('homeroom/leaves', [TeacherPortalController::class, 'leaves']);
            Route::post('homeroom/leaves/{id}/review', [TeacherPortalController::class, 'reviewLeave'])->whereNumber('id')->middleware('throttle:60,1');

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

        // ========== HỒ SƠ CỦA TÔI ==========
        Route::put('profile/contact', [AcademicApiController::class, 'updateContact']);
        Route::post('change-password', [AcademicApiController::class, 'changePassword']);
        Route::get('security', [AcademicApiController::class, 'security']);
        Route::post('security/revoke-others', [AcademicApiController::class, 'revokeOthers']);
        Route::post('security/sessions/{id}/revoke', [AcademicApiController::class, 'revokeSession'])->whereNumber('id');
        Route::get('activity', [AcademicApiController::class, 'activity']);
    });
});

// ===== Khu Kế toán: Đợt thu / Kỳ thu =====
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

// ===== Admin: Kiểm tra dữ liệu =====
foreach (['admin/checks', 'v1/admin/checks'] as $checksPrefix) {
    Route::middleware('auth:sanctum')->prefix($checksPrefix)->group(function () {
        Route::get('/', [AdminDataCheckController::class, 'index']);
        Route::post('run', [AdminDataCheckController::class, 'run'])->middleware('throttle:10,1');
        Route::get('{code}', [AdminDataCheckController::class, 'detail'])->where('code', '[a-z_]+')->middleware('throttle:60,1');
    });
}

// ===== Admin: Nhật ký hệ thống (/admin/logs) =====
require __DIR__ . '/system_logs.php';

// ===== Tự nhận cả /api/xxx lẫn /api/v1/xxx =====
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
