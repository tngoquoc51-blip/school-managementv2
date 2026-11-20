
<?php

use Illuminate\Support\Facades\Route;
use Modules\Accountant\Controllers\AuthController;
use Modules\Accountant\Controllers\DebtNoteController;
use Modules\Accountant\Controllers\DisputeController;
use Modules\Accountant\Controllers\MetaController;
use Modules\Accountant\Controllers\PaymentController;
use Modules\Accountant\Controllers\ReminderController;
use Modules\Accountant\Controllers\StudentFinanceController;
use Modules\Accountant\Controllers\WaiverController;
use Modules\Accountant\Middleware\StaffTokenAuth;
use Modules\Accountant\Controllers\SettingsController;
use Modules\Accountant\Middleware\AccountantAuth;

/*
|--------------------------------------------------------------------------
| API Kế toán - Hồ sơ tài chính học sinh
| Prefix tự động (ModuleLoaderServiceProvider): /api/v1/accountant
|--------------------------------------------------------------------------
*/

Route::post('auth/login', [AuthController::class, 'login']);

$read  = StaffTokenAuth::class . ':read';   // kế toán, hiệu trưởng, hiệu phó, admin
$write = StaffTokenAuth::class . ':write';  // chỉ kế toán, admin

// ----------------------------- CHỈ ĐỌC -----------------------------
Route::middleware($read)->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);

    Route::get('meta', [MetaController::class, 'index']);
    Route::get('notifications', [MetaController::class, 'notifications']);

    Route::get('students', [StudentFinanceController::class, 'index']);
    Route::get('students/export', [StudentFinanceController::class, 'export']);
    Route::get('students/{id}', [StudentFinanceController::class, 'show'])->whereNumber('id');
    Route::get('students/{id}/invoices', [StudentFinanceController::class, 'invoices'])->whereNumber('id');
    Route::get('students/{id}/wallet', [StudentFinanceController::class, 'wallet'])->whereNumber('id');
    Route::get('students/{id}/timeline', [StudentFinanceController::class, 'timeline'])->whereNumber('id');
    Route::get('invoices/{id}', [StudentFinanceController::class, 'invoice'])->whereNumber('id');

    Route::get('students/{id}/payments', [PaymentController::class, 'index'])->whereNumber('id');
    Route::get('payments/{id}/receipt', [PaymentController::class, 'receipt'])->whereNumber('id');

    Route::get('students/{id}/waivers', [WaiverController::class, 'index'])->whereNumber('id');
    Route::get('students/{id}/debt-notes', [DebtNoteController::class, 'index'])->whereNumber('id');
    Route::get('students/{id}/reminders', [ReminderController::class, 'index'])->whereNumber('id');
    Route::get('students/{id}/disputes', [DisputeController::class, 'index'])->whereNumber('id');
});

// ----------------------------- GHI DỮ LIỆU -----------------------------
Route::middleware($write)->group(function () {
    Route::post('students/{id}/payments', [PaymentController::class, 'collect'])->whereNumber('id');
    Route::post('payments/{id}/confirm', [PaymentController::class, 'confirm'])->whereNumber('id');
    Route::post('payments/{id}/reject', [PaymentController::class, 'reject'])->whereNumber('id');
    Route::post('payments/{id}/void', [PaymentController::class, 'void'])->whereNumber('id');

    Route::post('students/{id}/waivers', [WaiverController::class, 'store'])->whereNumber('id');
    Route::put('waivers/{id}', [WaiverController::class, 'update'])->whereNumber('id');
    Route::delete('waivers/{id}', [WaiverController::class, 'destroy'])->whereNumber('id');

    Route::post('students/{id}/debt-notes', [DebtNoteController::class, 'store'])->whereNumber('id');
    Route::post('debt-notes/{id}/resolve', [DebtNoteController::class, 'resolve'])->whereNumber('id');

    Route::post('students/{id}/reminders/preview', [ReminderController::class, 'preview'])->whereNumber('id');
    Route::post('students/{id}/reminders', [ReminderController::class, 'store'])->whereNumber('id');
    Route::post('reminders/{id}/mark-sent', [ReminderController::class, 'markSent'])->whereNumber('id');
    Route::post('reminders/{id}/cancel', [ReminderController::class, 'cancel'])->whereNumber('id');

    Route::post('disputes/{id}/reply', [DisputeController::class, 'reply'])->whereNumber('id');
});
/*
 | Tuyến đường Cài đặt Kế toán: /api/v1/accountant/settings/...
 */
Route::middleware(AccountantAuth::class)->prefix('settings')->group(function () {
    Route::get('overview',                 [SettingsController::class, 'overview']);

    // Thông tin thu tiền, phiếu thu, nhắc nợ (sm_fee_settings)
    Route::get('fee-settings',             [SettingsController::class, 'feeSettings']);
    Route::put('fee-settings',             [SettingsController::class, 'saveFeeSettings']);

    // Danh mục khoản thu (sm_fee_items)
    Route::get('fee-items',                [SettingsController::class, 'feeItems']);
    Route::post('fee-items',               [SettingsController::class, 'storeFeeItem']);
    Route::put('fee-items/{id}',           [SettingsController::class, 'updateFeeItem'])->whereNumber('id');
    Route::delete('fee-items/{id}',        [SettingsController::class, 'deleteFeeItem'])->whereNumber('id');

    // Mẫu thông báo nhắc nợ (sm_reminder_templates)
    Route::get('templates',                [SettingsController::class, 'templates']);
    Route::post('templates',               [SettingsController::class, 'storeTemplate']);
    Route::put('templates/{id}',           [SettingsController::class, 'updateTemplate'])->whereNumber('id');
    Route::patch('templates/{id}/toggle',  [SettingsController::class, 'toggleTemplate'])->whereNumber('id');
    Route::delete('templates/{id}',        [SettingsController::class, 'deleteTemplate'])->whereNumber('id');

    // Tùy chọn cá nhân (sm_acc_user_prefs)
    Route::get('prefs',                    [SettingsController::class, 'prefs']);
    Route::put('prefs',                    [SettingsController::class, 'savePrefs']);

    // Bảo mật: đổi mật khẩu, phiên đăng nhập (sm_staff_accounts, sm_staff_tokens)
    Route::post('password',                [SettingsController::class, 'changePassword']);
    Route::get('sessions',                 [SettingsController::class, 'sessions']);
    Route::delete('sessions/{id}',         [SettingsController::class, 'revokeSession'])->whereNumber('id');
    Route::delete('sessions',              [SettingsController::class, 'revokeOtherSessions']);

    // Nhật ký (sm_acc_setting_log + sm_fee_audit)
    Route::get('logs',                     [SettingsController::class, 'logs']);
});
