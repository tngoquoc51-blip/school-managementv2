<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AccountantController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\StudentPortalController;
use App\Http\Controllers\Api\StudentApiController;
use App\Http\Controllers\Api\StudentTuitionController;
use App\Http\Controllers\Api\AcademicApiController;
use App\Http\Middleware\StaffToken;
use App\Http\Controllers\Api\StudentWalletController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Student\StudentGradeController;
use App\Http\Middleware\StudentToken;

Route::get('/health', fn () => response()->json(['status' => 'ok']));

// Đăng nhập hệ thống (Sanctum / admin…)
Route::post('/auth/login', [AuthController::class, 'login']);

// Kế toán
Route::prefix('v1/accountant')->group(function () {
    Route::get('/dashboard', [AccountantController::class, 'dashboard']);
    Route::get('/fees', [AccountantController::class, 'fees']);
    Route::get('/debts', [AccountantController::class, 'debts']);
    Route::get('/receipts', [AccountantController::class, 'receipts']);
    Route::get('/reports', [AccountantController::class, 'reports']);
    Route::get('/students/search', [AccountantController::class, 'searchStudent']);
});

// Quản trị tài khoản
Route::prefix('admin')->group(function () {
    Route::get('/users', [UserController::class, 'index']);
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
Route::prefix('hs')->group(function () {
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

        // Thông báo / badge
        Route::get('notifications/badges', [NotificationController::class, 'badges']);
        Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::post('notifications/read-module', [NotificationController::class, 'readModule']);
        Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'markRead'])->whereNumber('id');

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
    });
});
