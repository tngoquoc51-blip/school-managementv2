<?php

use Illuminate\Support\Facades\Route;
use Modules\Accountant\Controllers\AccountantController;
// Nếu controller nằm ở App\Http\Controllers\Api thì dùng:
// use App\Http\Controllers\Api\AccountantController;

Route::get('/dashboard', [AccountantController::class, 'dashboard']);
Route::get('/fees', [AccountantController::class, 'fees']);
Route::get('/debts', [AccountantController::class, 'debts']);
Route::get('/receipts', [AccountantController::class, 'receipts']);
Route::get('/reports', [AccountantController::class, 'reports']);
Route::get('/students/search', [AccountantController::class, 'searchStudent']);
