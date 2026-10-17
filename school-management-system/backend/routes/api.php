<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AccountantController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Student\StudentGradeController;

Route::get('/health', fn () => response()->json(['status' => 'ok']));

// Đăng nhập
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

// Học sinh – bảng điểm
Route::prefix('student')->group(function () {
    Route::get('/grades', [StudentGradeController::class, 'index']);
});
