<?php

use Illuminate\Support\Facades\Route;
use Modules\Discipline\Controllers\DisciplineController as C;

// Prefix tự động: /api/v1/discipline  (do ModuleLoaderServiceProvider nạp)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('meta', [C::class, 'meta']);
    Route::get('overview', [C::class, 'overview']);
    Route::get('alerts', [C::class, 'alerts']);
    Route::get('logs', [C::class, 'logs']);
    Route::get('export', [C::class, 'export']);
    Route::get('reports/classes', [C::class, 'classReport']);

    Route::get('students/search', [C::class, 'studentSearch']);
    Route::get('students/{id}/profile', [C::class, 'studentProfile']);
    Route::post('students/{id}/apply-conduct', [C::class, 'applyConduct']);

    Route::get('records', [C::class, 'records']);
    Route::post('records', [C::class, 'store']);
    Route::get('records/{id}', [C::class, 'show']);
    Route::put('records/{id}', [C::class, 'update']);
    Route::delete('records/{id}', [C::class, 'destroy']);
    Route::post('records/{id}/review', [C::class, 'review']);
    Route::post('records/{id}/resolve', [C::class, 'resolve']);
    Route::post('records/{id}/cancel', [C::class, 'cancel']);

    Route::get('commendations', [C::class, 'commendations']);
    Route::post('commendations', [C::class, 'commendationStore']);
    Route::post('commendations/{id}/review', [C::class, 'commendationReview']);

    Route::get('appeals', [C::class, 'appeals']);
    Route::post('appeals', [C::class, 'appealStore']);
    Route::post('appeals/{id}/respond', [C::class, 'appealRespond']);

    Route::get('categories', [C::class, 'categories']);
    Route::post('categories', [C::class, 'categoryStore']);
    Route::put('categories/{id}', [C::class, 'categoryUpdate']);
    Route::delete('categories/{id}', [C::class, 'categoryDestroy']);

    Route::get('settings', [C::class, 'settings']);
    Route::put('settings', [C::class, 'settingsUpdate']);
});
