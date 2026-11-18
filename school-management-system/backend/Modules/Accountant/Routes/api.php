<?php

use Illuminate\Support\Facades\Route;
use Modules\Accountant\Controllers\SettingsController;
use Modules\Accountant\Middleware\AccountantAuth;

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
