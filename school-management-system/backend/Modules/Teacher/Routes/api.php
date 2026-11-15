<?php

use Illuminate\Support\Facades\Route;
use Modules\Teacher\Controllers\TeacherController;

// Prefix tự động: /api/v1/teacher
Route::apiResource('teachers', TeacherController::class);

require __DIR__ . '/profile.php';
