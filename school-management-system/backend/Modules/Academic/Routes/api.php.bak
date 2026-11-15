<?php

use Illuminate\Support\Facades\Route;
use Modules\Academic\Controllers\ClassRoomController;
use Modules\Academic\Controllers\TimetableController;

// Prefix tự động: /api/v1/academic
Route::apiResource('classes', ClassRoomController::class);

Route::get('timetable/class/{classId}', [TimetableController::class, 'byClass']);
Route::get('timetable/me', [TimetableController::class, 'me']);
Route::get('timetable/student/{userId}', [TimetableController::class, 'byStudent']);
Route::post('timetable', [TimetableController::class, 'store']);
Route::delete('timetable/{id}', [TimetableController::class, 'destroy']);
