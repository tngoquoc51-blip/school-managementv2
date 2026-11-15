<?php

use Illuminate\Support\Facades\Route;
use Modules\Emulation\Controllers\EmulationController as C;
use Modules\Emulation\Middleware\EmulationAuth;

// Được nạp trong routes/api.php với prefix v1/homeroom/emulation + middleware StaffToken.
Route::middleware(EmulationAuth::class)->group(function () {
    Route::get('meta', [C::class, 'meta']);
    Route::get('overview', [C::class, 'overview']);
    Route::get('students', [C::class, 'students']);
    Route::get('students/{id}', [C::class, 'student'])->whereNumber('id');
    Route::get('class-ranking', [C::class, 'classRanking']);
    Route::get('activity', [C::class, 'activity']);

    Route::get('records', [C::class, 'records']);
    Route::post('records', [C::class, 'storeRecords']);
    Route::delete('records/{id}', [C::class, 'voidRecord'])->whereNumber('id');
    Route::post('records/{id}/restore', [C::class, 'restoreRecord'])->whereNumber('id');

    Route::get('suggestions', [C::class, 'suggestions']);
    Route::get('proposals', [C::class, 'proposals']);
    Route::post('proposals', [C::class, 'storeProposals']);
    Route::post('proposals/submit', [C::class, 'submitProposals']);
    Route::put('proposals/{id}', [C::class, 'updateProposal'])->whereNumber('id');
    Route::delete('proposals/{id}', [C::class, 'destroyProposal'])->whereNumber('id');
    Route::post('proposals/{id}/cancel', [C::class, 'cancelProposal'])->whereNumber('id');
    Route::post('proposals/{id}/review', [C::class, 'reviewProposal'])->whereNumber('id');

    Route::post('criteria', [C::class, 'storeCriterion']);
    Route::put('criteria/{id}', [C::class, 'updateCriterion'])->whereNumber('id');
});
