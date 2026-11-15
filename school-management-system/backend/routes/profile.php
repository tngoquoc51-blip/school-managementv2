<?php

use App\Http\Middleware\StaffToken;
use Illuminate\Support\Facades\Route;
use Modules\Teacher\Controllers\TeacherProfileController as C;

// Được nạp từ Modules/Teacher/Routes/api.php (bộ nạp module thêm tiền tố "api").
// Đường dẫn thật: /api/gv/teacher/profile/...  – đăng nhập bằng token nhân viên (StaffToken).
// Ảnh đại diện: không qua StaffToken để thẻ <img> tải được
Route::get('gv/teacher/avatar/{teacherId}', [C::class, 'avatarFile'])->whereNumber('teacherId');

Route::prefix('gv/teacher/profile')->middleware(StaffToken::class)->group(function () {
    Route::get('overview', [C::class, 'overview']);
    Route::get('teaching', [C::class, 'teaching']);
    Route::put('info', [C::class, 'updateInfo']);
    Route::post('avatar', [C::class, 'avatar']);

    Route::get('qualifications', [C::class, 'qualifications']);
    Route::post('qualifications', [C::class, 'storeQualification']);
    Route::put('qualifications/{id}', [C::class, 'updateQualification'])->whereNumber('id');
    Route::delete('qualifications/{id}', [C::class, 'destroyQualification'])->whereNumber('id');

    Route::get('requests', [C::class, 'requests']);
    Route::post('requests', [C::class, 'storeRequest']);
    Route::delete('requests/{id}', [C::class, 'cancelRequest'])->whereNumber('id');

    Route::post('password', [C::class, 'password']);
    Route::get('sessions', [C::class, 'sessions']);
    Route::delete('sessions', [C::class, 'revokeOthers']);
    Route::delete('sessions/{id}', [C::class, 'revokeSession'])->whereNumber('id');
    Route::get('login-history', [C::class, 'loginHistory']);

    Route::get('settings', [C::class, 'settings']);
    Route::put('settings', [C::class, 'updateSettings']);
    Route::get('activity', [C::class, 'activity']);
});
